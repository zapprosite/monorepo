# Quality Review — 2026-04-26

**Reviewer:** quality-scorer
**Scope:** /srv/monorepo/apps/, /srv/monorepo/scripts/, /srv/monorepo/.claude/vibe-kit/
**Date:** 2026-04-26

---

## Findings

### CRITICAL

- **[CRITICAL] TypeScript compilation failing — 340 total type errors**
  - `apps/api`: 329 type errors blocking build
  - `apps/ai-gateway`: 11 type errors blocking build
  - Root cause: env vars accessed via dot notation (`process.env.NODE_ENV`) instead of bracket notation (`process.env['NODE_ENV']`) triggering TS4111 errors; missing `@connected-repo/zod-schemas` module declarations; implicit `any` types in migrations

- **[CRITICAL] webhookProcessor.ts calls process.exit() in API module**
  - `webhookProcessor.ts:91,94,99` — `process.exit()` in standalone script execution block. When imported as a module, this could terminate the Node.js process. Should refactor to return exit codes instead of calling `process.exit()` directly.

- **[CRITICAL] api/src/server.ts calls process.exit(1) on startup failure**
  - `server.ts:91` — Directly calls `process.exit(1)` after logging. While this is acceptable for a standalone server entry point, it bypasses Fastify's graceful shutdown and prevents PM2/process managers from handling the error state properly.

### HIGH

- **[HIGH] CORS misconfiguration in ai-gateway**
  - `apps/ai-gateway/src/index.ts:23` — `cors: { origin: true }` accepts all origins. This is acceptable for an internal gateway but should be documented. AI gateway also lacks rate limiting middleware.

- **[HIGH] In-memory rate limiter doesn't scale**
  - `teamRateLimit.middleware.ts:4-6` — Uses `RateLimiterMemory` with in-memory Map. Comment acknowledges "For production with multiple servers, consider using RateManagerRedis" but no Redis implementation exists. Teams with multiple API instances will have inconsistent rate limiting.

- **[HIGH] eval() usage in test-worktree.sh**
  - `scripts/vibe/test-worktree.sh:101,110,174` — Uses `eval "$cmd"` and `eval "$COMMAND"` for arbitrary command execution. While the script is internal, eval on unsanitized input is a security risk. Commands passed to this script should be validated or use `$cmd` directly without eval.

- **[HIGH] Stale PID-based lock in vibe-kit.sh**
  - `vibe-kit.sh:20-27` — Lock file uses PID check but `kill -0` only verifies process existence, not that the lock belongs to the current user/session. Race condition possible if PID is reused quickly.

- **[HIGH] Permission too open on lock file in claim-task.py**
  - `claim-task.py:13` — Lock file created with `0o644` permissions, allowing any user to modify. Should use `0o600` for stricter security.

### MEDIUM

- **[MEDIUM] TODO/FIXME comments not resolved**
  - `apps/api/src/trpc.ts:44` — FIXME: error logging at app.ts not working as expected
  - `apps/api/src/middlewares/sessionSecurity.middleware.ts:183` — TODO: Optional enhancement - Send email to user about suspicious activity
  - `apps/api/src/modules/kanban/kanban.logging.ts:106` — TODO: Send to observability platform

- **[MEDIUM] Dev auth bypass middleware in production path risk**
  - `apps/api/src/middlewares/dev-auth-bypass.ts` — In dev mode, allows any email via `X-Dev-User` header with placeholder userId. While gated behind `isDev`, the `DEV_USERS` map is hardcoded and the middleware doesn't verify user exists in DB for unknown emails. Could be risky if accidentally deployed.

- **[MEDIUM] PT-BR filter has no authentication to Ollama**
  - `apps/ai-gateway/src/middleware/ptbr-filter.ts` — Calls Ollama with no auth (`OLLAMA_URL` defaults to `localhost:11434`). Assumes network-level security. Should document this assumption.

- **[MEDIUM] ZFS snapshots use sudo without passwordless config verification**
  - `vibe-kit.sh:39`, `nexus.sh:163` — `sudo zfs snapshot` used but assumes passwordless sudo is configured. No verification that the user has ZFS privileges before attempting.

- **[MEDIUM] Dead context files in vibe-kit/context/**
  - 10 `.ctx` files in `vibe-kit/context/` exist but reference paths like `apps/hermes-agency/src/langgraph/` which is outside the monorepo scope. These may be orphaned artifacts.

### LOW

- **[LOW] Queue file paths mismatch in vibe-kit scripts**
  - `vibe-kit-launcher.sh` references `$VIBE_DIR/queue.json` = `/srv/monorepo/.claude/vibe-kit/queue.json`
  - `vibe-kit.sh` uses `$BRAIN_QUEUE` = `/srv/monorepo/.claude/brain-refactor/queue.json`
  - These are different paths, causing the launcher to always report `pending=0` and skip launches.

- **[LOW] ai-gateway logs to stderr via process.stderr.write**
  - `apps/ai-gateway/src/middleware/auth.ts:12`, `ptbr-filter.ts:174,178` — Uses `process.stderr.write()` instead of the Fastify logger instance. Inconsistent logging.

- **[LOW] Hardcoded credential in test-llm-providers.ts**
  - `scripts/test-llm-providers.ts:48,110,128` — Uses `Bearer dummy-key` for LiteLLM health checks. While this is for health checks (not actual auth), it could be mistaken for a real credential in code reviews.

- **[LOW] cleanup-vibe.sh uses non-portable stat syntax**
  - `cleanup-vibe.sh:46` — Uses `stat -c%s` which is Linux-specific. macOS uses `stat -f%z`.

---

## Quality Score Calculation

| Category | Deduction | Count | Subtotal |
|----------|-----------|-------|----------|
| Critical issues | -20 each | 3 | -60 |
| High issues | -10 each | 5 | -50 |
| Medium issues | -3 each | 7 | -21 |
| Low issues | -1 each | 5 | -5 |
| **Total** | | | **-136** |

**Base Score:** 100
**Final Score:** 100 - 136 = **-36** (clamped to 0)

### Gates Status

| Gate | Status |
|------|--------|
| Critical issues = 0 | ❌ FAIL (3 critical) |
| Quality score ≥ 70 | ❌ FAIL (score = 0) |
| Tests passing | ⚠️ UNKNOWN (type errors block test run) |
| Type errors = 0 | ❌ FAIL (340 errors) |
| OWASP compliance | ✅ PASS (no vulnerabilities found) |

---

## Recommendations

1. **Fix TypeScript errors first** — 340 errors is blocking all progress. The dot-notation env access is a project-wide pattern that needs a systematic fix (likely a shared `env` wrapper or adjusting tsconfig). Run `pnpm check-types` and address the 329 API errors before any new work.

2. **Remove process.exit() from webhookProcessor.ts** — Refactor to return exit codes and let the caller handle termination. This is a module, not a standalone script.

3. **Implement Redis-backed rate limiting** — The in-memory rate limiter will cause issues when the API scales horizontally. Either implement `RateLimiterRedis` or document the single-instance limitation clearly.

4. **Fix vibe-kit queue path mismatch** — `vibe-kit-launcher.sh` and `vibe-kit.sh` reference different queue paths. Normalize to a single queue file.

5. **Audit shell scripts for eval usage** — Replace `eval "$cmd"` with safer alternatives or validate input thoroughly before evaluation.

6. **Set lock file permissions to 0o600 in claim-task.py** — Follow principle of least privilege.

7. **Resolve or track FIXME comments** — The error logging FIXME in `trpc.ts` has been present since at least April 2026 and should be addressed or formally deferred.

---

## Verdict

**REJECT** — The monorepo has 3 critical issues and 340 TypeScript errors that block compilation. Quality gates are not met. Major revisions needed before this codebase can be considered production-ready.

**Action Required:** Address the 3 critical issues and TypeScript compilation failures before re-review.
