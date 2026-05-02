---
spec: SPEC-008
title: "git-chunk"
status: active
created: 2026-05-02
type: pipeline
source: pipeline-plan.py
---

# git-chunk

## Objetivo

Pipeline autônomo de 3 tarefas, dividido em 1 chunks sequenciais.

## Contexto

- **Arquivo original**: `/tmp/git-chunk-pipeline.json`
- **Total de tarefas**: 3
- **Chunk size**: 3
- **Chunks total**: 1

## Execution Flow

```
Agente
  ├── pipeline-plan.py  →  SPEC-008.md (este arquivo)
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
| `001` | 3 | terminal, execute_code, clarify |

## State File

Checkpoint: `/tmp/pipeline-checkpoint.json`

```json
{
  "spec": "SPEC-008",
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

- `git-audit` — Audita estado git — modified, untracked, staged, deleted, conflicts (`terminal`)
- `chunk-plan` — Analisa arquivos modificados e gera plano de chunks (`execute_code`)
- `chunk-review` — Apresenta plano de chunks ao usuário (`clarify`)

