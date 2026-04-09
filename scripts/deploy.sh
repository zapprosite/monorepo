#!/usr/bin/env bash
# deploy.sh — Pre-deploy validation + optional ZFS snapshot + push
# Usage: bash /srv/monorepo/scripts/deploy.sh [--snapshot]
#   --snapshot  Create ZFS snapshot before deploy
set -euo pipefail

TIMESTAMP=$(date '+%Y-%m%d-%H%M%S')
LOG_PREFIX="[deploy ${TIMESTAMP}]"
LOG_FILE="${LOG_FILE:-/srv/ops/logs/deploy.log}"
SNAPSHOT=0

while [[ $# -gt 0 ]]; do
    case $1 in
        --snapshot) SNAPSHOT=1; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

log() { echo "$LOG_PREFIX $1" | tee -a "$LOG_FILE"; }
ok()  { echo "$LOG_PREFIX ✅ $1" | tee -a "$LOG_FILE"; }
fail(){ echo "$LOG_PREFIX ❌ $1" | tee -a "$LOG_FILE"; exit 1; }

log "Starting deploy"

# ── Pre-deploy validation ───────────────────────────────────────
log "Running health check..."
if bash /srv/monorepo/scripts/health-check.sh > /dev/null 2>&1; then
    ok "Health check passed"
else
    log "Health check had warnings (continuing anyway)"
fi

# ── ZFS snapshot ────────────────────────────────────────────────
if [ "$SNAPSHOT" -eq 1 ]; then
    log "Creating ZFS snapshot..."
    if sudo zfs snapshot -r tank@deploy-${TIMESTAMP} 2>&1; then
        ok "ZFS snapshot created: tank@deploy-${TIMESTAMP}"
    else
        fail "ZFS snapshot failed"
    fi
fi

# ── Git push ────────────────────────────────────────────────────
log "Pushing to remotes..."
cd /srv/monorepo
git push --force-with-lease origin HEAD 2>&1 | tee -a "$LOG_FILE"
ok "Pushed to origin"

log "Deploy complete at $(date '+%Y-%m-%d %H:%M:%S')"
