# Correctness Review — 2026-04-26

**Reviewer:** correctness-reviewer
**Scope:** apps/api, scripts, .claude/vibe-kit, AGENTS.md, CLAUDE.md, HARDWARE_HIERARCHY.md

---

## Findings

### CRITICAL

#### 1. SQL Operator Precedence Bug — Session Expiry Calculation
**File:** `apps/api/src/modules/auth/session.auth.store.ts:46`
```ts
expiresAt: () => sql`NOW() + ${this.cookieMaxAgeSeconds} * INTERVAL '1 SECOND'`,
```
**Issue:** PostgreSQL operator precedence causes incorrect calculation. `NOW() + n * INTERVAL '1 SECOND'` is evaluated as `(NOW() + n) * INTERVAL '1 SECOND'`, not `NOW() + (n * INTERVAL '1 SECOND')`. This makes the expiry timestamp completely wrong (off by orders of magnitude).
**Same issue at line 142** in the `touch` method.

#### 2. Buffer Mismatch in API Key Verification — Uncaught Exception
**File:** `apps/api/src/modules/api-gateway/utils/apiKeyGenerator.utils.ts:43`
```ts
return crypto.timingSafeEqual(Buffer.from(storedHash, "hex"), Buffer.from(derivedHash, "hex"));
```
**Issue:** If `storedHash` from DB has odd-length hex string (corrupted or malformed), `Buffer.from(storedHash, "hex")` silently truncates to an even length, causing a size mismatch with `derivedHash`. `timingSafeEqual` throws a `RangeError` if buffers have different lengths — this propagates as an uncaught exception instead of returning `false`. Should validate hex length before comparison and wrap in try/catch.

---

### IMPORTANT

#### 3. Nested Transaction in Subscription Tracker
**File:** `apps/api/src/modules/api-gateway/utils/subscriptionTracker.utils.ts:111-132`
```ts
return db.$transaction(async () => {
  // Queue webhook + mark notified
  return await Promise.all([createWebhook, markNotified]);
});
```
**Issue:** `checkAndQueueWebhookAt90Percent` is called inside `incrementSubscriptionUsage` which already runs in a `$transaction`. The nested `$transaction` may not behave as expected depending on the Orchid ORM driver — could silently ignore nesting or create savepoints incorrectly. Should verify if nesting is supported or flatten to a single transaction.

#### 4. API Key Verification Crashes on Malformed Hash
**File:** `apps/api/src/modules/api-gateway/utils/apiKeyGenerator.utils.ts:33-43`
```ts
export async function verifyApiKey(plainKey: string, hash: string): Promise<boolean> {
  const [salt, storedHash] = hash.split(":");
  if (!salt || !storedHash) {
    return false;
  }
  // ... later ...
  return crypto.timingSafeEqual(Buffer.from(storedHash, "hex"), Buffer.from(derivedHash, "hex"));
}
```
**Issue:** While split validation exists, `Buffer.from(storedHash, "hex")` with odd-length string throws a `RangeError`. No try/catch — the function will throw uncaught. Should wrap entire verification in try/catch returning `false`.

#### 5. Silent 204 Return for Non-Existent User
**File:** `apps/api/src/modules/api-gateway/handlers/save_journal_entry.handler.ts:35-40`
```ts
const userExists = await db.users.findBy({ userId: teamUserReferenceId }).exists();
if (!userExists) {
  return reply.code(204).send(); // Silent 204 — no logging
}
```
**Issue:** Returns `204 No Content` without any logging when `teamUserReferenceId` doesn't exist. If this is a programming error (wrong ID passed), it silently succeeds from client perspective. Should at minimum log a warn, or return 400/404.

#### 6. CORS Preflight Returns 401 Without Setting Headers
**File:** `apps/api/src/modules/api-gateway/middleware/corsValidation.middleware.ts:29-35`
```ts
if (!teamId || typeof teamId !== "string") {
  return reply.code(401).send({...});
}
```
**Issue:** When preflight fails auth, it returns 401 but doesn't set CORS headers. Browsers may block this response from being processed correctly since CORS headers are absent. Should always set `Access-Control-Allow-Origin` even on error responses.

---

### MINOR

#### 7. `omit` Utility Mutates Copied Object
**File:** `apps/api/src/utils/omit.utils.ts:1-7`
```Issue:** `delete newObj[key]` mutates the shallow copy in place. Not a correctness issue since original is untouched, but inconsistent with immutability patterns. Could use `Object.fromEntries(Object.entries(obj).filter(...))`.

#### 8. Session Store Upsert Missing Unique Key Specification
**File:** `apps/api/src/modules/auth/session.auth.store.ts:40-62`
```ts
await this.db.sessions.selectAll().findBy({ sessionId }).upsert({...});
```
**Issue:** Orchid ORM's `upsert` requires an `upsertOn` clause to specify which unique key(s) to match for the upsert logic. Without it, the behavior is undefined — may silently fail or behave incorrectly on duplicate `sessionId`.

#### 9. Hardcoded API Gateway Version in User-Agent
**File:** `apps/api/src/modules/api-gateway/utils/webhookQueue.utils.ts:72`
```ts
"User-Agent": "API-Gateway-Webhook/1.0",
```
**Issue:** User-Agent is hardcoded. Should use `process.env.npm_package_version` or similar for dynamic versioning.

---

## Recommendations

| Priority | File | Line(s) | Fix |
|----------|------|---------|-----|
| CRITICAL | session.auth.store.ts | 46, 142 | `sql\`NOW() + (${this.cookieMaxAgeSeconds} * INTERVAL '1 SECOND')\`` |
| CRITICAL | apiKeyGenerator.utils.ts | 33-43 | Wrap in try/catch, validate hex length is even |
| IMPORTANT | subscriptionTracker.utils.ts | 111 | Remove nested `$transaction` |
| IMPORTANT | apiKeyGenerator.utils.ts | all | Wrap entire body in try/catch returning false |
| IMPORTANT | save_journal_entry.handler.ts | 35 | Add warn log for missing user |
| IMPORTANT | corsValidation.middleware.ts | 29-35 | Always set CORS headers before returning |

---

## Verdict

| Category | Count |
|----------|-------|
| Critical | 2 |
| Important | 4 |
| Minor | 3 |
| **Total** | **9** |

**Blocking Issues:** 2 (SQL operator precedence, API key verification crash)

**Recommendation:** Do not merge without fixing CRITICAL issues. The SQL interval bug causes session expiry to be calculated incorrectly, affecting authentication security. The API key verification throws on malformed input rather than failing gracefully.

---

*Review generated by correctness-reviewer agent — 2026-04-26*
