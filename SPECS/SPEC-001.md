---
spec: SPEC-001
title: "onda3-hardening"
status: active
created: 2026-05-01
type: pipeline
source: pipeline-plan.py
---

# onda3-hardening

## Objetivo

Pipeline autônomo de 11 tarefas, dividido em 3 chunks sequenciais.

## Contexto

- **Arquivo original**: `/tmp/onda3.json`
- **Total de tarefas**: 11
- **Chunk size**: 5
- **Chunks total**: 3

## Execution Flow

```
Agente
  ├── pipeline-plan.py  →  SPEC-001.md (este arquivo)
  ├── queue-control.sh  →  sub-pipeline-001.json (chunk 1/3)
  ├── [executa, renova contexto]
  ├── queue-control.sh  →  sub-pipeline-002.json (chunk 2/3)
  ├── [executa, renova contexto]
  ├── ...
  ├── queue-control.sh  →  sub-pipeline-003.json (chunk 3/3)
  ├── [executa, renova contexto]
  └── review inline → destrói SPEC
```

## Chunk Manifest

| Chunk | Tarefas | Tipos |
|-------|---------|-------|
| `001` | 5 | zfs_snapshot, terminal, terminal, terminal, terminal |
| `002` | 5 | terminal, terminal, terminal, terminal, terminal |
| `003` | 1 | assert |

## State File

Checkpoint: `/tmp/pipeline-checkpoint.json`

```json
{
  "spec": "SPEC-001",
  "chunk_index": 1,
  "total_chunks": 3,
  "status": "running"
}
```

## Auto-Destruição

- Cada sub-pipeline é destruído (`shred -u`) após execução do chunk
- SPEC.md destruído após review final
- Estado de falha salvo em `/tmp/pipeline.failed.json`

## Chunks

### Chunk 001

- `snap-pre` — zfs_snapshot (`zfs_snapshot`)
- `docker-sock-remove` — Ver bind atual do docker.sock (`terminal`)
- `gitea-stop` — Parar gitea-runner antes de修改 (`terminal`)
- `gitea-rm` — Remover container antigo (`terminal`)
- `gitea-run-secure` — Recriar gitea-runner SEM privileged, SEM SYS_ADMIN, SEM docker.sock (`terminal`)

### Chunk 002

- `gitea-verify` — Verificar que gitea-runner está a correr (`terminal`)
- `keycloak-pull` — Pull nova imagem Keycloak (`terminal`)
- `keycloak-stop` — Parar Keycloak antigo (`terminal`)
- `keycloak-rm` — Remover Keycloak antigo (`terminal`)
- `keycloak-start` — Start Keycloak novo (dev mode) (`terminal`)

### Chunk 003

- `keycloak-verify` — assert (`assert`)

