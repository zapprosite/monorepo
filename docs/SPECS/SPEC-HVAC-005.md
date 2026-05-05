---
name: SPEC-HVAC-005
description: HVAC RAG Pipeline v2 — Blacklist/Whitelist, Metadata Extraction, Brand Isolation, OpenWebUI Tool
status: APPROVED
priority: high
author: will-zappro
date: 2026-05-05
specRef: SPEC-HVAC-001, SPEC-UHC-001, ADR-001
---

# SPEC-HVAC-005: HVAC RAG Pipeline v2 — Classificação Inteligente de Manuais

> **Status:** APROVADO | **Data:** 2026-05-05 | **Prioridade:** Alta

---

## Objective

Eliminar falsos positivos no RAG HVAC causados por PDFs irrelevantes (instalação, garantia, catálogos) e prevenir cross-brand contamination (LG CH05 vs Samsung E201). Implementar um pipeline de ingestão inteligente que classifica, filtra e enriquece manuais de serviço de ar condicionado inverter comercializados no Brasil, gerando chunks com metadados estruturados para busca vetorial isolada por marca.

---

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| PDF Extraction | Docling | Via venv em `/srv/data/hvac-rag/.venv` |
| LLM Local | Ollama `qwen2.5-coder:14b-q6k` | Extração de metadados, Q&A |
| Embeddings | Ollama `nomic-embed-text` | 768D, Cosine |
| Vector DB | Qdrant `:6333` | Coleção `hvac_manuals_v1` |
| API | Swarm Go `:8643` | Fastify + endpoint RAG filtrado |
| UI | OpenWebUI `:3456` | Tool com Valves/UserValves |
| Scripts | Python 3.12 | `/srv/monorepo/scripts/hvac-rag/` |

---

## Commands

```bash
# Enriquecer PDF com classificação
python3 hvac_manual_enrich.py <pdf> --out-dir /srv/data/hvac-rag/processed --index

# Scraping de manual
python3 hvac_manual_scraper.py --brand lg --model "AR-09NS1"

# Health checks
curl -sf http://localhost:8643/health
curl -sf http://localhost:8642/health
curl -sf http://localhost:6333/collections/hvac_manuals_v1

# Rebuild Go
export PATH=$PATH:/usr/local/go/bin && go build ./...
```

---

## Project Structure

```
/srv/monorepo/scripts/hvac-rag/
├── hvac_manual_scraper.py          # Download de manuais (NOVO)
├── hvac_manual_enrich.py           # PDF → MD + FAQ + JSON (NOVO)
├── hvac_add_manual.py              # Intake com policy YAML
├── hvac_chunk.py                   # Chunking + Docling convert
├── hvac_index_qdrant.py            # Indexação Qdrant
├── hvac_fingerprint.py             # SHA256 + dedup
├── hvac_classify_domain.py         # Score HVAC signal
├── hvac_normalize.py               # Extração de modelo/erros
└── hvac_rag_pipe.py                # Endpoint OpenAI-compatible

/srv/monorepo/cmd/swarm/main.go     # RAG endpoint com filtro
/srv/monorepo/internal/memory/      # Qdrant layer
```

---

## Code Style

- **Scripts:** Python 3.12, type hints opcionais, docstrings em PT-BR
- **Go:** Padrão do projeto (gofmt, nomes em inglês)
- **Config:** YAML para policies, JSONL para manifests
- **Logs:** `logging` com formato ISO + nível

---

## Testing Strategy

| Level | Scope | Method |
|-------|-------|--------|
| Smoke | Docling converte PDF sem crash | `python3 -c "from hvac_chunk import docling_convert; ..."` |
| Smoke | LLM gera Q&A com >5 pares | `hvac_manual_enrich.py test.pdf` |
| Smoke | Filtro brand bloqueia cross-brand | Query Qdrant `brand=lg` não retorna Samsung |
| E2E | Pipeline completo PDF→Qdrant | `hvac_add_manual.py --index test.pdf` |

---

## Boundaries

### Always
- Criar ZFS snapshot antes de mudanças em Qdrant (`zfs snapshot tank@pre-hvac-005`)
- Validar blacklist/whitelist antes de indexar
- Extrair metadados via LLM local (nunca cloud para dados sensíveis)
- Usar `is_tenant: true` no campo `brand` do Qdrant

### Ask First
- Alterar schema da coleção Qdrant existente
- Adicionar novas collections (preferir payload partitioning)
- Mudar modelo de embedding (768D é padrão)

### Never
- Indexar PDF sem passar por blacklist/whitelist
- Fazer busca vetorial SEM filtro de marca
- Hardcodar API keys ou tokens
- Reindexar tudo sem snapshot

---

## Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| SC-1 | PDF de instalação é rejeitado pela blacklist | `python3 hvac_manual_enrich.py install.pdf` retorna `rejected` |
| SC-2 | PDF de serviço gera ≥20 Q&A técnicos | JSON output `qa_count >= 20` |
| SC-3 | Query LG CH05 retorna apenas LG | `brand=lg` em 100% dos top-5 results |
| SC-4 | Swarm RAG aceita filtro JSON | `POST /v1/rag {"filter":{"brand":"lg"}}` funciona |
| SC-5 | OpenWebUI Tool exibe dropdown de marcas | Valves mostra LG, Samsung, Daikin, Carrier, Springer |
| SC-6 | Zero cross-brand contamination em 20 queries de teste | Script de validação passa |

---

## User Story

Como **técnico de campo de HVAC**, quero **consultar um chatbot sobre códigos de erro específicos da marca que estou atendendo**, para **obter procedimentos de reparo precisos sem receber informação de marca errada**.

---

## Goals

### Must Have (MVP)

- [ ] Blacklist/Whitelist de títulos e conteúdo de PDFs
- [ ] Extração de metadados via LLM local (brand, model, error_codes)
- [ ] Chunking enriquecido com metadados para Qdrant
- [ ] Filtro obrigatório de marca no endpoint RAG
- [ ] Índice Qdrant `is_tenant: true` no campo brand
- [ ] Tool OpenWebUI com Valves (dropdown brand)

### Should Have

- [ ] Taxonomia canônica de códigos de erro (cross-reference)
- [ ] Re-ranker por consistência de marca
- [ ] Pipeline CLI unificado (`make hvac-ingest`)

### Could Have

- [ ] GraphRAG para relacionamentos entre peças/modelos
- [ ] Fine-tuning de embeddings no corpus HVAC
- [ ] Auto-detection de marca via visão (foto do nameplate)

---

## Non-Goals

- Não cobre scraping automatizado de sites com CAPTCHA (browser-use futuro)
- Não inclui OCR para PDFs escaneados antigos (fora do escopo v1)
- Não substitui o juiz/field tutor (SPEC-206)
- Não modifica o motor de voz/STT

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | PDF "Installation manual" é rejeitado | `grep -i install` no título → rejeitar antes de extrair |
| AC-2 | PDF "Service manual" é aceito e enriquecido | Gera `_faq.md` e `_faq.json` |
| AC-3 | Metadados extraídos contêm brand, model, error_codes | Validar JSON output |
| AC-4 | Qdrant search com `brand=lg` retorna apenas LG | `curl -X POST .../points/search` com filter |
| AC-5 | Query sem marca pergunta "Qual a marca?" | OpenWebUI responde com pergunta de clarificação |
| AC-6 | Swarm health passa após mudanças | `curl :8643/health` → OK |

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| SPEC-UHC-001 | COMPLETE | Swarm + Auditore gateway rodando |
| Ollama :11434 | READY | qwen2.5-coder:14b, nomic-embed-text |
| Qdrant :6333 | READY | coleção hvac_manuals_v1 existe |
| Docling | READY | venv em /srv/data/hvac-rag/.venv |
| OpenWebUI :3456 | READY | swarm_rag_bridge ativo |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-05-05 | Usar `is_tenant: true` em vez de collections separadas | Qdrant recomenda payload partitioning; evita overhead RAM |
| 2026-05-05 | LLM local (qwen2.5-coder) para metadados | Zero custo cloud; dados técnicos não saem do host |
| 2026-05-05 | Blacklist antes de Docling (título) e depois (conteúdo) | Evita processar PDFs irrelevantes; título é indicador rápido |
| 2026-05-05 | Hard filter brand obrigatório no RAG | Prevenção de contaminação cross-brand é não-negociável |

---

## Checklist

- [x] SPEC written and reviewed
- [ ] Architecture decisions documented (ADR se necessário)
- [x] Acceptance criteria are testable
- [x] Dependencies identified
- [ ] Security review done (secrets audit)
- [ ] Tasks generated via `/pg`
- [ ] Smoke tests pass
- [ ] No hardcoded secrets in code

---

## Pipeline Execution

Gerado via: `/pg SPEC-HVAC-005`
Pipeline: `tasks/pipeline-HVAC-005.json`
