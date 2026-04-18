#!/usr/bin/env bash
# reentrancy_lock.sh — PID lock per pipeline/agent to prevent concurrent runs
# Part of: SPEC-071-V2 (ORCHESTRATOR v2)
# Usage: bash reentrancy_lock.sh <agent_id> [pipeline_id]
# Exit 0: lock acquired
# Exit 1: lock held by another process (already running)

set -euo pipefail

AGENT_ID="${1:-}"
PIPELINE_ID="${2:-default}"

if [[ -z "$AGENT_ID" ]]; then
  echo "Usage: reentrancy_lock.sh <agent_id> [pipeline_id]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
LOCKS_DIR="$ROOT_DIR/skills/orchestrator/locks"
mkdir -p "$LOCKS_DIR"

LOCK_FILE="$LOCKS_DIR/${PIPELINE_ID}-${AGENT_ID}.lock"
MY_PID=$$
CURRENT_TIME=$(date +%s)

# ── Acquire lock ────────────────────────────────────────────────────────────────

acquire_lock() {
  local timeout=60  # seconds to wait for lock
  local waited=0

  while true; do
    # Try to create lock file atomically (using ln for atomic mkdir-like check)
    if ( set -o noclobber; echo "$MY_PID:$CURRENT_TIME" > "$LOCK_FILE" ) 2>/dev/null; then
      echo "[reentrancy_lock] $AGENT_ID: acquired lock $LOCK_FILE (PID=$MY_PID)"
      return 0
    fi

    # Lock exists — check if process is still alive
    local lock_pid lock_time
    lock_pid=$(cut -d: -f1 "$LOCK_FILE" 2>/dev/null || echo "")
    lock_time=$(cut -d: -f2 "$LOCK_FILE" 2>/dev/null || echo "")

    if [[ -n "$lock_pid" ]] && [[ -d "/proc/$lock_pid" ]]; then
      # Process still running — wait
      if (( waited >= timeout )); then
        echo "[reentrancy_lock] $AGENT_ID: timeout waiting for lock (held by PID=$lock_pid)" >&2
        return 1
      fi
      sleep 1
      (( waited++ ))
    else
      # Stale lock — remove and retry
      echo "[reentrancy_lock] $AGENT_ID: removing stale lock (PID=$lock_pid dead)"
      rm -f "$LOCK_FILE"
    fi
  done
}

# ── Release lock ────────────────────────────────────────────────────────────────

release_lock() {
  if [[ -f "$LOCK_FILE" ]]; then
    local lock_pid
    lock_pid=$(cut -d: -f1 "$LOCK_FILE" 2>/dev/null || echo "")
    if [[ "$lock_pid" == "$MY_PID" ]]; then
      rm -f "$LOCK_FILE"
      echo "[reentrancy_lock] $AGENT_ID: released lock $LOCK_FILE"
    fi
  fi
}

# ── Check if locked (no wait) ────────────────────────────────────────────────────

check_lock() {
  if [[ -f "$LOCK_FILE" ]]; then
    local lock_pid
    lock_pid=$(cut -d: -f1 "$LOCK_FILE" 2>/dev/null || echo "")
    if [[ -n "$lock_pid" ]] && [[ -d "/proc/$lock_pid" ]]; then
      return 0  # locked
    fi
  fi
  return 1  # not locked
}

# ── Main ────────────────────────────────────────────────────────────────────────

LOCK_ACQUIRED=""
if ! acquire_lock; then
  echo "[reentrancy_lock] $AGENT_ID: FAILED to acquire lock (already running)" >&2
  exit 1
fi
LOCK_ACQUIRED="yes"

# Cleanup on exit
trap 'release_lock' EXIT

exit 0
