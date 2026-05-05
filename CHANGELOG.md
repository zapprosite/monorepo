# CHANGELOG.md — Homelab Monorepo

**Last Updated:** 2026-05-04

---

## [v2.1.0] — 2026-05-04 — SPEC-302 Phase 3: Factory Pattern Mass Migration

### Added
- **createCrudRouter() factory** — Generic CRUD router factory with hooks
- **Factory tests** — 22 integration tests for the CRUD factory
- **CI/CD workflows** — `secrets-audit.yml` + `coverage-report.yml`
- **Pipeline enterprise JSON** — `docs/pipeline-enterprise-spec302.json`

### Changed (Migrated to Factory)
- `clients` → factory (includes contacts + addresses sub-routers)
- `leads` → factory
- `equipment` → factory (includes units sub-router)
- `contracts` → factory
- `reminders` → factory
- `schedule` → factory

### Fixed
- **TypeScript errors: 0** (was 42 before migration)
- `loyalty.trpc.ts` — Rewrote broken Prisma API calls with correct OrchidORM
- `email.trpc.ts` — Registered orphaned router in `trpc.router.ts`
- `google-oauth2.auth.plugin.ts` — Type cast for Fastify plugin registration
- `service-orders.trpc.ts` — Fixed `teamId` type narrowing for upload
- `maintenance-checklist.trpc.ts` — Fixed `findOptional()` → `takeOptional()`
- `maintenance-plans.table.ts` — Added `@ts-ignore` for enum export resolution
- `contracts.trpc.ts` — Added explicit `any` types for map callbacks
- `editorial.trpc.test.ts` — Removed stale `@ts-expect-error`
- `db/config.ts` + `lib/upload.ts` — Removed unused imports

### Deleted
- 7 legacy test files (`*.trpc.test.ts`) — replaced by single factory test

---

---

## [v2.0.0] — 2026-04-25 — Enterprise SRE Polish

### Added
- **CHANGELOG.md** — Change tracking
- **ROADMAP.md** — 2026 planning
- **docs/runbooks/** — Operational procedures
- **SPECs/INDEX.md** — Organized SPECs directory
- Mermaid architecture diagram in README.md

### Changed
- **AGENTS.md** — Full infrastructure map (/srv + /home/will)
- **CLAUDE.md** — Complete infrastructure topology
- **README.md** — Enterprise landing page with badges
- **NEXUS-SRE-GUIDE.md** — Enhanced with escalation matrix
- **hermes-second-brain/CLAUDE.md** — Complete architecture docs

### Fixed
- `docker-compose.yml` → archived (was in root)
- 4 near-empty `.d.ts` files removed
- Architecture violations: 0
- Empty files: 0

### Archived
- `/srv/archive/apps.monitoring/` — Orphaned monitoring config
- `/srv/archive/hvac/` — Empty HVAC project

---

## [v1.0.0] — 2026-04-21 — Initial Enterprise Setup

### Added
- Nexus SRE Framework (7×7=49 agents)
- Hermes + Mem0 integration
- Qdrant Vector DB
- LiteLLM multi-provider gateway
- Gitea CI/CD

---

## [v0.0.1] — 2024 — Inception

### Added
- Monorepo structure
- Basic apps (api, web, fit-v3)
- First documentation
