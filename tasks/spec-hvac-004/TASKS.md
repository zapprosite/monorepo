# SPEC-HVAC-004 — Task Breakdown

Source: [SPEC-HVAC-004](../../docs/SPECS/products/HVAC/SPEC-HVAC-004-juiz-field-tutor.md)

**Status em 2026-04-28:** T01–T06 ✅ IMPLEMENTADO | T07–T10 em progresso

## Phase 1 — Juiz (Judge Agent) ✅

- [x] T01: Write `scripts/hvac-rag/hvac-juiz.py` — pre-flight validation
  - Domain check (HVAC_COMPONENTS set)
  - Error code detection (HVAC_ERROR_CODES regex)
  - Model pattern detection (HVAC_MODEL_PATTERNS regex)
  - Out-of-domain blocking with friendly message
  - ASK_CLARIFICATION for incomplete models
  - Safety keyword flagging
  - Latency: <50ms (pure regex, no LLM)

## Phase 2 — Field Tutor ✅

- [x] T02: Write `scripts/hvac-rag/hvac-field-tutor.py` — enhanced context
  - top_k=10 (vs default 6)
  - Procedural expansion for safety topics
  - Diagnostic flowcharts from error_code chunks
  - Safety lockout/tagout steps injection

## Phase 3 — Formatter ✅

- [x] T03: Write `scripts/hvac-rag/hvac-formatter.py` — printable output
  - Strip all markdown
  - 58mm thermal printer width
  - ASCII safety boxes
  - Numbered procedures
  - QR code for digital link (optional)

## Phase 4 — Integration ✅

- [x] T04: Integrate Juiz into `hvac-rag-pipe.py` (v2.0.0)
- [x] T05: Add `/v1/chat/completions/printable` endpoint
- [x] T06: Add `/v1/chat/completions/field-tutor` endpoint

## Phase 5 — v2.0.0 Simplification ✅

- [x] T11: Router com modo `guided_triage` — MiniMax como primary writing engine
- [x] T12: Retrieval package builder (`build_retrieval_package()`)
- [x] T13: Friendly response rewriter (`hvac-friendly-response.py`, 4/4 PASS)
- [x] T14: `/v1/models` expõe só `zappro-clima-tutor` (internals ocultos)
- [x] T15: OpenWebUI config atualizado (`DEFAULT_MODEL=zappro-clima-tutor`)
- [x] T16: Canonical answer template (`config/hvac-copilot/answer-template-ptbr.md`)
- [x] T17: Profile config (`config/hvac-copilot/zappro-clima-tutor.yaml`)
- [x] T18: Unified status script (`scripts/hvac-rag/hvac-status.py`)
- [x] T19: UX smoke tests (`smoke-tests/smoke_hvac_friendly_tutor_ux.py`)

## Phase 6 — Archive Legado

- [x] T20: `hvac_evaluate_T0152.py` → archive (órfão, sem chamada)
- [x] T21: `hvac_retrieve_dryrun.py` → archive (órfão, sem chamada)

## Phase 7 — Avaliação (pendente)

- [ ] T22: Juiz blocking eval — 10 queries
- [ ] T23: Printable format eval — 3 queries
- [ ] T24: Field tutor expansion eval — 3 queries
- [ ] T25: Update docs and readiness report

---

## Agent Assignments

| Phase | Task | Agent |
|-------|------|-------|
| Juiz | T01 | `backend/api-developer` |
| Field Tutor | T02 | `backend/file-pipeline` |
| Formatter | T03 | `frontend/component-dev` |
| Integration | T04–T06 | `backend/api-developer` |
| Evaluation | T07–T09 | `test/e2e-tester` |
| Docs | T10 | `docs/adc-writer` |

---

## Dependencies

- Python 3.11+
- httpx (async HTTP)
- Qdrant (running at 127.0.0.1:6333)
- Ollama (nomic-embed-text at 127.0.0.1:11434)
- LiteLLM (minimax-m2.7 at 127.0.0.1:4000)

---

## Acceptance Criteria

| Criteria | Threshold |
|---|---|
| Juiz blocks out-of-domain | 100% |
| No invented values | 0 |
| Safety warnings | 100% when applicable |
| Printable format | Valid plain text |
| Field tutor context | top_k >= 8 |
| Juiz latency | <50ms |
