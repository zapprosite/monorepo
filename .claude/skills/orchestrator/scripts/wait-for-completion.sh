#!/usr/bin/env bash
# wait-for-completion.sh — Poll agent-states/ until all agents complete or fail
# Usage: bash wait-for-completion.sh [timeout-seconds]
# Default timeout: 3600s (1 hour)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
AGENT_STATE_DIR="$ROOT_DIR/tasks/agent-states"

TIMEOUT="${1:-3600}"
INTERVAL=10
ELAPSED=0

AGENTS=(
  "SPEC-ANALYZER"
  "ARCHITECT"
  "CODER-1"
  "CODER-2"
  "TESTER"
  "SMOKE"
  "SECURITY"
  "DOCS"
  "TYPES"
  "LINT"
  "SECRETS"
  "GIT"
  "REVIEWER"
  "SHIPPER"
)

echo "=== Waiting for all 14 agents to complete ==="
echo "Timeout: ${TIMEOUT}s"
echo "Polling interval: ${INTERVAL}s"
echo ""

check_agents() {
  local running=0
  local completed=0
  local failed=0
  local unknown=0

  for agent in "${AGENTS[@]}"; do
    state_file="$AGENT_STATE_DIR/${agent}.json"
    if [[ ! -f "$state_file" ]]; then
      ((unknown++))
      echo "  $agent: NOT_STARTED"
      continue
    fi

    status="$(jq -r '.status' "$state_file" 2>/dev/null || echo "unknown")"

    case "$status" in
      running)
        ((running++))
        echo "  $agent: RUNNING"
        ;;
      completed)
        ((completed++))
        echo "  $agent: COMPLETED"
        ;;
      failed)
        ((failed++))
        echo "  $agent: FAILED"
        ;;
      *)
        ((unknown++))
        echo "  $agent: UNKNOWN ($status)"
        ;;
    esac
  done

  return $((running + unknown))
}

while true; do
  if ! check_agents; then
    echo ""
    echo "Still running or unknown agents..."
  else
    echo ""
    echo "=== All agents have completed ==="
    break
  fi

  if [[ $ELAPSED -ge $TIMEOUT ]]; then
    echo ""
    echo "TIMEOUT: $TIMEOUT seconds elapsed"
    exit 1
  fi

  ELAPSED=$((ELAPSED + INTERVAL))
  sleep $INTERVAL
done

# ─── Summary ────────────────────────────────────────────────────────────────
echo ""
echo "=== Agent Summary ==="
CRITICAL_FAILED=0
IMPORTANT_FAILED=0

CRITICAL_AGENTS=("CODER-1" "CODER-2")
IMPORTANT_AGENTS=("TESTER" "SECURITY")

for agent in "${AGENTS[@]}"; do
  state_file="$AGENT_STATE_DIR/${agent}.json"
  if [[ -f "$state_file" ]]; then
    status="$(jq -r '.status' "$state_file" 2>/dev/null)"
    if [[ "$status" == "failed" ]]; then
      echo "  $agent: FAILED"
      if [[ " ${CRITICAL_AGENTS[*]} " == *" $agent "* ]]; then
        ((CRITICAL_FAILED++))
      elif [[ " ${IMPORTANT_AGENTS[*]} " == *" $agent "* ]]; then
        ((IMPORTANT_FAILED++))
      fi
    else
      echo "  $agent: OK"
    fi
  fi
done

echo ""
if [[ $CRITICAL_FAILED -gt 0 ]]; then
  echo "BLOCKING: $CRITICAL_FAILED critical agents failed"
  echo "PR will NOT be created."
  exit 1
elif [[ $IMPORTANT_FAILED -gt 0 ]]; then
  echo "WARNING: $IMPORTANT_FAILED important agents failed"
  echo "PR will proceed with warnings."
else
  echo "All agents completed successfully."
  echo "Ready for SHIPPER to create PR."
fi

exit 0
