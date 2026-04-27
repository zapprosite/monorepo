# VIBE-KIT CONCURRENCY AUDIT — 2026-04

## Problema Identificado

- `mark_task_done` em `scripts/vibe/vibe-kit.sh` usava `jq` para escrever `queue.json` sem lock
- `claim_task()` inline em `scripts/vibe/vibe-kit.sh` tinha race condition (leitura + escrita sem atomicidade)
- `claim-task.py` já usava lock, mas `mark_task_done` não o usava
- Launcher usava `pgrep` que é frágil para detectar processos
- `.claude/vibe-kit/vibe-kit.sh` (deprecated wrapper) ainda tinha inline claim_task sem lock — P0

## Solução Implementada

### 1. queue-manager.py (novo)

Módulo Python com 3 operações todas usando `fcntl.flock`:

- **claim** `<worker_id>` — Atomic task claim. Usa LOCK_EX exclusivo.
- **complete** `<task_id> <worker_id> <result>` — Atomic task completion com validação de owner. Usa LOCK_EX.
- **stats** — Estatísticas da fila. Usa LOCK_SH compartilhado.

Todas as escritas usam `tempfile.mkstemp` + `os.replace()` para atomicidade.

### 2. scripts/vibe/vibe-kit.sh

- `get_pending_task()` agora usa `queue-manager.py claim` (fcntl.flock)
- `mark_task_done()` agora usa `queue-manager.py complete` (fcntl.flock)
- Removida escrita direta com `jq` no `mark_task_done`

### 3. scripts/vibe/vibe-kit-launcher.sh

- Substituído `pgrep -f "vibe-kit.sh.*MiniMax"` por flock-based lock em `.launcher.lock`
- Remove dependência frágil de pgrep

### 4. .claude/vibe-kit/vibe-kit.sh (P0 FIX — 2026-04-27)

**P0 FIXED.** O runner ativo (chamado pelo cron-launcher) foi corrigido:

- `claim_task()` agora usa `queue-manager.py claim` (fcntl.flock + os.replace)
- `mark_done()` agora usa `queue-manager.py complete` (fcntl.flock + validação owner)
- `heal_stale_workers()` agora é read-only (log only, sem escrita)
- `queue_stats()` agora usa `queue-manager.py stats` (LOCK_SH)
- `PENDING_COUNT`/`RUNNING_COUNT` extraídos do stats (sem leitura redundante)
- `MAX_WORKERS` default: 20 → 15
- `effective_max` agora respeita `parallel_limit` da queue (capped ao menor de MAX_WORKERS ou parallel_limit)
- Não há mais nenhuma escrita direta em queue.json

### 5. Stress Test

Script: `.claude/vibe-kit/stress-test-queue.sh`

Valida:
- 20 workers paralelos, 100 tasks — nenhuma task duplicada
- pending + running + done + failed = total (consistência)
- JSON não corrompe sob carga
- Worker errado (WorkerB) não consegue complete de task owned by WorkerA

**Resultados (2026-04-27):**
```
Duplicate claims test:  PASS
JSON integrity test:    PASS
Ownership rejection:    PASS
ALL TESTS PASSED
```

## Validações

```bash
bash -n .claude/vibe-kit/vibe-kit.sh                          # OK
bash -n scripts/vibe/vibe-kit.sh                              # OK
python3 -m py_compile .claude/vibe-kit/queue-manager.py      # OK
bash .claude/vibe-kit/stress-test-queue.sh                   # ALL PASS
```

## Limites

- Não toca: apps/, packages/, mcps/, docker-compose.yml, .env, workflows, Coolify, systemd, Terraform, Cloudflare, ZFS
- Nenhum deploy executado
- Nenhum comando destrutivo executado

## Próximos Passos (P2)

- 20 workers só devem ser considerados após stress test formal com 500 RPM rate limit
- Auto-healing de stale tasks precisa ser reimplementado via queue-manager.py (separar heal em read-only detect + separate write operation)