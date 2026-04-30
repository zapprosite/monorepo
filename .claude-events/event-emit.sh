#!/usr/bin/env bash
# event-emit.sh — Cross-CLI event emission via state-manager.py
# Usage: EVENT_TYPE=<type> bash event-emit.sh [key=value ...]
set -euo pipefail

MONOREPO_DIR="/srv/monorepo"
EVENTS_DIR="${EVENT_DIR:-$MONOREPO_DIR/.claude-events}"
STATE_MANAGER="$MONOREPO_DIR/.claude-events/state-manager.py"

EVENT_TYPE="${EVENT_TYPE:-}"
PAYLOAD="${*:-}"

if [ -z "$EVENT_TYPE" ]; then
    echo "Usage: EVENT_TYPE=<type> bash $0 [key=value ...]" >&2
    exit 1
fi

ARGS=("$EVENT_TYPE")
if [ -n "$PAYLOAD" ]; then
    for kv in $PAYLOAD; do
        ARGS+=("$kv")
    done
fi

python3 "$STATE_MANAGER" event "${ARGS[@]}" 2>>"$EVENTS_DIR/logs/event-emit-err.log" || {
    echo "event-emit: state-manager failed" >&2
    exit 1
}
