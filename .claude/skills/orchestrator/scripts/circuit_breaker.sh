#!/usr/bin/env bash
# circuit_breaker.sh — Circuit breaker with exponential backoff for orchestrator agents
# Part of: SPEC-071-V2 (ORCHESTRATOR v2)
# Usage: bash circuit_breaker.sh <agent_id> <max_retries> <command> [args...]
# Max retries default: 3
# Backoff: 2^attempt seconds (2s, 4s, 8s)

set -euo pipefail

AGENT_ID="${1:-}"
MAX_RETRIES="${2:-3}"
COMMAND="${3:-}"
shift 3
ARGS=("$@")

if [[ -z "$AGENT_ID" ]] || [[ -z "$COMMAND" ]]; then
  echo "Usage: circuit_breaker.sh <agent_id> <max_retries> <command> [args...]" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
LOGS_DIR="$ROOT_DIR/skills/orchestrator/logs"
mkdir -p "$LOGS_DIR"

LOG_FILE="$LOGS_DIR/${AGENT_ID}.log"
DLQ_FILE="$LOGS_DIR/${AGENT_ID}.dlq"

ATTEMPT=0
LAST_EXIT=0

echo "[circuit_breaker] $AGENT_ID: max_retries=$MAX_RETRIES, command=$COMMAND ${ARGS[*]:-}"

while (( ATTEMPT <= MAX_RETRIES )); do
  (( ATTEMPT++ ))

  if (( ATTEMPT > 1 )); then
    BACKOFF=$((2 ** (ATTEMPT - 1)))
    echo "[circuit_breaker] $AGENT_ID: attempt $ATTEMPT failed, retrying in ${BACKOFF}s (backoff=2^$((ATTEMPT-1)))"
    sleep "$BACKOFF"
  fi

  echo "[circuit_breaker] $AGENT_ID: attempt $ATTEMPT of $((MAX_RETRIES+1))"

  # Execute the command
  set +e
  "$COMMAND" "${ARGS[@]}" >> "$LOG_FILE" 2>&1
  LAST_EXIT=$?
  set -e

  if [[ $LAST_EXIT -eq 0 ]]; then
    echo "[circuit_breaker] $AGENT_ID: attempt $ATTEMPT succeeded"
    rm -f "$DLQ_FILE"
    exit 0
  else
    echo "[circuit_breaker] $AGENT_ID: attempt $ATTEMPT failed with exit $LAST_EXIT"
  fi

  # If max retries reached, record in DLQ
  if (( ATTEMPT > MAX_RETRIES )); then
    echo "[circuit_breaker] $AGENT_ID: all $MAX_RETRIES retries exhausted — sending to DLQ"
    bash "$SCRIPT_DIR/dead_letter.sh" "$AGENT_ID" "$LAST_EXIT" "$LOG_FILE"
    exit $LAST_EXIT
  fi
done

# Should never reach here
exit $LAST_EXIT
