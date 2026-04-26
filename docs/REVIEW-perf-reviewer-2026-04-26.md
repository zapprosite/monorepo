# Performance Review — perf-reviewer

**Date:** 2026-04-26
**Scope:** /srv/monorepo/apps/, /srv/monorepo/scripts/, symlinked services
**Updated:** Added new findings from current review pass

---

## Findings

### [CRITICAL] Journal Entries — Missing Pagination

**File:** `apps/api/src/modules/journal-entries/journal_entries.trpc.ts`
**Lines:** 12–25, 61–70

```typescript
getAll: protectedProcedure.query(async ({ ctx: { user: { userId } } }) => {
  const journalEntries = await db.journalEntries
    .select("*", { author: (t) => t.author.selectAll() })
    .where({ authorUserId: userId });
  return journalEntries;
}),
```

**Issue:** Returns ALL journal entries for a user with no limit/pagination. A user with thousands of entries will load unbounded data into memory and send massive payloads over the wire.

**Impact:** Memory exhaustion, network timeouts, UI degradation.

---

### [CRITICAL] Webhook Processor — N+1 Query Pattern

**File:** `apps/api/src/modules/api-gateway/utils/webhookQueue.utils.ts`
**Lines:** 171–192

```typescript
for (const webhook of pendingWebhooks) {
  // ...
  // Fetch team webhook bearer token (optional)
  const team = await db.teams
    .select("subscriptionAlertWebhookBearerToken")
    .find(webhook.teamId);
  // ...
  const result = await sendWebhook(webhook.webhookUrl, ...);
```

**Issue:** For each webhook in the batch (up to 50), a separate DB query fetches the team. This is classic N+1. Additionally, webhooks are processed **sequentially** — `await` inside the loop — rather than in parallel with `Promise.all()`.

**Impact:** For a 50-webhook batch: 1 initial query + 50 team queries = 51 queries, plus sequential HTTP calls. Could be 1 batch query + parallel HTTP calls.

---

### [HIGH] Blocking Sync File I/O in Audio Transcription Handler

**File:** `apps/ai-gateway/src/routes/audio-transcriptions.ts`
**Lines:** 75, 79

```typescript
async function toWav16k(audioBytes: Buffer, ext: string): Promise<Buffer> {
  // ...
  fs.writeFileSync(tmpIn, audioBytes);  // BLOCKING — line 75
  await execFileAsync('ffmpeg', ...);
  return fs.readFileSync(tmpOut);      // BLOCKING — line 79
}
```

**Issue:** `fs.writeFileSync` and `fs.readFileSync` are **synchronous blocking calls** inside an async function. This blocks the Node.js event loop during audio processing. The `bodyLimit` is set to 50MB, so these blocking calls can stall concurrent requests.

**Fix:** Use `fs.promises.writeFile` / `fs.promises.readFile` with `await`.

---

### [HIGH] Subscriptions Active — Missing Pagination

**File:** `apps/api/src/modules/api-gateway/api-gateway.router.ts`
**Lines:** 244–281

```typescript
handler: async (request, reply) => {
  const subscriptions = await db.subscriptions
    .where({ teamId, teamUserReferenceId, apiProductSku: "journal_entry_create" })
    .where({ expiresAt: { gt: sql`NOW()` } })
    .order({ createdAt: "DESC" });
  return reply.code(200).send(subscriptions);
},
```

**Issue:** No pagination. A team with many subscription records (e.g., due to upgrades/churn) returns unbounded results.

---

### [HIGH] Prompts Module — Missing Pagination

**File:** `apps/api/src/modules/prompts/prompts.trpc.ts`
**Lines:** 7–14, 58–65

```typescript
getAllActive: publicProcedure.query(async () => {
  const prompts = await db.prompts
    .where({ isActive: true })
    .select("*")
    .order({ createdAt: "DESC" });
  return prompts;
}),

getByCategory: publicProcedure.input(promptGetActiveZod).query(async ({ input }) => {
  const prompts = await db.prompts
    .where({ isActive: input.isActive })
    .select("*")
    .order({ createdAt: "DESC" });
  return prompts;
}),
```

**Issue:** Both endpoints return unbounded results. If the prompts table grows (e.g., user-generated templates), this will degrade.

---

### [HIGH] Equipment Module — Missing Pagination

**File:** `apps/api/src/modules/equipment/equipment.trpc.ts`
**Lines:** 20–24, 43–50, 52–56, 58–62

```typescript
listUnitsByClient: protectedProcedure.input(unitsByClientZod).query(async ({ input: { clienteId } }) => {
  return db.units.where({ clienteId }).order({ nome: "ASC" });
}),

listEquipment: protectedProcedure.input(listEquipmentFilterZod).query(async ({ input }) => {
  return query.order({ nome: "ASC" }); // no limit
}),
```

**Issue:** Multiple list endpoints return unbounded results. A client with hundreds of units/equipment will get unbounded payloads.

---

### [MEDIUM] Kanban Board Detail — Client-Side Card Filtering

**File:** `apps/api/src/modules/kanban/kanban.trpc.ts`
**Lines:** 55–61

```typescript
cards: cards.filter((card) => card.columnId === col.columnId),
```

**Issue:** All cards for all columns are fetched in a single query, then filtered in JavaScript for each column. With large boards this is O(n × m) where n = columns and m = cards, instead of pushing the filter to the database.

---

### [MEDIUM] Kanban Reorder — Redundant findOptional Inside Loop

**File:** `apps/api/src/modules/kanban/kanban.trpc.ts`
**Lines:** 119–127

```typescript
await Promise.all(
  columnIds.map(async (columnId, index) => {
    const column = await db.kanbanColumns.findOptional(columnId); // redundant
    if (!column) throw new TRPCError({ code: "NOT_FOUND", ... });
    return db.kanbanColumns.where({ columnId }).update({ ordem: index });
  }),
);
```

**Issue:** `findOptional` is called inside the update map for every columnId even though the caller already has validated UUIDs. Should validate existence once before the parallel update.

---

### [MEDIUM] RAG Ingest — Sync File Read in Async Generator

**File:** `scripts/rag-ingest.ts`
**Lines:** 93–118

```typescript
async function* walkDirectory(dir: string, extensions = [...]) {
  const fs = await import('fs');
  const path = await import('path');

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true }); // ← BLOCKING
    for (const entry of entries) {
      // ...
    }
  }
}
```

**Issue:** `fs.readdirSync` is a **synchronous blocking call** inside an async generator. For large directory trees (e.g., monorepo with thousands of files), this blocks the event loop during directory traversal.

**Fix:** Use `fs.promises.readdir` with `for await...of`.

---

### [MEDIUM] RAG Ingest — Sequential Embedding Batches

**File:** `scripts/rag-ingest.ts`
**Lines:** 226–256

```typescript
for (let i = 0; i < chunks.length; i += batchSize) {
  const batch = chunks.slice(i, i + batchSize);
  // ...
  const response = await fetch(`${ollamaUrl}/api/embed`, { ... }); // sequential await
  // ...
}
```

**Issue:** Embedding batches are processed sequentially. While the batch size is 10 (reasonable), each batch waits for the previous to complete. If Ollama can handle parallel requests, this is suboptimal.

---

### [MEDIUM] Prompt Random Selection — Flawed Random Logic

**File:** `apps/api/src/modules/prompts/prompts.trpc.ts`
**Lines:** 26–39

```typescript
for (let attempt = 0; attempt < 3; attempt++) {
  const randomIndex = Math.floor(Math.random() * count);
  const prompt = await db.prompts
    .where({ isActive: true, promptId: { gte: randomIndex } }) // promptId is UUID!
    .select("*")
    .limit(1)
    .take();
  // ...
}
```

**Issue:** `promptId` is a UUID (not a sequential integer), so `promptId: { gte: randomIndex }` does not produce a random selection. The `randomIndex` generated from `Math.floor(Math.random() * count)` is an integer in `[0, count)`, but comparing a UUID to an integer with `gte` is semantically wrong.

---

### [MEDIUM] PT-BR Filter — Cache Expiry Cleanup Only on Get

**File:** `apps/ai-gateway/src/middleware/ptbr-filter.ts`
**Lines:** 34–39

```typescript
function cacheSet(key: string, value: string) {
  if (cache.size >= CACHE_MAX) {
    const first = cache.keys().next().value;
    if (first) cache.delete(first);
  }
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}
```

**Issue:** Expired entries are only cleaned up on `cacheGet`, not on `cacheSet`. If entries expire but are never accessed (never called in `cacheGet`), they remain in the Map indefinitely, wasting memory. When cache fills to 512, only 1 entry is evicted (FIFO, not LRU).

**Fix:** Clean expired entries in `cacheSet` before inserting, or use a proper LRU/TTL cache (`lru-cache` package).

---

### [LOW] In-Memory Rate Limiter Map Without Eviction

**File:** `apps/api/src/modules/api-gateway/middleware/teamRateLimit.middleware.ts`
**Line:** 6

```typescript
const teamRateLimiters = new Map<string, RateLimiterMemory>();
```

**Issue:** The Map grows indefinitely as new teams make requests. `RateLimiterMemory` instances are never evicted. For long-running servers with many teams, this is a memory leak.

**Fix:** Add periodic cleanup or migrate to `RateLimiterRedis` for multi-instance deployments (already noted in code comment).

---

### [LOW] Service Order Creation — Sequential Validation Queries

**File:** `apps/api/src/modules/service-orders/service_orders.trpc.ts`
**Lines:** 52–66

```typescript
const cliente = await db.clients.findOptional(input.clienteId);
if (!cliente) throw ...;
if (input.tecnicoId) {
  const tecnico = await db.users.findOptional(input.tecnicoId);
  if (!tecnico) throw ...;
}
if (input.equipmentId) {
  const equipment = await db.equipment.findOptional(input.equipmentId);
  if (!tecnico) throw ...;
}
return db.serviceOrders.create(input);
```

**Issue:** Validation queries run sequentially. Could be parallelized with `Promise.all`.

---

### [LOW] Chat Completions — Sequential PT-BR Filter Per Choice

**File:** `apps/ai-gateway/src/routes/chat.ts`
**Lines:** 50–56

```typescript
if (ptbrEnabled && Array.isArray(upstream.choices)) {
  for (const choice of upstream.choices as Array<...>) {
    if (typeof choice.message?.content === 'string') {
      choice.message.content = await applyPtbrFilter(choice.message.content, acceptLang);
    }
  }
}
```

**Issue:** `await` inside a `for...of` loop processes choices sequentially. Practical impact is minimal (most responses have 1 choice), but could use `Promise.all` for generality.

---

## Recommendations

1. **Add pagination to all list endpoints** — Use `limit` + `offset` (or cursor-based) on `getAll`, `getByUser`, `getAllActive`, `getByCategory`, `listUnitsByClient`, `listEquipment`, `listEquipmentByClient`, `listEquipmentByUnit`, and the subscriptions endpoint. The API gateway's `/v1/logs` endpoint is a good reference implementation.

2. **Fix webhook processor N+1** — Batch-fetch all teams in a single query before the loop:
   ```typescript
   const teamIds = [...new Set(pendingWebhooks.map(w => w.teamId))];
   const teams = await db.teams.whereIn("teamId", teamIds).select(...);
   ```
   Then parallelize webhook sending with `Promise.all`.

3. **Replace blocking sync file I/O in audio-transcriptions** — Use `fs.promises.writeFile` and `fs.promises.readFile` with `await`.

4. **Use async `fs.readdir` in rag-ingest** — Replace `fs.readdirSync` with `fs.promises.readdir` and use `for await...of`.

5. **Fix prompt random selection** — Use proper random row selection at the DB level (e.g., `ORDER BY RANDOM()` in SQL, or fetch count + random offset).

6. **Fix PT-BR cache expiry** — Clean expired entries in `cacheSet`:
   ```typescript
   const now = Date.now();
   for (const [k, e] of cache.entries()) {
     if (e.expiresAt <= now) cache.delete(k);
   }
   ```
   Or replace with `lru-cache` for proper TTL + LRU eviction.

7. **Parallelize embedding batches in rag-ingest** — Use `Promise.all` with concurrency limit (e.g., 5 parallel batches) instead of sequential `for` loop.

8. **Parallelize service order validation** — Use `Promise.all` for client/tecnico/equipment validation when all are present.

9. **Add rate limiter Map eviction** — Periodically sweep for inactive team limiters or migrate to Redis-backed RateLimiter.

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 4 |
| MEDIUM | 6 |
| LOW | 3 |

**Top priorities:**
1. Add pagination to journal entries and prompts (CRITICAL — unbounded data)
2. Fix webhook processor N+1 + sequential processing (CRITICAL — 51 queries per batch)
3. Replace blocking sync file I/O in audio-transcriptions (HIGH — event loop blocking)
4. Add pagination to equipment and subscriptions (HIGH — growth risk)
