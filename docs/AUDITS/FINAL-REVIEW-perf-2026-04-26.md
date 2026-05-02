# Performance Review — 2026-04-26

**Reviewer:** perf-reviewer
**Scope:** apps/api, apps/ai-gateway, scripts, vibe-kit

---

## Findings

### CRITICAL

- **[CRITICAL] Blocking sync I/O in audio processing** — `apps/ai-gateway/src/routes/audio-transcriptions.ts:75,79`
  - `fs.writeFileSync(tmpIn, audioBytes)` and `fs.readFileSync(tmpOut)` called inside async function `toWav16k()`
  - Blocks Node.js event loop during audio transcoding (up to 30s timeout at line 77)
  - **Impact:** All concurrent requests blocked while ffmpeg runs
  - **Fix:** Use `fs.promises.writeFile()` / `fs.promises.readFile()` or `fs.createReadStream` pipeline

- **[CRITICAL] N+1 query in webhook processor** — `apps/api/src/modules/api-gateway/utils/webhookQueue.utils.ts:183-185`
  - `db.teams.find(webhook.teamId)` called inside `for (const webhook of pendingWebhooks)` loop (line 171)
  - With 50 webhooks (WEBHOOK_BATCH_PROCESSING_LIMIT=50), this is up to 50 sequential DB queries
  - **Impact:** O(n) DB roundtrips, 50ms+ latency per webhook
  - **Fix:** Batch fetch all teams upfront: `db.teams.where({ teamId: { in: pendingWebhooks.map(w => w.teamId) } })`

### HIGH

- **[HIGH] Unbounded async map in reorderColumns** — `apps/api/src/modules/kanban/kanban.trpc.ts:120-126`
  - `columnIds.map(async (columnId, index) => { ... await db.kanbanColumns.findOptional(columnId) ... })` wrapped in `Promise.all`
  - Each iteration does 2 sequential DB calls (findOptional + update)
  - **Impact:** If reordering 20 columns, 40 sequential DB operations despite Promise.all
  - **Fix:** Single batch query to verify all columns exist, then single bulk update

- **[HIGH] Large hardcoded pagination limits without cursor-based pagination** — `apps/api/src/modules/clients/clients.trpc.ts:20`, `reminders.trpc.ts:10`, `contracts.trpc.ts:12`
  - `CLIENTS_MAX_LIMIT=200`, `REMINDERS_MAX_LIMIT=500`, `CONTRACTS_MAX_LIMIT=500`
  - Returns up to 500 full rows with no cursor/token pagination
  - **Impact:** Memory pressure on large result sets, no stable pagination for infinite scroll
  - **Fix:** Implement cursor-based pagination (keyset) for large datasets

### MEDIUM

- **[MEDIUM] Sync crypto.randomBytes in API key generation** — `apps/api/src/modules/api-gateway/utils/apiKeyGenerator.utils.ts:11`
  - `crypto.randomBytes(24)` is synchronous
  - **Impact:** Minor blocking on key generation (not hot path per-request)
  - **Fix:** Acceptable for now, but consider async `crypto.randomBytes()` if key gen becomes frequent

- **[MEDIUM] Missing query result caching for repeated lookups** — `apps/api/src/modules/api-gateway/middleware/requestLogger.middleware.ts:80-96`
  - Every API request logs to `apiProductRequestLogs` table and calls `incrementSubscriptionUsage()` (line 96)
  - Two DB writes per request, no batching
  - **Impact:** High write amplification, especially at scale
  - **Fix:** Buffer logs in memory, flush periodically or on shutdown

### LOW

- **[LOW] Client map lookups use Set deduplication** — `apps/api/src/modules/reminders/reminders.trpc.ts:38, contracts.trpc.ts:40`
  - Pattern `[...new Set(array.map(...))]` is O(n) but acceptable
  - Not an issue at current scale

- **[LOW] Rate limiter uses in-memory storage** — `apps/api/src/trpc.ts:141-150`
  - `RateLimiterMemory` stores state in process memory
  - **Impact:** No rate limit persistence across restarts, doesn't work in multi-instance deployments
  - **Fix:** Use Redis-backed rate limiter for production

---

## Recommendations

1. **Immediate (Critical):** Replace `fs.writeFileSync`/`fs.readFileSync` in `audio-transcriptions.ts` with async equivalents
2. **Immediate (Critical):** Batch fetch teams in `webhookQueue.utils.ts` before the loop
3. **High:** Refactor `reorderColumns` to batch-verify and batch-update columns
4. **High:** Add cursor-based pagination to high-cardinality list endpoints
5. **Medium:** Buffer API request logs and flush in batches instead of per-request
6. **Medium:** Move to Redis-backed rate limiter when scaling beyond single instance

---

## Bundle Size

- **ai-gateway:** Minimal deps (fastify, axios, zod) — **GOOD**
- **api:** orchid-orm + pg are heavy but necessary — **ACCEPTABLE**

No oversized dependencies detected (lodash, moment, etc.).

---

## Blocking Issues

**Count:** 2 (CRITICAL)

1. Sync I/O in audio processing (event loop blocking)
2. N+1 query in webhook processor (DB roundtrips)

---

*Report generated: 2026-04-26*
