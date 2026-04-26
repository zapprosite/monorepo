# Correctness Review — 2026-04-26

**Reviewer:** correctness-reviewer agent
**Scope:** apps/api, scripts/, vibe-kit/, AGENTS.md, CLAUDE.md
**Rate Limit:** 500 RPM (code analysis focus, no API calls)

---

## Findings

### [HIGH] Error Logging Bypass in tRPC Error Formatter

**File:** `apps/api/src/trpc.ts:44-46`

```typescript
// FIXME: The present implementation send the correct error to frontend but the error logging at apps/backend/src/app.ts is not working as expected.
// console.log(error.cause);
// console.log(error.stack);
```

**Issue:** The FIXME comment documents that error cause/stack are commented out, meaning errors reaching the formatter are logged to the frontend but not properly logged server-side for debugging.

**Severity:** HIGH — Without error stack traces in logs, debugging production issues is significantly harder.

---

### [MEDIUM] Inconsistent Error Response Shape in Error Handler

**File:** `apps/api/src/app.ts:29-34`

```typescript
const errorResponse = {
  status: "error",
  message: error.message || "Something went wrong",
  errorCode: "INTERNAL_SERVER_ERROR",
  stack: isDev ? error.stack : undefined,
};
```

**Issue:** The `status: "error"` field is added to errorResponse but never used in any handler. Additionally, `errorCode` is set to `"INTERNAL_SERVER_ERROR"` as default, but in the AppError handler it's overwritten with `error.errorCode || \`HTTP_${error.statusCode}\``. This creates inconsistent error codes between different error types.

**Severity:** MEDIUM — Inconsistency in error response shapes can confuse API consumers.

---

### [MEDIUM] Debuggable console.log in Production Error Handler

**File:** `apps/api/src/app.ts:120`

```typescript
console.log("ERROR HANDLER ACTIVATED", error);
```

**Issue:** Using `console.log` instead of the proper Fastify logger (`request.log` or `server.log`). In production, this bypasses structured logging and goes to stdout/stderr instead of being captured by the logging system.

**Severity:** MEDIUM — Breaks structured logging patterns and may not be captured by log aggregation.

---

### [MEDIUM] Database Session Store Instantiation Outside App Lifecycle

**File:** `apps/api/src/app.ts:48`

```typescript
const sessionStore = new DatabaseSessionStore(db, cookieMaxAge);
```

**Issue:** The session store is created at module import time, not within the app initialization. If the database connection isn't ready when this module loads, it could fail. Additionally, this pattern makes testing harder since the store can't be mocked after import.

**Severity:** MEDIUM — Tight coupling between module load order and database initialization.

---

### [MEDIUM] Team Rate Limiter Memory Leak Potential

**File:** `apps/api/src/modules/api-gateway/middleware/teamRateLimit.middleware.ts:14-28`

```typescript
function getTeamRateLimiter(teamId: string, rateLimit: number): RateLimiterMemory {
  let limiter = teamRateLimiters.get(teamId);
  if (!limiter || limiter.points !== rateLimit) {
    limiter = new RateLimiterMemory({...});
    teamRateLimiters.set(teamId, limiter);
  }
  return limiter;
}
```

**Issue:** The `teamRateLimiters` Map grows unbounded as new teams are encountered. If teams are created/deleted dynamically, old limiters are never garbage collected unless the process restarts.

**Severity:** MEDIUM — Memory leak for long-running processes with many teams.

---

### [MEDIUM] Missing TRPCError Code in Error Parser

**File:** `apps/api/src/utils/errorParser.ts`

**Issue:** The `trpcErrorParser` function handles these TRPCError codes:
- `BAD_REQUEST`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `PRECONDITION_FAILED`, `TOO_MANY_REQUESTS`

But the error formatter in `trpc.ts` maps these codes (from `errorHandler.ts:58-73`):
- `PARSE_ERROR`, `BAD_REQUEST`, `INTERNAL_SERVER_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `METHOD_NOT_SUPPORTED`, `TIMEOUT`, `CONFLICT`, `PRECONDITION_FAILED`, `PAYLOAD_TOO_LARGE`, `UNPROCESSABLE_CONTENT`, `TOO_MANY_REQUESTS`, `CLIENT_CLOSED_REQUEST`

Missing in `trpcErrorParser`: `PARSE_ERROR`, `METHOD_NOT_SUPPORTED`, `TIMEOUT`, `PAYLOAD_TOO_LARGE`, `UNPROCESSABLE_CONTENT`, `CLIENT_CLOSED_REQUEST`, `INTERNAL_SERVER_ERROR`.

**Severity:** MEDIUM — These error codes fall through to the default case with generic "unexpected error" message.

---

### [LOW] User Existence Check Returns 204 Without Body for Non-Existent User

**File:** `apps/api/src/modules/api-gateway/handlers/save_journal_entry.handler.ts:37-40`

```typescript
if (!userExists) {
  // return empty response
  return reply.code(204).send();
}
```

**Issue:** According to REST conventions, 204 No Content should be used when the response has no body. However, this endpoint has a 201 response schema defined in OpenAPI (`journalEntrySelectAllZod`). Returning 204 when user doesn't exist (but request is authenticated) is inconsistent with the documented API contract.

**Severity:** LOW — Ambiguous API contract; consumer doesn't know if 204 means "success with no content" or "user doesn't exist".

---

### [LOW] Bash mapfile Usage Without Version Check

**File:** `scripts/prune-subdomain.sh:40`

```bash
mapfile -t FILES_WITH_REF < <(grep -rls ... "/srv/monorepo" ...)
```

**Issue:** `mapfile` (also known as `readarray`) was introduced in Bash 4.0. The script shebang is `#!/bin/bash` but doesn't check for Bash 4+. If run on an older system (common in containers), this will fail.

**Severity:** LOW — May fail on systems with Bash < 4.0.

---

### [LOW] Prune-Subdomain Script Ignores SCAN_DIR Argument

**File:** `scripts/prune-subdomain.sh:39`

```bash
SCAN_DIR="${2:-/srv/monorepo}"
```

**Issue:** The script accepts a second argument for SCAN_DIR but never uses it. The grep command on line 40 hardcodes `/srv/monorepo` as the search path instead of using `$SCAN_DIR`.

**Severity:** LOW — Dead code; the variable is assigned but never referenced.

---

### [LOW] Nullable userId in SessionUser Type

**File:** `apps/api/src/modules/auth/session.auth.utils.ts:16`

```typescript
export interface SessionUser {
  userId: string | null;  // <-- can be null?
  email: string;
  name: string | null;
  displayPicture: string | null;
}
```

**Issue:** `userId: string | null` but `userId` is used as a required identifier in `trpc.ts:93` (`if (!ctx.user?.userId)`). Having null as a valid type for userId creates confusion about whether a session can exist without a userId.

**Severity:** LOW — Type safety issue; if userId can be null, session isn't truly "authenticated".

---

### [LOW] Zod Validation Error Causes Information Disclosure in Production

**File:** `apps/api/src/app.ts:52`

```typescript
errors: error.issues,
```

**Issue:** Zod validation error issues are returned in the response in production (`isDev` only affects `stack`). Field names from validation errors could help attackers understand the API schema.

**Severity:** LOW — Potential information disclosure of internal field names and validation rules.

---

## Recommendations

1. **Uncomment error logging** in `trpc.ts` or implement proper error logging in the error formatter
2. **Standardize error response shape** — ensure all error handlers return the same fields
3. **Replace console.log with proper logger** in error handler
4. **Consider WeakMap or LRU cache** for team rate limiters to prevent unbounded growth
5. **Add missing TRPCError codes** to `trpcErrorParser`
6. **Add Bash version check** or use POSIX-compatible alternative to `mapfile`
7. **Remove unused SCAN_DIR variable** or actually use it in the grep command
8. **Review 204 response behavior** — either document it or return a more appropriate status code
9. **Make userId non-nullable** in SessionUser if sessions always have a userId

---

## Verdict

| Category | Count |
|----------|-------|
| CRITICAL | 0 |
| HIGH | 1 |
| MEDIUM | 5 |
| LOW | 5 |
| **Total** | **11** |

**Verdict:** `APPROVE_WITH_CONDITIONS`

The codebase is generally well-structured with proper error handling patterns. However, the HIGH-severity issue (error logging bypass) should be addressed before production deployment. The MEDIUM-severity issues are architectural concerns that should be tracked and addressed in future iterations.

**Blocking Issues:** 1 (HIGH)
