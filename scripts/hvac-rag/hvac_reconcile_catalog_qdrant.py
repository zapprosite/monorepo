#!/usr/bin/env python3
"""
Reconcile Inmetro/PBE catalog with Qdrant hvac_manuals_v1 — generate coverage report.

Output:
  /srv/data/hvac-rag/catalog/manual-coverage.json   — full JSON with array + summary
  /srv/data/hvac-rag/catalog/manual-coverage.csv    — flat CSV

Flags:
  --dry-run         simulate (print counts, no file writes)
  --catalog  PATH   override path to Inmetro JSONL catalog
  --output-dir PATH override output directory
"""

import argparse
import csv
import json
import os
import sys
from datetime import datetime, timezone
from pathlib import Path

import requests

QDRANT_URL  = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_KEY  = os.environ.get("QDRANT_API_KEY", "")
COLLECTION  = "hvac_manuals_v1"
LIMIT       = 1000          # scroll page size


def qdrant_headers() -> dict:
    return {"Authorization": f"Bearer {QDRANT_KEY}", "Content-Type": "application/json"} if QDRANT_KEY else {"Content-Type": "application/json"}


def scroll_qdrant() -> list[dict]:
    """Scroll all points from Qdrant collection. Returns list of point payloads."""
    points = []
    offset = None
    while True:
        body = {"limit": LIMIT, "with_payload": True}
        if offset:
            body["offset"] = offset
        try:
            r = requests.post(
                f"{QDRANT_URL}/collections/{COLLECTION}/points/scroll",
                headers=qdrant_headers(),
                json=body,
                timeout=60,
            )
        except requests.RequestException as exc:
            print(f"[reconcile] Qdrant scroll error: {exc}", file=sys.stderr)
            break
        if r.status_code != 200:
            print(f"[reconcile] Qdrant HTTP {r.status_code}: {r.text[:200]}", file=sys.stderr)
            break
        data = r.json()
        results = data.get("result", {})
        page = results.get("points", [])
        if not page:
            break
        points.extend(page)
        offset = results.get("next_page_offset")
        if offset is None:
            break
    return points


def load_catalog(path: Path) -> list[dict]:
    """Load Inmetro catalog from JSON or JSONL."""
    if not path.exists():
        return []
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        return []
    # auto-detect format
    if text.startswith("["):
        # JSON array
        return json.loads(text)
    else:
        # JSONL — one dict per line
        records = []
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                records.append(json.loads(line))
            except json.JSONDecodeError:
                pass
        return records


def model_candidates_for_point(point: dict) -> list[str]:
    """Extract flat list of model strings from Qdrant point payload."""
    payload = point.get("payload", {})
    mc = payload.get("model_candidates", [])
    if isinstance(mc, list):
        return [str(m).strip().lower() for m in mc if m]
    return []


def doc_type_for_point(point: dict) -> str:
    return (point.get("payload") or {}).get("doc_type", "")


def qdrant_doc_id(point: dict) -> str:
    """Return Qdrant point id as string."""
    return str(point.get("id", ""))


def match_model_to_candidates(catalog_model: str, candidates: list[str]) -> bool:
    """Case-insensitive substring match: catalog_model appears in any candidate."""
    if not catalog_model:
        return False
    cat_lower = catalog_model.lower().strip()
    for cand in candidates:
        if cat_lower in cand:
            return True
    return False


def reconcile(catalog: list[dict], qdrant_points: list[dict]) -> list[dict]:
    """
    For each catalog model determine:
      - manual_status: "indexed" | "missing"
      - qdrant_doc_ids: list of Qdrant doc_ids that matched
      - service_manual_indexed: bool
      - installation_manual_indexed: bool
      - error_codes_available: bool
      - wiring_available: bool
    """
    # index qdrant candidates → list of point dicts
    qdrant_index: list[dict] = []
    for pt in qdrant_points:
        qdrant_index.append({
            "qdrant_doc_id": qdrant_doc_id(pt),
            "candidates": model_candidates_for_point(pt),
            "doc_type": doc_type_for_point(pt),
        })

    rows = []
    for rec in catalog:
        # normalize field names from Inmetro script output
        brand          = rec.get("marca")         or rec.get("brand")         or ""
        indoor_model   = rec.get("modelo")        or rec.get("model")         or rec.get("indoor_model")   or ""
        # outdoor may be same as modelo for single-Split entries
        outdoor_model  = rec.get("outdoor_model") or rec.get("modelo_externo") or indoor_model
        equipment_type = rec.get("tipo")          or rec.get("equipment_type") or ""
        technology     = rec.get("tecnologia")    or rec.get("technology")    or ""
        capacity_btu_h = rec.get("capacidade")    or rec.get("capacity_btu_h")or ""
        registration   = rec.get("numero_registro") or rec.get("registration_number") or ""
        catalog_id     = rec.get("id") or rec.get("catalog_id") or f"{brand}_{indoor_model}_{registration}"

        matched_points = []
        service_manual_indexed      = False
        installation_manual_indexed = False
        error_codes_available       = False
        wiring_available            = False

        all_candidates = [indoor_model, outdoor_model]
        if equipment_type:
            all_candidates.append(equipment_type)

        for pt in qdrant_index:
            for model_key in all_candidates:
                if match_model_to_candidates(model_key, pt["candidates"]):
                    matched_points.append(pt["qdrant_doc_id"])
                    doc_type = pt["doc_type"].lower()
                    if doc_type == "service_manual":
                        service_manual_indexed = True
                    elif doc_type in ("installation_manual", "install_manual"):
                        installation_manual_indexed = True
                    if doc_type and ("error" in doc_type or "fault" in doc_type):
                        error_codes_available = True
                    if doc_type and "wiring" in doc_type:
                        wiring_available = True
                    break   # stop at first match per point

        matched_ids = list(dict.fromkeys(matched_points))  # dedupe preserve order
        manual_status = "indexed" if matched_ids else "missing"

        rows.append({
            "catalog_id":                  catalog_id,
            "brand":                       brand,
            "indoor_model":                indoor_model,
            "outdoor_model":               outdoor_model,
            "equipment_type":              equipment_type,
            "technology":                  technology,
            "capacity_btu_h":              capacity_btu_h,
            "registration_number":         registration,
            "manual_status":               manual_status,
            "service_manual_indexed":      service_manual_indexed,
            "installation_manual_indexed": installation_manual_indexed,
            "error_codes_available":       error_codes_available,
            "wiring_available":           wiring_available,
            "qdrant_doc_ids":              matched_ids,
            "priority_rank":               0,  # filled below
        })

    # ── priority rank: capacity DESC — higher capacity = higher priority ──
    def capacity_sort_key(r: dict) -> float:
        cap = r.get("capacity_btu_h") or ""
        # extract numeric portion (e.g. "12000 BTU/h" → 12000)
        digits = ''.join(ch for ch in str(cap) if ch.isdigit())
        return float(digits) if digits else 0.0

    # sort missing first, then by capacity desc, then by catalog_id asc for tie-break
    missing_first = sorted(rows, key=lambda r: (r["manual_status"] == "indexed", -capacity_sort_key(r), r["catalog_id"]))
    for rank, rec in enumerate(missing_first, start=1):
        rec["priority_rank"] = rank

    return rows


def build_summary(rows: list[dict]) -> dict:
    total     = len(rows)
    indexed   = sum(1 for r in rows if r["manual_status"] == "indexed")
    missing   = sum(1 for r in rows if r["manual_status"] == "missing")
    svc_man   = sum(1 for r in rows if r["service_manual_indexed"])
    inst_man  = sum(1 for r in rows if r["installation_manual_indexed"])
    err_codes = sum(1 for r in rows if r["error_codes_available"])
    wiring    = sum(1 for r in rows if r["wiring_available"])

    # top-20 missing by priority
    top_missing = [
        {"rank": r["priority_rank"], "catalog_id": r["catalog_id"],
         "brand": r["brand"], "indoor_model": r["indoor_model"],
         "capacity_btu_h": r["capacity_btu_h"]}
        for r in rows
        if r["manual_status"] == "missing"
    ][:20]

    return {
        "generated_at":          datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "total_catalog_models":   total,
        "indexed":               indexed,
        "missing":               missing,
        "coverage_pct":          round(indexed / total * 100, 2) if total else 0.0,
        "service_manuals_indexed": svc_man,
        "installation_manuals_indexed": inst_man,
        "error_codes_available": err_codes,
        "wiring_diagrams_available": wiring,
        "top_missing_models":     top_missing,
    }


CSV_FIELDS = [
    "catalog_id", "brand", "indoor_model", "outdoor_model",
    "equipment_type", "technology", "capacity_btu_h",
    "registration_number", "manual_status",
    "service_manual_indexed", "installation_manual_indexed",
    "error_codes_available", "wiring_available",
    "qdrant_doc_ids", "priority_rank",
]


def write_csv(rows: list[dict], path: Path) -> None:
    with path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.DictWriter(fh, fieldnames=CSV_FIELDS, extrasaction="ignore")
        writer.writeheader()
        for rec in rows:
            # serialise list as semicolon-joined string
            row = dict(rec)
            row["qdrant_doc_ids"] = ";".join(rec["qdrant_doc_ids"])
            writer.writerow(row)


def main() -> None:
    ap = argparse.ArgumentParser(description="Reconcile Inmetro catalog with Qdrant")
    ap.add_argument("--dry-run",    action="store_true", help="simulate, no file writes")
    ap.add_argument("--catalog",    default=None,        help="override catalog JSONL path")
    ap.add_argument("--output-dir", default=None,        help="override output directory")
    args = ap.parse_args()

    script_dir  = Path(__file__).parent.resolve()
    base_dir    = Path('/srv/data/hvac-rag')

    catalog_path = Path(args.catalog) if args.catalog else (
        base_dir / 'catalog' / 'inmetro_ac_br_models.jsonl')
    if not catalog_path.exists():
        catalog_path = base_dir / 'catalog' / 'inmetro_raw.json'
    if not catalog_path.exists():
        catalog_path = base_dir / 'catalog' / 'inmetro_raw_*.json'
        import glob as _glob
        matches = sorted(_glob.glob(str(catalog_path)))
        catalog_path = Path(matches[-1]) if matches else base_dir / 'catalog' / 'inmetro_ac_br_models.jsonl'

    output_dir = Path(args.output_dir) if args.output_dir else (base_dir / 'catalog')
    out_json   = output_dir / 'manual-coverage.json'
    out_csv    = output_dir / 'manual-coverage.csv'

    print(f"[reconcile] Catalog : {catalog_path}", file=sys.stderr)
    print(f"[reconcile] Output   : {output_dir}", file=sys.stderr)

    catalog = load_catalog(catalog_path)
    print(f"[reconcile] Catalog entries: {len(catalog)}", file=sys.stderr)

    # ── scroll Qdrant ────────────────────────────────────────────────────────
    if args.dry_run:
        print("[reconcile] DRY RUN — Qdrant scroll skipped", file=sys.stderr)
        qdrant_points: list[dict] = []
    else:
        print("[reconcile] Scrolling Qdrant hvac_manuals_v1 ...", file=sys.stderr)
        qdrant_points = scroll_qdrant()
        print(f"[reconcile] Qdrant points fetched: {len(qdrant_points)}", file=sys.stderr)

    rows = reconcile(catalog, qdrant_points)
    summary = build_summary(rows)

    print(
        f"[reconcile] Indexed: {summary['indexed']}  "
        f"Missing: {summary['missing']}  "
        f"Coverage: {summary['coverage_pct']}%",
        file=sys.stderr,
    )

    if args.dry_run:
        print("[reconcile] DRY RUN — no files written", file=sys.stderr)
        # print sample
        print("[reconcile] Sample (first 3 rows):", file=sys.stderr)
        for r in rows[:3]:
            print(json.dumps(r, ensure_ascii=False), file=sys.stderr)
        return

    output_dir.mkdir(parents=True, exist_ok=True)

    # JSON output
    output_json = {"summary": summary, "rows": rows}
    with out_json.open("w", encoding="utf-8") as fh:
        json.dump(output_json, fh, ensure_ascii=False, indent=2)
    print(f"[reconcile] Written: {out_json}", file=sys.stderr)

    # CSV output
    write_csv(rows, out_csv)
    print(f"[reconcile] Written: {out_csv}", file=sys.stderr)


if __name__ == "__main__":
    main()
