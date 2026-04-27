#!/usr/bin/env python3
"""HVAC document chunking — preserve structure, tables, error codes, metadata."""
import json, re, uuid, os, sys
from pathlib import Path

TARGET_TOKENS = 800
MAX_TOKENS = 1200
MIN_TOKENS = 300   # lowered from 500 — merge chunks up to ~600 tokens toward TARGET
OVERLAP_TOKENS = 120
TOKEN_ESTIMATE_CHARS = 4

COMPONENT_TAGS = [
    'ipm', 'power module', 'module de puissance',
    'bridge rectifier', 'ponte retificadora', 'puente rectificador', 'rectifier bridge',
    'compressor', 'compresseur', 'compresor',
    'pcb', 'placa', 'placa de circuito', 'circuit board',
    'thermistor', 'termistor',
    'fan motor', 'motor ventilador', 'motor del ventilador', 'ventilador',
    'dc bus', 'barramento dc', 'bus dc', 'barramento CC',
    'capacitor', 'condensador',
    'inverter', 'inversor',
    'igbt', 'insulated gate bipolar transistor',
    ' refrigerant', 'refrigerante', 'refrigerant',
    'outdoor unit', 'indoor unit', 'unidade exterior', 'unidad exterior',
    'heat pump', 'bomba de calor', 'bomba de calor',
]
SAFETY_TAGS = [
    'high voltage', 'alta tensão', 'alta tensión', 'voltage peligroso',
    'high voltage possible', 'atenção tensão', 'precaución tensión',
    'shock risk', 'risco choque', 'riesgo choque', 'risk of electric shock',
    'atenção', 'advertencia', 'warning', 'danger', 'perigo', 'peligro',
    'electric shock', 'choque eléctrico', 'shock électrique',
]

def estimate_tokens(text: str) -> int:
    return len(text) // TOKEN_ESTIMATE_CHARS

def split_by_headers(text: str) -> list[dict]:
    lines = text.split('\n')
    sections = []
    current = {'level': 0, 'heading': '', 'content': []}
    for line in lines:
        m = re.match(r'^(#{1,6})\s+(.*)', line)
        if m:
            if current['content']:
                sections.append(current)
            current = {'level': len(m.group(1)), 'heading': m.group(2).strip(), 'content': [line]}
        else:
            current['content'].append(line)
    if current['content']:
        sections.append(current)
    return sections

def extract_error_codes(text: str) -> list[str]:
    codes = set()
    for pat in [r'\bE\d{3,4}\b', r'\bA\d{3,4}\b', r'\bF\d{3,4}\b', r'\bL\d{3,4}\b', r'\bU\d{3,4}\b']:
        for m in re.findall(pat, text, re.IGNORECASE):
            codes.add(m.upper())
    return sorted(codes)

def extract_error_codes_from_heading(heading: str) -> list[str]:
    """Error codes often appear in heading text."""
    return extract_error_codes(heading)

def extract_error_codes_from_section(section_path: list) -> list[str]:
    """Section names may contain error codes."""
    codes = set()
    for s in section_path:
        codes.update(extract_error_codes(s))
    return sorted(codes)

def extract_component_tags(text: str) -> list[str]:
    text_lower = text.lower()
    return sorted(set(tag for tag in COMPONENT_TAGS if tag in text_lower))

def extract_safety_tags(text: str) -> list[str]:
    text_lower = text.lower()
    return sorted(set(tag for tag in SAFETY_TAGS if tag in text_lower))

def merge_small_chunks(chunks: list[dict], min_tok: int = MIN_TOKENS) -> list[dict]:
    """Merge consecutive chunks from same section that are below min_tok."""
    merged = []
    buffer = None
    for chunk in chunks:
        if buffer is None:
            buffer = chunk
        elif (chunk['token_estimate'] < min_tok and
              chunk.get('doc_id') == buffer.get('doc_id')):
            # Merge into buffer
            merged_text = buffer['text'] + '\n' + chunk['text']
            if estimate_tokens(merged_text) <= MAX_TOKENS:
                buffer['text'] = merged_text
                buffer['token_estimate'] = estimate_tokens(merged_text)
                buffer['end_line'] = chunk.get('end_line')
                # Union error codes
                all_codes = extract_error_codes(merged_text)
                buffer['error_code_candidates'] = all_codes
            else:
                merged.append(buffer)
                buffer = chunk
        else:
            if buffer:
                merged.append(buffer)
            buffer = chunk
    if buffer:
        merged.append(buffer)
    return merged

def split_large_chunk(chunk: dict) -> list[dict]:
    """Split a chunk that exceeds MAX_TOKENS into smaller pieces."""
    text = chunk['text']
    tokens = chunk['token_estimate']
    if tokens <= MAX_TOKENS:
        return [chunk]
    # Try splitting by paragraph first
    paragraphs = re.split(r'\n\s*\n', text)
    subchunks = []
    current = []
    current_tokens = 0
    for para in paragraphs:
        para_tok = estimate_tokens(para)
        if current_tokens + para_tok > MAX_TOKENS and current:
            sub_text = '\n\n'.join(current)
            sub_chunks_append(subchunks, sub_text, chunk)
            current = [para]
            current_tokens = para_tok
        else:
            current.append(para)
            current_tokens += para_tok
    if current:
        sub_text = '\n\n'.join(current)
        sub_chunks_append(subchunks, sub_text, chunk)
    # If still single chunk > MAX, split by lines
    if len(subchunks) == 1 and subchunks[0]['token_estimate'] > MAX_TOKENS:
        lines = text.split('\n')
        current_lines = []
        current_tokens = 0
        for line in lines:
            line_tok = estimate_tokens(line)
            if current_tokens + line_tok > MAX_TOKENS and current_lines:
                sub_text = '\n'.join(current_lines)
                sub_chunks_append(subchunks, sub_text, chunk)
                current_lines = []
                current_tokens = 0
            current_lines.append(line)
            current_tokens += line_tok
        if current_lines:
            sub_text = '\n'.join(current_lines)
            sub_chunks_append(subchunks, sub_text, chunk)
    # If still too large, force truncate (should not happen)
    result = []
    for sc in subchunks:
        if sc['token_estimate'] > MAX_TOKENS:
            # Force split at 1100 tokens
            words = sc['text'].split()
            mid = len(words) // 2
            first = ' '.join(words[:mid])
            second = ' '.join(words[mid:])
            sub_chunks_append(result, first, chunk)
            sub_chunks_append(result, second, chunk)
        else:
            result.append(sc)
    return result

def sub_chunks_append(lst: list, text: str, template: dict):
    """Append a sub-chunk with inherited metadata from template."""
    tok = estimate_tokens(text)
    heading = template.get('heading', '')
    section_path = template.get('section_path', [])
    error_codes = extract_error_codes(text)
    if not error_codes:
        error_codes = extract_error_codes_from_heading(heading)
    if not error_codes:
        error_codes = extract_error_codes_from_section(section_path)
    if not error_codes:
        error_codes = template.get('error_code_candidates', [])
    lst.append({
        'chunk_id': str(uuid.uuid4())[:16],
        'doc_id': template['doc_id'],
        'source_pdf': template.get('source_pdf', ''),
        'source_md': template.get('source_md', ''),
        'doc_type': template.get('doc_type', 'unknown'),
        'language': template.get('language', 'unknown'),
        'language_confidence': template.get('language_confidence', 0.0),
        'brand_candidates': template.get('brand_candidates', []),
        'model_candidates': template.get('model_candidates', []),
        'equipment_type_candidates': template.get('equipment_type_candidates', []),
        'section_path': section_path,
        'heading': heading,
        'error_code_candidates': error_codes,
        'component_tags': extract_component_tags(text),
        'safety_tags': extract_safety_tags(text),
        'has_table': any(l.strip().startswith('|') for l in text.split('\n')),
        'token_estimate': tok,
        'text': text.strip(),
        'start_line': template.get('start_line', 0),
        'end_line': template.get('end_line', 0),
    })

def chunk_section(section: dict, doc_meta: dict) -> list[dict]:
    """Chunk a section into pieces within token limits."""
    text = '\n'.join(section['content'])
    tokens = estimate_tokens(text)
    section_path = [s['heading'] for s in section.get('section_path', []) if s.get('heading')]
    section_path.append(section['heading']) if section['heading'] else None
    section_path = [x for x in section_path if x]
    # Extract error codes from heading and section_path upfront
    heading_codes = extract_error_codes_from_heading(section['heading'])
    section_codes = extract_error_codes_from_section(section_path)
    all_initial_codes = list(set(heading_codes + section_codes))
    if tokens <= MAX_TOKENS:
        error_codes = extract_error_codes(text) or all_initial_codes or doc_meta.get('error_code_candidates', [])
        return [{
            'chunk_id': str(uuid.uuid4())[:16],
            'doc_id': doc_meta['doc_id'],
            'source_pdf': doc_meta.get('source_pdf', ''),
            'source_md': doc_meta.get('md_path', ''),
            'doc_type': doc_meta.get('doc_type', 'unknown'),
            'language': doc_meta.get('language', 'unknown'),
            'language_confidence': doc_meta.get('language_confidence', 0.0),
            'brand_candidates': doc_meta.get('brand_candidates', []),
            'model_candidates': doc_meta.get('model_candidates', []),
            'equipment_type_candidates': doc_meta.get('equipment_type_candidates', []),
            'section_path': section_path,
            'heading': section['heading'],
            'error_code_candidates': error_codes,
            'component_tags': extract_component_tags(text),
            'safety_tags': extract_safety_tags(text),
            'has_table': any(l.strip().startswith('|') for l in text.split('\n')),
            'token_estimate': tokens,
            'text': text.strip(),
            'start_line': 0,
            'end_line': len(text.split('\n')),
        }]
    # Split long section
    lines = text.split('\n')
    chunks = []
    current = []
    current_tokens = 0
    def flush():
        nonlocal current, current_tokens
        if not current:
            return
        chunk_text = '\n'.join(current)
        ec = extract_error_codes(chunk_text) or all_initial_codes or doc_meta.get('error_code_candidates', [])
        has_table = any(l.strip().startswith('|') for l in current)
        chunks.append({
            'chunk_id': str(uuid.uuid4())[:16],
            'doc_id': doc_meta['doc_id'],
            'source_pdf': doc_meta.get('source_pdf', ''),
            'source_md': doc_meta.get('md_path', ''),
            'doc_type': doc_meta.get('doc_type', 'unknown'),
            'language': doc_meta.get('language', 'unknown'),
            'language_confidence': doc_meta.get('language_confidence', 0.0),
            'brand_candidates': doc_meta.get('brand_candidates', []),
            'model_candidates': doc_meta.get('model_candidates', []),
            'equipment_type_candidates': doc_meta.get('equipment_type_candidates', []),
            'section_path': section_path,
            'heading': section['heading'],
            'error_code_candidates': ec,
            'component_tags': extract_component_tags(chunk_text),
            'safety_tags': extract_safety_tags(chunk_text),
            'has_table': has_table,
            'token_estimate': current_tokens,
            'text': chunk_text.strip(),
            'start_line': 0,
            'end_line': len(current),
        })
        current = []
        current_tokens = 0
    for line in lines:
        lt = estimate_tokens(line)
        if current_tokens + lt > MAX_TOKENS and current:
            flush()
        current.append(line)
        current_tokens += lt
    flush()
    return chunks

def process_document(doc_meta: dict) -> list[dict]:
    """Process a single document into chunks."""
    if not doc_meta.get('approved_for_chunking', False):
        return []
    md_dir = Path("/srv/data/hvac-rag/processed/markdown")
    md_path = None
    doc_id = doc_meta['doc_id']
    for f in os.listdir(md_dir):
        if doc_id in f or f.replace(' ', '-') in doc_id.replace(' ', '-'):
            md_path = md_dir / f
            break
    if md_path is None or not md_path.exists():
        return []
    text = open(md_path, encoding='utf-8', errors='ignore').read()
    text_no_img = '\n'.join(l for l in text.split('\n') if not l.startswith('![Image](data:image'))
    sections = split_by_headers(text_no_img)
    all_chunks = []
    for i, section in enumerate(sections):
        if not section['content']:
            continue
        section['section_path'] = sections[:i]
        cs = chunk_section(section, doc_meta)
        all_chunks.extend(cs)
    # Merge small chunks
    all_chunks = merge_small_chunks(all_chunks)
    # Split oversized chunks
    final_chunks = []
    for chunk in all_chunks:
        if chunk['token_estimate'] > MAX_TOKENS:
            final_chunks.extend(split_large_chunk(chunk))
        else:
            final_chunks.append(chunk)
    # Filter empty / zero-token chunks
    final_chunks = [c for c in final_chunks if c.get('text', '').strip() and c.get('token_estimate', 0) > 0]
    return final_chunks

def main():
    norm_path = Path("/srv/data/hvac-rag/manifests/normalized-documents.jsonl")
    docs = [json.loads(l) for l in open(norm_path)]
    all_chunks = []
    for doc in docs:
        if doc.get('approved_for_chunking'):
            all_chunks.extend(process_document(doc))
    chunks_dir = Path("/srv/data/hvac-rag/chunks/jsonl")
    chunks_dir.mkdir(parents=True, exist_ok=True)
    out_path = chunks_dir / "chunks.jsonl"
    with open(out_path, 'w') as f:
        for chunk in all_chunks:
            f.write(json.dumps(chunk, ensure_ascii=False) + '\n')
    # Report
    by_doc = {}
    for c in all_chunks:
        did = c['doc_id']
        if did not in by_doc:
            by_doc[did] = {'chunks': 0, 'tokens': [], 'error_codes': 0, 'tables': 0, 'safety': 0}
        by_doc[did]['chunks'] += 1
        by_doc[did]['tokens'].append(c['token_estimate'])
        if c.get('error_code_candidates'):
            by_doc[did]['error_codes'] += 1
        if c.get('has_table'):
            by_doc[did]['tables'] += 1
        if c.get('safety_tags'):
            if 'safety' not in by_doc[did]:
                by_doc[did]['safety'] = 0
            by_doc[did]['safety'] += 1
    all_tokens = [c['token_estimate'] for c in all_chunks]
    chunks_over_max = sum(1 for t in all_tokens if t > MAX_TOKENS)
    chunks_under_min = sum(1 for t in all_tokens if t < MIN_TOKENS)
    issues = []
    if chunks_over_max > 0:
        issues.append(f"{chunks_over_max} chunks exceed {MAX_TOKENS} tokens")
    if chunks_under_min > len(all_tokens) * 0.3:
        issues.append(f"{chunks_under_min} chunks under {MIN_TOKENS} tokens (>30%)")
    ready = chunks_over_max == 0 and sum(1 for c in all_chunks if c.get('error_code_candidates')) > 0
    report = {
        "total_documents": len([d for d in docs if d.get('approved_for_chunking')]),
        "documents_chunked": len(by_doc),
        "total_chunks": len(all_chunks),
        "chunks_by_doc": {k: {'chunks': v['chunks'], 'avg_tokens': sum(v['tokens'])//max(1,len(v['tokens'])), 'error_codes': v['error_codes'], 'tables': v['tables'], 'safety_tags': v['safety']} for k, v in by_doc.items()},
        "avg_tokens": sum(all_tokens)//max(1,len(all_tokens)),
        "min_tokens": min(all_tokens) if all_tokens else 0,
        "max_tokens": max(all_tokens) if all_tokens else 0,
        "chunks_over_max": chunks_over_max,
        "chunks_under_min": chunks_under_min,
        "chunks_with_error_codes": sum(1 for c in all_chunks if c.get('error_code_candidates')),
        "chunks_with_tables": sum(1 for c in all_chunks if c.get('has_table')),
        "chunks_with_safety_tags": sum(1 for c in all_chunks if c.get('safety_tags')),
        "ready_for_indexing": ready,
        "issues": issues
    }
    report_path = Path("/srv/data/hvac-rag/manifests/chunking-report.json")
    report_path.write_text(json.dumps(report, indent=2))
    print(f"=== Chunking Report (T010.1) ===")
    print(f"Total chunks: {len(all_chunks)}")
    print(f"Documents chunked: {len(by_doc)}")
    for did, info in by_doc.items():
        avg = sum(info['tokens']) // max(1, len(info['tokens']))
        print(f"\n  {did[:50]}")
        print(f"    chunks:        {info['chunks']}")
        print(f"    avg_tokens:    {avg}")
        print(f"    error_codes:   {info['error_codes']} chunks")
        print(f"    tables:        {info['tables']} chunks")
        print(f"    safety_tags:   {info['safety']} chunks")
    print(f"\n  Global: min={min(all_tokens) if all_tokens else 0} avg={sum(all_tokens)//max(1,len(all_tokens))} max={max(all_tokens) if all_tokens else 0}")
    print(f"  Over {MAX_TOKENS}: {chunks_over_max} | Under {MIN_TOKENS}: {chunks_under_min}")
    print(f"\n  Ready for indexing: {ready}")
    if issues:
        print(f"  Issues: {issues}")
    print(f"\n✅ chunks: {out_path}")
    print(f"✅ report: {report_path}")
    if not ready:
        print("\n⚠️  NOT READY for indexing — fix issues above")

if __name__ == "__main__":
    main()