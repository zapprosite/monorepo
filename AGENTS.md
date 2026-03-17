# Monorepo Agent Governance

**Project:** homelab-monorepo
**Location:** /srv/monorepo
**Tech Stack:** Fastify + tRPC + React 19 + Vite + Orchid ORM + PostgreSQL
**Source of Truth:** /srv/ops/ai-governance/ (for infrastructure)

## Actual Architecture

```
monorepo/
├── apps/
│   ├── backend/       # Fastify + tRPC API (Node 22+, TypeScript 5.9)
│   │   ├── src/
│   │   │   ├── db/         # Orchid ORM tables and config
│   │   │   ├── configs/    # Environment and logger config
│   │   │   ├── middlewares/ # Fastify middleware (error handler)
│   │   │   ├── modules/    # Auth, OAuth2, session management
│   │   │   ├── utils/      # Error parser, request metadata
│   │   │   ├── app.ts      # Fastify instance + tRPC plugin
│   │   │   ├── server.ts   # Entry point with OpenTelemetry
│   │   │   ├── trpc.ts     # tRPC setup, error formatting
│   │   │   └── router.trpc.ts # All tRPC routes
│   │   ├── dist/      # Compiled output (SWC transpilation)
│   │   └── tsconfig.json
│   │
│   └── frontend/      # React 19 + Vite + TanStack Query
│       ├── src/
│       │   ├── components/  # Reusable components
│       │   ├── pages/       # Page components (DatabaseDemo, etc)
│       │   ├── modules/     # Feature modules (auth)
│       │   ├── App.tsx      # tRPC client + React Query setup
│       │   ├── router.tsx   # React Router config
│       │   └── main.tsx     # Entry point
│       ├── dist/     # Vite build output
│       └── vite.config.ts
│
├── packages/
│   ├── typescript-config/  # Shared TS configs (base, library, react-library, vite)
│   ├── ui-mui/             # Material-UI component library (direct imports, no barrel exports)
│   │   ├── src/
│   │   │   ├── form/       # Form components (Button, TextField, Checkbox, etc)
│   │   │   ├── feedback/   # Alerts, spinners, dialogs
│   │   │   ├── data-display/ # Lists, tables, tooltips
│   │   │   ├── navigation/ # AppBar, menu, pagination
│   │   │   ├── icons/      # Icon exports
│   │   │   ├── mrt/        # Material React Table
│   │   │   ├── rhf-form/   # React Hook Form integration
│   │   │   └── theme/      # ThemeProvider, theme config
│   │   └── tsconfig.json
│   │
│   └── zod-schemas/       # Shared Zod validation schemas
│       ├── src/
│       │   ├── user.zod.ts           # User entity schemas
│       │   ├── team.zod.ts           # Team schemas
│       │   ├── api_request_log.zod.ts # Request logging
│       │   ├── journal_entry.zod.ts  # Journal entries
│       │   ├── prompt.zod.ts         # Prompts
│       │   ├── subscription.zod.ts   # Subscriptions
│       │   ├── webhook_call_queue.zod.ts # Webhook queue
│       │   ├── enums.zod.ts          # Shared enums
│       │   ├── node_env.ts           # Environment validation
│       │   └── zod_utils.ts          # Utilities (zString, zPrice, zGSTIN, zTimestamps)
│       └── tsconfig.json
│
├── turbo.json         # Turbo build system config
├── pnpm-workspace.yaml # pnpm monorepo config
├── package.json       # Root workspaces config
├── pnpm-lock.yaml     # Lock file (pnpm)
├── CLAUDE.md          # This file—guidance for Claude Code
├── AGENTS.md          # This file—agent governance
├── .npmrc             # npm/pnpm configuration
├── biome.json         # Linting and formatting config
└── .env.example       # Environment variables template
```

## Key Files & Commands

### Development
```bash
# Install all dependencies
yarn install

# Start development (both apps)
yarn dev

# Build all
yarn build

# Type checking
yarn check-types

# Linting
yarn lint

# Format code
yarn format

# Database migration
yarn run db g <migration_name>  # Generate migration
yarn run db up                  # Run migrations
```

### Architecture Patterns

**Import Pattern (Critical):**
- ✅ Direct imports: `import { Button } from '@connected-repo/ui-mui/form/Button'`
- ✅ Schema imports: `import { userCreateInputZod } from '@connected-repo/zod-schemas/user.zod'`
- ❌ NO barrel exports or package-level imports

**Backend tRPC Procedures:**
- `publicProcedure` - Unauthenticated endpoints
- `protectedProcedure` - Requires auth + database error handling

**Session Management:**
- Database-backed (DatabaseSessionStore)
- Tracks: user info, IP, user agent, browser, OS, device, fingerprint
- Auto-captures metadata on creation
- Expiry: 7 days (configurable)

**Error Handling:**
- tRPC Error Formatter → Database errors → Fastify middleware
- Zod validation errors → 400 with field-level details
- Database constraint violations → 409 or 400
- Not found → 404

## Rules for Agents

### ✅ FREE TO MODIFY
- Code in `apps/backend/`, `apps/frontend/`
- Code in `packages/typescript-config/`, `packages/ui-mui/`, `packages/zod-schemas/`
- Tests, documentation, build scripts
- Dependency versions (with test validation)
- README.md, AGENTS.md, CLAUDE.md (documentation)
- Environment examples (`.env.example`)

### ⚠️ REQUIRES APPROVAL
- Changing `turbo.json` (build system)
- Changing `pnpm-workspace.yaml` (workspace structure)
- Changing `.github/` directory
- Removing packages or major features
- Breaking API changes (backend routes, tRPC procedures)
- Database schema changes (new tables)

### ❌ FORBIDDEN
- Hardcoding secrets in source code
- Committing `.env` files
- Modifying anything in `/srv/ops/` (host governance)
- Deleting `/srv/data/` or `/srv/backups/`
- Removing error handlers or security features

## Commands You Can Run Freely

```bash
yarn check-types    # ✅ Safe
git commit -m       # ✅ Safe (Must follow Conventional Commits)
git push            # ✅ Safe (Only to feature/* branches directly, PR to develop/main)
```

## Git Governance (Senior Standard)

### Branching Model
- **`main`**: Production-only. Matches current release.
- **`develop`**: Primary integration branch.
- **`feature/`**: Feature development.
- **`fix/`**: Bug fixes.
- **`hotfix/`**: Critical production patches.

### Commit Guidelines
All commits MUST follow **Conventional Commits**:
- `feat`: New capability
- `fix`: Bug resolution
- `chore`: Maintenance (deps, internal config)
- `refactor`: Structural changes
- `docs`: Documentation updates

### Merge Strategy
- PRs are required for `develop` and `main`.
- Merge into `develop` via Squash & Merge to keep history clean.

## When Modifying Host Infrastructure

If monorepo changes affect infrastructure:
1. Stop and read `/srv/ops/ai-governance/CONTRACT.md`
2. Example: "This requires Docker restart" → consult host governance
3. Never combine monorepo + infrastructure changes
4. Docker, systemctl, ZFS operations → host procedure

## Note: Package Manager Strategy

**Current:** Yarn (v1.22.22) for compatibility and stability
**Future:** pnpm-workspace.yaml is prepared for migration to pnpm@9+ when environment fully supports it

## Special Patterns

### Adding New Backend Endpoint
1. Create Zod schema in `packages/zod-schemas/src/<entity>.zod.ts`
2. Add procedure to `apps/backend/src/router.trpc.ts`
3. Frontend auto-gets types via tRPC import

### Adding New UI Component
1. Create in `apps/frontend/src/components/` (local)
2. OR add to `packages/ui-mui/src/<category>/<Component>.tsx` (shared)
3. Export directly from file (no barrel exports)

### Adding New Table/Entity
1. Table class: `apps/backend/src/db/tables/<entity>.table.ts`
2. Zod schema: `packages/zod-schemas/src/<entity>.zod.ts`
3. Register in `apps/backend/src/db/db.ts`
4. tRPC procedure: `apps/backend/src/router.trpc.ts`

---

**Delegation:** When unsure about infrastructure impact, read /srv/ops/ai-governance/CONTRACT.md
