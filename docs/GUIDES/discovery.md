# Discovery — homelab-monorepo

> Project discovery log. Updated 2026-04-10.

---

## Project Overview

**homelab-monorepo** is a full-stack monorepo serving the will-zappro homelab infrastructure.

| Field | Value |
|-------|-------|
| Repository | `git@github.com:zapprosite/homelab-monorepo.git` |
| Package Manager | pnpm 9.0.0 |
| Node | >=22 |
| License | AGPL-3.0-only |

---

## Tech Stack

| Layer | Tech | Notes |
|-------|------|-------|
| Backend API | Fastify 5 + tRPC 11 | REST/OpenAPI on external routes |
| Frontend | React 19 + Vite 7 + React Router 7 | TanStack Query + tRPC client |
| ORM | Orchid ORM + PostgreSQL 15 | DB-backed sessions, snake_case columns |
| Validation | Zod 4 (shared) | Entity schemas in packages/zod-schemas |
| UI | @connected-repo/ui-mui (MUI) | Component library via workspace packages |
| Build | Turbo 2 + pnpm workspaces | `turbo.json` pipeline |
| Quality | Biome 2.3 + TypeScript 5.9 | Lint + format + type checking |

---

## Directory Structure

```
/srv/monorepo/
├── apps/
│   ├── api/            # Fastify API — tRPC (internal) + REST/OpenAPI (external)
│   ├── web/            # React SPA — tRPC client + TanStack Query
│   ├── orchestrator/   # Agent runner (Node.js + tRPC + YAML)
│   ├── perplexity-agent/
│   └── workers/
├── packages/
│   ├── zod-schemas/    # Shared Zod schemas (entity validators)
│   ├── config/         # @repo/typescript-config (shared tsconfigs)
│   ├── trpc/           # Shared tRPC client/server utilities
│   ├── ui/             # @connected-repo/ui-mui (MUI components)
│   ├── email/
│   └── db/
├── scripts/            # Operational scripts (see below)
├── docs/
│   ├── SPECS/          # Feature specifications (SPEC-*.md)
│   ├── ADRs/           # Architecture Decision Records (MADR format)
│   ├── GUIDES/         # How-to guides
│   └── REFERENCE/      # Technical references
├── smoke-tests/        # Playwright E2E + smoke scripts
├── .claude/            # Claude Code config, skills, workflows, commands
├── .agent/             # Antigravity Kit — 18 specialist agents, 20 workflows
├── .gitea/workflows/    # Gitea Actions (ci-feature, code-review, deploy-main, rollback)
├── docker-compose.yml  # Local dev containers
├── turbo.json          # Build/test/lint pipeline
└── pnpm-workspace.yaml # Workspace root definition
```

---

## Apps

### apps/api

- **Stack:** Fastify 5 + tRPC 11 + Orchid ORM + PostgreSQL 15
- **Entry:** `apps/api/src/server.ts`
- **DB:** `apps/api/src/db/` — tables, migrations, seed
- **Modules:** `apps/api/src/modules/` — CRM entities (leads, equipment, service orders, contracts, etc.)
- **tRPC:** Procedures in `apps/api/src/routers/trpc.router.ts`
- **REST:** OpenAPI routes via FastifyZodOpenApiTypeProvider at `/api/documentation`
- **Middleware chain:** apiKeyAuth → corsValidation → whitelistCheck → rateLimit → subscriptionCheck → requestLogger
- **Session:** Database-backed (DatabaseSessionStore), soft-delete (`markedInvalidAt`), 7-day expiry
- **Scripts:** `db:migrate`, `db:seed`
- **CLAUDE.md:** `/srv/monorepo/apps/api/CLAUDE.md`

### apps/web

- **Stack:** React 19 + Vite 7 + React Router 7 + TanStack Query + tRPC Client
- **Entry:** `apps/web/src/main.tsx` → `App.tsx`
- **Modules:** `apps/web/src/modules/<entity>/` — pages, routes, components per entity
- **Forms:** React Hook Form + Zod resolver
- **State:** Zustand (global), React local state
- **MUI:** Via `@connected-repo/ui-mui` workspace package
- **Import style:** Direct tree-shaking imports — `import { Button } from '@connected-repo/ui-mui/form/Button'`
- **No barrel imports** from package root
- **CLAUDE.md:** `/srv/monorepo/apps/web/CLAUDE.md`

### apps/orchestrator

- Node.js + tRPC + YAML config
- Human gates integration
- Drives autonomous CI/CD cursor loops

### apps/workers, apps/perplexity-agent

- Background processing and external agent integrations

---

## Packages

### packages/zod-schemas

- **Name:** `@repo/zod-schemas`
- **Purpose:** Shared validation schemas for backend/frontend consistency
- **Location:** `packages/zod-schemas/src/*.zod.ts`
- **Entities:** address, client, contact, equipment, lead, service_order, contract, subscription, user, webhooks, mcp-conectores, etc. (~30+ entities)
- **Pattern per entity:**
  - `<Entity>MandatoryZod`, `<Entity>OptionalZod`
  - `<Entity>CreateInputZod`, `<Entity>UpdateInputZod`
  - `<Entity>GetByIdZod`, `<Entity>SelectAllZod`
- **Validators:** `zString`, `zVarchar`, `zText`, `zPrice`, `zQuantity`, `zAmount`, `zGSTIN`, `zPAN`, `zPhoneNumber`, `zTimestamps`
- **Build:** `tsc && tsc-alias` → `dist/`

### packages/config

- **Name:** `@repo/typescript-config`
- **Purpose:** Shared TypeScript configurations for workspace packages

### packages/trpc

- Shared tRPC client/server utilities

### packages/ui

- **Name:** `@connected-repo/ui-mui`
- **Purpose:** Material-UI component library
- **Import:** Named direct imports (tree-shaking), no barrel imports

### packages/email, packages/db

- Email utilities and shared database helpers

---

## Scripts (in /srv/monorepo/scripts/)

| Script | Purpose |
|--------|---------|
| `approve.sh` | Human gate approval for pipeline steps |
| `auto-fix.sh` | Automatic fix for lint/type errors |
| `backup.sh` | Backup snapshots (ZFS-aware) |
| `bootstrap-check.sh` | Pre-flight checks before CI bootstrap |
| `bootstrap-effect.sh` | Bootstrap effect executor |
| `cursor-loop-refactor.sh` | Refactor phase of cursor loop |
| `cursor-loop-research.sh` | Research phase of cursor loop |
| `cursor-loop-runner.sh` | Main cursor loop orchestration |
| `db-migrate.sh` | Run Orchid ORM migrations |
| `db-seed.sh` | Seed database |
| `deploy.sh` | Deploy application |
| `health-check.sh` | Health check for running services |
| `mirror-push.sh` | Push to both Gitea and GitHub simultaneously |
| `pipeline-runner.sh` | Execute pipeline tasks |
| `pipeline-state.sh` | Query/update pipeline state |
| `pipeline-watcher.sh` | Watch for pipeline changes |
| `query-gate.sh` | Query gate decisions |
| `restore.sh` | Restore from backup |
| `sync-env.js` | Sync environment variables |
| `unblock.sh` | Unblock stuck operations |
| `validate-env.sh` | Validate environment configuration |

---

## Docs Structure

```
docs/
├── SPECS/          # Feature specifications (SPEC-*.md, 20+ specs)
├── ADRs/           # Architecture Decision Records (MADR format, 22+ ADRs)
│   └── README.md   # ADR index with legacy + new numbering
├── GUIDES/         # How-to guides
│   ├── AI-CONTEXT.md
│   ├── ARCHITECTURE-MASTER.md
│   ├── ARCHITECTURE-MODELS.md
│   ├── CLI-SHORTCUTS.md
│   ├── TOOLCHAIN.md
│   ├── WORKFLOW.md
│   └── discovery.md  ← this file
├── REFERENCE/      # Technical references
│   └── README.md
├── index.md        # Docs entry point
├── CLAUDE.md       # Enterprise docs rules
└── archive/        # Archived docs (read-only)
obsidian/           # Read-only mirror of docs/
```

### SPECS Index (highlights)

| SPEC | Title |
|------|-------|
| SPEC-002 | Homelab Network Refactor |
| SPEC-007 | OpenClaw OAuth Profiles |
| SPEC-009 | OpenClaw Persona Audio Stack |
| SPEC-010 | OpenClaw Agents Kit |
| SPEC-013 | Claude Code CLI Integration |
| SPEC-014 | Cursor AI CI/CD Pattern |
| SPEC-016 | Voice Pipeline Cursor Loop |
| SPEC-019 | OpenWebUI Repair |
| SPEC-021 | Claude Code Cursor Loop |

### ADRs Index (highlights)

- `001` — Governanca Centralizada
- `002` — Dev Environment VRV Bot
- `20260317` — CRM Refrimix
- `20260404` — Voice Dev Pipeline
- Legacy: `0001`–`0010` (CRM entities), `20240401`–`20240403` (early governance)

---

## Root Scripts

```bash
# Install
pnpm install

# Development
pnpm dev              # Start all apps (turbo dev)
pnpm build            # Sync env + turbo build
pnpm clean            # Remove node_modules + .pnpm-store

# Database
pnpm db:migrate       # Run migrations (turbo db:migrate --)
pnpm db:seed          # Seed database

# Quality
pnpm lint             # Biome lint (turbo run lint)
pnpm format           # Biome format
pnpm check-types      # TypeScript type check
pnpm test             # Run tests

# Utilities
pnpm env:sync         # node scripts/sync-env.js
pnpm syncpack         # syncpack format
```

---

## Build Pipeline (turbo.json)

```json
{
  "pipeline": {
    "build":     { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "test":      { "dependsOn": ["build"], "outputs": ["coverage/**"] },
    "lint":      { "outputs": [] },
    "typecheck": { "dependsOn": ["build"], "outputs": [] },
    "dev":       { "cache": false, "persistent": true },
    "db:migrate":{ "cache": false },
    "db:seed":   { "cache": false }
  }
}
```

---

## Key Files

| File | Purpose |
|------|---------|
| `/srv/monorepo/AGENTS.md` | Agent system, workflows, tools |
| `/srv/monorepo/CLAUDE.md` | Project rules |
| `/srv/monorepo/apps/api/CLAUDE.md` | API development rules |
| `/srv/monorepo/apps/web/CLAUDE.md` | Frontend development rules |
| `/srv/monorepo/packages/zod-schemas/CLAUDE.md` | Zod schema patterns |
| `/srv/monorepo/turbo.json` | Build pipeline |
| `/srv/monorepo/pnpm-workspace.yaml` | Workspace definition |
| `/srv/monorepo/docker-compose.yml` | Local dev containers |
| `/srv/monorepo/.claude/scheduled_tasks.json` | Cron jobs |

---

## Ports (Local Dev)

| Port | Service |
|------|---------|
| 5173 | Vite frontend dev server |
| 4000 | API (Fastify) |
| 5432 | PostgreSQL |

---

## Related Governance

For infrastructure decisions (Docker, ZFS, services):
- `./GOVERNANCE/CONTRACT.md`
- `./GOVERNANCE/GUARDRAILS.md`
- `./INFRASTRUCTURE/NETWORK_MAP.md`
- `./INFRASTRUCTURE/PORTS.md`
- `./INFRASTRUCTURE/SUBDOMAINS.md`