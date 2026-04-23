---
created: 2026-04-23
updated: 2026-04-23
owner: equipe-ops@zappro.site
status: ativo
version: 1.0.0
---

# Homelab Monorepo

> Plataforma de orquestração de agentes AI — Fastify + tRPC API, React 19 frontend, PostgreSQL (OrchidORM), Qdrant vector DB, Hermes AI agent.

## Stack Tecnológico

| Camada | Tecnologia |
|--------|------------|
| API | Fastify + tRPC + OrchidORM + PostgreSQL |
| Frontend | React 19 + Vite + MUI + TanStack Query |
| AI Gateway | LiteLLM proxy + Ollama + MiniMax |
| Vector DB | Qdrant |
| Agente | Hermes (`:8642`) |
| STT | whisper-medium-pt (`:8204`) |
| Database UI | pgAdmin (`pgadmin.zappro.site`) |
| MCP Servers | mcp-memory (`:4016`), mcp-ollama (`:4013`), mcp-qdrant (`:4011`), mcp-cron (`:4015`), mcp-coolify (`:4012`), mcp-system (`:4014`) |

## Índice

- [Stack Tecnológico](#stack-tecnológico)
- [Serviços](#serviços)
- [Agentes](#agentes)
- [Quick Start](#quick-start)
- [Configuração](#configuração)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Arquitetura](#arquitetura)
- [Contribuir](#contribuir)
- [Licença](#licença)

## Serviços

**32 containers em produção**

| Serviço | URL | Porta |
|---------|-----|-------|
| Gitea | `https://git.zappro.site` | 3300 |
| Open WebUI | `https://openwebui.zappro.site` | 8080 |
| pgAdmin | `https://pgadmin.zappro.site` | 4050 |
| Obsidian Web | `https://obsidian.zappro.site` | 8080 |
| AI Gateway | `https://ai.zappro.site` | 4002 |
| Searxng | `https://search.zappro.site` | 8080 |
| Painel Organism | `https://painel.zappro.site` | 4005 |
| LiteLLM | `https://llm.zappro.site` | 4000 |
| Hermes Agency | `https://hermes-agency.zappro.site` | 8642 |

## Agentes

| Agente | Descrição | Porta |
|--------|-----------|-------|
| `hermes-agency` | AI agent com voice + vision | `:3001` |
| `mcp-memory` | Memory Agent para contexto persistente | `:4016` |
| `mcp-ollama` | Ferramentas Ollama para Claude Code | `:4013` |
| `mcp-qdrant` | Vector DB tools para RAG | `:4011` |
| `mcp-cron` | Agendamento de tarefas | `:4015` |
| `mcp-coolify` | Orquestração de containers | `:4012` |
| `mcp-system` | Info do sistema + ZFS | `:4014` |

## Quick Start

```bash
# Clonar o repositório
git clone https://git.zappro.site/will-zappro/monorepo.git
cd monorepo

# Instalar dependências
pnpm install

# Desenvolvimento (todos os apps)
pnpm dev

# Build de produção
pnpm build

# Lint
pnpm lint

# Type check
pnpm tsc --noEmit
```

## Configuração

### Variáveis de Ambiente

```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/monorepo

# LiteLLM
LITELLM_API_KEY=your-key
LITELLM_MASTER_KEY=your-master-key

# Hermes Agency
HERMES_AGENCY_URL=http://localhost:8642

# Qdrant
QDRANT_URL=http://localhost:6333
```

### Portas dos Serviços

| Serviço | Porta | Descrição |
|---------|-------|----------|
| API Fastify | 3000 | Backend principal |
| PostgreSQL | 5432 | Banco relacional |
| Qdrant | 6333 | Vector DB |
| Redis | 6379 | Cache + sessions |
| Ollama | 11434 | LLM local |
| LiteLLM | 4000 | Proxy multi-provider |
| Hermes | 8642 | Agent gateway |

## Estrutura do Projeto

```
monorepo/
├── apps/
│   ├── painel-organism/    # Dashboard homelab (React)
│   ├── hermes-agency/      # Agente AI principal
│   └── web/                # Frontend principal
├── packages/
│   ├── api/                # Fastify + tRPC
│   ├── db/                 # OrchidORM schemas
│   └── config/             # Shared configs
├── docs/                   # Documentação enterprise
├── scripts/                # Scripts ops
└── agents/                 # Agentes especializados
```

## Arquitetura

```
┌─────────────────────────────────────────────────────────┐
│                    Claude Code CLI                      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   Hermes Agency                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐      │
│  │Creative │  │ Social  │  │Analytics│  │Onboard. │ ...  │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘      │
└─────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
      ┌──────────┐    ┌──────────┐    ┌──────────┐
      │ Mem0    │    │ Qdrant  │    │ Trieve   │
      │ Memory  │    │ RAG     │    │ Search   │
      └──────────┘    └──────────┘    └──────────┘
            │               │               │
            └───────────────┼───────────────┘
                            ▼
                      ┌──────────┐
                      │ LiteLLM  │
                      │ Proxy   │
                      └──────────┘
                            │
         ┌──────────────────┼──────────────────┐
         ▼                  ▼                  ▼
   ┌──────────┐       ┌──────────┐       ┌──────────┐
   │ Ollama  │       │ MiniMax │       │  Groq   │
   │ (RTX)   │       │ Cloud   │       │  Cloud  │
   └──────────┘       └──────────┘       └──────────┘
```

## Comandos

| Cmd | Uso |
|-----|-----|
| `/spec <desc>` | Spec-driven workflow |
| `/pg` | Gerar pipeline a partir de SPECs |
| `/ship` | Commit + push + PR |
| `/turbo` | Commit + merge + tag |
| `/img` | Análise de imagem (Qwen2.5-VL) |

## Documentação

- `docs/SPECS/` — Especificações de features
- `docs/ARCHITECTURE-OVERVIEW.md` — Overview da stack completa
- `docs/HOMELAB-OPS.md` — Manual de operações do homelab
- `docs/HERMES-OPS.md` — Manual do Hermes Agency
- `docs/INFRASTRUCTURE/PORTS.md` — Registo de portas

## Secrets

Todas via `.env`. Ver `.env.example`. Nunca hardcodar.

## Status do Homelab

- **Uptime:** 1 dia, 15 horas
- **Containers:** 32 em execução
- **Load:** 0.75 / 0.81 / 1.08

## Contribuir

1. Fork o repositório
2. Cria um branch: `git checkout -b feature/nome`
3. Commit: `git commit -m 'feat: adiciona feature'`
4. Push: `git push origin feature/nome`
5. Abre um Pull Request

## Licença

MIT License — Copyright © 2026 [zappro.site](https://zappro.site)