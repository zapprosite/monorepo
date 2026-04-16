#!/usr/bin/env bash
# pipeline-state.sh — CRUD for pipeline-state.json
# Usage: bash scripts/pipeline-state.sh <subcommand> [args]

set -euo pipefail

STATE_FILE="tasks/pipeline-state.json"

# ── Helpers ────────────────────────────────────────────────────
die() { echo "ERROR: $1" >&2; exit 1; }

read_state() {
  local query=${1:-'.'}
  jq -r "$query" "$STATE_FILE" 2>/dev/null || echo "null"
}

update_state() {
  local key=$1; shift
  local value=$1; shift
  local timestamp=$(date -Iseconds)

  local cmd=".$key = \$v | .lastCheckpoint = \$ts"
  jq --arg v "$value" --arg ts "$timestamp" \
    "$cmd" \
    "$STATE_FILE" > /tmp/ps.tmp && mv /tmp/ps.tmp "$STATE_FILE"
}

# Set a field to JSON null
update_state_null() {
  local key=$1
  local timestamp=$(date -Iseconds)
  jq --arg ts "$timestamp" \
    ".$key = null | .lastCheckpoint = \$ts" \
    "$STATE_FILE" > /tmp/ps.tmp && mv /tmp/ps.tmp "$STATE_FILE"
}

# ── Subcommands ────────────────────────────────────────────────
cmd_create() {
  local task_id=${1:-"manual-$(date +%s)"}
  local timestamp=$(date -Iseconds)

  cat > "$STATE_FILE" << EOF
{
  "currentState": "IDLE",
  "retryCount": 0,
  "retryHistory": [],
  "humanGateRequired": false,
  "blockedReason": null,
  "blockedAt": null,
  "humanGateReason": null,
  "notificationSent": false,
  "testsPassed": false,
  "lintPassed": false,
  "readyToShip": false,
  "lastCheckpoint": "$timestamp",
  "lastUnblockReason": null
}
EOF
  echo "✅ Created state: task_id=$task_id, state=IDLE"
}

cmd_read() {
  local pretty=$(jq '.' "$STATE_FILE" 2>/dev/null) || die "Invalid JSON in $STATE_FILE"
  echo "$pretty"
}

cmd_update() {
  local key=$1; shift
  local value=$1; shift
  update_state "$key" "$value"
  echo "✅ Updated: $key = $value"
}

cmd_set-state() {
  local state=$1; shift
  local valid_states="IDLE RUNNING BLOCKED BLOCKED_HUMAN_REQUIRED READY_TO_SHIP TEST_FAILED ABORTED"

  if ! printf '%s\n' $valid_states | grep -qxF "$state"; then
    die "Invalid state: $state. Valid: $valid_states"
  fi

  update_state "currentState" "$state"
  echo "✅ State → $state"
}

cmd_approve() {
  update_state "humanGateRequired" "false"
  update_state "currentState" "IDLE"
  update_state_null "blockedReason"
  update_state_null "blockedAt"
  update_state_null "humanGateReason"
  update_state "lastUnblockReason" "approved-by-cli"
  echo "✅ Pipeline approved"
}

cmd_abort() {
  local reason=${1:-"manual-abort"}
  update_state "humanGateRequired" "false"
  update_state "currentState" "ABORTED"
  update_state "blockedReason" "$reason"
  update_state "lastUnblockReason" "aborted-by-cli"
  echo "❌ Pipeline aborted: $reason"
}

cmd_reset() {
  local timestamp=$(date -Iseconds)
  jq --arg ts "$timestamp" \
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
      lastUnblockReason: null
    }' \
    "$STATE_FILE" > /tmp/ps.tmp && mv /tmp/ps.tmp "$STATE_FILE"
  echo "✅ State reset to IDLE"
}

cmd_status() {
  local state=$(read_state '.currentState')
  local gate=$(read_state '.humanGateRequired')
  local retry=$(read_state '.retryCount')
  local blocked=$(read_state '.blockedReason')
  local last=$(read_state '.lastCheckpoint')

  echo "═══════════════════════════════════════════"
  echo "  Pipeline Status"
  echo "═══════════════════════════════════════════"
  printf "  %-15s %s\n" "State:" "$state"
  printf "  %-15s %s\n" "Human Gate:" "$gate"
  printf "  %-15s %s\n" "Retry Count:" "$retry"
  printf "  %-15s %s\n" "Blocked Reason:" "${blocked:-none}"
  printf "  %-15s %s\n" "Last Checkpoint:" "${last:-N/A}"
  echo "═══════════════════════════════════════════"

  if [[ "$gate" == "true" ]]; then
    echo "🔴 HUMAN GATE REQUIRED"
    echo "   bash scripts/approve.sh --approve"
    echo "   bash scripts/approve.sh --abort"
    exit 1
  elif [[ "$state" == "IDLE" ]]; then
    echo "🟡 IDLE — ready to start"
  elif [[ "$state" == "READY_TO_SHIP" ]]; then
    echo "🟢 READY TO SHIP"
  elif [[ "$state" == "ABORTED" ]]; then
    echo "🔴 ABORTED"
  else
    echo "🔵 $state"
  fi
}

cmd_block() {
  local reason=$1; shift
  local gate_reason=${1:-"$reason"}
  local timestamp=$(date -Iseconds)

  update_state "humanGateRequired" "true"
  update_state "currentState" "BLOCKED_HUMAN_REQUIRED"
  update_state "blockedReason" "$reason"
  update_state "blockedAt" "$timestamp"
  update_state "humanGateReason" "$gate_reason"

  echo "🔴 Pipeline blocked: $reason"
}

# ── Help ──────────────────────────────────────────────────────
cmd_help() {
  echo "Usage: bash scripts/pipeline-state.sh <subcommand> [args]"
  echo ""
  echo "Subcommands:"
  echo "  create [task_id]     Create initial state"
  echo "  read                 Pretty-print state JSON"
  echo "  update <key> <val>   Update a field"
  echo "  set-state <state>    Set currentState (IDLE|RUNNING|etc)"
  echo "  approve              Resolve human gate"
  echo "  abort [reason]       Abort pipeline"
  echo "  reset                Reset to IDLE"
  echo "  status               Quick status summary"
  echo "  block <reason>       Manually block pipeline"
  echo ""
  echo "Examples:"
  echo "  bash scripts/pipeline-state.sh create my-task"
  echo "  bash scripts/pipeline-state.sh status"
  echo "  bash scripts/pipeline-state.sh set-state RUNNING"
}

# ── Main ──────────────────────────────────────────────────────
SUBCOMMAND=${1:-help}; shift 2>/dev/null || true

case "$SUBCOMMAND" in
  create)   [[ -n "${1:-}" ]] || true; cmd_create "${@:-}" ;;
  read)     cmd_read ;;
  update)   cmd_update "${1:-}" "${2:-}" ;;
  set-state) cmd_set-state "${1:-}" ;;
  approve)  cmd_approve ;;
  abort)    cmd_abort "${1:-}" ;;
  reset)    cmd_reset ;;
  status)   cmd_status ;;
  block)    cmd_block "${1:-}" ;;
  help|--help|-h) cmd_help ;;
  *)        die "Unknown subcommand: $SUBCOMMAND. Run without args for help." ;;
esac
