---
spec: SPEC-009
title: "SPEC-CRM-COMPLETION-FASE1"
status: active
created: 2026-05-03
type: pipeline
source: pipeline-plan.py
---

# SPEC-CRM-COMPLETION-FASE1

## Objetivo

Pipeline autônomo de 5 tarefas, dividido em 1 chunks sequenciais.

## Contexto

- **Arquivo original**: `pipeline-fase1.json`
- **Total de tarefas**: 5
- **Chunk size**: 5
- **Chunks total**: 1

## Execution Flow

```
Agente
  ├── pipeline-plan.py  →  SPEC-009.md (este arquivo)
  ├── queue-control.sh  →  sub-pipeline-001.json (chunk 1/1)
  ├── [executa, renova contexto]
  ├── queue-control.sh  →  sub-pipeline-002.json (chunk 2/1)
  ├── [executa, renova contexto]
  ├── ...
  ├── queue-control.sh  →  sub-pipeline-001.json (chunk 1/1)
  ├── [executa, renova contexto]
  └── review inline → destrói SPEC
```

## Chunk Manifest

| Chunk | Tarefas | Tipos |
|-------|---------|-------|
| `001` | 5 | ?, ?, ?, ?, ? |

## State File

Checkpoint: `/tmp/pipeline-checkpoint.json`

```json
{
  "spec": "SPEC-009",
  "chunk_index": 1,
  "total_chunks": 1,
  "status": "running"
}
```

## Auto-Destruição

- Cada sub-pipeline é destruído (`shred -u`) após execução do chunk
- SPEC.md destruído após review final
- Estado de falha salvo em `/tmp/pipeline.failed.json`

## Chunks

### Chunk 001

- `FASE1-1` — Add subdomain column to equipment.table.ts (`?`)
- `FASE1-2` — Generate hash on equipment creation in equipment.trpc.ts (`?`)
- `FASE1-3` — Create public.routes.ts with GET /public/equip/:subdomain (`?`)
- `FASE1-4` — Create equipment-rg.html.ts template (`?`)
- `FASE1-5` — Register public routes in app.ts (`?`)

