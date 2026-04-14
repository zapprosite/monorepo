#!/bin/bash
#===========================================
# Obsidian Mirror Sync — One-way rsync from docs/ to obsidian/
# Source of truth: docs/ (read-only mirror: obsidian/)
# Best practices from MiniMax research 14/04/2026
# Cron: */15 * * * * (every 15 minutes)
#===========================================
set -euo pipefail

SOURCE="/srv/monorepo/docs"
TARGET="/srv/monorepo/obsidian"
LOG_DIR="/srv/ops/logs"
LOG="$LOG_DIR/obsidian-sync.log"

# Exclude patterns — don't sync these
EXCLUDES=(
    "--exclude=archive/"
    "--exclude=logs/"
    "--exclude=plans/"
    "--exclude=BAU-*"
    "--exclude=.DS_Store"
    "--exclude=Thumbs.db"
)

mkdir -p "$LOG_DIR"

log() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1" | tee -a "$LOG"; }

# Check if source exists
if [[ ! -d "$SOURCE" ]]; then
    log "ERROR Source $SOURCE not found"
    exit 1
fi

# Check if target exists
if [[ ! -d "$TARGET" ]]; then
    log "WARN Target $TARGET not found, initializing..."
    mkdir -p "$TARGET"
fi

# Count files before
src_count=$(find "$SOURCE" -type f -name "*.md" 2>/dev/null | wc -l)
tgt_count=$(find "$TARGET" -type f -name "*.md" 2>/dev/null | wc -l)

# Sync (delete removed files from source)
log "INFO Starting obsidian sync: $SOURCE → $TARGET (source: ${src_count} .md files, target: ${tgt_count} .md files)"

rsync -av \
    "${EXCLUDES[@]}" \
    --delete \
    --delete-excluded \
    "$SOURCE/" "$TARGET/" 2>&1 | tee -a "$LOG"

# Count after
new_tgt_count=$(find "$TARGET" -type f -name "*.md" 2>/dev/null | wc -l)
log "INFO Sync complete. Files in obsidian/: ${new_tgt_count} .md files"
