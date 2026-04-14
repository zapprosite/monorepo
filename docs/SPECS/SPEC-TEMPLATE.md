---
name: SPEC-TEMPLATE
description: Template for feature specifications in SPECS/ directory
status: PROPOSED
priority: medium
author: Principal Engineer
date: YYYY-MM-DD
specRef: related SPECs (optional)
---

# SPEC-NNN: [Feature Name]

> ⚠️ **SPEC-009 Audio Stack:** Se a feature envolve STT/TTS/voice, verificar SPEC-009 antes de propor mudanças. Motor STT é wav2vec2 :8201 (PROIBIDO trocar por Whisper). TTS via TTS Bridge :8013 (PROIBIDO Kokoro direto).

> ⚠️ **Governance:** Antes de modificar serviços imutáveis (Kokoro, wav2vec2, OpenClaw), verificar docs/GOVERNANCE/IMMUTABLE-SERVICES.md e .claude/rules/ para regras de aprovação.

---

## Objective

[One-paragraph description of what this feature does and why it exists. Who benefits and how.]

---

## Tech Stack

| Component     | Technology         | Notes                                 |
| ------------- | ------------------ | ------------------------------------- |
| Backend       | Fastify + tRPC     | `/srv/monorepo/apps/api`              |
| ORM           | Orchid ORM         | PostgreSQL via `@orchestrator/shared` |
| Frontend      | React 19 + MUI     | `/srv/monorepo/apps/web`              |
| Monorepo Tool | Turbo + pnpm@9.0.0 | Build orchestration                   |
| Validation    | Zod                | Shared between frontend/backend       |
| HTTP Client   | ofetch             | Typed fetch for tRPC                  |
| Icons         | Lucide React       | Consistent icon set                   |

---

## Commands

```bash
# Build all apps
pnpm turbo build

# Type check all apps
pnpm turbo typecheck

# Lint all apps (Biome)
pnpm turbo lint

# Run tests (vitest unit + playwright e2e)
pnpm turbo test

# Run unit tests only
pnpm --filter api vitest run
pnpm --filter web vitest run

# Run e2e tests only
pnpm --filter web playwright test

# Run dev server (api)
pnpm --filter api dev

# Run dev server (web)
pnpm --filter web dev

# Format code
pnpm turbo format

# OpenWebUI health (if applicable)
curl -sf http://localhost:3000/health
```

---

## Project Structure

```
/srv/monorepo/
├── apps/
│   ├── api/                          # Fastify + tRPC backend
│   │   ├── src/
│   │   │   ├── app.ts               # Fastify app entry
│   │   │   ├── server.ts            # Server bootstrap
│   │   │   ├── trpc.ts              # tRPC initialization
│   │   │   ├── router.ts            # Root router
│   │   │   ├── db/                  # Orchid ORM setup
│   │   │   ├── modules/             # Feature modules (procedures + routers)
│   │   │   ├── routers/             # tRPC routers
│   │   │   ├── middlewares/         # Fastify middlewares
│   │   │   ├── utils/               # Shared utilities
│   │   │   └── __tests__/           # Unit tests (vitest)
│   │   └── package.json
│   │
│   └── web/                          # React 19 + MUI frontend
│       ├── src/
│       │   ├── App.tsx              # Root component
│       │   ├── main.tsx             # Entry point
│       │   ├── router.tsx           # React Router setup
│       │   ├── pages/               # Route pages
│       │   ├── components/          # Shared components
│       │   ├── contexts/            # React contexts
│       │   ├── modules/             # Feature modules
│       │   ├── utils/               # Utilities
│       │   └── __tests__/           # Tests + e2e (playwright)
│       └── package.json
│
├── packages/
│   └── shared/                       # Shared Zod schemas + types
│       └── src/
│
├── turbo.json                        # Turbo pipeline config
├── biome.json                       # Biome linter/formatter config
└── pnpm-workspace.yaml              # pnpm workspace config
```

---

## Code Style

### Naming Conventions

Based on `biome.json` conventions:

| Element          | Convention                              | Example                                 |
| ---------------- | --------------------------------------- | --------------------------------------- |
| Files            | `kebab-case.ts`                         | `user-profile.ts`, `auth-middleware.ts` |
| Functions        | `camelCase`                             | `createUser()`, `validateToken()`       |
| Types/Classes    | `PascalCase`                            | `UserProfile`, `AuthToken`              |
| Constants        | `SCREAMING_SNAKE_CASE`                  | `MAX_RETRY_COUNT`, `API_BASE_URL`       |
| Interfaces       | `PascalCase` with `I` prefix (optional) | `IUserProfile` or `UserProfile`         |
| React Components | `PascalCase`                            | `UserProfilePage.tsx`                   |
| Enums            | `PascalCase`                            | `UserRole`, `OrderStatus`               |
| CSS Variables    | `kebab-case`                            | `--color-primary`, `--spacing-md`       |

### Formatting Rules

- **Indent:** Tabs (configured in biome.json)
- **Line width:** 100 characters
- **Quotes:** Double quotes in JS/TS (configured in biome.json)
- **Semicolons:** Required
- **Trailing commas:** Required in multi-line structures

### Key Patterns

```typescript
// tRPC router pattern
import { z } from 'zod';
import { protectedProcedure, publicProcedure, router } from '../trpc';

export const userRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().min(1).max(100) }))
    .query(async ({ input }) => {
      return db.user.findMany({ take: input.limit });
    }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), email: z.string().email() }))
    .mutation(async ({ input }) => {
      return db.user.create({ data: input });
    }),
});

// Fastify route pattern
import type { FastifyPluginAsync } from 'fastify';

const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/users', async (request, reply) => {
    return reply.send({ users: [] });
  });
};

// React component with tRPC
import { trpc } from '@/utils/trpc';

export function UserList() {
  const { data } = trpc.user.list.useQuery({ limit: 10 });
  return <ul>{data?.map((u) => <li key={u.id}>{u.name}</li>)}</ul>;
}
```

---

## Testing Strategy

| Level       | Scope                                    | Framework             | Location                                                                |
| ----------- | ---------------------------------------- | --------------------- | ----------------------------------------------------------------------- |
| Unit        | Isolated logic, pure functions           | `vitest`              | `apps/api/src/__tests__/*.test.ts`, `apps/web/src/__tests__/*.test.tsx` |
| Integration | tRPC routers, database queries           | `vitest` with test DB | `apps/api/src/__tests__/**/*.test.ts`                                   |
| Smoke       | Quick health check                       | `vitest --smoke`      | CI pre-commit                                                           |
| E2E         | Full user flow (login, CRUD, navigation) | `playwright`          | `apps/web/src/__tests__/e2e/*.spec.ts`                                  |

### Coverage Targets

- **Minimum:** 80% line coverage for new code
- **Critical paths:** 100% (auth, payment, data mutations)
- **Report:** Generated via `vitest --coverage`

### Running Tests

```bash
# All tests
pnpm turbo test

# Unit only
pnpm turbo test:unit

# E2E only
pnpm turbo test:e2e

# With coverage
pnpm turbo test:coverage

# Watch mode
pnpm vitest run --watch
```

---

## Boundaries

### Always

- Create ZFS snapshot before any destructive change (`zfs snapshot tank@pre-YYYYMMDD-HHMMSS`)
- Use Infisical for all secrets — never hardcode credentials in code
- Run `pnpm turbo typecheck` before commit
- Run `pnpm turbo lint` before commit
- Follow naming conventions from biome.json
- Update memory index after significant changes (sync.sh)
- Document architecture decisions in ADR before implementing

### Ask First

- Any change to `/srv/ops/` (host-level infrastructure)
- Adding new environment variables (may affect deployments)
- Database schema changes (Orchid ORM migrations)
- Adding new npm dependencies (validate with `pnpm audit`)
- Exposing new ports (check PORTS.md + SUBDOMAINS.md first)
- Changes to authentication/authorization flow

### Never

- Commit `.env` files or any file with credentials
- Use `dd` or `wipefs` on any disk
- Delete `/srv/data`, `/srv/backups`, `/srv/docker-data`
- Destroy ZFS pools
- Reboot without explicit plan
- Hardcode secrets (use Infisical SDK instead)
- Bypass pre-commit hooks
- Open ports without updating PORTS.md + SUBDOMAINS.md

---

## Success Criteria

| #    | Criterion                                                                     | Verification                                                                     |
| ---- | ----------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| SC-1 | All turbo commands (`build`, `lint`, `typecheck`, `test`) pass without errors | `pnpm turbo build && pnpm turbo lint && pnpm turbo typecheck && pnpm turbo test` |
| SC-2 | E2E tests pass in headless mode via Playwright                                | `pnpm --filter web playwright test`                                              |
| SC-3 | No TypeScript errors across all packages                                      | `pnpm turbo typecheck 2>&1 \| grep -c "error TS"` returns 0                      |

---

## Open Questions

| #    | Question   | Impact         | Priority                |
| ---- | ---------- | -------------- | ----------------------- |
| OQ-1 | [Question] | [High/Med/Low] | [Critical/High/Med/Low] |

---

## User Story

Como **[tipo de utilizador]**, quero **[ação/funcionalidade]**, para **[benefício/valor]**.

---

## Goals

### Must Have (MVP)

- [ ] Functional feature with all SCs met
- [ ] Unit tests covering core logic (vitest)
- [ ] TypeScript compiles without errors
- [ ] No lint warnings (biome check)

### Should Have

- [ ] Integration tests for tRPC routers
- [ ] E2E smoke test for critical user flow
- [ ] Documentation in SPEC or ADR

### Could Have

- [ ] Full Playwright E2E coverage
- [ ] Performance benchmarks
- [ ] Internationalization (i18n)

---

## Non-Goals

[What this feature does NOT include — define boundaries. E.g.: This spec does NOT cover the payment processing integration (handled in SPEC-XXX), nor does it address mobile client support.]

---

## Acceptance Criteria

| #    | Criterion              | Test          |
| ---- | ---------------------- | ------------- |
| AC-1 | [Verifiable criterion] | [How to test] |
| AC-2 | [Verifiable criterion] | [How to test] |
| AC-3 | [Verifiable criterion] | [How to test] |

---

## Dependencies

| Dependency        | Status   | Notes              |
| ----------------- | -------- | ------------------ |
| SPEC-XXX          | APPROVED | [Notes]            |
| Infra: pnpm@9.0.0 | READY    | Already installed  |
| Infra: Turbo      | READY    | Already configured |
| Infra: Biome      | READY    | Already configured |

---

## Decisions Log

| Date       | Decision | Rationale       |
| ---------- | -------- | --------------- |
| YYYY-MM-DD | Decision | Why it was made |

---

## Checklist

- [ ] SPEC written and reviewed
- [ ] Architecture decisions documented (ADR if needed)
- [ ] Acceptance criteria are testable
- [ ] Dependencies identified
- [ ] Security review done (if applicable)
- [ ] Tasks generated via `/pg`
- [ ] Turbo commands verified locally
- [ ] No hardcoded secrets in code
- [ ] Memory index updated (sync.sh)
