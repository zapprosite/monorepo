# HVAC RAG SIMPLIFICATION AUDIT — 2026-04

**Data:** 2026-04-28
**Responsável:** Claude Code / Nexus
**Objetivo:** Simplificar HVAC RAG para expor um único produto: **Zappro Clima Tutor**

---

## 1. Inventário de Arquivos HVAC RAG

### 1.1 Scripts principais (`scripts/hvac-rag/`)

| Arquivo | Classificação | Ação |
|---|---|---|
| `hvac_rag_pipe.py` | ACTIVE_RUNTIME | Manter — pipe v2.0.0 com router + MiniMax primary |
| `hvac_juiz.py` | ACTIVE_RUNTIME | Manter — pre-flight judge (<50ms) |
| `hvac_field_tutor.py` | ACTIVE_RUNTIME | Manter — contexto expandido para técnicos |
| `hvac_formatter.py` | ACTIVE_RUNTIME | Manter — saída para impressora térmica |
| `hvac_healthcheck.py` | ACTIVE_TEST | Manter — health verification |
| `hvac_daily_smoke.py` | ACTIVE_TEST | Manter — smoke tests |
| `hvac_normalize.py` | ACTIVE_RUNTIME | Manter — normalização de manuais |
| `hvac_index_qdrant.py` | ACTIVE_RUNTIME | Manter — indexing pipeline |
| `hvac_add_manual.py` | ACTIVE_RUNTIME | Manter — ingestion de novos manuais |
| `hvac_sync_inmetro_catalog.py` | ACTIVE_RUNTIME | Manter — sync catálogo INMETRO |
| `hvac_reconcile_catalog_qdrant.py` | ACTIVE_RUNTIME | Manter — reconciliação catálogo vs Qdrant |
| `hvac_classify_domain.py` | ACTIVE_TEST | Manter — KB pipeline tests |
| `hvac_normalize_inmetro_catalog.py` | INTERNAL_KEEP | Manter — usado por sync pipeline |
| `hvac_chunk.py` | INTERNAL_KEEP | Manter — usado por indexing |
| `hvac_fingerprint.py` | INTERNAL_KEEP | Manter — usado por KB pipeline |
| `hvac_dedupe.py` | INTERNAL_KEEP | Manter — deduplicação |
| `hvac_strong_dedupe.py` | INTERNAL_KEEP | Manter — deduplicação agressiva |
| `hvac_qdrant_query.py` | INTERNAL_KEEP | Manter — helpers de query |
| `hvac_kb-tests.py` | ACTIVE_TEST | Manter — 8 KB unit tests |
| `hvac-friendly-response.py` | ACTIVE_RUNTIME | **NOVO** — friendly response rewriter |
| `hvac-status.py` | ACTIVE_CONFIG | **NOVO** — unified status dashboard |
| `hvac_retrieve_dryrun.py` | LEGACY_ARCHIVE | Mover para archive — dry-run sem chamada conhecida |
| `hvac_evaluate_manual_strict.py` | LEGACY_ARCHIVE | Mover para archive — eval superseded por smoke |
| `hvac_evaluate_T0152.py` | LEGACY_ARCHIVE | Mover para archive — eval superseded |
| `hvac_assertions.py` | INTERNAL_KEEP | Manter — KB assertions |

### 1.2 Configuração (`config/`)

| Arquivo | Classificação | Ação |
|---|---|---|
| `config/hvac-copilot/answer-template-ptbr.md` | ACTIVE_CONFIG | **NOVO** — fonte única do template de resposta |
| `config/hvac-copilot/zappro-clima-tutor.yaml` | ACTIVE_CONFIG | **NOVO** — perfil do modelo público |
| `config/hvac-rag/document-policy.yaml` | ACTIVE_DOC | Manter — política de documentos |

### 1.3 Docker / Compose

| Arquivo | Classificação | Ação |
|---|---|---|
| `docker-compose.openwebui.yml` | ACTIVE_CONFIG | Atualizado — DEFAULT_MODEL=zappro-clima-tutor ✓ |

### 1.4 Docs

| Arquivo | Classificação | Ação |
|---|---|---|
| `docs/RUNBOOKS/HVAC-RAG-OPERATIONS.md` | ACTIVE_DOC | Manter — operations runbook |
| `docs/RUNBOOKS/HVAC-BRAZIL-INVERTER-KB.md` | ACTIVE_DOC | Manter — KB de modelos |
| `docs/SPECS/products/HVAC/SPEC-HVAC-001-rag-ingestion.md` | INTERNAL_KEEP | Manter — spec histórico |
| `docs/SPECS/products/HVAC/SPEC-HVAC-002-openwebui-faq.md` | INTERNAL_KEEP | Manter — spec histórico |
| `docs/SPECS/products/HVAC/SPEC-HVAC-003-evaluation-suite.md` | INTERNAL_KEEP | Manter — spec histórico (draft) |
| `docs/SPECS/products/HVAC/SPEC-HVAC-004-juiz-field-tutor.md` | INTERNAL_KEEP | Manter — spec histórico |
| `docs/REFERENCE/hvac-models-and-error-codes.md` | ACTIVE_DOC | Manter — referência de códigos |
| `docs/AUDITS/HVAC-RAG-SIMPLIFICATION-AUDIT-2026-04.md` | ACTIVE_DOC | **ESTE ARQUIVO** |

### 1.5 Skills

| Arquivo | Classificação | Ação |
|---|---|---|
| `.claude/skills/hvac-guided-triage/SKILL.md` | ACTIVE_DOC | Manter — skill para Claude Code |
| `.claude/skills/hvac-guided-triage/evals/eval-cases.jsonl` | ACTIVE_TEST | Manter — casos de eval |
| `.claude/skills/hvac-guided-triage/scripts/run-guided-triage-eval.sh` | ACTIVE_TEST | Manter — script de eval |
| `.claude/skills/hvac-guided-triage/references/anti-patterns.md` | ACTIVE_DOC | Manter |
| `.claude/skills/hvac-guided-triage/references/guided-triage-policy.md` | ACTIVE_DOC | Manter |
| `.claude/skills/hvac-guided-triage/references/daikin-vrv-e4-policy.md` | ACTIVE_DOC | Manter |

### 1.6 SPEC Tasks

| Arquivo | Classificação | Ação |
|---|---|---|
| `tasks/spec-hvac-001/` | LEGACY_STALE | Estagnado — todas as tarefas pendentes |
| `tasks/spec-hvac-004/` | LEGACY_STALE | Estagnado — Juiz/FieldTutor/Formatter já implementados |

### 1.7 Smoke Tests

| Arquivo | Classificação | Ação |
|---|---|---|
| `smoke-tests/smoke_hvac_friendly_tutor_ux.py` | ACTIVE_TEST | **NOVO** — 11 UX tests |

### 1.8 Apps

| Arquivo | Classificação | Ação |
|---|---|---|
| `apps/hvac-manual-downloader/` | INTERNAL_KEEP | Manter — download de manuais |
| `internal/rag/models/hvac_models.go` | INTERNAL_KEEP | Manter — modelo Go para RAG |

### 1.9 Archive (pré-existente)

| Diretório | Conteúdo | Ação |
|---|---|---|
| `archive/hvac-rag-legacy/2026-04/prompts/` | (vazio) | Destino de prompts legados |
| `archive/hvac-rag-legacy/2026-04/docs/` | (vazio) | Destino de docs legados |
| `archive/hvac-rag-legacy/2026-04/scripts/` | (vazio) | Destino de scripts legados |
| `archive/hvac-rag-legacy/2026-04/manifests/` | (vazio) | Destino de manifests legados |
| `archive/hvac-rag-legacy/2026-04/configs/` | (vazio) | Destino de configs legadas |

---

## 2. Decisões de Simplificação

### 2.1 Modelo público: `zappro-clima-tutor` ✓

**Antes:**
```
/v1/models retornava: ["hvac-manual-strict"]
```
**Depois:**
```
/v1/models retorna: ["zappro-clima-tutor"]
```
**Aliases internos (não expostos):**
- `hvac-manual-strict` — modo manual_strict
- `hvac-field-tutor` — modo field_tutor
- `hvac-printable` — modo printable

### 2.2 Arquitetura de resposta

```
RAG (Qdrant)  →  contexto/evidência
Graph interno  →  triagem técnica
MiniMax M2.7   →  writing engine PRIMÁRIO
OpenWebUI      →  interface amigável
```

O MiniMax **escreve** a resposta final. O RAG **não é** a resposta final.

### 2.3 Prompts consolidados

Fonte única: `config/hvac-copilot/answer-template-ptbr.md`

Nenhum outro prompt HVAC deve ser редактирован sem atualizar este arquivo.

### 2.4 Scripts candidatos a archive (não deletar ainda)

| Script | Motivo |
|---|---|
| `hvac_retrieve_dryrun.py` | Dry-run sem chamada conhecida em CI/pipeline |
| `hvac_evaluate_manual_strict.py` | Superseded por smoke + UX tests |
| `hvac_evaluate_T0152.py` | Superseded por smoke + UX tests |

**Ação:** Mover para `archive/hvac-rag-legacy/2026-04/scripts/` (não deletar — podem ser úteis para rollback).

---

## 3. Validações Realizadas

```bash
# Syntax de todos os scripts Python
python3 -m py_compile scripts/hvac-rag/hvac_rag_pipe.py          # OK
python3 -m py_compile scripts/hvac-rag/hvac-friendly-response.py   # OK
python3 -m py_compile scripts/hvac-rag/hvac-status.py              # OK
python3 -m py_compile smoke-tests/smoke_hvac_friendly_tutor_ux.py # OK

# Rewrite rules (4/4 PASS)
python3 scripts/hvac-rag/hvac-friendly-response.py --test          # 4/4 PASS

# Modelo exposto antes (verificar restart do pipe):
# Antes: ["hvac-manual-strict", "hvac-field-tutor", ...]
# Depois (requer restart): ["zappro-clima-tutor"]
```

---

## 4. Para Aplicar

```bash
# 1. Reiniciar pipe
sudo systemctl restart hvac-rag-pipe
# ou
python3 scripts/hvac-rag/hvac_rag_pipe.py &

# 2. Verificar modelo público
curl http://127.0.0.1:4017/v1/models | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])"

# 3. Status unificado
python3 scripts/hvac-rag/hvac-status.py

# 4. Rewrite validation
python3 scripts/hvac-rag/hvac-friendly-response.py --test

# 5. Smoke test
python3 scripts/hvac-rag/hvac_daily_smoke.py --once

# 6. Healthcheck
python3 scripts/hvac-rag/hvac_healthcheck.py
```

---

## 5. Status Final

| Componente | Status |
|---|---|
| `/v1/models` expõe só `zappro-clima-tutor` | ✅ Implementado (requer restart) |
| MiniMax M2.7 como primary writing engine | ✅ Implementado em `hvac_rag_pipe.py` |
| Qdrant como evidência, não resposta final | ✅ Implementado via `build_retrieval_package()` |
| Router interno (triage/field/printable) | ✅ Implementado |
| Friendly response rewriter | ✅ Implementado + 4/4 testes OK |
| Template PT-BR canônico | ✅ `config/hvac-copilot/answer-template-ptbr.md` |
| Perfil `zappro-clima-tutor` | ✅ `config/hvac-copilot/zappro-clima-tutor.yaml` |
| OpenWebUI DEFAULT_MODEL | ✅ `docker-compose.openwebui.yml` atualizado |
| Status dashboard unificado | ✅ `scripts/hvac-rag/hvac-status.py` |
| UX smoke tests | ✅ `smoke-tests/smoke_hvac_friendly_tutor_ux.py` (11 casos) |

**simplification_ready: true**
