#!/usr/bin/env bash
# review-pr.sh — Claude Code CLI code review for a Gitea PR
# Usage: ./review-pr.sh https://gitea.zappro.site/owner/repo/pulls/123

set -euo pipefail

PR_URL="${1:-}"
if [[ -z "$PR_URL" ]]; then
  echo "Usage: $0 <pr-url>"
  exit 1
fi

# Extract repo info from PR URL
# Format: https://gitea.zappro.site/owner/repo/pulls/123
REPO_SLUG=$(echo "$PR_URL" | sed -E 's|https?://[^/]+/([^/]+/[^/]+)/pulls/.*|\1|')
PR_NUMBER=$(echo "$PR_URL" | sed -E 's|.*pulls/([0-9]+).*|\1|')

echo "Reviewing PR #$PR_NUMBER from $REPO_SLUG..."

claude --print "$(cat <<'EOF'
Review the code changes in this PR. Focus on:
1. Correctness — does it do what it claims?
2. Security — secrets, injection, auth issues?
3. Performance — N+1, unbounded ops, memory leaks?
4. Readability — clear names, simple logic?

Be concise. Output a summary with specific file:line references for critical issues.
EOF
)"
