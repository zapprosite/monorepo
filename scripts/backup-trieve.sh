#!/usr/bin/env bash
# backup-trieve.sh — Backup Trieve RAG data (Postgres + Qdrant)
# Usage: bash /srv/monorepo/scripts/backup-trieve.sh
# Env: RETENTION_DAYS (default: 7)
set -euo pipefail

VERSION="1.0.0"

# ── Config ──────────────────────────────────────────────────────
TIMESTAMP=$(date '+%Y-%m-%d-%H%M%S')
BACKUP_DIR="${BACKUP_DIR:-/srv/backups/trieve}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
LOCK_FILE="/var/run/backup-trieve.lock"
LOG_FILE="${LOG_FILE:-/srv/ops/logs/backup-trieve.log}"

NAME="trieve-${TIMESTAMP}"
DEST="$BACKUP_DIR/$NAME"
ARCHIVE_PATH="$BACKUP_DIR/$NAME.tar.gz"

LOG_PREFIX="[BACKUP]"
log()  { echo "$LOG_PREFIX $(date '+%H:%M:%S') $1" | tee -a "$LOG_FILE"; }
ok()   { echo "$LOG_PREFIX ✅ $1" | tee -a "$LOG_FILE"; }
fail() { echo "$LOG_PREFIX ❌ $1" | tee -a "$LOG_FILE"; exit 1; }

# ── Lock ────────────────────────────────────────────────────────
acquire_lock() {
    local lock_dir
    lock_dir=$(dirname "$LOCK_FILE")
    mkdir -p "$lock_dir" 2>/dev/null || true
    if command -v flock &>/dev/null; then
        exec 200>"$LOCK_FILE"
        flock -n 200 || fail "Another backup is already running (lock: $LOCK_FILE)"
        echo "$$" >&200
    else
        [[ -f "$LOCK_FILE" ]] && fail "Another backup is already running (lock: $LOCK_FILE)"
        echo "$$" > "$LOCK_FILE"
        trap 'release_lock' EXIT
    fi
}

release_lock() {
    flock -u 200 2>/dev/null || true
    rm -f "$LOCK_FILE"
}

# ── Sanity checks ────────────────────────────────────────────────
check_prereqs() {
    log "Checking prerequisites..."
    local missing=0

    if command -v pg_dump &>/dev/null; then
        log "pg_dump: found"
    else
        log "pg_dump: NOT FOUND"
        missing=1
    fi

    if command -v gzip &>/dev/null; then
        log "gzip: found"
    else
        log "gzip: NOT FOUND"
        missing=1
    fi

    if command -v curl &>/dev/null && command -v jq &>/dev/null; then
        log "curl+jq: found (for Qdrant)"
    else
        log "curl+jq: NOT FOUND (Qdrant backup will be skipped)"
    fi

    [[ "$missing" -eq 1 ]] && fail "Missing required commands"
}

# ── Backup Postgres ─────────────────────────────────────────────
backup_postgres() {
    log "Dumping PostgreSQL database 'trieve'..."
    local dump_file="$DEST/postgres-trieve.sql"

    if PGPASSWORD="${TRIEVE_DB_PASSWORD:-}" pg_dump \
        -h "${TRIEVE_DB_HOST:-localhost}" \
        -p "${TRIEVE_DB_PORT:-5432}" \
        -U "${TRIEVE_DB_USER:-postgres}" \
        -d trieve \
        -f "$dump_file" 2>&1 | tee -a "$LOG_FILE"; then
        ok "Postgres dump done: $dump_file"
    else
        fail "Postgres dump failed"
    fi
}

# ── Backup Qdrant ───────────────────────────────────────────────
backup_qdrant() {
    log "Backing up Qdrant collections (trieve_*)..."

    local qdrant_host="${QDRANT_HOST:-localhost}"
    local qdrant_port="${QDRANT_PORT:-6333}"
    local collections_file="$DEST/qdrant-collections.json"

    # Get list of trieve_* collections
    local collections
    collections=$(curl -s -f "http://${qdrant_host}:${qdrant_port}/collections" | jq -r '.collections[].name | select(startswith("trieve_"))' 2>/dev/null) || {
        log "Failed to list Qdrant collections, skipping"
        return 0
    }

    if [[ -z "$collections" ]]; then
        log "No trieve_* collections found in Qdrant, skipping"
        return 0
    fi

    mkdir -p "$DEST/qdrant_snapshots"

    for coll in $collections; do
        log "Creating snapshot for collection: $coll"

        # Trigger snapshot creation
        local snapshot_name="${coll}-${TIMESTAMP}.snapshot"
        local response
        response=$(curl -s -f -X POST \
            "http://${qdrant_host}:${qdrant_port}/collections/${coll}/snapshots" 2>&1) || {
            log "Failed to create snapshot for $coll"
            continue
        }

        local snapshot_path
        snapshot_path=$(echo "$response" | jq -r '.result.name' 2>/dev/null) || {
            log "Failed to parse snapshot response for $coll"
            continue
        }

        # Download snapshot
        local download_url="http://${qdrant_host}:${qdrant_port}/collections/${coll}/snapshots/${snapshot_path}/download"
        local local_file="$DEST/qdrant_snapshots/${coll}.snapshot"

        if curl -s -f -o "$local_file" "$download_url" 2>&1 | tee -a "$LOG_FILE"; then
            ok "Downloaded snapshot: $coll -> $local_file"
        else
            log "Failed to download snapshot for $coll"
        fi
    done

    ok "Qdrant backup complete"
}

# ── Create archive ───────────────────────────────────────────────
create_archive() {
    log "Creating tar.gz archive..."
    tar -czf "$ARCHIVE_PATH" -C "$BACKUP_DIR" "$NAME" 2>&1 | tee -a "$LOG_FILE" || fail "Archive creation failed"
    ok "Archive created: $ARCHIVE_PATH"
}

# ── Verify integrity ─────────────────────────────────────────────
verify_backup() {
    log "Verifying backup integrity..."

    if [[ ! -f "$ARCHIVE_PATH" ]]; then
        fail "Archive not found: $ARCHIVE_PATH"
    fi

    local size
    size=$(stat -f%z "$ARCHIVE_PATH" 2>/dev/null || stat -c%s "$ARCHIVE_PATH" 2>/dev/null) || {
        fail "Cannot stat archive"
    }

    if [[ "$size" -lt 1024 ]]; then
        fail "Archive too small (${size} bytes), possible corruption"
    fi

    if tar -tzf "$ARCHIVE_PATH" &>/dev/null; then
        ok "Archive integrity OK (${size} bytes)"
    else
        fail "Archive corrupted (tar -tzf failed)"
    fi
}

# ── Cleanup old backups ──────────────────────────────────────────
cleanup_old() {
    log "Cleaning up backups older than ${RETENTION_DAYS} days..."

    local deleted
    deleted=$(find "$BACKUP_DIR" -name "trieve-*.tar.gz" -type f -mtime "+${RETENTION_DAYS}" -print -delete 2>/dev/null | wc -l) || {
        log "Cleanup error (non-fatal)"
        return 0
    }

    if [[ "$deleted" -gt 0 ]]; then
        ok "Deleted $deleted old backup(s)"
    else
        log "No old backups to clean"
    fi
}

# ── Write metadata ────────────────────────────────────────────────
write_meta() {
    cat > "$DEST/backup-meta.json" <<EOF
{
  "version": "$VERSION",
  "timestamp": "$TIMESTAMP",
  "hostname": "$(hostname)",
  "retention_days": $RETENTION_DAYS,
  "archive": "$ARCHIVE_PATH",
  "components": ["postgres:trieve", "qdrant:trieve_*"]
}
EOF
    ok "Metadata written"
}

# ── Main ─────────────────────────────────────────────────────────
main() {
    log "=== Trieve Backup v${VERSION} started ==="
    acquire_lock

    check_prereqs

    log "Creating backup directory: $DEST"
    mkdir -p "$DEST"

    backup_postgres
    backup_qdrant
    write_meta
    create_archive
    verify_backup
    cleanup_old

    ok "Backup complete: $ARCHIVE_PATH"
    log "=== Trieve Backup finished successfully at $(date '+%Y-%m-%d %H:%M:%S') ==="
    exit 0
}

main "$@"