#!/usr/bin/env bash
# pipeline-watcher.sh — background monitor para human gate

set -euo pipefail

STATE_FILE="tasks/pipeline-state.json"
CHECK_INTERVAL=10

echo "👁️  Pipeline watcher iniciado (PID: $$)"
echo "   CHECK_INTERVAL=${CHECK_INTERVAL}s"

while true; do
  human_gate=$(jq -r '.humanGateRequired // false' "$STATE_FILE")
  notification_sent=$(jq -r '.notificationSent // false' "$STATE_FILE")
  blocked_reason=$(jq -r '.blockedReason // null' "$STATE_FILE")
  current_state=$(jq -r '.currentState // "UNKNOWN"' "$STATE_FILE")

  if [[ "$human_gate" == "true" && "$notification_sent" != "true" ]]; then
    echo "[$(date +%H:%M:%S)] 🔴 Human gate detectada!"
    echo "   Motivo: $blocked_reason"
    echo "   Estado: $current_state"

    if [[ -n "${TELEGRAM_BOT_TOKEN:-}" && -n "${TELEGRAM_CHAT_ID:-}" ]]; then
      local msg="🟠 <b>Pipeline Human Gate</b>%0A%0A"
      msg+="📌 Motivo: ${blocked_reason}%0A"
      msg+="🛑 Estado: ${current_state}%0A%0A"
      msg+="👉 Ação: bash scripts/unblock.sh"

      curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}&text=${msg}&parse_mode=HTML" || true
    fi

    jq '.notificationSent = true' "$STATE_FILE" > /tmp/pw.tmp && mv /tmp/pw.tmp "$STATE_FILE"
    echo "   ✅ Notificação enviada"
  fi

  sleep "$CHECK_INTERVAL"
done