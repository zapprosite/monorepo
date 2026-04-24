#!/bin/bash
#
# plan-mode.sh — Plan Mode wrapper for mclaude workers
# Usage: ./plan-mode.sh <session_id> <phase>
#
set -euo pipefail

SESSION_ID="${1:-}"
PHASE="${2:-}"

if [[ -z "$SESSION_ID" || -z "$PHASE" ]]; then
  echo "Usage: plan-mode.sh <session_id> <phase>"
  exit 1
fi

PLAN_DIR="/srv/monorepo/.claude/plans/${SESSION_ID}"
mkdir -p "${PLAN_DIR}/logs"

STATE_FILE="${PLAN_DIR}/state.json"
SPEC_PATH=$(cat "${STATE_FILE}" 2>/dev/null | jq -r '.spec_path // empty')
PIPELINE_PATH="${PLAN_DIR}/pipeline.json"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$PHASE] $1" | tee -a "${PLAN_DIR}/logs/phase-${PHASE}.log"
}

case "$PHASE" in
  0)
    # Memory Query Phase
    log "Starting Phase 0: Memory Query"
    BRIEF=$(cat "${STATE_FILE}" | jq -r '.brief')

    # Query Mem0
    MEM0_RESULT=$(mem0 query "${BRIEF}" --limit 5 2>/dev/null || echo "[]")
    echo "${MEM0_RESULT}" > "${PLAN_DIR}/mem0_context.json"

    # Query Qdrant (simplified — actual embedding needed)
    QDRANT_RESULT=$(curl -s -X POST http://qdrant:6333/collections/hermes/points/search \
      -H "Content-Type: application/json" \
      -d '{"vector": [0.0]*768, "limit": 10}' 2>/dev/null || echo '{"result":[]}')
    echo "${QDRANT_RESULT}" > "${PLAN_DIR}/qdrant_context.json"

    # Combine context
    CONTEXT=$(jq -n \
      --argjson mem0 "$(cat ${PLAN_DIR}/mem0_context.json)" \
      --argjson qdrant "$(cat ${PLAN_DIR}/qdrant_context.json)" \
      '{"mem0": $mem0, "qdrant": $qdrant}')
    echo "${CONTEXT}" > "${PLAN_DIR}/context.json"

    log "Phase 0 complete: Memory context gathered"
    ;;

  1)
    # SPEC Generation Phase
    log "Starting Phase 1: SPEC Generation"
    CONTEXT=$(cat "${PLAN_DIR}/context.json" 2>/dev/null || echo '{}')
    BRIEF=$(cat "${STATE_FILE}" | jq -r '.brief')

    # Generate SPEC via mclaude
    SPEC_CONTENT=$(mclaude --plan-gen \
      --brief "${BRIEF}" \
      --context "${CONTEXT}" \
      --output json 2>/dev/null | jq -r '.spec // empty')

    if [[ -z "${SPEC_CONTENT}" ]]; then
      log "ERROR: SPEC generation failed"
      exit 1
    fi

    # Save SPEC
    UUID=$(cat "${STATE_FILE}" | jq -r '.session_id' | cut -d- -f2)
    SPEC_FILE="/srv/monorepo/docs/SPECs/PLAN-${UUID}.md"
    echo "${SPEC_CONTENT}" > "${SPEC_FILE}"

    # Update state
    jq ".spec_path = \"${SPEC_FILE}\" | .current_phase = 1" "${STATE_FILE}" > "${STATE_FILE}.tmp"
    mv "${STATE_FILE}.tmp" "${STATE_FILE}"

    log "Phase 1 complete: SPEC saved to ${SPEC_FILE}"
    ;;

  2)
    # Pipeline Generation Phase
    log "Starting Phase 2: Pipeline Generation"

    if [[ -z "${SPEC_PATH}" ]]; then
      log "ERROR: No SPEC path found in state"
      exit 1
    fi

    # Generate pipeline via mclaude
    PIPELINE=$(mclaude --pipeline-gen \
      --spec "${SPEC_PATH}" \
      --output json 2>/dev/null | jq -r '.pipeline // empty')

    if [[ -z "${PIPELINE}" ]]; then
      log "ERROR: Pipeline generation failed"
      exit 1
    fi

    echo "${PIPELINE}" > "${PIPELINE_PATH}"

    # Update state
    jq ".pipeline_path = \"${PIPELINE_PATH}\" | .current_phase = 2" "${STATE_FILE}" > "${STATE_FILE}.tmp"
    mv "${STATE_FILE}.tmp" "${STATE_FILE}"

    log "Phase 2 complete: Pipeline saved to ${PIPELINE_PATH}"
    ;;

  3)
    # Execution Phase
    log "Starting Phase 3: Execution"

    if [[ ! -f "${PIPELINE_PATH}" ]]; then
      log "ERROR: No pipeline found at ${PIPELINE_PATH}"
      exit 1
    fi

    PHASES=$(cat "${PIPELINE_PATH}" | jq -r '.phases[] | @json' 2>/dev/null || echo "[]")
    TOTAL=$(echo "${PHASES}" | jq -s 'length')
    CURRENT=0

    for phase in $(echo "${PHASES}" | jq -r '.[].id'); do
      CURRENT=$((CURRENT + 1))
      log "Executing sub-phase ${phase} (${CURRENT}/${TOTAL})"

      # Execute via mclaude worker
      mclaude --execute \
        --spec "${SPEC_PATH}" \
        --phase "${phase}" \
        --session "${SESSION_ID}" 2>&1 | tee -a "${PLAN_DIR}/logs/phase-3-${phase}.log"

      # Mark phase completed
      jq ".phases_completed += [\"${phase}\"]" "${STATE_FILE}" > "${STATE_FILE}.tmp"
      mv "${STATE_FILE}.tmp" "${STATE_FILE}"
    done

    jq ".status = \"completed\" | .current_phase = 3" "${STATE_FILE}" > "${STATE_FILE}.tmp"
    mv "${STATE_FILE}.tmp" "${STATE_FILE}"

    log "Phase 3 complete: All sub-phases executed"
    ;;

  *)
    echo "Unknown phase: ${PHASE}"
    exit 1
    ;;
esac

log "Plan Mode phase ${PHASE} finished successfully"
