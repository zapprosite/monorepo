---
type: doc
name: project-overview
description: High-level overview of the project, its purpose, and key components
category: overview
generated: 2026-03-16
updated: 2026-03-17
status: active
scaffoldVersion: "2.0.0"
---
## Project Overview

**connected-repo** é um monorepo full-stack de produção para desenvolvimento rápido de aplicações web. Funciona como uma **fábrica de features**: dado um nome de entidade, gera automaticamente schema, ORM, API e UI com `/scaffold`.

**Stack:** Fastify 5 + tRPC 11 + React 19 + Orchid ORM + PostgreSQL 15 + Zod 4

## Quick Facts

| Item | Valor |
|------|-------|
| Package manager | Yarn 1.22 + workspaces |
| Build system | Turbo 2 |
| Node.js | 22+ |
| Licença | AGPL-3.0-only |
| Backend port | **4000** (não 3000 — CapRover) |
| Frontend port | 5173 |
| DB | PostgreSQL em `localhost:5432` |

## Estrutura

```
apps/
├── backend/    — Fastify API (tRPC interno + REST/OpenAPI externo)
└── frontend/   — React 19 SPA (tRPC client + TanStack Query)

packages/
├── zod-schemas/       — Schemas Zod compartilhados (tipo-safe ponta a ponta)
├── ui-mui/            — Biblioteca de componentes Material-UI
└── typescript-config/ — TSConfigs base

.agent/        — Antigravity Kit (21 agentes, 37 skills, 13 workflows)
.claude/       — Slash commands Claude Code (/scaffold, /feature, /ship, /turbo...)
.context/      — Documentação semântica do projeto
```

## Fluxo de Desenvolvimento

```
/feature → implementar → /ship → PR → CI → merge
```

Para criar um módulo completo do zero:
```
/scaffold → nome da entidade → gera Zod + ORM + tRPC + frontend
```

## Comandos Essenciais

```bash
yarn install          # deps
docker compose up -d  # PostgreSQL
yarn db -- up         # migrations
yarn dev              # backend :4000 + frontend :5173
yarn test             # Vitest
yarn build            # produção
```

## AI Agents & Workflows

Este repo tem um sistema de agentes integrado ao Claude Code:

| Slash Command | Função |
|---------------|--------|
| `/scaffold` | Gera módulo full-stack completo |
| `/feature` | Cria branch criativa + upstream |
| `/ship` | Commit semântico + PR |
| `/turbo` | Commit + merge + tag + branch (pressa) |

Ver `.agent/ARCHITECTURE.md` para catálogo completo.

## Governância de Portas

⚠️ Este host tem serviços em portas específicas. Sempre consultar:
[`/srv/ops/ai-governance/PORTS.md`](/srv/ops/ai-governance/PORTS.md)

## Getting Started

```bash
git clone <repo>
cd monorepo
cp .env.example .env   # editar com suas credenciais
yarn install
docker compose up -d
yarn db -- up
yarn dev
```

## Related Resources

- [architecture.md](./architecture.md)
- [development-workflow.md](./development-workflow.md)
- [tooling.md](./tooling.md)
- [testing-strategy.md](./testing-strategy.md)
