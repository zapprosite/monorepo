#!/bin/bash
# check-gate.sh — Verify if phase gate was satisfied
# Anti-hardcoded: all config via process.env
set -euo pipefail

PHASE="${1:-}"
if [ -z "$PHASE" ]; then
  echo "Usage: check-gate.sh <PHASE>"
  exit 1
fi

STATE_FILE="tasks/pipeline.json"

log() { echo "[$(date '+%H:%M:%S')] $1"; }

check-gate-phase-1() {
  local spec_analyzer_status
  local architect_status

  if [ ! -f "$STATE_FILE" ]; then
    log "Estado nao encontrado: $STATE_FILE"
    return 1
  fi

  spec_analyzer_status=$(jq -r '.agents["SPEC-ANALYZER"].status // "pending"' "$STATE_FILE" 2>/dev/null || echo "pending")
  architect_status=$(jq -r '.agents["ARCHITECT"].status // "pending"' "$STATE_FILE" 2>/dev/null || echo "pending")

  if [ "$spec_analyzer_status" = "completed" ] && [ "$architect_status" = "completed" ]; then
    log "Gate FASE 1: SATISFEITO"
    return 0
  else
    log "Gate FASE 1: NAO SATISFEITO (SPEC-ANALYZER=$spec_analyzer_status, ARCHITECT=$architect_status)"
    return 1
  fi
}

check-gate-phase-2() {
  local coder1_status
  local coder2_status

  if [ ! -f "$STATE_FILE" ]; then
    log "Estado nao encontrado: $STATE_FILE"
    return 1
  fi

  coder1_status=$(jq -r '.agents["CODER-1"].status // "pending"' "$STATE_FILE" 2>/dev/null || echo "pending")
  coder2_status=$(jq -r '.agents["CODER-2"].status // "pending"' "$STATE_FILE" 2>/dev/null || echo "pending")

  if [ "$coder1_status" = "completed" ] && [ "$coder2_status" = "completed" ]; then
    log "Gate FASE 2: SATISFEITO"
    return 0
  else
    log "Gate FASE 2: NAO SATISFEITO (CODER-1=$coder1_status, CODER-2=$coder2_status)"
    return 1
  fi
}

check-gate-phase-3() {
  local reviewer_status

  if [ ! -f "$STATE_FILE" ]; then
    log "Estado nao encontrado: $STATE_FILE"
    return 1
  fi

  reviewer_status=$(jq -r '.agents["REVIEWER"].status // "pending"' "$STATE_FILE" 2>/dev/null || echo "pending")

  if [ "$reviewer_status" = "completed" ]; then
    log "Gate FASE 3: SATISFEITO"
    return 0
  else
    log "Gate FASE 3: NAO SATISFEITO (REVIEWER=$reviewer_status)"
    return 1
  fi
}

case "$PHASE" in
  1) check-gate-phase-1 ;;
  2) check-gate-phase-2 ;;
  3) check-gate-phase-3 ;;
  *)
    log "Fase desconhecida: $PHASE"
    exit 1
    ;;
esac
