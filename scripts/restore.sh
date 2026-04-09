#!/usr/bin/env bash
# restore.sh — Restore monorepo from a backup
# Usage: bash /srv/monorepo/scripts/restore.sh <backup-name>
#   e.g.:  bash /srv/monorepo/scripts/restore.sh monorepo-2026-04-08-143022
set -euo pipefail

if [ $# -lt 1 ]; then
    echo "Usage: $0 <backup-name>"
    echo "Available backups:"
    ls -dt /srv/backups/monorepo/monorepo-* 2>/dev/null || echo "  (none found)"
    exit 1
fi

BACKUP_NAME="$1"
BACKUP_DIR="/srv/backups/monorepo"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_NAME"
TIMESTAMP=$(date '+%Y-%m-%d-%H%M%S')
LOG_PREFIX="[restore ${TIMESTAMP}]"
LOG_FILE="${LOG_FILE:-/srv/ops/logs/restore.log}"

log() { echo "$LOG_PREFIX $1" | tee -a "$LOG_FILE"; }
ok()  { echo "$LOG_PREFIX ✅ $1" | tee -a "$LOG_FILE"; }
fail(){ echo "$LOG_PREFIX ❌ $1" | tee -a "$LOG_FILE"; exit 1; }

if [ ! -d "$BACKUP_PATH" ]; then
    fail "Backup not found: $BACKUP_PATH"
fi

log "Starting restore from $BACKUP_NAME"

# ── Snapshot before restore ────────────────────────────────────
log "Creating ZFS snapshot before restore..."
sudo zfs snapshot -r tank@restore-pre-${TIMESTAMP} 2>&1 || log "Snapshot skipped (not fatal)"

# ── Restore git bundle ──────────────────────────────────────────
log "Restoring git bundle..."
if [ -f "$BACKUP_PATH/git.bundle" ]; then
    cd /srv/monorepo
    git bundle verify "$BACKUP_PATH/git.bundle" 2>&1 | tee -a "$LOG_FILE" || log "Bundle verify warning"
    # Extract bundle into a temp ref
    git fetch "$BACKUP_PATH/git.bundle" '+refs/heads/*:refs/heads/backup/*' 2>&1 | tee -a "$LOG_FILE" || log "Bundle fetch partial"
    ok "Git bundle restored to backup/* refs"
else
    log "No git bundle found in backup"
fi

# ── Restore configs ─────────────────────────────────────────────
log "Restoring configs..."
cp -f "$BACKUP_PATH/package.json" /srv/monorepo/package.json
cp -f "$BACKUP_PATH/turbo.json" /srv/monorepo/turbo.json 2>/dev/null || true
cp -f "$BACKUP_PATH/biome.json" /srv/monorepo/biome.json 2>/dev/null || true
cp -f "$BACKUP_PATH/pnpm-workspace.yaml" /srv/monorepo/pnpm-workspace.yaml 2>/dev/null || true
cp -f "$BACKUP_PATH/package-lock.json" /srv/monorepo/package-lock.json 2>/dev/null || true
ok "Configs restored"

# ── Restore apps and packages ──────────────────────────────────
log "Restoring apps..."
rsync -a --delete "$BACKUP_PATH/apps/" /srv/monorepo/apps/ 2>&1 | tee -a "$LOG_FILE" || fail "Apps restore failed"
log "Restoring packages..."
rsync -a --delete "$BACKUP_PATH/packages/" /srv/monorepo/packages/ 2>&1 | tee -a "$LOG_FILE" || fail "Packages restore failed"

# ── Restore docs and scripts ────────────────────────────────────
log "Restoring docs..."
rsync -a --delete "$BACKUP_PATH/docs/" /srv/monorepo/docs/ 2>&1 | tee -a "$LOG_FILE" || log "Docs restore partial"
log "Restoring scripts..."
rsync -a --delete "$BACKUP_PATH/scripts/" /srv/monorepo/scripts/ 2>&1 | tee -a "$LOG_FILE" || log "Scripts restore partial"

# ── Reinstall deps ──────────────────────────────────────────────
log "Reinstalling dependencies..."
cd /srv/monorepo
yarn install 2>&1 | tee -a "$LOG_FILE" || fail "yarn install failed"

ok "Restore complete from $BACKUP_NAME"
log "Restore done at $(date '+%Y-%m-%d %H:%M:%S')"
echo "$LOG_PREFIX To switch to restored branch: git checkout -f <branch>"
