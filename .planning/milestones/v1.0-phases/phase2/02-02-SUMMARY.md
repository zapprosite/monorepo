---
phase: 02-expansao-massiva
plan: 02
subsystem: normalize-document
tags: [normalization, pipeline, hvac-rag]
key-files:
  created:
    - scripts/hvac-rag/hvac_normalize_document.py
metrics:
  lines: 274
  commit: ce954c4f
---

## Summary

Created hvac_normalize_document.py — bridge between documents.jsonl and normalized-documents.jsonl. Copies score_language, extract_model_candidates, extract_brand_candidates, extract_equipment_type, extract_error_codes, detect_doc_type verbatim from /srv/hvac-pipeline/hvac_normalize.py. Supports --dry-run, --doc-id, --manifest, --output flags. Idempotent via existing_norm set.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | ce954c4f | feat(02-02): hvac_normalize_document.py |

## Self-Check: PASSED

- syntax OK (py_compile)
- --dry-run exits 0 with no manifest
- score_language count ≥2, normalize_document ≥2, append_normalized ≥2, existing_norm ≥2
