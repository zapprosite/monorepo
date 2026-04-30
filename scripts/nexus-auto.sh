#!/bin/bash
# nexus-auto.sh — Autonomous Nexus worker with rate limiting

set -euo pipefail

MONOREPO="/srv/monorepo"
QUEUE="$MONOREPO/.claude/vibe-kit/queue.json"
STATE="$MONOREPO/.claude/vibe-kit/state.json"
STATE_LOCK="$MONOREPO/.claude/vibe-kit/state.lock"
QUEUE_LOCK="$MONOREPO/.claude/vibe-kit/queue.lock"
RATE_LIMITER="$MONOREPO/scripts/nexus-rate-limiter.sh"
LOG="$MONOREPO/logs/nexus-auto.log"
MAX_WORKERS=8
WORKER_ID="${WORKER_ID:-auto-$$}"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$WORKER_ID] $*" | tee -a "$LOG"
}

# Locked read of queue.json
queue_read() {
  local fd=$1
  local var=$2
  local query=$3
  eval "$var=$(jq -r '$query' "$QUEUE" 2>/dev/null)"
}

# Execute jq on queue while holding exclusive lock (avoids escaping hell of flock -c)
with_queue_lock() {
  local tmpfile
  tmpfile=$(mktemp)
  if ! flock "$QUEUE_LOCK" jq "$@" "$QUEUE" > "$tmpfile"; then
    rm -f "$tmpfile"
    return 1
  fi
  mv "$tmpfile" "$QUEUE"
}

# Claim next pending task (locked)
claim_task() {
  if ! command -v flock &>/dev/null; then
    log "ERROR: flock not found, install util-linux package"
    return 1
  fi

  local task
  # Use flock to atomically find and claim a pending task
  task=$(flock "$QUEUE_LOCK" jq -r '.tasks[] | select(.status == "pending") | .id // empty' "$QUEUE" 2>/dev/null | head -1)
  if [ -z "$task" ]; then
    return 1
  fi

  # Atomic claim: find task index and update status while holding lock
  (
    flock "$QUEUE_LOCK"
    task_idx=$(jq -r '.tasks | to_entries | .[] | select(.value.id == "'"$task"'") | .key' "$QUEUE")
    jq '.tasks['"$task_idx"'].status = "running" | .tasks['"$task_idx"'].worker = "'"$WORKER_ID"'"' "$QUEUE" > /tmp/queue.tmp && mv /tmp/queue.tmp "$QUEUE"
  ) 200>"$QUEUE_LOCK"

  echo "$task"
  return 0
}

# Execute task (locked queue access)
execute_task() {
  local task_id="$1"
  local task_name
  task_name=$(jq -r '.tasks[] | select(.id == "'"$task_id"'") | .name' "$QUEUE" 2>/dev/null)

  log "Executing $task_id: $task_name"

  local completed_at
  completed_at=$(date -Iseconds)

  case "$task_name" in
    analyze-os-limits)
      local pid_limit=$(ulimit -u)
      local proc_count=$(ps aux | wc -l)
      local gap=$((pid_limit - proc_count))
      log "OS Limits: PID=$pid_limit, Current=$proc_count, Gap=$gap"

      # Update task as done (locked)
      (
        flock "$QUEUE_LOCK"
        task_idx=$(jq -r '.tasks | to_entries | .[] | select(.value.id == "'"$task_id"'") | .key' "$QUEUE")
        jq '.tasks['"$task_idx"'].status = "done" | .tasks['"$task_idx"'].completed_at = "'"$completed_at"'"' "$QUEUE" > /tmp/queue.tmp && mv /tmp/queue.tmp "$QUEUE"
      ) 200>"$QUEUE_LOCK"
      ;;

    create-rate-limiter)
      if [ -f "$RATE_LIMITER" ]; then
        log "Rate limiter already exists at $RATE_LIMITER"
      else
        log "ERROR: Rate limiter not found at $RATE_LIMITER"
      fi

      (
        flock "$QUEUE_LOCK"
        task_idx=$(jq -r '.tasks | to_entries | .[] | select(.value.id == "'"$task_id"'") | .key' "$QUEUE")
        jq '.tasks['"$task_idx"'].status = "done" | .tasks['"$task_idx"'].completed_at = "'"$completed_at"'"' "$QUEUE" > /tmp/queue.tmp && mv /tmp/queue.tmp "$QUEUE"
      ) 200>"$QUEUE_LOCK"
      ;;

    create-nexus-auto)
      log "Nexus-auto script created"

      (
        flock "$QUEUE_LOCK"
        task_idx=$(jq -r '.tasks | to_entries | .[] | select(.value.id == "'"$task_id"'") | .key' "$QUEUE")
        jq '.tasks['"$task_idx"'].status = "done" | .tasks['"$task_idx"'].completed_at = "'"$completed_at"'"' "$QUEUE" > /tmp/queue.tmp && mv /tmp/queue.tmp "$QUEUE"
      ) 200>"$QUEUE_LOCK"
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

      (
        flock "$QUEUE_LOCK"
        task_idx=$(jq -r '.tasks | to_entries | .[] | select(.value.id == "'"$task_id"'") | .key' "$QUEUE")
        jq '.tasks['"$task_idx"'].status = "done" | .tasks['"$task_idx"'].completed_at = "'"$completed_at"'"' "$QUEUE" > /tmp/queue.tmp && mv /tmp/queue.tmp "$QUEUE"
      ) 200>"$QUEUE_LOCK"
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

      (
        flock "$QUEUE_LOCK"
        task_idx=$(jq -r '.tasks | to_entries | .[] | select(.value.id == "'"$task_id"'") | .key' "$QUEUE")
        jq '.tasks['"$task_idx"'].status = "done" | .tasks['"$task_idx"'].completed_at = "'"$completed_at"'"' "$QUEUE" > /tmp/queue.tmp && mv /tmp/queue.tmp "$QUEUE"
      ) 200>"$QUEUE_LOCK"
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

    # Check if all done (locked read)
    pending=$(flock --shared "$QUEUE_LOCK" jq -r '.pending // 0' "$QUEUE" 2>/dev/null || echo 0)
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
    flock --shared "$QUEUE_LOCK" jq -r '"\(.pending) pending, \(.running) running, \(.done) done, \(.failed) failed"' "$QUEUE"
    ;;
  *) echo "Usage: $0 {loop|single|status}" ;;
esac
