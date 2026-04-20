#!/bin/bash
# Anti-hardcoded: all config via process.env
set -euo pipefail

# Verify jq availability
command -v jq > /dev/null || { echo "❌ jq required but not installed"; exit 1; }

PHASE="$1"
STATE_FILE="tasks/pipeline.json"
TIMEOUT="${TIMEOUT:-3600}"  # 1h default per phase

case $PHASE in
  1) AGENTS=("SPEC-ANALYZER" "ARCHITECT") ;;
  2) AGENTS=("CODER-1" "CODER-2") ;;
  *) echo "Fase desconhecida: $PHASE"; exit 1 ;;
esac

echo "Aguardando Fase $PHASE: ${AGENTS[*]}"

START=$(date +%s)
while true; do
  ALL_DONE=true
  ALL_SUCCESS=true

  for agent in "${AGENTS[@]}"; do
    STATE_FILE_PATH="tasks/agent-states/${agent}.json"
    if [ -f "$STATE_FILE_PATH" ]; then
      STATE=$(cat "$STATE_FILE_PATH")
      STATUS=$(echo "$STATE" | jq -r '.status' 2>/dev/null || echo "unknown")
      EXIT_CODE=$(echo "$STATE" | jq -r '.exit_code // 0' 2>/dev/null || echo "0")

      if [ "$STATUS" != "completed" ]; then
        ALL_DONE=false
      fi
      if [ "$EXIT_CODE" != "0" ]; then
        ALL_SUCCESS=false
        echo "  $agent: $STATUS (exit $EXIT_CODE)"
      fi
    else
      ALL_DONE=false
      echo "  $agent: waiting..."
    fi
  done

  if $ALL_DONE; then
    if $ALL_SUCCESS; then
      echo "✅ Phase $PHASE: ALL SUCCESS"
      exit 0
    else
      echo "❌ Phase $PHASE: FAILED (non-zero exit)"
      exit 1
    fi
  fi

  # Timeout check
  NOW=$(date +%s)
  if (( NOW - START > TIMEOUT )); then
    echo "❌ Timeout fase $PHASE (${TIMEOUT}s)"
    exit 1
  fi

  sleep 5
done
