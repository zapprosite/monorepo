#!/usr/bin/env bash
# vibe-kit-launcher.sh — Lança vibe-kit.sh SE não estiver rodando e houver tasks pendentes
# Chamado pelo cron a cada 10 min
set -euo pipefail

VIBE_DIR="/srv/monorepo/.claude/vibe-kit"
MONOREPO_DIR="/srv/monorepo"
STATE_FILE="$VIBE_DIR/state.json"
QUEUE_FILE="$VIBE_DIR/queue.json"
LOG_FILE="$VIBE_DIR/cron-launcher.log"

mkdir -p "$VIBE_DIR"

# Check if queue exists and has pending tasks
if [ ! -f "$QUEUE_FILE" ]; then
    echo "[$(date)] No queue.json found — skipping" >> "$LOG_FILE"
    exit 0
fi

pending=$(jq '.pending' "$QUEUE_FILE" 2>/dev/null || echo "0")
total=$(jq '.total' "$QUEUE_FILE" 2>/dev/null || echo "0")
done=$(jq '.done' "$QUEUE_FILE" 2>/dev/null || echo "0")
failed=$(jq '.failed' "$QUEUE_FILE" 2>/dev/null || echo "0")

echo "[$(date)] Queue: $done/$total done, $failed failed, $pending pending" >> "$LOG_FILE"

# Skip if queue is empty or all done
if [ "$pending" = "0" ] && [ "$done" -ge 5 ]; then
    echo "[$(date)] Queue mostly done ($done/$total) — skipping launch" >> "$LOG_FILE"
    exit 0
fi

# Check if vibe-kit is already running
if pgrep -f "vibe-kit.sh.*MiniMax" > /dev/null 2>&1; then
    echo "[$(date)] vibe-kit.sh already running — skipping launch" >> "$LOG_FILE"
    exit 0
fi

# Check if mclaude workers are active
if pgrep -f "mclaude.*MiniMax" > /dev/null 2>&1; then
    echo "[$(date)] mclaude workers active — skipping launch" >> "$LOG_FILE"
    exit 0
fi

# Launch vibe-kit.sh in background
# SPEC-OWNERSHIP.md is at /srv/monorepo/docs/SPEC-OWNERSHIP.md (not in SPECS subdir)
# Must leave SPEC unset so vibe-kit.sh uses the absolute path argument instead of
# always resolving to $MONOREPO_DIR/docs/SPECS/${SPEC}.md
APP="CRM-REFRIMIX" \
nohup bash "$MONOREPO_DIR/scripts/vibe/vibe-kit.sh" \
    "/srv/monorepo/docs/SPEC-OWNERSHIP.md" \
    --hours 8 \
    --parallel 15 \
    >> "$VIBE_DIR/vibe-kit-stdout.log" 2>&1 &

echo "[$(date)] vibe-kit.sh launched with PID $!" >> "$LOG_FILE"
