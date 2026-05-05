#!/srv/data/hvac-rag/.venv/bin/python3
"""HVAC Document Normalizer — bridges manifests/documents.jsonl → manifests/normalized-documents.jsonl

Closes pipeline integration gap (RESEARCH.md Gap 1):
  hvac_add_manual.py writes to documents.jsonl (raw intake schema)
  hvac_chunk.py reads from normalized-documents.jsonl (brand/model/language schema)
  This script converts between the two.

Usage:
    python3 hvac_normalize_document.py [--dry-run] [--doc-id DOC_ID]
    python3 hvac_normalize_document.py --manifest /path/to/documents.jsonl
    python3 hvac_normalize_document.py --doc-id doc_abc123 --dry-run
"""
import argparse
import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS_DIR = Path("/srv/monorepo/scripts/hvac-rag")

MANIFEST_PATH = Path(os.environ.get(
    "HVAC_MANIFEST_PATH",
    "/srv/data/hvac-rag/manifests/documents.jsonl"
))
NORM_DOCS_PATH = Path(os.environ.get(
    "HVAC_NORM_DOCS_PATH",
    "/srv/data/hvac-rag/manifests/normalized-documents.jsonl"
))

# Signal constants verbatim from /srv/hvac-pipeline/hvac_normalize.py lines 6-8
PT_SIGNALS = ['instalação', 'unidade', 'segurança', 'alimentação', 'refrigeração',
              'advertência', 'figura', 'tabela', 'cuidado', 'precauções', 'aviso',
              'especificação', 'manual de', 'serviço']
ES_SIGNALS = ['instalación', 'unidad', 'seguridad', 'alimentación', 'refrigeración',
              'advertencia', 'figura', 'tabla', 'cuidado', 'precaución', 'aviso',
              'especificación', 'manual de', 'servicio']
EN_SIGNALS = ['installation', 'unit', 'safety', 'power supply', 'refrigerant',
              'warning', 'figure', 'table', 'caution', 'specification',
              'service manual', 'operation', 'usage']


def score_language(text: str) -> dict:
    text_lower = text.lower()
    scores = {'pt-BR': 0.0, 'es': 0.0, 'en': 0.0}
    signals_found = {'pt-BR': [], 'es': [], 'en': []}
    for lang, signals in [('pt-BR', PT_SIGNALS), ('es', ES_SIGNALS), ('en', EN_SIGNALS)]:
        for sig in signals:
            count = text_lower.count(sig)
            if count > 0:
                scores[lang] += count
                signals_found[lang].append(sig)
    total = sum(scores.values())
    if total == 0:
        return {'language': 'unknown', 'confidence': 0.0, 'method': 'signal_count',
                'signals': {}, 'review_required': True}
    langs_sorted = sorted(scores.items(), key=lambda x: -x[1])
    top_lang, top_score = langs_sorted[0]
    second_score = langs_sorted[1][1] if len(langs_sorted) > 1 else 0
    confidence = top_score / total if total > 0 else 0.0
    review_required = (second_score > 0 and (top_score - second_score) / top_score < 0.3) or top_score < 3
    return {
        'language': top_lang,
        'confidence': round(confidence, 4),
        'method': 'signal_count',
        'signals': {k: v for k, v in signals_found.items() if v},
        'review_required': review_required,
    }


def extract_model_candidates(text: str) -> list[tuple[str, int]]:
    patterns = [
        r'\b(RXYQ\d*[A-Z]?\d*[A-Z]?)\b',
        r'\b(RYYQ\d*[A-Z]?\d*[A-Z]?)\b',
        r'\b(VRV[IV]+)\b',
        r'\b(AR\d{2,4}[A-Z]?)\b',
        r'\b(MSZ-[A-Z]{2}\d{3}[A-Z]?)\b',
        r'\b(AS\d{2}[A-Z]{2}\d{3})\b',
    ]
    candidates = {}
    for pat in patterns:
        for m in re.findall(pat, text, re.IGNORECASE):
            key = m.upper().strip()
            if len(key) >= 4:
                candidates[key] = candidates.get(key, 0) + 1
    return sorted(candidates.items(), key=lambda x: -x[1])


def extract_brand_candidates(text: str) -> list[tuple[str, int]]:
    text_upper = text.upper()
    brands = {
        'DAIKIN': 0, 'CARRIER': 0, 'SIEMENS': 0, 'LG': 0, 'SAMSUNG': 0,
        'MITSUBISHI': 0, 'PANASONIC': 0, 'GREE': 0, 'TRANE': 0, 'YORK': 0,
        'HITACHI': 0, 'FUJITSU': 0, 'OLMO': 0, 'ELGIN': 0, 'CONSUL': 0,
    }
    for b in brands:
        brands[b] = text_upper.count(b)
    return sorted([(b, c) for b, c in brands.items() if c > 0], key=lambda x: -x[1])


def extract_equipment_type(text: str) -> list[tuple[str, int]]:
    text_lower = text.lower()
    found: dict[str, int] = {}
    for kw in ['vrv iv', 'vrv iii', 'vrv ii', 'vrv', 'heat pump', 'air conditioner',
               'inverter split', 'inverter', 'split system', 'multi split', 'compact',
               'chiller', 'boiler', 'furnace', 'refrigerant system',
               'outdoor unit', 'indoor unit', 'unidade exterior', 'unidade interior']:
        count = text_lower.count(kw)
        if count > 0:
            if 'vrv' in kw:
                found['VRV/VRF System'] = found.get('VRV/VRF System', 0) + count
            elif 'heat pump' in kw:
                found['Heat Pump'] = found.get('Heat Pump', 0) + count
            elif 'air conditioner' in kw:
                found['Air Conditioner'] = found.get('Air Conditioner', 0) + count
            elif 'inverter' in kw:
                found['Inverter Split'] = found.get('Inverter Split', 0) + count
            elif 'split' in kw or 'compact' in kw:
                found['Inverter Split'] = found.get('Inverter Split', 0) + count
            else:
                found['Indoor/Outdoor Unit'] = found.get('Indoor/Outdoor Unit', 0) + count
    return sorted(found.items(), key=lambda x: -x[1])


def extract_error_codes(text: str) -> list:
    patterns = [r'\bE\d{3,4}\b', r'\bA\d{3,4}\b', r'\bF\d{3,4}\b',
                r'\bL\d{3,4}\b', r'\bR-\d{2,3}\b']
    codes: set[str] = set()
    for pat in patterns:
        for m in re.findall(pat, text, re.IGNORECASE):
            if 3 <= len(m) <= 10:
                codes.add(m.upper())
    return sorted(codes)


def detect_doc_type(text: str) -> str:
    text_lower = text.lower()
    if re.search(r'service\s*manual|manual\s*de\s*serviço|manual\s*de\s*service', text_lower):
        return "service_manual"
    if re.search(r'installation\s*manual|manual\s*de\s*instalación|manual\s*de\s*instalacion', text_lower):
        return "installation_manual"
    if re.search(r'troubleshooting|diagnostic|diagnóstico', text_lower):
        return "troubleshooting_guide"
    if re.search(r'specification|specs|datasheet', text_lower):
        return "specification_sheet"
    if re.search(r'user\s*manual|manual\s*do\s*usuário|manual\s*del\s*usuario', text_lower):
        return "user_manual"
    return "unknown"


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.open(encoding="utf-8") if line.strip()]


def append_normalized(record: dict) -> None:
    """Append one normalized record to normalized-documents.jsonl (never rewrites)."""
    NORM_DOCS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with NORM_DOCS_PATH.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")


def normalize_document(doc_record: dict, md_text: str) -> dict:
    """Convert documents.jsonl record to normalized-documents.jsonl format."""
    lang_info = score_language(md_text)
    models = extract_model_candidates(md_text)
    brands = extract_brand_candidates(md_text)
    eq_types = extract_equipment_type(md_text)
    codes = extract_error_codes(md_text)
    doc_type = detect_doc_type(md_text) or doc_record.get("doc_type", "unknown")

    GARBAGE_MODELS = {'DAIKIN', 'DAIKIN EUROPE', 'CARRIER', 'SIEMENS', 'LG', 'SAMSUNG'}
    models = [(m, c) for m, c in models if m.upper() not in GARBAGE_MODELS and len(m) >= 4]

    reasons: list[str] = []
    if not models:
        reasons.append("no_model_candidates_found")
    if not brands:
        reasons.append("no_brand_detected")
    if not eq_types:
        reasons.append("equipment_type_unclear")
    if lang_info["review_required"]:
        reasons.append("language_uncertain")

    status = "normalized" if not reasons else "needs_review"

    return {
        "doc_id":                    doc_record["doc_id"],
        "source_pdf":                doc_record.get("source_pdf", doc_record.get("pdf_path", "")),
        "brand_candidates":          [{"brand": b, "occurrences": c} for b, c in brands[:5]],
        "model_candidates":          [{"model": m, "occurrences": c} for m, c in models[:20]],
        "equipment_type_candidates": [{"type": t, "occurrences": c} for t, c in eq_types[:5]],
        "error_code_candidates":     codes[:50],
        "doc_type":                  doc_type,
        "language":                  lang_info["language"],
        "language_confidence":       lang_info["confidence"],
        "language_method":           lang_info["method"],
        "language_signals":          lang_info["signals"],
        "language_review_required":  lang_info["review_required"],
        "normalization_status":      status,
        "review_reasons":            reasons,
        "approved_for_chunking":     status == "normalized",
        "md_path":                   doc_record.get("md_path"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Normalize documents.jsonl → normalized-documents.jsonl"
    )
    parser.add_argument("--dry-run", action="store_true",
                        help="Print what would be written, do not modify files")
    parser.add_argument("--doc-id", type=str, default=None,
                        help="Process only this specific doc_id")
    parser.add_argument("--manifest", type=str, default=None,
                        help="Override documents.jsonl path")
    parser.add_argument("--output", type=str, default=None,
                        help="Override normalized-documents.jsonl path")
    args = parser.parse_args()

    manifest_path = Path(args.manifest) if args.manifest else MANIFEST_PATH
    global NORM_DOCS_PATH
    if args.output:
        NORM_DOCS_PATH = Path(args.output)

    docs = load_jsonl(manifest_path)
    if not docs:
        print(f"[warn] No records in {manifest_path}", file=sys.stderr)
        sys.exit(0)

    existing_norm = {r["doc_id"] for r in load_jsonl(NORM_DOCS_PATH)}

    if args.doc_id:
        docs = [d for d in docs if d["doc_id"] == args.doc_id]
        if not docs:
            print(f"[error] doc_id '{args.doc_id}' not found in {manifest_path}", file=sys.stderr)
            sys.exit(1)

    count = 0
    for doc_rec in docs:
        doc_id = doc_rec.get("doc_id", "")
        if doc_id in existing_norm:
            print(f"  [skip] {doc_id} already normalized")
            continue

        md_path_str = doc_rec.get("md_path")
        if md_path_str and Path(md_path_str).exists():
            md_text = Path(md_path_str).read_text(encoding="utf-8", errors="replace")
        else:
            md_text = ""
            print(f"  [warn] {doc_id}: md_path missing or file not found, normalizing without text")

        norm_rec = normalize_document(doc_rec, md_text)

        if args.dry_run:
            print(f"[dry-run] Would append to {NORM_DOCS_PATH}:")
            print(json.dumps(norm_rec, indent=2, ensure_ascii=False))
        else:
            append_normalized(norm_rec)
            print(f"  ✅ {doc_id} → {norm_rec['normalization_status']}")
        count += 1

    if args.dry_run:
        print(f"[dry-run] Would process {count} records", file=sys.stderr)
        sys.exit(0)

    print(f"Done: {count} records normalized → {NORM_DOCS_PATH}")


if __name__ == "__main__":
    main()
