# Context Window Strategy — 240k Token Target

## Problem

MiniMax context window: ~240,000 tokens (short for auto-compression strategy).

Strategy needed: task chunking + context window preservation + auto-compression between tasks.

## Constraints

| Constraint | Value |
|------------|-------|
| MiniMax context window | ~240k tokens |
| MiniMax rate limit | 500 rpm |
| Target workers | 5 |
| Task target | ~5 min each, ~2000 tokens prompt |
| Token budget per task | 2000 in / ~300 out |

## Strategy: Task Chunking Rules

### Rule 1: Max Prompt Size = 2000 tokens

Worker prompts must stay under 2000 tokens. If a task description + spec context exceeds 1500 tokens, split the task.

```python
def estimate_tokens(text: str) -> int:
    """Rough estimate: 4 chars per token for English code."""
    return len(text) // 4

def should_split(task_description: str, spec_context: str = "") -> bool:
    prompt_tokens = estimate_tokens(task_description + spec_context)
    return prompt_tokens > 1500  # Split if approaching 2k limit
```

### Rule 2: One File Per Task

Each micro-task should target ONE file modification or ONE CLI operation. If a task requires changing 3+ files, split it.

**Good:** "Fix the null pointer in authservice.py line 42"
**Bad:** "Refactor the entire auth layer to use JWT"

### Rule 3: Context Compression Between Cycles

After each 5-task batch, the lead agent receives a compressed summary:

```
Task T001: done - fixed null pointer in auth.py
Task T002: done - added validation in user.py
Task T003: failed - timeout on external API call
...
Last completed: T003. Next pending: T004, T005
```

### Rule 4: Lead Prompt Template

The lead agent prompt for task planning:

```
You are the lead agent. Parse this SPEC into micro-tasks.

Rules:
- Each task must be doable in < 5 minutes
- Each task prompt must fit in < 2000 tokens
- One file modification per task
- If a spec item requires > 1 file, split into multiple tasks

SPEC: {spec_content}

Output: JSON array of tasks with id, name, description
```

## Task Size Estimation

| Task Type | Tokens (est) | Split needed? |
|-----------|-------------|--------------|
| Single line fix | 200 | No |
| Small function | 400-600 | No |
| Add validation | 500-800 | No |
| Refactor function | 800-1200 | Maybe |
| Multi-file feature | 1500-2000 | Yes |
| Architecture change | 2000+ | Yes, definitely |

## Context Window Budget

```
Total window:        240,000 tokens
─────────────────────────────────────
Worker prompt:        -  2,000 tokens (task description)
Code context:         - 50,000 tokens (relevant files)
─────────────────────────────
Available for output: ~188,000 tokens
```

But we target small outputs (< 500 tokens) so context accumulation is minimal.

## Auto-Compression Between Tasks

The queue.json task `.ctx` files store minimal context:

```json
{
  "task_id": "T001",
  "files_modified": ["auth.py"],
  "changes_summary": "Fixed null pointer on line 42",
  "next_step_needed": null,
  "blocked_by": []
}
```

After 10 completed tasks, generate a compressed digest:

```
=== Task Digest (T001-T010) ===
Fixed: auth.py null pointer, user.py validation, settings.py timezone
Failed: None
Blocked: T011 (waiting for API key)
```

## Queue Task Extraction Patterns

The lead agent extracts tasks using these patterns in order:

1. **Numbered list:** `1. [ ] Task description`
2. **AC format:** `- [ ] AC-123: Task description`
3. **Bug table:** `| B1 | Bug description |`

If none found, ask user to format SPEC with explicit tasks.

## Snapshot Strategy

Every 3 tasks:
```
tank@vibe-pre-{timestamp}
```

This gives us restore points for 5-task batches.

## Rate Limit Budget

```
5 workers × 1 task/min = 5 rpm
At 500 rpm limit: 100x headroom
```

The 500 rpm limit is not a concern with 5 workers. The bottleneck is task complexity, not rate.

## Summary

| Strategy | Implementation |
|----------|---------------|
| Task size | < 2000 tokens prompt, 1 file |
| Context | Fresh per task (no accumulation) |
| Compression | .ctx files + periodic digest |
| Rate limit | 5 rpm << 500 rpm (safe) |
| Snapshot | Every 3 tasks |
| Recovery | queue.json persists state |
