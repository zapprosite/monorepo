#!/usr/bin/env bash
# agent-wrapper.sh — Wrapper per agent: claim task → execute → mark done
# Usage: bash agent-wrapper.sh <AGENT_ID> <COMMAND> <SPEC_FILE>
# Example: bash agent-wrapper.sh RESEARCH-1 "Research task" docs/SPECS/SPEC-042.md

set -euo pipefail

AGENT_ID="$1"
COMMAND="$2"
SPEC_FILE="$3"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")")"
AGENT_STATE_DIR="$ROOT_DIR/tasks/agent-states"
LOGS_DIR="$ROOT_DIR/.claude/skills/orchestrator/logs"

mkdir -p "$AGENT_STATE_DIR" "$LOGS_DIR"

STATE_FILE="$AGENT_STATE_DIR/${AGENT_ID}.json"
LOG_FILE="$LOGS_DIR/${AGENT_ID}.log"

# V2: Reentrancy lock — prevent same agent from running twice in same pipeline
PIPELINE_ID="$(basename "$SPEC_FILE" .md)"
if ! bash "$SCRIPT_DIR/reentrancy_lock.sh" "$AGENT_ID" "$PIPELINE_ID"; then
  echo "[$AGENT_ID] ABORTED: already running (reentrancy lock held)" >&2
  exit 99
fi

# V4: State snapshot before agent runs (for rollback capability)
echo "[$AGENT_ID] Creating pre-run snapshot..."
if bash "$SCRIPT_DIR/snapshot.sh" "$AGENT_ID" "$PIPELINE_ID"; then
  echo "[$AGENT_ID] Snapshot created"
else
  echo "[$AGENT_ID] WARNING: snapshot failed (rollback may be unavailable)" >&2
fi

# ─── Special handling per agent type ───────────────────────────────────────
case "$AGENT_ID" in
  SHIPPER)
    echo "Waiting for all agents to complete before SHIPPER can proceed..."
    bash "$SCRIPT_DIR/wait-for-completion.sh" || true
    echo "All agents completed. SHIPPER proceeding..."
    ;;
esac

# ─── Execute via Claude Code CLI ────────────────────────────────────────────
echo "[$AGENT_ID] Starting at $(date)"
echo "[$AGENT_ID] Command: $COMMAND"
echo "[$AGENT_ID] SPEC: $SPEC_FILE"

EXIT_CODE=0

# Build the research task prompt
TASK_PROMPT="You are the $AGENT_ID agent conducting research for an enterprise refactor.

SPEC FILE: $SPEC_FILE
SPEC CONTENT:
$(cat "$SPEC_FILE" 2>/dev/null || echo "SPEC file not found")

YOUR RESEARCH FOCUS: $COMMAND

Research thoroughly and provide a structured report with:
1. Key findings (April 2026 best practices)
2. Specific recommendations for CLAUDE.md or AGENTS.md
3. Code/examples where applicable
4. What to add/update/delete

Output your findings as a concise report to: $ROOT_DIR/research/${AGENT_ID}.md

IMPORTANT: Write the report to the file path specified above."

# Execute via claude -p (print/non-interactive mode)
echo "$TASK_PROMPT" | claude -p 2>&1 | tee "$LOG_FILE" || EXIT_CODE=${PIPESTATUS[0]}

# ─── Mark as completed or failed ──────────────────────────────────────────
if [[ $EXIT_CODE -eq 0 ]]; then
  STATUS="completed"
  echo "[$AGENT_ID] Completed successfully at $(date)"
else
  STATUS="failed"
  echo "[$AGENT_ID] FAILED with exit code $EXIT_CODE at $(date)" >&2
  # V2: Record in Dead Letter Queue
  bash "$SCRIPT_DIR/dead_letter.sh" "$AGENT_ID" "$EXIT_CODE" "$LOG_FILE" || true

  # V4: Offer rollback on failure
  echo "[$AGENT_ID] FAILED — available rollback:"
  echo "  bash rollback.sh --agent=$AGENT_ID --to=$PIPELINE_ID"
fi

cat > "$STATE_FILE" <<EOF
{
  "agent": "$AGENT_ID",
  "spec": "$(basename "$SPEC_FILE" .md)",
  "status": "$STATUS",
  "exit_code": $EXIT_CODE,
  "started": "$(jq -r '.started' "$STATE_FILE" 2>/dev/null || echo "")",
  "finished": "$(date -Iseconds)",
  "command": "$COMMAND",
  "log": "$LOG_FILE"
}
EOF

exit $EXIT_CODE
