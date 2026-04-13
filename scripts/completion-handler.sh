#!/bin/bash
# Completion Handler — End of Feature Automation
# Runs after successful SPEC execution
# commit → PR → sync → /clear → new branch

set -e

TIMESTAMP=$(date +%s)
RANDOM_HEX=$(openssl rand -hex 3)
LOG_FILE="/tmp/completion-handler.log"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG_FILE"; }

# Check for /clear flag from context monitor
if [ -f /tmp/context-high-flag ]; then
    log "Context HIGH flag detected - /clear will be called"
fi

log "🚀 Completion Handler started"

# 1. Commit all changes
log "1. Git commit..."
git add -A

COMMIT_MSG="feat(auto): $(cat /srv/monorepo/docs/SPECS/SPEC-AUTO-*.md 2>/dev/null | head -3 | grep -E '^#' | head -1 | sed 's/^#* //' || echo 'automated feature completion')"

git commit -m "$COMMIT_MSG" --allow-empty 2>/dev/null || log "Nothing to commit (normal if no changes)"

# 2. Push
log "2. Git push..."
git push --force-with-lease origin HEAD 2>/dev/null || log "Push failed or nothing to push"

# 3. Create PR (if not main branch)
CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "main")
if [ "$CURRENT_BRANCH" != "main" ] && [ -n "$CURRENT_BRANCH" ]; then
    log "3. Creating PR for branch: $CURRENT_BRANCH"
    gh pr create --title "[auto] $COMMIT_MSG" --body "Auto-generated PR from SPEC-AUTOMATOR pipeline" 2>/dev/null || log "PR creation skipped (no gh or already exists)"
fi

# 4. Sync AI-CONTEXT
log "4. AI-CONTEXT sync..."
bash /home/will/.claude/mcps/ai-context-sync/sync.sh 2>/dev/null || log "Sync failed"

# 5. /clear — Note: must be triggered from Claude Code CLI, not bash
# The signal is set via /tmp/clear-requested flag
echo "$(date +%s)" > /tmp/clear-requested
log "5. /clear signal set (Claude Code CLI will see this on next prompt)"

# 6. Create new random branch
NEW_BRANCH="feat/${TIMESTAMP}-${RANDOM_HEX}"
log "6. Creating new branch: $NEW_BRANCH"
git checkout -b "$NEW_BRANCH" 2>/dev/null || log "Branch creation failed or already exists"

log "✅ Completion Handler finished"
log "Ready for next /auto-spec [idea]"