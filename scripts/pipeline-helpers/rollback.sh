#!/bin/bash
# rollback.sh — Restore from ZFS snapshot in case of failure
# Anti-hardcoded: all config via process.env
set -euo pipefail

ZPOOL="${ZPOOL:-tank}"
SNAPSHOT="${1:-}"

log() { echo "[$(date '+%H:%M:%S')] $1"; }

# Find most recent snapshot if not specified
find-most-recent-snapshot() {
  local description_pattern="$1"
  sudo zfs list -t snapshot -r "$ZPOOL" | grep "$description_pattern" | tail -1 | awk '{print $1}'
}

rollback-snapshot() {
  local snapshot="$1"

  if [ -z "$snapshot" ]; then
    log "ERRO: Snapshot nao especificado"
    log "Usage: rollback.sh <snapshot-name>"
    return 1
  fi

  log "Iniciando rollback para: $snapshot"
  log "WARNING: Esta operacao revertra o sistema para o estado do snapshot"

  # Verify snapshot exists
  if ! sudo zfs list -t snapshot "$snapshot" > /dev/null 2>&1; then
    log "ERRO: Snapshot nao encontrado: $snapshot"
    return 1
  fi

  # Perform rollback
  if sudo zfs rollback -r "$snapshot"; then
    log "Rollback concluido: $snapshot"

    # Log to snapshots.log
    local snapshots_log="tasks/snapshots.log"
    mkdir -p "$(dirname "$snapshots_log")"
    echo "$(date -I) - ROLLBACK to $snapshot" >> "$snapshots_log"

    return 0
  else
    log "ERRO: Falha no rollback"
    return 1
  fi
}

# Main
if [ -z "$SNAPSHOT" ]; then
  log "Buscando snapshot mais recente..."
  SNAPSHOT=$(find-most-recent-snapshot "pre-")
  if [ -z "$SNAPSHOT" ]; then
    log "ERRO: Nenhum snapshot encontrado para rollback"
    exit 1
  fi
  log "Snapshot encontrado: $SNAPSHOT"
fi

rollback-snapshot "$SNAPSHOT"
