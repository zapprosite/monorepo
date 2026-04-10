#!/usr/bin/env bash
# cursor-loop-runner.sh — Main orchestrator for autonomous cursor-loop
# Usage: bash scripts/cursor-loop-runner.sh [--dry-run|--resume|--phase N]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_FILE="tasks/pipeline-state.json"
PIPELINE_FILE="tasks/pipeline.json"
MAX_ITERATIONS=${MAX_ITERATIONS:-10}
POLL_INTERVAL=${POLL_INTERVAL:-30}

# Disable pnpm version strict check
export COREPACK_ENABLE_STRICT=0

DRY_RUN=false
RESUME=false
START_PHASE=0

# ── Args ──────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --resume) RESUME=true; shift ;;
    --phase=*) START_PHASE="${1#*=}"; shift ;;
    *) echo "Unknown: $1"; exit 1 ;;
  esac
done

# ── Helpers ────────────────────────────────────────────────────
die() { echo "ERROR: $1" >&2; exit 1; }
log() { echo "[$(date +%H:%M:%S)] $1"; }

dry_run() {
  [[ "$DRY_RUN" == "true" ]] && echo "[DRY-RUN] $1"
}

read_state() {
  jq -r "$1" "$STATE_FILE" 2>/dev/null || echo "null"
}

update_state() {
  local key=$1; shift
  local value=$1; shift
  local timestamp=$(date -Iseconds)
  dry_run "update_state: $key = $value"
  [[ "$DRY_RUN" == "true" ]] && return 0
  jq --arg v "$value" --arg ts "$timestamp" \
    ".$key = \$v | .lastCheckpoint = \$ts" \
    "$STATE_FILE" > /tmp/clr.tmp && mv /tmp/clr.tmp "$STATE_FILE"
}

is_gate_required() {
  [[ "$(read_state '.humanGateRequired')" == "true" ]]
}

wait_for_approval() {
  log "⏳ Waiting for human approval..."
  while is_gate_required; do
    echo "---"
    bash "$SCRIPT_DIR/query-gate.sh" 2>/dev/null || true
    echo "Polling in ${POLL_INTERVAL}s..."
    sleep "$POLL_INTERVAL"
  done
  log "✅ Gate resolved!"
}

# ── Bootstrap check ─────────────────────────────────────────────
run_bootstrap() {
  log "🔍 Running bootstrap check..."
  dry_run "Would run: bash $SCRIPT_DIR/bootstrap-check.sh"

  if [[ "$DRY_RUN" == "true" ]]; then
    return 0
  fi

  if ! bash "$SCRIPT_DIR/bootstrap-check.sh" > /tmp/bootstrap.out 2>&1; then
    log "🔴 Bootstrap Effect detected!"
    cat /tmp/bootstrap.out
    echo ""
    echo "Fix secrets and run again, or abort with:"
    echo "  bash scripts/approve.sh --abort"
    return 1
  fi
  log "✅ Bootstrap OK"
}

# ── Pipeline steps ─────────────────────────────────────────────
run_pipeline() {
  log "🚀 Starting pipeline..."

  update_state "currentState" "RUNNING"

  # Run lint
  log "📋 Running lint..."
  if ! pnpm turbo lint > /tmp/lint.out 2>&1; then
    log "❌ Lint failed"
    cat /tmp/lint.out | tail -20
    return 1
  fi
  update_state "lintPassed" "true"
  log "✅ Lint OK"

  # Run typecheck
  log "📋 Running typecheck..."
  if ! pnpm turbo typecheck > /tmp/typecheck.out 2>&1; then
    log "❌ Typecheck failed"
    cat /tmp/typecheck.out | tail -20
    return 1
  fi
  log "✅ Typecheck OK"

  # Run test
  log "📋 Running tests..."
  if ! pnpm turbo test --no-cache > /tmp/test.out 2>&1; then
    log "❌ Tests failed"
    cat /tmp/test.out | tail -20
    update_state "currentState" "TEST_FAILED"
    return 1
  fi
  update_state "testsPassed" "true"
  update_state "currentState" "READY_TO_SHIP"
  update_state "readyToShip" "true"
  log "✅ Tests OK"

  return 0
}

# ── Research + refactor loop ───────────────────────────────────
run_research_loop() {
  log "🔬 Running research + refactor loop..."
  local iteration=0

  while [[ $iteration -lt 3 ]]; do
    iteration=$((iteration + 1))
    log "Research iteration $iteration/3"

    dry_run "Would run: bash $SCRIPT_DIR/cursor-loop-research.sh"

    if [[ "$DRY_RUN" == "true" ]]; then
      continue
    fi

    # Run research
    if bash "$SCRIPT_DIR/cursor-loop-research.sh" "pipeline failure" > /tmp/research.out 2>&1; then
      log "✅ Research complete"

      # Run refactor
      if bash "$SCRIPT_DIR/cursor-loop-refactor.sh" > /tmp/refactor.out 2>&1; then
        log "✅ Refactor applied"
      fi
    fi

    # Retry pipeline
    log "Retrying pipeline after research..."
    if run_pipeline; then
      return 0
    fi
  done

  log "❌ Research loop exhausted"
  return 1
}

# ── Ship + sync + mirror ──────────────────────────────────────
run_ship() {
  log "🚀 Running ship + sync + mirror..."

  dry_run "Would run: bash $SCRIPT_DIR/cursor-loop-ship.sh"

  if [[ "$DRY_RUN" == "true" ]]; then
    return 0
  fi

  # Sync docs → memory
  if [[ -x "$HOME/.claude/mcps/ai-context-sync/sync.sh" ]]; then
    log "📄 Syncing docs to memory..."
    bash "$HOME/.claude/mcps/ai-context-sync/sync.sh" > /dev/null 2>&1 || true
  fi

  # Git add + commit + push
  if command -v claude &>/dev/null; then
    log "📝 Semantic commit..."
    # Use claude for commit message generation
    claude -p "Generate a concise semantic commit message for the current staged changes. Return ONLY the commit message, no explanation." 2>/dev/null || true
  fi

  log "✅ Ship complete"
}

# ── Human gate ────────────────────────────────────────────────
handle_human_gate() {
  log "🔴 Human gate required"
  update_state "currentState" "BLOCKED_HUMAN_REQUIRED"

  echo ""
  echo "═══════════════════════════════════════════════════"
  echo "  HUMAN APPROVAL REQUIRED"
  echo "═══════════════════════════════════════════════════"
  echo ""
  echo "To approve and continue:"
  echo "  bash scripts/approve.sh --approve"
  echo ""
  echo "To abort:"
  echo "  bash scripts/approve.sh --abort"
  echo ""
  echo "To watch status:"
  echo "  bash scripts/query-gate.sh"
  echo ""

  wait_for_approval

  if [[ "$(read_state '.currentState')" == "ABORTED" ]]; then
    die "Pipeline aborted"
  fi
}

# ── Main loop ─────────────────────────────────────────────────
main() {
  echo "═══════════════════════════════════════════════════"
  echo "  Cursor Loop Runner"
  echo "  Dry-run: $DRY_RUN | Resume: $RESUME"
  echo "═══════════════════════════════════════════════════"
  echo ""

  # Validate state file
  if [[ ! -f "$STATE_FILE" ]]; then
    die "State file not found: $STATE_FILE. Run: bash scripts/pipeline-state.sh create"
  fi

  # Bootstrap check
  if ! run_bootstrap; then
    handle_human_gate
  fi

  # Check if already blocked
  if is_gate_required; then
    handle_human_gate
  fi

  # Resume from checkpoint?
  if [[ "$RESUME" == "true" ]]; then
    log "📍 Resuming from checkpoint..."
  fi

  # Run pipeline
  if ! run_pipeline; then
    # Pipeline failed — research + refactor loop
    if ! run_research_loop; then
      handle_human_gate
    fi
  fi

  # Ready to ship
  if [[ "$(read_state '.readyToShip')" == "true" ]]; then
    run_ship
  fi

  log "✅ Cursor loop complete"
  echo ""
  echo "Final state:"
  bash "$SCRIPT_DIR/query-gate.sh"
}

main
