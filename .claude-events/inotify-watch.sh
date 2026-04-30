#!/bin/bash
# inotify-watch.sh — Watch .claude/ directory for relevant events
# Writes events to state.json (simple, reliable, no FIFO complexity)
# Runs as systemd service (Type=simple)
set -euo pipefail

CLAUDE_DIR="${CLAUDE_DIR:-/srv/monorepo}"
EVENT_DIR="${EVENT_DIR:-/srv/monorepo/.claude-events}"
STATE_MANAGER="$EVENT_DIR/state-manager.py"
LOG_FILE="$EVENT_DIR/logs/inotify-watch.log"

mkdir -p "$EVENT_DIR/logs"

log() {
    echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $*" >> "$LOG_FILE"
}

# ── Build watch list ────────────────────────────────────────────────
HERMES_CLAUDE="/home/will/Desktop/hermes-second-brain/CLAUDE.md"
BRAIN_QUEUE="$CLAUDE_DIR/.claude/brain-refactor/queue.json"
BRAIN_QUEUE_DIR=$(dirname "$BRAIN_QUEUE")

WATCH_DIRS=()
add_dir() {
    [ -d "$1" ] && WATCH_DIRS+=("$1")
}

add_dir "$(dirname "$HERMES_CLAUDE")"
add_dir "$CLAUDE_DIR/.claude"
add_dir "$BRAIN_QUEUE_DIR"

readarray -t UNIQUE_DIRS < <(printf '%s\n' "${WATCH_DIRS[@]}" | sort -u)

if [ ${#UNIQUE_DIRS[@]} -eq 0 ]; then
    log "No directories to watch, exiting"
    exit 0
fi

log "inotify-watch.sh started — watching: ${UNIQUE_DIRS[*]}"

# ── Main watch loop ────────────────────────────────────────────────
printf '%s\n' "${UNIQUE_DIRS[@]}" | \
    xargs -d '\n' inotifywait -m -e close_write -e moved_to -e create --format '%w%f %e' 2>/dev/null | \
while read -r line; do
    [ -z "$line" ] && continue

    path="${line% *}"
    event="${line##* }"
    file="${path##*/}"

    case "$file" in
        CLAUDE.md|AGENTS.md)
            log "CLAUDE_ACCESS: $path ($event)"
            python3 "$STATE_MANAGER" event CLAUDE_ACCESS "file=$file" 2>/dev/null || true
            ;;
        queue.json)
            log "QUEUE_CHANGE: $path ($event)"
            python3 "$STATE_MANAGER" event QUEUE_CHANGE "file=queue.json" 2>/dev/null || true
            ;;
    esac
done
