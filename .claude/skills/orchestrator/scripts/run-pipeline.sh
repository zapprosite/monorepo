#!/bin/bash
# Anti-hardcoded: all config via process.env
set -euo pipefail

SPEC="$1"
if [ -z "$SPEC" ]; then
  echo "Usage: run-pipeline.sh <SPEC-NNN>"
  exit 1
fi

PIPELINE="pipeline-$(date +%Y%m%d-%H%M%S)"
LOG_DIR=".claude/skills/orchestrator/logs"
STATE_DIR="tasks/agent-states"
STATE_FILE="tasks/pipeline.json"

mkdir -p "$LOG_DIR" "$STATE_DIR"

# Init pipeline state
cat > "$STATE_FILE" <<EOF
{
  "pipeline": "$PIPELINE",
  "spec": "$SPEC",
  "phase": 1,
  "agents": {},
  "started": "$(date -I)"
}
EOF

log() { echo "[$(date '+%H:%M:%S')] $1"; }

# ── FASE 1 ────────────────────────────────────────────
log "FASE 1: SPEC-ANALYZER + ARCHITECT"
snapshot.sh "pre-phase-1"

SPEC-ANALYZER --spec "$SPEC" --pipeline "$PIPELINE" &
ARCHITECT --spec "$SPEC" --pipeline "$PIPELINE" &

if ! wait-for-phase.sh 1; then
  log "❌ FASE 1 FALHOU"
  rollback.sh
  exit 1
fi

# ── FASE 2 ────────────────────────────────────────────
log "FASE 2: CODER-1 + CODER-2"
snapshot.sh "pre-phase-2"

CODER-1 --spec "$SPEC" --pipeline "$PIPELINE" &
CODER-2 --spec "$SPEC" --pipeline "$PIPELINE" &

if ! wait-for-phase.sh 2; then
  log "❌ FASE 2 FALHOU"
  rollback.sh
  ship.sh --issue
  exit 1
fi

# ── FASE 3 ────────────────────────────────────────────
log "FASE 3: TESTER + DOCS + SMOKE + REVIEWER"
snapshot.sh "pre-phase-3"

TESTER --spec "$SPEC" --pipeline "$PIPELINE"
DOCS --spec "$SPEC" --pipeline "$PIPELINE"
SMOKE --spec "$SPEC" --pipeline "$PIPELINE"
REVIEWER --spec "$SPEC" --pipeline "$PIPELINE"

# ── SHIP ─────────────────────────────────────────────
log "SHIPPING..."
ship.sh --pr

log "✅ Pipeline $PIPELINE completo"
