# VIBE-KIT CONCURRENCY AUDIT — 2026-04

## Problema Identificado

- `mark_task_done` em `scripts/vibe/vibe-kit.sh` usava `jq` para escrever `queue.json` sem lock
- `claim_task()` inline em `scripts/vibe/vibe-kit.sh` tinha race condition (leitura + escrita sem atomicidade)
- `claim-task.py` já usava lock, mas `mark_task_done` não o usava
- Launcher usava `pgrep` que é frágil para detectar processos

## Solução Implementada

### 1. queue-manager.py (novo)

Módulo Python com 3 operações todas usando `fcntl.flock`:

- **claim** `<worker_id>` — Atomic task claim. Usa LOCK_EX exclusivo.
- **complete** `<task_id> <worker_id> <result>` — Atomic task completion. Usa LOCK_EX.
- **stats** — Estatísticas da fila. Usa LOCK_SH compartilhado.

Todas as escritas usam `tempfile.mkstemp` + `os.replace()` para atomicidade.

### 2. scripts/vibe/vibe-kit.sh

- `get_pending_task()` agora usa `queue-manager.py claim` (fcntl.flock)
- `mark_task_done()` agora usa `queue-manager.py complete` (fcntl.flock)
- Removida escrita direta com `jq` no `mark_task_done`

### 3. scripts/vibe/vibe-kit-launcher.sh

- Substituído `pgrep -f "vibe-kit.sh.*MiniMax"` por flock-based lock em `.launcher.lock`
- Remove dependência frágil de pgrep

### 4. .claude/vibe-kit/vibe-kit.sh (deprecated wrapper)

- Marcado como deprecated (era inline claim_task inseguro)
- Mantém compatibilidade mas não deve ser usado diretamente

## Validações

```bash
bash -n scripts/vibe/vibe-kit.sh          # OK
bash -n scripts/vibe/vibe-kit-launcher.sh  # OK
python3 -m py_compile .claude/vibe-kit/queue-manager.py  # OK
```

## Limites

- Não toca: apps/, packages/, mcps/, docker-compose.yml, .env, workflows, Coolify, systemd, Terraform, Cloudflare, ZFS
- Nenhum deploy executado
- Nenhum comando destrutivo executado