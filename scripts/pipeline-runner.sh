#!/usr/bin/env bash
set -euo pipefail

STATE_FILE="tasks/pipeline-state.json"
TASK_ID=${1:-"manual-$(date +%s)"}
MAX_RETRIES=3
AUTO_FIX_SCRIPT="scripts/auto-fix.sh"

# ── State helpers ──────────────────────────────────────────────
update_state() {
  local key=$1; shift
  local value=$1; shift
  local timestamp=$(date -Iseconds)

  local cmd=".$key = $value"
  if [[ "$key" == "currentState" || "$key" == "blockedReason" || "$key" == "humanGateReason" ]]; then
    cmd=".$key = \"$value\""
  fi

  if [[ "$key" == "currentState" ]]; then
    jq --arg s "$value" --arg t "$TASK_ID" --arg ts "$timestamp" \
      '.currentState = $s | .currentTask = $t | .lastCheckpoint = $ts' \
      "$STATE_FILE" > /tmp/ps.tmp && mv /tmp/ps.tmp "$STATE_FILE"
  else
    jq "$cmd" "$STATE_FILE" > /tmp/ps.tmp && mv /tmp/ps.tmp "$STATE_FILE"
  fi

  echo "[$(date +%H:%M:%S)] $key = $value"
}

increment_retry() {
  local step=$1
  local attempt=$(jq '.retryCount' "$STATE_FILE")
  attempt=$((attempt + 1))

  local history_entry="{\"step\":\"$step\",\"attempt\":$attempt,\"at\":\"$(date -Iseconds)\"}"

  jq --argjson cnt "$attempt" --argjson entry "$history_entry" \
    '.retryCount = $cnt | .retryHistory += [$entry]' \
    "$STATE_FILE" > /tmp/ps.tmp && mv /tmp/ps.tmp "$STATE_FILE"

  echo "[$(date +%H:%M:%S)] retryCount → $attempt"
}

block_for_human() {
  local reason=$1
  local step=$2
  echo "⚠️  BLOQUEADO: $reason"
  update_state "humanGateRequired" "true"
  update_state "blockedReason" "$reason"
  update_state "currentState" "BLOCKED_HUMAN_REQUIRED"
  update_state "blockedAt" "$(date -Iseconds)"
  update_state "humanGateReason" "Step '$step' failed after $MAX_RETRIES attempts: $reason"

  send_telegram "🔴 Pipeline bloqueado: $reason (step: $step, task: $TASK_ID)"
}

send_telegram() {
  local msg=$1
  if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${TELEGRAM_CHAT_ID}&text=${msg}&parse_mode=HTML" || true
    update_state "notificationSent" "true"
  fi
}

# ── Step executor com retry ────────────────────────────────────
run_step() {
  local step_name=$1; shift
  local command="$@"
  local attempt=0

  echo "▶️  Step: $step_name"

  while true; do
    attempt=$(jq '.retryCount' "$STATE_FILE")

    if [[ $attempt -ge $MAX_RETRIES ]]; then
      block_for_human "$step_name failed after $MAX_RETRIES attempts" "$step_name"
      return 1
    fi

    echo "  tentativa $((attempt + 1))/$MAX_RETRIES..."

    if eval "$command" 2>&1; then
      echo "  ✅ $step_name: OK"
      return 0
    else
      echo "  ❌ $step_name: FALHOU"

      if [[ "$step_name" == "test" && -x "$AUTO_FIX_SCRIPT" ]]; then
        echo "  🔧 Executando auto-fix.sh antes do retry..."
        bash "$AUTO_FIX_SCRIPT" || true
      fi

      increment_retry "$step_name"

      if [[ $(jq '.retryCount' "$STATE_FILE") -lt $MAX_RETRIES ]]; then
        echo "  ⏳ Aguardando 5s antes do retry..."
        sleep 5
      fi
    fi
  done
}

# ── Main ───────────────────────────────────────────────────────
echo "🚀 Pipeline iniciado: $TASK_ID"
update_state "currentState" "RUNNING"
update_state "retryCount" "0"
update_state "retryHistory" "[]"
update_state "notificationSent" "false"

run_step "lint" "pnpm turbo lint"
run_step "typecheck" "pnpm turbo typecheck"
run_step "test" "pnpm turbo test --no-cache"

update_state "currentState" "READY_TO_SHIP"
update_state "testsPassed" "true"
update_state "lintPassed" "true"
update_state "readyToShip" "true"

echo "✅ Pipeline completo. Pronto para push."