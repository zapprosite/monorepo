# Phase 2: Expansão Massiva de Base Inverter BR - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Expandir massivamente a base de manuais Inverter BR no RAG, garantindo que o catálogo INMETRO esteja 100% normalizado e que as marcas tier-1 (LG, Samsung, Daikin) tenham ≥80% dos modelos Inverter com manual indexado no Qdrant.

Deliverables:
- Catálogo INMETRO 100% sincronizado e normalizado em JSONL
- Orquestrador `hvac_expansion_pipeline.py` para execução contínua do pipeline completo
- Scraper batch automático rodando em todas as marcas suportadas
- Validação PT-BR adicionada ao pipeline de intake
- Relatório de cobertura enriquecido por marca (Markdown)
- Arquivo `pending_review.jsonl` rastreando lacunas não resolvidas automaticamente

</domain>

<decisions>
## Implementation Decisions

### Pipeline de Aquisição
- Estratégia principal: scraper batch automático via `hvac_manual_scraper.py --brand all --batch-file`
- Criar `hvac_expansion_pipeline.py` como orquestrador único com checkpoint por etapa
- Pipeline: sync_catalog → normalize → missing_manuals → scraper_batch → add_manual (por arquivo)
- Checkpoint permite retomar do ponto de falha sem re-executar etapas completas

### Cobertura e Priorização de Marcas
- Tier-1 (prioridade máxima): LG, Samsung, Daikin — ~60% do volume INMETRO, scraper já suporta as 3
- Meta de conclusão da fase: catálogo INMETRO 100% normalizado + ≥80% dos modelos tier-1 com manual indexado
- Tier-2 (Carrier, Springer, Midea, Gree, Fujitsu, Hitachi, Komeco, Elgin, Agratto) são alvo secundário

### Qualidade e Validação
- Adicionar verificação de idioma PT-BR no pipeline de intake (rejeitar manuais sem conteúdo PT)
- Modelos sem manual acessível automaticamente → gravar em `/srv/data/hvac-rag/reports/pending_review.jsonl` com motivo
- is_inverter check existente mantido (não remover)

### Relatório de Cobertura
- Evoluir `hvac_missing_manuals.py` para emitir tabela Markdown por marca: %cobertura, modelos indexados vs faltantes, data da última atualização
- Relatório gerado como step final do orquestrador
- Saída em `/srv/data/hvac-rag/reports/coverage_report.md`

### Claude's Discretion
- Nomes exatos das funções internas do orquestrador
- Formato do checkpoint file (JSON preferível para legibilidade)
- Threshold de confiança para detecção de idioma PT-BR

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `hvac_sync_inmetro_catalog.py` — busca XLSX INMETRO e converte para JSON raw (output: `inmetro_raw_{date}.json`)
- `hvac_normalize_inmetro_catalog.py` — normaliza raw para JSONL schema (`inmetro_ac_br_models.jsonl`)
- `hvac_missing_manuals.py` — gap finder, cruza catálogo INMETRO com Qdrant, emite relatório Markdown
- `hvac_manual_scraper.py` — scraper por marca (LG, Samsung, Daikin, Springer, Carrier) com `--batch-file` e `--brand all`
- `hvac_add_manual.py` — pipeline de intake completo (fingerprint → classify → dedupe → is_inverter → index)
- `hvac_reconcile_catalog_qdrant.py` — gera `manual-coverage.json` e CSV

### Established Patterns
- Data em `/srv/data/hvac-rag/catalog/` (catálogo), `/srv/data/hvac-rag/incoming/pdf/` (PDFs baixados), `/srv/data/hvac-rag/reports/` (relatórios)
- TRACKED_BRANDS em hvac_missing_manuals.py: lg, samsung, daikin, carrier, springer, midea, gree, fujitsu, hitachi, komeco, elgin, agratto
- Qdrant collection: `hvac_manuals_v1`
- Scripts usam `argparse` com `--dry-run` como padrão de segurança
- Env vars: `QDRANT_URL`, `QDRANT_API_KEY`, `HVAC_COLLECTION`, `HVAC_INMETRO_CATALOG`

### Integration Points
- `hvac_add_manual.py` é o ponto de entrada canônico para indexar novos PDFs
- `is_inverter_technology()` em `hvac_intake.py` é o guard Inverter (hard-lock já implementado na Fase 1)
- Output de `hvac_missing_manuals.py` alimenta o batch file do scraper

</code_context>

<specifics>
## Specific Ideas

- O orquestrador deve salvar estado de checkpoint em `/srv/data/hvac-rag/catalog/pipeline_checkpoint.json`
- Marcas sem scraper dedicado (Midea, Gree, Fujitsu, Hitachi, etc.) geram automaticamente entrada em `pending_review.jsonl`
- Verificação PT-BR: checar se >30% dos tokens do texto extraído são palavras portuguesas (usar wordlist simples ou langdetect)

</specifics>

<deferred>
## Deferred Ideas

- Browser-use integration no `hvac_manual_downloader.py` (TODO existente) — deixar para fase posterior
- Dashboard HTML com Chart.js para visualização de cobertura — complexidade não justificada nesta fase
- Alertas automáticos (e-mail/Slack) quando cobertura cai abaixo de threshold — fora do escopo atual

</deferred>
