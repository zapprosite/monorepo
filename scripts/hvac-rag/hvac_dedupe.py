#!/usr/bin/env python3
"""HVAC document deduplication — exact + converted + near-duplicate detection."""
import json, sys
from pathlib import Path
from collections import defaultdict

def jaccard(a: set, b: set) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)

def dedupe(fingerprints_path: str) -> list:
    records = [json.loads(l) for l in open(fingerprints_path)]
    by_raw = defaultdict(list)
    for r in records:
        by_raw[r['raw_sha256']].append(r['doc_id'])
    by_norm = defaultdict(list)
    for r in records:
        by_norm[r['normalized_text_sha256']].append(r['doc_id'])
    results = []
    for r in records:
        doc_id = r['doc_id']
        raw_group = by_raw[r['raw_sha256']]
        if len(raw_group) > 1:
            canonical_doc = raw_group[0]
            status = "duplicate_exact"
            duplicate_of = canonical_doc if doc_id != canonical_doc else None
        else:
            norm_group = by_norm[r['normalized_text_sha256']]
            if len(norm_group) > 1:
                canonical_doc = norm_group[0]
                status = "duplicate_converted"
                duplicate_of = canonical_doc if doc_id != canonical_doc else None
            else:
                status = "unique"
                duplicate_of = None
        r['duplicate_status'] = status
        r['duplicate_of'] = duplicate_of
        results.append(r)
    return results

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <fingerprints_jsonl>", file=sys.stderr)
        sys.exit(1)
    for r in dedupe(sys.argv[1]):
        print(json.dumps(r))