# Context Pack Workflow

This document describes how Nexus agents should pack (write) context to Hermes Second Brain during and after the Execute phase.

## 1. Purpose

- **Context Pack during Execute**: Capture incremental progress, decisions, and artifacts as tasks are completed
- **Write-back after Complete**: Persist final session state, outcomes, and learnings to long-term memory

## 2. Trigger

Context is packed to Hermes Second Brain at these events:

- **Each task completion**: When a task finishes (success, failure, or blocked)
- **Phase Complete**: When a PREVC phase ends (P → R → E → V → C transition)

## 3. Method

Two memory backends are supported:

| Backend | Method | Use Case |
|---------|--------|----------|
| Mem0 | `add()` | General-purpose memory, natural language queries |
| Qdrant | `upsert()` | Vector similarity, high-performance retrieval |

Choose based on your task requirements. Mem0 is preferred for casual conversation-style recall; Qdrant for structured semantic search.

## 4. Collections

| Collection | Scope | Content |
|-----------|-------|---------|
| `claude-code-memory` | Nexus session | Current session context, active tasks, worker state |
| `second-brain` | Long-term | Decisions, architectural choices, rejected approaches, learnings |

## 5. What to Pack

For each task or phase completion, capture:

- **Task ID**: Unique identifier (e.g., `task-001`, `P-003`)
- **Outcome**: `success` | `failure` | `blocked` | `skipped`
- **Artifacts**: Output file paths, generated content, execution results
- **Rejected approaches**: What was tried and abandoned, and why
- **Decisions**: Architectural choices, design decisions, trade-offs made

Example payload:

```json
{
  "task_id": "E-042",
  "outcome": "success",
  "artifacts": ["/srv/monorepo/src/services/api.ts"],
  "rejected_approaches": [
    {"approach": "REST polling", "reason": "Inefficient, replaced with WebSocket streaming"}
  ],
  "decisions": [
    {"choice": "WebSocket over SSE", "rationale": "Lower latency for real-time updates"}
  ],
  "phase": "E",
  "spec": "SPEC-204",
  "worker_id": "backend-specialist",
  "timestamp": "2026-04-28T14:32:00Z"
}
```

## 6. Metadata

Include the following metadata with every memory entry:

| Field | Description |
|-------|-------------|
| `spec` | Specification document reference (e.g., `SPEC-204`) |
| `phase` | PREVC phase at time of capture (`P`, `R`, `E`, `V`, or `C`) |
| `worker_id` | Agent/worker identifier (e.g., `backend-specialist`) |
| `timestamp` | ISO 8601 timestamp of the event |

## 7. Memory Writeback Example (Mem0 Python Client)

```python
from mem0 import MemoryClient

client = MemoryClient()

session_id = "nexus-session-2026-04-28"
user_id = "hermes-second-brain"

memory_entry = {
    "task_id": "E-042",
    "outcome": "success",
    "artifacts": ["/srv/monorepo/src/services/api.ts"],
    "rejected_approaches": [
        {"approach": "REST polling", "reason": "Inefficient, replaced with WebSocket streaming"}
    ],
    "decisions": [
        {"choice": "WebSocket over SSE", "rationale": "Lower latency for real-time updates"}
    ],
    "phase": "E",
    "spec": "SPEC-204",
    "worker_id": "backend-specialist",
    "timestamp": "2026-04-28T14:32:00Z"
}

# Add to claude-code-memory collection (session scope)
client.add(
    messages=[
        {"role": "user", "content": f"Task {memory_entry['task_id']} completed: {memory_entry['outcome']}"}
    ],
    metadata=memory_entry,
    collection="claude-code-memory",
    user_id=user_id
)

# Add significant decisions to second-brain (long-term)
if memory_entry["decisions"]:
    decision_summary = "; ".join(
        f"{d['choice']}: {d['rationale']}" for d in memory_entry["decisions"]
    )
    client.add(
        messages=[
            {"role": "user", "content": f"Decision made: {decision_summary}"}
        ],
        metadata={
            "type": "decision",
            "spec": memory_entry["spec"],
            "phase": memory_entry["phase"],
            "worker_id": memory_entry["worker_id"],
            "timestamp": memory_entry["timestamp"]
        },
        collection="second-brain",
        user_id=user_id
    )
```

## Integration Points

- **Nexus Entry**: `.claude/vibe-kit/nexus.sh` — handles session lifecycle and worker orchestration
- **Hermes Gateway**: Receives memory writes from agents via internal API
- **Second Brain**: Persistent storage for cross-session context retrieval

## See Also

- [SPEC-204](../SPEC-204.md) — Nexus framework specification
- [NEXUS_GUIDE](../NEXUS_GUIDE.md) — Nexus agent documentation
