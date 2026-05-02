# SPEC-016: Voice Pipeline Cursor-Loop (Auto-Healer)

**Status:** SPEC
**Created:** 2026-04-09
**Author:** will + Claude Code
**Based on:** CONSOLIDATED-PREVENTION-PLAN.md + 3-agent research

---

## Resumo

Implementar `.sh` — cron automation que executa smoke test, detecta falhas, tenta auto-heal, envia Telegram alerts com screenshot em caso de falha persistente.

**Por que:** 6 incidentes em 2 dias. Pipeline de voz (+ TTS Bridge + wav2vec2 + LiteLLM) precisa de auto-healer autonomo.

---

## Arquitetura

```
CRON (*/5 * * * *)
    │
    ▼
.sh
    │
    ├─► smoke test (pipeline-.sh)
    │         │
    │         ▼
    │     parse results (PASS/FAIL per endpoint)
    │         │
    │         ▼
    │     [ failures > 0 ] ─── YES ──► self-heal attempt
    │         │ NO                          │
    │         ▼                             ▼
    │     [ all PASS ]              Telegram alert
    │         │                   (FAIL + screenshot + RECOVERY PLAN)
    │         ▼
    │     exit 0 (log only)
    │
    └─► report (stdout + optional Telegram)
```

## Componentes

### 1. .sh (orchestrator)

**Local:** `tasks/smoke-tests/.sh`

**Função:**
- Executa `pipeline-.sh` a cada 5 min
- Parseia saída → identifica endpoints com falha
- Para cada falha, tenta auto-heal (restart container, retry route)
- Se heal falha → Telegram alert com screenshot
- Log estruturado em `/srv/monorepo/logs//`

**Auto-heal rules (da CONSOLIDATED-PREVENTION-PLAN):**

| Failure | Heal Action |
|---------|-------------|
| TTS Bridge DOWN | `docker start zappro-tts-bridge` |
| | `docker restart 6771lt8l7x8rqx72f` |
| wav2vec2 DOWN | `docker restart wav2vec2` |
| LiteLLM DOWN | `docker restart zappro-litellm` |
| Network isolation | Alert only (requer intervenção) |
| Route unreacheable | Alert only (requer intervenção) |

**Não tentar heal:**
- Config schema stripping (requer env var, não container restart)
- Auth/token expiry (requer intervencao manual)
- GitOps gap (DNS UP mas container não deployado)

### 2. 2e-telegram.sh (lightweight E2E)

**Local:** `tasks/smoke-tests/2e-telegram.sh`

**Função:**
- Teste leve Telegram-only (sem LiteLLM auth)
- Envia mensagem de status para TEST_CHAT_ID
- Usa `TEST_CHAT_ID` do (`TELEGRAM_CHAT_ID`)
- Executa em 15s, não 60s

### 3. Screenshot + Description (no cursor-loop)

**O cursor-loop do cursor usa:**
- `/img` skill → LLaVA analysis de tela do Telegram
- mas aqui no loop não temos cursor
- **Solução:** `.sh` faz apenas `echo "FAIL: $FAILED_ENDPOINTS"` e envía log por Telegram

---

## Falha Matrix (do CONSOLIDATED-PREVENTION-PLAN)

| Root Cause | Heal? | Alert? |
|-----------|-------|--------|
| Docker bridge TCP isolation | ❌ Alert | ✅ Alert |
| Container DOWN | ✅ Restart | ✅ Alert after 3 fails |
| TTS Bridge DOWN | ✅ Start | ✅ Alert after 2 fails |
| Config schema stripping | ❌ Manual | ✅ Alert |
| Token/auth expiry | ❌ Manual | ✅ Alert |
| Health check gap | ✅ Alert | ✅ Alert |

---

## Cron

```bash
# Every 5 minutes
*/5 * * * * /srv/monorepo/tasks/smoke-tests/.sh >> /srv/monorepo/logs//loop.log 2>&1
```

---

## Dependencias

- `pipeline-.sh` (já existe)
- (já configurado)
- `TELEGRAM_BOT_TOKEN` + `TEST_CHAT_ID` no environment ou 
- Docker network compartilhada (`qgtzrmi6771lt8l7x8rqx72f`)

---

## Acceptance Criteria

| # | Critério | Verificação |
|---|----------|-------------|
| AC-1 | Loop executa a cada 5 min | `crontab -l | grep ` |
| AC-2 | Smoke test 18/18 passa em steady state | Run manual |
| AC-3 | Falha TTS Bridge → auto-restart | Kill + watch |
| AC-4 | Falha persistente → Telegram alert | Simulate failure |
| AC-5 | Logs em `/srv/monorepo/logs//` | `ls -la logs//` |
| AC-6 | Loop não interfere com serviços normais | Verificar após 1h |

---

## References

- `docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md`
- `tasks/smoke-tests/pipeline-.sh`
- `docs/specflow/SPEC-014-.md`
- `.claude/rules/.md`

---

**Data:** 2026-04-09
