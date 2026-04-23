#!/bin/bash
# snapshot.sh — ZFS snapshot before each phase
# Anti-hardcoded: all config via process.env
set -euo pipefail

DESCRIPTION="${1:-unnamed}"
ZPOOL="${ZPOOL:-tank}"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"

log() { echo "[$(date '+%H:%M:%S')] $1"; }

create-snapshot() {
  local description="$1"
  local snapshot_name="pre-${TIMESTAMP}-${description}"

  log "Criando ZFS snapshot: ${ZPOOL}@${snapshot_name}"

  if sudo zfs snapshot -r "${ZPOOL}@${snapshot_name}"; then
    log "Snapshot criado: ${ZPOOL}@${snapshot_name}"

    # Log to snapshots.log
    local snapshots_log="tasks/snapshots.log"
    mkdir -p "$(dirname "$snapshots_log")"
    echo "$(date -I) - ${ZPOOL}@${snapshot_name} - ${description}" >> "$snapshots_log"

    return 0
  else
    log "ERRO: Falha ao criar snapshot"
    return 1
  fi
}

# List recent snapshots
list-snapshots() {
  log "Snapshots recentes:"
  sudo zfs list -t snapshot -r "$ZPOOL" | tail -20
}

# Main
case "${1:-create}" in
  create)
    create-snapshot "$DESCRIPTION"
    ;;
  list)
    list-snapshots
    ;;
  *)
    echo "Usage: snapshot.sh [create|list] [description]"
    exit 1
    ;;
esac
