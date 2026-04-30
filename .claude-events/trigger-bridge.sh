#!/bin/bash
# trigger-bridge.sh — Poll state.json and dispatch to vibe-kit / nexus
# Simpler than FIFO: polls every 5s, reads queue.json changes, emits to vibe-kit
# Runs as systemd service (Type=simple)
set -euo pipefail

EVENT_DIR="${EVENT_DIR:-/srv/monorepo/.claude-events}"
CLAUDE_DIR="${CLAUDE_DIR:-/srv/monorepo}"
STATE="$CLAUDE_DIR/.claude/state.json"
BRAIN_QUEUE="$CLAUDE_DIR/.claude/brain-refactor/queue.json"
VIBE_KIT="$CLAUDE_DIR/.claude/vibe-kit/vibe-kit.sh"
LOG_FILE="$EVENT_DIR/logs/trigger-bridge.log"
STATE_MANAGER="$EVENT_DIR/state-manager.py"

mkdir -p "$EVENT_DIR/logs"

log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" >> "$LOG_FILE"
}

log "trigger-bridge.sh started (PID=$$)"

LAST_QUEUE_MTIME=0
POLL_INTERVAL=5

while true; do
    # Check queue changes
    if [ -f "$BRAIN_QUEUE" ]; then
        MTIME=$(stat -c %Y "$BRAIN_QUEUE" 2>/dev/null || echo 0)
        if [ "$MTIME" != "$LAST_QUEUE_MTIME" ]; then
            log "Queue changed: $(date -u -d @"$MTIME")"
            LAST_QUEUE_MTIME="$MTIME"
        fi
    fi

    # Check for TASK_TRIGGER events in state.json
    python3 "$STATE_MANAGER" get events TASK_TRIGGER 2>/dev/null | python3 -c "
import sys, json
try:
    events = json.load(sys.stdin)
    if events and len(events) > 0:
        last = events[-1]
        print(last.get('data', {}).get('task_name', ''))
except: pass
" 2>/dev/null | while read -r task_name; do
        [ -n "$task_name" ] || continue
        log "TASK_TRIGGER: $task_name"
    done

    sleep "$POLL_INTERVAL"
done
