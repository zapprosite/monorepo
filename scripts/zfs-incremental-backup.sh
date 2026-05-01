#!/bin/bash
# zfs-incremental-backup.sh — Incremental ZFS backup to tank/backup dataset
# Part of POLYMER-001 / ZFS disaster recovery skill
set -euo pipefail

POOL="${ZFS_POOL:-tank}"
BACKUP_DATASET="${BACKUP_POOL:-tank/backup}"
PREFIX="${SNAPSHOT_PREFIX:-polymer}"
BACKUP_FILE="${BACKUP_FILE:-}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

# Ensure backup dataset exists
if ! sudo zfs list "$BACKUP_DATASET" &>/dev/null; then
    log "Creating backup dataset $BACKUP_DATASET"
    sudo zfs create -p "$BACKUP_DATASET"
fi

# Create new snapshot for this backup
SNAP_NAME="${PREFIX}-backup-$(date +%Y%m%d-%H%M%S)"
SRC_SNAP="${POOL}@${SNAP_NAME}"
log "Creating source snapshot: $SRC_SNAP"
sudo zfs snapshot "$SRC_SNAP"

# Find the previous backup snapshot for incremental send
PREV_SNAP=$(sudo zfs list -t snapshot -r "$POOL" -H -o name 2>/dev/null | \
    grep "${PREFIX}-backup-" | grep -v "$SNAP_NAME" | sort | tail -1 || true)

if [[ -z "$PREV_SNAP" ]]; then
    # Full backup (first time)
    log "No previous backup found — doing full backup"
    CMD="sudo zfs send -R $SRC_SNAP"
else
    log "Incremental from $PREV_SNAP to $SRC_SNAP"
    CMD="sudo zfs send -R -i $PREV_SNAP $SRC_SNAP"
fi

# Execute the backup
if [[ -n "$BACKUP_FILE" ]]; then
    # Send to file
    log "Sending to file: $BACKUP_FILE"
    $CMD | sudo tee "$BACKUP_FILE" > /dev/null
else
    # Send to backup pool
    log "Sending to backup dataset: $BACKUP_DATASET"
    $CMD | sudo zfs receive -F "$BACKUP_DATASET"
fi

log "Backup complete: $SRC_SNAP"
log "Backup dataset snapshots:"
sudo zfs list -t snapshot -r "$BACKUP_DATASET" | tail -5
