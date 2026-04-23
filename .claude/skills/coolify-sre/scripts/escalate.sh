#!/bin/bash
#===========================================
# Escalate — Alert escalation script
# Part of: coolify-sre skill
# Usage: escalate.sh <LEVEL> <SERVICE> [MESSAGE]
# Levels: P1, P2, P3, P4
#===========================================
set -euo pipefail

# Configuration (load from .env if present)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${COOLIFY_ENV_FILE:-/srv/monorepo/.env}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Escalation config — adjust receivers here
TELEGRAM_BOT_TOKEN="${HERMES_AGENCY_BOT_TOKEN:-}"
TELEGRAM_CHAT_ID_CRITICAL="${TELEGRAM_CHAT_ID_CRITICAL:-}"
TELEGRAM_CHAT_ID_WARNING="${TELEGRAM_CHAT_ID_WARNING:-}"
GOTIFY_URL="${GOTIFY_URL:-http://localhost:8050}"
GOTIFY_APP_TOKEN="${GOTIFY_APP_TOKEN:-}"
PAGERDUTY_ROUTING_KEY="${PAGERDUTY_ROUTING_KEY:-}"
WEBHOOK_URL="${ESCALATION_WEBHOOK_URL:-}"
EMAIL_TO="${EMAIL_TO:-}"

# Logging
LOG_DIR="${LOG_DIR:-/srv/ops/logs}"
ESCALATION_LOG="$LOG_DIR/escalations.log"

# Usage
usage() {
  echo "Usage: $0 <LEVEL> <SERVICE> [MESSAGE]"
  echo "  LEVEL:   P1, P2, P3, P4"
  echo "  SERVICE: Service name (e.g., ollama, cloudflared)"
  echo "  MESSAGE: Optional escalation message"
  echo ""
  echo "Examples:"
  echo "  $0 P1 ollama 'Container crashed, manual intervention required'"
  echo "  $0 P2 grafana 'High memory usage detected'"
  echo "  $0 P3 coolify-proxy 'Restart loop detected, blocking auto-heal'"
  exit 1
}

# Validate arguments
if [[ $# -lt 2 ]]; then
  usage
fi

LEVEL="${1^^}"  # Uppercase
SERVICE="$2"
MESSAGE="${3:-No additional details}"
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
HOSTNAME=$(hostname)

# Validate level
case "$LEVEL" in
  P1|P2|P3|P4) ;;
  *)
    echo "ERROR: Invalid level '$LEVEL'. Must be P1, P2, P3, or P4."
    exit 1
    ;;
esac

# Severity to icon/description
declare -A SEVERITY_ICON=([P1]="🔴" [P2]="🟠" [P3]="🟡" [P4]="⚪")
declare -A SEVERITY_DESC=([P1]="CRITICAL" [P2]="HIGH" [P3]="MEDIUM" [P4]="LOW")

ICON="${SEVERITY_ICON[$LEVEL]}"
DESC="${SEVERITY_DESC[$LEVEL]}"

# Log escalation
log_escalation() {
  local level="$1"
  local service="$2"
  local message="$3"
  local channel="$4"
  local status="$5"
  echo "[$TIMESTAMP] ESCALATION [$level] $service → $channel [$status] $message" >> "$ESCALATION_LOG"
}

# Send to Telegram
send_telegram() {
  local chat_id="$1"
  local text="$2"

  if [[ -z "$TELEGRAM_BOT_TOKEN" ]] || [[ -z "$chat_id" ]]; then
    echo "WARN: Telegram not configured (TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not set)"
    return 1
  fi

  local telegram_api="https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage"
  local response
  response=$(curl -sk -X POST "$telegram_api" \
    -d "chat_id=$chat_id" \
    -d "text=$text" \
    -d "parse_mode=HTML" \
    -w "\n%{http_code}")

  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | head -n-1)

  if [[ "$http_code" == "200" ]]; then
    echo "OK: Telegram sent"
    return 0
  else
    echo "ERROR: Telegram failed (HTTP $http_code): $body"
    return 1
  fi
}

# Send to Gotify
send_gotify() {
  local title="$1"
  local message="$2"
  local priority="$3"

  if [[ -z "$GOTIFY_APP_TOKEN" ]]; then
    echo "WARN: Gotify not configured (GOTIFY_APP_TOKEN not set)"
    return 1
  fi

  local gotify_api="$GOTIFY_URL/message"
  local response
  response=$(curl -sk -X POST "$gotify_api" \
    -H "Authorization: Bearer $GOTIFY_APP_TOKEN" \
    -F "title=$title" \
    -F "message=$message" \
    -F "priority=$priority" \
    -w "\n%{http_code}")

  local http_code
  http_code=$(echo "$response" | tail -n1)

  if [[ "$http_code" == "200" ]]; then
    echo "OK: Gotify sent"
    return 0
  else
    echo "ERROR: Gotify failed (HTTP $http_code)"
    return 1
  fi
}

# Send to PagerDuty (Events API v2)
send_pagerduty() {
  local summary="$1"
  local severity="$2"  # critical, error, warning, info

  if [[ -z "$PAGERDUTY_ROUTING_KEY" ]]; then
    echo "WARN: PagerDuty not configured (PAGERDUTY_ROUTING_KEY not set)"
    return 1
  fi

  local pd_api="https://events.pagerduty.com/v2/enqueue"
  local payload
  payload=$(cat <<EOF
{
  "routing_key": "$PAGERDUTY_ROUTING_KEY",
  "event_action": "trigger",
  "dedup_key": "homelab-${SERVICE}-${LEVEL}",
  "payload": {
    "summary": "$summary",
    "severity": "$severity",
    "source": "homelab-sre-monitor",
    "component": "$SERVICE",
    "group": "homelab",
    "class": "alerting"
  }
}
EOF
)

  local response
  response=$(curl -sk -X POST "$pd_api" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    -w "\n%{http_code}")

  local http_code
  http_code=$(echo "$response" | tail -n1)

  if [[ "$http_code" == "202" ]]; then
    echo "OK: PagerDuty triggered"
    return 0
  else
    echo "ERROR: PagerDuty failed (HTTP $http_code)"
    return 1
  fi
}

# Send to generic webhook
send_webhook() {
  local message="$1"

  if [[ -z "$WEBHOOK_URL" ]]; then
    echo "WARN: Webhook not configured (ESCALATION_WEBHOOK_URL not set)"
    return 1
  fi

  local payload
  payload=$(cat <<EOF
{
  "level": "$LEVEL",
  "service": "$SERVICE",
  "message": "$message",
  "timestamp": "$TIMESTAMP",
  "hostname": "$HOSTNAME",
  "icon": "$ICON",
  "severity": "$DESC"
}
EOF
)

  local response
  response=$(curl -sk -X POST "$WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    -w "\n%{http_code}")

  local http_code
  http_code=$(echo "$response" | tail -n1)

  if [[ "$http_code" =~ ^(200|201|202|204)$ ]]; then
    echo "OK: Webhook sent"
    return 0
  else
    echo "ERROR: Webhook failed (HTTP $http_code)"
    return 1
  fi
}

# Send email (via sendmail or SMTP)
send_email() {
  local subject="$1"
  local body="$2"

  if [[ -z "$EMAIL_TO" ]]; then
    echo "WARN: Email not configured (EMAIL_TO not set)"
    return 1
  fi

  if ! command -v sendmail &>/dev/null; then
    echo "WARN: sendmail not available"
    return 1
  fi

  echo -e "To: $EMAIL_TO\nSubject: $subject\n\n$body" | sendmail -t
  echo "OK: Email queued"
}

# Build message
build_message() {
  cat <<EOF
$ICON <b>ESCALATION [$LEVEL] $DESC</b>

<b>Service:</b> $SERVICE
<b>Time:</b> $TIMESTAMP
<b>Host:</b> $HOSTNAME
<b>Message:</b> $MESSAGE
EOF
}

# Main escalation logic
main() {
  local message
  message=$(build_message)

  echo "=== Escalation [$LEVEL] $SERVICE ==="
  echo "Message: $MESSAGE"

  local sent=0
  local failed=0

  # Route based on level
  case "$LEVEL" in
    P1)
      # P1: Telegram (critical channel) + PagerDuty + Webhook
      if [[ -n "$TELEGRAM_CHAT_ID_CRITICAL" ]]; then
        if send_telegram "$TELEGRAM_CHAT_ID_CRITICAL" "$message"; then
          log_escalation "$LEVEL" "$SERVICE" "$MESSAGE" "Telegram" "OK"
          ((sent++))
        else
          ((failed++))
        fi
      fi

      if [[ -n "$PAGERDUTY_ROUTING_KEY" ]]; then
        if send_pagerduty "[$LEVEL] $SERVICE: $MESSAGE" "critical"; then
          log_escalation "$LEVEL" "$SERVICE" "$MESSAGE" "PagerDuty" "OK"
          ((sent++))
        else
          ((failed++))
        fi
      fi

      if [[ -n "$WEBHOOK_URL" ]]; then
        if send_webhook "$MESSAGE"; then
          log_escalation "$LEVEL" "$SERVICE" "$MESSAGE" "Webhook" "OK"
          ((sent++))
        else
          ((failed++))
        fi
      fi
      ;;

    P2)
      # P2: Telegram (warning channel) + Webhook
      if [[ -n "$TELEGRAM_CHAT_ID_WARNING" ]]; then
        if send_telegram "$TELEGRAM_CHAT_ID_WARNING" "$message"; then
          log_escalation "$LEVEL" "$SERVICE" "$MESSAGE" "Telegram" "OK"
          ((sent++))
        else
          ((failed++))
        fi
      fi

      if [[ -n "$WEBHOOK_URL" ]]; then
        if send_webhook "$MESSAGE"; then
          log_escalation "$LEVEL" "$SERVICE" "$MESSAGE" "Webhook" "OK"
          ((sent++))
        else
          ((failed++))
        fi
      fi
      ;;

    P3)
      # P3: Gotify (priority 5) + Webhook
      if send_gotify "[$LEVEL] $SERVICE" "$MESSAGE" "5"; then
        log_escalation "$LEVEL" "$SERVICE" "$MESSAGE" "Gotify" "OK"
        ((sent++))
      else
        ((failed++))
      fi

      if [[ -n "$WEBHOOK_URL" ]]; then
        if send_webhook "$MESSAGE"; then
          log_escalation "$LEVEL" "$SERVICE" "$MESSAGE" "Webhook" "OK"
          ((sent++))
        else
          ((failed++))
        fi
      fi
      ;;

    P4)
      # P4: Webhook only (for logging/tracking)
      if [[ -n "$WEBHOOK_URL" ]]; then
        if send_webhook "$MESSAGE"; then
          log_escalation "$LEVEL" "$SERVICE" "$MESSAGE" "Webhook" "OK"
          ((sent++))
        else
          ((failed++))
        fi
      else
        # Log to file even if no webhook
        log_escalation "$LEVEL" "$SERVICE" "$MESSAGE" "LogOnly" "OK"
        echo "OK: Logged to $ESCALATION_LOG"
        ((sent++))
      fi
      ;;
  esac

  echo "---"
  echo "Sent: $sent, Failed: $failed"

  if [[ $failed -gt 0 ]] && [[ $sent -eq 0 ]]; then
    echo "ERROR: All escalation channels failed"
    exit 1
  fi

  exit 0
}

main "$@"
