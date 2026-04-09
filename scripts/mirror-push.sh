#!/usr/bin/env bash
# mirror-push.sh — Push current branch to both Gitea and GitHub remotes
# Usage: bash /srv/monorepo/scripts/mirror-push.sh
set -euo pipefail

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_PREFIX="[mirror-push ${TIMESTAMP}]"
LOG_FILE="${LOG_FILE:-/srv/ops/logs/mirror-push.log}"

log() { echo "$LOG_PREFIX $1" | tee -a "$LOG_FILE"; }
ok()  { echo "$LOG_PREFIX ✅ $1" | tee -a "$LOG_FILE"; }
fail(){ echo "$LOG_PREFIX ❌ $1" | tee -a "$LOG_FILE"; exit 1; }

cd /srv/monorepo

# ── Verify remotes ──────────────────────────────────────────────
log "Verifying remotes..."
GITEA_OK=0
GITHUB_OK=0

if git remote -v | grep -q "gitea.*127.0.0.1:2222"; then
    log "Gitea remote configured"
    GITEA_OK=1
else
    fail "Gitea remote not found"
fi

if git remote -v | grep -q "github.com.*zapprosite"; then
    log "GitHub remote configured"
    GITHUB_OK=1
else
    fail "GitHub remote not found"
fi

# ── Verify SSH to Gitea ─────────────────────────────────────────
log "Verifying SSH to Gitea..."
if ssh -o BatchMode=yes -o ConnectTimeout=5 git@127.0.0.1 -p 2222 echo "OK" 2>/dev/null | grep -q "OK"; then
    ok "Gitea SSH OK"
else
    fail "Cannot connect to Gitea via SSH. Is the key loaded? Run: ssh-add ~/.ssh/id_ed25519"
fi

# ── Verify GitHub CLI auth ──────────────────────────────────────
log "Verifying GitHub CLI auth..."
if gh auth status 2>&1 | grep -q "Logged in"; then
    ok "GitHub CLI authenticated"
else
    log "GitHub CLI not authenticated (PR creation may fail)"
fi

# ── Get current branch ──────────────────────────────────────────
BRANCH=$(git branch --show-current)
if [ -z "$BRANCH" ]; then
    BRANCH=$(git rev-parse --abbrev-ref HEAD)
fi
log "Current branch: $BRANCH"

# ── Safety check: never mirror main/master ─────────────────────
if [[ "$BRANCH" == "main" || "$BRANCH" == "master" ]]; then
    fail "Refusing to mirror main/master directly. Use a feature branch."
fi

# ── Push to Gitea ───────────────────────────────────────────────
log "Pushing to Gitea..."
if git push --force-with-lease gitea HEAD 2>&1 | tee -a "$LOG_FILE"; then
    ok "Pushed to Gitea"
else
    fail "Failed to push to Gitea"
fi

# ── Push to GitHub ──────────────────────────────────────────────
log "Pushing to GitHub..."
if git push --force-with-lease origin HEAD 2>&1 | tee -a "$LOG_FILE"; then
    ok "Pushed to GitHub"
else
    fail "Failed to push to GitHub"
fi

ok "Mirror push complete: $BRANCH → gitea + origin"
log "Done at $(date '+%Y-%m-%d %H:%M:%S')"
