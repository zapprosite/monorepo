# LLM Provider Architecture

## Overview

The LLM provider architecture uses a tiered strategy with MiniMax M2.7 as the primary provider, Ollama for local/vision tasks, Groq and OpenAI via LiteLLM proxy, and OpenRouter for aggregated provider access.

## Provider Priority Chain

```
Primary: MiniMax M2.7 (via LiteLLM :4000)
  ↓ (failure or timeout > 10s)
Fallback 1: Ollama Gemma4-12b-it (:11434)
  ↓ (failure or timeout > 30s)
Fallback 2: Groq via LiteLLM
  ↓ (failure or timeout > 30s)
Fallback 3: OpenAI GPT-4o via LiteLLM
  ↓ (ALL FAIL)
Error: last failure reason
```

## Provider Endpoints

| Provider    | Endpoint                     | Port  | Use Case                    |
|-------------|------------------------------|-------|-----------------------------|
| MiniMax     | api.minimax.io               | 443   | Primary text, CEO routing  |
| Ollama      | localhost                     | 11434 | Vision, STT, local fallback |
| Groq        | via LiteLLM                  | 4000  | Fast inference               |
| OpenAI      | via LiteLLM                  | 4000  | GPT models                   |
| OpenRouter  | via LiteLLM                  | 4000  | Aggregated providers        |
| LiteLLM     | localhost                    | 4000  | Unified proxy               |

## Task-to-Provider Mapping

| Task Type             | Primary        | Fallback           | Notes                     |
|-----------------------|----------------|--------------------|---------------------------|
| CEO routing decision  | MiniMax        | Ollama Gemma4     | Fast, cheap               |
| Creative writing      | MiniMax        | Ollama Gemma4      | Scripts, copy, content    |
| Code/Analysis         | Ollama qwen2.5vl:7b | MiniMax       | Local for privacy         |
| Vision                | Ollama qwen2.5vl:7b | —               | Always local              |
| Embeddings            | Ollama nomic-embed-text | OpenAI ada-002 | 768d → 1536d projection  |
| Portuguese content     | MiniMax        | —                  | Better PT-BR              |
| Background tasks      | Groq           | OpenAI             | Fast inference            |
| Complex reasoning     | MiniMax/GPT-4  | —                  | >5s acceptable            |
| Fast response (<500ms)| Ollama        | Groq                | Local or fast inference  |

## Cost Management

### Token Counting

Each provider tracks:
- `tokensIn`: input tokens
- `tokensOut`: output tokens
- `totalCost`: accumulated cost

### Budget Alerts

| Threshold | Action                          |
|-----------|--------------------------------|
| 80%       | Alert: budget nearly exhausted |
| 100%      | Route to cheaper providers only |

### Provider Cost Per 1M Tokens

| Provider   | Model           | Input Cost | Output Cost |
|------------|-----------------|------------|-------------|
| MiniMax    | minimax-m2.7    | $0.10      | $0.10       |
| Ollama     | gemma4-12b-it   | $0         | $0          |
| Ollama     | qwen2.5vl:7b    | $0         | $0          |
| Groq       | llama-3.3-70b   | $0.05      | $0.08       |
| OpenAI     | gpt-4o          | $2.50      | $10.00      |

## Latency Routing

| Requirement     | Provider | Expected Latency |
|-----------------|----------|------------------|
| < 500ms         | Ollama   | Local, minimal   |
| 1-5s            | Groq     | Fast inference   |
| > 5s acceptable  | MiniMax  | Complex reasoning|
| > 5s acceptable | GPT-4o   | Complex reasoning|

## Retry with Backoff

```typescript
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000,    // 1s
  maxDelay: 4000,     // 4s
  jitter: 500,        // ±500ms
  perAttemptTimeout: 30000, // 30s
};
```

Backoff sequence: 1s → 2s → 4s (±jitter)

## Embedding Strategy

```typescript
const EMBEDDING_CONFIG = {
  primary: {
    provider: 'ollama',
    model: 'nomic-embed-text',
    dimensions: 768,
    endpoint: 'http://localhost:11434/api/embeddings',
  },
  fallback: {
    provider: 'openai',
    model: 'text-embedding-ada-002',
    dimensions: 1536,
    endpoint: 'http://localhost:4000/embeddings',
  },
};
```

### Dimension Projection

When switching from nomic-embed-text (768d) to ada-002 (1536d), apply a projection layer:
```typescript
// Project 768d → 1536d via linear projection matrix
const projectionMatrix = loadProjectionMatrix('nomic-to-ada002.pt');
```

## LiteLLM Configuration

LiteLLM proxy (:4000) routes to:

```yaml
model_list:
  - model_name: minimax-m2.7
    litellm_params:
      model: minimax/MiniMax-Text-01
      api_key: os.environ/MINIMAX_API_KEY

  - model_name: gemma4-12b-it
    litellm_params:
      model: ollama/gemma4-12b-it
      api_base: http://localhost:11434

  - model_name: qwen2.5vl:7b
    litellm_params:
      model: ollama/qwen2.5vl:7b
      api_base: http://localhost:11434

  - model_name: groq-llama-3.3-70b
    litellm_params:
      model: groq/llama-3.3-70b-versatile

  - model_name: gpt-4o
    litellm_params:
      model: gpt-4o
```

## Health Checks

Each provider should be checked periodically:

```typescript
interface ProviderHealth {
  provider: string;
  healthy: boolean;
  latencyMs: number;
  lastChecked: Date;
  error?: string;
}
```

## Implementation Notes

- **router.ts** — Primary text routing via MiniMax only
- **bot.ts** — Vision/STT use Ollama directly
- **rag-instance-organizer.ts** — Uses Trieve for vector search (not embedding providers directly)



---

## REDIS ARCHITECTURE

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
redis-cli -h zappro-redis -p 6379 -a '${REDIS_PASSWORD}' PING
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
  password: process.env['REDIS_PASSWORD'] ?? '${REDIS_PASSWORD}',
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
| `REDIS_PASSWORD` | `${REDIS_PASSWORD}` | Redis password |
| `HERMES_RATE_WINDOW_MS` | `10000` | Rate limit window (ms) |
| `HERMES_RATE_MAX_MSGS` | `5` | Max messages per window |
| `HERMES_LOCK_TTL_SEC` | `30` | Lock TTL (seconds) |
| `HERMES_CB_FAILURE_THRESHOLD` | `5` | Circuit breaker failure threshold |
| `HERMES_CB_OPEN_DURATION_MS` | `30000` | Circuit breaker open duration (ms) |
| `HERMES_CB_HALF_OPEN_MAX` | `3` | Max requests in half-open state |


---

## POSTGRES MCP

| `hvacr_xyz` | hvacr | xyz | HVAC-R business |
| `ops_governance` | ops | governance | Ops governance |

---

## Core Tables per Schema

All schemas share the same table structure:

### `clients`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | TEXT | Client name |
| `plan` | TEXT | basic, pro, enterprise |
| `health_score` | INT | Default 100 |
| `chat_id` | BIGINT | Telegram/signal chat ID |
| `created_at` | TIMESTAMPTZ | Creation timestamp |
| `metadata` | JSONB | Flexible metadata |

### `campaigns`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `client_id` | UUID | FK to clients |
| `name` | TEXT | Campaign name |
| `status` | TEXT | draft, active, paused, completed |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### `tasks`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | FK to campaigns |
| `title` | TEXT | Task title |
| `status` | TEXT | pending, in_progress, done |
| `assigned_to` | TEXT | Assignee identifier |
| `due_date` | TIMESTAMPTZ | Due date |
| `priority` | INT | Priority level (0=low) |

### `deliverables`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | FK to campaigns |
| `task_id` | UUID | FK to tasks (nullable) |
| `name` | TEXT | Deliverable name |
| `type` | TEXT | report, content, design, code |
| `status` | TEXT | draft, review, approved, delivered |
| `url` | TEXT | External URL (S3, GDrive, etc.) |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

### `metrics`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `campaign_id` | UUID | FK to campaigns |
| `metric_date` | DATE | Date of metric |
| `impressions` | INT | Ad impressions |
| `clicks` | INT | Click count |
| `conversions` | INT | Conversions |
| `spend` | DECIMAL(10,2) | Money spent |
| `revenue` | DECIMAL(10,2) | Revenue generated |
| `created_at` | TIMESTAMPTZ | Creation timestamp |

---

## Indexes

### B-tree Indexes
- `idx_clients_chat_id` on `clients(chat_id)`
- `idx_campaigns_client_id` on `campaigns(client_id)`
- `idx_campaigns_status` on `campaigns(status)`
- `idx_tasks_campaign_id` on `tasks(campaign_id)`
- `idx_tasks_status` on `tasks(status)`
- `idx_deliverables_campaign_id` on `deliverables(campaign_id)`
- `idx_metrics_campaign_id` on `metrics(campaign_id)`
- `idx_metrics_date` on `metrics(metric_date)`

### GIN Indexes
- `idx_clients_metadata` on `clients(metadata)` — JSONB GIN

### Partial Indexes
- `idx_campaigns_active` on `campaigns(status)` WHERE `status = 'active'`
- `idx_tasks_pending` on `tasks(status)` WHERE `status = 'pending'`

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `create_schema` | Create schema `{app}_{lead?}` |
| `drop_schema` | Drop schema (CASCADE) |
| `list_schemas` | List schemas, optionally filter by app |
| `create_table` | Create table with column definitions |
| `drop_table` | Drop table |
| `list_tables` | List tables in schema |
| `describe_table` | Get column metadata |
| `query` | Execute SELECT (100 row limit) |
| `write` | Execute INSERT/UPDATE/DELETE |
| `create_index` | Create B-tree/GIN/partial index |

---

## PostgreSQL → Qdrant Synchronization

When records are created in PostgreSQL, they are synchronized to Qdrant for vector similarity search:

### Qdrant Collections

| PostgreSQL Table | Qdrant Collection | Purpose |
|-----------------|-------------------|---------|
| `clients` | `agency_clients` | Client similarity search |
| `campaigns` | `agency_campaigns` | Campaign similarity search |
| `tasks` | `agency_tasks` | Task search |

### Sync Trigger
- **Client created** → upsert to `agency_clients` with client_id as payload
- **Campaign created** → upsert to `agency_campaigns` with campaign_id as payload
- **Task created** → upsert to `agency_tasks` with task_id as payload

---

## Backup Strategy

| Aspect | Details |
|--------|---------|
| Daily Dump | `pg_dump` at 3:00 AM |
| PITR | WAL archiving enabled |
| Retention | 7 daily, 4 weekly, 12 monthly |
| Destination | `/srv/backups/postgres/` |
| RTO | < 1 hour |
| RPO | < 24 hours (daily) |

### Backup Script Location
`/srv/monorepo/scripts/backup.sh`

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MCP_POSTGRES_HOST` | localhost | PostgreSQL host |
| `MCP_POSTGRES_PORT` | 5432 | PostgreSQL port |
| `MCP_POSTGRES_USER` | postgres | Database user |
| `MCP_POSTGRES_PASSWORD` | — | Database password |
| `MCP_POSTGRES_DB` | postgres | Database name |
| `MCP_POSTGRES_DEFAULT_SCHEMA` | public | Default schema |

---

## Usage Example

```typescript
// Via MCP protocol
const result = await mcpPostgres.create_schema({ app: "hermes", lead: "will" });
// Creates schema "hermes_will"

const tables = await mcpPostgres.list_tables({ app: "hermes", lead: "will" });
// Returns all tables in hermes_will schema
```

---

## Migration Script

See `/srv/monorepo/scripts/migrate-hermes-schema.ts` for automated schema setup.

```bash
# Create hermes schema with sample data
npx tsx scripts/migrate-hermes-schema.ts --schema hermes_will --seed

# Create without seeding
npx tsx scripts/migrate-hermes-schema.ts --schema hermes
```
