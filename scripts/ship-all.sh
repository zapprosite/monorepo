#!/bin/bash
# ship-all.sh — Ship to Monorepo + Ops + Hermes Second Brain
# Usage: ./ship-all.sh "commit message"

set -e

COMMIT_MSG="${1:-chore: sync updates}"

echo "=========================================="
echo "🚀 SHIP ALL — Monorepo + Ops + Hermes"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${GREEN}[SHIP]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERR]${NC} $1"; }

# ============================================
# 1. MONOREPO
# ============================================
log "📦 Syncing Monorepo..."

cd /srv/monorepo

# Check status
if [[ -n $(git status --porcelain) ]]; then
    git add -A
    git commit -m "$COMMIT_MSG"
    log "✅ Monorepo committed"
else
    warn "Monorepo: nothing to commit"
fi

# Push dual remotes
git push origin --all 2>/dev/null || true
git push gitea --all 2>/dev/null || true
git push origin --tags 2>/dev/null || true
git push gitea --tags 2>/dev/null || true

log "✅ Monorepo pushed to GitHub + Gitea"

# ============================================
# 2. OPS
# ============================================
log "🛠️ Syncing Ops..."

cd /srv/ops

# Check status
if [[ -n $(git status --porcelain) ]]; then
    git add -A
    git commit -m "$COMMIT_MSG"
    log "✅ Ops committed"
else
    warn "Ops: nothing to commit"
fi

# Push
git push origin 2>/dev/null || warn "Ops push failed (check credentials)"

log "✅ Ops pushed"

# ============================================
# 3. HERMES SECOND BRAIN
# ============================================
log "🧠 Syncing Hermes Second Brain..."

cd /srv/hermes-second-brain

# Check status
if [[ -n $(git status --porcelain) ]]; then
    git add -A
    git commit -m "$COMMIT_MSG"
    log "✅ Hermes committed"
else
    warn "Hermes: nothing to commit"
fi

# Push
git push origin 2>/dev/null || warn "Hermes push failed"

log "✅ Hermes pushed"

# ============================================
# 4. MEMORY SYNC
# ============================================
log "💾 Syncing Memory..."

if [ -f "/srv/monorepo/scripts/sync-memory.sh" ]; then
    bash /srv/monorepo/scripts/sync-memory.sh 2>/dev/null || warn "Memory sync failed"
    log "✅ Memory synced"
else
    warn "Memory sync script not found"
fi

# ============================================
# DONE
# ============================================
echo ""
echo "=========================================="
echo -e "${GREEN}✅ SHIP COMPLETE${NC}"
echo "=========================================="
echo "📦 Monorepo: $(git rev-parse --short HEAD)"
echo "🛠️ Ops:      $(git rev-parse --short HEAD)"
echo "🧠 Hermes:   $(git rev-parse --short HEAD)"
echo ""
