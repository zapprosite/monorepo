---
name: voice-pipeline-watchdog
description: Voice Pipeline Watchdog — cron-based smoke test and auto-healer for TTS Bridge, OpenClaw, and wav2vec2
status: operational
priority: critical
author: will-zappro
date: 2026-04-12
---

# Skill: voice-pipeline-watchdog

The voice-pipeline watchdog is a cron-triggered smoke test and auto-healer that monitors the voice pipeline (TTS Bridge, OpenClaw, wav2vec2) every 5 minutes, self-heals recoverable failures, and sends Telegram alerts on persistent issues.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Script | `tasks/smoke-tests/voice-pipeline-loop.sh` |
| Cron | `*/5 * * * *` (every 5 minutes) |
| Log Dir | `/srv/monorepo/logs/voice-pipeline` |
| Smoke Script | `tasks/smoke-tests/pipeline-openclaw-voice.sh` |

---

## What It Checks

| Step | Endpoint | Check |
|------|----------|-------|
| 1.0 | TTS Bridge `:8013` | `GET /health` — returns allowed voices list |
| 2.1 | wav2vec2 `:8201` | `GET /v1/listen` — STT transcription endpoint |
| 3.0 | TTS Bridge `:8013` | `POST /v1/audio/speech` — TTS synthesis |
| 3.1 | TTS pm_santa voice | `POST /v1/audio/speech` with `pm_santa` |
| 5.x | LiteLLM endpoints | Vision + embeddings |
| OpenClaw container | `openclaw-qgtzrmi6771lt8l7x8rqx72f` | Container is Up |

---

## Auto-Heal Logic

The watchdog attempts self-healing for these failure modes:

| Failure Detected | Action |
|-----------------|--------|
| TTS Bridge container DOWN | `docker start zappro-tts-bridge` |
| OpenClaw container DOWN | `docker restart openclaw-qgtzrmi...` |
| wav2vec2 container DOWN | `docker restart wav2vec2` |
| LiteLLM container DOWN | `docker restart zappro-litellm` |

If a self-heal succeeds, the watchdog re-runs the smoke test after 15s. If tests pass, the loop resets counters and exits silently.

---

## Rate Limits

| Parameter | Value |
|-----------|-------|
| Max restart attempts per container | 3 |
| Alert threshold (consecutive failures) | 3 |
| Cooldown between alerts | Suppressed until 3 consecutive failures |

After 3 failed smoke tests with no resolution, a Telegram alert is sent with:
- Failed endpoints
- Container restart commands
- Log path for manual investigation

---

## Silent Degradation Detection

The watchdog detects silent degradation via:

1. **GPU memory threshold**: Monitors GPU memory usage during inference
2. **Request timeout watchdog**: If a smoke test request times out, marks endpoint as degraded
3. **Config schema stripping**: Detects when TTS returns valid health but fails synthesis (indicates config issue)

---

## Check Status

```bash
# Is the cron active?
crontab -l | grep voice-pipeline

# Recent watchdog runs
tail -50 /srv/monorepo/logs/voice-pipeline/loop.log

# Recent smoke test results
tail -100 /srv/monorepo/logs/voice-pipeline/smoke.log.$(date '+%Y%m%d')
```

---

## Manual Trigger

```bash
# Run the watchdog manually
bash /srv/monorepo/tasks/smoke-tests/voice-pipeline-loop.sh

# Run smoke test only (no heal)
bash /srv/monorepo/tasks/smoke-tests/pipeline-openclaw-voice.sh
```

---

## Alert Message Format

When smoke test fails 3 consecutive times:

```
🔴 Voice Pipeline ALERT

❌ N tests failed (X/Y passed)

📋 Failed endpoints:
  • TTS Bridge :8013
  • wav2vec2 :8201

🔧 Recovery Plan:
1. docker ps | grep -E 'openclaw|tts|wav2vec2|litellm'
2. docker logs <container-name> --tail 50
3. docker start zappro-tts-bridge
4. docker restart openclaw-qgtzrmi6771lt8l7x8rqx72f
5. Check OPENAI_TTS_BASE_URL in Coolify

📂 Logs: tail -100 /srv/monorepo/logs/voice-pipeline/smoke.log.YYYYMMDD

⏱️ Auto-healer will retry in 5 min
```

---

## Counters File

The watchdog stores persistent counters in:
`/srv/monorepo/logs/voice-pipeline/.heal_counters.json`

```json
{
  "restart_attempts": {
    "tts-bridge": 1,
    "openclaw": 0,
    "wav2vec2": 2
  },
  "alert_count": {
    "overall": 1
  }
}
```

Counters reset when a full smoke test passes (steady state).

---

## Related Skills

- `container-self-healer.md` — manual restart procedure
- `tts-bridge.md` — TTS Bridge documentation
- `wav2vec2-proxy.md` — wav2vec2 STT documentation
- `incident-runbook.md` — structured incident response
