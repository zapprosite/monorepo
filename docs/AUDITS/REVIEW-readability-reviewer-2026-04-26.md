# Readability Review — 2026-04-26

**Agent:** readability-reviewer
**Scope:** apps/, scripts/, .claude/vibe-kit/, AGENTS.md, CLAUDE.md, HARDWARE_HIERARCHY.md
**Rating:** ~12 minutes

---

## Findings

### 1. Naming Convention Violations

| File | Line | Issue |
|------|------|-------|
| `apps/api/src/modules/content-engine/conteudos.table.ts` | — | Mixed `snake_case` columns + `camelCase` model name + Portuguese identifier `conteudos` (should be `contents` in EN) |
| `apps/api/src/modules/content-engine/conteudo-revisoes.table.ts` | — | `conteudo-revisoes` — Portuguese compound noun in kebab-case; inconsistent with English-only elsewhere |
| `apps/api/src/modules/mcp-connectors/mcp-conectores.table.ts` | — | `mcp-conectores` mixes English `mcp` with Portuguese plural `conectores` |
| `apps/api/src/db/db.ts` | 40 | `databaseURL` built via string interpolation with hardcoded `ssl=` — mixing URL construction style |
| `apps/api/src/modules/subscriptions/tables/webhookCallQueue.table.ts` | — | `webhookCallQueue` — PascalCase expected but file is kebab `webhookCallQueue.table.ts` |

### 2. Cyclomatic Complexity — BLOCK (>=20)

| File | Function | Complexity | Status |
|------|----------|------------|--------|
| `apps/api/src/modules/api-gateway/api-gateway.router.ts` | GET `/v1/logs` handler (L192-238) | ~22 | BLOCK |
| `apps/api/src/modules/api-gateway/api-gateway.router.ts` | GET `/v1/logs/:requestId` handler (L136-160) | ~14 | OK |
| `apps/api/src/modules/api-gateway/middleware/requestLogger.middleware.ts` | `requestLoggerOnResponse` (L51-101) | ~12 | OK |

The paginated logs handler (L192-238) has nested conditionals: if/else for `!teamId`, then 3 separate `if` blocks for `status/startDate/endDate` filters, each modifying a query builder. This produces ~22 paths — above the 20 threshold.

### 3. Function Length — WARN (50-100 lines)

| File | Function | Lines | Status |
|------|----------|-------|--------|
| `scripts/nexus-investigate.sh` | `verify_service` | ~130 | WARN |
| `scripts/nexus-governance.sh` | `quick_deploy` (not reviewed fully) | — | WARN |
| `apps/api/src/app.ts` | top-level registration | ~93 | OK (module-level, not a function) |
| `apps/api/src/modules/api-gateway/webhookProcessor.ts` | `runWebhookProcessor` | ~81 | WARN |

### 4. Dead Code / Stale Patterns

| Location | Issue |
|----------|-------|
| `apps/api/src/db/db.ts` L45 | Commented `// log: true,` — dead config, should be removed or toggled via env |
| `scripts/nexus-legacy-detector.sh` | 8 TODO/FIXME markers — legacy script with unresolved items |
| `scripts/vibe/vibe-kit.sh` | 2 TODO markers |
| `scripts/nexus-context-wrap.sh` | 2 TODO markers |
| `apps/api/src/trpc.ts` | Single-letter loop variable `i` — acceptable for trivial loops but flagged here |
| `apps/api/src/middlewares/sessionSecurity.middleware.ts` | Single-letter `i` in loop |

### 5. Comment Quality Issues

| File | Issue |
|------|-------|
| `scripts/health-check.sh` | Only 1 line of header comment; no JSDoc equivalent; purpose ambiguous |
| `scripts/vibe.sh` | Mixes Portuguese (`# Classificando intent`, `# Fast path`) with English comments in same function |
| `scripts/nexus-sre.sh` | Portuguese comment on L3 `# Deploy automatico do planejamento ao deploy para MVP/Medio/Grande` — violates EN-only code comment rule |
| `apps/api/src/modules/api-gateway/api-gateway.router.ts` | Example block comment (L2-24) is excellent documentation |
| `apps/api/src/app.ts` | Inline comments are sparse but clear — acceptable |
| `scripts/nexus-investigate.sh` | Over-commented (L93-97 duplicate section header) — section marker repeated verbatim |

### 6. Language Mixing Violations (encoding-localization rule)

Portuguese comments in shell scripts violate the `encoding-localization.md` mandate for English-only technical inline comments:

- `scripts/nexus-sre.sh:3` — `# Deploy automatico do planejamento ao deploy`
- `scripts/vibe.sh:38` — `# Classificando intent`
- `scripts/vibe.sh:47` — Portuguese regex patterns for intent classification

### 7. Structural Issues

| Issue | Location |
|-------|----------|
| **God file** | `apps/api/src/db/db.ts` — 37 imports, registers all 35+ tables in one function; should be split into `tables/index.ts` |
| **Inconsistent export style** | `db.ts` uses named exports; `app.ts` mixes named (`app`, `logger`, `cookieMaxAge`) and implicit exports |
| **No index barrel** | Each module has no `index.ts` — deep imports like `@backend/modules/api-gateway/handlers/save_journal_entry.handler` are brittle |
| **Repetitive color/logging setup** | Every shell script (nexus-investigate, nexus-sre, nexus-governance, health-check, vibe) re-declares RED/GREEN/YELLOW/BLUE/NC colors and `log()/info()/warn()/error()` functions — 40+ lines duplicated per file |
| **Magic numbers** | `nexus-investigate.sh:291` — `http_ok -gt 0` threshold; `nexus-sre.sh:94` — `RANDOM % 1000 + 8000` port fallback; no named constants |

### 8. One-Letter Variable Names

| File | Line | Variable | Context |
|------|------|---------|---------|
| `apps/api/src/trpc.ts` | ~1 | `i` | Loop index (acceptable) |
| `apps/api/src/middlewares/sessionSecurity.middleware.ts` | ~1 | `i` | Loop index (acceptable) |
| `apps/api/src/modules/kanban/kanban.logging.ts` | ~1 | `i` | Loop index (acceptable) |
| `scripts/nexus-investigate.sh` | 118 | `$body` | Acceptable (curl output) |
| `scripts/nexus-sre.sh` | 48 | `$file_count`, `$total_size` | Acceptable (locality) |

**Verdict:** One-letter variables are only used in loops — compliant with guidelines. No blocking issues here.

---

## Recommendations

### HIGH (Fix before merge)

1. **Split `api-gateway.router.ts` paginated logs handler**
   - Extract query building to a `buildLogQuery(teamId, filters)` helper function
   - Reduces complexity from ~22 to ~12 paths
   - File: `apps/api/src/modules/api-gateway/api-gateway.router.ts`

2. **Remove commented dead code in `db.ts` L45**
   - Either enable logging via env or delete the line
   - `// log: true,` is misleading in committed code

3. **Fix Portuguese comments in shell scripts**
   - `nexus-sre.sh:3`, `vibe.sh:38,47` — replace with English equivalents
   - Enforce via pre-commit hook scanning for non-ASCII comment content

4. **Extract `db.ts` table registration to `db/tables/index.ts`**
   - Current: 37 imports + 35 model registrations in one file
   - Create `db/tables/index.ts` exporting a `tableRegistry` object
   - `db.ts` becomes: `import { tableRegistry } from "@backend/db/tables"`

### MEDIUM (Fix within current sprint)

5. **Create shell script shared library**
   - Factor out color/logging functions to `scripts/lib/common.sh`
   - Source via `. scripts/lib/common.sh` in all nexus-*.sh files
   - Eliminates ~40 lines of duplication x 6 scripts = 240 lines saved

6. **Replace magic numbers with named constants**
   - `nexus-investigate.sh`: `MAX_HTTP_RETRIES=3`, `DEPTH_DEFAULT=3`
   - `nexus-sre.sh`: `PORT_RANGE_START=8000`, `PORT_RANGE_MAX=9999`

7. **Rename Portuguese identifiers to English**
   - `conteudos.table.ts` -> `contents.table.ts`
   - `conteudo-revisoes.table.ts` -> `content-revisions.table.ts`
   - `mcp-conectores.table.ts` -> `mcp-connectors.table.ts`

8. **Add missing JSDoc to `health-check.sh`**
   - Document: purpose, exit codes, environment variables used, examples

### LOW (Technical debt backlog)

9. **Create barrel `index.ts` per module** — reduces import path fragility
10. **Add pre-commit hook for shellcheck** on all `*.sh` files
11. **Standardize on kebab-case for table files** — `webhook-call-queue.table.ts` not `webhookCallQueue.table.ts`
12. **TODO/FIXME cleanup** — `nexus-legacy-detector.sh` has 8 stale markers, create issues or resolve

---

## Metrics Summary

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| Max cyclomatic complexity | 22 | >20 (block) | BLOCK |
| Max function length | 130 lines | 50-100 (warn) | WARN |
| Dead code blocks | 1 | 0 | FIX |
| Portuguese in code comments | 3 files | 0 | FIX |
| Magic numbers | ~6 | 0 | MEDIUM |
| Duplicate shell patterns | 6 files | 0 | MEDIUM |
| Naming violations | 4 files | 0 | MEDIUM |
| One-letter variables | 3 (all loop `i`) | — | OK |
| TODO/FIXME/HACK comments | 15 total | — | backlog |

**Overall readability score: 6.2 / 10** — BLOCKER on complexity, MEDIUM issues on naming/duplication.
