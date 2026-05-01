#!/bin/bash
# zfs-prune-snapshots.sh — Prune ZFS snapshots older than RETENTION_DAYS
# Part of POLYMER-001 / ZFS disaster recovery skill
set -euo pipefail

POOL="${ZFS_POOL:-tank}"
PREFIX="${SNAPSHOT_PREFIX:-polymer}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"
DRY_RUN="${DRY_RUN:-false}"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

# Determine cutoff date
CUTOFF=$(date -d "$RETENTION_DAYS days ago" +%s)

log "Starting snapshot prune for pool=$POOL prefix=$PREFIX retention=${RETENTION_DAYS}d dry_run=$DRY_RUN"

# Get list of polymer snapshots older than cutoff
while IFS= read -r line; do
    # Parse: tank@snap-name ...
    SNAP=$(echo "$line" | awk '{print $1}')
    CREATION=$(echo "$line" | awk '{print $2}')  # e.g. 2026-05-01
    
    SNAP_DATE=$(date -d "$CREATION" +%s 2>/dev/null) || continue
    
    if [[ $SNAP_DATE -lt $CUTOFF ]]; then
        if [[ "$DRY_RUN" == "true" ]]; then
            log "WOULD DELETE: $SNAP (created: $CREATION)"
        else
            log "DELETING: $SNAP"
            sudo zfs destroy "$SNAP" 2>/dev/null || log "WARN: failed to delete $SNAP"
        fi
    fi
done < <(sudo zfs list -t snapshot -r "$POOL" -H -p -o name,creation 2>/dev/null | grep "$PREFIX" || true)

# Also prune empty pre-change snapshots (tagged with date pattern)
# These are snapshots like tank@polymer-20260501-120000-pre-change
while IFS= read -r line; do
    SNAP=$(echo "$line" | awk '{print $1}')
    # Extract date part from snapshot name
    SNAP_NAME="${SNAP#*@polymer-}"
    SNAP_DATE_STR="${SNAP_NAME%%-*}"  # e.g. 20260501
    
    if [[ "$SNAP_NAME" == *"pre-change"* ]] || [[ "$SNAP_NAME" == *"pre-hardening"* ]]; then
        # These older than 14 days are pruned
        SNAP_DATE=$(date -d "${SNAP_DATE_STR:0:4}-${SNAP_DATE_STR:4:2}-${SNAP_DATE_STR:6:2}" +%s 2>/dev/null) || continue
        OLD_DATE=$(date -d "14 days ago" +%s)
        if [[ $SNAP_DATE -lt $OLD_DATE ]]; then
            if [[ "$DRY_RUN" == "true" ]]; then
                log "WOULD DELETE pre-change: $SNAP"
            else
                log "DELETING pre-change: $SNAP"
                sudo zfs destroy "$SNAP" 2>/dev/null || log "WARN: failed to delete $SNAP"
            fi
        fi
    fi
done < <(sudo zfs list -t snapshot -r "$POOL" -H -p -o name,creation 2>/dev/null | grep "$PREFIX" || true)

log "Prune complete. Current snapshot count:"
sudo zfs list -t snapshot -r "$POOL" | grep "$PREFIX" | wc -l | xargs -I{} log "Total polymer snapshots: {}"
