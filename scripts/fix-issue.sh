#!/usr/bin/env bash
# fix-issue.sh — Claude Code CLI agent mode to fix a Gitea issue
# Usage: ./fix-issue.sh https://gitea.zappro.site/owner/repo/issues/456

set -euo pipefail

ISSUE_URL="${1:-}"
if [[ -z "$ISSUE_URL" ]]; then
  echo "Usage: $0 <issue-url>"
  exit 1
fi

echo "Fixing issue: $ISSUE_URL"
echo "Working in agent mode — Claude Code CLI will make changes directly."

claude --agent "$(cat <<EOF
Fix the issue described at: $ISSUE_URL

Steps:
1. Fetch the issue details from the URL
2. Understand what needs to be fixed
3. Make the necessary code changes
4. Run tests if available
5. Commit with a clear message

Report what you did when done.
EOF
)"
