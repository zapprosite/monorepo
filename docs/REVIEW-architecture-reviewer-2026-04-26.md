# Architecture Review — 2026-04-26

**Reviewer:** architecture-reviewer
**Scope:** /srv/monorepo/apps/api, /srv/monorepo/apps/ai-gateway, /srv/monorepo/apps/monitoring, /srv/monorepo/packages/, /srv/monorepo/.claude/vibe-kit/, scripts/

---

## Findings

### [CRITICAL] db.ts — God Module Anti-pattern

**File:** `/srv/monorepo/apps/api/src/db/db.ts`

The `db.ts` file imports **35+ table modules** directly at module initialization:

```typescript
import { SessionTable } from "@backend/modules/auth/tables/session.auth.table";
import { ClientsTable } from "@backend/modules/clients/clients.table";
import { ContractsTable } from "@backend/modules/contracts/contracts.table";
// ... 30+ more table imports
```

**Impact:**
- Any file importing `db` transitively loads the entire database schema
- 28+ files directly import `@backend/db/db` — star-coupling problem
- Circular dependency risk: db.ts → all modules; modules → db.ts
- Single point of change for any table addition/modification

**Layer Violation:** Infrastructure layer (db) dictates structure of all application modules.

---

### [CRITICAL] No Service/Repository Layer

**Impact:** Handlers and tRPC procedures directly invoke `db.*` operations:

```typescript
// journal_entries.trpc.ts:18 — direct db access in tRPC procedure
const journalEntries = await db.journalEntries.select("*", {...}).where({ authorUserId: userId });

// api-gateway.router.ts:149 — direct db access in route handler
const log = await db.apiProductRequestLogs.find(requestId).where({ teamId });
```

**Consequences:**
- Business logic mixed with data access and routing
- No transaction boundaries for multi-table operations (e.g., webhook + journal entry)
- Impossible to swap data sources without rewriting every handler
- Violates: UI → Application → Domain → Infrastructure layering

**Files affected:** All 21 tRPC routers + 7+ route handlers directly use `db`.

---

### [CRITICAL] Database as Global Singleton

**File:** `/srv/monorepo/apps/api/src/db/db.ts`

```typescript
export const db = orchidORM({ databaseURL }, { users: UserTable, ... });
```

No dependency injection — every module imports `db` directly. This makes:
- Unit testing impossible without database mocking at the global scope
- Replacing the database implementation requires global search/replace
- Database connection eagerly initialized on first import

---

### [HIGH] tRPC Router Aggregates All Modules Tightly

**File:** `/srv/monorepo/apps/api/src/routers/trpc.router.ts`

```typescript
export const appTrpcRouter = trpcRouter({
  auth: authRouterTrpc,
  dashboard: dashboardRouterTrpc,
  journalEntries: journalEntriesRouterTrpc,
  // ... 18 more routers
});
```

All 21 domain routers are imported and registered in a single file:
- "Big ball of mud" — all modules load together even if not needed
- No lazy loading of domain modules
- Compile-time coupling across all domains

---

### [HIGH] Layer Violation — API Router Imports Middleware

**File:** `/srv/monorepo/apps/api/src/modules/api-gateway/api-gateway.router.ts`

```typescript
import {
  apiKeyAuthHook,
  corsValidationHook,
  ipWhitelistCheckHook,
  requestLoggerHooks,
  subscriptionCheckHook,
  teamRateLimitHook,
} from "@backend/modules/api-gateway/middleware";
```

The router directly couples to 6 middleware modules. Middleware should be composed at the application bootstrap level, not imported by the router.

---

### [HIGH] Mixed Content — PT-BR Filter in Gateway

**File:** `/srv/monorepo/apps/ai-gateway/src/routes/chat.ts`

```typescript
if (ptbrEnabled && Array.isArray(upstream.choices)) {
  for (const choice of upstream.choices) {
    choice.message.content = await applyPtbrFilter(choice.message.content, acceptLang);
  }
}
```

Business logic (language filtering) embedded in transport layer. No separation between routing, service, and domain layers.

---

### [MEDIUM] Circular Dependency Risk via db.ts

```
db.ts → [all 35 table modules]
[any module] → db.ts → [all 35 tables]
```

Any two modules can become circular through db.ts. Potential cycle:
- `api-gateway.router.ts` → `db.ts` → `middleware/` → `api-gateway.router.ts`

---

### [MEDIUM] No Visible Transaction Management

Webhook processing (`webhookProcessor.ts`, `webhookQueue.utils.ts`) and journal entry creation span multiple tables but no transaction boundaries are visible. If webhook call succeeds but queue update fails, data inconsistency results.

---

### [MEDIUM] ai-gateway — No Graceful Degradation

**File:** `/srv/monorepo/apps/ai-gateway/src/routes/chat.ts`

```typescript
const upstream = await $fetch(`${LITELLM_URL}/chat/completions`, { timeout: 60000 });
```

If LiteLLM is down, gateway returns 502 with no retry logic, circuit breaker, or fallback model. No:
- Retry with exponential backoff
- Circuit breaker pattern
- Fallback model selection

---

### [MEDIUM] ai-gateway — Auth Middleware Calls process.exit(1)

**File:** `/srv/monorepo/apps/ai-gateway/src/middleware/auth.ts`

```typescript
if (!FACADE_KEY) {
  process.stderr.write('[ai-gateway] FATAL: AI_GATEWAY_FACADE_KEY not set in .env\n');
  process.exit(1);
}
```

Middleware calling `process.exit(1)` terminates the entire Node.js process from within a middleware hook. Should throw a Fastify error and let the error handler respond with 500.

---

### [MEDIUM] apps/monitoring Is a Stub Directory

**File:** `apps/monitoring/`

Contains only `grafana/`, `prometheus/`, `promtail/` subdirectories with no `package.json` or TypeScript. This is a Docker Compose config directory, not a deployable application. The directory name implies a running service while the contents are pure infrastructure config.

---

### [LOW] Inconsistent Module Naming

| Pattern | Files |
|---------|-------|
| `.trpc.ts` suffix | `journal_entries.trpc.ts`, `clients.trpc.ts`, `equipment.trpc.ts` |
| `.router.ts` suffix | `api-gateway.router.ts`, `app.router.ts`, `oauth2.router.ts` |
| `.plugin.ts` suffix | `openapi.plugin.ts`, `google-oauth2.auth.plugin.ts` |

No clear convention distinguishing tRPC routers from Fastify routers from Fastify plugins.

---

### [LOW] ai-gateway — Hardcoded Timeout

**File:** `/srv/monorepo/apps/ai-gateway/src/routes/chat.ts`

```typescript
timeout: 60000, // 60 seconds hardcoded
```

Should be configurable via environment variable for different deployment contexts.

---

### [LOW] vibe-kit Worker State via Shared Filesystem

**File:** `.claude/vibe-kit/queue.json`, `.claude/vibe-kit/state.json`

Workers coordinate via atomic `jq` claims on `queue.json`. No versioning, no locking beyond jq-swap, no recovery mechanism if worker dies mid-task. State is not durable across crashes.

---

### [LOW] api References External Repo Template

**File:** `apps/api/package.json`

```json
"repository": "git@github.com:teziapp/connected-repo-starter.git",
"author": "Balkrishna Agarwal <krishna@teziapp.com>"
```

Stale references from the commercial starter template.

---

## ✅ What's Working Well

### Zero Circular Dependencies Between Apps
```
apps/ai-gateway  → @repo/zod-schemas (workspace)
apps/api         → @repo/zod-schemas (workspace)
packages/zod-schemas → (no internal deps)
```

Apps are properly isolated. No cross-app imports. No circular deps between packages.

### Clean Cross-Service Communication
```
api (:4000)  ←→  ai-gateway (:4002)  ←→  LiteLLM (:4000)  ←→  Ollama (:11434)
                          ↓
                    TTS Bridge (:8013)
```

All service URLs via `process.env` (anti-hardcoded ✅). No hardcoded ports in production code.

### pnpm Workspace Structure
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

Clean, minimal. No extraneous workspaces.

### vibe-kit Agent Taxonomy
49 agents across 6 categories. Clear role separation. Each agent has a focused system prompt. Good separation between review/test/debug/docs/frontend.

### Middleware Chain (api)
Appropriate single-responsibility decomposition: apiKeyAuth → corsValidation → whitelistCheck → rateLimit → subscriptionCheck → requestLogger.

---

## Recommendations

### R1 — Introduce Repository Pattern (Critical)
```
src/
├── repositories/       # NEW — data access only
│   ├── journal-entry.repository.ts
│   ├── subscription.repository.ts
│   └── ...
├── services/           # NEW — business logic
│   ├── journal-entry.service.ts
│   └── webhook.service.ts
├── handlers/           # Keep — transport
│   └── save_journal_entry.handler.ts
└── db/
    └── db.ts          # Refactor — remove direct module imports
```

Handlers/tRPC procedures call service methods. Services use repositories. Repositories use db.

### R2 — Extract PT-BR Filter to Service
Move `applyPtbrFilter()` from route handler to `src/services/ptbr-filter.service.ts`. Make it configurable per-customer (database-backed setting), not header-based.

### R3 — Add Transaction Boundaries
Use OrchidORM's transaction support for multi-table operations:
```typescript
await db.transaction(async (tx) => {
  await tx.webhookQueue.update({ id }, { status: 'processed' });
  await tx.journalEntries.create({ ... });
});
```

### R4 — Fix auth Middleware — No process.exit()
```typescript
// Instead of process.exit(1), throw:
throw new Error('AI_GATEWAY_FACADE_KEY not configured');
// Let Fastify's error handler return 500
```

### R5 — Add Retry + Circuit Breaker to ai-gateway
Use `retry` + `opossum` (circuit breaker) for upstream LiteLLM calls. Add `FALLBACK_LITELLM_URL` env var.

### R6 — Consolidate Naming Conventions
Establish clear suffix convention:
- `*.trpc.ts` — tRPC routers
- `*.router.ts` — Fastify route aggregators
- `*.handler.ts` — Individual route handlers
- `*.service.ts` — Business logic
- `*.repository.ts` — Data access
- `*.middleware.ts` — Fastify middleware

### R7 — apps/monitoring — Clarify Intent
Add `apps/monitoring/README.md` stating this directory holds Docker Compose configs for Grafana/Prometheus, not a TypeScript application.

### R8 — Add ESLint Layer Rules
```json
{
  "rules": {
    "no-restricted-imports": {
      "@backend/db": {
        "message": "Use repository layer instead of direct db access",
        "from": "handlers", "routers"
      }
    }
  }
}
```

### R9 — vibe-kit: Add Worker Heartbeat
Add `last_heartbeat: ISO8601` to `state.json` for watchdog detection of stuck workers.

### R10 — Update Stale package.json Metadata
Remove or update `repository` and `author` fields in `apps/api/package.json`.

---

## Metrics Summary

| Metric | Value |
|--------|-------|
| Files directly importing `db` | 28 |
| tRPC routers aggregated | 21 |
| Tables in single db.ts | 35 |
| Layer violations (direct db use) | 12+ handlers + all tRPC routers |
| Services directory modules | 1 (trieve/ only) |
| Circular dependency risk | HIGH (star pattern via db.ts) |
| Circular deps between apps | 0 ✅ |
| apps with anti-hardcoded env | 2/2 ✅ |
| vibe-kit agents | 49 across 6 categories ✅ |

---

**Reviewer:** architecture-reviewer
**Date:** 2026-04-26
**Next:** Handoff to quality-scorer for risk scoring
