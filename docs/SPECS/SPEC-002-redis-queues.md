# SPEC-002: Redis Task Board

**Status:** DRAFT
**Created:** 2026-04-10
**Author:** will
**Related:** SPEC-001, SPEC-003

---

## Objective

Implementar o task board em Redis 7 com work-stealing, filas por agente, dead-letter queue e heartbeat tracking.

---

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Queue Engine | Redis 7 LIST | LPUSH/BRPOP |
| Atomic Ops | Lua Scripts | claim_task.lua |
| Coordination | Pub/Sub | swarm:events:* |
| Heartbeat | STRING + SETEX | 15s TTL |

---

## Redis Key Schema

```
# Task Board
swarm:queue:{agent_type}           → LIST (tasks pending)
swarm:queue:{agent_type}:processing → HASH {task_id → task_json}
swarm:queue:{agent_type}:dead       → LIST (dead-letter)

# Agent Registry
swarm:agents:registry              → HASH {worker_id → info_json}
swarm:agents:heartbeat:{worker_id}  → STRING (SETEX 15s)
swarm:agents:stats:{worker_id}     → HASH {completed, stolen, avg_ms}

# Cache
cache:query:{sha256}               → STRING (TTL 1h)
cache:embedding:{sha256}          → STRING (TTL 24h)

# Pub/Sub Channels
swarm:events:task_completed
swarm:events:agent_status
swarm:events:graph_done
swarm:events:rebalance
```

---

## Task Schema

```json
{
  "task_id": "t_ulid",
  "graph_id": "g_ulid",
  "node_id": "n_intake_01",
  "type": "intake",
  "status": "pending",
  "priority": 100,
  "worker_id": null,
  "input": {},
  "output": null,
  "retries": 0,
  "max_retries": 3,
  "timeout_ms": 10000,
  "stolen_from": null
}
```

---

## Work-Stealing Algorithm

```go
// 1. Tenta própria fila (BRPOP 100ms)
// 2. Se vazia → steal de outras filas (LMOVE atômico)
// Condição: target_queue_len > 1
```

---

## Lua Script: Atomic Claim

```lua
-- KEYS[1] = swarm:queue:{agent_type}
-- KEYS[2] = swarm:queue:{agent_type}:processing
-- ARGV[1] = worker_id
-- ARGV[2] = timestamp

local task_json = redis.call('RPOP', KEYS[1])
if task_json then
    local task = cjson.decode(task_json)
    task['status'] = 'running'
    task['worker_id'] = ARGV[1]
    task['claimed_at'] = ARGV[2]
    redis.call('HSET', KEYS[2], task['task_id'], cjson.encode(task))
    return cjson.encode(task)
end
return nil
```

---

## Agent Priority Table

| Agent | Workers | Priority | Can Steal From |
|-------|---------|----------|----------------|
| intake | 2 | critical (90) | classifier |
| classifier | 2 | critical (90) | intake, rag |
| access_control | 1 | critical (90) | — |
| rag | 3 | high (70) | ranking |
| ranking | 2 | high (70) | rag, response |
| response | 2 | critical (90) | ranking |
| billing | 1 | low (30) | memory |
| memory | 1 | low (30) | billing |

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | BRPOP claim works | `redis-cli BRPOP swarm:queue:intake 1` |
| AC-2 | LMOVE steal works | `redis-cli LMOVE src dest RIGHT LEFT` |
| AC-3 | Lua script atomic | Concurrent claims don't duplicate |
| AC-4 | Heartbeat expires | Worker dies → 15s → removed |
