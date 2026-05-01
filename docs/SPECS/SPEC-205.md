---
spec: SPEC-205
title: HVAC Universal Resolver — Qdrant Payload Coverage Fix
status: pending
date: 2026-04-29
author: will-zappro
parent: SPEC-204
---

# SPEC-205 — Qdrant Payload-Filtered Coverage for Universal Resolver

## Problem Statement

`hvac_coverage.py` currently infers evidence layers via heuristic analysis of the query text alone — it does NOT query Qdrant payload to determine what is actually indexed. This causes:

1. **Brand underestimation**: Springer has 10 manuals indexed in Qdrant but isn't in `HVAC_BRAND_FAMILIES`, so coverage always returns low confidence
2. **Family grouping broken**: Qdrant stores `brand`, `model_family`, `doc_type`, `error_code_candidates` as payload filters — but `check_coverage` never reads them
3. **False negative on manual_family**: A query for "Springer Sprint L2" returns `evidence_level=insufficient_context` even if we have Springer family manuals

## The Correct Architecture

The coverage check should:

```
1. Parse query via hvac_intake (brand, model, error_code, equipment_type)
2. Query Qdrant with PAYLOAD filters (NOT just vector search):
   - Filter by: brand, model_family, doc_type, error_code_candidates
   - top_k=3 only (fast payload check, not full retrieval)
3. Determine what layers actually exist in the index
4. Fall back to heuristic only if Qdrant is unreachable
```

## Required Changes

### 1. `hvac_coverage.py` — Add Qdrant payload check

New function:
```python
def check_coverage_with_qdrant(intake_result: dict, qdrant_client=None) -> dict:
    """
    Check coverage by querying Qdrant payload directly.
    Falls back to heuristic if Qdrant unavailable.
    """
    # Fast payload-only query (no embedding needed)
    # Filter on: brand, model_family, doc_type, error_code_candidates
    # If hits returned → manual_exact or manual_family
    # If no hits → heuristic fallback
```

### 2. `hvac_rag_pipe.py` — Call check_coverage_with_qdrant before search

Current flow:
```
Query → intake → Qdrant search → coverage (heuristic)
```

Correct flow:
```
Query → intake → check_coverage_with_qdrant → Qdrant search (if needed)
```

### 3. Payload field requirements for Qdrant

When indexing new manuals, ensure these payload fields are set:
```json
{
  "brand": "Springer",
  "model_family": "Sprint",
  "doc_type": "service_manual",
  "error_code_candidates": ["L2", "L3"],
  "equipment_type": "split",
  "safety_tags": ["IPM", "high_voltage"],
  "evidence_level": "manual_exact"
}
```

### 4. Test coverage for payload-filtered queries

Add test cases to `test_hvac_universal_resolver.py`:
```python
def test_springer_payload_coverage():
    """Springer has manuals indexed but not in HVAC_BRAND_FAMILIES."""
    # Verify coverage doesn't undercount just because brand isn't in dict

def test_family_grouping_from_payload():
    """Qdrant payload brand grouping is used, not in-memory dict."""
```

## Acceptance Criteria

| # | Criterion | Validation |
|---|-----------|------------|
| 1 | Springer query returns correct coverage from Qdrant payload | `check_coverage_with_qdrant` returns evidence based on actual index, not dict |
| 2 | `brand` field from Qdrant payload used for grouping | No fallback to heuristic when Qdrant has hits |
| 3 | `error_code_candidates` filter works correctly | "L2" query returns only chunks with L2 in payload |
| 4 | Heuristic fallback still works when Qdrant unavailable | Offline mode still provides triage |
| 5 | 157 existing tests still pass | No regression |

## Web Search Config Fix

Also fix Tavily `search_depth` to `basic` (not `auto`):
```yaml
web_search:
  tavily:
    search_depth: "basic"  # NOT auto (auto uses advanced, burns credits)
    max_results: 5
```

## Priority: P1 (next sprint)

This is NOT a nice-to-have. Without Qdrant payload filtering:
- The universal resolver still has blind spots for non-Daikin brands
- The coverage map doesn't reflect what's actually in the index
- Manual indexing becomes guesswork

---
Parent: SPEC-204 (HVAC Universal Resolver)
Blocked by: merge of feature/turbo-202604291339