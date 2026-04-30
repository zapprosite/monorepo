#!/bin/bash
# context-reset.sh — Reset LLM context per task (GCC-inspired)
# Usage: context-reset.sh <task_id>
set -euo pipefail

TASK_ID="${1:-}"
if [ -z "$TASK_ID" ]; then
    echo "Usage: context-reset.sh <task_id>" >&2
    exit 1
fi

WORKDIR="/srv/monorepo/.claude/vibe-kit"
CONTEXT_DIR="$WORKDIR/context"
QUEUE_FILE="$WORKDIR/queue.json"

# Create task-specific context directory
TASK_CONTEXT="$CONTEXT_DIR/$TASK_ID"
mkdir -p "$TASK_CONTEXT"

# Load task description from queue
TASK_JSON=$(python3 -c "
import json, sys
with open('$QUEUE_FILE') as f:
    q = json.load(f)
for t in q.get('tasks', []):
    if t.get('id') == '$TASK_ID':
        print(json.dumps(t))
        sys.exit(0)
print('null')
" 2>/dev/null)

if [ "$TASK_JSON" = "null" ] || [ -z "$TASK_JSON" ]; then
    echo "ERROR: Task $TASK_ID not found in queue" >&2
    exit 1
fi

# Write task prompt
TASK_NAME=$(echo "$TASK_JSON" | jq -r '.name // "unnamed"')
TASK_DESC=$(echo "$TASK_JSON" | jq -r '.description // ""')
APP=$(echo "$TASK_JSON" | jq -r '.app // ""')
SPEC=$(echo "$TASK_JSON" | jq -r '.spec // ""')

cat > "$TASK_CONTEXT/prompt.md" <<EOF
# Task: $TASK_ID — $TASK_NAME

**APP:** $APP
**SPEC:** $SPEC
**DESCRIPTION:** $TASK_DESC

Working directory: /srv/monorepo

Execute the task completely. When done, save milestone to commit.md and full trace to log.md.
EOF

# Initialize log.md
cat > "$TASK_CONTEXT/log.md" <<EOF
# Trace — $TASK_ID
Started: $(date -u +%Y-%m-%dT%H:%M:%SZ)
EOF

# Initialize commit.md
cat > "$TASK_CONTEXT/commit.md" <<EOF
# Milestone — $TASK_ID
EOF

# Clear any stale conversation marker
echo "$TASK_ID" > "$WORKDIR/.active_task"

echo "Context reset for task $TASK_ID → $TASK_CONTEXT"
exit 0