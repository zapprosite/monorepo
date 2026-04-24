# VIBE-KIT — 15× Micro-Task Parallel mclaude Runner

## Concept

Um runner autónomo que quebra SPECs em micro-tasks (<5min cada), executa 15 em paralelo via `mclaude`, e faz loop contínuo até 8h sem contexto acumulado — contexto morre com cada task, próxima começa limpa.

**Inspiração:** Cursor AI loop (sub-5min tasks, always fresh context) + Perplexity Computer (cloud runner pattern) + Gitea como CI cloud.

## Architecture

```
vibe-kit.sh
  │
  ├── init_queue(spec)   → tasks from SPEC.md (tasks list or ACs)
  ├── 15× worker_loop    → mclaude -p "task prompt" in parallel
  │      ├── Atomic queue claim (jq, no race)
  │      ├── mclaude headless (--provider minimax --model MiniMax-M2.7)
  │      ├── Context snippet saved per task
  │      └── Retry once on failure
  ├── progress monitor   → reports every 60s
  ├── ZFS snapshot      → every 3 tasks
  └── ship_to_gitea     → branch + PR on completion
```

## Design Decisions

### Why mclaude not direct claude?
- mclaude has provider abstraction (MiniMax token plan, no per-call cost)
- `--provider minimax --model MiniMax-M2.7` headless = cheap + fast
- 15 simultaneous mclaude = 15 MiniMax sessions in parallel

### Why no context accumulation?
- Each mclaude call is `-p` (print/non-interactive) → fresh context every time
- State lives in `queue.json` + `state.json` (filesystem)
- Context snippets saved to `$CONTEXT_DIR/{task_id}.ctx` for recovery
- After 8h, all state is on disk — restart = load queue.json

### Why atomic queue with jq?
```bash
# Claim task atomically
task=$(jq '[.tasks[] | select(.status == "pending")][0] // null' queue.json)
jq '.tasks[0].status = "running" | .tasks[0].worker = "W01"' queue.json > tmp && mv tmp queue.json
```
No locks needed — workers are sequential bash processes claiming one task at a time.

### Why ZFS snapshots?
- Before: `tank@vibe-pre-{label}`
- Every 3 tasks + before/after run
- If anything breaks: `sudo zfs rollback -r tank@vibe-pre-{label}`

## Usage

```bash
# From SPEC name
SPEC=SPEC-068 APP=crm-ownership vibe-kit.sh

# From natural language
vibe-kit.sh "build CRM ownership module" --hours 8 --parallel 15

# Resume (queue persists)
vibe-kit.sh --resume

# Dry-run
VIBE_DRY_RUN=1 vibe-kit.sh
```

## Queue Schema

```json
{
  "spec": "SPEC-068",
  "total": 24,
  "pending": 20,
  "running": 3,
  "done": 1,
  "failed": 0,
  "tasks": [
    {
      "id": "T001",
      "name": "fix-conversation-manager-trust-ip",
      "description": "Remove FIXME attack IP as trusted in conversation_manager.py",
      "app": "crm-ownership",
      "spec": "SPEC-068",
      "status": "done",
      "attempts": 1,
      "worker": "W03",
      "created_at": "2026-04-23T12:00:00Z",
      "completed_at": "2026-04-23T12:03:45Z",
      "log": null
    }
  ]
}
```

## State Schema

```json
{
  "phase": "coding",
  "current_task": "T003",
  "status": "running",
  "elapsed_seconds": 234,
  "hours_remaining": 7.9,
  "provider": "minimax",
  "model": "MiniMax-M2.7",
  "saved_at": "2026-04-23T12:03:54Z"
}
```

## Context Window Strategy

| Strategy | Used Here | Why |
|----------|-----------|-----|
| Summarize + continue | ❌ | Loses detail, adds complexity |
| Sliding window | ❌ | Still accumulates, hard to split |
| Separate sessions | ✅ | Each mclaude = fresh context |
| Checkpoint + resume | ✅ | state.json + context snippets |

Each worker task = ~2000 tokens prompt + code changes + output (~500 tokens). Fresh every time.

## Gitea Integration

```bash
# After completion:
git checkout -b vibe-YYYYMMDD-HHMMSS
git add -A
git commit -m "vibe: $SPEC completed\n\n- T001: done\n- T002: done..."
git push -u gitea HEAD
# PR via Gitea API
curl -X POST https://gitea.zappro.site/api/v1/repos/.../pulls \
  -H "Authorization: Bearer $GITEA_TOKEN" \
  -d '{"title":"vibe: SPEC-068 completed","head":"branch","base":"main"}'
```

## Known Limitations

1. **No cross-task context** — each task must be independently executable
2. **SPEC must have explicit tasks** — if no tasks found, falls back to ACs
3. **No human interrupt mid-task** — workers run to completion
4. **mclaude rate limits** — 15 parallel may hit token plan limits (Mitigate: `--parallel 8` if needed)

## Files

- `vibe-kit.sh` — main runner
- `SPEC.md` — this document
