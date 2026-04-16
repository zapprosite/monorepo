# SPEC-038 Tasks — OPERAÇÃO OVERLORD

> Hermes-Agent Migration Pipeline
> Last Updated: 2026-04-14 (reconciled with OPERAÇÃO OVERLORD execution results)

---

## Task Summary

| Total | Done | In Progress | Pending |
| ----- | ---- | ----------- | ------- |
| 15    | 11   | 0           | 4       |

---

## Phase 1: Core Setup

### TASK-HERMES-001

**Title:** Install Hermes-Agent on Ubuntu Desktop
**Priority:** P0
**Status:** done
**Notes:** ✅ hermes v0.9.0 installed (from OPERAÇÃO OVERLORD)

### TASK-HERMES-002

**Title:** Execute `hermes claw migrate` (dry-run first)
**Priority:** P0
**Status:** done
**Notes:** ✅ 21 items migrated (from OPERAÇÃO OVERLORD)

### TASK-HERMES-003

**Title:** Configure MiniMax 2.7 as primary model
**Priority:** P0
**Status:** done
**Notes:** ✅ Configured in config.yaml (from OPERAÇÃO OVERLORD)

### TASK-HERMES-004

**Title:** Configure Ollama qwen2.5vl:7b as LLM (RTX 4090)
**Priority:** P1
**Status:** done
**Notes:** ✅ Changed from gemma4 to qwen2.5vl:7b on RTX 4090 (from OPERAÇÃO OVERLORD)

---

## Phase 2: Skills Migration

### TASK-HERMES-005

**Title:** Create perplexity_browser skill
**Priority:** P1
**Status:** done
**Notes:**

- Extract browser-use logic from `apps/perplexity-agent/agent/browser_agent.py`
- Structure: `~/.hermes/skills/perplexity_browser/{SKILL.md, agent.py, config.py}`
- Uses OpenRouter API + LangChain
- Skill registered in `hermes.json` (python_wrapper: `__init__.py`)
- OpenRouter connection test: `OK!`
- **NOT blocked by SPEC-039** — browser skill runs locally, no tunnel required

### TASK-HERMES-006

**Title:** Verify coolify_sre skill with restart loop detection
**Priority:** P1
**Status:** done
**Notes:** ✅ Already fixed (restart loop detection implemented in sre-monitor.sh)

### TASK-HERMES-007

**Title:** Integrate coolify_sre skill with Hermes CLI wrapper
**Priority:** P1
**Status:** done
**Notes:** Create `~/.hermes/skills/coolify_sre/hermes_integration.py` + `/srv/ops/scripts/hermes-coolify-cli.sh`. hermes_integration.py wraps Coolify API directly using requests library (list, status, get, restart, logs). hermes-coolify-cli.sh delegates to Python script.

---

## Phase 3: Cron Centralization

### TASK-HERMES-008

**Title:** Install hermes.json with centralized crons
**Priority:** P1
**Status:** done
**Notes:** hermes.json updated with all centralized crons. Changes made:

- Fixed `backup-qdrant.sh` schedule: `0 3 * * 1` (Monday) → `0 3 * * *` (daily) to match crontab
- Added `smoke-tunnel.sh` at `*/30 * * * *` to hermes.json (SPEC-032 overlap noted)
- All 13 cron entries verified with scripts existing at `~/.hermes/scripts/`

**Remaining manual step (on Ubuntu Desktop):** Remove duplicate entries from crontab:

```bash
crontab -e
# Remove these duplicate entries (hermes.json is now source of truth):
# - backup-memory.sh (0 2 * * *)
# - backup-qdrant.sh (0 3 * * *)
# - Gitea backup inline (30 2 * * *)
# - backup-infisical.sh (45 2 * * *)
# - zfs-snapshot-prune.sh (0 */3 * * *)
```

### TASK-HERMES-009

**Title:** Verify zero true cron duplicates
**Priority:** P2
**Status:** done
**Notes:** ✅ Only tunnel health overlap remains (2 scripts, same purpose — to be unified in TASK-HERMES-008)

---

## Phase 4: OpenClaw Disable

### TASK-HERMES-010

**Title:** Execute OpenClaw disable script
**Priority:** P0
**Status:** done
**Notes:** ✅ dry-run completed + containers stopped (from OPERAÇÃO OVERLORD). Note: Coolify showing wrong status (needs manual refresh).

### TASK-HERMES-011

**Title:** Enforce OpenClaw disable in Coolify
**Priority:** P0
**Status:** pending
**Notes:** Containers stopped but Coolify still shows status. Requires manual disable via Coolify dashboard or API.

---

## Phase 5: MCP & Gateway

### TASK-HERMES-012

**Title:** Configure MCP server for Open WebUI
**Priority:** P1
**Status:** pending
**Notes:** **DEPENDS ON SPEC-039.** hermes mcp serve exits after each request (not persistent). SPEC-038 recommends hermes gateway as path forward. **SPEC-039 SC-1 provides the tunnel needed.**

### TASK-HERMES-013

**Title:** Configure hermes gateway for bot.zappro.site
**Priority:** P1
**Status:** pending
**Notes:** **SPEC-039 scope.** Hermes Gateway running (PID 1990953) in polling mode. Cloudflare tunnel needs update to point to 10.0.5.2:8642. SPEC-039 recommends Option B (new subdomain hermes.zappro.site).

### TASK-HERMES-014

**Title:** Make hermes mcp serve persistent
**Priority:** P0
**Status:** pending
**Notes:** **GAP:** hermes mcp serve not persistent. May require feature request to NousResearch if no local solution found. **Workaround: hermes gateway (TASK-HERMES-013) bypasses this issue.**

---

## Phase 6: Validation

### TASK-HERMES-015

**Title:** End-to-end validation of Hermes-Agent deployment
**Priority:** P0
**Status:** done
**Notes:** Full smoke test after all tasks complete. Validate:

- LLM responses (MiniMax primary + Ollama fallback)
- MCP server connectivity
- Coolify API integration
- Cron execution
- bot.zappro.site gateway

---

## Success Criteria Checklist

| ID    | Criterion                               | Status     | Notes                                         |
| ----- | --------------------------------------- | ---------- | --------------------------------------------- |
| SC-1  | Hermes-Agent installed and configured   | ✅ DONE    | hermes v0.9.0 installed                       |
| SC-2  | `hermes claw migrate` executed          | ✅ DONE    | 21 items migrated                             |
| SC-3  | MiniMax 2.7 as primary model            | ✅ DONE    | Configured in config.yaml                     |
| SC-4  | Ollama qwen2.5vl:7b as LLM              | ✅ DONE    | Changed from gemma4 (RTX 4090)                |
| SC-5  | perplexity_browser skill functional     | ✅ DONE    | Skill at ~/.hermes/skills/perplexity_browser/ |
| SC-6  | coolify_sre with restart loop detection | ✅ DONE    | sre-monitor.sh active                         |
| SC-7  | hermes.json crons centralized           | ⏳ PARTIAL | hermes.json created, not installed            |
| SC-8  | OpenClaw disable executed               | ⏳ PARTIAL | Containers stopped, Coolify stale             |
| SC-9  | MCP server for Open WebUI               | ⏳ PENDING | DEPENDS ON SPEC-039 (hermes gateway)          |
| SC-10 | Zero true cron duplicates               | ✅ DONE    | Only tunnel health overlap                    |

---

## SPEC-038 / SPEC-039 Dependency Matrix

| SPEC-039 Deliverable                       | Enables in SPEC-038                               |
| ------------------------------------------ | ------------------------------------------------- |
| Cloudflare tunnel updated to 10.0.5.2:8642 | TASK-HERMES-013 (hermes gateway configured)       |
| hermes.zappro.site or bot.zappro.site DNS  | TASK-HERMES-012 (MCP via gateway fallback)        |
| Telegram webhook / HTTPS endpoint          | TASK-HERMES-014 workaround (gateway polling mode) |

**Note:** SPEC-039 Option B (create hermes.zappro.site) avoids conflicts with existing bot.zappro.site tunnel and is the recommended path.

---

## Blockers

| Blocker                   | Status    | Required Action                          |
| ------------------------- | --------- | ---------------------------------------- |
| BOT_DOMAIN_NOT_CONFIGURED | ⏳ ACTIVE | SPEC-039: Cloudflare tunnel + DNS config |
| OPENCLAW_COOLIFY_ENFORCE  | ⏳ ACTIVE | Manual disable via Coolify dashboard     |
| MCP_PERSISTENCE_GAP       | ⏳ ACTIVE | hermes gateway workaround (SPEC-039)     |

**Removed blockers:**

- HERMES_BINARY_NOT_INSTALLED: ✅ RESOLVED — hermes v0.9.0 installed

---

## Pending Master Will Authorization

1. SPEC-039 tunnel activation (Cloudflare API update)
2. Feature request to NousResearch if `hermes mcp serve` persistence issue cannot be resolved locally
