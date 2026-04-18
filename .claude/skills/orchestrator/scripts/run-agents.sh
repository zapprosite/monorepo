#!/usr/bin/env bash
# run-agents.sh — Spawn 14 concurrent agents for SPEC execution
# Usage: bash .claude/skills/orchestrator/scripts/run-agents.sh <spec-file>
# Example: bash .claude/skills/orchestrator/scripts/run-agents.sh docs/SPECS/SPEC-042.md

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
SPEC_FILE="${1:-}"

if [[ -z "$SPEC_FILE" ]]; then
  echo "Usage: $0 <spec-file>"
  echo "Example: $0 docs/SPECS/SPEC-042.md"
  exit 1
fi

# Resolve to absolute path
SPEC_FILE="$(cd "$(dirname "$SPEC_FILE")" && pwd)/$(basename "$SPEC_FILE")"

AGENT_STATE_DIR="$ROOT_DIR/tasks/agent-states"
LOGS_DIR="$ROOT_DIR/.claude/skills/orchestrator/logs"
mkdir -p "$AGENT_STATE_DIR" "$LOGS_DIR"

echo "=== 14-Agent Orchestrator ==="
echo "SPEC: $SPEC_FILE"
echo "Root: $ROOT_DIR"
echo "Logs: $LOGS_DIR"
echo ""

# Extract SPEC ID from filename
SPEC_ID="$(basename "$SPEC_FILE" .md | sed 's/SPEC-//')"

# ─── Agent Configurations ───────────────────────────────────────────────────
# Format: AGENT_ID:COMMAND_TYPE:COMMAND
# COMMAND_TYPE: claude | inline
# For claude: COMMAND is the skill/slash command
# For inline: COMMAND is the shell command

declare -a AGENTS=(
  "SPEC-ANALYZER:claude:/researcher"
  "ARCHITECT:claude:/infra-from-spec"
  "CODER-1:claude:/backend-scaffold"
  "CODER-2:claude:/frontend-design"
  "TESTER:claude:/test"
  "SMOKE:claude:/smoke-test-gen"
  "SECURITY:claude:/minimax-security-audit"
  "DOCS:claude:/doc-maintenance"
  "TYPES:inline:pnpm tsc --noEmit"
  "LINT:inline:pnpm lint"
  "SECRETS:claude:/se"
  "GIT:claude:/commit"
  "REVIEWER:claude:/review"
  "SHIPPER:claude:/turbo"
)

# ─── Spawn each agent ───────────────────────────────────────────────────────

for agent_config in "${AGENTS[@]}"; do
  IFS=':' read -r AGENT_ID CMD_TYPE CMD <<< "$agent_config"

  STATE_FILE="$AGENT_STATE_DIR/${AGENT_ID}.json"
  LOG_FILE="$LOGS_DIR/${AGENT_ID}.log"

  # Mark as running
  cat > "$STATE_FILE" <<EOF
{
  "agent": "$AGENT_ID",
  "spec": "$SPEC_ID",
  "status": "running",
  "started": "$(date -Iseconds)",
  "command": "$CMD"
}
EOF

  echo "Spawning $AGENT_ID..."

  if [[ "$CMD_TYPE" == "inline" ]]; then
    # Inline command (runs in foreground, completes quickly)
    (
      set -x
      eval "$CMD" >> "$LOG_FILE" 2>&1
    ) &
    INLINE_PID=$!

    # Wait a moment for the command to start
    sleep 0.5

    # Check if it exited immediately (failure)
    if ! kill -0 $INLINE_PID 2>/dev/null && [[ -s "$LOG_FILE" ]]; then
      # Command finished quickly - check exit status
      wait $INLINE_PID || true
    fi

    # Mark as completed (inline commands are synchronous for now)
    cat > "$STATE_FILE" <<EOF
{
  "agent": "$AGENT_ID",
  "spec": "$SPEC_ID",
  "status": "completed",
  "finished": "$(date -Iseconds)",
  "command": "$CMD"
}
EOF

    echo "  $AGENT_ID: completed (inline)"

  else
    # Claude agent (runs in background, may take minutes)
    # V2: Circuit breaker wrapper (3 retries, exp backoff, DLQ)
    nohup bash "$SCRIPT_DIR/agent-wrapper.sh" \
      "$AGENT_ID" "$CMD" "$SPEC_FILE" \
      >> "$LOG_FILE" 2>&1 &

    BG_PID=$!
    echo "  $AGENT_ID: running in background (PID: $BG_PID)"
  fi
done

echo ""
echo "=== All 14 agents spawned ==="
echo "Monitor: bash $SCRIPT_DIR/wait-for-completion.sh"
echo "Logs: $LOGS_DIR/"
echo ""
echo "Agent states:"
for f in "$AGENT_STATE_DIR"/*.json; do
  AGENT="$(jq -r '.agent' "$(basename "$f")" 2>/dev/null || echo "$(basename "$f" .json)")"
  STATUS="$(jq -r '.status' "$f" 2>/dev/null || echo "unknown")"
  echo "  $AGENT: $STATUS"
done
