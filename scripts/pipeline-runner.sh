#!/usr/bin/env bash
set -euo pipefail

STATE_FILE="tasks/pipeline-state.json"
TASK_ID=${1:-"manual-$(date +%s)"}

update_state() {
  local new_state=$1
  jq --arg s "$new_state" --arg t "$TASK_ID" --arg ts "$(date -Iseconds)" \
    '.currentState = $s | .currentTask = $t | .lastCheckpoint = $ts' \
    "$STATE_FILE" > /tmp/ps.tmp && mv /tmp/ps.tmp "$STATE_FILE"
  echo "[$(date +%H:%M:%S)] → $new_state | task: $TASK_ID"
}

run_tests() {
  echo "🧪 Rodando testes..."
  if pnpm turbo test --no-cache 2>&1; then
    update_state "TEST_PASSED"
    return 0
  else
    update_state "TEST_FAILED"
    return 1
  fi
}

run_lint() {
  echo "🔍 Rodando lint..."
  if pnpm turbo lint 2>&1; then
    update_state "LINT_PASSED"
    return 0
  else
    update_state "LINT_FAILED"
    return 1
  fi
}

echo "🚀 Pipeline iniciado: $TASK_ID"
update_state "RUNNING"
run_lint
run_tests
update_state "READY_TO_SHIP"
echo "✅ Pipeline completo. Pronto para push."
