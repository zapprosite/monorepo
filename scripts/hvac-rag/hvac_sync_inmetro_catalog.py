#!/usr/bin/env python3
"""
Fetch Inmetro/PBE air conditioner catalog XLSX and convert to JSON.

URLs (tried in order — first accessible wins):
  1. gov.br/assuntos/.../condicionadores-de-ar/planilha-de-condicionadores-de-ar.xlsx
  2. gov.br/inmetro/pt-br/areas-de-atuacao/.../condicionadores-de-ar.xlsx (legacy)

If the site changed, use: --url YOUR_DISCOVERED_URL

Outputs:
  /srv/data/hvac-rag/catalog/inmetro_raw_{date}.json   — all rows + inverter flag
  /srv/data/hvac-rag/catalog/rejected_non_inverter.json — conventional rows

Flags:
  --dry-run        show row counts without downloading
  --offline        read from most recent /tmp/inmetro_ac_*.xlsx cache
  --force-refresh  re-download even if cache exists
  --url URL        override download URL
"""

import sys
import json
import hashlib
import argparse
from datetime import date, datetime
from pathlib import Path

try:
    import requests
except ImportError:
    requests = None

try:
    import openpyxl
except ImportError:
    openpyxl = None

# Try in order of preference — first accessible URL wins
INMETRO_URLS = [
    "https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/condicionadores-de-ar/planilha-de-condicionadores-de-ar.xlsx",
    "https://www.gov.br/inmetro/pt-br/areas-de-atuacao/eficiencia-energetica/"
    "etiquetagem-veicular-e-de-equipamentos/arquivos-e-recursos/arquivos/"
    "condicionadores-de-ar/planilha-de-condicionadores-de-ar.xlsx",
]
INMETRO_URL = None  # resolved at runtime

UA_HEADER = {"User-Agent": "Mozilla/5.0 (compatible; HVAC-RAG-bot/1.0)"}
TIMEOUT = 60
XLSX_CACHE_DIR = Path("/tmp")
OUT_DIR = Path("/srv/data/hvac-rag/catalog")

# Column name variants to try (case-insensitive lookup)
COL_MARCA = [
    "Marca / Brand",
    "Marca",
    "Fabricante",
    "Fabricante / Fornecedor",
    "Fornecedor",
    "Brand",
]
COL_MODELO = ["Modelo", "Modelo / Unidade Interna", "Modelo Interno", "Denominação"]
COL_TIPO = ["Tipo", "Tipo de Equipamento", "Categoria"]
COL_CAPACIDADE = [
    "Capacidade (BTU/h)",
    "Capacidade BTU/h",
    "Capacidade (kBTU/h)",
    "Capacidade",
    "Potência (BTU/h)",
    "Potência",
]
COL_TENSAO = [
    "Tensão (V)",
    "Tensão",
    "Voltagem",
    "Tensão (V) / Frequência (Hz)",
]
COL_GAS = [
    "Gás Refrigerante",
    "Refrigerante",
    "Gás",
    "Tipo de Gás",
    "Refrigerante / Gás",
]
COL_REGISTRO = [
    "Número de Registro",
    "Registro",
    "Número de registro",
    "Nº Registro",
    "Registro Inmetro",
]
COL_TECNOLOGIA = [
    "Tecnologia de compressão",
    "Tecnologia",
    "Tecnologia do Compressor",
    "Compressor",
    "Tipo de Compressor",
]


def _find_col(headers: list[str], candidates: list[str]) -> int | None:
    """Return 0-based column index for the first candidate that matches a header."""
    lc = {h.lower().strip(): i for i, h in enumerate(headers)}
    for cand in candidates:
        if cand.lower().strip() in lc:
            return lc[cand.lower().strip()]
    return None


def _get_row(wb, idx: int):
    """Get worksheet row 1-indexed."""
    return [c.value for c in wb[idx]]


def _sheet_to_records(wb) -> tuple[list[dict], list[str]]:
    """Convert active sheet to list of dicts. Returns (records, column_errors)."""
    ws = wb.active
    rows = list(ws.iter_rows(values_only=True))
    if not rows:
        return [], ["empty sheet"]
    headers = [str(h).strip() if h is not None else "" for h in rows[0]]

    col_errors = []

    # Resolve column indices
    col_idx = {
        name: _find_col(headers, candidates)
        for name, candidates in {
            "marca": COL_MARCA,
            "modelo": COL_MODELO,
            "tipo": COL_TIPO,
            "capacidade": COL_CAPACIDADE,
            "tensao": COL_TENSAO,
            "gas": COL_GAS,
            "registro": COL_REGISTRO,
            "tecnologia": COL_TECNOLOGIA,
        }.items()
    }

    for field, idx in col_idx.items():
        if idx is None:
            col_errors.append(f"column not found: {field} (tried: {', '.join(locals().get('_cands', []))})")

    records = []
    for rownum, row in enumerate(rows[1:], start=2):
        if all(v is None for v in row):
            continue
        rec = {}
        for field, idx in col_idx.items():
            rec[field] = row[idx].strip() if (idx is not None and row[idx] is not None) else None
        rec["_row_num"] = rownum
        records.append(rec)

    return records, col_errors


def _is_inverter(rec: dict) -> bool:
    """Return True when technology field indicates inverter / variable speed."""
    val = rec.get("tecnologia") or ""
    return bool(val) and ("inverter" in val.lower() or "variável" in val.lower() or "variavel" in val.lower())


def _build_output(rec: dict) -> dict:
    return {
        "marca": rec.get("marca"),
        "modelo": rec.get("modelo"),
        "tipo": rec.get("tipo"),
        "capacidade": rec.get("capacidade"),
        "tensao": rec.get("tensao"),
        "gas_refrigerante": rec.get("gas"),
        "numero_registro": rec.get("registro"),
        "tecnologia": rec.get("tecnologia"),
        "source": "INMETRO_PBE",
        "market": "BR",
        "synced_at": datetime.utcnow().isoformat() + "Z",
    }


def _parse_xlsx(path: Path) -> tuple[list[dict], list[str]]:
    """Parse cached XLSX, return (records, column_errors)."""
    if openpyxl is None:
        print("ERROR: openpyxl not installed — run: pip install openpyxl", file=sys.stderr)
        sys.exit(1)
    wb = openpyxl.load_workbook(path, data_only=True, read_only=True)
    return _sheet_to_records(wb)


def _download_xlsx(override_url: str | None = None) -> Path:
    if requests is None:
        print("ERROR: requests not installed — run: pip install requests", file=sys.stderr)
        sys.exit(1)

    urls_to_try = [override_url] if override_url else INMETRO_URLS
    last_err = None
    today = date.today().isoformat()
    dest = XLSX_CACHE_DIR / f"inmetro_ac_{today}.xlsx"

    for url in urls_to_try:
        print(f"Trying {url}", file=sys.stderr)
        try:
            resp = requests.get(url, headers=UA_HEADER, timeout=TIMEOUT, stream=True)
            resp.raise_for_status()
            with dest.open("wb") as fh:
                for chunk in resp.iter_content(chunk_size=8192):
                    fh.write(chunk)
            print(f"Saved to {dest}", file=sys.stderr)
            return dest
        except Exception as exc:
            last_err = exc
            print(f"  ✗ {exc}", file=sys.stderr)
            continue

    print(
        f"ERROR: All Inmetro URLs failed. Last error: {last_err}\n"
        "  → Visit https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/condicionadores-de-ar\n"
        "  → Or access PBE directly: https://pbe.inmetro.gov.br/\n"
        "  → Then use: --url YOUR_DISCOVERED_URL",
        file=sys.stderr,
    )
    sys.exit(1)


def _find_cached_xlsx() -> Path | None:
    """Return most recent /tmp/inmetro_ac_*.xlsx or None."""
    cached = sorted(XLSX_CACHE_DIR.glob("inmetro_ac_*.xlsx"))
    return cached[-1] if cached else None


def main() -> None:
    parser = argparse.ArgumentParser(description="Sync Inmetro/PBE AC catalog")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--offline", action="store_true")
    parser.add_argument("--force-refresh", action="store_true")
    parser.add_argument("--url", dest="url", metavar="URL", help="Override Inmetro XLSX URL")
    args = parser.parse_args()

    # Validate dependencies
    for lib, name in [(requests, "requests"), (openpyxl, "openpyxl")]:
        if lib is None:
            print(f"ERROR: {name} not installed — pip install {name}", file=sys.stderr)
            sys.exit(1)

    # Determine source file
    if args.dry_run:
        if args.offline:
            cached = _find_cached_xlsx()
            if cached:
                print(f"[dry-run] Would read cached: {cached}", file=sys.stderr)
                path = cached
            else:
                print("ERROR: --dry-run --offline: no cached XLSX found", file=sys.stderr)
                sys.exit(1)
        else:
            print(f"[dry-run] Would download from first accessible URL in INMETRO_URLS list", file=sys.stderr)
            if args.url:
                print(f"[dry-run] Override URL: {args.url}", file=sys.stderr)
            print(f"[dry-run] Would save to: {XLSX_CACHE_DIR}/inmetro_ac_<today>.xlsx", file=sys.stderr)
            # Try to parse from cache if available
            cached = _find_cached_xlsx()
            if cached:
                print(f"[dry-run] Cache available at: {cached}", file=sys.stderr)
                path = cached
            else:
                print("[dry-run] No cache found — cannot count rows without file", file=sys.stderr)
                sys.exit(0)
    elif args.offline:
        cached = _find_cached_xlsx()
        if not cached:
            print("ERROR: --offline: no cached XLSX found in /tmp/", file=sys.stderr)
            sys.exit(1)
        path = cached
        print(f"Using cached: {path}", file=sys.stderr)
    elif args.force_refresh:
        path = _download_xlsx(args.url)
    else:
        cached = _find_cached_xlsx()
        if cached:
            print(f"Using cache: {cached}  (use --force-refresh to re-download)", file=sys.stderr)
            path = cached
        else:
            path = _download_xlsx(args.url)

    records, col_errors = _parse_xlsx(path)
    if col_errors:
        for e in col_errors:
            print(f"WARNING: {e}", file=sys.stderr)

    inverter = []
    conventional = []
    for rec in records:
        if _is_inverter(rec):
            inverter.append(rec)
        else:
            conventional.append(rec)

    print(
        f"Total rows: {len(records)}  |  Inverter/Variável: {len(inverter)}  |  Convencional: {len(conventional)}",
        file=sys.stderr,
    )

    if args.dry_run:
        print("[dry-run] No files written.", file=sys.stderr)
        sys.exit(0)

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    today_str = date.today().isoformat()

    # Write raw inverter records
    out_inverter = [(_build_output(r), r) for r in inverter]
    if out_inverter:
        out_path = OUT_DIR / f"inmetro_raw_{today_str}.json"
        with out_path.open("w", encoding="utf-8") as fh:
            json.dump([o for o, _ in out_inverter], fh, ensure_ascii=False, indent=2)
        print(f"Written: {out_path}  ({len(out_inverter)} inverter records)", file=sys.stderr)

    # Write / append conventional rejections
    rej_path = OUT_DIR / "rejected_non_inverter.json"
    existing = []
    if rej_path.exists():
        try:
            existing = json.loads(rej_path.read_text(encoding="utf-8"))
        except Exception:
            existing = []
    rejected = existing + [
        {**_build_output(r), "rejection_reason": "convencional/fixo"} for r in conventional
    ]
    with rej_path.open("w", encoding="utf-8") as fh:
        json.dump(rejected, fh, ensure_ascii=False, indent=2)
    print(f"Written: {rej_path}  ({len(rejected)} rejected conventional records)", file=sys.stderr)


if __name__ == "__main__":
    main()
