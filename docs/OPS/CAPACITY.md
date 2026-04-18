# CAPACITY — Orchestrator Capacity Planning

> **Component:** SPEC-071-V5 (CAPACITY PLANNER)
> **Scripts:** `orchestrator/scripts/capacity_calculator.sh`, `orchestrator/scripts/auto_throttle.sh`

## Overview

The capacity planner ensures the 14-agent orchestrator never overwhelms the host system by calculating available RAM and CPU before and during pipeline execution.

## Scripts

### capacity_calculator.sh

Calculates available resources for orchestrator agents.

```bash
# Human-readable output
bash .claude/skills/orchestrator/scripts/capacity_calculator.sh

# JSON output (for automation)
bash .claude/skills/orchestrator/scripts/capacity_calculator.sh --json
```

**Output includes:**
- Total/Available RAM (GB and %)
- CPU cores, model, usage (instant %)
- Load average (1m, 5m, 15m)
- Max agents (RAM-bounded): `available_RAM_KB / 4GB`
- Max parallel (CPU-bounded): `CPU_cores - 1` (headroom)
- Recommended max parallel (conservative of both)
- Warnings if resources constrained

**JSON output fields:**
```json
{
  "ram_total_gb": 31.0,
  "ram_available_gb": 10.2,
  "ram_free_pct": 32.9,
  "ram_per_agent_gb": 4,
  "max_agents_ram_bound": 2,
  "cpu_cores": 12,
  "cpu_usage_pct": 45,
  "load_1m": 2.3,
  "max_parallel_recommended": 2,
  "orchestrator_agents_running": 0,
  "warnings": [],
  "timestamp": "2026-04-18T..."
}
```

### auto_throttle.sh

Automatically throttles parallelism when resources are constrained.

```bash
# Check and apply throttle if needed
bash .claude/skills/orchestrator/scripts/auto_throttle.sh

# Check only (no changes)
bash .claude/skills/orchestrator/scripts/auto_throttle.sh --check-only
```

**Throttle triggers:**
| Condition | Threshold | Action |
|-----------|-----------|--------|
| CPU usage | >80% | Set `MAX_PARALLEL=2` |
| RAM free | <20% | Set `MAX_PARALLEL=2` |
| Load avg | >CPU cores | Increment throttle level |
| RAM free | <10% | Emergency: `MAX_PARALLEL=1` |

**Environment variables set when throttled:**
- `MAX_PARALLEL` — max agents to run in parallel
- `THROTTLED` — `yes` or `no`
- `THROTTLE_REASON` — comma-separated reasons

## Integration

### In run-agents.sh

```bash
# Before spawning agents, check capacity
source <(bash .claude/skills/orchestrator/scripts/auto_throttle.sh --export 2>/dev/null || echo "MAX_PARALLEL=14; THROTTLED=no")

if [[ "$THROTTLED" == "yes" ]]; then
  echo "WARNING: Resources constrained. MAX_PARALLEL=$MAX_PARALLEL (was 14)"
fi
```

### In agent-wrapper.sh

```bash
# Before starting, check capacity
bash "$SCRIPT_DIR/auto_throttle.sh" --check-only || {
  echo "[$AGENT_ID] WARNING: resources constrained"
}
```

## Thresholds (Configurable)

Via environment variables:

```bash
CPU_THRESHOLD=80         # % CPU that triggers throttle
RAM_FREE_THRESHOLD=20    # % RAM free that triggers throttle
THROTTLED_MAX=2          # Max parallel when throttled
```

## Acceptance Criteria

- [x] `capacity_calculator.sh` shows RAM/CPU available
- [x] Auto-throttle when >80% CPU
- [x] Warning when RAM <20% free
- [x] JSON output for Prometheus/monitoring integration
