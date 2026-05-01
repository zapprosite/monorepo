#!/bin/bash
#===============================================================================
# HERMES-BACKUP — FIXED VERSION (CORRECTED ARCHITECTURE)
# Part of SPEC-POLYMER-005/006
#
# REAL ARCHITECTURE (audited 2026-05-01):
# - Qdrant: localhost:6333 (API key required), 12 collections on hermes-qdrant container
# - PostgreSQL: crm-postgres Docker container (NOT native), native pg_dump WON'T work
# - Mem0: runs INSIDE hermes-orchestrator, API at 8642 is Hermes Agent platform
# - Second Brain: ~/Desktop/hermes-second-brain/ (NOT in monorepo, NOT backed up)
#
# Schedule:
#   3:00 AM  — ZFS snapshot
#   4:00 AM  — ZFS incremental backup
#   5:00 AM  — PostgreSQL via docker exec
#   6:00 AM  — Qdrant snapshot (all 12 collections)
#   7:00 AM  — Second Brain (git archive)
#   8:00 AM  — Ollama model registry
#===============================================================================

set -euo pipefail

LOG_DIR="/srv/ops/logs/backup"
BACKUP_DIR="/srv/backups"
STATE_DIR="/srv/ops/state"
CRON_LOCK_DIR="${HOME}/.hermes/cron-locks"
SNAP_PREFIX="polymer"
mkdir -p "${LOG_DIR}" "${BACKUP_DIR}/postgres" "${BACKUP_DIR}/qdrant" \
         "${BACKUP_DIR}/ollama" "${BACKUP_DIR}/brain" "${STATE_DIR}" \
         "${CRON_LOCK_DIR}"

source ~/.hermes/secrets.env 2>/dev/null || true

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BACKUP] $1" | tee -a "${LOG_DIR}/backup.log"; }
log_fail() { 
    log "FAIL: $1"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [BACKUP-FAIL] $1" >> "${LOG_DIR}/backup-failures.log"
}

escalate() {
    log "ESCALATE: $1"
    curl -sf -X POST "http://localhost:8093/enqueue" \
        -H "Content-Type: application/json" \
        -d "{\"task\": \"BACKUP ESCALATION: $1\", \"mode\": \"SENIOR\", \"agent\": \"backup\", \"priority\": 1}" \
        &>/dev/null || true
}

acquire_lock() {
    local name="${1}"; local lockfile="${CRON_LOCK_DIR}/${name}.lock"
    if [[ -f "$lockfile" ]] && kill -0 "$(cat "$lockfile")" 2>/dev/null; then
        log "Lock exists for ${name}, skipping"; return 1; fi
    echo $$ > "$lockfile"; return 0
}
release_lock() { rm -f "${CRON_LOCK_DIR}/${1}.lock"; }

state_save() { echo "${2}" > "${STATE_DIR}/${1}.state"; }
state_load() { cat "${STATE_DIR}/${1}.state" 2>/dev/null || echo ""; }

# ─── ZFS Snapshot ─────────────────────────────────────────────────────────────
backup_zfs_snapshot() {
    local snap_name="${SNAP_PREFIX}-$(date +%Y%m%d-%H%M%S)"
    local snap="tank@${snap_name}"
    
    log "Creating ZFS snapshot: ${snap}"
    
    if sudo zfs snapshot -r "${snap}" 2>&1 | tee -a "${LOG_DIR}/zfs-snapshot.log"; then
        log "ZFS snapshot created: ${snap}"
        state_save "last_zfs_snapshot" "$(date -Iseconds)"
        return 0
    else
        log_fail "ZFS snapshot failed"
        escalate "ZFS snapshot creation failed"
        return 1
    fi
}

prune_zfs_snapshots() {
    local days="${1:-90}"
    local cutoff; cutoff=$(date -d "${days} days ago" +%s)
    local pruned=0; local failed=0
    
    log "Pruning ZFS snapshots older than ${days} days..."
    
    while IFS= read -r line; do
        [[ -z "$line" ]] && continue
        local snap=$(echo "$line" | awk '{print $1}')
        local age_str=$(echo "$line" | awk '{print $2}')
        local snap_date; snap_date=$(date -d "${age_str}" +%s 2>/dev/null) || continue
        
        if [[ $snap_date -lt $cutoff ]]; then
            if sudo zfs destroy "${snap}" 2>>"${LOG_DIR}/zfs-prune.log"; then ((pruned++)); else ((failed++)); fi
        fi
    done < <(sudo zfs list -t snapshot -r tank -H -p -o name,creation 2>/dev/null | grep "${SNAP_PREFIX}" || true)
    
    log "ZFS prune complete: ${pruned} pruned, ${failed} failed"
    [[ $failed -gt 0 ]] && escalate "ZFS prune had ${failed} failures"
}

backup_zfs_incremental() {
    local backup_dataset="tank/backup"
    local snap_name="${SNAP_PREFIX}-backup-$(date +%Y%m%d-%H%M%S)"
    local src_snap="tank@${snap_name}"
    
    log "Starting ZFS incremental backup to ${backup_dataset}..."
    
    if ! sudo zfs snapshot -r "${src_snap}" 2>&1 | tee -a "${LOG_DIR}/zfs-backup.log"; then
        log_fail "Failed to create backup snapshot: ${src_snap}"
        return 1
    fi
    
    local prev_snap
    prev_snap=$(sudo zfs list -t snapshot -r tank -H -o name 2>/dev/null | \
        grep "${SNAP_PREFIX}-backup-" | grep -v "${snap_name}" | sort | tail -1 || true)
    
    if [[ -z "$prev_snap" ]]; then
        log "No previous snapshot — full backup"
        sudo zfs send -R "${src_snap}" 2>/dev/null | \
            sudo zfs receive -F "${backup_dataset}" 2>&1 | tee -a "${LOG_DIR}/zfs-backup.log"
    else
        log "Incremental from ${prev_snap} to ${src_snap}"
        sudo zfs send -R -i "${prev_snap}" "${src_snap}" 2>/dev/null | \
            sudo zfs receive -F "${backup_dataset}" 2>&1 | tee -a "${LOG_DIR}/zfs-backup.log"
    fi
    
    if [[ ${PIPESTATUS[0]} -eq 0 ]]; then
        log "ZFS incremental backup complete"
        state_save "last_zfs_backup" "$(date -Iseconds)"
        return 0
    else
        log_fail "ZFS incremental backup failed"
        escalate "ZFS incremental backup failed"
        return 1
    fi
}

# ─── PostgreSQL (via docker exec) ───────────────────────────────────────────
backup_postgres() {
    local db_name="${POSTGRES_DB:-n8n}"
    local db_user="${POSTGRES_USER:-postgres}"
    local output_file="${BACKUP_DIR}/postgres/${db_name}-$(date +%Y%m%d-%H%M%S).sql.gz"
    
    log "Dumping PostgreSQL: ${db_name} (via docker exec)..."
    
    # REAL: Use docker exec, NOT native pg_dump
    if docker exec crm-postgres pg_dump -U "${db_user}" -d "${db_name}" -Fc 2>>"${LOG_DIR}/postgres-backup.log" | gzip > "${output_file}"; then
        local size; size=$(du -h "${output_file}" | awk '{print $1}')
        log "PostgreSQL dump complete: ${output_file} (${size})"
        
        local size_bytes; size_bytes=$(stat -c%s "${output_file}" 2>/dev/null || echo 0)
        if [[ $size_bytes -lt 1024 ]]; then
            log_fail "PostgreSQL dump suspiciously small: ${size_bytes} bytes"
            escalate "PostgreSQL backup suspiciously small"
        fi
        
        state_save "last_postgres_backup" "$(date -Iseconds)"
        return 0
    else
        log_fail "PostgreSQL dump failed"
        escalate "PostgreSQL backup failed"
        return 1
    fi
}

# ─── Qdrant Backup (all 12 collections) ───────────────────────────────────
backup_qdrant() {
    local output_dir="${BACKUP_DIR}/qdrant"
    local timestamp; timestamp=$(date +%Y%m%d-%H%M%S)
    local snapshot_file="${output_dir}/qdrant-all-${timestamp}.tar.gz"
    local api_key="${QDRANT_API_KEY:-}"
    
    log "Creating Qdrant backup (all 12 collections with API key)..."
    
    # Get all collection names
    local collections
    collections=$(curl -s -H "api-key: ${api_key}" "http://localhost:6333/collections" | \
        python3 -c "import sys,json; d=json.load(sys.stdin); print('\n'.join([c['name'] for c in d.get('result',{}).get('collections',[])]))" 2>/dev/null || echo "")
    
    if [[ -z "$collections" ]]; then
        log_fail "Qdrant: no collections found (API key valid?)"
        escalate "Qdrant backup: could not list collections"
        return 1
    fi
    
    log "Qdrant collections: $(echo "$collections" | wc -l)"
    local success=0; local failed=0
    
    # Snapshot each collection
    for col in $collections; do
        local response
        response=$(curl -sf -X POST "http://localhost:6333/collections/${col}/snapshots" \
            -H "api-key: ${api_key}" 2>>"${LOG_DIR}/qdrant-backup.log")
        
        if [[ -n "$response" ]]; then
            local snapshot_name
            snapshot_name=$(echo "$response" | python3 -c "import sys,json; print(json.load(sys.stdin).get('result',{}).get('name',''))" 2>/dev/null || echo "")
            
            if [[ -n "$snapshot_name" ]]; then
                # Download
                if curl -sf "http://localhost:6333/collections/${col}/snapshots/${snapshot_name}" \
                    -H "api-key: ${api_key}" -o "${output_dir}/${col}-${timestamp}.snapshot" 2>>"${LOG_DIR}/qdrant-backup.log"; then
                    ((success++))
                    log "Qdrant: ${col} snapshot OK"
                else
                    ((failed++))
                    log_fail "Qdrant: ${col} download failed"
                fi
            fi
        else
            ((failed++))
            log_fail "Qdrant: ${col} snapshot failed"
        fi
    done
    
    # Create tarball of all snapshots
    if [[ $success -gt 0 ]]; then
        tar -czf "${snapshot_file}" -C "${output_dir}" --remove-files \
            $(ls "${output_dir}"/*.snapshot 2>/dev/null | xargs -I{} basename "{}") 2>/dev/null || true
        local size; size=$(du -h "${snapshot_file}" | awk '{print $1}')
        log "Qdrant backup complete: ${success}/${#collections} collections (${size})"
        state_save "last_qdrant_backup" "$(date -Iseconds)"
        
        if [[ $failed -gt 0 ]]; then
            escalate "Qdrant backup: ${failed} collections failed"
        fi
        return 0
    else
        log_fail "Qdrant backup: all collections failed"
        escalate "Qdrant backup: complete failure"
        return 1
    fi
}

# ─── Ollama Model Registry ──────────────────────────────────────────────────
backup_ollama() {
    local output_file="${BACKUP_DIR}/ollama/models-$(date +%Y%m%d-%H%M%S).json"
    
    log "Backing up Ollama model registry..."
    
    if curl -sf "http://localhost:11434/api/tags" 2>/dev/null | \
        python3 -c "import sys,json; data=json.load(sys.stdin); print(json.dumps(data,indent=2))" > "${output_file}"; then
        
        local size models
        size=$(du -h "${output_file}" | awk '{print $1}')
        models=$(curl -sf "http://localhost:11434/api/tags" 2>/dev/null | \
            python3 -c "import sys,json; print(len(json.load(sys.stdin).get('models',[])))" 2>/dev/null || echo "?")
        log "Ollama registry backed up: ${models} models (${size})"
        state_save "last_ollama_backup" "$(date -Iseconds)"
        return 0
    else
        log_fail "Ollama registry backup failed"
        escalate "Ollama backup failed"
        return 1
    fi
}

# ─── Second Brain (git archive) ─────────────────────────────────────────────
backup_second_brain() {
    local sb_dir="${HOME}/Desktop/hermes-second-brain"
    local output_file="${BACKUP_DIR}/brain/second-brain-$(date +%Y%m%d-%H%M%S).tar.gz"
    
    log "Backing up Second Brain: ${sb_dir}..."
    
    if [[ ! -d "$sb_dir" ]]; then
        log_fail "Second Brain directory not found: ${sb_dir}"
        return 1
    fi
    
    # Git archive (includes all tracked files)
    if [[ -d "${sb_dir}/.git" ]]; then
        cd "${sb_dir}" && git archive --format=tar.gz HEAD -o "${output_file}" 2>>"${LOG_DIR}/brain-backup.log"
    else
        # Fallback: tar everything
        tar -czf "${output_file}" -C "$(dirname "${sb_dir}")" "$(basename "${sb_dir}")" 2>>"${LOG_DIR}/brain-backup.log"
    fi
    
    if [[ -f "$output_file" ]]; then
        local size
        size=$(du -h "${output_file}" | awk '{print $1}')
        log "Second Brain backup complete: ${output_file} (${size})"
        
        # Also backup git repo state
        if [[ -d "${sb_dir}/.git" ]]; then
            local git_state="${BACKUP_DIR}/brain/second-brain-gitstate-$(date +%Y%m%d-%H%M%S).txt"
            cd "${sb_dir}" && git log --oneline -5 > "${git_state}" 2>/dev/null || true
            git status --short > "${git_state}.status" 2>/dev/null || true
        fi
        
        state_save "last_brain_backup" "$(date -Iseconds)"
        return 0
    else
        log_fail "Second Brain backup failed"
        escalate "Second Brain backup failed"
        return 1
    fi
}

# ─── ZFS Scrub (Weekly) ─────────────────────────────────────────────────────
zfs_scrub() {
    log "Starting weekly ZFS scrub..."
    sudo zpool scrub tank 2>&1 | tee -a "${LOG_DIR}/zfs-scrub.log"
    log "ZFS scrub started (check: sudo zpool status tank)"
    state_save "last_zfs_scrub" "$(date -Iseconds)"
}

# ─── Verify Backups ─────────────────────────────────────────────────────────
verify_backups() {
    log "Verifying backup integrity..."
    local issues=0
    
    # Check recent backups exist
    [[ -f "$(ls -t ${BACKUP_DIR}/postgres/*.sql.gz 2>/dev/null | head -1)" ]] || {
        log_fail "No recent PostgreSQL backup found"; ((issues++)); }
    
    [[ -f "$(ls -t ${BACKUP_DIR}/qdrant/*.tar.gz 2>/dev/null | head -1)" ]] || {
        log_fail "No recent Qdrant backup found"; ((issues++)); }
    
    [[ -f "$(ls -t ${BACKUP_DIR}/brain/*.tar.gz 2>/dev/null | head -1)" ]] || {
        log_fail "No recent Second Brain backup found"; ((issues++)); }
    
    # Check ZFS snapshots
    local snap_count
    snap_count=$(sudo zfs list -t snapshot -r tank 2>/dev/null | grep "${SNAP_PREFIX}" | wc -l)
    if [[ $snap_count -lt 7 ]]; then
        log_fail "Only ${snap_count} ZFS snapshots (expected at least 7)"; ((issues++)); }
    
    if [[ $issues -gt 0 ]]; then
        escalate "Backup verification found ${issues} issues"; return 1; fi
    
    log "Backup verification passed"; return 0
}

# ─── Main ───────────────────────────────────────────────────────────────────
main() {
    local command="${1:-all}"
    log "=== Hermes Backup Starting: ${command} ==="
    
    case "$command" in
        all)
            backup_zfs_snapshot
            backup_zfs_incremental
            backup_postgres
            backup_qdrant
            backup_second_brain
            backup_ollama
            verify_backups
            ;;
        snapshot)    acquire_lock "zfs-snapshot" && { backup_zfs_snapshot; release_lock "zfs-snapshot"; } ;;
        incremental)  acquire_lock "zfs-incremental" && { backup_zfs_incremental; release_lock "zfs-incremental"; } ;;
        prune)        acquire_lock "zfs-prune" && { prune_zfs_snapshots "${2:-90}"; release_lock "zfs-prune"; } ;;
        postgres)     acquire_lock "postgres" && { backup_postgres; release_lock "postgres"; } ;;
        qdrant)       acquire_lock "qdrant" && { backup_qdrant; release_lock "qdrant"; } ;;
        ollama)       acquire_lock "ollama" && { backup_ollama; release_lock "ollama"; } ;;
        brain|second_brain)
                       acquire_lock "brain" && { backup_second_brain; release_lock "brain"; } ;;
        scrub)        acquire_lock "zfs-scrub" && { zfs_scrub; release_lock "zfs-scrub"; } ;;
        verify)       verify_backups ;;
        *)            echo "Usage: $0 [all|snapshot|prune|postgres|qdrant|ollama|brain|scrub|verify]" ;;
    esac
    
    log "=== Hermes Backup Complete ==="
}

main "$@"
