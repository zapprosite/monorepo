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
| MCP Servers | mcp-memory (`:4016`), mcp-ollama (`:4013`), mcp-qdrant (`:4011`), mcp-cron (`:4015`), mcp-coolify (`:4012`), mcp-system (`:4014`) |

## Services

**Public Services (32 containers)**

| Service | URL |
|---------|-----|
| Gitea | `https://gitea.zappro.site` |
| Open WebUI | `https://openwebui.zappro.site` |
| pgAdmin | `https://pgadmin.zappro.site` |
| Obsidian Web | `https://obsidian.zappro.site` |
| AI Gateway | `https://ai.zappro.site` |
| Kokoro TTS | `https://kokoro.zappro.site` |
| Searxng | `https://search.zappro.site` |
| Painel Organism | `https://painel.zappro.site` |

## Agents

- `hermes-agency` — AI agent with voice + vision (`:3001`)
- `mcp-memory` — Memory Agent for persistent context (`:4016`)

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

## Homelab Status

- **Uptime:** 1 day, 15 hours
- **Containers:** 32 running
- **Load:** 0.75 / 0.81 / 1.08
