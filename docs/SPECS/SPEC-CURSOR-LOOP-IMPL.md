# SPEC-CURSOR-LOOP-IMPL

**Date:** 2026-04-14
**Author:** will-zappro
**Status:** IMPLEMENTATION
**Type:** Implementation Spec
**Parent:** SPEC-CURSOR-LOOP-EVOLUTION.md

---

## Objetivo

Implementar as quick wins da Fase 1 de SPEC-CURSOR-LOOP-EVOLUTION:
- **M1.1:** Dashboard de execucao em tempo real
- **M3.1:** Ciclo verify-and-heal melhorado

---

## M1.1: Real-time Execution Dashboard

### 1.1 Design

Dashboard terminal com visibilidade em tempo real do cursor-loop.

```
┌─────────────────────────────────────────────────────────────┐
│ 🔄 Cursor-Loop | Phase: DEV | Task: 3/12 | SLO: 🟢 OK    │
├─────────────────────────────────────────────────────────────┤
│ Progress: [██████████████░░░░░░░░░] 58%                     │
│                                                             │
│ Completed (2):                                              │
│   ✓ T-001: SPEC created (1m 23s)                            │
│   ✓ T-002: Plan generated (2m 45s)                          │
│                                                             │
│ Current (1):                                                │
│   → T-003: Docker build (running... 3m 12s)                 │
│                                                             │
│ Pending (9):                                                │
│   ○ T-004: Testing                                          │
│   ○ T-005: Code review                                      │
│   ...                                                       │
├─────────────────────────────────────────────────────────────┤
│ Recent Logs:                                                │
│ [14:32:01] INFO: Docker image built: todo-web:latest        │
│ [14:32:03] INFO: Running smoke tests...                     │
│ [14:32:08] WARN: Test suite slow (expected >30s)            │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 File Structure

```
/srv/monorepo/.claude/scripts/
└── cursor-dashboard.py          # Main dashboard script

/srv/monorepo/.claude/skills/coolify-sre/
└── scripts/
    └── cursor-dashboard.py      # Symlink or copy for SRE context
```

### 1.3 Dependencies

Python package: `rich` (preferred over tqdm for this use case - better table/layout support)

```bash
pip install rich
```

Or add to existing Python environment requirements.

### 1.4 Implementation: cursor-dashboard.py

```python
#!/usr/bin/env python3
"""
Cursor-Loop Real-time Execution Dashboard

Usage:
    cursor-dashboard.py --pipeline <pipeline.json> --logs <logfile>
    cursor-dashboard.py --watch --pipeline <path>
"""

import argparse
import json
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, BarColumn, TextColumn, TimeElapsedColumn
from rich.table import Table
from rich.tree import Tree


# Phase definitions with SLO thresholds (seconds)
PHASES = {
    "init": {"slo_minutes": 2, "color": "cyan"},
    "dev": {"slo_minutes": 30, "color": "green"},
    "review": {"slo_minutes": 10, "color": "yellow"},
    "deploy": {"slo_minutes": 15, "color": "magenta"},
}


def load_pipeline(pipeline_path: str) -> dict:
    """Load pipeline state from JSON file."""
    try:
        with open(pipeline_path, "r") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError) as e:
        return {"error": str(e), "tasks": [], "phase": "unknown"}


def get_slo_status(phase: str, elapsed_seconds: float) -> tuple[str, str]:
    """Calculate SLO status for current phase."""
    if phase not in PHASES:
        return "unknown", "⚪"

    slo_seconds = PHASES[phase]["slo_minutes"] * 60
    percentage = (elapsed_seconds / slo_seconds) * 100

    if percentage < 70:
        return "green", "🟢"
    elif percentage < 90:
        return "yellow", "🟡"
    else:
        return "red", "🔴"


def build_dashboard(state: dict, console: Console) -> Layout:
    """Build the dashboard layout from pipeline state."""

    layout = Layout()

    # Split into header, body, footer
    layout.split_column(
        Layout(name="header", size=3),
        Layout(name="body"),
        Layout(name="footer", size=6),
    )

    # Header with phase and progress
    phase = state.get("phase", "init")
    task_current = state.get("current_task", 0)
    task_total = len(state.get("tasks", []))
    elapsed = state.get("elapsed_seconds", 0)

    slo_status, slo_icon = get_slo_status(phase, elapsed)

    header_text = f"🔄 Cursor-Loop | Phase: [bold {PHASES[phase]['color']}]{phase.upper()}[/] | Task: {task_current}/{task_total} | SLO: {slo_icon} {slo_status.upper()}"
    layout["header"].update(Panel(header_text, style="bold"))

    # Body with task list
    body = Layout()
    body.split_row(
        Layout(name="tasks", ratio=2),
        Layout(name="logs", ratio=1),
    )

    # Task tree
    tree = Tree("📋 Tasks")
    for i, task in enumerate(state.get("tasks", []), 1):
        status = task.get("status", "pending")
        name = task.get("name", f"Task-{i}")
        duration = task.get("duration_seconds", 0)

        if status == "completed":
            icon = "✓"
            style = "green"
        elif status == "running":
            icon = "→"
            style = "cyan"
        elif status == "failed":
            icon = "✗"
            style = "red"
        else:
            icon = "○"
            style = "dim"

        duration_str = f"({duration}s)" if duration else ""
        tree.add(f"[{style}]{icon}[/] {name} {duration_str}")

    layout["body"]["tasks"].update(Panel(tree, title="Task Progress"))

    # Recent logs panel (last 5 lines)
    recent_logs = state.get("recent_logs", [])
    logs_text = "\n".join(recent_logs[-5:]) if recent_logs else "No logs yet..."
    layout["body"]["logs"].update(Panel(logs_text, title="Recent Logs", style="dim"))

    # Footer with summary
    footer_text = f"Started: {state.get('started_at', 'unknown')} | Duration: {elapsed}s | Healed: {state.get('healed_count', 0)} | Failed: {state.get('failed_count', 0)}"
    layout["footer"].update(Panel(footer_text, style="bold cyan"))

    return layout


def read_log_tail(log_path: str, lines: int = 50) -> list[str]:
    """Read last N lines from log file."""
    try:
        with open(log_path, "r") as f:
            all_lines = f.readlines()
            return [l.strip() for l in all_lines[-lines:]]
    except FileNotFoundError:
        return []


def main():
    parser = argparse.ArgumentParser(description="Cursor-Loop Real-time Dashboard")
    parser.add_argument("--pipeline", default="~/.claude/pipeline.json", help="Pipeline state file")
    parser.add_argument("--logs", default="~/.claude/audit/pipeline-runner.log", help="Log file to tail")
    parser.add_argument("--interval", type=float, default=1.0, help="Refresh interval (seconds)")
    parser.add_argument("--once", action="store_true", help="Run once and exit (no live mode)")
    args = parser.parse_args()

    console = Console()

    pipeline_path = Path(args.pipeline).expanduser()
    log_path = Path(args.logs).expanduser()

    if args.once:
        state = load_pipeline(str(pipeline_path))
        state["recent_logs"] = read_log_tail(str(log_path))
        layout = build_dashboard(state, console)
        console.print(layout)
        return

    with Live(console=console, refresh_per_second=1, screen=True) as live:
        while True:
            state = load_pipeline(str(pipeline_path))
            state["recent_logs"] = read_log_tail(str(log_path))
            layout = build_dashboard(state, console)
            live.update(layout)
            time.sleep(args.interval)


if __name__ == "__main__":
    main()
```

### 1.5 Integration with cursor-loop

Add to the cursor-loop skill to spawn dashboard in background:

```bash
# In cursor-loop workflow, after starting pipeline
cursor-dashboard.py --pipeline ~/.claude/pipeline.json --logs ~/.claude/audit/pipeline-runner.log &
DASHBOARD_PID=$!

# ... run pipeline steps ...

# Cleanup on exit
kill $DASHBOARD_PID 2>/dev/null || true
```

---

## M3.1: Verify-and-Heal Cycle

### 3.1 Design

Enhanced `heal_container` function with:
1. Health check after restart (not just state check)
2. 30-second verification window
3. Retry up to 2 times on failure
4. Escalation notification on persistent failure
5. Exponential backoff between retries

### 3.2 Current Implementation Analysis

Current `heal_container` (lines 328-379 in sre-monitor.sh):
- Checks state after restart (good)
- Checks health if available (good)
- BUT: No retry loop, no escalation, no notification on persistent failure

### 3.3 Enhanced heal_container Function

```bash
heal_container() {
  local name="$1"
  local reason="$2"
  local max_attempts=3
  local attempt=1

  if echo "$IMMUTABLE_CONTAINERS" | grep -qw "$name"; then
    log_sre "CRITICAL IMMUTABLE container $name reported $reason — NO ACTION PERMITTED"
    return 0
  fi

  # Restart loop guard
  if ! check_restart_loop "$name"; then
    return 1
  fi

  # Run RCA before healing
  rca_container "$name" "$reason"

  while (( attempt <= max_attempts )); do
    log_sre "INFO HEAL_ATTEMPT $name ($reason) — attempt $attempt/$max_attempts"
    log_heal "HEAL_ATTEMPT $name reason=$reason attempt=$attempt"

    # Execute heal
    if docker restart "$name" 2>/dev/null; then
      log_sre "INFO ⏳ Waiting 15s for container stabilization..."
      sleep 15

      # Verify heal within 30-second window
      local verification_result
      verification_result=$(verify_heal "$name" 30)

      if [[ "$verification_result" == "SUCCESS" ]]; then
        log_sre "INFO ✅ HEAL_SUCCESS $name (attempt $attempt) — container healthy"
        log_heal "HEAL_SUCCESS $name verified=yes attempt=$attempt"
        record_heal "$name" "$reason"
        HEALED_COUNT=$((HEALED_COUNT + 1))
        reset_heal_record "$name"
        return 0
      else
        log_sre "WARN ⚠️ HEAL_FAILED $name (attempt $attempt) — verification returned: $verification_result"
        log_heal "HEAL_FAILED $name verification=$verification_result attempt=$attempt"

        if (( attempt < max_attempts )); then
          local backoff=$((attempt * 10))
          log_sre "INFO ⏳ Exponential backoff: waiting ${backoff}s before retry..."
          sleep "$backoff"
        fi
      fi
    else
      log_sre "ERROR ❌ docker restart failed for $name (attempt $attempt)"
      log_heal "DOCKER_RESTART_FAILED $name attempt=$attempt"
    fi

    attempt=$((attempt + 1))
  done

  # All attempts exhausted — escalate
  log_sre "CRITICAL 🚨 HEAL_EXHAUSTED $name — all $max_attempts attempts failed"
  log_heal "HEAL_EXHAUSTED $name reason=$reason max_attempts=$max_attempts"
  FAILED_COUNT=$((FAILED_COUNT + 1))

  # Send escalation notification
  notify_heal_failure "$name" "$reason"

  return 1
}
```

### 3.4 New Helper Functions

```bash
# verify_heal: Run health check and verify within timeout window
# Returns: SUCCESS | PARTIAL | FAILED
verify_heal() {
  local name="$1"
  local timeout_seconds="${2:-30}"
  local start_time=$(date +%s)
  local check_interval=3

  while (( $(($(date +%s) - start_time)) < timeout_seconds )); do
    local state health
    state=$(docker inspect "$name" --format='{{.State.Status}}' 2>/dev/null || echo "unknown")
    health=$(docker inspect "$name" --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")

    # Check for healthy state
    if [[ "$state" == "running" ]]; then
      if [[ "$health" == "healthy" ]] || [[ "$health" == "none" ]]; then
        return 0  # SUCCESS
      elif [[ "$health" == "unhealthy" ]]; then
        log_sre "WARN verify_heal: $name still unhealthy (health=$health)"
      fi
      # If health is starting or nil, continue checking
    else
      log_sre "WARN verify_heal: $name not running (state=$state)"
    fi

    sleep "$check_interval"
  done

  # Timeout — final check
  state=$(docker inspect "$name" --format='{{.State.Status}}' 2>/dev/null || echo "unknown")
  health=$(docker inspect "$name" --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")

  if [[ "$state" == "running" ]] && [[ "$health" != "unhealthy" ]]; then
    return 0  # SUCCESS (marginal)
  fi

  return 2  # FAILED
}

# notify_heal_failure: Send escalation notification
notify_heal_failure() {
  local name="$1"
  local reason="$2"

  local message="🚨 HEAL FAILURE: $name after 3 attempts

Reason: $reason
Time: $(date '+%Y-%m-%d %H:%M:%S')
Host: $(hostname)
Container: $name

Manual intervention required."

  # Log to alert channel (n8n webhook, Slack, etc.)
  if [[ -n "$ALERT_WEBHOOK_URL" ]]; then
    curl -s -X POST "$ALERT_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"text\": \"$message\"}" 2>/dev/null || true
  fi

  log_sre "CRITICAL Alert sent for $name — manual intervention required"
}
```

### 3.5 Changes to Existing Functions

**Update `check_restart_loop` to track per-attempt, not per-heal:**

Current behavior: Increments heal count, blocks after 3 heals total.
New behavior: Track attempts within a verification window, allow retry after cooldown.

---

## Success Criteria

### M1.1: Dashboard

- [ ] Dashboard displays current phase with color coding
- [ ] Progress bar shows task completion percentage
- [ ] Task list shows status (pending/running/completed/failed)
- [ ] SLO status indicator shows green/yellow/red based on phase duration
- [ ] Recent logs panel shows last 5 log entries
- [ ] Dashboard refreshes every 1 second in live mode
- [ ] `--once` mode works for snapshot view

### M3.1: Verify-and-Heal

- [ ] `heal_container` retries up to 3 times on verification failure
- [ ] Each attempt waits 15s before verification
- [ ] Exponential backoff: 10s, 20s between retry attempts
- [ ] Health check runs within 30-second verification window
- [ ] `HEAL_SUCCESS` logged when container becomes healthy
- [ ] `HEAL_EXHAUSTED` logged and alert sent after all attempts fail
- [ ] Notification includes container name, reason, timestamp, host

---

## Testing Plan

### M1.1 Testing

```bash
# 1. Create mock pipeline.json
cat > /tmp/test-pipeline.json << 'EOF'
{
  "phase": "dev",
  "current_task": 3,
  "tasks": [
    {"name": "SPEC created", "status": "completed", "duration_seconds": 83},
    {"name": "Plan generated", "status": "completed", "duration_seconds": 165},
    {"name": "Docker build", "status": "running", "duration_seconds": 192},
    {"name": "Testing", "status": "pending"},
    {"name": "Code review", "status": "pending"}
  ],
  "elapsed_seconds": 440,
  "started_at": "2026-04-14T14:30:00Z",
  "healed_count": 0,
  "failed_count": 0
}
EOF

# 2. Run dashboard in snapshot mode
python3 .claude/scripts/cursor-dashboard.py --pipeline /tmp/test-pipeline.json --once

# 3. Verify output shows:
#    - Phase: DEV (green)
#    - Progress: 40% (2/5 tasks)
#    - Current task highlighted
#    - SLO status visible
```

### M3.1 Testing

```bash
# 1. Create a test container that fails health check
docker run -d --name test-heal-test \
  --health-cmd="exit 1" \
  --health-interval=5s \
  --health-retries=1 \
  --health-timeout=3s \
  alpine sleep 3600

# 2. Wait for it to become unhealthy
sleep 10

# 3. Run heal on it (with mock alert webhook)
ALERT_WEBHOOK_URL="https://example.com/webhook" \
  bash -c 'source sre-monitor.sh; heal_container test-heal-test "health=unhealthy"'

# 4. Verify:
#    - 3 attempts made (check logs)
#    - Exponential backoff observed
#    - Alert sent to webhook (check webhook endpoint)
#    - HEAL_EXHAUSTED logged

# 5. Cleanup
docker rm -f test-heal-test
```

---

## File Checklist

- [ ] Create `/srv/monorepo/.claude/scripts/cursor-dashboard.py`
- [ ] Update `/srv/monorepo/.claude/skills/coolify-sre/scripts/sre-monitor.sh` with enhanced `heal_container`
- [ ] Add `verify_heal` function to sre-monitor.sh
- [ ] Add `notify_heal_failure` function to sre-monitor.sh
- [ ] Test M1.1 with mock pipeline.json
- [ ] Test M3.1 with test container

---

## Effort Estimate

| Task | Effort |
|------|--------|
| M1.1: Dashboard script | 2-3 hours |
| M1.1: Integration with cursor-loop | 1 hour |
| M3.1: Enhanced heal_container | 2 hours |
| M3.1: Testing with test container | 1 hour |
| **Total** | **6-7 hours** |

---

## References

- Parent: `SPEC-CURSOR-LOOP-EVOLUTION.md`
- Existing: `sre-monitor.sh` (coolify-sre skill)
- Rich library: https://rich.readthedocs.io/
