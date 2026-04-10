#!/usr/bin/env bash
# query-gate.sh — Query human gate status
# Usage: bash scripts/query-gate.sh

set -euo pipefail

STATE_FILE="tasks/pipeline-state.json"

# ── Helpers ────────────────────────────────────────────────────
read_state() {
  jq -r "$1" "$STATE_FILE" 2>/dev/null || echo "null"
}

# ── Main ──────────────────────────────────────────────────────
main() {
  [[ -f "$STATE_FILE" ]] || {
    echo "State file not found: $STATE_FILE"
    exit 1
  }

  local gate=$(read_state '.humanGateRequired')
  local reason=$(read_state '.blockedReason')
  local blocked=$(read_state '.blockedAt')
  local state=$(read_state '.currentState')
  local retry=$(read_state '.retryCount')
  local unblock_reason=$(read_state '.lastUnblockReason')

  echo "═══════════════════════════════════════════"
  echo "  Pipeline State"
  echo "═══════════════════════════════════════════"
  echo "  Current State:    $state"
  echo "  Human Gate:       $gate"
  echo "  Blocked Reason:   ${reason:-none}"
  echo "  Blocked At:       ${blocked:-N/A}"
  echo "  Retry Count:      $retry"
  echo "  Last Unblock:     ${unblock_reason:-N/A}"
  echo "═══════════════════════════════════════════"

  if [[ "$gate" == "true" ]]; then
    echo ""
    echo "🔴 HUMAN GATE REQUIRED"
    echo "   Run: bash scripts/approve.sh --approve"
    echo "   Or:  bash scripts/approve.sh --abort"
    exit 1
  else
    echo ""
    echo "✅ No human gate required."
    exit 0
  fi
}

main
