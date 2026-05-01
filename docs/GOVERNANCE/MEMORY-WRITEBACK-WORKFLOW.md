# Memory Writeback Workflow

## Purpose

Final session summary write-back to Hermes — captures the complete state of a Nexus session for downstream agents and future reference.

## When

Nexus C (Complete) phase, before Ship. Executed after all tasks are resolved and before final git operations.

## Data to Write

| Field | Source | Description |
|-------|--------|-------------|
| `spec_title` | SPEC.md | Full spec title |
| `spec_number` | SPEC.md | Spec identifier (e.g., SPEC-204) |
| `tasks` | Session log | All tasks with status: done / failed / skipped |
| `files_changed` | `git diff --stat` | Summary of modified, added, deleted files |
| `deployment_status` | Deploy hook | Success / failure / skipped |
| `decisions` | Session log | Key decisions made during execution |
| `handoffs` | Agent log | Agent-to-agent handoff records |

## Collections

- `claude-code-memory` — Primary collection for session records
- `second-brain` — Cross-reference collection for knowledge reuse

## Tagging

Tags applied to each writeback record:

- `spec-{number}` — Links to originating spec (e.g., `spec-204`)
- `session-{date}` — ISO date of session (e.g., `session-2026-04-28`)
- `complete` — Marks the session as finished

## Python Example (Mem0 Client)

```python
from mem0 import Mem0

client = Mem0()

def writeback_session(spec_title: str, spec_number: str, tasks: list[dict], files_changed: str, deployment_status: str, decisions: list[str], handoffs: list[dict]) -> str:
    """Write session summary to Hermes memory."""

    user_id = "nexus-agent"

    messages = [
        {
            "role": "user",
            "content": (
                f"Session Writeback for {spec_title} ({spec_number})\n\n"
                f"Tasks:\n" + "\n".join(f"- [{t['status']}] {t['description']}" for t in tasks) + "\n\n"
                f"Files Changed:\n{files_changed}\n\n"
                f"Deployment: {deployment_status}\n\n"
                f"Decisions:\n" + "\n".join(f"- {d}" for d in decisions) + "\n\n"
                f"Handoffs:\n" + "\n".join(f"- {h['from']} -> {h['to']}: {h['reason']}" for h in handoffs)
            )
        }
    ]

    metadata = {
        "spec": spec_number,
        "tags": [f"spec-{spec_number.lower()}", f"session-{__import__('datetime').date.today().isoformat()}", "complete"],
        "collections": ["claude-code-memory", "second-brain"]
    }

    result = client.add(messages, user_id=user_id, metadata=metadata)
    return result["id"]
```

## Workflow Sequence

```
Nexus C (Complete)
  └── Execute memory_writeback
        ├── Collect session data
        ├── Format messages + metadata
        ├── Write to Mem0 (claude-code-memory + second-brain)
        └── Return memory record ID
  └── Proceed to Ship
```
