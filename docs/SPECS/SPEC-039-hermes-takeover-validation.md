---
name: SPEC-039-hermes-takeover-validation
description: OPERAÇÃO OVERLORD — Migration validation from OpenClaw to Hermes-Agent
type: validation
created: 2026-04-14
originSessionId: 8f4dc974-c929-4609-80db-7acfce0252e2
---

# SPEC-039: Hermes Takeover Validation Report

**Date:** 2026-04-14
**Operation:** OPERAÇÃO OVERLORD
**Source Branch:** `feature/quantum-helix-done`

---

## 1. BEFORE State (OpenClaw)

| Item                | Value                                                                 |
| ------------------- | --------------------------------------------------------------------- |
| bot.zappro.site     | 10.0.19.7:8080 (OpenClaw) — OFFLINE                                   |
| OpenClaw containers | `openclaw-qgtzrmi6771lt8l7x8rqx72f`, `openclaw-mcp-wrapper` — REMOVED |
| Telegram bot        | @CEO_REFRIMIX_bot — not functional (OpenClaw offline)                 |
| LLM stack           | OpenClaw + LiteLLM proxy                                              |

---

## 2. AFTER State (Hermes)

| Item                     | Value                          | Status                                         |
| ------------------------ | ------------------------------ | ---------------------------------------------- |
| bot.zappro.site          | 502 Bad Gateway                | FAIL — tunnel routing to dead OpenClaw IP      |
| Hermes Gateway PID       | 2047806                        | RUNNING (process active)                       |
| Hermes Gateway port 8642 | Not listening                  | FAIL — api_server not binding                  |
| Telegram bot             | Token: `${TELEGRAM_BOT_TOKEN}` | UNKNOWN — token present, connectivity untested |
| hermes.zappro.site       | Not configured                 | FAIL — CNAME pending                           |
| LLM primary              | MiniMax/MiniMax-M2.7           | CONFIGURED                                     |
| LLM fallback             | Ollama/Qwen3-VL-8B-Instruct    | CONFIGURED                                     |

### Process State (ps aux)

```
will  1917404  mcpo server            :8092  (mcpo wrapper)
will  1917475  hermes mcp serve       : running (MCP server)
will  2047806  hermes gateway run      : running (Gateway, PID 2047806)
```

### Gateway State (gateway_state.json)

```json
{
  "pid": 2047806,
  "kind": "hermes-gateway",
  "gateway_state": "running",
  "platforms": {
    "telegram": {
      "state": "connected",
      "error_code": null,
      "error_message": null
    }
  }
}
```

---

## 3. Migration Steps Executed (from 12 Parallel Agents)

### Phase 1-2 (Commit: `1a864d4d`)

- Hermes-Agent v0.9.0 installation
- `config.yaml` created with MiniMax primary + Ollama fallback
- cadvisor memory increased to 1GB
- deploy-on-green.yml fix applied

### Phase 3 (Commit: `0e8a457b` — 12 parallel agents)

1. Hermes-Agent v0.9.0 installed on Ubuntu Desktop
2. `hermes claw migrate` executed — 21 items migrated (SOUL, memories, 18 skills)
3. `config.yaml` finalized — LLM config with environment-only secrets
4. `coolify_sre` skill created — `sre-monitor.sh` + SKILL.md
5. `perplexity_browser` skill created
6. OpenClaw containers removed (`openclaw-qgtzrmi6771lt8l7x8rqx72f`, `openclaw-mcp-wrapper`)
7. Telegram bot token migrated to `~/.hermes/.env`
8. `hermes.json` cron jobs configured — 15 jobs
9. Gateway PID/state files created
10. Channel directory configured
11. Skills directory setup (`~/.hermes/skills/`, `~/.hermes/skills/openclaw-imports/`)
12. hermes.zappro.site CNAME not yet configured

---

## 4. Success Criteria Verification

| Criterion                    | Expected          | Actual          | Pass/Fail    |
| ---------------------------- | ----------------- | --------------- | ------------ |
| Hermes-Agent installed       | v0.9.0            | v0.9.0          | PASS         |
| hermes claw migrate executed | 21 items          | 21 items        | PASS         |
| OpenClaw containers removed  | Gone              | Confirmed       | PASS         |
| Hermes gateway running       | PID active        | PID 2047806     | PASS         |
| Telegram bot token present   | In .env           | Present         | PASS         |
| bot.zappro.site accessible   | 200 OK            | 502 Bad Gateway | FAIL         |
| Hermes listening on :8642    | Port open         | Not listening   | FAIL         |
| hermes.zappro.site CNAME     | Configured        | Not configured  | FAIL         |
| Telegram bot functional      | @CEO_REFRIMIX_bot | UNKNOWN         | INCONCLUSIVE |

---

## 5. Remaining Issues / Follow-Up Actions

### CRITICAL — bot.zappro.site 502

**Root cause:** Cloudflare tunnel routes to `10.0.19.7:8080` (old OpenClaw IP) which is now offline. Hermes gateway is running but NOT listening on port 8642.

**Fix required:**

1. Start Hermes gateway with port binding — verify `hermes gateway run` actually listens on :8642
2. Update Cloudflare tunnel to route `bot.zappro.site` → `10.0.5.2:8642`
3. Update SUBDOMAINS.md if routing changes

### HIGH — Hermes Gateway Not Listening on :8642

The Hermes gateway process (PID 2047806) is running but `ss -tlnp | grep 8642` shows nothing listening.

**Diagnosis:** Gateway may be running in polling mode without API server binding.

**Fix required:**

1. Check `hermes gateway logs` for binding errors
2. Verify `api_server.enabled: true` and `port: 8642` in config.yaml
3. Restart gateway if needed

### MEDIUM — hermes.zappro.site CNAME Not Configured

**Fix required:**

1. Create CNAME record in Cloudflare → tunnel
2. Update SUBDOMAINS.md with new subdomain entry

### LOW — Telegram Bot Connectivity Untested

The token `${TELEGRAM_BOT_TOKEN}` is present but bot functionality was not tested via `getMe` API call.

**Fix required:**

1. Run `curl https://api.telegram.org/bot<token>/getMe` to verify
2. Send test message to confirm bidirectional communication

---

## 6. Migration Completeness Summary

| Component                        | Status                         |
| -------------------------------- | ------------------------------ |
| Hermes-Agent installation        | COMPLETE                       |
| OpenClaw shutdown                | COMPLETE                       |
| SOUL/memories migration          | COMPLETE                       |
| Skills migration (18 skills)     | COMPLETE                       |
| LLM configuration                | CONFIGURED                     |
| Telegram bot token               | MIGRATED                       |
| Cron jobs (15)                   | CONFIGURED                     |
| Gateway process                  | RUNNING                        |
| Tunnel routing (bot.zappro.site) | INCOMPLETE — routes to dead IP |
| hermes.zappro.site CNAME         | PENDING                        |
| Telegram functional test         | PENDING                        |

**Overall Status:** Infrastructure ready — routing incomplete. Hermes gateway needs port binding fix before bot.zappro.site can serve traffic.

---

## 7. Next Actions (Priority Order)

1. **[IMMEDIATE]** Fix Hermes gateway port binding — ensure :8642 is listening
2. **[IMMEDIATE]** Update Cloudflare tunnel routing for bot.zappro.site → 10.0.5.2:8642
3. **[HIGH]** Verify Telegram bot connectivity via API call
4. **[MEDIUM]** Configure hermes.zappro.site CNAME record
5. **[LOW]** Update SUBDOMAINS.md with current state

---

_Generated: 2026-04-14_
_Session: 8f4dc974-c929-4609-80db-7acfce0252e2_
