# CLI Activation — Nexus / vibe-kit

This guide explains how anyone connecting to the monorepo can activate the Nexus orchestrator and vibe-kit parallel worker system.

---

## 1. Prerequisites

Ensure the following are installed and accessible:

| Tool | Required | Notes |
|------|----------|-------|
| `bun` | Yes | Runtime for `mclaude` CLI |
| `mclaude` | Yes | Multi-provider Claude Code runner (`bun link` after install) |
| `python3` | Yes | For `queue-manager.py` and state scripts |
| `jq` | Yes | JSON manipulation in shell scripts |
| `git` | Yes | For commit and branch operations |
| `zfs` | Optional | For automatic ZFS snapshots every N tasks |

Verify prerequisites:

```bash
which bun mclaude python3 jq git
mclaude --version
```

---

## 2. Environment Setup

vibe-kit is controlled entirely via environment variables. Set them before running:

```bash
# Core control vars
export VIBE_PARALLEL=5           # Max parallel mclaude workers (default: 5)
export VIBE_HOURS=8              # Max runtime in hours (default: 8)
export VIBE_PHASE=               # Leave empty to run full pipeline; or: plan | do | verify
export VIBE_PROVIDER=minimax     # API provider (default: minimax)
export VIBE_MODEL=MiniMax-M2.7   # Model name (default: MiniMax-M2.7)
export VIBE_POLL_INTERVAL=5      # Queue poll interval in seconds (default: 5)
export VIBE_SNAPSHOT_EVERY=3     # ZFS snapshot interval (default: 3 tasks)
export VIBE_IDLE_COOLDOWN=180    # Exit after N seconds of empty queue (default: 180)

# Directories (defaults assume standard monorepo layout)
export VIBE_DIR="${VIBE_DIR:-/srv/monorepo/.claude/vibe-kit}"
export MONOREPO_DIR="${MONOREPO_DIR:-/srv/monorepo}"
```

### Provider and Model

vibe-kit spawns each worker as:

```bash
mclaude --provider "$VIBE_PROVIDER" --model "$VIBE_MODEL" -p "..."
```

Supported providers depend on your `mclaude` installation. Common options:
- `minimax` — MiniMax API (default)
- `openrouter` — OpenRouter
- `litellm` — LiteLLM proxy
- `ollama` — Local Ollama

---

## 3. Quick Start — 5 Steps

### Step 1: Navigate to the monorepo

```bash
cd /srv/monorepo
```

### Step 2: Ensure SPEC file exists

SPEC files live in `docs/SPECS/`. vibe-kit parses tasks from numbered lists (`1. [ ] ...`), acceptance criteria (`- [ ] AC-N: ...`), or bug tables (`| B# | ...`).

```bash
ls /srv/monorepo/docs/SPECS/SPEC-*.md
```

### Step 3: Set environment variables

```bash
export VIBE_PARALLEL=5
export VIBE_HOURS=8
export VIBE_PROVIDER=minimax
export VIBE_MODEL=MiniMax-M2.7
```

### Step 4: Run vibe-kit

```bash
# Full pipeline (plan + do + verify)
bash /srv/monorepo/.claude/vibe-kit/run-vibe.sh SPEC-XXX app-name

# Run specific phase only
VIBE_PHASE=plan bash /srv/monorepo/.claude/vibe-kit/run-vibe.sh SPEC-XXX app-name
VIBE_PHASE=do   bash /srv/monorepo/.claude/vibe-kit/run-vibe.sh SPEC-XXX app-name
VIBE_PHASE=verify bash /srv/monorepo/.claude/vibe-kit/run-vibe.sh SPEC-XXX app-name
```

### Step 5: Monitor progress

```bash
# Watch queue in real time
watch -n 2 'jq "{pending, running, done, failed}" /srv/monorepo/.claude/vibe-kit/queue.json'

# Tail worker logs
tail -f /srv/monorepo/.claude/vibe-kit/logs/worker-*.log
```

---

## 4. Configuration — All Variables

### Core Control Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VIBE_PARALLEL` | `5` | Max concurrent mclaude workers |
| `VIBE_HOURS` | `8` | Max runtime before forced exit (hours) |
| `VIBE_PHASE` | (none) | Phase to run: `plan`, `do`, `verify`, or empty for full pipeline |
| `VIBE_PROVIDER` | `minimax` | API provider passed to `mclaude --provider` |
| `VIBE_MODEL` | `MiniMax-M2.7` | Model name passed to `mclaude --model` |
| `VIBE_POLL_INTERVAL` | `5` | Seconds between queue polling cycles |
| `VIBE_SNAPSHOT_EVERY` | `3` | Create ZFS snapshot every N completed tasks |
| `VIBE_IDLE_COOLDOWN` | `180` | Exit after N seconds with empty queue |
| `VIBE_DRY_RUN` | (none) | If set, workers log but do not execute tasks |

### Directory Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VIBE_DIR` | `/srv/monorepo/.claude/vibe-kit` | Working directory for queue, logs, state |
| `MONOREPO_DIR` | `/srv/monorepo` | Monorepo root, workers set this as `cwd` |

### Internal Files (runtime-created)

| File | Purpose |
|------|---------|
| `queue.json` | Task queue with status per task |
| `state.json` | Runner state (phase, counters) |
| `.running_tasks.json` | Per-cycle worker PIDs |
| `logs/worker-*.log` | Per-worker stdout/stderr |
| `context/{task_id}.ctx` | Per-task context snapshot |

---

## 5. Verification

### Queue is healthy

```bash
# Check queue stats
jq '{pending, running, done, failed, frozen, total}' /srv/monorepo/.claude/vibe-kit/queue.json

# All tasks done
jq '.done == .total' /srv/monorepo/.claude/vibe-kit/queue.json
```

### Workers are running

```bash
# Count active mclaude processes
jq 'length' /srv/monorepo/.claude/vibe-kit/.running_tasks.json 2>/dev/null || echo 0
```

### Logs are clean

```bash
# No failures in recent logs
grep -r "result=failed" /srv/monorepo/.claude/vibe-kit/logs/ --since="1 hour" | wc -l
# Expected: 0 (or low single digits on a busy run)
```

### Smoke tests pass

After each task, `smoke-runner.sh` is called with up to 3 retries. Check its output:

```bash
bash /srv/monorepo/scripts/smoke-runner.sh
echo $?  # 0 = pass
```

---

## 6. Troubleshooting

### "SPEC not found"

```bash
# Check SPEC file exists
ls /srv/monorepo/docs/SPECS/SPEC-XXX.md

# If the SPEC lives elsewhere, set the path explicitly in the call:
bash /srv/monorepo/.claude/vibe-kit/run-vibe.sh /full/path/to/SPEC.md app-name
```

### "mclaude: command not found"

```bash
# Install and link mclaude
bun install -g @leogomide/multi-claude
bun link
mclaude --version
```

### Queue stuck at pending=0, running=0 but done < total

```bash
# Check if workers died silently
ls -la /srv/monorepo/.claude/vibe-kit/logs/

# Manually inspect queue state
jq '.tasks[] | select(.status == "pending")' /srv/monorepo/.claude/vibe-kit/queue.json

# Reset pending tasks (manual recovery)
QUEUE_FILE=/srv/monorepo/.claude/vibe-kit/queue.json \
  python3 /srv/monorepo/.claude/vibe-kit/queue-manager.py retry TASK-ID worker-id
```

### ZFS snapshot fails

```bash
# Verify ZFS is available and pool exists
sudo zfs list tank

# Snapshot manually to test
sudo zfs snapshot "tank@test-$(date +%Y%m%d-%H%M%S)"

# Disable snapshots by setting SNAPSHOT_EVERY to a large number
export VIBE_SNAPSHOT_EVERY=999
```

### Rate limit errors (429 / 500 rpm exceeded)

```bash
# Reduce parallelism
export VIBE_PARALLEL=2

# Or increase poll interval between spawn cycles
export VIBE_POLL_INTERVAL=10
```

### Context reset script missing

```bash
# Verify context-reset.sh exists
ls /srv/monorepo/scripts/context-reset.sh

# If missing, the worker will skip it (no fatal error)
# To bypass entirely, set a no-op script:
SCRIPT_CONTEXT_RESET=/bin/true bash /srv/monorepo/.claude/vibe-kit/run-vibe.sh SPEC-XXX app-name
```

### Exit code non-zero but tasks completed

vibe-kit exits non-zero if verify phase fails or too many tasks failed. Check the final notification:

```bash
# Inspect final queue state
jq '{done, failed, total}' /srv/monorepo/.claude/vibe-kit/queue.json

# Run verify phase manually
VIBE_PHASE=verify bash /srv/monorepo/.claude/vibe-kit/run-vibe.sh SPEC-XXX app-name
```

---

## Quick Reference

```bash
# Full pipeline (most common)
SPEC=SPEC-XXX APP=app-name VIBE_PARALLEL=5 VIBE_HOURS=8 \
  bash /srv/monorepo/.claude/vibe-kit/run-vibe.sh SPEC-XXX app-name

# Plan only — parse SPEC into queue.json
VIBE_PHASE=plan bash /srv/monorepo/.claude/vibe-kit/run-vibe.sh SPEC-XXX app-name

# Execute only — run workers (resume from existing queue)
VIBE_PHASE=do bash /srv/monorepo/.claude/vibe-kit/run-vibe.sh SPEC-XXX app-name

# Watch queue live
watch -n 2 'jq "." /srv/monorepo/.claude/vibe-kit/queue.json'

# Check running workers
jq 'length' /srv/monorepo/.claude/vibe-kit/.running_tasks.json 2>/dev/null
```