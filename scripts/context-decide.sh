#!/bin/bash
# context-decide.sh — Decision engine para context management

set -euo pipefail

MONOREPO="/srv/monorepo"
METEOR="$MONOREPO/scripts/context-meter.sh"
PREDICT="$MONOREPO/scripts/context-predict.sh"
SNAPSHOT="$MONOREPO/scripts/context-snapshot.sh"

# Thresholds (percentages)
THRESHOLD_PROCEED=70
THRESHOLD_SNAPSHOT=85
THRESHOLD_STOP=95

# Load custom thresholds from env
THRESHOLD_PROCEED="${CONTEXT_THRESHOLD_PROCEED:-$THRESHOLD_PROCEED}"
THRESHOLD_SNAPSHOT="${CONTEXT_THRESHOLD_SNAPSHOT:-$THRESHOLD_SNAPSHOT}"
THRESHOLD_STOP="${CONTEXT_THRESHOLD_STOP:-$THRESHOLD_STOP}"

# Decision types
DECIDE_PROCEED="proceed"
DECIDE_SNAPSHOT="snapshot"
DECIDE_COMPRESS="compress"
DECIDE_STOP="stop"

get_context_info() {
  local output
  output=$("$METEOR" --json 2>/dev/null)
  echo "$output"
}

decide() {
  local context_json
  context_json=$(get_context_info)

  if [ -z "$context_json" ]; then
    echo "$DECIDE_PROCEED"
    return
  fi

  local percentage
  percentage=$(echo "$context_json" | jq -r '.percentage')

  log "Context at ${percentage}%"

  if [ "$percentage" -ge "$THRESHOLD_STOP" ]; then
    echo "$DECIDE_STOP"
  elif [ "$percentage" -ge "$THRESHOLD_SNAPSHOT" ]; then
    echo "$DECIDE_SNAPSHOT"
  else
    echo "$DECIDE_PROCEED"
  fi
}

# Wrapper para usar no Nexus
decide_for_nexus() {
  local decision
  decision=$(decide)

  case "$decision" in
    "$DECIDE_STOP")
      log "Context decision: STOP - would exceed limits"
      echo "stop"
      ;;
    "$DECIDE_SNAPSHOT")
      log "Context decision: SNAPSHOT needed"
      # Faz snapshot antes de continuar
      local spec="${SPEC_NAME:-unknown}"
      local task_id="${TASK_ID:-unknown}"
      "$SNAPSHOT" "$task_id" "$spec" "pre-continue"
      echo "snapshot"
      ;;
    *)
      log "Context decision: PROCEED"
      echo "proceed"
      ;;
  esac
}

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [context-decide] $*"
}

main() {
  local mode="${1:-decide}"

  case "$mode" in
    decide)
      decide
      ;;
    nexus)
      decide_for_nexus
      ;;
    info)
      "$METEOR" --json
      ;;
    thresholds)
      echo "THRESHOLD_PROCEED=$THRESHOLD_PROCEED"
      echo "THRESHOLD_SNAPSHOT=$THRESHOLD_SNAPSHOT"
      echo "THRESHOLD_STOP=$THRESHOLD_STOP"
      ;;
    *)
      echo "Usage: $0 {decide|nexus|info|thresholds}"
      ;;
  esac
}

# Se executado diretamente (não sourceado)
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
  main "$@"
fi
