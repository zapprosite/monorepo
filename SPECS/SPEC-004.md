---
spec: SPEC-004
title: "teste-telegram"
status: active
created: 2026-05-01
type: pipeline
source: pipeline-plan.py
---

# teste-telegram

## Objetivo

Pipeline autônomo de 3 tarefas, dividido em 1 chunks sequenciais.

## Contexto

- **Arquivo original**: `/tmp/test.json`
- **Total de tarefas**: 3
- **Chunk size**: 5
- **Chunks total**: 1

## Execution Flow

```
Agente
  ├── pipeline-plan.py  →  SPEC-004.md (este arquivo)
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
| `001` | 3 | terminal, terminal, terminal |

## State File

Checkpoint: `/tmp/pipeline-checkpoint.json`

```json
{
  "spec": "SPEC-004",
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

- `t1` — Teste básico (`terminal`)
- `t2` — Espaço em disco (`terminal`)
- `t3` — Terceiro passo (`terminal`)

