# SPEC: Nexus ↔ Hermes Second Brain Integration

## 1. Overview

The Nexus framework integrates with Hermes (Mem0/Qdrant-backed second brain) to enable auto-consult and auto-writeback of session context across all PREVC phases.

- **Auto-consult**: Nexus workers fetch relevant context from Hermes before executing tasks
- **Auto-writeback**: Nexus workers persist results, decisions, and session artifacts to Hermes after task completion

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Nexus Workers                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Planner    │  │   Agent     │  │  Reviewer   │  ...         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘              │
└─────────┼────────────────┼────────────────┼──────────────────────┘
          │                │                │
          ▼                ▼                ▼
   context_fetch   context_pack     context_pack
          │                │                │
          ▼                ▼                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Hermes Client Layer                          │
│                  libs/hermes_client.py                          │
└─────────────────────────────────────────────────────────────────┘
          │                │                │
          ▼                ▼                ▼
   ┌───────────┐    ┌───────────┐    ┌───────────┐
   │ Mem0 API  │    │ Mem0 API  │    │ Mem0 API  │
   └─────┬─────┘    └─────┬─────┘    └─────┬─────┘
         │                │                │
         ▼                ▼                ▼
   ┌─────────────────────────────────────────┐
   │              Qdrant Vector DB          │
   │  ┌──────────────┐ ┌──────────────┐     │
   │  │claude-code-  │ │ second-brain  │     │
   │  │   memory     │ │              │     │
   │  └──────────────┘ └──────────────┘     │
   └─────────────────────────────────────────┘
```

## 3. PREVC ↔ Memory Phase Mapping

| Phase | Operation | Collection | Access |
|-------|-----------|------------|--------|
| **P** (Plan) | `context_fetch` from `claude-code-memory` | `claude-code-memory` | Read |
| **R** (Review) | `context_pack` risk assessments to `second-brain` | `second-brain` | Write |
| **E** (Execute) | `context_pack` task results to `claude-code-memory` | `claude-code-memory` | Write |
| **V** (Verify) | `result_summary` retrieval from `claude-code-memory` | `claude-code-memory` | Read |
| **C** (Complete) | `memory_writeback` full session to `second-brain` | `second-brain` | Write |
| **Ship** | `context_sync` via MCP dotcontext | `will` | Full |

## 4. Collections

| Collection | Purpose | Retention |
|------------|---------|-----------|
| `claude-code-memory` | Session context, task results, verified outputs | Ephemeral per session |
| `second-brain` | Risk assessments, architectural decisions, session summaries | Persistent |
| `will` | Personal knowledge graph, cross-session learnings | Permanent |

## 5. Security Model

| Phase | P | R | E | V | C | Ship |
|-------|---|---|---|---|---|------|
| Read `claude-code-memory` | Yes | No | No | Yes | No | Yes |
| Write `claude-code-memory` | No | No | Yes | No | No | Yes |
| Read `second-brain` | No | Yes | No | No | No | Yes |
| Write `second-brain` | No | Yes | No | No | Yes | Yes |
| Read `will` | No | No | No | No | No | Yes |
| Write `will` | No | No | No | No | No | Yes |

**Principle**: Read-only during planning and verification; write during execution and completion.

## 6. Health Check

Before each Hermes operation:

```python
health = hermes_client.health_check()
if not health.available:
    logger.warning(f"Hermes unavailable: {health.reason}. Continuing without memory.")
    return None  # or appropriate fallback
```

If health check fails, the operation proceeds without memory access (see Fallback).

## 7. Fallback Behavior

If Hermes is unavailable at any point:

- **P phase**: Continue without fetched context (empty context)
- **R/E phases**: Skip writeback, log warning
- **V phase**: Return empty results
- **C/Ship phases**: Skip writeback, preserve in-memory session state

The system MUST NOT fail or block due to Hermes unavailability.

## 8. Implementation

All Hermes operations are centralized in:

```
libs/hermes_client.py
```

Exposed methods:
- `health_check() -> HealthStatus`
- `context_fetch(query: str, collection: str, limit: int) -> list[MemoryEntry]`
- `context_pack(data: dict, collection: str, metadata: dict) -> str  # returns entry_id`
- `result_summary(task_id: str, collection: str) -> str`
- `memory_writeback(session_id: str, collection: str, phase: PREVCPhase) -> str`
- `context_sync(target_collection: str) -> SyncResult`

Nexus workers import and call these methods; they do not interact with Mem0/Qdrant directly.
