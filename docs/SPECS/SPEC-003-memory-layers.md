# SPEC-003: Memory Architecture

**Status:** DRAFT
**Created:** 2026-04-10
**Author:** will
**Related:** SPEC-001, SPEC-002

---

## Objective

Implementar memória compartilhada de 3 camadas: Redis (hot), Qdrant (vector), SQLite (cold).

---

## Tech Stack

| Layer | Engine | Purpose | Latency |
|-------|--------|---------|---------|
| Hot | Redis 7 | State, queues, cache | <1ms |
| Vector | Qdrant 1.13 | Semantic search | 10-50ms |
| Cold | SQLite WAL | Persistence, analytics | 1-5ms |

---

## Memory Layers

```
┌───────────────────────────────────────┐
│         CAMADA 1: Redis (Hot)        │
│  KV Store · Streams · Pub/Sub         │
│  graph state, user state, task board  │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│       CAMADA 2: Qdrant (Vector)   │
│  Collection: hvacr_knowledge       │
│  Dense 768D + Sparse BM25          │
└────────────────┬────────────────────┘
                 │
┌────────────────▼────────────────────┐
│        CAMADA 3: SQLite (Cold)     │
│  Tables: users, billing_events,     │
│  audit_log, conversations          │
└────────────────────────────────────┘
```

---

## Redis Key Schema (User State)

```
user:{phone}:status                 → STRING "free_limit|trial_on|trial_off"
user:{phone}:requests_remaining     → STRING "7"
user:{phone}:plan                   → STRING "free|trial|pro|enterprise"
user:{phone}:total_requests         → STRING "42"
user:{phone}:conversation           → LIST (max 20 msgs)
user:{phone}:facts                  → SET
user:{phone}:stripe_customer_id     → STRING "cus_xxx"
```

---

## Graph State Schema

```
state:{graph_id}:input              → HASH {phone, text, media_type}
state:{graph_id}:intent             → STRING
state:{graph_id}:entities           → HASH {brand, model, btu, error_code}
state:{graph_id}:access_decision    → STRING "allow|block"
state:{graph_id}:rag_candidates     → LIST [JSON]
state:{graph_id}:ranked_results     → LIST [JSON]
state:{graph_id}:assembled_context  → STRING
state:{graph_id}:response_sent      → HASH {text, message_id}
```

---

## Qdrant Collection Schema

```json
{
  "collection": "hvacr_knowledge",
  "vectors": {
    "dense": {"size": 768, "distance": "Cosine"},
    "sparse": {"modifier": "IDF"}
  },
  "payload": ["brand", "model", "btu", "error_code", "part", "refrigerant"]
}
```

---

## SQLite Tables

```sql
CREATE TABLE users (phone, status, plan, created_at, total_requests);
CREATE TABLE billing_events (event_id, phone, type, amount_brl, stripe_id, timestamp);
CREATE TABLE audit_log (graph_id, agent, action, duration_ms, timestamp);
CREATE TABLE conversations (phone, role, content, timestamp);
```

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | User state persists in Redis | SET/GET user:{phone}:status |
| AC-2 | Graph state writes work | HSET state:{id}:input |
| AC-3 | Qdrant hybrid search returns results | curl /collections/hvacr_knowledge/points/search |
| AC-4 | SQLite sync runs every 60s | memory_agent.SyncToSQLite() |
