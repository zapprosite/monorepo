# Quality Review — 2026-04-26

**Reviewer:** quality-reviewer
**Scope:** `/srv/monorepo/apps/`, `/srv/monorepo/scripts/`, `/srv/monorepo/.claude/vibe-kit/`, root docs
**Files analyzed:** ~100 TypeScript/TSX files, 50+ shell scripts, 4 `package.json` files

---

## Findings

### HIGH

#### 1. vibe-kit state inconsistency
**File:** `.claude/vibe-kit/queue.json`, `.claude/vibe-kit/state.json`

`queue.json` shows all 17 tasks completed (brain-refactor, 2026-04-24), yet `state.json` reports `phase: "looping"`, `status: "running"`, `elapsed_seconds: 0`. The runner appears to be in a stale running state with no active tasks. This can cause confusion about actual system status.

```json
// state.json — inconsistent
{ "phase": "looping", "status": "running", "elapsed_seconds": 0 }

// queue.json — all done
{ "tasks": [ { "id": "T01", "status": "done" }, ... /* 17 total, all done */ ] }
```

**Recommendation:** Reset `state.json` to `{ "phase": "idle", "status": "ready", "elapsed_seconds": 0 }` when queue is empty. Add a consistency check in `vibe-kit.sh` on startup.

---

#### 2. `redis-stats.ts` uses undeclared dependency `ioredis`
**File:** `scripts/redis-stats.ts:6`

```ts
import Redis from 'ioredis';
```
The comment says `# Requires: ioredis (npm install ioredis)` but `ioredis` is not declared in any `package.json` in the monorepo. Running this script will fail with a module-not-found error unless the package happens to be installed globally or as a transitive dep.

**Recommendation:** Add `ioredis` to `dependencies` in the root `package.json` or the relevant script's package, or remove the import if the script is no longer in use.

---

#### 3. Stale `repository` fields in `package.json` files
**Files:** `apps/api/package.json:6`, `apps/ai-gateway/package.json` (implicit)

`apps/api/package.json` still carries:
```json
"repository": "git@github.com:teziapp/connected-repo-starter.git"
```
This is the original starter template URL, not the homelab monorepo (`zapprosite/homelab-monorepo`). The `ai-gateway` also does not reference the correct repo. This causes metadata drift and wrong provenance in published packages.

**Recommendation:** Update `repository` fields to `git@github.com:zapprosite/homelab-monorepo.git` in all `package.json` files.

---

#### 4. `apps/api` missing `lint` script
**File:** `apps/api/package.json`

`apps/ai-gateway` has `"lint": "biome lint src/"` but `apps/api` has no `lint` script. Meanwhile `CLAUDE.md` documents `pnpm lint` as a quick command, which delegates to turbo and will succeed (turbo passes through missing scripts), but the `api` app has no actual lint configuration. The root `package.json` also imports `@biomejs/biome` and `@typescript-eslint/eslint-plugin` as devDependencies.

**Recommendation:** Add `"lint": "biome check src/"` and `"lint:fix": "biome check --write src/"` to `apps/api/package.json`, or document why linting is intentionally skipped.

---

### MEDIUM

#### 5. `console.log` in production `kanban.logging.ts`
**File:** `apps/api/src/modules/kanban/kanban.logging.ts:104`

```ts
console.log("[KANBAN]", JSON.stringify(logEntry));
```
All other production code uses `pino` logger (via `logger.info`). Using `console.log` bypasses structured logging, goes to stdout without timestamps, and is invisible to the observability pipeline. The `kanban.logging.ts` comment at line 106 shows awareness of the need for observability integration but it was never wired up.

**Recommendation:** Replace with `logger.info({ logEntry })` using the pino instance from `@backend/app`.

---

#### 6. `FIXME` — broken error logging in tRPC
**File:** `apps/api/src/trpc.ts:44`

```ts
// FIXME: The present implementation send the correct error to frontend but
// the error logging at apps/backend/src/app.ts is not working as expected.
```
This is a tracked issue but the fix has not been addressed. Error stack traces and causes are swallowed in production, making debugging difficult.

**Recommendation:** Wire up error logging via pino's `logger.error({ err })` in the tRPC `errorFormatter`, or escalate to a known issue that needs prioritized fixing.

---

#### 7. `rag-ingest.ts` hardcoded relative paths
**File:** `scripts/rag-ingest.ts:34-50`

```ts
const KNOWLEDGE_SOURCES: Record<string, string[]> = {
  hermes: [ 'hermes-second-brain/' ],   // relative to /srv/monorepo
  monorepo: [ 'docs/', 'SPECS/', 'apps/*/src/' ],
  hvacr: [ 'apps/hvacr/' ],
  ...
};
```
The script requires being run from `/srv/monorepo` but has no validation. Paths like `hermes-second-brain/` only work because it's a symlink in the monorepo root. Using absolute paths (e.g., `/srv/monorepo/hermes-second-brain/`) would be more robust.

**Recommendation:** Validate `process.cwd()` or use absolute paths derived from `__dirname`.

---

#### 8. `cleanup-vibe.sh` references wrong directory
**File:** `.claude/vibe-kit/cleanup-vibe.sh:8`

```bash
VIBE_DIR="${HOME}/.claude/vibe-kit"   # → /home/will/.claude/vibe-kit
LOG_DIR="${VIBE_DIR}/logs"
```
But the actual vibe-kit location is `/srv/monorepo/.claude/vibe-kit/`. The cleanup script will operate on the wrong directory if `$HOME` differs from the machine where vibe-kit runs. Meanwhile `vibe-kit.sh` uses `$WORKDIR=/srv/monorepo/.claude/vibe-kit`.

**Recommendation:** Derive `VIBE_DIR` from the script's own location:
```bash
VIBE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
```

---

#### 9. `vibe-kit.sh` worker PID tracking is fragile
**File:** `.claude/vibe-kit/vibe-kit.sh:106`

```bash
echo $! >> $WORKDIR/.worker-pids
```
The `.worker-pids` file is appended to but never read or cleaned up during the run. Worker PIDs are stored but not used for health checking (it relies on `pgrep` of the mclaude process instead). The file becomes stale and grows unbounded.

**Recommendation:** Either use `.worker-pids` for cleanup/health (remove PID line when worker exits) or remove it entirely since `pgrep` is the actual health mechanism.

---

### LOW

#### 10. Inconsistent `any` usage (9 files, 10 occurrences)
**Files:** `apps/api/src/trpc.ts` (2), `apps/api/src/app.ts`, `apps/api/src/utils/errorParser.ts`, `apps/api/src/middlewares/sessionSecurity.middleware.ts`, `apps/api/src/modules/auth/session.auth.utils.ts`, `apps/api/src/modules/api-gateway/middleware/corsValidation.middleware.ts`, `apps/api/src/test-utils/env-setup.ts`, `apps/api/src/server.ts`, `apps/ai-gateway/src/schemas.ts`

The `any` type appears in 9 files across the codebase. Most are in middleware signatures or error handlers where typing is complex. Not a critical issue but worth tracking for gradual elimination.

**Recommendation:** Track in a tech-debt backlog. Prioritize middleware signatures where `any` can mask type errors.

---

#### 11. `redis-stats.ts` weak error handling for missing env var
**File:** `scripts/redis-stats.ts:12-13`

```ts
const REDIS_PASSWORD=process.env['REDIS_PASSWORD'];
if (!REDIS_PASSWORD) throw new Error("REDIS_PASSWORD not set in environment");
```
While the guard is present, `REDIS_PASSWORD` is not validated at startup of other dependent services. If the script is called without this env var, it throws but there's no mention of this requirement in CLAUDE.md or any documentation.

**Recommendation:** Document required env vars for `scripts/redis-stats.ts` in a header comment with an examples section, similar to `rag-ingest.ts`.

---

#### 12. `packages/` workspace declared but undocumented
**File:** `package.json:49-52`

```json
"workspaces": ["apps/*", "packages/*"]
```
CLAUDE.md documents only `apps/` structure and symlinked services, never mentioning `packages/`. The `packages/` directory contains `config/`, `ui/`, `zod-schemas/` — these are referenced as `@repo/zod-schemas` etc. but not explained in CLAUDE.md.

**Recommendation:** Add `packages/` to the homelab structure diagram in CLAUDE.md and HARDWARE_HIERARCHY.md.

---

#### 13. `vibe-kit.sh` `date` portability issue
**File:** `.claude/vibe-kit/vibe-kit.sh:236`

```bash
WORKER_ID="W$(date +%H%M%S%3N | tail -c 4)"
```
`+%3N` (nanoseconds) is GNU-specific. On BSD/macOS `date`, this would produce `N` literally or fail. While the script runs on Linux, using GNU-specific options reduces portability.

**Recommendation:** Use `printf '%04d' $((RANDOM % 10000))` or similar POSIX-compatible approach if portability is a concern.

---

#### 14. No `check-types` / `typecheck` command for `api`
**File:** `apps/api/package.json`

The `apps/ai-gateway` has `"typecheck": "tsc --noEmit"` but `apps/api` only has `"check-types": "tsc --noEmit"`. Meanwhile `CLAUDE.md` documents both `pnpm check-types` and `pnpm tsc --noEmit` — the latter doesn't exist as a root script. `pnpm tsc --noEmit` would fail at the workspace root.

**Recommendation:** Run `pnpm check-types` instead of `pnpm tsc --noEmit` in CLAUDE.md, or verify the alias actually works.

---

## Summary

| Severity | Count |
|----------|-------|
| HIGH     | 4     |
| MEDIUM   | 6     |
| LOW      | 4     |

**Overall Quality Assessment:** The codebase is in reasonable shape — TypeScript is consistently used, anti-hardcoded secrets rules are well enforced, and the overall architecture is sound. The most pressing issues are the **vibe-kit state inconsistency** (risk of misinterpreting system health), the **undeclared `ioredis` dependency** (will fail at runtime), and **stale repository URLs** (metadata contamination). The `console.log` in production code and the unfixed `FIXME` are also worth addressing to maintain observability and code discipline.

---

*Generated by quality-reviewer agent — 2026-04-26*
