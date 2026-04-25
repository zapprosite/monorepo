#!/bin/bash
# context-snapshot.sh — Snapshot do contexto atual para Mem0/Qdrant

set -euo pipefail

MONOREPO="/srv/monorepo"
LOG="$MONOREPO/logs/context-snapshot.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

# Salva snapshot em Mem0 via MCP
snapshot_to_mem0() {
  local task_id="$1"
  local spec="$2"
  local phase="$3"
  local summary="${4:-}"

  log "Snapshot to Mem0: task=$task_id spec=$spec phase=$phase"

  # Tenta usar mem0 CLI se disponível
  if command -v mem0 &>/dev/null; then
    mem0 add "Context snapshot: $task_id | SPEC: $spec | Phase: $phase | Summary: $summary" \
      --agent "nexus-context" \
      --namespace "context-snapshots" 2>/dev/null || log "mem0 add failed"
  else
    # Salva em JSON como fallback
    local snapshot_file="$MONOREPO/.claude/vibe-kit/snapshots/${task_id}.json"
    mkdir -p "$(dirname "$snapshot_file")"
    jq -n \
      --arg task "$task_id" \
      --arg spec "$spec" \
      --arg phase "$phase" \
      --arg summary "$summary" \
      --arg time "$(date -Iseconds)" \
      '{
        task_id: $task,
        spec: $spec,
        phase: $phase,
        summary: $summary,
        timestamp: $time
      }' > "$snapshot_file"
    log "Saved snapshot to $snapshot_file"
  fi
}

# Indexa em Qdrant
snapshot_to_qdrant() {
  local task_id="$1"
  local spec="$2"
  local file_changes="${3:-}"

  log "Snapshot to Qdrant: task=$task_id spec=$spec"

  # Verifica se qdrant client existe
  if command -v qdrant-cli &>/dev/null; then
    # Implementar via qdrant client
    :
  fi

  # Fallback: salva metadata
  local meta_file="$MONOREPO/.claude/vibe-kit/snapshots/${task_id}-meta.json"
  mkdir -p "$(dirname "$meta_file")"
  jq -n \
    --arg task "$task_id" \
    --arg spec "$spec" \
    --arg files "$file_changes" \
    --arg time "$(date -Iseconds)" \
    '{
      task_id: $task,
      spec: $spec,
      file_changes: ($files | split(",")),
      timestamp: $time
    }' > "$meta_file"
}

# Gera summary da conversa atual
generate_summary() {
  local session_file="${HOME}/.claude/projects/-srv-monorepo/current_session.json"

  if [ -f "$session_file" ]; then
    # Pega últimos 2000 chars como summary
    tail -c 2000 "$session_file" | head -c 500
  else
    echo "Session summary unavailable"
  fi
}

main() {
  local task_id="${1:-unknown}"
  local spec="${2:-unknown}"
  local phase="${3:-execute}"

  mkdir -p "$MONOREPO/logs" "$MONOREPO/.claude/vibe-kit/snapshots"

  local summary
  summary=$(generate_summary)

  snapshot_to_mem0 "$task_id" "$spec" "$phase" "$summary"
  snapshot_to_qdrant "$task_id" "$spec"

  log "Snapshot complete for $task_id"
  echo "Snapshot saved: $task_id"
}

main "$@"
