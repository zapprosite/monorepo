# Redis Architecture — Hermes Agency

**Redis Endpoint:** `redis://zappro-redis:6379` (password: `Fifine156458*`)
**Max Memory:** 512MiB (`GOMEMLIMIT`)
**Eviction Policy:** `allkeys-lru`
**AOF:** every 1 second

---

## 1. Rate Limiting

**Key Pattern:** `ratelimit:{userId}:{bot}`
**Algorithm:** Sliding window (INCR + PTTL)
**Window:** `HERMES_RATE_WINDOW_MS` — 10000ms (10 seconds)
**Max:** `HERMES_RATE_MAX_MSGS` — 5 messages per window
**Implementation:** `/src/telegram/rate_limiter.ts`

### Sliding Window Implementation

```
MULTI
INCR ratelimit:{userId}:{bot}
PTTL ratelimit:{userId}:{bot}
EXEC

-- If count == 1 (first request), set expiry:
PEXPIRE ratelimit:{userId}:{bot} {HERMES_RATE_WINDOW_MS}
```

**Allowed:** `count <= HERMES_RATE_MAX_MSGS`
**Rejected:** `count > HERMES_RATE_MAX_MSGS` → return `retryAfterSec = ceil(TTL / 1000)`

### Fallback

When Redis is unavailable, falls back to in-memory `Map<userId, { count, resetAt }>`.
**Warning:** Single-instance only in fallback mode.

---

## 2. Distributed Locks

**Key Pattern:** `lock:{resource}`
**TTL:** `HERMES_LOCK_TTL_SEC` — 30 seconds
**Algorithm:** `SET key value NX EX ttl`
**Implementation:** `/src/telegram/distributed_lock.ts`

### Acquire Lock

```
SET lock:{resource} {ownerId} NX EX {HERMES_LOCK_TTL_SEC}
-- Returns "OK" if acquired, null if already held
```

### Release Lock

```
DEL lock:{resource}
-- Only if value matches ownerId (Lua script for atomicity)
```

### Usage

- File uploads (per-chat lock)
- Concurrent skill execution (per-skill lock)
- Any resource that must not be accessed concurrently

### Fallback

When Redis unavailable, uses `Map<resource, expiryTimestamp>` in memory.
**Warning:** Single-instance only in fallback mode.

---

## 3. Session Cache

**Key Pattern:** `session:{sessionId}`
**TTL:** 1 hour (3600 seconds)
**Stores:**
- Conversation context
- Current skill being executed
- Pending state (e.g., wizard progress)
- User preferences

### Structure

```json
{
  "context": { ... },
  "currentSkill": "skill-id",
  "pendingState": { ... },
  "preferences": { ... },
  "createdAt": 1713000000000,
  "lastAccessedAt": 1713003600000
}
```

### Session Lifecycle

1. **Create:** On first user message, generate `sessionId` (UUIDv4)
2. **Update:** On each interaction, touch `lastAccessedAt`
3. **Expire:** Redis auto-expires after 1 hour of inactivity
4. **Delete:** On logout or explicit end-session

---

## 4. Circuit Breaker State

**Key Patterns:**
- `cb:{skillId}:state` — `CLOSED`, `OPEN`, or `HALF_OPEN`
- `cb:{skillId}:failures` — failure count (integer)
- `cb:{skillId}:last_failure` — Unix timestamp (ms)

**TTL:** 30 seconds (auto-cleanup for all CB keys)

### State Machine

```
CLOSED → (failures >= threshold) → OPEN
OPEN → (timeout elapsed) → HALF_OPEN
HALF_OPEN → (success) → CLOSED
HALF_OPEN → (failure) → OPEN
```

### Thresholds (configurable via env)

| Parameter | Env Var | Default |
|-----------|---------|---------|
| Failure threshold | `HERMES_CB_FAILURE_THRESHOLD` | 5 |
| Open duration | `HERMES_CB_OPEN_DURATION_MS` | 30000 (30s) |
| Half-open max requests | `HERMES_CB_HALF_OPEN_MAX` | 3 |

### Implementation Notes

- State transitions must be atomic (use Lua scripts or WATCH/MULTI)
- `last_failure` used to calculate time since last failure
- All keys share the same 30s TTL for synchronized cleanup

---

## 5. Cache Patterns

### 5.1 RAG Query Cache

**Key Pattern:** `cache:rag:{datasetId}:{query_hash}`
**TTL:** 5 minutes (300 seconds)
**Value:** Serialized search results (JSON array of document IDs + scores)

```
query_hash = SHA256(normalized_query_text)
```

**Cache-aside pattern:**
```
1. GET cache:rag:{datasetId}:{query_hash}
2. If HIT → return cached results
3. If MISS → query vector DB → SET cache:rag:{datasetId}:{query_hash} EX 300
```

### 5.2 LLM Response Cache

**Key Pattern:** `cache:llm:{model}:{prompt_hash}`
**TTL:** 1 hour (3600 seconds)
**Value:** LLM response text
**Note:** `prompt_hash = SHA256(model + prompt_text)` — includes model to differentiate responses for same prompt

**Use cases:**
- Repeated identical prompts (e.g., system instructions)
- Cheaper/faster for debug messages
- **Do not cache** when `temperature > 0` or for non-deterministic outputs

### 5.3 Metrics Cache

**Key Pattern:** `cache:metrics:{campaignId}:{date}`
**TTL:** 15 minutes (900 seconds)
**Value:** Aggregated metrics JSON

```json
{
  "sent": 1500,
  "delivered": 1480,
  "failed": 20,
  "opened": 320,
  "clicked": 85,
  "date": "2026-04-23"
}
```

---

## 6. Pub/Sub Channels

### 6.1 System Alerts

**Channel:** `agency:alerts`
**Publisher:** System components (monitoring, health checks)
**Subscribers:** All agency instances

**Message format:**
```json
{
  "severity": "INFO|WARN|ERROR|CRITICAL",
  "source": "component-name",
  "message": "Alert description",
  "timestamp": 1713000000000
}
```

### 6.2 Campaign Updates

**Channel:** `agency:campaigns:{clientId}`
**Publisher:** Campaign worker processes
**Subscribers:** Client-specific handlers

**Message format:**
```json
{
  "type": "STATUS_CHANGE|STATS_UPDATE|CAMPAIGN_COMPLETE",
  "campaignId": "uuid",
  "data": { ... },
  "timestamp": 1713000000000
}
```

### 6.3 Task Assignments

**Channel:** `agency:tasks:{userId}`
**Publisher:** Task orchestration components
**Subscribers:** Specific user sessions

**Message format:**
```json
{
  "taskId": "uuid",
  "type": "SKILL_EXECUTE|CONTEXT_UPDATE|ABORT",
  "payload": { ... },
  "timestamp": 1713000000000
}
```

---

## 7. Keyspace Notifications

Enable Redis keyspace notifications for:

```
CONFIG SET notify-keyspace-events Ex
```

**Monitored events:**
- `Ex` — Expired keys (for cleanup tracking)
- `Evicted` — Evicted keys (when `maxmemory` reached)

**Use cases:**
- Log when keys expire for debugging
- Track eviction rate as health metric
- Trigger cache warming on miss patterns

---

## 8. Memory Management

### Redis Configuration

```
maxmemory 512mb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
```

### Memory Breakdown (expected)

| Key Pattern | Est. Size per Key | Expected Count | Total |
|-------------|-------------------|----------------|-------|
| `ratelimit:*` | ~64 bytes | ~1000/day | ~64KB |
| `lock:*` | ~48 bytes | ~10 concurrent | ~480B |
| `session:*` | ~4KB | ~50 active | ~200KB |
| `cb:*` | ~64 bytes | ~20 skills | ~1.3KB |
| `cache:rag:*` | ~16KB | ~100 | ~1.6MB |
| `cache:llm:*` | ~8KB | ~200 | ~1.6MB |
| `cache:metrics:*` | ~256 bytes | ~50 | ~13KB |

**Total estimated:** ~4MB (well within 512MB limit)

---

## 9. Health Checks

### Per-Connection Health

```bash
redis-cli -h zappro-redis -p 6379 -a 'Fifine156458*' PING
# Expected: PONG
```

### Key Metrics to Monitor

1. **Memory usage:** `INFO memory | grep used_memory_human`
2. **Hit rate:** `INFO stats | grep keyspace`
3. **Connected clients:** `INFO clients | grep connected_clients`
4. **Replication lag:** `INFO replication | grep lag`
5. **Expired keys/sec:** `INFO stats | grep expired`
6. **Evicted keys/sec:** `INFO stats | grep evicted`

### Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Memory used | > 400MB | > 480MB |
| Connected clients | > 50 | > 100 |
| Evicted keys/sec | > 10 | > 100 |
| Replication lag | > 1s | > 5s |

---

## 10. Key Discrepancies with Current Implementation

> **Note:** The following discrepancies exist between this architecture and the current code implementation and should be reconciled:

| Feature | Current Key Pattern | Specified Key Pattern | Action |
|---------|--------------------|-----------------------|--------|
| Rate limit | `ratelimit:{userId}` | `ratelimit:{userId}:{bot}` | Add bot dimension |
| Distributed lock | `chat:{chatId}:lock` | `lock:{resource}` | Rename key prefix |

### Migration Plan

1. Deploy new key patterns alongside old patterns
2. Add dual-write during transition period
3. After 1 week, add TTL migration job for old keys
4. Remove old key pattern writes after TTL expires

---

## 11. Redis Client Configuration

```typescript
// src/telegram/redis.ts
export const redisConfig = {
  host: process.env['REDIS_HOST'] ?? 'zappro-redis',
  port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
  password: process.env['REDIS_PASSWORD'] ?? 'Fifine156458*',
  retryStrategy: (times: number) => {
    if (times > 10) return null; // Stop retrying
    return Math.min(times * 200, 2000);
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  enableOfflineQueue: false, // Fail fast, don't queue
};
```

---

## 12. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REDIS_HOST` | `zappro-redis` | Redis hostname |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | `Fifine156458*` | Redis password |
| `HERMES_RATE_WINDOW_MS` | `10000` | Rate limit window (ms) |
| `HERMES_RATE_MAX_MSGS` | `5` | Max messages per window |
| `HERMES_LOCK_TTL_SEC` | `30` | Lock TTL (seconds) |
| `HERMES_CB_FAILURE_THRESHOLD` | `5` | Circuit breaker failure threshold |
| `HERMES_CB_OPEN_DURATION_MS` | `30000` | Circuit breaker open duration (ms) |
| `HERMES_CB_HALF_OPEN_MAX` | `3` | Max requests in half-open state |
