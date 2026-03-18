# connected-repo

Full-stack monorepo — Fastify · tRPC · React 19 · Orchid ORM · PostgreSQL

## Stack

| Camada | Tecnologia |
|--------|-----------|
| Runtime | Node.js 22+ |
| Backend | Fastify 5 + tRPC 11 |
| Frontend | React 19 + Vite 7 + React Router 7 |
| ORM | Orchid ORM + PostgreSQL 15 |
| Validação | Zod 4 (compartilhado entre back e front) |
| UI | Material-UI via `@connected-repo/ui-mui` |
| Build | Turbo 2 + Yarn workspaces |
| Qualidade | Biome (lint + format) + TypeScript 5.9 |

## Estrutura

```
apps/
├── backend/     # Fastify API — tRPC (interno) + REST/OpenAPI (externo)
└── frontend/    # React SPA — tRPC client + TanStack Query

packages/
├── zod-schemas/       # Schemas Zod compartilhados (tipo-safe ponta a ponta)
├── ui-mui/            # Biblioteca de componentes Material-UI
└── typescript-config/ # TSConfigs base reutilizáveis
```

## Início Rápido

```bash
# 1. Instalar dependências
yarn install

# 2. Subir banco
docker compose up -d

# 3. Rodar migrations
yarn db -- up

# 4. Iniciar dev (backend + frontend em paralelo)
yarn dev
```

Acesse:
- Frontend: http://localhost:5173
- Backend API: http://localhost:4000
- Swagger UI: http://localhost:4000/api/documentation

> **Nota de porta:** este host usa a porta 3000 para o CapRover.
> O backend roda na **4000** (`PORT=4000` no `.env`).
> Ver mapa completo: [`/srv/ops/ai-governance/PORTS.md`](/srv/ops/ai-governance/PORTS.md)

## Comandos

```bash
yarn dev             # Inicia todos os apps em modo watch
yarn build           # Build de produção
yarn check-types     # Verificação de tipos (todos os pacotes)
yarn test            # Testes (Vitest)
yarn format          # Formata com Biome
yarn db -- g <name>  # Gera nova migration
yarn db -- up        # Aplica migrations pendentes
```

## Agentes e Workflows (Claude Code)

Este repositório usa o **Antigravity Kit** — sistema de agentes e workflows ativados via `/comando`:

| Comando | O que faz |
|---------|-----------|
| `/scaffold` | Gera módulo full-stack completo (Zod + table + tRPC + frontend) |
| `/feature` | Cria branch de feature com nome criativo + upstream |
| `/ship` | Commit semântico + push + PR no GitHub |
| `/turbo` | Commit + merge + tag + nova branch (modo pressa) |
| `/commit` | Gera mensagem de commit seguindo Conventional Commits |
| `/code-review` | Review dos últimos N commits |

Ver `.agent/ARCHITECTURE.md` para o catálogo completo de agentes e skills.

## Arquitetura de API

```
Frontend  ──tRPC──▶  Backend (interno, type-safe)

External  ──REST──▶  API Gateway ──▶ Backend
                    (OpenAPI/Swagger UI em /api/documentation)
```

- **tRPC**: comunicação frontend ↔ backend (sem boilerplate, tipo-safe end-to-end)
- **REST/OpenAPI**: APIs de produto externas com Swagger UI

## Adicionando um Novo Módulo

Use `/scaffold` ou siga manualmente:

1. `packages/zod-schemas/src/[entity].zod.ts` — schemas Zod
2. `apps/backend/src/modules/[entities]/tables/[entity].table.ts` — Orchid ORM table
3. `apps/backend/src/modules/[entities]/[entities].trpc.ts` — tRPC procedures
4. Registrar table em `db/db.ts` e router em `routers/trpc.router.ts`
5. `yarn db -- g create_[entities]_table && yarn db -- up`
6. `apps/frontend/src/modules/[entities]/` — pages + router

Ver `apps/backend/CLAUDE.md` para convenções detalhadas.

## Licença

AGPL-3.0-only
