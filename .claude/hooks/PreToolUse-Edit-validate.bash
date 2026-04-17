#!/bin/bash
# PreToolUse Hook: Edit command validation
# Runs BEFORE every Edit tool execution

FILE_PATH="$1"
OLD_STRING="$2"
NEW_STRING="$3"

# Check if file path is in allowed directories
ALLOWED_DIRS=(
  "/srv/monorepo"
  "/srv/ops/ai-governance"
)

IS_ALLOWED=0
for dir in "${ALLOWED_DIRS[@]}"; do
  if echo "$FILE_PATH" | grep -q "^$dir"; then
    IS_ALLOWED=1
    break
  fi
done

if [ $IS_ALLOWED -eq 0 ]; then
  echo "ERROR: Edit target outside allowed directories"
  echo "Allowed: ${ALLOWED_DIRS[*]}"
  exit 1
fi

# Check for potential secret leak in new string
if echo "$NEW_STRING" | grep -qE "sk-[a-zA-Z0-9]\{20,\}|ghp_[a-zA-Z0-9]+|cfut_[a-zA-Z0-9]+|glpat-[a-zA-Z0-9_-]+|AI_GATEWAY_FACADE_KEY|LITELLM_MASTER_KEY|HERMES_API_KEY"; then
  echo "WARNING: Potential secret or env var name detected in edit"
  echo "If adding an env var reference, use process.env.VAR_NAME pattern"
  echo "If hardcoding a secret value, THIS IS FORBIDDEN"
fi

# Block edits to protected files
PROTECTED_FILES=(
  "TODO.md"
  ".env"
  "secrets.json"
  "credentials.json"
)

for protected in "${PROTECTED_FILES[@]}"; do
  if echo "$FILE_PATH" | grep -qE "/$protected$"; then
    echo "ERROR: Cannot edit protected file: $protected"
    exit 1
  fi
done

# Log for audit trail
echo "[PreToolUse-Edit] Editing: ${FILE_PATH}" >&2

exit 0
