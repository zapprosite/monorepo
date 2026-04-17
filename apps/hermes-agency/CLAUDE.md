# hermes-agency — Hermes Marketing Agency Suite

**Type:** TypeScript/Node.js + Fastify
**Purpose:** Multi-agent marketing platform with 11 specialized skills

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Fastify + tRPC
- **Agents:** 11 specialized skills (CEO, Video, Design, Social, PM, etc.)
- **Storage:** Qdrant (vector DB) + Redis (locks, rate limiting)
- **Integrations:** Telegram Bot, LangGraph, LiteLLM

## Estrutura

```
apps/hermes-agency/
├── src/
│   ├── index.ts              # Fastify server + health
│   ├── telegram/
│   │   ├── bot.ts            # Telegram polling bot
│   │   ├── distributed_lock.ts # Redis SETNX locks
│   │   ├── rate_limiter.ts    # Sliding window rate limiter
│   │   └── file_validator.ts  # MIME + size validation
│   ├── skills/
│   │   └── index.ts          # 11-agent skill registry
│   ├── agency_router.ts      # Main routing logic
│   ├── litellm/
│   │   └── router.ts         # LLM fallback chain
│   └── qdrant/
│       └── client.ts          # Vector DB client
├── tests/
│   ├── skills.test.ts
│   └── agency_router.test.ts
├── vitest.config.ts
└── package.json
```

## Variáveis de Ambiente

| Variável | Default | Descrição |
|----------|---------|-----------|
| `HERMES_PORT` | 3001 | Health endpoint port |
| `HERMES_API_KEY` | (required) | API authentication |
| `HERMES_ADMIN_USER_IDS` | (required) | Admin Telegram IDs (comma-separated) |
| `HERMES_LOCK_TTL_SEC` | 30 | Redis lock TTL |
| `HERMES_RATE_WINDOW_MS` | 60000 | Rate limit window |
| `HERMES_MAX_FILE_SIZE` | 20971520 | 20MB max |
| `TELEGRAM_BOT_TOKEN` | (required) | Telegram bot token |
| `STT_DIRECT_URL` | `localhost:8204` | faster-whisper STT |
| `TTS_BRIDGE_URL` | `localhost:8013` | Kokoro TTS Bridge |
| `LITELLM_LOCAL_URL` | `localhost:11434` | Ollama |
| `QDRANT_URL` | `localhost:6333` | Qdrant vector DB |
| `REDIS_URL` | `localhost:6379` | Redis |

## Health Endpoint

```
GET /health → 200 OK (admin-only)
GET /health/liveness → 200 OK (public)
```

⚠️ **/health requires `HERMES_ADMIN_USER_IDS` whitelist** (SPEC-059 datacenter hardening)

## Datacenter Hardening (SPEC-059)

| Feature | Implementation |
|---------|----------------|
| Redis locks | `distributed_lock.ts` — SETNX per chatId |
| Rate limiting | `rate_limiter.ts` — sliding window per user |
| File validation | `file_validator.ts` — MIME magic bytes + size |
| Memory cleanup | `startMemoryCleanup()` — periodic GC |
| Concurrency limit | `MAX_CONCURRENT_PER_USER=3` |
| Graceful fallback | In-memory lock/rate-limit when Redis down |

## Skills (11 agents)

| ID | Name | Triggers |
|----|------|---------|
| `agency-ceo` | CEO MIX | `/start`, `/agency`, `brief`, `campaign` |
| `agency-onboarding` | ONBOARDING | `novo cliente`, `onboarding` |
| `agency-video-editor` | VIDEO EDITOR | `vídeo`, `transcrever` |
| `agency-organizer` | ORGANIZADOR | `tarefa`, `organizar` |
| `agency-creative` | CREATIVE | `criar`, `script`, `copy` |
| `agency-design` | DESIGN | `design`, `imagem`, `cores` |
| `agency-social` | SOCIAL MEDIA | `postar`, `social`, `hashtag` |
| `agency-pm` | PROJECT MANAGER | `milestone`, `status`, `entrega` |
| `agency-analytics` | ANALYTICS | `métricas`, `analytics` |
| `agency-brand-guardian` | BRAND GUARDIAN | `brand`, `marca` |
| `agency-client-success` | CLIENT SUCCESS | `nps`, `feedback`, `cliente` |

## Anti-Hardcoded Pattern

```typescript
// ✅ CORRETO
const STT_URL = process.env.STT_DIRECT_URL ?? 'http://localhost:8204';
const TTS_URL = process.env.TTS_BRIDGE_URL ?? 'http://localhost:8013';

// ❌ ERRADO
const STT_URL = 'http://localhost:8204'; // hardcoded
```

## Testes

```bash
pnpm --filter hermes-agency test
```

## Build

```bash
pnpm --filter hermes-agency build
```

## Portas

| Service | Port | Notes |
|---------|------|-------|
| Hermes Agency | 3001 | Health endpoint (no public subdomain) |
| Telegram Bot | 8642 | Internal (Hermes Gateway systemd) |

**Nota:** hermes-agency é acedido via Telegram, não via subdomain público. O health endpoint em :3001 é interno.

## SPEC Reference

- SPEC-058: Hermes Agency Suite (initial)
- SPEC-059: Datacenter Hardening (Redis locks, rate limits, file validation)
