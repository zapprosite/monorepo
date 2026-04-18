#!/usr/bin/env bash
# trace_id.sh — Generate and manage trace IDs per pipeline run
# Part of: SPEC-071-V3 (OBSERVABILITY LAYER)
# Usage: trace_id.sh [get|new|export] [pipeline_id]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
TRACE_DIR="$ROOT_DIR/.claude/skills/orchestrator/traces"
mkdir -p "$TRACE_DIR"

ACTION="${1:-get}"
PIPELINE_ID="${2:-default}"

generate_trace_id() {
  python3 -c "import uuid; print(str(uuid.uuid4()))"
}

get_trace_file() {
  echo "$TRACE_DIR/${PIPELINE_ID}.trace"
}

case "$ACTION" in
  new)
    TRACE_ID=$(generate_trace_id)
    TRACE_FILE=$(get_trace_file)
    echo "$TRACE_ID" > "$TRACE_FILE"
    echo "$TRACE_ID"
    echo "[trace_id] new trace for pipeline $PIPELINE_ID: $TRACE_ID"
    ;;
  get)
    TRACE_FILE=$(get_trace_file)
    if [[ -f "$TRACE_FILE" ]]; then
      cat "$TRACE_FILE"
    else
      # Auto-generate if not exists
      TRACE_ID=$(generate_trace_id)
      echo "$TRACE_ID" > "$TRACE_FILE"
      echo "$TRACE_ID"
    fi
    ;;
  export)
    TRACE_ID=$(bash "$0" get "$PIPELINE_ID")
    export TRACELINE_TRACE_ID="$TRACE_ID"
    echo "TRACELINE_TRACE_ID=$TRACE_ID"
    ;;
  *)
    echo "Usage: trace_id.sh [get|new|export] [pipeline_id]" >&2
    exit 1
    ;;
esac
