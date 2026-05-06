---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: planned
last_updated: "2026-05-05T22:10:00.000Z"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 15
  completed_plans: 7
---

# Project State

- Status: In Progress
- Active Phase: 4 (Reconhecimento de Placas e Componentes via Foto)
- Last Updated: 2026-05-05

## Phase 1 — Implemented

- Lock Inverter: hard-lock em hvac_add_manual.py usando is_inverter_technology + is_blacklisted
- Docling Precision: extract_table_header + preservação de cabeçalho em chunks de tabela
- Source Enforcement: sistema prompt atualizado com regra de resposta sem evidência
- Cross-Check Agent: hvac_crosscheck.py (Nexus Analytical) criado e integrado
- PDF Page Numbers: build_rag_context inclui Pág: N em cada trecho
- Citação Indexada: format_citations + campo citations na resposta da API

## Phase 2 — Implemented

- Test scaffolds: contratos de catálogo, scraper, intake PT-BR, checkpoint, coverage e pending review
- Normalization bridge: `hvac_normalize_document.py`
- PT-BR gate: validação de idioma no intake e pending_review.jsonl
- Coverage report: `generate_coverage_table()` e `--output-coverage`
- Expansion pipeline: `hvac_expansion_pipeline.py` com checkpoint, dry-run e report-only
- OpenWebUI prune: interface exclusiva para `hvac-manual-strict`

## Phase 3 — Planned

- Criar finder canônico para transformar lacunas em URLs candidatas de manual
- Integrar busca web oficial, ranking de fabricante e validação de PDF
- Conectar download -> intake -> index -> coverage em loop retomável

## Phase 4 — In Progress

- [x] 04-01: Contratos de Visão (Board type, labels, pins)
- [x] 04-02: Integração Visão-Memória (Context evidence)
- [x] 04-03: Endpoint de Intake (API Node + Pipe Python)
- [ ] 04-04: Smoke Tests (Fixtures reais + Runbook)
