# Readability Review — 2026-04-26

**Agent:** readability-reviewer
**Scope:** apps/api, apps/ai-gateway, apps/monitoring, scripts/, .claude/vibe-kit/, AGENTS.md, CLAUDE.md

---

## Findings

### Naming Issues

| Severity | File | Line | Issue |
|----------|------|------|-------|
| **HIGH** | `apps/api/src/modules/content-engine/conteudos.table.ts` | 1 | Portuguese naming `conteudos` should be `contents` |
| **HIGH** | `apps/api/src/modules/content-engine/conteudo-revisoes.table.ts` | 1 | Portuguese naming `conteudo-revisoes` should be `content-revisions` |
| **HIGH** | `apps/api/src/db/migrations/0011_maintenance.ts` | 51,164,170 | Enum `categ_template` and `categoriTemplate` misspelled — should be `category_template` |
| **MEDIUM** | `apps/api/src/modules/mcp-connectors/mcp-conectores.table.ts` | 1 | Portuguese `conectores` should be `connectors` |
| **MEDIUM** | `apps/api/src/modules/api-gateway/webhookProcessor.ts` | 20-27 | `runWebhookProcessor` function return type is verbose inline — extract to named interface |
| **MEDIUM** | `scripts/nexus-auto.sh` | 48 | Variable `gap` is vague — `available_pid_gap` |

### Dead Code Found

| Count | Location | Description |
|-------|----------|-------------|
| 1 | `apps/api/src/trpc.ts:44-46` | Commented-out `console.log(error.cause)` and `console.log(error.stack)` inside FIXME block |
| 1 | `apps/api/src/middlewares/sessionSecurity.middleware.ts:182-184` | Commented-out TODO enhancement block |
| 1 | `apps/api/src/modules/kanban/kanban.logging.ts:106` | Inline TODO comment — should be tracked in issue tracker |
| 1 | `apps/api/src/modules/email/email-campaigns.table.ts:18` | Inline TODO via FK reference |

### Complexity Analysis

| File | Function | Lines | Cyclomatic | Status |
|------|----------|-------|------------|--------|
| `apps/api/src/trpc.ts` | `createTRPCContext` | 19 | 4 | OK |
| `apps/api/src/trpc.ts` | error formatter | 26 | 5 | OK |
| `apps/api/src/modules/api-gateway/utils/webhookQueue.utils.ts` | `processWebhookQueue` | 114 | 6 | **WARN** — 114 lines exceeds 50-line guideline |
| `apps/api/src/modules/api-gateway/utils/webhookQueue.utils.ts` | `sendWebhook` | 65 | 5 | OK |
| `apps/api/src/middlewares/sessionSecurity.middleware.ts` | `validateSessionSecurity` | 105 | 9 | **WARN** — 105 lines exceeds guideline |
| `.claude/vibe-kit/nexus.sh` | `phase_plan` | ~100 | N/A | OK (shell) |
| `.claude/vibe-kit/nexus.sh` | `phase_execute` | ~60 | N/A | OK |
| `scripts/nexus-auto.sh` | `execute_task` | ~95 | N/A | **WARN** — complex case statement, consider breaking into separate files |

### Comment Quality

| File | Assessment |
|------|------------|
| `apps/api/src/modules/api-gateway/utils/webhookQueue.utils.ts` | **GOOD** — comprehensive JSDoc with examples |
| `apps/api/src/trpc.ts` | **MEDIUM** — FIXME comment (line 44) needs resolution |
| `apps/api/src/middlewares/sessionSecurity.middleware.ts` | **GOOD** — well-documented enum and functions |
| `.claude/vibe-kit/vibe-kit.sh` | **GOOD** — clear function comments |

### Shell Script Patterns

| Issue | Location | Recommendation |
|-------|----------|----------------|
| Inline Python in `vibe-kit.sh` | lines 56-76, 114-127 | Extract to separate Python module |
| Inline Python in `nexus.sh` | lines 88-99 | Extract to separate Python module |
| Hardcoded paths in `nexus-sre.sh` | line 111 | `CF_ZONE` fallback is hardcoded — should use env |

---

## Recommendations

1. **Portuguese → English naming:** Rename all `conteudos` → `contents`, `conectores` → `connectors`, fix `categoriTemplate` → `categoryTemplate`. This is a breaking change for DB but improves maintainability.

2. **Extract long functions:** `processWebhookQueue` (114 lines) and `validateSessionSecurity` (105 lines) should be refactored into smaller helper functions.

3. **Remove commented-out code:** Clear the FIXME block in `trpc.ts:44-46` and the TODO in `sessionSecurity.middleware.ts:182-184`.

4. **Inline Python extraction:** Python snippets in `vibe-kit.sh` and `nexus.sh` should become standalone modules in `scripts/pipeline-helpers/` or similar.

5. **Fix hardcoded fallback:** `nexus-sre.sh:111` has `CF_ZONE` hardcoded — remove the fallback or fail explicitly.

6. **Rename `gap` variable:** In `nexus-auto.sh:48`, `gap` → `available_pid_gap`.

---

## Summary

| Metric | Value |
|--------|-------|
| Max cyclomatic complexity | 9 (sessionSecurity) |
| Max function length | 114 lines (processWebhookQueue) |
| Naming issues | 5 |
| Dead code blocks | 4 |
| Inline Python blocks | 4 |

**Overall Readability:** ACCEPTABLE — codebase is well-structured with good documentation patterns. Priority fixes are Portuguese→English naming and dead code removal.
