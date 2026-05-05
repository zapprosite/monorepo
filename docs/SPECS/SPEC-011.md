---
spec: SPEC-011
title: "SPEC-210-CRM-FIX-tsconfig-paths"
status: active
created: 2026-05-03
type: pipeline
source: pipeline-plan.py
---

# SPEC-210-CRM-FIX-tsconfig-paths

## Objetivo

Pipeline autônomo de 5 tarefas, dividido em 1 chunks sequenciais.

## Contexto

- **Arquivo original**: `/srv/monorepo/.nexus/pipeline-210-crm-tsconfig.json`
- **Total de tarefas**: 5
- **Chunk size**: 5
- **Chunks total**: 1

## Execution Flow

```
Agente
  ├── pipeline-plan.py  →  SPEC-011.md (este arquivo)
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
| `001` | 5 | terminal, terminal, patch, terminal, terminal |

## State File

Checkpoint: `/tmp/pipeline-checkpoint.json`

```json
{
  "spec": "SPEC-011",
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

- `B1` — Install tsconfig-paths dependency in apps/api (`terminal`)
- `B2` — Verify tsconfig-paths is in package.json (`terminal`)
- `B3` — patch (`patch`)
- `B4` — Rebuild TypeScript (tsc + tsc-alias) (`terminal`)
- `B5` — Verify dist/server.js uses resolve_path and no @backend in JS (`terminal`)

