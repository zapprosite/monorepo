# Voice Pipeline Cursor-Loop — Design

**Data:** 2026-04-09
**Based on:** SPEC-016 + CONSOLIDATED-PREVENTION-PLAN.md

---

## Overview

Autonomous self-healing loop for the OpenClaw voice pipeline. Runs every 5 minutes, executes smoke test, heals recoverable failures, alerts via Telegram on persistent issues.

## Architecture

```
*/5 * * * *  cron
    │
    ▼
voice-pipeline-loop.sh
    ├─► bash pipeline-openclaw-voice.sh
    │         │
    │         ▼
    │     parse PASS/FAIL per endpoint
    │         │
    │         ▼
    │     [ failures == 0 ] ──► reset counters, exit 0
    │         │
    │         ▼
    │     [ healable? ] ──YES──► restart/start container
    │         │ NO                     │
    │         ▼                        ▼
    │     alert_count++          wait 15s, recheck
    │         │                        │
    │         ▼                        ▼
    │     [ alert_count >= 3 ] ──► Telegram ALERT
    │         │                         │
    │         ▼                         ▼
    │     exit 1                    smoke test again
    │                                    │
    └─► log to /srv/monorepo/logs/voice-pipeline/
```

## Failure Matrix

| Failure | Heal Action | Auto-heal? |
|---------|------------|------------|
| TTS Bridge container DOWN | `docker start zappro-tts-bridge` | ✅ |
| OpenClaw container DOWN | `docker restart openclaw-qgtzrmi6771lt8l7x8rqx72f` | ✅ |
| wav2vec2 container DOWN | `docker restart wav2vec2` | ✅ |
| LiteLLM container DOWN | `docker restart zappro-litellm` | ✅ |
| TTS Bridge UP but pm_santa FAIL | Config issue — alert only | ❌ |
| Network isolation | Alert only | ❌ |
| Auth/token expiry | Alert only | ❌ |

## Alert Suppression

Alert only sent after 3 consecutive failures (alert_count >= 3). Counter resets on successful smoke test (all pass).

## Telegram Alert Content

```
🔴 Voice Pipeline ALERT

❌ N tests failed (X/Y passed)

📋 Failed endpoints:
[list]

🔧 Recovery Plan:
1. docker ps | grep openclaw|tts|wav2vec2|litellm
2. docker logs <container> --tail 50
3. If TTS DOWN: docker start zappro-tts-bridge
4. If OpenClaw DOWN: docker restart openclaw-qgtzrmi6771lt8l7x8rqx72f
5. Check OPENAI_TTS_BASE_URL in Coolify

📂 Logs: tail -100 /srv/monorepo/logs/voice-pipeline/smoke.log.YYYYMMDD
⏱️ Auto-healer will retry in 5 min
```

## Files

| File | Purpose |
|------|---------|
| `tasks/smoke-tests/voice-pipeline-loop.sh` | Orchestrator + auto-healer |
| `tasks/smoke-tests/voice-pipeline-e2e-telegram.sh` | Lightweight Telegram E2E (~15s) |
| `docs/specflow/SPEC-016-voice-pipeline-cursor-loop.md` | SPEC |
| `logs/voice-pipeline/smoke.log.YYYYMMDD` | Daily smoke test log |
| `logs/voice-pipeline/.heal_counters.json` | Persistent counters |

## Cron

```cron
*/5 * * * * /srv/monorepo/tasks/smoke-tests/voice-pipeline-loop.sh >> /srv/monorepo/logs/voice-pipeline/loop.log 2>&1
```

Added to crontab via: `crontab -e`

## Anti-Patterns Addressed

| Anti-Pattern | How Loop Prevents |
|-------------|-------------------|
| Health UP ≠ container UP | Smoke test runs actual endpoint |
| DNS UP ≠ service UP | Smoke test via actual route |
| No auto-healer | Explicit heal logic per failure type |
| Alert fatigue | Suppressed first 2 failures |
| GitOps gap | Smoke test confirms container actually running |

---

**Data:** 2026-04-09
