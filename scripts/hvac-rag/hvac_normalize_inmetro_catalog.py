#!/usr/bin/env python3
"""
Normalize raw Inmetro/PBE JSON catalog into the HVAC-RAG JSONL schema.

Reads:
  /srv/data/hvac-rag/catalog/inmetro_raw_*.json
  (optionally /srv/data/hvac-rag/catalog/rejected_non_inverter.json)

Outputs:
  /srv/data/hvac-rag/catalog/inmetro_ac_br_models.jsonl

Flags:
  --dry-run   validate input and print sample records without writing files
"""

import sys
import json
import hashlib
import argparse
import re
from pathlib import Path
from datetime import datetime

IN_DIR = Path("/srv/data/hvac-rag/catalog")
OUT_FILE = IN_DIR / "inmetro_ac_br_models.jsonl"
REJ_FILE = IN_DIR / "rejected_non_inverter.json"

# Capacity unit patterns
_KBTU_PAT = re.compile(r"^[\d.,]+\s*kbtu/?h?$", re.IGNORECASE)
_BTU_PAT = re.compile(r"^[\d.,]+\s*btu/?h?$", re.IGNORECASE)

# Equipment type mapping (normalized values)
EQUIP_TYPE_MAP = {
    "split": ["split", "split hi-wall", "hi wall", "wall mounted", "janela split"],
    "multi-split": ["multi split", "multi-split", "multisplit", "multi split sistema"],
    "cassette": ["cassete", "cassette", "cassete recessado"],
    "piso-teto": ["piso teto", "piso-teto", "floor ceiling", "floor/ceiling", "console"],
    "central": ["central", "central selbst", "self-contained", "pacote"],
    "vrf": ["vrf", "vrf sistema", "vrf system"],
    "vrv": ["vrv", "vrv sistema", "vrv system", "vrvi"],
    "janela": ["janela", "window"],
    "portatil": ["portátil", "portatil", "portable", "mobil"],
}

VOLTAGE_MAP = {
    "127v": "127V",
    "220v": "220V",
    "bivolt": "bivolt",
    "127/220v": "bivolt",
    "127/220": "bivolt",
    "127-220v": "bivolt",
}

FUNCTION_MAP = {
    "refrigeração": "refrigeration",
    "resfriamento": "refrigeration",
    "aquecimento": "heating",
    "quente": "heating",
    "frio": "refrigeration",
    "reversão": "ambos",
    "reversivel": "ambos",
    "quente/frio": "ambos",
    "frio/quente": "ambos",
}

REFRIGERANT_MAP = {
    "r-32": "R-32",
    "r32": "R-32",
    "r-410a": "R-410A",
    "r410a": "R-410A",
    "r-134a": "R-134a",
    "r134a": "R-134a",
    "r-22": "R-22",
    "r22": "R-22",
    "r-290": "R-290",
    "r290": "R-290",
    "propano": "R-290",
}


def _norm(v: str | None) -> str:
    return v.strip().lower() if v else ""


def _is_inverter_tech(tech: str | None) -> bool:
    v = _norm(tech)
    return "inverter" in v or "variável" in v or "variavel" in v


def _parse_capacity(raw: str | None) -> int | None:
    """Parse capacity string into BTU/h integer. Returns None if unparseable."""
    if not raw:
        return None
    s = _norm(raw).replace(",", ".").replace(" ", "")
    # strip non-numeric except dot and digits
    num_s = re.sub(r"[^\d.]", "", s)
    try:
        val = float(num_s)
    except ValueError:
        return None
    if _KBTU_PAT.match(s) or (val < 1000 and "k" in s):
        return int(val * 1000)
    if _BTU_PAT.match(s) or "btu" in s:
        return int(val)
    # bare number: assume BTU/h if > 1000, else kBTU/h
    if val > 10000:
        return int(val)
    return int(val * 1000)


def _norm_equip_type(raw: str | None) -> str | None:
    if not raw:
        return None
    v = _norm(raw)
    for norm_type, variants in EQUIP_TYPE_MAP.items():
        if any(vp in v for vp in variants):
            return norm_type
    return None


def _norm_voltage(raw: str | None) -> str | None:
    if not raw:
        return None
    v = _norm(raw)
    return VOLTAGE_MAP.get(v, v.upper())


def _norm_refrigerant(raw: str | None) -> str | None:
    if not raw:
        return None
    v = _norm(raw)
    return REFRIGERANT_MAP.get(v, raw.strip())


def _norm_function(raw: str | None) -> str | None:
    if not raw:
        return None
    v = _norm(raw)
    return FUNCTION_MAP.get(v, "refrigeration")


def _model_family(model: str | None) -> str:
    """Extract alphanumeric family group from model string."""
    if not model:
        return ""
    m = re.match(r"^([A-Za-z]{2,}\d{2,}|\d{2,}[A-Za-z]{2,}|[A-Za-z]+\d?)", model.strip())
    return m.group(1) if m else ""


def _catalog_id(reg_raw: str | None, model: str | None) -> str:
    """Build catalog_id: INMETRO-{digits only from reg}-{8-char hash}"""
    digits = re.sub(r"\D", "", reg_raw or "")
    h = hashlib.md5((model or "")[:20].encode()).hexdigest()[:8]
    return f"INMETRO-{digits}-{h}"


def _normalize_record(raw: dict, rejected: bool = False) -> dict | None:
    """
    Map a raw Inmetro record into the catalog JSONL schema.

    Returns None when a required field is missing and rejection is not flagged.
    """
    technology = raw.get("tecnologia")
    if not _is_inverter_tech(technology):
        # Already filtered upstream, but guard anyway
        return None

    capacity_raw = raw.get("capacidade")
    capacity = _parse_capacity(capacity_raw)
    if capacity is None:
        # Try to survive without capacity
        pass

    equip_type_raw = raw.get("tipo")
    equip_type = _norm_equip_type(equip_type_raw)

    return {
        "catalog_id": _catalog_id(raw.get("numero_registro"), raw.get("modelo")),
        "source": "INMETRO_PBE",
        "market": "BR",
        "supplier": raw.get("marca") or raw.get("fabricante") or "",
        "brand": (raw.get("marca") or "").split()[0] if raw.get("marca") else "",
        "equipment_type": equip_type or "split",
        "technology": "inverter",
        "rotation": "velocidade_variavel",
        "indoor_model": raw.get("modelo") or "",
        "outdoor_model": raw.get("modelo") or "",
        "window_model": None,
        "model_family": _model_family(raw.get("modelo")),
        "function": _norm_function(raw.get("funcao")),
        "voltage": _norm_voltage(raw.get("tensao")),
        "refrigerant": _norm_refrigerant(raw.get("gas_refrigerante")),
        "capacity_btu_h": capacity,
        "registration_number": re.sub(r"\D", "", raw.get("numero_registro") or ""),
        "manual_status": "missing",
        "qdrant_doc_ids": [],
        "rejection_reason": "convencional/fixo" if rejected else None,
    }


def _load_raw_json() -> list[dict]:
    """Find and load the most recent inmetro_raw_*.json file."""
    files = sorted(IN_DIR.glob("inmetro_raw_*.json"))
    if not files:
        print(f"ERROR: no inmetro_raw_*.json found in {IN_DIR}", file=sys.stderr)
        sys.exit(1)
    path = files[-1]
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def main() -> None:
    parser = argparse.ArgumentParser(description="Normalize Inmetro catalog to JSONL schema")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    raw_records = _load_raw_json()
    print(f"Loaded {len(raw_records)} raw records from catalog", file=sys.stderr)

    normalized = []
    skipped = []

    for rec in raw_records:
        norm = _normalize_record(rec)
        if norm is None:
            skipped.append(rec)
            continue
        normalized.append(norm)

    print(
        f"Normalized: {len(normalized)}  |  Skipped (non-inverter): {len(skipped)}",
        file=sys.stderr,
    )

    if args.dry_run:
        print("\n[SAMPLE — first 3 normalized records]", file=sys.stderr)
        for r in normalized[:3]:
            print(json.dumps(r, ensure_ascii=False, indent=2), file=sys.stderr)
        if normalized:
            print(f"\n[dry-run] Would write {len(normalized)} records to {OUT_FILE}", file=sys.stderr)
        print("[dry-run] No files written.", file=sys.stderr)
        sys.exit(0)

    OUT_DIR.parent.mkdir(parents=True, exist_ok=True)
    with OUT_FILE.open("w", encoding="utf-8") as fh:
        for rec in normalized:
            fh.write(json.dumps(rec, ensure_ascii=False) + "\n")

    print(f"Written: {OUT_FILE}  ({len(normalized)} JSONL records)", file=sys.stderr)


if __name__ == "__main__":
    main()
