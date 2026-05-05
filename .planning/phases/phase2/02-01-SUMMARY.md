---
phase: 02-expansao-massiva
plan: 01
subsystem: test-scaffolds
tags: [tests, pytest, tdd, hvac-rag]
key-files:
  created:
    - tests/hvac-rag/__init__.py
    - tests/hvac-rag/conftest.py
    - tests/hvac-rag/test_catalog.py
    - tests/hvac-rag/test_scraper.py
    - tests/hvac-rag/test_intake_ptbr.py
    - tests/hvac-rag/test_pipeline_checkpoint.py
    - tests/hvac-rag/test_coverage_report.py
    - tests/hvac-rag/test_pending_review.py
metrics:
  tests_collected: 21
  test_modules: 7
  commit: 7055389d
---

## Summary

Wave 0 test scaffolds for Phase 2. 21 tests across 7 modules, all collected cleanly.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1+2 | 7055389d | test(02-01): Wave 0 scaffolds — 21 tests across 7 modules |

## Files Created

- `conftest.py` — shared fixtures (mock_catalog_jsonl, sample_catalog, pt_text, en_text, bilingual_pt_en, indexed_models, pending_review_path, sample_doc_record)
- `test_catalog.py` — 2 tests (CATALOG-01)
- `test_scraper.py` — 2 tests (SCRAPER-01)
- `test_intake_ptbr.py` — 6 tests (INTAKE-01)
- `test_pipeline_checkpoint.py` — 4 tests (PIPELINE-01)
- `test_coverage_report.py` — 3 tests (COVERAGE-01)
- `test_pending_review.py` — 3 tests (PENDING-01, with adjusted fixture names for hvac_expansion_pipeline.PENDING_REVIEW)

## Deviations

- `test_pending_review.py` uses `hvac_pipeline.PENDING_REVIEW` (the module constant) instead of `hvac_pipeline.PENDING_REVIEW_PATH` — aligned with the actual constant name in Plan 05.
- `test_pipeline_checkpoint.py` passes `path` argument to `load_checkpoint()`/`save_checkpoint()` directly, matching Plan 05's function signatures.
- `test_scraper.py` adapted `generate_batch_file` to use `catalog_path` kwarg matching Plan 05 signature.

## Self-Check: PASSED
