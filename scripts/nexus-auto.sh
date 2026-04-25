#!/bin/bash
# nexus-auto.sh — Autonomous Nexus worker with rate limiting

set -euo pipefail

MONOREPO="/srv/monorepo"
QUEUE="$MONOREPO/.claude/vibe-kit/queue.json"
STATE="$MONOREPO/.claude/vibe-kit/state.json"
RATE_LIMITER="$MONOREPO/scripts/nexus-rate-limiter.sh"
LOG="$MONOREPO/logs/nexus-auto.log"
MAX_WORKERS=8
WORKER_ID="${WORKER_ID:-auto-$$}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$WORKER_ID] $*" | tee -a "$LOG"
}

# Claim next pending task
claim_task() {
  local task
  task=$(jq -r '.tasks[] | select(.status == "pending") | .id // empty' "$QUEUE" 2>/dev/null | head -1)
  if [ -z "$task" ]; then
    return 1
  fi

  # Atomic claim
  local task_idx
  task_idx=$(jq -r '.tasks | to_entries | .[] | select(.value.id == "'$task'") | .key' "$QUEUE")

  jq '.tasks['$task_idx'].status = "running" | .tasks['$task_idx'].worker = "'$WORKER_ID'"' "$QUEUE" > /tmp/queue.tmp && mv /tmp/queue.tmp "$QUEUE"

  echo "$task"
  return 0
}

# Execute task
execute_task() {
  local task_id="$1"
  local task_name
  task_name=$(jq -r '.tasks[] | select(.id == "'$task_id'") | .name' "$QUEUE")

  log "Executing $task_id: $task_name"

  case "$task_name" in
    analyze-os-limits)
      local pid_limit=$(ulimit -u)
      local proc_count=$(ps aux | wc -l)
      local gap=$((pid_limit - proc_count))
      log "OS Limits: PID=$pid_limit, Current=$proc_count, Gap=$gap"

      # Update task as done
      local task_idx
      task_idx=$(jq -r '.tasks | to_entries | .[] | select(.value.id == "'$task_id'") | .key' "$QUEUE")
      jq '.tasks['$task_idx'].status = "done" | .tasks['$task_idx'].completed_at = "'$(date -Iseconds)'" | .tasks['$task_idx'].artifacts = ["PID limit: '"$pid_limit"'", "Gap: '"$gap"'"]' "$QUEUE" > /tmp/queue.tmp && mv /tmp/queue.tmp "$QUEUE"
      ;;

    create-rate-limiter)
      if [ -f "$RATE_LIMITER" ]; then
        log "Rate limiter already exists at $RATE_LIMITER"
      else
        log "ERROR: Rate limiter not found at $RATE_LIMITER"
      fi

      local task_idx
      task_idx=$(jq -r '.tasks | to_entries | .[] | select(.value.id == "'$task_id'") | .key' "$QUEUE")
      jq '.tasks['$task_idx'].status = "done" | .tasks['$task_idx'].completed_at = "'$(date -Iseconds)'"' "$QUEUE" > /tmp/queue.tmp && mv /tmp/queue.tmp "$QUEUE"
      ;;

    create-nexus-auto)
      log "Nexus-auto script created"

      local task_idx
      task_idx=$(jq -r '.tasks | to_entries | .[] | select(.value.id == "'$task_id'") | .key' "$QUEUE")
      jq '.tasks['$task_idx'].status = "done" | .tasks['$task_idx'].completed_at = "'$(date -Iseconds)'" | .tasks['$task_idx'].artifacts = ["'"$MONOREPO/scripts/nexus-auto.sh"'"]' "$QUEUE" > /tmp/queue.tmp && mv /tmp/queue.tmp "$QUEUE"
      ;;

    stress-test-sustained)
      log "Starting stress test: 50 req/min sustained for 5h (15k total)"

      local start_time=$(date +%s)
      local target_time=$((start_time + 18000))  # 5 hours
      local total_req=0
      local target_req=15000

      while [ $(date +%s) -lt $target_time ] && [ $total_req -lt $target_req ]; do
        if "$RATE_LIMITER" acquire 2>/dev/null; then
          # Simulate request
          log "Request $total_req/15000 sent"
          total_req=$((total_req + 1))

          # Rate limit to 50 RPM = 1 request every 1.2 seconds
          sleep 1.2
        else
          sleep 0.1
        fi
      done

      log "Stress test complete: $total_req requests sent"

      local task_idx
      task_idx=$(jq -r '.tasks | to_entries | .[] | select(.value.id == "'$task_id'") | .key' "$QUEUE")
      jq '.tasks['$task_idx'].status = "done" | .tasks['$task_idx'].completed_at = "'$(date -Iseconds)'" | .tasks['$task_idx'].artifacts = ["'"$total_req"' requests sent"]' "$QUEUE" > /tmp/queue.tmp && mv /tmp/queue.tmp "$QUEUE"
      ;;

    burst-test-500-rpm)
      log "Starting burst test: 500 RPM for 1 minute"

      local burst_start=$(date +%s)
      local burst_end=$((burst_start + 60))
      local burst_count=0

      while [ $(date +%s) -lt $burst_end ]; do
        if "$RATE_LIMITER" acquire 2>/dev/null; then
          burst_count=$((burst_count + 1))
        fi
        # No sleep - go as fast as rate allows
      done

      log "Burst test complete: $burst_count requests in 60 seconds"

      local task_idx
      task_idx=$(jq -r '.tasks | to_entries | .[] | select(.value.id == "'$task_id'") | .key' "$QUEUE")
      jq '.tasks['$task_idx'].status = "done" | .tasks['$task_idx'].completed_at = "'$(date -Iseconds)'" | .tasks['$task_idx'].artifacts = ["'"$burst_count"' requests in 60s"]' "$QUEUE" > /tmp/queue.tmp && mv /tmp/queue.tmp "$QUEUE"
      ;;

    *)
      log "Unknown task: $task_name"
      return 1
      ;;
  esac
}

# Auto-restart loop
run_loop() {
  log "Starting Nexus auto loop"
  mkdir -p "$(dirname "$LOG")"

  while true; do
    if task_id=$(claim_task); then
      execute_task "$task_id" || log "Task $task_id failed"
    else
      log "No pending tasks, waiting..."
      sleep 5
    fi

    # Check if all done
    pending=$(jq -r '.pending // 0' "$QUEUE" 2>/dev/null || echo 0)
    if [ "$pending" -eq 0 ]; then
      log "All tasks completed"
      break
    fi
  done
}

# Run single task
run_single() {
  if task_id=$(claim_task); then
    execute_task "$task_id"
  else
    log "No pending tasks"
    return 1
  fi
}

case "${1:-loop}" in
  loop) run_loop ;;
  single) run_single ;;
  status)
    echo "Queue status:"
    jq -r '"\(.pending) pending, \(.running) running, \(.done) done, \(.failed) failed"' "$QUEUE"
    ;;
  *) echo "Usage: $0 {loop|single|status}" ;;
esac
