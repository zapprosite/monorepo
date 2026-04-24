#!/usr/bin/env bash
# claim-task.sh — Atomic task claimer using flock
# Usage: QUEUE_FILE=/path/to/queue.json bash claim-task.sh <worker_id>
set -euo pipefail

WORKER_ID="${1:-W00}"
QUEUE_FILE="${QUEUE_FILE:-/srv/monorepo/.claude/vibe-kit/queue.json}"
LOCK_FILE="${QUEUE_FILE}.lock"

claim_task() {
    local wid="$WORKER_ID"
    
    # flock takes a bash -c command; pass $wid as argument to avoid quoting hell
    flock "$LOCK_FILE" bash -c '
        TASK_JSON=$(jq "[\".tasks[] | select(.status == \\\"pending\\\")][0] // null" "$QUEUE_FILE" 2>/dev/null)
        
        if [ "$TASK_JSON" = "null" ] || [ -z "$TASK_JSON" ]; then
            exit 2
        fi
        
        TASK_ID=$(echo "$TASK_JSON" | jq -r ".id")
        
        # Claim atomically: update status+worker, recalculate pending+running
        jq --arg tid "$TASK_ID" --arg wid "$1" \
            "\".tasks |= map(if .id == \\\$tid then .status = \\\"running\\\" | .worker = \\\$wid else . end) |
              .running = (.tasks | map(select(.status == \\\"running\\\")) | length) |
              .pending = (.tasks | map(select(.status == \\\"pending\\\")) | length)\"" \
            "$QUEUE_FILE" > "${QUEUE_FILE}.tmp" 2>/dev/null
        
        if [ ${PIPESTATUS[0]} -eq 0 ]; then
            mv "${QUEUE_FILE}.tmp" "$QUEUE_FILE"
            echo "$TASK_JSON"
            exit 0
        else
            exit 3
        fi
    ' "$wid" || return $?
}

claim_task
