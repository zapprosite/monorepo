# SPEC-PLAN: Vibe Kit — Execução Autônoma CRM-REFRIMIX
**Data:** 2026-04-23
**Autor:** Hermes Agent
**Status:** EXECUTÁVEL
**Executor:** vibe-kit.sh (15× mclaude parallel)
**Duração estimada:** 8 horas

---

## 1. Objetivo

Executar correção autônoma dos 10 bugs P0/P1 do CRM-REFRIMIX usando Vibe Kit
(15 workers mclaude em paralelo), deixando a codebase estável com testes na fila
para execução posterior.

---

## 2. Targets — 10 Bugs do SPEC-OWNERSHIP

| ID | Prioridade | Descrição | Arquivo Alvo |
|----|-----------|-----------|--------------|
| B1 | P0 | 4/5 workflows LangGraph sao fake (sequencial async) | `workflows/` |
| B2 | P0 | Session state in-memory (_sessionStates Map) morre com restart | `conversation_manager.py` |
| B3 | P0 | humanGateNode auto-aprova sem interrupt real | `nodes/` |
| B4 | P0 | content_pipeline edges fixos (sem conditional routing) | `pipelines/` |
| B5 | P0 | ARCHITECTURE.md ERRADO + FIXME IP attack | `ARCHITECTURE.md` |
| B6 | P1 | subscribedAt90PercentUse null check bug (0 e falsy) | `subscriptions/` |
| B7 | P1 | Subscription increment sem transacao (race condition) | `subscriptions/` |
| B8 | P2 | Docs repetem secoes (README.md 4x mesmas secoes) | `README.md` |
| B9 | P1 | 0 tests de integracao real no CRM | `tests/` |
| B10 | P1 | Webhook retry pode falhar silenciosamente | `webhooks/` |

---

## 3. Arquitetura do Vibe Kit

```
SPEC-OWNERSHIP.md
  → parse_spec_to_tasks() extrai 10 bugs
  → queue.json (10 tasks)
      → 15× worker_loop (mclaude headless)
          → atomic queue claim (jq)
          → context snippet por task
          → retry once on failure
          → ZFS snapshot every 3 tasks
      → state.json (sobrevive morte do contexto)
  → smoke tests executados
  → cron mantem workers vivos
  → Gitea PR on completion
```

---

## 4. Pré-condições (já verificadas)

- [x] Mem0 conecta com config via LiteLLM (`embedding-nomic`)
- [x] Qdrant key correta (`QDRANT_API_KEY` presente em `.env`; valor redigido)
- [x] vibe-kit.sh corrigido (544L, syntax OK)
- [x] mclaude headless funciona: `mclaude -p "prompt"`
- [x] 10 bugs extraídas do SPEC-OWNERSHIP

---

## 5. Fila de Execução (queue.json)

```json
{
  "spec": "CRM-REFRIMIX-OWNERSHIP",
  "total": 10,
  "pending": 10,
  "running": 0,
  "done": 0,
  "failed": 0,
  "tasks": [
    {"id": "T001", "name": "bug-B1-langgraph-fake-workflows", "description": "4/5 workflows LangGraph sao fake (sequencial async)", "app": "CRM-REFRIMIX", "spec": "SPEC-OWNERSHIP", "status": "pending"},
    {"id": "T002", "name": "bug-B2-session-state-in-memory", "description": "Session state in-memory (_sessionStates Map) morre com restart", "app": "CRM-REFRIMIX", "spec": "SPEC-OWNERSHIP", "status": "pending"},
    {"id": "T003", "name": "bug-B3-humangatenode-auto-aprova", "description": "humanGateNode auto-aprova sem interrupt real", "app": "CRM-REFRIMIX", "spec": "SPEC-OWNERSHIP", "status": "pending"},
    {"id": "T004", "name": "bug-B4-content-pipeline-edges", "description": "content_pipeline edges fixos (sem conditional routing)", "app": "CRM-REFRIMIX", "spec": "SPEC-OWNERSHIP", "status": "pending"},
    {"id": "T005", "name": "bug-B5-architecture-errado", "description": "ARCHITECTURE.md ERRADO + FIXME IP attack", "app": "CRM-REFRIMIX", "spec": "SPEC-OWNERSHIP", "status": "pending"},
    {"id": "T006", "name": "bug-B6-subscribedat-null-check", "description": "subscribedAt90PercentUse null check bug (0 e falsy)", "app": "CRM-REFRIMIX", "spec": "SPEC-OWNERSHIP", "status": "pending"},
    {"id": "T007", "name": "bug-B7-subscription-race-condition", "description": "Subscription increment sem transacao (race condition)", "app": "CRM-REFRIMIX", "spec": "SPEC-OWNERSHIP", "status": "pending"},
    {"id": "T008", "name": "bug-B8-readme-duplicated-sections", "description": "Docs repetem secoes (README.md 4x mesmas secoes)", "app": "CRM-REFRIMIX", "spec": "SPEC-OWNERSHIP", "status": "pending"},
    {"id": "T009", "name": "bug-B9-zero-integration-tests", "description": "0 tests de integracao real no CRM", "app": "CRM-REFRIMIX", "spec": "SPEC-OWNERSHIP", "status": "pending"},
    {"id": "T010", "name": "bug-B10-webhook-retry-opaco", "description": "Webhook retry pode falhar silenciosamente", "app": "CRM-REFRIMIX", "spec": "SPEC-OWNERSHIP", "status": "pending"}
  ]
}
```

---

## 6. Testes a Criar (deixar na fila)

### 6.1 Smoke Tests (executar após cada bug fix)
```
tests/smoke/
  test_workflow_langgraph.py      # B1: verifica StateGraph real
  test_session_persistence.py     # B2: verifica Qdrant session survives restart
  test_human_interrupt.py         # B3: verifica interrupt() real
  test_content_pipeline_routing.py # B4: verifica conditional edges
  test_subscription_null_check.py # B6: verifica 0 nao e falsy
  test_subscription_transaction.py # B7: verifica transacao DB
  test_webhook_retry.py           # B10: verifica retry + DLQ
```

### 6.2 Integration Tests (executar após todos os bugs)
```
tests/integration/
  test_crm_full_flow.py            # B9: teste de integracao real
  test_onboarding_pipeline.py      # workflow real
  test_content_pipeline.py         # pipeline real
```

---

## 7. Cronjobs Autônomos

### 7.1 Execução Vibe Kit (a cada 5 min)
```cron
*/5 * * * * cd /srv/monorepo && VIBE_DIR=/srv/monorepo/.claude/vibe-kit MONOREPO_DIR=/srv/monorepo VIBE_PARALLEL=15 VIBE_HOURS=8 bash /srv/monorepo/scripts/vibe/vibe-kit.sh >> /srv/monorepo/.claude/vibe-kit/cron.log 2>&1
```
**Nota:** O script detecta se já está rodando (PID lock) e não relança.

### 7.2 Verificação de Saúde (a cada 5 min)
```cron
*/5 * * * * bash /srv/monorepo/scripts/daily-health-check.sh >> /srv/monorepo/.claude/vibe-kit/health.log 2>&1
```

### 7.3 ZFS Snapshot (a cada 30 min se workers ativos)
```cron
*/30 * * * * if pgrep -f "mclaude.*MiniMax-M2.7" > /dev/null; then zfs snapshot -r tank@ vibe-$(date +\%Y\%m\%d-\%H\%M\%S)-crm; fi
```

### 7.4 Monitoramento Progresso (a cada 15 min)
```cron
*/15 * * * * cat /srv/monorepo/.claude/vibe-kit/queue.json 2>/dev/null | jq '{done: .done, failed: .failed, pending: .pending, running: .running}' >> /srv/monorepo/.claude/vibe-kit/progress.log 2>&1
```

---

## 8. Fluxo de Execução Completo

```
T+0min   → ZFS snapshot pre-vibe
T+0-5min → 15 workers launched, claim tasks from queue
T+5min   → Health check, log progress
T+15min  → First tasks complete, ZFS snapshot checkpoint
T+30min  → ZFS snapshot, progress report
T+60min  → Continue until queue empty or 8h
T+8h     → Gitea PR or report
```

---

## 9. Comandos de Verificação

```bash
# Ver queue
cat /srv/monorepo/.claude/vibe-kit/queue.json | jq '.done, .failed, .pending'

# Ver logs
tail -f /srv/monorepo/.claude/vibe-kit/logs/worker-01.log

# Progresso
watch -n30 "cat /srv/monorepo/.claude/vibe-kit/queue.json | jq '.done/.total'"

# Ver se mclaude esta rodando
pgrep -fa "mclaude.*MiniMax"

# Ver ZFS snapshots
zfs list -t snapshot | grep vibe

# Simular teste
VIBE_DIR=/srv/monorepo/.claude/vibe-kit MONOREPO_DIR=/srv/monorepo SPEC=CRM-REFRIMIX-OWNERSHIP APP=CRM-REFRIMIX bash /srv/monorepo/scripts/vibe/vibe-kit.sh --dry-run
```

---

## 10. Riscos e Mitigações

| Risco | Mitigação |
|-------|-----------|
| mclaude rate limit | 1 task per worker, 3 retry circuit breaker |
| Mem0 full collection | Purge old entries before start |
| Context window | Max 80 turns per mclaude, /clear automatic |
| Worker crash | Queue state persists, next worker picks up |
| ZFS space | Check before start, keep only last 10 snapshots |
| Gitea API fail | Retry 3x, then manual PR |

---

## 11. Estado Final Esperado

- [ ] 10 bugs corrigidos (B1-B10)
- [ ] Smoke tests criados (7 testes)
- [ ] Integration tests criados (3 testes)
- [ ] Cronjobs ativos
- [ ] Gitea PR criado (se done >= 7) ou relatório de falhas
- [ ] Mem0 atualizado com fatos da execução
