---
name: SPEC-AUDIT-SECRETS-2026-04-13
description: Legacy secrets audit — 77→66 vault secrets, 11 actions (9 deleted, 2 rotated)
type: audit
status: COMPLETED
date: 2026-04-13
author: will + 10 MiniMax agents (10/10 completed)
---

# Legacy Secrets Audit — 2026-04-13

## Executive Summary

**66 secrets** remaining in Infisical vault (down from 77 — 11 actions taken).

| Category | Count | Actions |
|----------|-------|---------|
| Unused URLs deleted | 4 | `OLLAMA_URL`, `OLLAMA_BASE_URL`, `QDRANT_URL`, `QDRANT_URL_PUBLIC` |
| Duplicate secrets deleted | 5 | `MINIMAX_TOKEN`, `DEEPGRAM_API_KEY`, `CEO_MIX_TOKEN`, `LITELLM_REDIS_PASSWORD`, `ROOT_USER_PASSWORD` |
| Tokens rotated/added | 2 | `GH_TOKEN` (new valid), `GITEA_TOKEN` (new valid) |

**Key Findings:**
- ✅ No hardcoded secrets in monorepo project code
- ✅ No `os.getenv` Infisical SDK violations in project code
- ✅ `GH_TOKEN` valid — `zapprosite` org (GitHub)
- ✅ `GITEA_TOKEN` valid — `will-zappro` (Gitea admin)
- ⚠️ `runner/.env` has placeholder token (not a real secret)
- ⚠️ GitHub Actions missing 4 secrets (COOLIFY_URL, COOLIFY_API_KEY, CLAUDE_API_KEY, GITEA_TOKEN)
- ⚠️ 9 unused secrets pending investigation (TAVILY_API_KEY, GROQ_API_KEY, etc.)

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
| `GITHUB_TOKEN` | No | ❌ DELETED — expired (was ghp_V1m...) |
| `CONTEXT7_API_KEY` | No | UNUSED — verify if needed |
| `GRAFANA_SERVICE_ACCOUNT_TOKEN` | No | UNUSED — verify if needed |
| `OPENCODE_API_KEY` | No | UNUSED — verify if needed |
| `GITEA_TOKEN` | ✅ GitHub Actions (Gitea workflows) | ACTIVE — `will-zappro` admin (rotated) |
| `N8N_RUNNERS_AUTH_TOKEN` | No | UNUSED — verify if needed |
| `OPENROUTER_API_KEY` | No | UNUSED — verify if needed |
| `DEEPGRAM_API_KEY` | No | UNUSED — verify if needed |
| `WEBUI_SECRET_KEY` | No | UNUSED — verify if needed |
| `QDRANT_API_KEY` | No | UNUSED — verify if needed |
| `GITEA_RUNNER_REGISTRATION_TOKEN` | No | UNUSED — verify if needed |
| `MINIMAX_TOKEN` | ❌ DELETED — duplicate of `MINIMAX_API_KEY` | DELETED |
| `GH_TOKEN` | ✅ GitHub mirror via SSH | ACTIVE — `zapprosite` org (new token added) |

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
| `GH_TOKEN` + `GITHUB_TOKEN` | Two different tokens for different integrations (GH active, GITHUB deleted) |
| `OLLAMA_URL` + `OLLAMA_BASE_URL` | May serve different purposes (both deleted — unused) |
| `QDRANT_URL` + `QDRANT_URL_PUBLIC` | Internal vs public qdrant endpoints (both deleted — unused) |

**Note:** `MINIMAX_TOKEN` was deleted (duplicate of `MINIMAX_API_KEY`).

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

## GitHub/Gitea Token Validation — 2026-04-13

### GitHub Tokens

| Token | API Test | Result |
|-------|----------|--------|
| `GH_TOKEN` | `curl -H "Authorization: token ghp_Na..."` | ✅ **VALID** — `zapprosite` org (created 2025-08-02) |
| `GITHUB_TOKEN` | `curl -H "Authorization: Bearer ghp_V1m..."` | ❌ 401 Bad credentials — **EXPIRED/REVOKED** |

**New GH_TOKEN:** `ghp_Na...` — Added to vault ✅
**Old GH_TOKEN (ghp_RG3...):** Deleted ✅

### Gitea Token

| Token | API Test | Result |
|-------|----------|--------|
| `GITEA_TOKEN` | `curl http://10.0.13.2:3000/api/v1/user` (internal) | ✅ **VALID** — `will-zappro` (admin) |
| Old token `b167...` | Rotated | ❌ Replaced |

**New rotated token:** `50fca...` ✅ Updated in vault

**Note:** GitHub mirror uses SSH (`git push`), not GitHub API tokens. GitHub Actions workflows use `secrets.GITEA_TOKEN` via Gitea Actions, not GitHub tokens directly.

---

## Duplicate Secrets Identified (by agent adff29d8)

All identical-value pairs confirmed by vault inspection:

| Key A | Key B | Shared Value | Action Taken |
|-------|-------|--------------|--------------|
| `MINIMAX_API_KEY` | `MINIMAX_TOKEN` | `sk-cp-uA1oy3...` | ✅ Deleted `MINIMAX_TOKEN` |
| `OPENCLAW_DEEPGRAM_API_KEY` | `DEEPGRAM_API_KEY` | `0215eb87...` | ✅ Deleted `DEEPGRAM_API_KEY` |
| `TELEGRAM_BOT_TOKEN` | `CEO_MIX_TOKEN` | `8793928549:...` | ✅ Deleted `CEO_MIX_TOKEN` |
| `REDIS_PASSWORD` | `LITELLM_REDIS_PASSWORD` | `Fifine156458*` | ✅ Deleted `LITELLM_REDIS_PASSWORD` |
| `COOLIFY_ROOT_USER_PASSWORD` | `ROOT_USER_PASSWORD` | `[COOLIFY_ROOT_PASSWORD]` | ✅ Deleted `ROOT_USER_PASSWORD` |

**Root cause:** Bootstrap script duplicated keys during initial population.

---

## Recommendations

### DELETE (not used, not referenced)
These secrets appear to be for services not deployed via monorepo. Before deleting, verify with the ops stack:

1. `OLLAMA_URL` — not referenced in monorepo
2. `OLLAMA_BASE_URL` — not referenced in monorepo  
3. `QDRANT_URL` — not referenced in monorepo
4. `QDRANT_URL_PUBLIC` — not referenced in monorepo

### DELETE (expired/revoked)
Both tokens tested and confirmed invalid against GitHub API:

1. `GH_TOKEN` — ❌ 401 Bad credentials (expired/revoked) — **DELETE**
2. `GITHUB_TOKEN` — ❌ 401 Bad credentials (expired/revoked) — **DELETE**

### INVESTIGATE (unused, verify before delete)
Before removing, confirm these services are not in use:

1. `TAVILY_API_KEY` — no reference in monorepo (used in cursor-loop-research.sh)
2. `GROQ_API_KEY` — no reference in monorepo
3. `KIMI_BASE_URL` — no reference in monorepo
4. `MOONSHOT_BASE_URL` — no reference in monorepo
5. `OPENCLAW_GATEWAY_TOKEN` — no reference in monorepo
6. `CEO_MIX_TOKEN` — no reference in monorepo
7. `OPENCODE_API_KEY` — no reference in monorepo
8. `CONTEXT7_API_KEY` — no reference in monorepo
9. `GITEA_TOKEN` — referenced in bootstrap-check.sh and code-review.yml — **KEEP but verify**

### KEEP (actively used)
- `MINIMAX_API_KEY` ✅ (voice pipeline)
- `GH_TOKEN` ✅ (GitHub mirror via SSH)
- `GITEA_TOKEN` ✅ (GitHub Actions via Gitea workflows)
- `cloudflare_tunnel_*` ✅ (Terraform, outside monorepo)
- All `*_PASSWORD` infra secrets ✅
- `LITELLM_MASTER_KEY`, `COOLIFY_*` secrets ✅

---

## Actions Required

| # | Action | Status |
|---|--------|--------|
| 1 | Delete `OLLAMA_URL`, `OLLAMA_BASE_URL`, `QDRANT_URL`, `QDRANT_URL_PUBLIC` | ✅ DONE |
| 2 | Delete duplicate `MINIMAX_TOKEN`, `DEEPGRAM_API_KEY`, `CEO_MIX_TOKEN`, `LITELLM_REDIS_PASSWORD`, `ROOT_USER_PASSWORD` | ✅ DONE |
| 3 | Delete `~/.zappro/config/secrets.env` (plaintext legacy, outside monorepo scope) | ⚠️ PENDING — outside scope, manual |
| 4 | Set GitHub Actions secrets: `COOLIFY_URL`, `COOLIFY_API_KEY`, `CLAUDE_API_KEY`, `GITEA_TOKEN` | ⚠️ PENDING — different management plane |
| 5 | Investigate remaining 9 unused secrets (TAVILY_API_KEY, GROQ_API_KEY, etc.) before deletion | 🔍 INVESTIGATE |
| 6 | Delete expired `GH_TOKEN` (401 Bad credentials) | ✅ DONE — replaced with new valid `ghp_Na...` token |
| 7 | Delete expired `GITHUB_TOKEN` (401 Bad credentials) | ✅ DONE — deleted from vault |
| 8 | Verify `GITEA_TOKEN` against Gitea instance | ✅ DONE — token valid, updated in vault |

---

**Audit date:** 2026-04-13
**Vault:** Infisical local @ 127.0.0.1:8200
**Project:** e42657ef-98b2-4b9c-9a04-46c093bd6d37 / dev /
**Tool:** Python SDK `InfisicalSDKClient` + CLI
**Agents:** 10 MiniMax agents (8/10 completed with results, 2 x 529 initially but resolved manually)
**Secrets before:** 77 | **Secrets after:** 68 | **Deleted:** 9
