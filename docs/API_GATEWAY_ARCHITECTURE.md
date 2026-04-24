# API Gateway Architecture

**Status:** Implemented
**Last Updated:** 2026-04-23
**Tunnel ID:** `aee7a93d-c2e2-4c77-a395-71edc1821402`

---

## Overview

All services run behind Cloudflare Tunnel with no direct IP exposure. External access is mediated exclusively through `*.zappro.site` subdomains routed via the Cloudflare Edge.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            EXTERNAL (Cloudflare Edge)                       │
│                                                                             │
│   https://hermes-agency.zappro.site    →    Hermes Agency Suite           │
│   https://llm.zappro.site              →    LiteLLM Proxy                  │
│   https://grafana.zappro.site          →    Grafana Observability          │
│   https://pgadmin.zappro.site          →    pgAdmin Database Management     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              INTERNAL NETWORK                                │
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌───────────┐ │
│  │ Hermes      │    │ AI Gateway  │    │ LiteLLM     │    │ Hermes    │ │
│  │ Agency      │    │ (Facade)    │    │ Proxy       │    │ Gateway   │ │
│  │ :3001       │    │ :4002       │    │ :4000       │    │ :8642     │ │
│  └─────────────┘    └─────────────┘    └─────────────┘    └───────────┘ │
│         │                  │                  │                   │         │
│         └──────────────────┴────────┬─────────┴───────────────────┘         │
│                                   │                                        │
│                          ┌────────▼────────┐                              │
│                          │  Hermes CLI      │                              │
│                          │  (Telegram Bot)  │                              │
│                          └──────────────────┘                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Services

### 1. Hermes Agency Suite

**Internal Endpoint:** `http://localhost:3001`
**External URL:** `https://hermes-agency.zappro.site`
**Cloudflare Route:** Tunnel → `:3001`

**Ports & Processes:**
- `:3001` — Health server (Node.js `http.Server`)
  - `/health` — Liveness probe
  - `/ready` — Readiness probe
  - `/health/circuit-breakers` — Admin-only circuit breaker status

**Environment:**
```env
HERMES_AGENCY_PORT=3001
HERMES_API_KEY=<redacted: source .env>
HERMES_WEBHOOK_URL=https://hermes-agency.zappro.site/webhook
```

**Dependencies:**
- Qdrant (vector DB): `localhost:6333`
- Ollama (LLM): `localhost:11434`
- Redis: `zappro-redis:6379`

**Datacenter Hardening (SPEC-059):**
```env
HERMES_ADMIN_USER_IDS=           # CSV of Telegram user IDs (admin whitelist)
HERMES_MAX_FILE_SIZE=20971520    # 20MB
HERMES_MAX_CONCURRENT=3         # max concurrent uploads per user
HERMES_RATE_WINDOW_MS=10000      # rate limit window
HERMES_RATE_MAX_MSGS=5           # max messages per window
HERMES_CIRCUIT_BREAKER_THRESHOLD=5
HERMES_CIRCUIT_BREAKER_COOLDOWN_MS=30000
```

---

### 2. AI Gateway (Facade)

**Internal Endpoint:** `http://0.0.0.0:4002`
**External URL:** N/A (internal only, not exposed via tunnel)
**Port Binding:** `0.0.0.0:4002` (accessible within network)

**Purpose:** OpenAI-compatible facade that proxies to:
- LiteLLM Proxy (external providers)
- Ollama (local models)
- Context7 (documentation lookup)

**Routes:**
| Method | Path | Upstream | Auth |
|--------|------|----------|------|
| `POST` | `/v1/chat/completions` | LiteLLM / Ollama | Bearer `AI_GATEWAY_FACADE_KEY` |
| `POST` | `/v1/audio/speech` | Ollama / Kokoro TTS | Bearer `AI_GATEWAY_FACADE_KEY` |
| `POST` | `/v1/audio/transcriptions` | Whisper (STT) | Bearer `AI_GATEWAY_FACADE_KEY` |
| `GET` | `/v1/models` | LiteLLM | Bearer `AI_GATEWAY_FACADE_KEY` |
| `GET` | `/health` | — | None |

**Auth Implementation:**
```typescript
// Constant-time Bearer token compare (SPEC-047 T105)
// Token: process.env['AI_GATEWAY_FACADE_KEY']
const valid = timingSafeEqual(Buffer.from(token.padEnd(key.length)), Buffer.from(key));
```

**Environment:**
```env
AI_GATEWAY_PORT=4002
AI_GATEWAY_FACADE_KEY=<redacted: source .env>
OLLAMA_URL=http://localhost:11434
STT_PROXY_URL=http://localhost:8204
LITELLM_URL=http://localhost:4000/v1
```

**Rate Limiting:** Per API key (future: Redis-backed)

---

### 3. LiteLLM Proxy

**Internal Endpoint:** `http://127.0.0.1:4000`
**External URL:** `https://llm.zappro.site`
**Cloudflare Route:** Tunnel → `:4000`

**Purpose:** Unified gateway for external LLM providers (OpenAI, Groq, OpenRouter, etc.)

**Configuration:**
```env
LITELLM_PORT=4000
LITELLM_HOST=0.0.0.0
LITELLM_MASTER_KEY=<redacted: source .env>
LITELLM_MODEL_LIST=embedding-nomic,Gemma4-12b-it,qwen2.5vl:3b
LITELLM_EMBEDDING_MODEL=embedding-nomic
LITELLM_DROP_params=True
```

**Exposed Models:**
- `embedding-nomic` — Text embeddings
- `Gemma4-12b-it` — Primary instruction-follow model
- `qwen2.5vl:3b` — Vision model

**Provider Keys:**
```env
OPEN_AI_KEY=<redacted: source .env>
GROQ_API_KEY=<redacted: source .env>
OPENROUTER_API_KEY=<redacted: source .env>
OPENCODE_API_KEY=<redacted: source .env>
HF_TOKEN=<redacted: source .env>
MINIMAX_API_KEY=<redacted: source .env>
```

---

### 4. Hermes Gateway (Telegram Bridge)

**Internal Endpoint:** `http://127.0.0.1:8642`
**External URL:** N/A (receives Telegram webhooks via Cloudflare)
**Port Binding:** `127.0.0.1:8642` (localhost only)

**Process:** Python (`hermes_cli.main gateway run --replace`)
**Parent Process:** `hermes-agent/venv/bin/python`

**Purpose:** Receives Telegram updates via webhook and routes to Hermes Agency

**Auth:** `HERMES_API_KEY` in `X-API-Key` header

**Environment:**
```env
HERMES_GATEWAY_URL=http://127.0.0.1:8642
HERMES_API_KEY=<redacted: source .env>
```

**Telegram Bot Tokens:**
```env
HERMES_AGENCY_BOT_TOKEN=<redacted: source .env>  # @CEO_REFRIMIX_bot (Agent Lider)
EDITOR_SOCIAL_BOT_TOKEN=<redacted: source .env>  # @editor_social_bot
ATHLOS_BOT_TOKEN=<redacted: source .env>          # @Athlos_Life_bot
HOMELAB_LOGS_BOT_TOKEN=<redacted: source .env>   # @HOMELAB_LOGS_bot
```

**Webhook Configuration:**
```env
HERMES_WEBHOOK_URL=https://hermes-agency.zappro.site/webhook
```

---

### 5. LiteLLM UI

**Internal Endpoint:** `http://localhost:4000/ui`
**Note:** Not exposed externally. Local access only via port forwarding if needed.

---

## Cloudflare Tunnel Configuration

**Tunnel ID:** `aee7a93d-c2e2-4c77-a395-71edc1821402`
**Tunnel CNAME:** `aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com`

**Environment Variables:**
```env
cloudflare_tunnel_name=will-zappro-homelab
cloudflare_tunnel_id=aee7a93d-c2e2-4c77-a395-71edc1821402
cloudflare_tunnel_cname=aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com
cloudflare_tunnel_secret=<redacted: source .env>
```

**Services Exposed via Tunnel:**
| Subdomain | Internal Target | Service |
|-----------|-----------------|---------|
| `hermes-agency.zappro.site` | `localhost:3001` | Hermes Agency |
| `llm.zappro.site` | `localhost:4000` | LiteLLM Proxy |
| `grafana.zappro.site` | `localhost:3000` | Grafana |
| `pgadmin.zappro.site` | `localhost:4050` | pgAdmin |

**Not Exposed (Local Only):**
- Open WebUI (`:3000`) — Reserved for local development
- AI Gateway (`:4002`) — Internal facade
- Hermes Gateway (`:8642`) — Telegram webhook relay (reached via Hermes Agency)

---

## Security Hardening

### Network Isolation
- All services behind Cloudflare Tunnel — no direct IP exposure
- Internal services bind to `127.0.0.1` or `localhost` only
- AI Gateway binds to `0.0.0.0` for internal network access (future: restrict to Docker network)

### API Authentication
| Endpoint | Auth Method | Key |
|----------|-------------|-----|
| AI Gateway (`*:4002`) | Bearer Token | `AI_GATEWAY_FACADE_KEY` |
| LiteLLM (`*:4000`) | Bearer Token | `LITELLM_MASTER_KEY` |
| Hermes Gateway (`*:8642`) | `X-API-Key` Header | `HERMES_API_KEY` |
| Hermes Agency Webhook | Bot Token + HMAC | Telegram `setWebhook` |

### Telegram Security
- Bot tokens for each service (CEO, Editor Social, Athlos, Homelab Logs)
- Admin whitelist via `HERMES_ADMIN_USER_IDS`
- Circuit breaker: 5 failures triggers 30s cooldown

### CORS Configuration
- AI Gateway: `origin: true` (configured for development; restrict in production)
- All other services: Cloudflare handles CORS headers

---

## Load Balancing

**Current State:** Single instance per service

| Service | Instance | Strategy |
|---------|----------|----------|
| Hermes Agency | 1 | Stateless — no session affinity needed |
| LiteLLM Proxy | 1 | Proxies to upstream providers — stateless |
| AI Gateway | 1 | Routes to LiteLLM/Ollama — stateless |
| Hermes Gateway | 1 | Receives webhooks — stateless |
| Grafana | 1 | Dashboards only — stateless |

**Future Scaling:**
```env
# When adding Redis session affinity
LITELLM_REDIS_HOST=zappro-redis
LITELLM_REDIS_PORT=6379
LITELLM_SESSION_STORE=redis
```

---

## Routing Matrix

### External → Internal

```
hermes-agency.zappro.site
├── /webhook          → Hermes Agency (Telegram webhook receiver)
├── /health           → Hermes Agency health server
├── /trpc/*           → Hermes Agency tRPC API
└── (all other)       → Hermes Agency Next.js app

llm.zappro.site
├── /v1/*             → LiteLLM Proxy (OpenAI-compatible)
├── /router/*         → LiteLLM config endpoints
└── /ui/*             → LiteLLM UI

grafana.zappro.site
└── /*                → Grafana (full path)

pgadmin.zappro.site
└── /*                → pgAdmin (full path)
```

### Internal Routes

```
AI Gateway (:4002)
├── POST /v1/chat/completions    → LiteLLM or Ollama
├── POST /v1/audio/speech        → Kokoro TTS Bridge
├── POST /v1/audio/transcriptions → Whisper STT
└── GET  /v1/models              → LiteLLM model list

Hermes Gateway (:8642)
└── (Telegram webhook receiver)

Hermes Agency (:3001)
├── GET  /health                 → Liveness
├── GET  /ready                  → Readiness
├── POST /webhook                → Telegram updates
└── GET  /health/circuit-breakers → Admin only
```

---

## WebSocket Support

**Current:** Telegram long polling handled by `hermes_cli` (Python bot)

**Future Considerations:**
- Real-time agency updates via WebSocket
- SSE for streaming responses from AI Gateway
- Consider: Socket.IO or native WebSocket upgrade on Fastify

---

## Ports Reference

| Port | Service | Bind | Exposed | Purpose |
|------|---------|------|---------|---------|
| `3000` | Open WebUI | `127.0.0.1` | No | Local dev only |
| `3000` | Grafana | `0.0.0.0` | Yes | Observability |
| `3001` | Hermes Agency | `127.0.0.1` | Via tunnel | Agency suite |
| `4000` | LiteLLM Proxy | `127.0.0.1` | Via tunnel | LLM gateway |
| `4002` | AI Gateway | `0.0.0.0` | No | OpenAI facade |
| `4050` | pgAdmin | `0.0.0.0` | Via tunnel | DB management |
| `6333` | Qdrant | `localhost` | No | Vector DB |
| `6379` | Redis | `zappro-redis` | No | Cache/sessions |
| `8204` | Whisper STT | `localhost` | No | Speech-to-text |
| `8642` | Hermes Gateway | `127.0.0.1` | No | Telegram bridge |

---

## Observability

**Grafana:** `https://grafana.zappro.site`
```env
GRAFANA_URL=https://grafana.zappro.site
GRAFANA_ADMIN_PASSWORD=<redacted: source .env>
GRAFANA_SERVICE_ACCOUNT_TOKEN=<redacted: source .env>
```

**Metrics (Future):**
- LiteLLM built-in metrics at `/metrics`
- Hermes Agency custom metrics via Prometheus client
- AI Gateway: Fastify logger → structured JSON

---

## Disaster Recovery

### Snapshot Points
- ZFS snapshots before any configuration change
- Database: PostgreSQL at `zappro-litellm-db:5432`
- Vector DB: Qdrant at `localhost:6333`

### Backup Strategy
- PostgreSQL: Daily dumps via Coolify
- Qdrant: ZFS snapshot of `/srv/data/qdrant`
- Redis: AOF persistence enabled

### Failover
- Single instance for all services (no HA yet)
- Cloudflare Tunnel provides DDoS protection and automatic failover
- LiteLLM upstream failures trigger circuit breaker in AI Gateway

---

## Environment Variables Summary

```env
# AI Gateway
AI_GATEWAY_PORT=4002
AI_GATEWAY_FACADE_KEY=<redacted: source .env>

# Hermes Agency
HERMES_AGENCY_PORT=3001
HERMES_API_KEY=<redacted: source .env>
HERMES_WEBHOOK_URL=https://hermes-agency.zappro.site/webhook

# LiteLLM
LITELLM_PORT=4000
LITELLM_MASTER_KEY=<redacted: source .env>
LITELLM_MODEL_LIST=Gemma4-12b-it,qwen2.5vl:3b,embedding-nomic

# Hermes Gateway
HERMES_GATEWAY_URL=http://127.0.0.1:8642

# Cloudflare
cloudflare_tunnel_id=aee7a93d-c2e2-4c77-a395-71edc1821402
cloudflare_tunnel_cname=aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com
```
