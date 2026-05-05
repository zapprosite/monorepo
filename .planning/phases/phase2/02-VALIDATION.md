---
phase: 2
slug: expansao-massiva-base-inverter-br
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-05
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (venv: `/srv/data/hvac-rag/.venv/bin/pytest`) |
| **Config file** | None — Wave 0 (Plan 02-01) installs test stubs |
| **Quick run command** | `pytest tests/hvac-rag/ -x -q` |
| **Full suite command** | `pytest tests/hvac-rag/ -v` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pytest tests/hvac-rag/ -x -q`
- **After every plan wave:** Run `pytest tests/hvac-rag/ -v`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 1 | CATALOG-01 | — | N/A | unit | `pytest tests/hvac-rag/test_catalog.py -x -q` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 1 | SCRAPER-01 | — | N/A | unit | `pytest tests/hvac-rag/test_scraper.py -x -q` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | INTAKE-01 | — | N/A | unit | `pytest tests/hvac-rag/test_intake_ptbr.py -x -q` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | PIPELINE-01 | — | N/A | unit | `pytest tests/hvac-rag/test_pipeline_checkpoint.py -x -q` | ❌ W0 | ⬜ pending |
| 02-01-05 | 01 | 1 | COVERAGE-01 | — | N/A | unit | `pytest tests/hvac-rag/test_coverage_report.py -x -q` | ❌ W0 | ⬜ pending |
| 02-01-06 | 01 | 1 | PENDING-01 | — | N/A | unit | `pytest tests/hvac-rag/test_pending_review.py -x -q` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 1 | CATALOG-01 | — | N/A | unit | `pytest tests/hvac-rag/test_catalog.py -x -q` | ❌ W0 | ⬜ pending |
| 02-03-01 | 03 | 2 | INTAKE-01 | T-02-01 | PT-BR check rejects non-PT PDFs; path from env var | unit | `pytest tests/hvac-rag/test_intake_ptbr.py -x -q` | ❌ W0 | ⬜ pending |
| 02-03-02 | 03 | 2 | PENDING-01 | T-02-02 | pending_review.jsonl uses HVAC_REPORTS_DIR env | unit | `pytest tests/hvac-rag/test_pending_review.py -x -q` | ❌ W0 | ⬜ pending |
| 02-04-01 | 04 | 2 | COVERAGE-01 | — | N/A | unit | `pytest tests/hvac-rag/test_coverage_report.py -x -q` | ❌ W0 | ⬜ pending |
| 02-05-01 | 05 | 3 | SCRAPER-01 | T-02-03 | Qdrant API key validated at startup; paths from env | unit | `pytest tests/hvac-rag/test_scraper.py tests/hvac-rag/test_pipeline_checkpoint.py -x -q` | ❌ W0 | ⬜ pending |
| 02-05-02 | 05 | 3 | PIPELINE-01 | — | N/A | unit | `pytest tests/hvac-rag/test_pipeline_checkpoint.py -x -q` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

All test files created in Plan 02-01 (Wave 1):

- [ ] `tests/hvac-rag/conftest.py` — shared fixtures: `mock_catalog_jsonl`, `mock_qdrant_scroll`, `mock_checkpoint`
- [ ] `tests/hvac-rag/test_catalog.py` — covers CATALOG-01 (normalize bridge)
- [ ] `tests/hvac-rag/test_scraper.py` — covers SCRAPER-01 (batch file parsing)
- [ ] `tests/hvac-rag/test_intake_ptbr.py` — covers INTAKE-01 (PT-BR language check)
- [ ] `tests/hvac-rag/test_pipeline_checkpoint.py` — covers PIPELINE-01 (checkpoint resume)
- [ ] `tests/hvac-rag/test_coverage_report.py` — covers COVERAGE-01 (per-brand Markdown table)
- [ ] `tests/hvac-rag/test_pending_review.py` — covers PENDING-01 (pending review logging)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| LG/Samsung/Daikin site scraping yields PDFs | SCRAPER-01 | JavaScript-rendered pages may block BeautifulSoup | Run `python3 scripts/hvac-rag/hvac_manual_scraper.py --brand lg --model ASNC09BVCA --dry-run` and verify output URL |
| INMETRO catalog sync returns >50 inverter models | CATALOG-01 | Requires live internet + INMETRO site availability | Run `python3 scripts/hvac-rag/hvac_sync_inmetro_catalog.py --dry-run` and check row count |
| Pipeline reaches ≥80% tier-1 coverage | PIPELINE-01 | Depends on downloaded PDFs from external sites | After full pipeline run: `python3 scripts/hvac-rag/hvac_expansion_pipeline.py --report-only` |

---

## Security Threats (ASVS Relevant)

| Pattern | STRIDE | Mitigation |
|---------|--------|-----------|
| Malicious PDF path traversal | Tampering | `re.sub(r'[^\w\-_.]', '_', ...)` in hvac_add_manual.py (pre-existing) |
| QDRANT_API_KEY in logs | Info Disclosure | Never log key; use `os.environ.get()` with no default in orchestrator |
| INMETRO URL redirect | Spoofing | Validate `Content-Type: application/vnd.openxmlformats*` in sync script |
| HTML masquerading as PDF | Tampering | Check Content-Type in download_file() — addressed in Plan 02-05 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (all 6 test files in Plan 02-01)
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
