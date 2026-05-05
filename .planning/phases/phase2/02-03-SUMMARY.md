---
plan: 02-03
status: complete
completed: 2026-05-05
---

# Plan 02-03 Summary — hvac_add_manual.py PT-BR Gate + pending_review.jsonl

## Changes Made

**File:** `scripts/hvac-rag/hvac_add_manual.py`
- Before: 502 lines
- After: 587 lines (+85 lines)

### Additions

1. **Signal constants** (PT_SIGNALS, ES_SIGNALS, EN_SIGNALS) — verbatim from `/srv/hvac-pipeline/hvac_normalize.py`
2. **`detect_ptbr(md_text)`** — returns `(language, confidence)` using signal-count method; no external libs
3. **`check_ptbr(md_text, policy)`** — returns `(allowed, reason)`; anti-pattern guard prevents rejecting bilingual PT+EN manuals
4. **Step 4b.2 in main()** — PT-BR check inserted after inverter hard-lock, before policy score check
5. **pending_review.jsonl append** — in rejection block, using `HVAC_REPORTS_DIR` env var (anti-hardcoded)

**File:** `tests/hvac-rag/conftest.py`
- Added `/srv/hvac-pipeline` to `sys.path` so `hvac_normalize` dependency resolves in tests

## Test Results

```
7 passed in 0.02s (test_intake_ptbr.py)
```

All 7 INTAKE-01 tests pass:
- `test_detect_ptbr_returns_ptbr_for_portuguese` ✅
- `test_detect_ptbr_returns_en_for_english` ✅
- `test_check_ptbr_allows_ptbr_document` ✅
- `test_check_ptbr_rejects_confirmed_english` ✅
- `test_check_ptbr_allows_bilingual_document` ✅
- `test_check_ptbr_skips_when_policy_disabled` ✅
- `test_check_ptbr_accepts_unknown_language` ✅

## Threshold Notes

- Bilingual guard threshold: `pt_share >= 0.15` (default used, no adjustment needed)
- Rejection threshold: non-PT confidence `>= 0.40` AND pt_share `< 0.15`

## Anti-hardcoded Compliance

- `HVAC_REPORTS_DIR` env var used for pending_review.jsonl path ✅
- Hardcoded path `/srv/data/hvac-rag/reports/pending_review.jsonl` absent from code ✅
