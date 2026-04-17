#!/bin/bash
# PreToolUse Hook: Bash command validation
# Runs BEFORE every Bash tool execution

COMMAND="$1"

# Block dangerous patterns
DANGEROUS_PATTERNS=(
  "rm -rf /"
  "dd if=.*of=/dev/"
  "wipefs"
  ":(){ :|:& };:"  # fork bomb
  "curl.*\| *bash"  # pipe to bash
  "wget.*\| *bash"
)

for pattern in "${DANGEROUS_PATTERNS[@]}"; do
  if echo "$COMMAND" | grep -qE "$pattern"; then
    echo "ERROR: Dangerous command pattern detected: $pattern"
    echo "Command blocked by PreToolUse-Bash-validate hook"
    exit 1
  fi
done

# Check for git operations that might expose secrets
if echo "$COMMAND" | grep -qE "git.*push|git.*commit"; then
  # Run secrets scan on staged files
  if [ -d "/srv/monorepo/.git" ]; then
    cd /srv/monorepo
    # Quick secrets check before push/commit
    git diff --cached --name-only | head -20 | while read file; do
      if [ -f "$file" ]; then
        grep -l "sk-[a-zA-Z0-9]\{20,\}\|ghp_\|cfut_\|glpat-" "$file" 2>/dev/null && {
          echo "ERROR: Potential secret detected in staged file: $file"
          echo "Run /sec to audit secrets before committing"
          exit 1
        }
      fi
    done
  fi
fi

# Log for audit trail
echo "[PreToolUse-Bash] Executing: ${COMMAND:0:100}..." >&2

exit 0
