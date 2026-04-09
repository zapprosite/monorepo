# Plan: Retry Loop com Auto-Recovery

**Date:** 2026-04-09
**Author:** will
**Status:** PROPOSED
**Spec Ref:** docs/specflow/SPEC-RETRY-LOOP.md (pending creation)

---

## Context

Pipeline runner atual não tem retry. Quando falha, para e espera intervenção humana manual. O objetivo é:
1. **Auto-retry** até 3x antes de bloquear
2. **Auto-fix** tenta corrigir automaticamente antes do retry
3. **Watcher** em background monitora estado e notifica via Telegram
4. **Unblock** script para retomada limpa após intervenção humana

---

## Dependency Graph

```
pipeline-runner.sh (retry logic)
    │
    ├── auto-fix.sh (tentativas de correção)
    │
    ├── pipeline-state.json (retryCount, retryHistory, humanGateRequired)
    │
    ├── pipeline-watcher.sh (background monitor)
    │       │
    │       └── Telegram notification (se configurado)
    │
    └── unblock.sh (retomada pós-intervenção)
            │
            └── cursor-loop-leader.md (retry awareness)
```

---

## Tasks

### Task 1: Atualizar pipeline-state.json schema

**File:** `tasks/pipeline-state.json`

**Change:** Adicionar campos de retry:
```json
{
  "version": "2.0",
  "currentState": "IDLE",
  "currentTask": null,
  "lastCheckpoint": null,
  "iterationCount": 0,
  "maxIterations": 10,
  "retryCount": 0,
  "maxRetries": 3,
  "testsPassed": false,
  "lintPassed": false,
  "readyToShip": false,
  "blockedReason": null,
  "blockedAt": null,
  "humanGateRequired": false,
  "humanGateReason": null,
  "notificationSent": false,
  "pendingTasks": [],
  "completedTasks": [],
  "failedTasks": [],
  "retryHistory": []
}
```

**Acceptance:** `jq '.' tasks/pipeline-state.json` retorna JSON válido com novos campos
**Verify:** `jq '.retryCount, .maxRetries, .humanGateRequired' tasks/pipeline-state.json`

---

### Task 2: Reescrever pipeline-runner.sh com retry

**File:** `scripts/pipeline-runner.sh`

**Logic:**
- `MAX_RETRIES=3` por step
- `increment_retry()` após cada falha
- `block_for_human()` após 3 falhas
- `auto-fix.sh` chamado antes do retry (se TEST falhar)
- Telegram notification se `TELEGRAM_BOT_TOKEN` configurado

**Functions:**
```bash
update_state()       # Atualiza currentState no JSON
increment_retry()  # Incrementa retryCount, adiciona ao retryHistory
block_for_human()   # Marca BLOCKED_HUMAN_REQUIRED, notifica Telegram
run_step()         # Executa step com retry loop
```

**Acceptance:** `./scripts/pipeline-runner.sh` executa lint → test e bloqueia após 3 falhas
**Verify:** `grep MAX_RETRIES scripts/pipeline-runner.sh` → `MAX_RETRIES=3`

---

### Task 3: Criar auto-fix.sh

**File:** `scripts/auto-fix.sh`

**Logic:**
1. `pnpm turbo lint -- --fix`
2. `pnpm turbo typecheck`
3. `pnpm turbo clean` (limpa cache)

**Acceptance:** Arquivo existe e `chmod +x`
**Verify:** `[ -x scripts/auto-fix.sh ] && echo "OK"`

---

### Task 4: Criar pipeline-watcher.sh

**File:** `scripts/pipeline-watcher.sh`

**Logic:**
- Loop infinito com `CHECK_INTERVAL=10`
- Monitora `humanGateRequired` no state
- Envia Telegram se bloqueado e `notificationSent=false`
- Atualiza `notificationSent=true` após envio

**Acceptance:** Daemon inicia e monitora sem bloquear terminal
**Verify:** `nohup bash scripts/pipeline-watcher.sh &` → processo rodando

---

### Task 5: Criar unblock.sh

**File:** `scripts/unblock.sh`

**Logic:**
- Reseta estado para IDLE
- Limpa `retryCount`, `retryHistory`
- Reseta `humanGateRequired`, `blockedReason`
- Aceita razão da resolução como argumento

**Acceptance:** Após executar, state volta para IDLE
**Verify:** `bash scripts/unblock.sh "teste" && jq '.currentState' tasks/pipeline-state.json` → `"IDLE"`

---

### Task 6: Atualizar cursor-loop-leader.md

**File:** `.claude/agents/cursor-loop-leader.md`

**Add Section (após "Fonte de Verdade"):**
```markdown
## Retry e Recovery

Antes de cada ciclo verificar em tasks/pipeline-state.json:

- currentState = "BLOCKED_HUMAN_REQUIRED"
  → PARAR. Executar: bash scripts/unblock.sh
  
- retryCount >= maxRetries
  → Aguardar scripts/unblock.sh
  
- currentState = "IDLE"
  → Ciclo normal
```

**Acceptance:** Leader para se BLOCKED_HUMAN_REQUIRED
**Verify:** `grep -A5 "Retry e Recovery" .claude/agents/cursor-loop-leader.md`

---

### Task 7: Adicionar TELEGRAM vars ao .env.example

**File:** `.env.example`

**Append:**
```bash
# Pipeline notifications (opcional)
# TELEGRAM_BOT_TOKEN=seu_bot_token_aqui
# TELEGRAM_CHAT_ID=seu_chat_id_aqui
```

**Acceptance:** Variáveis documentadas
**Verify:** `grep TELEGRAM .env.example`

---

### Task 8: Criar failure-report.yml

**File:** `.gitea/workflows/failure-report.yml`

**Logic:**
- Trigger on CI workflow failure
- Gera summary no GitHub
- Envia Telegram se configurado

**Acceptance:** Workflow existe e é válido
**Verify:** `cat .gitea/workflows/failure-report.yml | head -10`

---

## Verification

| Check | Command | Expected |
|-------|---------|----------|
| State schema v2 | `jq '.version' tasks/pipeline-state.json` | `"2.0"` |
| Retry count | `jq '.retryCount' tasks/pipeline-state.json` | `0` |
| Max retries | `grep MAX_RETRIES scripts/pipeline-runner.sh` | `MAX_RETRIES=3` |
| auto-fix exists | `[ -f scripts/auto-fix.sh ]` | true |
| watcher exists | `[ -f scripts/pipeline-watcher.sh ]` | true |
| unblock exists | `[ -f scripts/unblock.sh ]` | true |
| Leader has retry | `grep "Retry e Recovery" .claude/agents/cursor-loop-leader.md` | found |
| Telegram in .env | `grep TELEGRAM .env.example` | found |

---

## Checkpoints

| Checkpoint | Gate | Condição |
|------------|------|----------|
| Post-Task 1 | Schema válido | `jq . tasks/pipeline-state.json` sem erro |
| Post-Task 2 | Retry funciona | Testar com `exit 1` forçado |
| Post-Task 5 | Unblock funciona | State reseta para IDLE |
| Post-Task 6 | Leader para | Verifica state antes de executar |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Retry infinito | Loop perigoso | maxRetries=3 hardcap |
| Telegram token inválido | Notification falha | `|| true` não bloqueia |
| State corrupto | Pipeline para | jq validation antes de update |

---

## Next Step

Após aprovar: executar Tasks 1-8 em ordem. Commits atômicos por task.
