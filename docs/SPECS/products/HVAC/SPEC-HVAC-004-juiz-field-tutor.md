# SPEC-HVAC-004 — Juiz / Field Tutor / Resposta Imprimível

## Source

T015 completion gate: `manual_strict_ready=true` with caveats (non-deterministic LLM safety output at temperature=0.3).

## Motivation

O modo `manual_strict` está funcional mas ainda não é Suitable for end-customer:
- LLM com temperature>0 produz variação não-determinística nos avisos de segurança
- Necessário: Juiz (verifica se resposta遵守 regras antes de retornar)
- Necessário: Field Tutor (contexto expandido com procedimentos passo-a-passo)
- Necessário: Resposta Imprimível (formato limpio para técnicos de campo)

## Dependencies

- [SPEC-HVAC-001](./SPEC-HVAC-001-rag-ingestion.md) — Qdrant collection `hvac_manuals_v1`, 442 points ✅
- [SPEC-HVAC-002](./SPEC-HVAC-002-openwebui-faq.md) — OpenWebUI pipe ✅
- [SPEC-HVAC-003](./SPEC-HVAC-003-evaluation-suite.md) — Evaluation suite ✅
- T014.1 hardening — OpenAI-compatible pipe em `0.0.0.0:4017` ✅
- T015 evaluation — faithful=1.0, citations=1.0, invented=0, safety=0.83 ⚠️

## T015 Known Issues (Non-Blocking for SPEC-HVAC-004)

- LLM temperature=0.3 produces non-deterministic safety warnings
- 1/6 positive queries occasionally misses "técnico qualificado" phrasing
- 3/4 negative queries blocked correctly; query 10 (HVAC but no model) correctly refuses to invent

## Strategy

```
User Query → Juiz (validate) → Field Tutor (enrich) → LLM → Formatter → Imprimível
                    ↓                  ↓
              Block if out-of-      Expand with
              domain or invented    procedures from
              values detected       manual chunks
```

### Juiz (Judge Agent)

**Purpose:** Pre-flight validation before LLM call.

Rules checked:
1. Domain: HVAC components, error codes, or model patterns
2. No invented values requested
3. Safety keywords trigger mandatory warnings
4. Model identification: incomplete model → ask before proceeding

Output: `APPROVED` | `BLOCKED` | `ASK_CLARIFICATION`

### Field Tutor

**Purpose:** Enhance context with procedural steps from manual chunks.

For queries involving:
- Error codes → include diagnostic flowchart
- IPM/inverter/alta tensão → include safety lockout procedure
- Installation → include pre-install checklist
- Maintenance → include step-by-step procedure

### Resposta Imprimível

**Purpose:** Clean formatted output for field technicians.

Format:
- No markdown (or minimal)
- Clear section headers
- Safety warnings in boxes
- Procedures numbered
- Model/error code highlighted

## Tasks

### Phase 1 — Juiz

- [ ] T01: Write `scripts/hvac-rag/hvac-juiz.py`
  - Domain validation (HVAC_COMPONENTS, HVAC_ERROR_CODES, HVAC_MODEL_PATTERNS)
  - Out-of-domain blocking
  - "Ask clarification" detection (incomplete model)
  - Safety keyword flagging
  - Output: APPROVED | BLOCKED | ASK_CLARIFICATION + reason

### Phase 2 — Field Tutor

- [ ] T02: Write `scripts/hvac-rag/hvac-field-tutor.py`
  - Enhanced context from Qdrant (top_k=10 for field tutor)
  - Procedural expansion for safety topics
  - Safety lockout/tagout steps injection
  - Diagnostic flowcharts from error_code chunks

### Phase 3 — Formatter

- [ ] T03: Write `scripts/hvac-rag/hvac-formatter.py`
  - Strip markdown to plain text
  - Format for thermal printer (58mm width)
  - Include QR code for digital version link
  - Safety boxes with ⚠️ ASCII art

### Phase 4 — Integration

- [ ] T04: Update `hvac-rag-pipe.py` to include Juiz pre-flight
- [ ] T05: Add `/v1/chat/completions/printable` endpoint
- [ ] T06: Add `/v1/chat/completions/field-tutor` endpoint

### Phase 5 — Evaluation

- [ ] T07: Run T015 equivalent with 10 new queries
- [ ] T08: Verify Juiz blocks 100% of out-of-domain
- [ ] T09: Verify no invented values in 10 positive queries
- [ ] T10: Verify printable format output is clean

## Acceptance Criteria

| Criteria | Threshold |
|---|---|
| Juiz blocks out-of-domain | 100% |
| No invented values | 0 detected |
| Safety warnings | 100% when applicable |
| Printable format | Valid plain text, no markdown |
| Field tutor expanded context | top_k >= 8, procedural |
| Juiz latency | < 50ms (local regex) |

## Not in Scope

- Web search integration
- Customer-facing UI
- PDF generation
- Multi-language support
