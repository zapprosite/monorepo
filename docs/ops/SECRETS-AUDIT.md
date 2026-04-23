# Secrets Audit — homelab-monorepo

**Date:** 2026-04-23
**Auditor:** batch-fix / env-tracking-2

---

## Overview

This document tracks environment variable completeness, docker-compose usage, and hardcoded secrets audit.

---

## 1. .env vs .env.example Completeness

### Keys in .env NOT in .env.example (26 keys missing documentation)

| Variable | Category |
|----------|----------|
| `HERMES_AGENCY_PORT` | Hermes Agent |
| `HERMES_VISION_MODEL` | Hermes Agent |
| `HERMES_VOICE` | Hermes Agent |
| `HERMES_WEBHOOK_URL` | Hermes Agent |
| `LITELLM_API_KEY` | LiteLLM |
| `LITELLM_EMBEDDING_DIM` | LiteLLM |
| `LITELLM_EMBEDDING_MODEL` | LiteLLM |
| `LITELLM_HOST` | LiteLLM |
| `LITELLM_MODEL_LIST` | LiteLLM |
| `LITELLM_PORT` | LiteLLM |
| `LITELLM_PUBLIC_URL` | LiteLLM |
| `MCP_COOLIFY_URL` | MCP Servers |
| `MCP_CRON_URL` | MCP Servers |
| `MCP_OLLAMA_URL` | MCP Servers |
| `MCP_SYSTEM_URL` | MCP Servers |
| `MINIMAX_API_BASE` | MiniMax |
| `QDRANT_COLLECTION` | Qdrant |
| `QDRANT_DISTANCE` | Qdrant |
| `QDRANT_GRPC_URL` | Qdrant |
| `QDRANT_URL` | Qdrant |
| `QDRANT_VECTOR_DIM` | Qdrant |
| `REDIS_CONNECT_TIMEOUT_MS` | Redis |
| `REDIS_MAX_RETRIES` | Redis |
| `REDIS_RETRY_DELAY_MS` | Redis |
| `REDIS_URL` | Redis |
| `STT_PROXY_URL` | STT |

### Key in .env.example NOT in .env (1 stale entry)

| Variable | Notes |
|----------|-------|
| `MINIMAX_GROUP_ID` | Not present in `.env` — may be unused or rotated |

---

## 2. Docker-Compose env_file Usage

| File | env_file | Status |
|------|----------|--------|
| `/srv/monorepo/docker-compose.yml` | NO | Uses inline `environment:` only |
| `/srv/monorepo/docker-compose.openwebui.yml` | NO | No secrets — static config |
| `/srv/monorepo/docker-compose.gitea-runner.yml` | NO | Uses `${VAR}` substitution only |
| `/srv/monorepo/apps/obsidian-web/docker-compose.yml` | **YES** | `env_file: /srv/monorepo/.env` |
| `/srv/monorepo/apps/ai-gateway/docker-compose.yml` | TODO | needs verification |
| `/srv/monorepo/apps/list-web/docker-compose.yml` | TODO | needs verification |
| `/srv/monorepo/mcps/mcp-memory/docker-compose.yml` | TODO | needs verification |

**Note:** Root `docker-compose.yml` references no env_file but uses direct `${VAR}` substitution. This is acceptable for interpolation but does not load all .env defaults.

---

## 3. Hardcoded Secrets Audit

### Files Checked
- `/srv/monorepo/apps/**/*.ts`
- `/srv/monorepo/apps/**/*.tsx`
- `/srv/monorepo/apps/**/*.js`

### Findings

**No hardcoded API keys or tokens found in source code.**

The grep search for `sk-|token|password|secret|api.key` found only:
- OAuth flow references (`oauth2.googleapis.com/token`, `oauth_token`, `client_secret` via `window.__ENV__`)
- Session storage variable names (`TOKEN`, `token`)
- Function names referencing tokens (`isTokenValid`, `exchangeCodeForToken`, `fetchUserInfo`)

All OAuth and API credential access correctly uses `window.__ENV__` or `process.env` patterns.

---

## 4. Action Items

### Critical — .env.example Incomplete

Add these 26 missing keys to `.env.example` under the appropriate sections:

**Hermes Agent section:**
```
HERMES_AGENCY_PORT=3001
HERMES_VISION_MODEL=qwen2.5vl:7b
HERMES_VOICE=pm_santa
HERMES_WEBHOOK_URL=https://hermes-agency.zappro.site/webhook
```

**LiteLLM section:**
```
LITELLM_PORT=4000
LITELLM_HOST=0.0.0.0
LITELLM_API_KEY=sk-replace-with-your-litellm-key
LITELLM_MODEL_LIST=embedding-nomic,Gemma4-12b-it,qwen2.5vl:3b
LITELLM_EMBEDDING_MODEL=embedding-nomic
LITELLM_EMBEDDING_DIM=768
LITELLM_PUBLIC_URL=https://llm.zappro.site/v1
```

**MiniMax section:**
```
MINIMAX_API_BASE=https://api.minimax.io/anthropic/v1
```

**Qdrant section:**
```
QDRANT_URL=http://localhost:6333
QDRANT_GRPC_URL=localhost:6334
QDRANT_COLLECTION=will
QDRANT_VECTOR_DIM=768
QDRANT_DISTANCE=Cosine
```

**Redis section:**
```
REDIS_URL=redis://:password@host:6379
REDIS_CONNECT_TIMEOUT_MS=5000
REDIS_RETRY_DELAY_MS=2000
REDIS_MAX_RETRIES=3
```

**MCP Servers section:**
```
MCP_COOLIFY_URL=http://localhost:4012/sse
MCP_OLLAMA_URL=http://localhost:4013/sse
MCP_SYSTEM_URL=http://localhost:4014/sse
MCP_CRON_URL=http://localhost:4015/sse
```

**STT section:**
```
STT_PROXY_URL=http://localhost:8204
```

### Medium — Stale MINIMAX_GROUP_ID

Remove `MINIMAX_GROUP_ID` from `.env.example` or verify it's needed.

### Low — Docker-compose env_file

Consider adding `env_file: /srv/monorepo/.env` to root `docker-compose.yml` for consistency if more services are added.

---

## 5. Token Rotation History (from .env comments)

| Date | Token | Status |
|------|-------|--------|
| 2026-04-16 | `sk-api-...` (MiniMax) | ROTATED — insufficient balance |
| 2026-04-16 | `token_minimax-m2.7_plano` | ROTATED |

---

## 6. Deprecated Variables

These are documented in `.env` and `.env.example` as deprecated:

- `OPENCLAW_DEEPGRAM_API_KEY`
- `OPENCLAW_GATEWAY_TOKEN`
- `OPENCLAW_GEMINI_API_KEY`
- `OPENCLAW_PASSWORD`
- `OPENCLAW_USER`
- `WAV2VEC2_URL`
- `STT_PROXY_URL` (replaced by STT_DIRECT_URL)
- `sk-api-...` (MiniMax, rotated)
- `token_minimax-m2.7_plano` (rotated)

---

**End of Audit**
