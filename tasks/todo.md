# TODO: Retry Loop com Auto-Recovery

**Generated:** 2026-04-09
**Plan:** tasks/plan.md
**Status:** PENDING — awaiting human review

---

## Task 1: Atualizar pipeline-state.json schema

**File:** `tasks/pipeline-state.json`

- [ ] **[T-RS-1]** Adicionar campos: retryCount, maxRetries, retryHistory, humanGateRequired, blockedReason, notificationSent

**Verification:** `jq '.retryCount, .maxRetries, .humanGateRequired' tasks/pipeline-state.json`

---

## Task 2: Reescrever pipeline-runner.sh com retry

**File:** `scripts/pipeline-runner.sh`

- [ ] **[T-RR-1]** Implementar MAX_RETRIES=3
- [ ] **[T-RR-2]** Implementar increment_retry()
- [ ] **[T-RR-3]** Implementar block_for_human() com Telegram
- [ ] **[T-RR-4]** Implementar run_step() com retry loop
- [ ] **[T-RR-5]** Chamar auto-fix.sh antes de retry (se TEST falhar)

**Verification:** `grep MAX_RETRIES scripts/pipeline-runner.sh` → `MAX_RETRIES=3`

---

## Task 3: Criar auto-fix.sh

**File:** `scripts/auto-fix.sh`

- [ ] **[T-AF-1]** `pnpm turbo lint -- --fix`
- [ ] **[T-AF-2]** `pnpm turbo typecheck`
- [ ] **[T-AF-3]** `pnpm turbo clean`

**Verification:** `[ -x scripts/auto-fix.sh ] && echo "OK"`

---

## Task 4: Criar pipeline-watcher.sh

**File:** `scripts/pipeline-watcher.sh`

- [ ] **[T-PW-1]** Loop com CHECK_INTERVAL=10
- [ ] **[T-PW-2]** Monitora humanGateRequired
- [ ] **[T-PW-3]** Envia Telegram notification
- [ ] **[T-PW-4]** Atualiza notificationSent=true

**Verification:** `nohup bash scripts/pipeline-watcher.sh &` → processo rodando

---

## Task 5: Criar unblock.sh

**File:** `scripts/unblock.sh`

- [ ] **[T-UB-1]** Reseta currentState para IDLE
- [ ] **[T-UB-2]** Limpa retryCount, retryHistory
- [ ] **[T-UB-3]** Reseta humanGateRequired, blockedReason
- [ ] **[T-UB-4]** Aceita razão como argumento

**Verification:** `bash scripts/unblock.sh "teste" && jq '.currentState' tasks/pipeline-state.json` → `"IDLE"`

---

## Task 6: Atualizar cursor-loop-leader.md

**File:** `.claude/agents/cursor-loop-leader.md`

- [ ] **[T-LR-1]** Adicionar seção "Retry e Recovery" após "Fonte de Verdade"
- [ ] **[T-LR-2]** Leader para se BLOCKED_HUMAN_REQUIRED
- [ ] **[T-LR-3]** Leader verifica retryCount antes de continuar

**Verification:** `grep -A5 "Retry e Recovery" .claude/agents/cursor-loop-leader.md`

---

## Task 7: Adicionar TELEGRAM vars ao .env.example

**File:** `.env.example`

- [ ] **[T-TV-1]** TELEGRAM_BOT_TOKEN comentado
- [ ] **[T-TV-2]** TELEGRAM_CHAT_ID comentado

**Verification:** `grep TELEGRAM .env.example`

---

## Task 8: Criar failure-report.yml

**File:** `.gitea/workflows/failure-report.yml`

- [ ] **[T-FR-1]** Trigger on CI workflow failure
- [ ] **[T-FR-2]** Gera GitHub summary
- [ ] **[T-FR-3]** Envia Telegram se configurado

**Verification:** `cat .gitea/workflows/failure-report.yml | head -15`

---

## Dependencies

```
Task 1 → Task 2 → Task 3 → Task 4 → Task 5 → Task 6 → Task 7 → Task 8
```

---

## Stats

| # | Task | Priority |
|---|------|----------|
| 1 | pipeline-state.json schema | HIGH |
| 2 | pipeline-runner.sh retry | CRITICAL |
| 3 | auto-fix.sh | HIGH |
| 4 | pipeline-watcher.sh | MEDIUM |
| 5 | unblock.sh | HIGH |
| 6 | cursor-loop-leader retry | CRITICAL |
| 7 | TELEGRAM vars | LOW |
| 8 | failure-report.yml | MEDIUM |

---

## Telegram Credentials (TEST ONLY)

```
BOT_TOKEN: 8707160343:AAEcaP-_eJS9pXxpoYzCGpsTP3j-StC55fE
CHAT_ID: 7220607041
```

⚠️ **NOTA:** Não commit credentials.
