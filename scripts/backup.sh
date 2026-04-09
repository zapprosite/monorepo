#!/usr/bin/env bash
# backup.sh — Backup monorepo data, configs, and git state
# Usage: bash /srv/monorepo/scripts/backup.sh
set -euo pipefail

TIMESTAMP=$(date '+%Y-%m-%d-%H%M%S')
BACKUP_DIR="${BACKUP_DIR:-/srv/backups/monorepo}"
NAME="monorepo-${TIMESTAMP}"
DEST="$BACKUP_DIR/$NAME"
LOG_PREFIX="[backup ${TIMESTAMP}]"
LOG_FILE="${LOG_FILE:-/srv/ops/logs/backup.log}"

log() { echo "$LOG_PREFIX $1" | tee -a "$LOG_FILE"; }
ok()  { echo "$LOG_PREFIX ✅ $1" | tee -a "$LOG_FILE"; }
fail(){ echo "$LOG_PREFIX ❌ $1" | tee -a "$LOG_FILE"; exit 1; }

log "Starting backup to $DEST"

# Ensure backup dir exists
mkdir -p "$DEST"

# ── Git state ──────────────────────────────────────────────────
log "Backing up git state..."
cd /srv/monorepo
git bundle create "$DEST/git.bundle" --all 2>&1 | tee -a "$LOG_FILE" || log "Bundle failed, skipping"
ok "Git bundle done"

# ── Package files (lockfiles, configs) ──────────────────────────
log "Backing up package configs..."
cp -r /srv/monorepo/package.json "$DEST/"
cp -r /srv/monorepo/package-lock.json "$DEST/" 2>/dev/null || true
cp -r /srv/monorepo/turbo.json "$DEST/" 2>/dev/null || true
cp -r /srv/monorepo/biome.json "$DEST/" 2>/dev/null || true
cp -r /srv/monorepo/pnpm-workspace.yaml "$DEST/" 2>/dev/null || true

# ── Package contents (not node_modules) ─────────────────────────
log "Backing up apps and packages..."
rsync -a --exclude='node_modules' --exclude='.turbo' --exclude='dist' \
    /srv/monorepo/apps/ "$DEST/apps/" 2>&1 | tee -a "$LOG_FILE" || log "Apps sync partial"
rsync -a --exclude='node_modules' --exclude='.turbo' --exclude='dist' \
    /srv/monorepo/packages/ "$DEST/packages/" 2>&1 | tee -a "$LOG_FILE" || log "Packages sync partial"

# ── Docs and scripts ────────────────────────────────────────────
log "Backing up docs and scripts..."
rsync -a /srv/monorepo/docs/ "$DEST/docs/" 2>&1 | tee -a "$LOG_FILE" || log "Docs sync partial"
rsync -a /srv/monorepo/scripts/ "$DEST/scripts/" 2>&1 | tee -a "$LOG_FILE" || log "Scripts sync partial"

# ── Metadata ───────────────────────────────────────────────────
cat > "$DEST/backup-meta.json" <<EOF
{
  "timestamp": "$TIMESTAMP",
  "hostname": "$(hostname)",
  "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
  "git_branch": "$(git branch --show-current 2>/dev/null || echo 'unknown')"
}
EOF

# ── Cleanup old backups (keep last 7) ─────────────────────────
log "Cleaning up old backups (keeping last 7)..."
ls -dt "$BACKUP_DIR"/monorepo-* 2>/dev/null | tail -n +8 | xargs rm -rf 2>/dev/null && ok "Cleanup done" || log "No cleanup needed"

ok "Backup complete: $NAME"
log "Backup done at $(date '+%Y-%m-%d %H:%M:%S')"
echo "Backup: $DEST"
