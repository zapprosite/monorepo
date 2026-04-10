# Connected Repo

Full-stack monorepo — Fastify · tRPC · React 19 · Orchid ORM · PostgreSQL

## Stack

| Layer | Tech |
|-------|------|
| Backend | Fastify 5 + tRPC 11 |
| Frontend | React 19 + Vite 7 + React Router 7 |
| ORM | Orchid ORM + PostgreSQL 15 |
| Validation | Zod 4 (shared) |
| UI | Material-UI (@connected-repo/ui-mui) |
| Build | Turbo 2 + Yarn workspaces |
| Quality | Biome (lint) + TypeScript 5.9 |

## Structure

```
apps/
├── api/     # Fastify API — tRPC (internal) + REST/OpenAPI (external)
└── web/     # React SPA — tRPC client + TanStack Query

packages/
├── zod-schemas/       # Shared Zod schemas
├── ui-mui/            # Material-UI components
└── typescript-config/ # TSConfigs
```

## Quick Start

```bash
# Install + start
yarn install
docker compose up -d
yarn db -- up
yarn dev
```

Access:
- Frontend: http://localhost:5173
- API: http://localhost:4000
- Swagger: http://localhost:4000/api/documentation

## Commands

```bash
yarn dev        # Dev mode (all apps)
yarn build      # Production build
yarn test       # Tests (Vitest)
yarn format     # Biome format
yarn lint       # Biome lint
yarn db -- g    # Generate migration
yarn db -- up   # Apply migrations
```

## Adding Features

1. Create SPEC: `/spec <description>`
2. Generate tasks: `/pg`
3. Implement following SPEC
4. Ship: `/ship`

Manual:
1. `packages/zod-schemas/src/<entity>.zod.ts` — Zod schemas
2. `apps/api/src/modules/<entity>/tables/<entity>.table.ts` — DB table
3. `apps/api/src/modules/<entity>/<entity>.trpc.ts` — tRPC procedures
4. Register in `db/db.ts` and `routers/trpc.router.ts`
5. `yarn db -- g <name>` then `yarn db -- up`
6. `apps/web/src/modules/<entity>/` — pages + routes

See `apps/*/CLAUDE.md` for details.

## License

AGPL-3.0-only
