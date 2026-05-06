# ROADMAP - Brasil IDEIAS 05/2026

## Milestones

### M1: Fidelidade Técnica e Prova Real
- [x] Fase 1: Arquitetura de Fidelidade e Evidências Inverter V2 (COMPLETE 2026-05-05)
- [x] Fase 2: Expansão Massiva de Base Inverter BR (COMPLETE 2026-05-05)
- [ ] Fase 5: Implementação Dual-Index Semantic Bridge (PLANNED)

### M2: Aquisição e Cobertura Real de Manuais
- [ ] Fase 3: Manual Finder e Aquisição Automática (PLANNED)

### M3: Diagnóstico Visual e IoT
- [x] Fase 4: Reconhecimento de Placas e Componentes via Foto (COMPLETE 2026-05-06)

---

## Phase 4: Reconhecimento de Placas e Componentes via Foto

**Goal:** Tornar a análise visual de fotos de placas/componentes HVAC utilizável no fluxo técnico, com extração estruturada, classificação confiável de PCB e atualização de estado consumível pelo tutor.

**Plans:** 4 plans

- [x] 04-01-PLAN.md — contratos e estado canônico para fotos de PCB/componentes (COMPLETE 2026-05-05)
- [x] 04-02-PLAN.md — integração do vision output com memória/contexto de diagnóstico (COMPLETE 2026-05-05)
- [x] 04-03-PLAN.md — endpoint/CLI de intake com validação de imagem e hints (COMPLETE 2026-05-06)
- [x] 04-04-PLAN.md — smoke tests com fixtures reais e runbook operacional (COMPLETE 2026-05-06)

---

## Phase 2: Expansão Massiva de Base Inverter BR

**Goal:** Catálogo INMETRO 100% normalizado + orquestrador de pipeline + scraper batch + validação PT-BR + relatório de cobertura enriquecido por marca.

**Plans:** 5 plans

- [x] 02-01-PLAN.md — Wave 0 test scaffolds for all phase requirements
- [x] 02-02-PLAN.md — hvac_normalize_document.py normalization bridge
- [x] 02-03-PLAN.md — hvac_add_manual.py PT-BR gate + pending_review.jsonl
- [x] 02-04-PLAN.md — hvac_missing_manuals.py enriched coverage report
- [x] 02-05-PLAN.md — hvac_expansion_pipeline.py checkpoint orchestrator

---

## Phase 3: Manual Finder e Aquisição Automática

**Goal:** Fechar o ciclo modelo faltante -> encontrar manual -> baixar PDF -> validar intake -> indexar -> atualizar coverage.

**Plans:** 5 plans

- [x] 03-01-PLAN.md — `hvac_manual_finder.py` canonical CLI and data model (COMPLETE 2026-05-05)
- [x] 03-02-PLAN.md — official source search via Tavily/DDG + manufacturer ranking (COMPLETE 2026-05-06)
- [ ] 03-03-PLAN.md — PDF downloader validation: content-type, size, hash and duplicate guard
- [ ] 03-04-PLAN.md — intake integration: dry-run, index, rejection and pending review reasons
- [ ] 03-05-PLAN.md — coverage feedback loop and report-only automation

---

## Phase 5: Implementação Dual-Index Semantic Bridge

**Goal:** Implementar o sistema de recuperação em dois estágios (Intent Bridge via FAQ + Evidence Retrieval via Raw Manual) para garantir 100% de precisão e zero alucinação técnica.

**Plans:** 3 plans

- [x] 05-01-PLAN.md — Enriquecimento de base: LLM-generated FAQ (Top 50) no Qdrant (COMPLETE 2026-05-06)
- [x] 05-02-PLAN.md — Refatoração hvac_rag_pipe.py: Busca dual (Semantic -> Proof text) (COMPLETE 2026-05-06)
- [ ] 05-03-PLAN.md — Validação final: Smoke tests de grounding e citação técnica
