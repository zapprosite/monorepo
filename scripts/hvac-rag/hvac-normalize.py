#!/usr/bin/env python3
"""HVAC document normalization — extract brand, model, equipment_type, error_codes, language, doc_type."""
import os, sys, json, re
from pathlib import Path

PT_SIGNALS = ['instalação', 'unidade', 'segurança', 'alimentação', 'refrigeração', 'advertência', 'figura', 'tabela', 'cuidado', 'precauções', 'aviso', 'especificação', 'manual de', 'serviço']
ES_SIGNALS = ['instalación', 'unidad', 'seguridad', 'alimentación', 'refrigeración', 'advertencia', 'figura', 'tabla', 'cuidado', 'precaución', 'aviso', 'especificación', 'manual de', 'servicio']
EN_SIGNALS = ['installation', 'unit', 'safety', 'power supply', 'refrigerant', 'warning', 'figure', 'table', 'caution', 'specification', 'service manual', 'operation', 'usage']

SIGNAL_WEIGHTS = {
    'pt': {s: 1.0 for s in PT_SIGNALS},
    'es': {s: 1.0 for s in ES_SIGNALS},
    'en': {s: 1.0 for s in EN_SIGNALS},
}

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
        return {'language': 'unknown', 'confidence': 0.0, 'method': 'signal_count', 'signals': {}, 'review_required': True}
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
        'review_required': review_required
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
        'HITACHI': 0, 'FUJITSU': 0, 'OLMO': 0, 'ELGIN': 0, 'CONSUL': 0
    }
    for b in brands:
        brands[b] = text_upper.count(b)
    return sorted([(b, c) for b, c in brands.items() if c > 0], key=lambda x: -x[1])

def extract_equipment_type(text: str) -> list[tuple[str, int]]:
    text_lower = text.lower()
    found = {}
    # Direct keyword scan first (fast path for VRV)
    for kw in ['vrv iv', 'vrv iii', 'vrv ii', 'vrv', 'heat pump', 'air conditioner', 'inverter split', 'inverter', 'split system', 'multi split', 'compact', 'chiller', 'boiler', 'furnace', 'refrigerant system', 'outdoor unit', 'indoor unit', 'unidad exterior', 'unidad interior', 'unidade exterior', 'unidade interior']:
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
            elif 'split' in kw:
                found['Inverter Split'] = found.get('Inverter Split', 0) + count
            elif 'multi' in kw or 'compact' in kw:
                found['Compact/Multi-split'] = found.get('Compact/Multi-split', 0) + count
            elif 'outdoor' in kw or 'indoor' in kw or 'unidad' in kw or 'unidade' in kw:
                found['Indoor/Outdoor Unit'] = found.get('Indoor/Outdoor Unit', 0) + count
    # Regex patterns for additional detection
    regex_patterns = [
        (r'\b(vrv|vr[fv])[\s_-]*(iv|iii|ii|i|system|unit|inverter|heat\s*pump)?\b', 'VRV/VRF System'),
        (r'\bheat\s*pump\b', 'Heat Pump'),
        (r'\bair\s*conditioner\b', 'Air Conditioner'),
        (r'\b(inverter|split)\s*(air\s*conditioner|ac|unit|system)\b', 'Inverter Split'),
        (r'\b(chiller|boiler|furnace)\b', 'Chiller/Boiler/Furnace'),
        (r'\b(multi[- ]?split|compact)\b', 'Compact/Multi-split'),
        (r'\b(outdoor|indoor)\s*(unit|unidade|unidad)\b', 'Indoor/Outdoor Unit'),
    ]
    for pat, label in regex_patterns:
        import re
        matches = re.findall(pat, text_lower)
        if matches:
            found[label] = found.get(label, 0) + len(matches)
    return sorted(found.items(), key=lambda x: -x[1])

def extract_error_codes(text: str) -> list[str]:
    patterns = [
        r'\bE\d{3,4}\b',
        r'\bA\d{3,4}\b',
        r'\bF\d{3,4}\b',
        r'\bL\d{3,4}\b',
        r'\bR-\d{2,3}\b',
    ]
    codes = set()
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
    if re.search(r'troubleshooting|diagnostic| dépannage|diagnóstico', text_lower):
        return "troubleshooting_guide"
    if re.search(r'specification|specs|datasheet|folha\s*de\s*datos', text_lower):
        return "specification_sheet"
    if re.search(r'user\s*manual|manual\s*do\s*usuário|manual\s*del\s*usuario', text_lower):
        return "user_manual"
    return "unknown"

def normalize(doc: dict) -> dict:
    md_path_str = doc['md_path']
    # Try Path() first, fallback to os.listdir
    md_path = None
    md_dir = Path("/srv/data/hvac-rag/processed/markdown")
    if Path(md_path_str).exists():
        md_path = Path(md_path_str)
    else:
        for f in os.listdir(md_dir):
            if doc['doc_id'] in f or f.replace(' ', '-') in doc['doc_id'].replace(' ', '-'):
                md_path = md_dir / f
                break
    if md_path is None or not md_path.exists():
        return {**doc, "normalization_status": "failed", "review_reasons": ["md_path not found"]}

    text = md_path.read_text(errors='ignore')
    # Language detection: sample beginning, middle, end
    lines = [l for l in text.splitlines() if l.strip() and not l.startswith('|') and not l.startswith('![')]
    sample = ' '.join([l for l in lines[:50] + lines[len(lines)//2-25:len(lines)//2+25] + lines[-50:] if l])
    lang_info = score_language(sample)
    lang = lang_info['language']
    lang_conf = lang_info['confidence']
    lang_review = lang_info['review_required']

    models = extract_model_candidates(text)
    brands = extract_brand_candidates(text)
    eq_types = extract_equipment_type(text)
    codes = extract_error_codes(text)
    doc_type = detect_doc_type(text)

    reasons = []
    if not models:
        reasons.append("no_model_candidates_found")
    # DAIKIN EUROPE is brand, not model — remove from models
    models = [(m, c) for m, c in models if m not in ['DAIKIN', 'DAIKIN EUROPE', 'CARRIER', 'SIEMENS'] and len(m) >= 4]
    if not brands:
        reasons.append("no_brand_detected")
    if not eq_types:
        reasons.append("equipment_type_unclear")
    if lang_review:
        reasons.append("language_uncertain")
    if eq_types and eq_types[0][0] not in ['VRV/VRF System', 'Inverter Split', 'Heat Pump', 'Air Conditioner']:
        reasons.append("equipment_type_unclear")

    status = "normalized" if len(reasons) == 0 else "needs_review"

    return {
        "doc_id": doc['doc_id'],
        "source_pdf": doc.get('pdf_path', ''),
        "brand_candidates": [{"brand": b, "occurrences": c} for b, c in brands[:5]],
        "model_candidates": [{"model": m, "occurrences": c} for m, c in models[:20]],
        "equipment_type_candidates": [{"type": t, "occurrences": c} for t, c in eq_types[:5]],
        "error_code_candidates": codes[:50],
        "doc_type": doc_type,
        "language": lang,
        "language_confidence": lang_conf,
        "language_method": lang_info['method'],
        "language_signals": lang_info['signals'],
        "language_review_required": lang_review,
        "normalization_status": status,
        "review_reasons": reasons,
        "approved_for_chunking": status == "normalized",
        "md_path": str(md_path)
    }

def main():
    manifest_path = Path("/srv/data/hvac-rag/manifests/documents.jsonl")
    if not manifest_path.exists():
        print("ERROR: documents.jsonl not found", file=sys.stderr)
        sys.exit(1)

    docs = [json.loads(l) for l in open(manifest_path)]
    accepted = [d for d in docs if d.get('duplicate_status') == 'unique']

    results = []
    for doc in accepted:
        norm = normalize(doc)
        results.append(norm)

    out_path = Path("/srv/data/hvac-rag/manifests/normalized-documents.jsonl")
    with open(out_path, 'w') as f:
        for r in results:
            f.write(json.dumps(r) + '\n')

    # Generate report
    report = {
        "total_documents": len(results),
        "normalized": sum(1 for r in results if r['normalization_status'] == 'normalized'),
        "needs_review": sum(1 for r in results if r['normalization_status'] == 'needs_review'),
        "failed": sum(1 for r in results if r['normalization_status'] == 'failed'),
        "approved_for_chunking": sum(1 for r in results if r.get('approved_for_chunking')),
        "blocked_from_chunking": sum(1 for r in results if not r.get('approved_for_chunking')),
        "issues": []
    }
    for r in results:
        if r['review_reasons']:
            report['issues'].append({"doc_id": r['doc_id'], "reasons": r['review_reasons']})

    # Print summary
    print(f"=== Normalization Report ===")
    print(f"Total: {report['total_documents']} | normalized: {report['normalized']} | needs_review: {report['needs_review']} | failed: {report['failed']}")
    print(f"Approved for chunking: {report['approved_for_chunking']} | Blocked: {report['blocked_from_chunking']}")
    print()
    for r in results:
        top_models = [m['model'] for m in r['model_candidates'][:5]]
        print(f"  {r['doc_id'][:50]}")
        print(f"    language:     {r['language']} (conf={r['language_confidence']}, method={r['language_method']})")
        print(f"    doc_type:     {r['doc_type']}")
        print(f"    models:       {top_models}")
        print(f"    eq_types:     {[t['type'] for t in r['equipment_type_candidates'][:3]]}")
        print(f"    error_codes:  {len(r['error_code_candidates'])} found")
        print(f"    status:       {r['normalization_status']} | approved_for_chunking: {r['approved_for_chunking']}")
        if r['review_reasons']:
            print(f"    issues:       {r['review_reasons']}")
        print()

    report_path = Path("/srv/data/hvac-rag/manifests/normalization-report.json")
    report_path.write_text(json.dumps(report, indent=2))
    print(f"✅ report: {report_path}")

if __name__ == "__main__":
    main()