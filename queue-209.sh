#!/bin/bash
# queue-209.sh — SPEC-209: Estado da Arte final cleanup

set -e
cd /srv/monorepo

echo "=== SPEC-209: Estado da Arte Cleanup ==="

# Task 1: Merge ops to origin/main
echo "[1/4] ops-merge-to-main"
cd /srv/ops
# Create a PR or merge directly
COMMITS_AHEAD=$(git log --oneline origin/main..HEAD 2>/dev/null | wc -l)
echo "  Ops has $COMMITS_AHEAD commits ahead of origin/main"
if [ "$COMMITS_AHEAD" -gt 0 ]; then
  # Checkout main, pull, merge, push
  git checkout main
  git pull origin main
  git merge --no-edit ops/cloudflare-token-zerotrust-permissions
  git push origin main && echo "  Merged and pushed to origin/main" || echo "  Push failed (may need PR)"
  # Return to ops branch
  git checkout ops/cloudflare-token-zerotrust-permissions
fi
cd /srv/monorepo

# Task 2: Monorepo branch cleanup
echo "[2/4] monorepo-branch-cleanup"
CURRENT=$(git branch --show-current)
echo "  Current branch: $CURRENT"
if [ "$CURRENT" != "main" ]; then
  # Stash any uncommitted changes
  git stash push -m "SPEC-209 auto-stash" 2>/dev/null || true
  git checkout main
  git pull origin main
  echo "  Switched to main with clean state"
fi

# Task 3: Diverged branches report
echo "[3/4] diverged-branches-report"
echo "  Diverged branches (require manual review):"
git branch -v | grep -E "\[ahead.*behind|\[behind.*ahead\]" | grep -v "^\*"
echo "  Report: $(git branch -v | grep -E "\[ahead.*behind|\[behind.*ahead\]" | grep -v "^\*" | wc -l) branches need manual decision"

# Task 4: Cleanup
echo "[4/4] cleanup"
rm -f /srv/monorepo/SPEC-209.md /srv/monorepo/pipeline-209.json /srv/monorepo/queue-209.sh
echo "  Deleted: SPEC-209.md, pipeline-209.json, queue-209.sh"

echo ""
echo "=== SPEC-209 COMPLETE ==="
