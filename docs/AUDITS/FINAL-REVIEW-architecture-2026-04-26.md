# Architecture Review — 2026-04-26

**Reviewer:** architecture-reviewer
**Scope:** /srv/monorepo
**Focus:** Symlink structure, dependency layers, service boundaries, god modules

---

## Findings

### 1. Symlink Structure

- [HIGH] **Hermes symlink outside /srv**: `hermes/ → ~/.hermes` links to home directory, not under `/srv/`. This breaks the monorepo's "single source of truth" premise — Hermes state lives outside the controlled `/srv` partition.

- [MEDIUM] **Implicit cross-partition dependencies**: Symlinks to `/srv/ops`, `/srv/hermes-second-brain`, `/srv/edge-tts`, `/srv/hvacr-swarm`, `/srv/fit-tracker-v2` create implicit dependencies on external services. If any target is missing or has permission issues, the monorepo may fail silently.

- [LOW] **No symlink validation**: No pre-build check ensures all symlinks resolve correctly.

### 2. Dependency Layers

- [HIGH] **apps/api/src/db/db.ts — GOD MODULE**: Single file imports 30+ table definitions (lines 1-37). Every module in `modules/` imports from this one file. Adding a new table requires editing this central file, creating a bottleneck and compile-time coupling for all 27 modules.

- [MEDIUM] **27 modules in apps/api/src/modules/**: Auth, clients, contracts, editorial, email, equipment, journal-entries, kanban, leads, logs, loyalty, maintenance, mcp-connectors, prompts, reminders, schedule, service-orders, subscriptions, teams, trieve, users, webhooks. Many of these could be independent packages with their own `db.ts`, `*.trpc.ts`, and `*.router.ts`.

- [LOW] **packages/ underutilized**: Only 3 packages (`config`, `ui`, `zod-schemas`). The `packages/` workspace is underutilized for decomposing the god module.

- [LOW] **scripts/ bloat**: 50+ scripts in `/scripts/`. Some are nexus-framework internals, others are one-shot automation. No clear separation between "build scripts", "deploy scripts", and "operational scripts".

### 3. Service Boundaries

- [HIGH] **ops/ symlink crosses repo boundary**: `ops/ → /srv/ops` contains Terraform, Ansible, Docker, and governance. Changes to infra can break the monorepo without version control in this repo.

- [MEDIUM] **apps/ai-gateway vs apps/api boundary unclear**: ai-gateway (OpenAI facade) and api (Fastify+tRPC) appear to share `packages/zod-schemas` but may have implicit coupling via environment variables and database.

- [LOW] **apps/monitoring** is minimal (5 subdirs) compared to api (27 modules). This suggests an unbalanced architecture — monitoring should arguably be a separate concern, not bundled.

### 4. Circular Dependencies / Import Patterns

- [INFO] **No circular deps detected**: Only 27 relative imports across 21 files in `apps/api/src/`. The module structure is mostly acyclic.

- [INFO] **Cross-module imports via @backend alias**: All modules use `@backend/*` path alias to import shared code (db, trpc, configs). This is clean but concentrates imports in `db.ts`.

### 5. God Modules

- [CRITICAL] **apps/api/src/db/db.ts**: 85 lines, imports 30+ tables. All 27 modules depend on it directly. This is the textbook definition of a god module — it knows too much and is depended upon by too many.

- [HIGH] **apps/api/src/trpc.ts**: Context creation, error handling, rate limiting, and procedure creation all in one file (179 lines). While well-organized, adding new middleware types requires editing this file.

---

## Recommendations

1. **Decompose db.ts into table registry per module**: Each module in `modules/<feature>/` should own its own table definition and export a partial db instance. Use `orchid-orm` feature to compose databases rather than one central definition.

2. **Move hermes symlink to /srv/hermes**: Instead of `~/.hermes`, symlink to `/srv/hermes` to keep all service state under `/srv/`.

3. **Validate symlinks at build time**: Add a `pnpm prebuild` script that checks all symlinks resolve and fail fast if targets are missing.

4. **Consider moving infra (ops/) into the monorepo**: The ops symlink creates drift risk. If `/srv/ops` changes, the monorepo may break without version control awareness.

5. **Promote `packages/` usage**: Extract stable modules (auth, email, webhooks) into `packages/` to enable independent versioning and smaller compile surfaces.

6. **Separate monitoring into its own concern**: If monitoring is minimal, consider whether it belongs in this monorepo or should be a separate ops artifact.

7. **Document the scripts/ taxonomy**: Create a `scripts/README.md` categorizing scripts by purpose (bootstrap, health, deploy, etc.) to reduce confusion about which scripts are maintained vs legacy.

---

**Verdict:** ARCHITECTURE IS FUNCTIONAL but exhibits classic monorepo scaling issues. The god module (`db.ts`) and symlink-to-external-partition pattern are the primary concerns. The codebase is not in immediate danger but will become harder to maintain as modules grow.

**Score:** 6.5/10 — Stable for current scope, needs refactoring before significant growth.
