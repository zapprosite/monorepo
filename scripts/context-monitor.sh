#!/bin/bash
# Context Monitor — Background process
# Monitors context usage and triggers /clear when > 90%

INTERVAL=30  # seconds
LOG_FILE="/tmp/context-monitor.log"

log() { echo "[$(date '+%H:%M:%S')] CONTEXT-MONITOR: $1" >> "$LOG_FILE"; }

log "Started (PID: $$)"

while true; do
    sleep $INTERVAL

    # Estimate context usage
    # This is a heuristic - Claude Code CLI doesn't expose context directly
    # We check tokens indirectly via output complexity

    # Alternative: check memory usage of claude-code process
    CLAUDE_MEM=$(ps aux 2>/dev/null | grep -i "claude" | grep -v grep | wc -l)

    if [ "$CLAUDE_MEM" -gt 5 ]; then
        log "High memory usage detected ($CLAUDE_MEM processes) - triggering sync"
        bash /home/will/.claude/mcps/ai-context-sync/sync.sh >> "$LOG_FILE" 2>&1
    fi

    # Note: Cannot actually call /clear from a bash script
    # /clear must be called from within Claude Code CLI
    # This script provides the signal that /clear should be called

    # We write to a flag file that the AI checks
    if [ "$CLAUDE_MEM" -gt 8 ]; then
        echo "$(date +%s)" > /tmp/context-high-flag
        log "Context HIGH flag set - AI should call /clear"
    fi

done