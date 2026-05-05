---
title: HVAC Brazil Inverter KB — Runbook
scope: Ar-condicionados inverter e velocidade variável comercializados no Brasil
last_updated: 2026-04-28
---

# HVAC Brazil Inverter KB — Runbook

> **Escopo:** Ar-condicionados **inverter** e **velocidade variável** comercializados no Brasil.
> Modelos convencional/fixo, catálogos comerciais, controles remotos e manuais de usuário
> simples estão **fora de scope** e são rejeitados automaticamente.

## Índice

1. [Arquitetura do pipeline](#1-arquitetura-do-pipeline)
2. [Catálogo Inmetro PBE](#2-catálogo-inmetro-pbe)
3. [Como adicionar um manual](#3-como-adicionar-um-manual)
4. [Como rejeitar um documento](#4-como-rejeitar-um-documento)
5. [Ver coverage dos manuais](#5-ver-coverage-dos-manuais)
6. [Priorizar manuais faltantes](#6-priorizar-manuais-faltantes)
7. [Responder perguntas sem manual disponível](#7-responder-perguntas-sem-manual-disponível)
8. [Fora de escopo](#8-fora-de-escopo)
9. [Smoke test e healthcheck](#9-smoke-test-e-healthcheck)
10. [Referências](#10-referências)

---

## 1. Arquitetura do pipeline

```
PDF (incoming/pdf/)
  → hvac_add_manual.py        # intake + policy + fingerprint + dedupe
  → Docling                    # PDF → Markdown + JSON
  → hvac_strong_dedupe.py      # deduplicação forte
  → hvac-chunk.py              # chunking estruturado
  → hvac-index-qdrant.py       # indexação Qdrant hvac_manuals_v1
  → Qdrant (442 pontos)

OpenWebUI query
  → hvac-rag-pipe.py (porta 4017)
  → Juiz (pre-flight check)
  → Field Tutor (enriquecimento)
  → LiteLLM + Ollama
  → Formatter (thermal printer)
```

## 2. Catálogo Inmetro PBE

O catálogo contém todos os modelos Inverter PBE comercializados no Brasil.

### Origem dos dados

- **Fonte:** Inmetro/PBE — Planilha de Condicionadores de Ar (download automático)
- **Script:** `scripts/hvac-rag/hvac_sync_inmetro_catalog.py`
- **Normalização:** `scripts/hvac-rag/hvac_normalize_inmetro_catalog.py`
- **Ficheiro:** `/srv/data/hvac-rag/catalog/inmetro_ac_br_models.jsonl`

### Atualizar catálogo

```bash
# Dry-run — ver o que mudaria
python3 /srv/monorepo/scripts/hvac-rag/hvac_sync_inmetro_catalog.py --dry-run

# Download e normalização completos
python3 /srv/monorepo/scripts/hvac-rag/hvac_sync_inmetro_catalog.py
python3 /srv/monorepo/scripts/hvac-rag/hvac_normalize_inmetro_catalog.py
```

> **⚠️ Se o download falhar (URL 404):** o site do Inmetro mudou de estrutura.
> 1. Visita [PBE Inmetro](https://pbe.inmetro.gov.br/) e procura "Download XLSX" ou "Planilha"
> 2. Alternativa: vai a [gov.br/inmetro → PBE → Condicionadores de Ar](https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/condicionadores-de-ar)
> 3. Usa `--url` com a URL descoberta: `hvac_sync_inmetro_catalog.py --url "https://..."`
> 4. Faz cache em `/tmp/inmetro_ac_*.xlsx` — usa `--offline` nas próximas execuções

## 3. Como adicionar um manual

### Fluxo recomendado

```bash
# 1. Validar sem processar (dry-run)
python3 /srv/monorepo/scripts/hvac-rag/hvac_add_manual.py --dry-run ./Manual.pdf

# 2. Se ACCEPTED: processar (Markdown + JSON)
python3 /srv/monorepo/scripts/hvac-rag/hvac_add_manual.py ./Manual.pdf

# 3. Se ACEITO e Qdrant vazio para este modelo: indexar
python3 /srv/monorepo/scripts/hvac-rag/hvac_add_manual.py --index ./Manual.pdf

# 4. Atualizar coverage após indexar
python3 /srv/monorepo/scripts/hvac-rag/hvac_reconcile_catalog_qdrant.py
```

### Checklist antes de adicionar

- [ ] É um **service manual** ou **manual técnico** (não catálogo comercial)?
- [ ] É um equipamento **inverter** (não convencional/fixo)?
- [ ] O modelo está no catálogo Inmetro (`inmetro_ac_br_models.jsonl`)?
- [ ] O PDF contém códigos de erro ou diagramas elétricos?

### Política de documentos aceite

| Tipo | Aceite |
|---|---|
| Service manual | ✅ |
| Manual de serviço | ✅ |
| Troubleshooting | ✅ |
| Error code / Código de erro | ✅ |
| Wiring diagram / Diagrama elétrico | ✅ |
| VRV / VRF / ACJ Inverter | ✅ |
| Installation manual técnico | ✅ |
| Catálogo comercial | ❌ |
| Folder / Brochure | ❌ |
| Manual de usuário simples | ❌ |
| Controle remoto apenas | ❌ |
| Garantia | ❌ |

## 4. Como rejeitar um documento

Documentos rejeitados são salvos em `/srv/data/hvac-rag/rejected/` com timestamp.

### Rejeição automática

`hvac_add_manual.py` rejeita automaticamente se:

- Nome do ficheiro contém palavra da blacklist (`catalogo`, `folder`, `brochure`, `garantia`, `nota fiscal`)
- Score HVAC < 0.45
- Tecnologia convencional/fixo (não inverter)
- Tipo de documento no blacklist

### Rejeição manual

Se um PDF passou mas não deveria:

1. Identificar o `doc_id` em `manifests/documents.jsonl`
2. Remover do manifest: `jq 'map(select(.doc_id != "XYZ"))' manifests/documents.jsonl > tmp && mv tmp manifests/documents.jsonl`
3. Se já indexado: deletar do Qdrant pelo `doc_id`

## 5. Ver coverage dos manuais

```bash
# Gerar relatório
python3 /srv/monorepo/scripts/hvac-rag/hvac_reconcile_catalog_qdrant.py --dry-run

# Ver CSV
cat /srv/data/hvac-rag/catalog/manual-coverage.csv

# Estatísticas rápidas
jq '.summary' /srv/data/hvac-rag/catalog/manual-coverage.json
```

**Campos do relatório:**

- `catalog_id` — ID único no catálogo
- `brand` — marca
- `indoor_model` / `outdoor_model` — modelos
- `equipment_type` — tipo de equipamento
- `manual_status` — `missing` | `indexed` | `partially_indexed`
- `service_manual_indexed` — bool
- `installation_manual_indexed` — bool
- `error_codes_available` — bool
- `wiring_available` — bool
- `qdrant_doc_ids` — IDs dos documentos em Qdrant
- `priority_rank` — rank de prioridade (1 = maior BTU sem manual)

## 6. Priorizar manuais faltantes

Os 10 modelos com maior capacidade (BTU/h) sem manual são os prioritários:

```bash
# Ordenar por priority_rank (campo gerado pelo reconcile)
cat /srv/data/hvac-rag/catalog/manual-coverage.csv \
  | csvtool col 13,2,3,4,5,6 - \
  | grep "missing" \
  | sort -t',' -k1 -n \
  | head -10
```

**Critérios de priorização:**

1. Maior capacidade (BTU/h) sem manual → maior prioridade
2. Equipamento VRV/VRF > Split comercial > Split residencial
3. Modelos com registro Inmetro ativo

## 7. Responder perguntas sem manual disponível

Quando uma pergunta é sobre um modelo sem manual indexado:

1. **Graph fallback:** O `hvac-rag-pipe.py` faz fallback para a Knowledge Graph
2. **Busca oficial:** Query a internet (Inmetro PBE, site do fabricante) com etiqueta `[INMETRO_PBE_VERIFY]`
3. **Resposta:** Informar que o manual não está na base mas é possível verificar em:
   - Inmetro PBE: https://www.gov.br/inmetro/pt-br/areas-de-atuacao/eficiencia-energetica/etiquetagem-veicular-e-de-equipamentos
   - Fabricante (fornecer marca)

**Prompt template para o LLM:**

```
O modelo {model} não tem manual indexado na base HVAC BR Inverter.
Informar ao utilizador e sugerir consulta ao Inmetro PBE ou site do fabricante.
Etiqueta: [INMETRO_PBE_VERIFY]
```

## 8. Fora de escopo

As seguintes perguntas devem ser bloqueadas pelo Juiz:

- Lavadoras, geladeiras, secadoras (não HVAC)
- Ar-condicionado convencional/fixo (não inverter)
- Catálogos comerciais de loja
- Dúvidas sobre garantia (não técnica)
- Controle remoto de TV ou outro eletrodoméstico
- Sistemas de heating doméstico (caldeiras, boilers)
- Perguntas sobre Nota Fiscal ou contratos

## 9. Smoke test e healthcheck

```bash
# Healthcheck — verificar serviços
python3 /srv/monorepo/scripts/hvac-rag/hvac-healthcheck.py

# Smoke test — query de retrieval
python3 /srv/monorepo/scripts/hvac-rag/hvac-daily-smoke.py --once

# Validação de sintaxe dos scripts
for s in hvac-sync-inmetro-catalog hvac-normalize-inmetro-catalog hvac-add-manual \
          hvac-strong-dedupe hvac-reconcile-catalog-qdrant hvac-kb-tests; do
  python3 -m py_compile /srv/monorepo/scripts/hvac-rag/$s.py
  echo "$s: OK"
done
```

## 10. Referências

| Recurso | Path |
|---|---|
| Scripts HVAC RAG | `/srv/monorepo/scripts/hvac-rag/` |
| Catálogo Inmetro | `/srv/data/hvac-rag/catalog/inmetro_ac_br_models.jsonl` |
| Coverage CSV | `/srv/data/hvac-rag/catalog/manual-coverage.csv` |
| Coverage JSON | `/srv/data/hvac-rag/catalog/manual-coverage.json` |
| Document Policy | `/srv/monorepo/config/hvac-rag/document-policy.yaml` |
| Rejected docs | `/srv/data/hvac-rag/rejected/` |
| Manifests | `/srv/data/hvac-rag/manifests/` |
| SPEC HVAC-001 | `/srv/monorepo/docs/SPECS/products/HVAC/SPEC-HVAC-001-rag-ingestion.md` |
| SPEC HVAC-004 | `/srv/monorepo/docs/SPECS/products/HVAC/SPEC-HVAC-004-juiz-field-tutor.md` |
