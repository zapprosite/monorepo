#!/bin/bash
# Anti-hardcoded: all config via process.env
# Verifies gate conditions for a phase
set -euo pipefail

PHASE="${1:-}"
STATE_FILE="tasks/pipeline.json"

if [ -z "$PHASE" ]; then
  echo "Usage: check-gate.sh <phase-number>"
  exit 1
fi

check_agent() {
  local agent=$1
  local state_file="tasks/agent-states/${agent}.json"

  if [ ! -f "$state_file" ]; then
    echo "❌ $agent: no state file"
    return 1
  fi

  local status=$(jq -r '.status' "$state_file" 2>/dev/null)
  local exit_code=$(jq -r '.exit_code // 0' "$state_file" 2>/dev/null)

  if [ "$status" != "completed" ]; then
    echo "❌ $agent: status=$status (expected completed)"
    return 1
  fi

  if [ "$exit_code" != "0" ]; then
    echo "❌ $agent: exit_code=$exit_code (expected 0)"
    return 1
  fi

  echo "✅ $agent: ok"
  return 0
}

case $PHASE in
  1)
    echo "Gate FASE 1: SPEC-ANALYZER + ARCHITECT"
    check_agent "SPEC-ANALYZER" || exit 1
    check_agent "ARCHITECT" || exit 1
    echo "✅ Gate FASE 1 satisfeito"
    ;;
  2)
    echo "Gate FASE 2: CODER-1 + CODER-2"
    check_agent "CODER-1" || exit 1
    check_agent "CODER-2" || exit 1
    echo "✅ Gate FASE 2 satisfeito"
    ;;
  3)
    echo "Gate FASE 3: TESTER + DOCS + SMOKE + REVIEWER"
    check_agent "TESTER" || exit 1
    check_agent "DOCS" || exit 1
    check_agent "SMOKE" || exit 1
    check_agent "REVIEWER" || exit 1
    echo "✅ Gate FASE 3 satisfeito"
    ;;
  *)
    echo "Fase desconhecida: $PHASE"
    exit 1
    ;;
esac

exit 0
