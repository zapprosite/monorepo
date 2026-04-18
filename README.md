# homelab-monorepo

Agent orchestration platform — Fastify + tRPC API, React 19 frontend, PostgreSQL (OrchidORM), Qdrant vector DB, Hermes AI agent.

## Stack

| Layer | Tech |
|-------|------|
| API | Fastify + tRPC + OrchidORM + PostgreSQL |
| Frontend | React 19 + Vite + MUI + TanStack Query |
| AI Gateway | LiteLLM proxy + Ollama + MiniMax |
| Vector DB | Qdrant |
| Agent | Hermes (`:8642`) |
| TTS | Kokoro + TTS Bridge (`:8013`) |
| STT | whisper-medium-pt (`:8204`) |
| Database UI | pgAdmin (`pgadmin.zappro.site`) |

## Quick Start

```bash
pnpm install
pnpm dev          # All apps
pnpm build        # Production build
pnpm lint         # Lint
pnpm tsc --noEmit # Type check
```

## Apps

- `apps/api` — Fastify + tRPC API server
- `apps/web` — React 19 frontend
- `apps/ai-gateway` — OpenAI-compatible LLM facade (`:4002`)
- `apps/hermes-agency` — AI agent with voice + vision

## Commands

| Cmd | Use |
|-----|-----|
| `/spec <desc>` | Spec-driven workflow |
| `/pg` | Generate pipeline from SPECs |
| `/ship` | Commit + push + PR |
| `/turbo` | Commit + merge + tag |
| `/img` | Image analysis (Qwen2.5-VL) |

## Docs

- `docs/SPECS/` — Feature specifications
- `docs/ARCHITECTURE-OVERVIEW.md` — Full stack overview
- `docs/INFRASTRUCTURE/PORTS.md` — Port registry

## Secrets

All via `.env`. See `.env.example`. Never hardcode.
