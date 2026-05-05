# CHANGELOG.md — Homelab Monorepo

**Last Updated:** 2026-05-04

---

## [v2.1.3] — 2026-05-05 — Nexus Smart Router Framework

### Added
- **Nexus Smart Router** (`libs/nexus/`) — Framework de roteamento inteligente de tarefas AI
  - `classifier.py` — Classifica tarefas em 3 níveis (mechanical/analytical/strategic)
  - `executor.py` — Executa async via Ollama (local) ou LiteLLM (cloud)
  - `validator.py` — Quality gate pós-execução com score 0.0-1.0
  - `router.py` — Orquestrador com retry e auto-escalation
  - `models.py` — Pydantic models (Task, Classification, ExecutionResult, ValidationResult)
- **Nexus API** (`apps/api/nexus.py`) — FastAPI endpoints
  - `POST /nexus/tasks` — Submeter tarefa
  - `GET /nexus/tasks/{id}` — Consultar resultado
  - `POST /nexus/classify` — Classificar sem executar
  - `GET /nexus/health` — Health check Ollama + LiteLLM
- **Nexus CLI** (`scripts/nexus`) — Comandos: classify, run, batch, health
- **11 Tests** — `tests/test_nexus_*.py` (models, classifier, router)
- **SPEC** — `docs/SPECS/SPEC-NEXUS-SMART-ROUTER.md`

### Architecture
- Mechanical → Ollama local (qwen2.5-coder) — 80% economia de tokens
- Analytical → Ollama + validação Kimi — 75% economia
- Strategic → Kimi K2.6 (cloud) — raciocínio profundo
- Auto-escalation quando validação < 0.6

---

## [v2.1.2] — 2026-05-05 — Hermes Prune Total: Tree-Only + Daemons Mortos

### Added
- **ADR-001** — `docs/ADRs/ADR-001-hermes-tree-only.md` (arquitetura de contexto)
- **scripts/hermes-tree.py** — Leitor de repo Aider-like (zero state, 50ms)
- **Regra R8 no AGENTS.md** — Hermes tree-only, proibido state.db > 1MB fora do monorepo

### Changed
- **AGENTS.md** — Seção "🌳 Hermes Tree-Only (ADR-001)" adicionada
- **Porta 8642** — HCE v2.1 é o ÚNICO serviço (hermes-gateway parado)
- **Porta 6337** — Livre (hermes-second-brain uvicorn morto)

### Removed (Prune Sem Arquivamento)
- **~/.hermes/hermes-agent/** — Daemon gateway parado (8.6GB RAM liberada)
- **~/.hermes/state.db** — 760MB de salada SQLite (não arquivado, eliminado)
- **~/.hermes/response_store.db** — SQLite de respostas (não arquivado, eliminado)
- **~/.hermes/sessions/** — 139 diretórios de sessão (não arquivados, eliminados)
- **~/.hermes/snapshots/** — Snapshots automáticos (não arquivados, eliminados)
- **Duplicate libs/** — `/srv/hermes-second-brain/libs/` abandonado (monorepo é fonte única)

### Infração Zero Tolerância
- Criar `state.db` > 1MB fora do monorepo = PR bloqueado + CSO alert
- Daemon de contexto consumindo > 512MB RAM = revert imediato

---

## [v2.1.1] — 2026-05-05 — HCE v2.1 Production Hardening

### Added
- **HCE Context API** — FastAPI service at port 8642 (`apps/api/context.py`)
  - `POST /context` — ranked context retrieval with session memory
  - `GET /context/health` — context service health check
  - `GET /health` — root health check
- **Rate Limit Middleware** (`apps/api/rate_limit.py`)
  - In-memory sliding window per client IP
  - Configurable via `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW_SECONDS`
  - Returns 429 with PT-BR message: "Muitas requisições. Aguarde um momento."
- **19 HCE Tests** (`tests/test_*.py`)
  - `test_ranker.py` — 6 tests (PageRank convergence, token budget, edge cases)
  - `test_context.py` — 5 tests (health endpoints, POST shape, rate limit 429)
  - `test_sync_engine.py` — 8 tests (scan, hash, async upsert, skip unchanged)
- **Async Embeddings + Content-Hash Skip** (`services/sync_engine.py`)
  - `_embed()` async via `aiohttp`
  - `_fetch_existing_hashes()` queries Qdrant before upsert
  - Skips documents with unchanged SHA-256 hash
  - `run_sync_sync()` backwards-compatible wrapper

### Fixed
- **SQLite DatabaseError** (`libs/memory/manager.py`)
  - Detects corruption on import via `PRAGMA schema_version`
  - If corrupt: logs warning, deletes file, recreates schema
  - API now starts cleanly every time regardless of DB state

### Changed
- Renamed `services/sync-engine.py` → `services/sync_engine.py` (valid Python module)
- Added `libs/` package structure (`libs/memory/`, `libs/context/`)
- Created SPEC-HCE-v2.1-improvements.md with full execution plan

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
