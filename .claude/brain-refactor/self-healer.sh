#!/bin/bash
# vibe-self-healer.sh — Self-healing loop for failed vibe workers
# Implements: retry with exponential backoff + dead-letter queue
# Part of SPEC-VIBE-BRAIN-REFACTOR T17
set -euo pipefail

WORKDIR=/srv/monorepo/.claude/brain-refactor
QUEUE=$WORKDIR/queue.json
DLQ=$WORKDIR/dlq.json
LOG=$WORKDIR/logs/self-healer.log
LOCK=$WORKDIR/.self-healer.lock
STUCK_THRESHOLD_HOURS=2
MAX_RETRIES=3
BACKOFF_BASE=60

mkdir -p $WORKDIR/logs

log() {
    echo "[$(date -u)] $1" >> "$LOG"
}

acquire_lock() {
    if [ -f "$LOCK" ]; then
        LOCKPID=$(cat "$LOCK" 2>/dev/null || echo "")
        if [ -n "$LOCKPID" ] && kill -0 "$LOCKPID" 2>/dev/null; then
            log "Already running PID=$LOCKPID, exiting"
            exit 0
        fi
        log "Stale lock cleared"
    fi
    echo $$ > "$LOCK"
}

release_lock() {
    rm -f "$LOCK"
}

init_dlq() {
    if [ ! -f "$DLQ" ]; then
        echo '{"dlq": [], "stats": {"total_failed": 0, "retried": 0, "dead_lettered": 0}}' > "$DLQ"
    fi
}

acquire_lock
trap release_lock EXIT

log "Self-healer: starting"
init_dlq

# Run Python watchdog
python3 "$WORKDIR/self-healer.py"

log "Self-healer: done"
