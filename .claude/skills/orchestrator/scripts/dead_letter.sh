#!/usr/bin/env bash
# dead_letter.sh — Dead Letter Queue for failed orchestrator agents
# Part of: SPEC-071-V2 (ORCHESTRATOR v2)
# Usage: bash dead_letter.sh <agent_id> <exit_code> <log_file>
# DLQ file: .claude/skills/orchestrator/dLQ/<agent_id>.json

set -euo pipefail

AGENT_ID="${1:-}"
EXIT_CODE="${2:-1}"
LOG_FILE="${3:-}"

if [[ -z "$AGENT_ID" ]]; then
  echo "Usage: dead_letter.sh <agent_id> <exit_code> <log_file>" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
DLQ_DIR="$ROOT_DIR/skills/orchestrator/dlq"
mkdir -p "$DLQ_DIR"

DLQ_FILE="$DLQ_DIR/${AGENT_ID}.json"
TIMESTAMP=$(date -Iseconds)

# Count previous failures for this agent
PREV_FAILURES=0
if [[ -f "$DLQ_FILE" ]]; then
  PREV_FAILURES=$(python3 -c "import json; d=json.load(open('$DLQ_FILE')); print(len(d.get('attempts',[])))" 2>/dev/null || echo "0")
fi

# Append new failure
python3 << PYEOF
import json, sys

dlq_file = "$DLQ_FILE"
log_file = "$LOG_FILE"
agent_id = "$AGENT_ID"
exit_code = $EXIT_CODE
timestamp = "$TIMESTAMP"

attempt = {
    "timestamp": timestamp,
    "exit_code": exit_code,
    "log_file": log_file,
}

dlq = {"agent_id": agent_id, "attempts": []}
if __import__("os").path.exists(dlq_file):
    try:
        with open(dlq_file) as f:
            dlq = json.load(f)
    except:
        pass

dlq["attempts"].append(attempt)
dlq["last_failure"] = timestamp
dlq["total_failures"] = len(dlq["attempts"])

# Keep last 10 attempts max
dlq["attempts"] = dlq["attempts"][-10:]

with open(dlq_file, "w") as f:
    json.dump(dlq, f, indent=2)

print(f"[dead_letter] $AGENT_ID: recorded failure #{dlq['total_failures']} to $DLQ_FILE")
if dlq["total_failures"] >= 3:
    print(f"[dead_letter] $AGENT_ID: DLQ threshold reached (3 failures) — manual intervention required")
PYEOF

exit 0
