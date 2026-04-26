#!/usr/bin/env bash
# unblock.sh — reset pipeline state após intervenção humana

set -euo pipefail

STATE_FILE="tasks/pipeline-state.json"
RESOLUTION=${1:-"manual-intervention"}

echo "🔓 Unblocking pipeline..."
echo "   Resolution: $RESOLUTION"

# Reset to IDLE
jq --arg res "$RESOLUTION" --arg ts "$(date -Iseconds)" \
  '{
    currentState: "IDLE",
    retryCount: 0,
    retryHistory: [],
    humanGateRequired: false,
    blockedReason: null,
    blockedAt: null,
    humanGateReason: null,
    notificationSent: false,
    testsPassed: false,
    lintPassed: false,
    readyToShip: false,
    lastCheckpoint: $ts,
    lastUnblockReason: $res
  }' \
  "$STATE_FILE" > /tmp/ub.tmp && mv /tmp/ub.tmp "$STATE_FILE"

state=$(jq -r '.currentState' "$STATE_FILE")
echo "✅ Pipeline unblocked. currentState=$state"