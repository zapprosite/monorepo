# SPEC-HVAC-001 — Task Breakdown

Source: [SPEC-HVAC-001](../../docs/SPECS/products/HVAC/SPEC-HVAC-001-rag-ingestion.md)

## Task Breakdown

### Phase 1 — Setup

- [ ] T01: Create directory structure (`data/hvac/{pdfs,sha256,normalized,chunks,manifests,reports}`)
- [ ] T02: Create `schemas/hvac-schema.json` (JSON Schema for normalized HVAC output)
- [ ] T03: Create `schemas/manifest-schema.json` (JSON Schema for hvac-manifest.json)
- [ ] T04: Install docling (`pip install docling`) and verify
- [ ] T05: Add `data/hvac/` to `.gitignore` (raw PDFs and normalized data)

### Phase 2 — Core Scripts

- [ ] T10: Write `scripts/hvac-normalize.py` — Docling JSON → HVAC normalized JSON
- [ ] T11: Write `scripts/hvac-chunk.py` — normalized JSON → RAG chunks (512 tokens, 50 overlap)
- [ ] T12: Write `scripts/hvac-manifest.py` — chunks → `hvac-manifest.json`
- [ ] T13: Write `scripts/hvac-validate.py` — validate manifest against schema
- [ ] T14: Write `scripts/hvac-index.py` — index chunks to Open WebUI + Qdrant (if enabled)

### Phase 3 — Automation

- [ ] T20: Write `Makefile` with `make hvac-setup`, `make hvac-ingest`, `make hvac-validate`
- [ ] T21: Write `scripts/hvac-pipeline.sh` — end-to-end pipeline runner with logging
- [ ] T22: Add `make hvac-eval` target wired to SPEC-HVAC-003 eval script

### Phase 4 — Documentation

- [ ] T30: Write `docs/RUNBOOKS/hvac-rag-ingestion.md` — runbook for daily ingestion
- [ ] T31: Write `docs/ARCHITECTURE/hvac-rag-architecture.md` — pipeline diagram (Mermaid)
- [ ] T32: Update `docs/SPECS/products/HVAC/SPEC-HVAC-001.md` status → `active`

---

## Agent Assignments

| Phase | Task | Agent |
|-------|------|-------|
| Setup | T01–T05 | `backend/api-developer` |
| Core | T10–T14 | `backend/file-pipeline` |
| Automation | T20–T22 | `backend/service-architect` |
| Docs | T30–T31 | `docs/adr-writer` |
| Final | T32 | `docs/doc-coverage-auditor` |

---

## Dependencies

- Python ≥ 3.11
- `docling` pip package
- `jq` system package
- LiteLLM (for embeddings)
- Qdrant + Open WebUI (running instances)

---

## Notes

- PDF source location is TBD — user to provide path before T01 execution
- Qdrant indexing is optional; Open WebUI Knowledge is required
- Pipeline is idempotent: sha256 dedup ensures re-runs are safe
