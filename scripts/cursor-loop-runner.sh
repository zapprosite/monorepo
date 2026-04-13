#!/usr/bin/env bash
# cursor-loop-runner.sh — Main orchestrator for autonomous cursor-loop
# Usage: bash scripts/cursor-loop-runner.sh [--dry-run|--resume]
#
# Environment:
#   MAX_ITERATIONS   Max research-loop iterations (default: 10)
#   POLL_INTERVAL    Human-gate poll interval in seconds (default: 30)
#   GATE_TIMEOUT      Max seconds to wait for human gate (default: 7200 = 2h)
#   DRY_RUN           Set to 'true' to simulate without side effects

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATE_FILE="tasks/pipeline-state.json"
PIPELINE_FILE="tasks/pipeline.json"
MAX_ITERATIONS=${MAX_ITERATIONS:-10}
POLL_INTERVAL=${POLL_INTERVAL:-30}
GATE_TIMEOUT=${GATE_TIMEOUT:-7200}

# Disable pnpm version strict check
export COREPACK_ENABLE_STRICT=0

DRY_RUN=false
RESUME=false

# ── Args ──────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true; shift ;;
    --resume) RESUME=true; shift ;;
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
  if [[ ! -f "$STATE_FILE" ]]; then
    echo "null"
    return
  fi
  jq -r "$1" "$STATE_FILE" 2>/dev/null || echo "null"
}

# Atomic multi-key state update using a single jq call
update_state() {
  local updates=$1  # JSON object with keys to merge
  local timestamp
  timestamp=$(date -Iseconds)

  dry_run "update_state: $updates"
  [[ "$DRY_RUN" == "true" ]] && return 0

  if [[ ! -f "$STATE_FILE" ]]; then
    die "State file not found: $STATE_FILE"
  fi

  # Merge updates + lastCheckpoint in one atomic jq call
  jq --arg ts "$timestamp" \
    "($updates) + { lastCheckpoint: \$ts }" \
    "$STATE_FILE" > /tmp/clr.tmp && mv /tmp/clr.tmp "$STATE_FILE"
}

is_gate_required() {
  [[ "$(read_state '.humanGateRequired')" == "true" ]]
}

wait_for_approval() {
  log "⏳ Waiting for human approval (timeout: ${GATE_TIMEOUT}s)..."
  local waited=0

  while is_gate_required; do
    echo "---"
    bash "$SCRIPT_DIR/query-gate.sh" 2>/dev/null || true
    echo "Polling in ${POLL_INTERVAL}s... (waited ${waited}s)"
    sleep "$POLL_INTERVAL"
    waited=$((waited + POLL_INTERVAL))

    if [[ $waited -ge $GATE_TIMEOUT ]]; then
      log "❌ Gate timeout after ${GATE_TIMEOUT}s"
      return 124
    fi
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

  update_state '{ "currentState": "RUNNING" }'

  # Run lint
  log "📋 Running lint..."
  if ! pnpm turbo lint > /tmp/lint.out 2>&1; then
    log "❌ Lint failed"
    cat /tmp/lint.out | tail -20
    update_state '{ "currentState": "LINT_FAILED", "lintPassed": "false" }'
    return 1
  fi
  log "✅ Lint OK"

  # Run typecheck
  log "📋 Running typecheck..."
  if ! pnpm turbo typecheck > /tmp/typecheck.out 2>&1; then
    log "❌ Typecheck failed"
    cat /tmp/typecheck.out | tail -20
    update_state '{ "currentState": "TYPECHECK_FAILED", "lintPassed": "true", "typecheckPassed": "false" }'
    return 1
  fi
  log "✅ Typecheck OK"

  # Run test
  log "📋 Running tests..."
  if ! pnpm turbo test --no-cache > /tmp/test.out 2>&1; then
    log "❌ Tests failed"
    cat /tmp/test.out | tail -20
    update_state '{ "currentState": "TEST_FAILED", "lintPassed": "true", "typecheckPassed": "true", "testsPassed": "false" }'
    return 1
  fi

  update_state '{ "currentState": "READY_TO_SHIP", "lintPassed": "true", "typecheckPassed": "true", "testsPassed": "true", "readyToShip": "true" }'
  log "✅ Tests OK"

  return 0
}

# ── Research + refactor loop ───────────────────────────────────
run_research_loop() {
  log "🔬 Running research + refactor loop (max iterations: $MAX_ITERATIONS)..."
  local iteration=0

  while [[ $iteration -lt $MAX_ITERATIONS ]]; do
    iteration=$((iteration + 1))
    log "Research iteration $iteration/$MAX_ITERATIONS"

    if [[ "$DRY_RUN" == "true" ]]; then
      dry_run "Would run: cursor-loop-research.sh + cursor-loop-refactor.sh"
      continue
    fi

    # Capture research output to timestamped file, then copy to research-latest.md
    # so refactor.sh (which defaults to research-latest.md) receives the results
    local research_ts
    research_ts="$(date +%Y%m%d-%H%M%S)"
    local research_file=".cursor-loop/logs/research-${research_ts}.md"
    local latest_file=".cursor-loop/logs/research-latest.md"

    if bash "$SCRIPT_DIR/cursor-loop-research.sh" "pipeline failure" "$research_file" > /tmp/research.out 2>&1; then
      log "✅ Research complete: $research_file"

      # Mirror to research-latest.md for refactor.sh (which defaults to that path)
      cp "$research_file" "$latest_file"
      log "📄 Mirrored to $latest_file"

      # Run refactor with explicit research file
      if bash "$SCRIPT_DIR/cursor-loop-refactor.sh" "$latest_file" > /tmp/refactor.out 2>&1; then
        log "✅ Refactor applied"
      else
        log "⚠️  Refactor returned non-zero"
        cat /tmp/refactor.out | tail -10
      fi
    else
      log "⚠️  Research returned non-zero"
      cat /tmp/research.out | tail -10
    fi

    # Retry pipeline
    log "Retrying pipeline after research..."
    if run_pipeline; then
      return 0
    fi
  done

  log "❌ Research loop exhausted after $MAX_ITERATIONS iterations"
  return 1
}

# ── Ship + sync + mirror ──────────────────────────────────────
run_ship() {
  log "🚀 Running ship..."

  # Sync docs → memory
  if [[ -x "$HOME/.claude/mcps/ai-context-sync/sync.sh" ]]; then
    dry_run "Would sync docs to memory"
    if [[ "$DRY_RUN" != "true" ]]; then
      log "📄 Syncing docs to memory..."
      bash "$HOME/.claude/mcps/ai-context-sync/sync.sh" > /dev/null 2>&1 || true
    fi
  fi

  # Check for staged changes and commit
  if [[ "$DRY_RUN" == "true" ]]; then
    dry_run "Would commit and push staged changes"
    return 0
  fi

  if git diff --cached --quiet 2>/dev/null; then
    log "ℹ️  No staged changes to commit"
  else
    log "📝 Committing staged changes..."
    if command -v claude &>/dev/null; then
      local msg
      msg=$(claude -p "Generate a concise semantic commit message for the current staged changes. Return ONLY the commit message, no explanation." 2>/dev/null) || msg="chore: staged changes"
      git commit -m "$msg" 2>/dev/null || log "⚠️  git commit failed"
    else
      git commit -m "chore: staged changes" 2>/dev/null || log "⚠️  git commit failed"
    fi
  fi

  log "✅ Ship complete"
}

# ── Human gate ────────────────────────────────────────────────
handle_human_gate() {
  log "🔴 Human gate required"
  update_state '{ "currentState": "BLOCKED_HUMAN_REQUIRED" }'

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

  if ! wait_for_approval; then
    die "Gate timeout — human approval not received within ${GATE_TIMEOUT}s"
  fi

  if [[ "$(read_state '.currentState')" == "ABORTED" ]]; then
    die "Pipeline aborted by human"
  fi
}

# ── Resume from checkpoint ─────────────────────────────────────
resume_from_checkpoint() {
  local checkpoint
  checkpoint=$(read_state '.lastCheckpoint')
  if [[ "$checkpoint" != "null" && "$checkpoint" != "" ]]; then
    log "📍 Last checkpoint: $checkpoint"
  fi

  local state
  state=$(read_state '.currentState')
  log "📍 Resuming from state: $state"

  case "$state" in
    RUNNING|LINT_FAILED|TYPECHECK_FAILED|TEST_FAILED)
      log "📍 Will retry pipeline from current state"
      ;;
    READY_TO_SHIP)
      log "📍 Previous run completed pipeline — skipping to ship"
      run_ship
      exit 0
      ;;
    BLOCKED_HUMAN_REQUIRED)
      log "📍 Human gate still pending"
      handle_human_gate
      ;;
    ABORTED)
      die "Previous run was aborted. Start fresh."
      ;;
    null|"")
      log "📍 No prior state — starting fresh"
      ;;
    *)
      log "📍 Unknown state '$state' — starting fresh"
      ;;
  esac
}

# ── Main loop ─────────────────────────────────────────────────
main() {
  echo "═══════════════════════════════════════════════════"
  echo "  Cursor Loop Runner"
  echo "  Dry-run: $DRY_RUN | Resume: $RESUME"
  echo "  Max research iterations: $MAX_ITERATIONS"
  echo "  Gate timeout: ${GATE_TIMEOUT}s"
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
    resume_from_checkpoint
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
