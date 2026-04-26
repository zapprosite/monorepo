#!/usr/bin/env bash
# approve.sh — Human gate polling + approval
# Usage: bash scripts/approve.sh [--approve|--abort|--dry-run] [--poll-interval=30]

set -euo pipefail

STATE_FILE="tasks/pipeline-state.json"
POLL_INTERVAL=30
ACTION=""
DRY_RUN=false

# ── Args ──────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --approve) ACTION="approve"; shift ;;
    --abort) ACTION="abort"; shift ;;
    --dry-run) DRY_RUN=true; shift ;;
    --poll-interval=*) POLL_INTERVAL="${1#*=}"; shift ;;
    *) echo "Unknown arg: $1"; exit 1 ;;
  esac
done

# ── Helpers ────────────────────────────────────────────────────
die() { echo "ERROR: $1" >&2; exit 1; }

read_state() {
  jq -r "$1" "$STATE_FILE" 2>/dev/null || echo "null"
}

update_state() {
  local key=$1; shift
  local value=$1; shift
  local timestamp=$(date -Iseconds)

  if [[ "$DRY_RUN" == "true" ]]; then
    echo "[DRY-RUN] Would update: $key = $value"
    return 0
  fi

  jq --arg v "$value" --arg ts "$timestamp" \
    ".$key = \$v | .lastCheckpoint = \$ts" \
    "$STATE_FILE" > /tmp/as.tmp && mv /tmp/as.tmp "$STATE_FILE"
}

human_gate_required() {
  local val=$(read_state '.humanGateRequired')
  [[ "$val" == "true" ]]
}

blocked_reason() {
  read_state '.blockedReason // empty'
}

blocked_at() {
  read_state '.blockedAt // empty'
}

# ── Display status ────────────────────────────────────────────
show_status() {
  local gate=$(read_state '.humanGateRequired')
  local reason=$(blocked_reason)
  local blocked=$(blocked_at)
  local state=$(read_state '.currentState')
  local retry=$(read_state '.retryCount')

  echo "═══════════════════════════════════════════"
  echo "  Human Gate Status"
  echo "═══════════════════════════════════════════"
  echo "  State:        $state"
  echo "  Gate Required: $gate"
  echo "  Blocked Reason: ${reason:-none}"
  echo "  Blocked At:   ${blocked:-N/A}"
  echo "  Retry Count:  $retry"
  echo "═══════════════════════════════════════════"

  if [[ "$gate" == "true" ]]; then
    echo ""
    echo "Waiting for human approval..."
    echo "To approve:   bash scripts/approve.sh --approve"
    echo "To abort:     bash scripts/approve.sh --abort"
    echo "Poll interval: ${POLL_INTERVAL}s"
  fi
}

# ── Approve ────────────────────────────────────────────────────
do_approve() {
  echo "✅ Approving pipeline..."

  update_state "humanGateRequired" "false"
  update_state "currentState" "IDLE"
  update_state "blockedReason" "null"
  update_state "blockedAt" "null"
  update_state "humanGateReason" "null"
  update_state "lastUnblockReason" "approved-by-human"

  echo "✅ Pipeline approved and unblocked."
}

# ── Abort ─────────────────────────────────────────────────────
do_abort() {
  local reason=${1:-"manual-abort"}
  echo "❌ Aborting pipeline... reason: $reason"

  update_state "humanGateRequired" "false"
  update_state "currentState" "ABORTED"
  update_state "blockedReason" "$reason"
  update_state "lastUnblockReason" "aborted-by-human"

  echo "❌ Pipeline aborted."
}

# ── Polling loop ───────────────────────────────────────────────
poll() {
  echo "🔄 Starting poll loop (interval: ${POLL_INTERVAL}s)"
  echo "   Press Ctrl+C to abort"
  echo ""

  while true; do
    if ! human_gate_required; then
      echo "✅ Human gate resolved!"
      return 0
    fi

    show_status
    echo ""
    echo "⏳ Polling in ${POLL_INTERVAL}s... (Ctrl+C to abort)"

    sleep "$POLL_INTERVAL"

    # Check if state file still exists
    if [[ ! -f "$STATE_FILE" ]]; then
      die "State file disappeared: $STATE_FILE"
    fi
  done
}

# ── Main ──────────────────────────────────────────────────────
main() {
  # Validate state file exists
  [[ -f "$STATE_FILE" ]] || die "State file not found: $STATE_FILE"

  case "$ACTION" in
    approve)
      do_approve
      ;;
    abort)
      do_abort "manual-abort"
      ;;
    "")
      if [[ "$DRY_RUN" == "true" ]]; then
        show_status
        echo ""
        echo "[DRY-RUN] No action taken. Use --approve or --abort."
      else
        # No action specified — show status and start polling
        if human_gate_required; then
          show_status
          echo ""
          echo "No action specified. Starting poll loop..."
          poll
        else
          echo "✅ No human gate required. Pipeline is running."
        fi
      fi
      ;;
  esac
}

main
