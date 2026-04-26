# SPEC-VIBE-BRAIN-REFACTOR
**Date:** 2026-04-24
**Status:** EXECUTING
**Type:** Infrastructure / Memory Architecture

---

## 1. CONTEXT

O sistema Hermes tem 3 camadas de memória mal integradas:
- **Repo (Second Brain)** caótico e sem índice
- **Qdrant** funcional mas sem metadata filters
- **Mem0** completamente quebrado (embedding model mismatch)

Este SPEC implementa o padrão de 3 camadas documentado pelo-nous-research.

---

## 2. OBJECTIVE

Implementar arquitetura de memória de referência:

```
REPO (source of truth) → QDRANT (RAG) → MEM0 (preferências)
         ↓
    HERMES EXECUTOR
```

---

## 3. TASKS

### FASE 1: Fix Mem0 ⚠️ CRITICAL
- [x] T01 — Identificar embedding model mismatch
- [ ] T02 — Aplicar fix OPENAI_EMBEDDINGS_MODEL=embedding-nomic
- [ ] T03 — Testar Mem0 com query simples
- [ ] T04 — Backup config atual

### FASE 2: Struct Second Brain
- [ ] T05 — Criar `llms.txt` (índice do repo)
- [ ] T06 — Criar `architecture-map.yaml` (mapa de entrada)
- [ ] T07 — Criar 3 ADRs core:
  - ADR-001: Qdrant como vector store local
  - ADR-002: Mem0 para memória dinâmica
  - ADR-003: Vibe Loop pattern

### FASE 3: Qdrant RAG
- [ ] T08 — Configurar metadata filters (doc_type, project, service)
- [ ] T09 — Indexar AGENTS.md com chunking
- [ ] T10 — Indexar services docs
- [ ] T11 — Criar hybrid search config

### FASE 4: Evals
- [ ] T12 — Criar 20 retrieval questions em /evals
- [ ] T13 — Testar retrieval accuracy
- [ ] T14 — Gerar report

### FASE 5: Vibe Loop Infinito
- [ ] T15 — Configurar queue infinita
- [ ] T16 — Criar cron workers (mCloud + Codex)
- [ ] T17 — Self-healing loop

---

## 4. DEFINITION OF DONE

- [ ] Mem0 responde a queries simples
- [ ] Qdrant retorna resultados com metadata filters
- [ ] AGENTS.md + llms.txt + architecture-map.yaml existem
- [ ] 3 ADRs criados e indexados
- [ ] 20 evals questions testadas
- [ ] Cron jobs activos
- [ ] Vibe Loop a correr autonomamente

---

## 5. TECHNICAL DETAILS

### Mem0 Fix
```bash
export OPENAI_EMBEDDINGS_MODEL=embedding-nomic
# Ou config em ~/.hermes/config.yaml
mem0:
  embeddings_model: embedding-nomic
```

### Qdrant Metadata Schema
```json
{
  "project": "hermes-second-brain",
  "doc_type": "adr|runbook|architecture|api|prompt|glossary",
  "service": "hermes-agents|mcloud|codex",
  "source_path": "path/to/file.md",
  "updated_at": "2026-04-24",
  "owner": "william",
  "version": "v1"
}
```

### Architecture Entry Points
1. AGENTS.md — agent instructions
2. llms.txt — repo index
3. architecture-map.yaml — system map

---

## 6. CRON JOBS

| Job | Schedule | Purpose |
|-----|----------|---------|
| vibe-brain-fix | once | Fix Mem0 + index |
| vibe-brain-workers | */15min | Launch mclaude workers |
| vibe-brain-monitor | */30min | Check progress |

---

## 7. RULES

> Repo = source of truth (versioned, reviewed)
> Qdrant = retrieval with metadata
> Mem0 = dynamic memory (preferences, patterns)
> Never mix: documentation goes to repo/Mem0, not both
