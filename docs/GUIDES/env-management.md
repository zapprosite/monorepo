# Environment Variables Management

**Standard:** ENV-001
**Scope:** All environment variables in `/srv/monorepo/.env`
**Authority:** Platform Governance
**Last Updated:** 2026-04-13

---

## Core Rule

> **Code reads from `.env`, never hardcodes secrets.**
>
> The `.env` file is the single source of truth for all environment variables. No secret, API key, password, or configuration value may be hardcoded in source code.

---

## File Structure

```
/srv/monorepo/
├── .env              # ACTUAL secrets (NEVER commit)
├── .env.example      # Template with placeholder values (COMMIT THIS)
└── docs/GUIDES/
    └── env-management.md  # This document
```

---

## The .env File

### Purpose
`.env` contains **real secrets** — API keys, passwords, tokens, connection strings. It is **never committed to git**.

### Safety Rules
- **Never commit `.env`** — It must be in `.gitignore`
- **Never share `.env`** — Not in Slack, not in PRs, not in screenshots
- **Never use real values in `.env.example`** — Use placeholders only
- **Never log `.env` values** — Debug output must be masked

### Populating .env
1. **From Infisical:** Run the sync script (see below)
2. **Manually:** Copy `.env.example` to `.env` and fill in values from Infisical vault
3. **New secrets:** Add to Infisical first, then sync

---

## Infisical → .env Sync Process

Infisical is the **authoritative source** for secrets. `.env` is synchronized from Infisical.

### Standard Sync (Manual)

```bash
# 1. Ensure INFISICAL_TOKEN is set in current shell
source ~/.env 2>/dev/null || true

# 2. Run the Infisical sync script
bash /srv/ops/scripts/sync-infisical-to-env.sh
```

### Automated Sync
- **Cron job:** Runs daily at 06:00 via system crontab
- **Pre-push hook:** Syncs before any `git push`
- **CI pipeline:** Validates secrets are present before deployment

### Sync Script Location
```
/srv/ops/scripts/sync-infisical-to-env.sh
```

---

## How to Add New Secrets

### Step 1: Add to Infisical Vault

```bash
# Using Infisical CLI
infisical secrets set NEW_SECRET_KEY --project your-project

# Or ask Master Will to add via Infisical dashboard
```

### Step 2: Document in .env.example

Open `.env.example` and add the new variable **with a placeholder value and a comment**:

```bash
# Description of what this variable does
NEW_SECRET_KEY=your-new-secret-placeholder
```

**Comment rules:**
- First line: Brief description of the variable's purpose
- Include which service uses it
- Note any constraints (e.g., "minimum 32 characters")
- Note if it's optional

### Step 3: Sync to .env

```bash
bash /srv/ops/scripts/sync-infisical-to-env.sh
```

### Step 4: Document in This Guide

Update this document's variable reference if it's a new category.

---

## How to Rotate Secrets

### Step 1: Update in Infisical

```bash
# Rotate the secret in Infisical
infisical secrets set SECRET_NAME --project your-project
```

### Step 2: Sync to .env

```bash
bash /srv/ops/scripts/sync-infisical-to-env.sh
```

### Step 3: Restart Affected Services

```bash
# Restart containers that read this secret
docker compose restart <service-name>

# Or via Coolify API
curl -X POST https://coolify.zappro.site/api/deployments/<service-id>/restart
```

### Step 4: Verify

Check that the service started correctly and is using the new secret.

---

## Variable Reference

### Authentication
| Variable | Description | Constraints |
|----------|-------------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth2 client ID | — |
| `GOOGLE_CLIENT_SECRET` | Google OAuth2 client secret | — |
| `SESSION_SECRET` | Express session secret | Min 32 chars |
| `INTERNAL_API_SECRET` | Internal API authentication | Min 32 chars |

### Database
| Variable | Description |
|----------|-------------|
| `DB_HOST`, `DB_PORT` | PostgreSQL connection |
| `DB_USER`, `DB_PASSWORD`, `DB_NAME` | PostgreSQL credentials |
| `POSTGRES_PASSWORD` | Main PostgreSQL password |
| `COOLIFY_DB_PASSWORD` | Coolify database password |
| `INFISICAL_DB_PASSWORD` | Infisical database password |
| `N8N_DB_PASSWORD` | n8n database password |

### LLM Providers
| Variable | Description |
|----------|-------------|
| `MINIMAX_API_KEY` | MiniMax primary LLM |
| `OPEN_AI_KEY` | OpenAI GPT models |
| `OPENROUTER_API_KEY` | OpenRouter aggregator |
| `OPENCODE_API_KEY` | OpenCode |
| `CONTEXT7_API_KEY` | Context7 MCP docs |

### Local LLM
| Variable | Description |
|----------|-------------|
| `LITELLM_URL` | LiteLLM proxy URL (production) |
| `LITELLM_LOCAL_URL` | LiteLLM local URL |
| `LITELLM_MASTER_KEY` | LiteLLM master key |
| `OLLAMA_MODEL` | Default Ollama model |

### Voice Pipeline (Hermes Agent)
| Variable | Description |
|----------|-------------|
| `HERMES_AGENT_USER` | Hermes Agent username |
| `HERMES_AGENT_PASSWORD` | Hermes Agent password |
| `HERMES_AGENT_DEEPGRAM_API_KEY` | Deepgram STT |
| `HERMES_AGENT_GATEWAY_TOKEN` | Gateway auth token |
| `HERMES_AGENT_GEMINI_API_KEY` | Gemini API |
| `FEAT_VOICE` | Voice feature flag |

### Infrastructure
| Variable | Description |
|----------|-------------|
| `COOLIFY_URL`, `COOLIFY_API_KEY` | Coolify PaaS |
| `GITEA_INSTANCE_URL`, `GITEA_TOKEN` | Gitea Git |
| `GRAFANA_URL`, `GRAFANA_ADMIN_PASSWORD` | Grafana dashboards |
| `N8N_URL`, `N8N_API_KEY` | n8n automation |
| `REDIS_HOST`, `REDIS_PASSWORD` | Redis cache |

### Cloudflare
| Variable | Description |
|----------|-------------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API |
| `cloudflare_tunnel_id` | Tunnel ID |
| `cloudflare_tunnel_name` | Tunnel name |
| `cloudflare_tunnel_secret` | Tunnel secret |

---

## Ports Reference

Before adding any new port variable, check `/srv/ops/ai-governance/PORTS.md`.

**Reserved ports (never use):**
- `:3000` — OpenWebUI
- `:4000` — LiteLLM production
- `:4001` — Hermes Agent Bot
- `:8000/8443` — Supabase
- `:5173` — Vite frontend dev

**Free for dev:** `4002–4099`

---

## Exceptions

If a secret is missing from Infisical:
1. **Do NOT hardcode it** in source code
2. Ask Master Will to add it to Infisical vault
3. See: `docs/GOVERNANCE/EXCEPTIONS.md`

---

## Related Documents

- [SECRETS-MANDATE.md](../../GOVERNANCE/SECRETS-MANDATE.md)
- [EXCEPTIONS.md](../../GOVERNANCE/EXCEPTIONS.md)
- [PORTS.md](/srv/ops/ai-governance/PORTS.md)
- [SUBDOMAINS.md](/srv/ops/ai-governance/SUBDOMAINS.md)
- [INFISICAL-SDK-PATTERN.md](./INFISICAL-SDK-PATTERN.md)
