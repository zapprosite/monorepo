#!/usr/bin/env bash
# auto_throttle.sh — Auto-throttle orchestrator parallelism when resources are constrained
# Part of: SPEC-071-V5 (CAPACITY PLANNER)
# Usage: bash auto_throttle.sh [--check-only]
# Returns: exit 0 = proceed, exit 1 = throttle recommended
# Outputs: Recommended MAX_PARALLEL based on current resource usage

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")")"

CHECK_ONLY=""
if [[ "${1:-}" == "--check-only" ]]; then
  CHECK_ONLY="yes"
fi

CPU_THRESHOLD=${CPU_THRESHOLD:-80}
RAM_FREE_THRESHOLD=${RAM_FREE_THRESHOLD:-20}
THROTTLED_MAX=${THROTTLED_MAX:-2}

# ── Gather current state ──────────────────────────────────────────────────────
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d. -f1)
if [[ -z "$CPU_USAGE" ]] || ! [[ "$CPU_USAGE" =~ ^[0-9]+$ ]]; then
  CPU_USAGE=0
fi

RAM_TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
RAM_AVAILABLE_KB=$(grep MemAvailable /proc/meminfo | awk '{print $2}')
RAM_FREE_PCT=$(echo "scale=1; ($RAM_AVAILABLE_KB * 100 / $RAM_TOTAL_KB)" | bc)
RAM_FREE_INT=$(echo "$RAM_FREE_PCT" | cut -d. -f1)

CPU_CORES=$(nproc)
LOAD_1=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
LOAD_INT=$(echo "$LOAD_1" | cut -d. -f1)

# ── Determine throttle level ─────────────────────────────────────────────────
THROTTLE_REASON=""
THROTTLE_LEVEL=0
RECOMMENDED_MAX=0

# Get base capacity from capacity_calculator
if [[ -x "$SCRIPT_DIR/capacity_calculator.sh" ]]; then
  BASE_MAX=$(bash "$SCRIPT_DIR/capacity_calculator.sh" --json 2>/dev/null | python3 -c "import json,sys; print(json.load(sys.stdin)['max_parallel_recommended'])" 2>/dev/null || echo "$((CPU_CORES > 2 ? CPU_CORES - 1 : 1))")
else
  BASE_MAX=$((CPU_CORES > 2 ? CPU_CORES - 1 : 1))
fi

# Check CPU
if [[ "$CPU_USAGE" =~ ^[0-9]+$ ]] && [[ "$CPU_USAGE" -gt $CPU_THRESHOLD ]]; then
  THROTTLE_LEVEL=1
  THROTTLE_REASON="CPU ${CPU_USAGE}% > ${CPU_THRESHOLD}%"
  RECOMMENDED_MAX=$THROTTLED_MAX
fi

# Check RAM
if [[ "$RAM_FREE_INT" -lt $RAM_FREE_THRESHOLD ]]; then
  THROTTLE_LEVEL=$((THROTTLE_LEVEL + 1))
  THROTTLE_REASON="${THROTTLE_REASON}; RAM ${RAM_FREE_PCT}% free < ${RAM_FREE_THRESHOLD}%"
  # RAM is tighter constraint
  if [[ "$THROTTLE_LEVEL" -ge 2 ]]; then
    RECOMMENDED_MAX=1
  fi
fi

# Check load
if [[ "$LOAD_INT" -gt "$CPU_CORES" ]]; then
  THROTTLE_LEVEL=$((THROTTLE_LEVEL + 1))
  THROTTLE_REASON="${THROTTLE_REASON}; Load $LOAD_1 > $CPU_CORES cores"
fi

# ── Result ────────────────────────────────────────────────────────────────────
if [[ $THROTTLE_LEVEL -gt 0 ]]; then
  echo "[auto_throttle] THROTTLE: level=$THROTTLE_LEVEL reason=$THROTTLE_REASON"
  echo "[auto_throttle] Recommended MAX_PARALLEL: $RECOMMENDED_MAX (was $BASE_MAX)"

  if [[ -n "$CHECK_ONLY" ]]; then
    echo "[auto_throttle] check-only mode, no action taken"
    exit 1
  fi

  # Export for orchestrator
  export MAX_PARALLEL=$RECOMMENDED_MAX
  export THROTTLED="yes"
  export THROTTLE_REASON

  echo "[auto_throttle] Set MAX_PARALLEL=$MAX_PARALLEL"
  echo "[auto_throttle] Export THROTTLED=1"
  exit 0

else
  echo "[auto_throttle] OK: resources within limits"
  echo "[auto_throttle] CPU: ${CPU_USAGE}% (threshold: ${CPU_THRESHOLD}%)"
  echo "[auto_throttle] RAM: ${RAM_FREE_PCT}% free (threshold: ${RAM_FREE_THRESHOLD}%)"
  echo "[auto_throttle] Load: $LOAD_1 (cores: $CPU_CORES)"
  echo "[auto_throttle] Recommended MAX_PARALLEL: $BASE_MAX"
  export MAX_PARALLEL=$BASE_MAX
  export THROTTLED="no"
  exit 0
fi
