#!/bin/bash
# =============================================================================
# nexus-alert.sh — Persistent Alert & Reminder System
# =============================================================================
# PURPOSE: Send alerts that persist until user action, with escalation
# METHOD:
#   1. Log alerts to persistent file
#   2. Track unresolved issues
#   3. Escalate reminders (increase urgency over time)
#   4. Notify via terminal when user is active
#   5. Use Claude CLI for context-aware alerts
#
# USAGE:
#   nexus-alert.sh alert <severity> <message> [details]
#   nexus-alert.sh list
#   nexus-alert.sh resolve <id>
#   nexus-alert.sh remind
#   nexus-alert.sh escalate
#
# SEVERITY: info, warn, error, critical
#
# PERSISTENCE: Alerts stay in queue until resolved or archived
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
MONOREPO="${MONOREPO:-/srv/monorepo}"
LOG_DIR="${MONOREPO}/logs"
ALERT_DIR="${LOG_DIR}/alerts"
ALERT_QUEUE="${ALERT_DIR}/queue.json"
ALERT_HISTORY="${ALERT_DIR}/history.json"
ALERT_CONFIG="${ALERT_DIR}/config.json"

# Escalation thresholds (in hours)
ESCALATE_24H="${ESCALATE_24H:-1}"    # Warning after 24h
ESCALATE_72H="${ESCALATE_72H:-2}"    # Error after 72h
ESCALATE_168H="${ESCALATE_168H:-3}"  # Critical after 168h (1 week)

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
[ -t 1 ] || { RED=; GREEN=; YELLOW=; BLUE=; CYAN=; MAGENTA=; NC=; }

# Severity icons and colors
declare -A SEV_ICON=(
  ["info"]="ℹ️"
  ["warn"]="⚠️"
  ["error"]="❌"
  ["critical"]="🚨"
)
declare -A SEV_COLOR=(
  ["info"]="$BLUE"
  ["warn"]="$YELLOW"
  ["error"]="$RED"
  ["critical"]="$MAGENTA"
)

# ===== LOGGING =====
log() { echo -e "${GREEN}[ALERT]${NC} $*"; }
warn() { echo -e "${YELLOW}[ALERT]${NC} $*"; }
error() { echo -e "${RED}[ALERT]${NC} $*" >&2; }
info() { echo -e "${BLUE}[ALERT]${NC} $*"; }
section() { echo ""; echo -e "${MAGENTA}==== $* ====${NC}"; }

# ===== INIT =====
init() {
  mkdir -p "$ALERT_DIR" "$LOG_DIR"
  touch "$ALERT_QUEUE" "$ALERT_HISTORY" 2>/dev/null

  # Initialize files if empty
  if [ ! -s "$ALERT_QUEUE" ]; then
    echo "[]" > "$ALERT_QUEUE"
  fi
  if [ ! -s "$ALERT_HISTORY" ]; then
    echo "[]" > "$ALERT_HISTORY"
  fi
}

# ===== GENERATE ID =====
generate_id() {
  echo "ALT-$(date +%Y%m%d-%H%M%S)-$((RANDOM % 10000))"
}

# ===== ADD ALERT =====
add_alert() {
  local severity="${1:-info}"
  local message="${2:-}"
  local details="${3:-}"

  if [ -z "$message" ]; then
    error "Message required"
    return 1
  fi

  init

  local id=$(generate_id)
  local timestamp=$(date -Iseconds)

  # Create alert object
  local alert=$(cat << EOF
{
  "id": "$id",
  "severity": "$severity",
  "message": "$message",
  "details": "$details",
  "created_at": "$timestamp",
  "updated_at": "$timestamp",
  "reminders": 0,
  "escalation_level": 0,
  "resolved": false,
  "resolved_at": null
}
EOF
)

  # Add to queue
  local new_queue=$(jq --argjson alert "$alert" '. + [$alert]' "$ALERT_QUEUE" 2>/dev/null || echo "[$alert]")
  echo "$new_queue" > "$ALERT_QUEUE"

  # Log
  local color="${SEV_COLOR[$severity]:-$NC}"
  local icon="${SEV_ICON[$severity]:-ℹ️}"
  echo -e "${color}${icon} [$severity] $message${NC}"
  [ -n "$details" ] && echo -e "  Details: $details"

  log "Alert created: $id - $message"

  return 0
}

# ===== LIST ALERTS =====
list_alerts() {
  init

  section "ACTIVE ALERTS"

  local alerts=$(cat "$ALERT_QUEUE" 2>/dev/null | jq -c '.[]' 2>/dev/null)

  if [ -z "$alerts" ]; then
    echo "  No active alerts"
    return 0
  fi

  local count=0
  while IFS= read -r alert; do
    [ -z "$alert" ] && continue
    count=$((count + 1))

    local id=$(echo "$alert" | jq -r '.id')
    local severity=$(echo "$alert" | jq -r '.severity')
    local message=$(echo "$alert" | jq -r '.message')
    local created=$(echo "$alert" | jq -r '.created_at')
    local reminders=$(echo "$alert" | jq -r '.reminders')
    local escalation=$(echo "$alert" | jq -r '.escalation_level')

    local color="${SEV_COLOR[$severity]:-$NC}"
    local icon="${SEV_ICON[$severity]:-ℹ️}"

    echo -e "${color}${icon} [$severity]${NC} $id"
    echo -e "    $message"
    echo -e "    Created: $created | Reminders: $reminders | Escalation: $escalation"
    echo ""
  done <<< "$alerts"

  info "Total active alerts: $count"
}

# ===== RESOLVE ALERT =====
resolve_alert() {
  local id="${1:-}"

  if [ -z "$id" ]; then
    error "Alert ID required"
    return 1
  fi

  init

  # Check if alert exists
  local exists=$(jq --arg id "$id" '[.[] | select(.id == $id)] | length' "$ALERT_QUEUE" 2>/dev/null)

  if [ "$exists" -eq 0 ]; then
    error "Alert not found: $id"
    return 1
  fi

  # Move to history
  local alert=$(jq --arg id "$id" '.[] | select(.id == $id)' "$ALERT_QUEUE" 2>/dev/null)
  local resolved_at=$(date -Iseconds)

  # Update resolved_at
  alert=$(echo "$alert" | jq --arg resolved_at "$resolved_at" '.resolved_at = $resolved_at | .resolved = true')

  # Add to history
  local new_history=$(jq --argjson alert "$alert" '. + [$alert]' "$ALERT_HISTORY" 2>/dev/null)
  echo "$new_history" > "$ALERT_HISTORY"

  # Remove from queue
  local new_queue=$(jq --arg id "$id" 'map(select(.id != $id))' "$ALERT_QUEUE" 2>/dev/null)
  echo "$new_queue" > "$ALERT_QUEUE"

  log "Resolved alert: $id"
  return 0
}

# ===== REMIND (show unresolved alerts) =====
remind() {
  init

  local alerts=$(cat "$ALERT_QUEUE" 2>/dev/null | jq -c '.[] | select(.resolved == false)' 2>/dev/null)

  if [ -z "$alerts" ]; then
    return 0
  fi

  section "UNRESOLVED ALERTS - ACTION REQUIRED"

  local count=0
  local urgent_count=0

  while IFS= read -r alert; do
    [ -z "$alert" ] && continue
    count=$((count + 1))

    local id=$(echo "$alert" | jq -r '.id')
    local severity=$(echo "$alert" | jq -r '.severity')
    local message=$(echo "$alert" | jq -r '.message')
    local created=$(echo "$alert" | jq -r '.created_at')
    local reminders=$(echo "$alert" | jq -r '.reminders')
    local escalation=$(echo "$alert" | jq -r '.escalation_level')

    local color="${SEV_COLOR[$severity]:-$NC}"
    local icon="${SEV_ICON[$severity]:-ℹ️}"

    # Highlight urgent
    if [ "$severity" = "critical" ] || [ "$escalation" -ge 2 ]; then
      urgent_count=$((urgent_count + 1))
      echo -e "${RED}🚨 URGENT: $message${NC}"
    else
      echo -e "${color}${icon} [$severity]${NC} $message"
    fi

    echo -e "    ID: $id | Reminders sent: $reminders | Escalation: $escalation"
    echo ""
  done <<< "$alerts"

  if [ $count -gt 0 ]; then
    echo "=========================================="
    info "You have $count unresolved alert(s)"
    [ $urgent_count -gt 0 ] && echo -e "${RED}⚠️ $urgent_count urgent alert(s) need immediate attention!${NC}"
    echo ""
    echo "To resolve: nexus-alert.sh resolve <id>"
  fi

  return 0
}

# ===== ESCALATE (increase urgency of old alerts) =====
escalate() {
  init

  local now=$(date +%s)
  local alerts=$(cat "$ALERT_QUEUE" 2>/dev/null | jq -c '.[]' 2>/dev/null)

  if [ -z "$alerts" ]; then
    return 0
  fi

  local escalated=0

  while IFS= read -r alert; do
    [ -z "$alert" ] && continue

    local id=$(echo "$alert" | jq -r '.id')
    local created=$(echo "$alert" | jq -r '.created_at')
    local reminders=$(echo "$alert" | jq -r '.reminders')
    local escalation=$(echo "$alert" | jq -r '.escalation_level')
    local resolved=$(echo "$alert" | jq -r '.resolved')

    [ "$resolved" = "true" ] && continue

    # Parse creation time
    local created_ts=$(date -d "$created" +%s 2>/dev/null || echo "0")
    local age_hours=$(( (now - created_ts) / 3600 ))

    local new_escalation=0
    local new_severity=""

    # Determine escalation level
    if [ $age_hours -ge 168 ]; then
      new_escalation=3
      new_severity="critical"
    elif [ $age_hours -ge 72 ]; then
      new_escalation=2
      new_severity="error"
    elif [ $age_hours -ge 24 ]; then
      new_escalation=1
      new_severity="warn"
    fi

    # Update if escalated
    if [ $new_escalation -gt $escalation ]; then
      local updated=$(echo "$alert" | jq --arg severity "$new_severity" --argjson escalation "$new_escalation" '.severity = $severity | .escalation_level = $escalation | .updated_at = "'"$(date -Iseconds)"'"')
      local reminders_inc=$((reminders + 1))
      updated=$(echo "$updated" | jq --argjson reminders "$reminders_inc" '.reminders = $reminders')

      # Update queue
      local new_queue=$(jq --argjson updated "$updated" --arg id "$id" 'map(if .id == $id then $updated else . end)' "$ALERT_QUEUE" 2>/dev/null)
      echo "$new_queue" > "$ALERT_QUEUE"

      escalated=$((escalated + 1))
      warn "Escalated alert $id to $new_severity (age: ${age_hours}h)"
    fi

  done <<< "$alerts"

  if [ $escalated -gt 0 ]; then
    info "Escalated $escalated alert(s)"
  fi
}

# ===== SEND TO TERMINAL (if user is active) =====
notify_terminal() {
  # Check if terminal is available
  if [ ! -t 1 ]; then
    return 0  # Not a terminal, skip
  fi

  # Only notify if there are urgent alerts
  local urgent=$(cat "$ALERT_QUEUE" 2>/dev/null | jq '[.[] | select(.escalation_level >= 2 or .severity == "critical")] | length' 2>/dev/null || echo "0")

  if [ "$urgent" -gt 0 ]; then
    echo ""
    echo -e "${RED}========================================${NC}"
    echo -e "${RED}  NEXUS ALERT: $urgent unresolved issue(s)${NC}"
    echo -e "${RED}  Run 'nexus-alert.sh list' for details${NC}"
    echo -e "${RED}========================================${NC}"
    echo ""
  fi
}

# ===== MAIN =====
main() {
  local command="${1:-}"
  local arg1="${2:-}"
  local arg2="${3:-}"
  local arg3="${4:-}"

  case "$command" in
    alert|add|create)
      add_alert "$arg1" "$arg2" "$arg3"
      ;;
    list|ls|show)
      list_alerts
      ;;
    resolve|fix|done)
      resolve_alert "$arg1"
      ;;
    remind|remindme|pending)
      remind
      ;;
    escalate|escalate-all)
      escalate
      ;;
    notify|terminal)
      notify_terminal
      ;;
    "")
      echo "Usage: $0 <command> [args]"
      echo ""
      echo "Commands:"
      echo "  alert <severity> <message> [details]"
      echo "                                 - Create new alert"
      echo "  list                           - Show active alerts"
      echo "  resolve <id>                   - Mark alert as resolved"
      echo "  remind                         - Show pending alerts"
      echo "  escalate                       - Escalate old alerts"
      echo "  notify                         - Notify via terminal"
      echo ""
      echo "Severity: info, warn, error, critical"
      echo ""
      echo "Examples:"
      echo "  $0 alert warn 'LLM service down' 'Port 4002 not responding'"
      echo "  $0 alert error 'Legacy files detected' '/srv/monorepo has 50 old files'"
      echo "  $0 list"
      echo "  $0 resolve ALT-20260425-1200"
      exit 1
      ;;
    *)
      error "Unknown command: $command"
      main ""
      exit 1
      ;;
  esac
}

main "$@"
