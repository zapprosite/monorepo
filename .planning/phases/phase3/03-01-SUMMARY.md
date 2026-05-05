---
plan: 03-01
status: complete
completed: 2026-05-05
---

# Plan 03-01 Summary - hvac_manual_finder.py

## Changes Made

**Files:**
- `scripts/hvac-rag/hvac_manual_finder.py`
- `tests/hvac-rag/test_manual_finder.py`

## Delivered

- Created canonical `hvac_manual_finder.py` CLI entrypoint
- Added `ManualCandidate` data model with the required fields
- Implemented catalog-row JSON parsing from inline payload or file path
- Implemented deterministic query builder from brand/model/catalog row
- Implemented ranking helper favoring official manufacturer domains and PDF URLs
- Added focused unit tests for query building, ranking and JSON parsing

## Test Results

```bash
python3 -m pytest tests/hvac-rag/test_manual_finder.py -q
python3 scripts/hvac-rag/hvac_manual_finder.py --brand lg --model ARNU12GTMC2 --dry-run
```

Result: `3 passed in 0.01s`

## Dry-Run Confirmation

`--dry-run` exits 0 and prints the derived query plus an empty candidate list until web providers are wired in later plans.

## Deviations from Plan

- No web search provider was called in this plan. The CLI and ranking core were delivered first, matching the phase boundary for 03-01.

**Total deviations:** 1 planned boundary. **Impact:** none on the deliverable for this plan.

## Self-Check: PASSED
