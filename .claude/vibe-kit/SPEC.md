# Vibe-Kit SPEC — Lead + Workers Model (v2)

## Overview

vibe-kit runs a **lead agent** that parses SPECs into micro-tasks and up to **5 worker agents** that execute them in parallel. Built for MiniMax 500 rpm rate limit. Loop-while-sleeping-ready.

## Architecture

```
run-vibe.sh (entry point)
  ├── lead_think()  — Parse SPEC, write queue.json
  ├── do_loop()     — Spawn up to 5 mclaude workers via queue-manager.py
  └── do_verify()   — Run pnpm test/tsc/lint

queue-manager.py — atomic claim/complete with fcntl.flock
state-manager.py — event system (existing, keep as-is)
pipeline.json — config for lead/workers/phases
```

## 3 Phases

| Phase | What happens |
|-------|-------------|
| **Plan** | Lead reads SPEC.md, extracts tasks, writes queue.json |
| **Do** | Up to 5 workers claim and execute micro-tasks |
| **Verify** | Run `pnpm test && pnpm tsc --noEmit && pnpm lint` |

## Rate Limit Compliance

- **5 workers** max (not 15, not 49)
- Each mclaude call ~2000 tokens prompt → ~300 tokens completion
- At 500 rpm: 5 workers × 1 call/min each = 5 rpm sustained << 500 rpm
- Idle loop sleeps 5s between spawn cycles

## Queue Schema

```json
{
  "spec": "SPEC-068",
  "app": "crm-ownership",
  "total": 24,
  "pending": 20,
  "running": 2,
  "done": 2,
  "failed": 0,
  "frozen": 0,
  "phase": "do",
  "parallel_limit": 5,
  "tasks": [
    {
      "id": "T001",
      "name": "fix-conversation-manager-trust-ip",
      "description": "Remove FIXME attack IP as trusted in conversation_manager.py",
      "app": "crm-ownership",
      "spec": "SPEC-068",
      "status": "done",
      "attempts": 1,
      "worker": "W1234",
      "created_at": "2026-04-23T12:00:00Z",
      "completed_at": "2026-04-23T12:03:45Z",
      "error": null
    }
  ]
}
```

## Queue Manager Commands

| Command | Description |
|---------|-------------|
| `queue-manager.py claim <worker_id>` | Atomically claim first pending task |
| `queue-manager.py complete <task_id> <worker_id> <result>` | Mark task done/failed |
| `queue-manager.py retry <task_id> <worker_id>` | Reset failed task to pending |
| `queue-manager.py freeze <task_id>` | Prevent task from being claimed |
| `queue-manager.py set-limit <N>` | Set parallel_limit in queue header |
| `queue-manager.py stats` | Return queue statistics |

## Worker Behavior

- Each worker: claim task → run mclaude → mark done/failed → repeat
- Max task time: 300 seconds (5 min)
- On failure: retry once, then mark failed
- Context snippet saved to `$WORKDIR/context/{task_id}.ctx` for debugging
- Workers tracked via `.running_tasks.json` (no zombie PIDs)

## ZFS Snapshots

- Every 3 tasks completed
- Before and after run
- Label format: `vibe-pre-YYYYMMDD-HHMMSS`

## Loop Behavior

```bash
# Run for 8 hours
VIBE_HOURS=8 VIBE_PARALLEL=5 run-vibe.sh SPEC-068 crm-ownership

# Run specific phase
VIBE_PHASE=do run-vibe.sh SPEC-068 crm-ownership

# Resume (queue persists)
run-vibe.sh SPEC-068 crm-ownership --resume
```

After idle timeout (180s with empty queue), runner exits. Can be restarted — queue.json persists full state.

## Files

| File | Purpose |
|------|---------|
| `run-vibe.sh` | Main entry point (replaces nexus.sh + old vibe-kit.sh) |
| `queue-manager.py` | Atomic queue ops with retry/freeze/set-limit |
| `pipeline.json` | Config for lead/workers/phases |
| `state-manager.py` | Event system (in .claude-events/, keep as-is) |
| `queue.json` | Task queue (created at runtime) |
| `state.json` | Runner state (created at runtime) |
| `.running_tasks.json` | Per-cycle worker PID tracking |
| `context/` | Per-task context snippets |

## Deleted

- 9 agent directories (backend/, debug/, deploy/, docs/, frontend/, infra/, monitor/, review/, test/)
- nexus.sh (PREVC orchestrator, 824 lines)
- Old buggy vibe-kit.sh (two copies — scripts/vibe/ and .claude/vibe-kit/)
- stress-test-queue.sh, run-test-worker.sh, cleanup-vibe.sh
- RETENTION_POLICY.md, archive/, agents/_legacy/, agents/archive/
- Stale queue JSONs (queue-spec-009.json, queue-auto-deploy.json, etc.)

## Bugs Fixed vs Old vibe-kit.sh

1. **waitpid bug** — old used `wait $pid` inside subshell with implicit exit code loss
2. **SIGCHLD** — old had no handler, zombies accumulated
3. **wait -n incompatibility** — old used bash 4.x `wait -n` that fails silently on some shells
4. **Worker PID tracking** — old used `.worker-pids` file that never got cleaned; new uses `.running_tasks.json`
5. **pgrep count_workers** — old used `pgrep -f "mclaude.*brain-refactor"` which is too broad; new counts from `.running_tasks.json`
