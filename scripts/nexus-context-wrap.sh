#!/bin/bash
# nexus-context-wrap.sh — Wrapper Nexus com context awareness

set -euo pipefail

MONOREPO="/srv/monorepo"
NEXUS="$MONOREPO/.claude/vibe-kit/nexus.sh"
DECIDE="$MONOREPO/scripts/context-decide.sh"
SNAPSHOT="$MONOREPO/scripts/context-snapshot.sh"
METER="$MONOREPO/scripts/context-meter.sh"

# Config
SPEC_NAME="${SPEC_NAME:-}"
TASK_ID="${TASK_ID:-}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [nexus-wrap] $*"
}

# Verifica contexto antes de executar
pre_execute_check() {
  local decision
  decision=$("$DECIDE" nexus)

  case "$decision" in
    stop)
      log "STOP: Context near limit. Not starting new task."
      log "Run: context-decide.sh info"
      return 1
      ;;
    snapshot)
      log "Snapshot taken before execution"
      ;;
    proceed)
      log "Proceeding - context OK"
      ;;
  esac

  return 0
}

# Snapshot após task
post_task_snapshot() {
  local task_id="$1"
  local status="$2"  # done, failed

  if [ "$status" = "done" ]; then
    log "Task $task_id completed successfully"
  else
    log "Task $task_id failed - snapshot for recovery"
    "$SNAPSHOT" "$task_id" "${SPEC_NAME:-unknown}" "post-failure"
  fi
}

# Status report
status() {
  echo "=== Nexus Context Status ==="
  "$METER"
  echo ""
  echo "Thresholds:"
  "$DECIDE" thresholds
  echo ""
  echo "Recent snapshots:"
  ls -t "$MONOREPO/.claude/vibe-kit/snapshots/" 2>/dev/null | head -5 || echo "None"
}

# Main wrapper
main() {
  local phase="${1:-}"

  case "$phase" in
    pre)
      # Verifica antes de execute
      pre_execute_check
      ;;

    post)
      # Snapshot após task
      local task_id="${2:-unknown}"
      local status="${3:-done}"
      post_task_snapshot "$task_id" "$status"
      ;;

    status)
      status
      ;;

    exec)
      # Executa nexus com checks
      shift
      local spec="$1"
      local ph="$2"

      SPEC_NAME="$spec" pre_execute_check || exit 1

      log "Executing: nexus.sh --spec $spec --phase $ph"
      bash "$NEXUS" --spec "$spec" --phase "$ph" "$@"
      ;;

    loop)
      # Loop com context awareness
      shift
      local spec="$1"
      shift

      SPEC_NAME="$spec" pre_execute_check || {
        log "Aborting loop due to context limits"
        exit 1
      }

      # Pega próxima task
      local queue_file="$MONOREPO/.claude/vibe-kit/queue.json"
      if [ -f "$queue_file" ]; then
        TASK_ID=$(jq -r '.tasks[] | select(.status == "pending") | .id // empty' "$queue_file" | head -1)
      fi

      # Executa
      bash "$NEXUS" --spec "$spec" --phase execute "$@"

      # Post task
      if [ -n "$TASK_ID" ]; then
        post_task_snapshot "$TASK_ID" "done"
      fi
      ;;

    *)
      echo "Usage: $0 {pre|post|status|exec|loop} [args]"
      echo ""
      echo "Examples:"
      echo "  $0 pre                           # Check before execute"
      echo "  $0 post T01 done                 # Snapshot after task"
      echo "  $0 status                        # Show context status"
      echo "  $0 exec SPEC-XXX execute         # Execute with checks"
      echo "  $0 loop SPEC-XXX --parallel 4    # Loop with checks"
      ;;
  esac
}

main "$@"
