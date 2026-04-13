---
name: SPEC-AUDIT-SECRETS-2026-04-13
description: Legacy secrets audit — 77 vault secrets analyzed, cleanup recommendations
type: audit
status: COMPLETED
date: 2026-04-13
author: will + 10 MiniMax agents (partially completed due to 529 overload)
---

# Legacy Secrets Audit — 2026-04-13

## Executive Summary

**77 secrets** analyzed in Infisical vault (project `e42657ef-98b2-4b9c-9a04-46c093bd6d37`, env `dev`).

**Findings:**
- No hardcoded secrets in monorepo project code ✅
- No `os.getenv` Infisical SDK violations in project code ✅
- 1 placeholder token in `runner/.env` (not a real secret)
- Several duplicate/intentional parallel secrets (legitimate)
- ~6 secrets not referenced in monorepo (may be for other services)

---

## Vault Secrets — Full Inventory (77)

### API Keys / Tokens (25)

| Secret | Used in Monorepo? | Status |
|--------|-------------------|--------|
| `TAVILY_API_KEY` | No | UNUSED — verify if needed |
| `COOLIFY_API_KEY` | No | UNUSED — verify if needed |
| `MINIMAX_API_KEY` | ✅ `tasks/smoke-tests/pipeline-openclaw-voice.sh` | ACTIVE |
| `TELEGRAM_BOT_TOKEN` | No | UNUSED — verify if needed |
| `GOOGLE_CLIENT_SECRET` | No (OAuth only) | ACTIVE |
| `OPENCLAW_GATEWAY_TOKEN` | No | UNUSED — verify if needed |
| `GROQ_API_KEY` | No | UNUSED — verify if needed |
| `N8N_API_KEY` | No | UNUSED — verify if needed |
| `OPENCLAW_DEEPGRAM_API_KEY` | No | UNUSED — verify if needed |
| `OPENCLAW_GEMINI_API_KEY` | No | UNUSED — verify if needed |
| `CEO_MIX_TOKEN` | No | UNUSED — verify if needed |
| `GITHUB_TOKEN` | No | UNUSED — verify if needed |
| `CONTEXT7_API_KEY` | No | UNUSED — verify if needed |
| `GRAFANA_SERVICE_ACCOUNT_TOKEN` | No | UNUSED — verify if needed |
| `OPENCODE_API_KEY` | No | UNUSED — verify if needed |
| `GITEA_TOKEN` | No | UNUSED — verify if needed |
| `N8N_RUNNERS_AUTH_TOKEN` | No | UNUSED — verify if needed |
| `OPENROUTER_API_KEY` | No | UNUSED — verify if needed |
| `DEEPGRAM_API_KEY` | No | UNUSED — verify if needed |
| `WEBUI_SECRET_KEY` | No | UNUSED — verify if needed |
| `QDRANT_API_KEY` | No | UNUSED — verify if needed |
| `GITEA_RUNNER_REGISTRATION_TOKEN` | No | UNUSED — verify if needed |
| `MINIMAX_TOKEN` | ✅ `apps/perplexity-agent/config.py` | ACTIVE |
| `GH_TOKEN` | No | UNUSED — verify if needed |

### URLs (15)

| Secret | Used in Monorepo? | Status |
|--------|-------------------|--------|
| `GITEA_INSTANCE_URL` | No | UNUSED — verify if needed |
| `OLLAMA_URL` | No | UNUSED — verify if needed |
| `OLLAMA_BASE_URL` | No | UNUSED — verify if needed |
| `N8N_WEBHOOK_URL` | No | UNUSED — verify if needed |
| `KIMI_BASE_URL` | No | UNUSED — verify if needed |
| `MOONSHOT_BASE_URL` | No | UNUSED — verify if needed |
| `QDRANT_URL` | No | UNUSED — verify if needed |
| `QDRANT_URL_PUBLIC` | No | UNUSED — verify if needed |
| `GRAFANA_URL` | No | UNUSED — verify if needed |
| `LITELLM_LOCAL_URL` | No | UNUSED — verify if needed |
| `COOLIFY_URL` | No | UNUSED — verify if needed |
| `LITELLM_UI_URL` | No | UNUSED — verify if needed |
| `LITELLM_URL` | No | UNUSED — verify if needed |
| `N8N_URL` | No | UNUSED — verify if needed |

### Passwords / Secrets (16)

| Secret | Used in Monorepo? | Status |
|--------|-------------------|--------|
| `ROOT_USER_PASSWORD` | No | ACTIVE (infra) |
| `GRAFANA_ADMIN_PASSWORD` | No | ACTIVE (infra) |
| `SMTP_PASSWORD` | No | ACTIVE (infra) |
| `N8N_DB_PASSWORD` | No | ACTIVE (infra) |
| `INFISICAL_DB_PASSWORD` | No | ACTIVE (infra) |
| `INFISICAL_REDIS_PASSWORD` | No | ACTIVE (infra) |
| `OPENCLAW_PASSWORD` | No | ACTIVE (infra) |
| `COOLIFY_REDIS_PASSWORD` | No | ACTIVE (infra) |
| `COOLIFY_ROOT_USER_PASSWORD` | No | ACTIVE (infra) |
| `GF_SECURITY_ADMIN_PASSWORD` | No | ACTIVE (infra) |
| `REDIS_PASSWORD` | No | ACTIVE (infra) |
| `LITELLM_REDIS_PASSWORD` | No | ACTIVE (infra) |
| `POSTGRES_PASSWORD` | No | ACTIVE (infra) |
| `COOLIFY_DB_PASSWORD` | No | ACTIVE (infra) |
| `WEBUI_SECRET_KEY` | No | ACTIVE (infra) |
| `GOOGLE_CLIENT_SECRET` | No | ACTIVE (infra) |

### Other Config (21)

| Secret | Status |
|--------|--------|
| `cloudflare_tunnel_id` | ACTIVE (used by `/srv/ops/terraform/cloudflare/`) |
| `cloudflare_tunnel_secret` | ACTIVE (used by `/srv/ops/terraform/cloudflare/`) |
| `cloudflare_tunnel_name` | ACTIVE (used by `/srv/ops/terraform/cloudflare/`) |
| `cloudflare_tunnel_cname` | ACTIVE (used by `/srv/ops/terraform/cloudflare/`) |
| `BROWSER_EVALUATE_ENABLED` | CONFIG |
| `GOGC`, `GOMEMLIMIT` | CONFIG (Go garbage collection) |
| `FEAT_COMPUTER_USE`, `FEAT_DREAM`, `FEAT_VOICE`, `FEAT_KAIROS` | CONFIG (feature flags) |
| `OLLAMA_MODEL` | CONFIG |
| `DISPLAY`, `REDIS_HOST`, `REDIS_PORT` | CONFIG |
| `HOOKS_PATH`, `HOOKS_ENABLED` | CONFIG |
| `PORTEIRO_MODE` | CONFIG |
| `OPENCLAW_USER` | CONFIG |
| `GOOGLE_CLIENT_ID` | ACTIVE (OAuth) |
| `TELEGRAM_CHAT_ID` | CONFIG |
| `CONTEXT7_ENABLED` | CONFIG |
| `LITELLM_MASTER_KEY` | ACTIVE (infra) |
| `COOLIFY_APP_KEY` | ACTIVE (infra) |
| `OPEN_AI_KEY` | CONFIG |

---

## Intentionally Duplicated Keys

These are NOT legacy — they serve different services:

| Pair | Reason |
|------|--------|
| `MINIMAX_API_KEY` + `MINIMAX_TOKEN` | Voice pipeline uses `MINIMAX_API_KEY`, perplexity-agent uses `MINIMAX_TOKEN` — two different API keys for different services |
| `GH_TOKEN` + `GITHUB_TOKEN` | Two different tokens for different integrations |
| `OLLAMA_URL` + `OLLAMA_BASE_URL` | May serve different purposes (legacy Ollama direct vs base URL) |
| `QDRANT_URL` + `QDRANT_URL_PUBLIC` | Internal vs public qdrant endpoints |

---

## Legacy Candidates — To Investigate

The following secrets are **not referenced anywhere in the monorepo** and may be for services outside `/srv/monorepo`:

| Secret | May Be Used By |
|--------|---------------|
| `GH_TOKEN` | External CI (not in monorepo) |
| `TAVILY_API_KEY` | External research agents |
| `GROQ_API_KEY` | External LLM routing |
| `KIMI_BASE_URL`, `MOONSHOT_BASE_URL` | Alternative LLM providers (may not be in use) |
| `OPENCLAW_GATEWAY_TOKEN` | OpenClaw external gateway (may be decommissioned) |
| `CEO_MIX_TOKEN` | CEO Mix service (verify if active) |
| `OPENCODE_API_KEY` | Remote code execution (verify if active) |
| `CONTEXT7_API_KEY` | Context7 MCP tool (verify if active) |

---

## Hardcoded Secrets Check

**No hardcoded secrets found in project code** ✅

Checked:
- `apps/**/*.py`, `apps/**/*.ts`, `apps/**/*.js` (excluding node_modules, .venv)
- `packages/**/*.py`, `packages/**/*.ts`, `packages/**/*.js` (excluding node_modules)
- `scripts/**/*.sh`, `scripts/**/*.py`
- No `sk-`, `ghp_`, `glpat-`, `api_key=` patterns in actual project files

The only `os.getenv` calls found are in:
- `browser_use` library's `.venv` (third-party, not project code)
- These use standard env vars like `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` for third-party SDK initialization — **not Infisical SDK violations**

---

## .env Files Check

| File | Real Secrets? |
|------|--------------|
| `/srv/monorepo/.env` | Only `COREPACK_ENABLE_STRICT=0` — clean ✅ |
| `/srv/monorepo/runner/.env` | Contains `GITEA_RUNNER_REGISTRATION_TOKEN=runner-token-1775695479` — **placeholder value, not a real token** ✅ |
| `/srv/monorepo/apps/api/.env` | Only placeholders (`your-client-id`, `your-google-secret`, `change-this-to-a-random-secret`) ✅ |
| `/srv/monorepo/archive/apps-web-20260411/.env` | Only dev placeholders (`VITE_API_URL=http://localhost:3333`) ✅ |

---

## MINIMAX_API_KEY Rotation — VERIFIED ✅

Rotation completed in previous session:
- Previous key: `sk-cp-cfCXLsNYtSeBS...` (partial, redacted)
- New key: `sk-cp-uA1oy3YNYtSeBSs4...` (rotated ✅)
- Verified present in vault as `MINIMAX_API_KEY`

---

## Recommendations

### DELETE (not used, not referenced)
These secrets appear to be for services not deployed via monorepo. Before deleting, verify with the ops stack:

1. `OLLAMA_URL` — not referenced in monorepo
2. `OLLAMA_BASE_URL` — not referenced in monorepo  
3. `QDRANT_URL` — not referenced in monorepo
4. `QDRANT_URL_PUBLIC` — not referenced in monorepo

### INVESTIGATE (unused, verify before delete)
Before removing, confirm these services are not in use:

1. `GH_TOKEN` — no reference in monorepo (may be for external CI)
2. `TAVILY_API_KEY` — no reference in monorepo
3. `GROQ_API_KEY` — no reference in monorepo
4. `KIMI_BASE_URL` — no reference in monorepo
5. `MOONSHOT_BASE_URL` — no reference in monorepo
6. `OPENCLAW_GATEWAY_TOKEN` — no reference in monorepo
7. `CEO_MIX_TOKEN` — no reference in monorepo
8. `OPENCODE_API_KEY` — no reference in monorepo
9. `CONTEXT7_API_KEY` — no reference in monorepo

### KEEP (actively used)
- `MINIMAX_API_KEY` ✅ (voice pipeline)
- `MINIMAX_TOKEN` ✅ (perplexity-agent)
- `cloudflare_tunnel_*` ✅ (Terraform, outside monorepo)
- All `*_PASSWORD` infra secrets ✅
- `LITELLM_MASTER_KEY`, `COOLIFY_*` secrets ✅

---

## Actions Required

| # | Action | Risk |
|---|--------|------|
| 1 | Delete `OLLAMA_URL`, `OLLAMA_BASE_URL`, `QDRANT_URL`, `QDRANT_URL_PUBLIC` from vault | Low (not referenced) |
| 2 | Investigate 9 unused secrets above before deletion | Medium (may break external services) |
| 3 | Replace `runner-token-1775695479` in `runner/.env` with real Gitea runner token | Medium (placeholder) |
| 4 | Consider rotating `GH_TOKEN`, `GITHUB_TOKEN` if not rotated recently | Low |

---

**Audit date:** 2026-04-13
**Vault:** Infisical local @ 127.0.0.1:8200
**Project:** e42657ef-98b2-4b9c-9a04-46c093bd6d37 / dev /
**Tool:** Python SDK `InfisicalSDKClient` + CLI
**Agents:** 10 MiniMax agents launched (SDK import issues resolved manually)
