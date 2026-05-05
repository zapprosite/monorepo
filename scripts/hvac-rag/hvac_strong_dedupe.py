#!/usr/bin/env python3
"""
HVAC strong deduplication — SHA256, shingles Jaccard, title collision.

Input:  manifests/documents.jsonl  (doc_id, pdf_path, md_path, raw_sha256)
Output: manifests/documents.jsonl  (same file, enriched with new fields)
        manifests/dedupe-report.json

New fields per record:
  raw_pdf_sha256               — SHA256 of raw binary PDF (recomputed, confirms fingerprint)
  normalized_markdown_sha256   — SHA256 of normalized markdown text
  title_normalized             — title extracted from doc_id, lower, stripped, collapsed
  title_collision_group        — group id if title collision detected, else null
  duplicate_status             — unique | duplicate_exact | duplicate_content |
                                  title_collision | possible_duplicate_review
  duplicate_of                 — doc_id of canonical, or null
  possible_duplicate_score     — Jaccard score if possible_duplicate_review, else null
"""

import hashlib
import json
import os
import re
import sys
import itertools
from collections import defaultdict
from pathlib import Path

# ── helpers ──────────────────────────────────────────────────────────────────

def normalize_text(text: str) -> str:
    """Lower, strip, collapse internal whitespace."""
    text = text.lower()
    text = re.sub(r'\bpage \d+\b', '', text)
    text = re.sub(r'\b\d+\s*de\s*\d+\b', '', text)
    text = re.sub(r'--+', '', text)
    text = re.sub(r'\s+', ' ', text).strip()
    return text


def normalize_title(doc_id: str) -> str:
    """Extract title from doc_id (filename stem), lower, strip, collapse spaces."""
    # doc_id is typically the PDF stem; strip known suffixes
    title = doc_id
    # remove common extension-like suffixes
    for suffix in ('.pdf', '.PDF'):
        if title.endswith(suffix):
            title = title[:-len(suffix)]
    # remove trailing segments that look like date / version codes
    title = re.sub(r'[_\-]?\d{4}[_\-]\d{2}([_\-]\d{2})?', ' ', title)
    title = re.sub(r'[_\-]v\d+', ' ', title)
    title = title.lower().strip()
    title = re.sub(r'\s+', ' ', title)
    return title


def shingles(text: str, k: int = 5) -> set:
    """Return set of k-word shingles (k-grams) from text."""
    words = text.split()
    if len(words) < k:
        return {text}
    return set(' '.join(words[i:i + k]) for i in range(len(words) - k + 1))


def jaccard(a: set, b: set) -> float:
    """Jaccard similarity: |a∩b| / |a∪b|."""
    if not a or not b:
        return 0.0
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


# ── core dedupe ───────────────────────────────────────────────────────────────

def dedupe_manifest(records: list[dict]) -> list[dict]:
    """
    Strong-deduplication pipeline.

    1. Compute per-record fingerprints (raw_pdf_sha256, normalized_markdown_sha256,
       title_normalized, shingle_set).
    2. AG (exact binary): group by raw_pdf_sha256.
       - len > 1  →  first = canonical, rest = duplicate_exact
    3. AG_norm (same content, different encoding): group by normalized_markdown_sha256
       among non-canonical records.
       - len > 1  →  first = canonical, rest = duplicate_content
    4. AG_title (title collision): group by title_normalized among remaining records.
       - len > 1  AND  raw_pdf_sha256 values differ across group
         →  all get title_collision=true + same title_collision_group
         →  duplicate_status = "title_collision"
    5. Jaccard shingles: for every pair of still-remaining records compute
       Jaccard(norm_text).  If score > 0.85 → "possible_duplicate_review".
    """
    # ── step 0: compute fingerprints ─────────────────────────────────────────
    for rec in records:
        pdf_bytes = Path(rec['pdf_path']).read_bytes()
        raw_fresh = hashlib.sha256(pdf_bytes).hexdigest()
        rec['raw_pdf_sha256'] = raw_fresh

        md_text = normalize_text(Path(rec['md_path']).read_text(errors='ignore'))
        rec['normalized_markdown_sha256'] = hashlib.sha256(md_text.encode()).hexdigest()
        rec['title_normalized'] = normalize_title(rec['doc_id'])
        rec['_shingle_set'] = shingles(md_text, k=5)

    # ── step 1: AG exact binary ─────────────────────────────────────────────
    by_raw = defaultdict(list)
    for rec in records:
        by_raw[rec['raw_pdf_sha256']].append(rec)

    canonical_ids = set()          # doc_ids that are canonical (not duplicate_of)
    dup_of = {}                    # doc_id → canonical doc_id

    for group in by_raw.values():
        if len(group) > 1:
            canonical = group[0]
            canonical_ids.add(canonical['doc_id'])
            for dup in group[1:]:
                dup['duplicate_status'] = 'duplicate_exact'
                dup['duplicate_of'] = canonical['doc_id']
                dup_of[dup['doc_id']] = canonical['doc_id']

    non_canonical = {r['doc_id'] for r in records if r['doc_id'] in dup_of}

    # ── step 2: AG_norm (same content, different encoding) ───────────────────
    # only for records not already resolved as exact duplicate
    by_norm = defaultdict(list)
    for rec in records:
        if rec['doc_id'] not in non_canonical:
            by_norm[rec['normalized_markdown_sha256']].append(rec)

    for group in by_norm.values():
        if len(group) > 1:
            canonical = group[0]
            canonical_ids.add(canonical['doc_id'])
            for dup in group[1:]:
                dup['duplicate_status'] = 'duplicate_content'
                dup['duplicate_of'] = canonical['doc_id']
                dup_of[dup['doc_id']] = canonical['doc_id']

    # ── step 3: AG_title (title collision) ──────────────────────────────────
    by_title = defaultdict(list)
    for rec in records:
        if rec['doc_id'] not in dup_of:
            by_title[rec['title_normalized']].append(rec)

    collision_counter = 0
    for group in by_title.values():
        if len(group) > 1:
            raw_shas = {r['raw_pdf_sha256'] for r in group}
            if len(raw_shas) > 1:      # same title, genuinely different content
                collision_counter += 1
                group_id = f"title_collision_{collision_counter:04d}"
                for rec in group:
                    rec['title_collision_group'] = group_id
                    rec['duplicate_status'] = 'title_collision'
                    rec['duplicate_of'] = None

    # ── step 4: Jaccard shingles on remaining ───────────────────────────────
    remaining = [r for r in records if r['doc_id'] not in dup_of
                 and r.get('title_collision_group') is None
                 and r.get('duplicate_status') in ('unique', None)]

    possible_dup_pairs = []
    for a, b in itertools.combinations(remaining, 2):
        score = jaccard(a['_shingle_set'], b['_shingle_set'])
        if score > 0.85:
            possible_dup_pairs.append((a, b, score))

    for a, b, score in possible_dup_pairs:
        # pick canonical alphabetically
        canonical = min(a['doc_id'], b['doc_id'])
        canonical_ids.add(canonical)
        for rec in (a, b):
            rec['duplicate_status'] = 'possible_duplicate_review'
            rec['possible_duplicate_score'] = round(score, 4)
            if rec['doc_id'] != canonical:
                rec['duplicate_of'] = canonical

    # ── step 5: mark all-unique records ─────────────────────────────────────
    for rec in records:
        if rec.get('duplicate_status') is None:
            rec['duplicate_status'] = 'unique'
            rec['duplicate_of'] = None
            rec['possible_duplicate_score'] = None
        # clean internal field
        rec.pop('_shingle_set', None)
        # ensure title_collision_group is null when not set
        rec.setdefault('title_collision_group', None)

    return records


# ── CLI ──────────────────────────────────────────────────────────────────────

def main() -> None:
    dry_run = '--dry-run' in sys.argv

    script_dir  = Path(__file__).parent.resolve()
    # canonical data root for HVAC RAG
    base_dir    = Path('/srv/data/hvac-rag')
    manifest_in = base_dir / 'manifests' / 'documents.jsonl'
    report_out  = base_dir / 'manifests' / 'dedupe-report.json'

    # fall back to script-relative path if canonical root not present
    if not manifest_in.exists():
        manifest_in = script_dir.parent / 'manifests' / 'documents.jsonl'

    manifest_in  = Path(os.environ.get(
        'HVAC_MANIFEST_IN',
        str(manifest_in)))
    report_out   = Path(os.environ.get(
        'HVAC_DEDUPE_REPORT',
        str(report_out)))

    print(f"[strong-dedupe] Input : {manifest_in}", file=sys.stderr)
    if dry_run:
        print("[strong-dedupe] DRY RUN — no files written", file=sys.stderr)

    records = []
    if manifest_in.exists():
        records = [json.loads(l) for l in manifest_in.read_text(encoding='utf-8').splitlines() if l.strip()]
    else:
        print(f"[strong-dedupe] WARNING: {manifest_in} not found — empty output", file=sys.stderr)

    enriched = dedupe_manifest(records)

    # ── build report ────────────────────────────────────────────────────────
    status_counts: dict[str, int] = defaultdict(int)
    for r in enriched:
        status_counts[r.get('duplicate_status', 'unknown')] += 1

    title_collisions = [
        {'group': r.get('title_collision_group'), 'doc_id': r['doc_id']}
        for r in enriched if r.get('title_collision_group')
    ]
    possible_dup = [
        {'doc_id': r['doc_id'], 'duplicate_of': r.get('duplicate_of'),
         'score': r.get('possible_duplicate_score')}
        for r in enriched if r.get('duplicate_status') == 'possible_duplicate_review'
    ]

    report = {
        'total_documents': len(enriched),
        'status_counts': dict(status_counts),
        'title_collisions': title_collisions,
        'possible_duplicates': possible_dup,
    }

    if not dry_run:
        # write enriched manifest (overwrite)
        manifest_in.parent.mkdir(parents=True, exist_ok=True)
        with manifest_in.open('w', encoding='utf-8') as fh:
            for rec in enriched:
                fh.write(json.dumps(rec, ensure_ascii=False) + '\n')
        print(f"[strong-dedupe] Written: {manifest_in}", file=sys.stderr)

        # write report
        report_out.parent.mkdir(parents=True, exist_ok=True)
        with report_out.open('w', encoding='utf-8') as fh:
            json.dump(report, fh, ensure_ascii=False, indent=2)
        print(f"[strong-dedupe] Report : {report_out}", file=sys.stderr)
    else:
        print(f"[strong-dedupe] Would write {len(enriched)} records to {manifest_in}", file=sys.stderr)
        print("[strong-dedupe] Report preview:", json.dumps(report, indent=2), file=sys.stderr)


if __name__ == '__main__':
    main()
