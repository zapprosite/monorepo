#!/bin/bash
# subagent-backup.sh — Backup & ZFS Agent
# Part of SPEC-POLYMER-006
# Role: ZFS snapshots, incremental backups, disaster recovery
# Port: 8099
# Skills: zfs-disaster-recovery, zfs-snapshot-prune-debug

set -euo pipefail

AGENT_NAME="backup"
AGENT_PORT="${BACKUP_AGENT_PORT:-8099}"
LOG_DIR="${LOG_DIR:-/srv/ops/logs}"
SNAP_PREFIX="${SNAPSHOT_PREFIX:-polymer}"

source ~/.hermes/secrets.env 2>/dev/null || true

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${AGENT_NAME}] $1" | tee -a "${LOG_DIR}/${AGENT_NAME}-agent.log"; }

# ─── Snapshot Functions ──────────────────────────────────────────────────────

snapshot_create() {
    local name="${1:-$(date +%Y%m%d-%H%M%S)}"
    local snap="tank@${SNAP_PREFIX}-${name}"
    log "Creating snapshot: ${snap}"
    sudo zfs snapshot -r "${snap}" 2>&1 | tee -a "${LOG_DIR}/zfs-snapshot.log"
    log "Snapshot created: ${snap}"
}

snapshot_list() {
    log "Listing snapshots..."
    sudo zfs list -t snapshot -r tank | grep "${SNAP_PREFIX}" | sort
}

snapshot_delete() {
    local snap="${1:?Missing snapshot name}"
    log "Deleting snapshot: ${snap}"
    sudo zfs destroy "${snap}" 2>&1 | tee -a "${LOG_DIR}/zfs-snapshot.log"
    log "Snapshot deleted: ${snap}"
}

snapshot_prune() {
    local days="${1:-90}"
    log "Pruning snapshots older than ${days} days..."
    local cutoff
    cutoff=$(date -d "${days} days ago" +%s)
    local pruned=0
    
    while IFS= read -r line; do
        local snap=$(echo "$line" | awk '{print $1}')
        local age=$(echo "$line" | awk '{print $2}')
        local snap_date
        snap_date=$(date -d "${age}" +%s 2>/dev/null) || continue
        
        if [[ $snap_date -lt $cutoff ]]; then
            log "Pruning: ${snap} (age: ${age})"
            sudo zfs destroy "${snap}" 2>/dev/null || log "Failed to prune ${snap}"
            ((pruned++))
        fi
    done < <(sudo zfs list -t snapshot -r tank -H -p -o name,creation 2>/dev/null | grep "${SNAP_PREFIX}" || true)
    
    log "Pruned ${pruned} snapshots"
}

backup_incremental() {
    local backup_dataset="tank/backup"
    log "Starting incremental backup to ${backup_dataset}..."
    
    # Create snapshot for this backup
    local snap_name="${SNAP_PREFIX}-backup-$(date +%Y%m%d-%H%M%S)"
    local src_snap="tank@${snap_name}"
    
    snapshot_create "${snap_name}"
    
    # Find previous backup snapshot
    local prev_snap
    prev_snap=$(sudo zfs list -t snapshot -r tank -H -o name 2>/dev/null | \
        grep "${SNAP_PREFIX}-backup-" | grep -v "${snap_name}" | sort | tail -1 || true)
    
    if [[ -z "$prev_snap" ]]; then
        log "No previous backup — full backup"
        sudo zfs send -R "${src_snap}" | sudo zfs receive -F "${backup_dataset}" 2>&1 | tee -a "${LOG_DIR}/zfs-backup.log"
    else
        log "Incremental from ${prev_snap} to ${src_snap}"
        sudo zfs send -R -i "${prev_snap}" "${src_snap}" | sudo zfs receive -F "${backup_dataset}" 2>&1 | tee -a "${LOG_DIR}/zfs-backup.log"
    fi
    
    log "Incremental backup complete"
}

backup_verify() {
    local backup_dataset="tank/backup"
    log "Verifying backup dataset..."
    
    if ! sudo zfs list "${backup_dataset}" &>/dev/null; then
        log "ALERT: Backup dataset ${backup_dataset} not found!"
        return 1
    fi
    
    local src_snaps=$(sudo zfs list -t snapshot -r tank 2>/dev/null | grep "${SNAP_PREFIX}" | wc -l)
    local backup_snaps=$(sudo zfs list -t snapshot -r "${backup_dataset}" 2>/dev/null | wc -l)
    
    log "Source snapshots: ${src_snaps}"
    log "Backup snapshots: ${backup_snaps}"
    
    if [[ "$backup_snaps" -lt 1 ]]; then
        log "ALERT: No backups found!"
        return 1
    fi
    
    return 0
}

zfs_scrub() {
    log "Starting ZFS scrub on tank..."
    sudo zpool scrub tank 2>&1 | tee -a "${LOG_DIR}/zfs-scrub.log"
    log "Scrub started. Check status with: sudo zpool status tank"
}

zfs_health() {
    log "Checking ZFS health..."
    local state
    state=$(sudo zpool status tank 2>/dev/null | grep "state:" | awk '{print $2}')
    local scan
    scan=$(sudo zpool status tank 2>/dev/null | grep "scan:" | head -1)
    
    log "Pool state: ${state}"
    log "${scan}"
    
    if [[ "$state" != "ONLINE" ]]; then
        log "ALERT: Pool not ONLINE!"
        return 1
    fi
    return 0
}

# ─── Main ──────────────────────────────────────────────────────────────────

main() {
    log "=== Backup Agent Starting ==="
    zfs_health
    snapshot_list
    log "=== Backup Agent Complete ==="
}

# ─── CLI ───────────────────────────────────────────────────────────────────

case "${1:-check}" in
    check|health)
        main
        ;;
    snapshot)
        snapshot_create "${2:-}"
        ;;
    list)
        snapshot_list
        ;;
    delete)
        snapshot_delete "${2:?Missing snapshot name}"
        ;;
    prune)
        snapshot_prune "${2:-90}"
        ;;
    backup)
        backup_incremental
        ;;
    verify)
        backup_verify
        ;;
    scrub)
        zfs_scrub
        ;;
    *)
        echo "Usage: $0 [check|health|snapshot [name]|list|delete <snap>|prune [days]|backup|verify|scrub]"
        exit 1
        ;;
esac
