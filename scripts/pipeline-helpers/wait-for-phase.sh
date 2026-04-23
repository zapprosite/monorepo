#!/bin/bash
# wait-for-phase.sh — Poll until phase completes
# Anti-hardcoded: all config via process.env
set -euo pipefail

PHASE="${1:-}"
if [ -z "$PHASE" ]; then
  echo "Usage: wait-for-phase.sh <PHASE>"
  exit 1
fi

STATE_FILE="tasks/pipeline.json"
MAX_WAIT=3600  # 1 hour max
INTERVAL=10   # 10 second intervals

log() { echo "[$(date '+%H:%M:%S')] $1"; }

wait-for-phase-completion() {
  local phase="$1"
  local elapsed=0

  while [ $elapsed -lt $MAX_WAIT ]; do
    if [ ! -f "$STATE_FILE" ]; then
      log "Estado nao encontrado: $STATE_FILE"
      return 1
    fi

    local current_phase
    current_phase=$(jq -r '.phase' "$STATE_FILE" 2>/dev/null || echo "0")

    # Phase 1: wait for SPEC-ANALYZER + ARCHITECT
    if [ "$phase" = "1" ]; then
      local spec_analyzer_status
      local architect_status
      spec_analyzer_status=$(jq -r '.agents["SPEC-ANALYZER"].status // "pending"' "$STATE_FILE" 2>/dev/null || echo "pending")
      architect_status=$(jq -r '.agents["ARCHITECT"].status // "pending"' "$STATE_FILE" 2>/dev/null || echo "pending")

      if [ "$spec_analyzer_status" = "completed" ] && [ "$architect_status" = "completed" ]; then
        log "FASE 1 completa"
        return 0
      fi
    fi

    # Phase 2: wait for CODER-1 + CODER-2
    if [ "$phase" = "2" ]; then
      local coder1_status
      local coder2_status
      coder1_status=$(jq -r '.agents["CODER-1"].status // "pending"' "$STATE_FILE" 2>/dev/null || echo "pending")
      coder2_status=$(jq -r '.agents["CODER-2"].status // "pending"' "$STATE_FILE" 2>/dev/null || echo "pending")

      if [ "$coder1_status" = "completed" ] && [ "$coder2_status" = "completed" ]; then
        log "FASE 2 completa"
        return 0
      fi
    fi

    # Phase 3: wait for REVIEWER
    if [ "$phase" = "3" ]; then
      local reviewer_status
      reviewer_status=$(jq -r '.agents["REVIEWER"].status // "pending"' "$STATE_FILE" 2>/dev/null || echo "pending")

      if [ "$reviewer_status" = "completed" ]; then
        log "FASE 3 completa"
        return 0
      fi
    fi

    sleep $INTERVAL
    elapsed=$((elapsed + INTERVAL))
  done

  log "Timeout esperando FASE $phase"
  return 1
}

log "Aguardando FASE $PHASE"
wait-for-phase-completion "$PHASE"
