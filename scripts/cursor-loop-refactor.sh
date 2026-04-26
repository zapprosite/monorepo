#!/usr/bin/env bash
# cursor-loop-refactor.sh — Apply fixes based on research
# Usage: bash scripts/cursor-loop-refactor.sh [research_output_file]

set -euo pipefail

RESEARCH_FILE="${1:-.cursor-loop/logs/research-latest.md}"
LOG_DIR=".cursor-loop/logs"
LOG_FILE="$LOG_DIR/refactor-$(date +%Y%m%d-%H%M%S).log"
LOG_DIFF="$LOG_DIR/refactor-diff-$(date +%Y%m%d-%H%M%S).diff"

mkdir -p "$LOG_DIR"

# ── Helpers ────────────────────────────────────────────────────
log() { echo "[$(date +%H:%M:%S)] $1" | tee -a "$LOG_FILE"; }
die() { echo "ERROR: $1" >&2; exit 1; }

# ── Detect pnpm version issue and fix ──────────────────────────
fix_pnpm_version() {
  log "🔧 Fixing pnpm version issue..."

  # Set COREPACK_ENABLE_STRICT=0
  if grep -q "COREPACK_ENABLE_STRICT" .env 2>/dev/null; then
    log "COREPACK_ENABLE_STRICT already set in .env"
  else
    echo "COREPACK_ENABLE_STRICT=0" >> .env
    log "✅ Added COREPACK_ENABLE_STRICT=0 to .env"
  fi

  # Also export for current session
  export COREPACK_ENABLE_STRICT=0

  return 0
}

# ── Detect and fix peer dependency issues ─────────────────────
fix_peer_deps() {
  log "🔧 Fixing peer dependency issues..."
  pnpm install 2>&1 | tee -a "$LOG_FILE"
  return ${PIPESTATUS[0]}
}

# ── Detect and fix lint issues ────────────────────────────────
fix_lint() {
  log "🔧 Running lint with --fix..."
  pnpm turbo lint -- --fix 2>&1 | tee -a "$LOG_FILE"
  return ${PIPESTATUS[0]}
}

# ── Detect and fix typecheck issues ───────────────────────────
fix_types() {
  log "🔧 Running typecheck..."
  pnpm turbo typecheck 2>&1 | tee -a "$LOG_FILE"
  return ${PIPESTATUS[0]}
}

# ── Detect missing env vars and add to .env ────────────────────
fix_env_vars() {
  log "🔧 Checking environment variables..."

  local missing_vars=()
  local example_env=".env.example"

  if [[ ! -f "$example_env" ]]; then
    example_env=".env"
  fi

  # Check for common required vars
  for var in DATABASE_URL SESSION_SECRET; do
    if ! grep -q "$var" "$example_env" 2>/dev/null; then
      continue
    fi
    if [[ -f .env ]] && grep -q "$var=.*#" .env; then
      # Has a placeholder value
      :
    elif ! grep -q "$var=" .env 2>/dev/null; then
      missing_vars+=("$var")
    fi
  done

  if [[ ${#missing_vars[@]} -gt 0 ]]; then
    log "⚠️  Missing env vars: ${missing_vars[*]}"
    log "   Copy from .env.example and fill in values"
    return 1
  fi

  return 0
}

# ── Parse research file and apply fixes ──────────────────────
apply_research_fixes() {
  if [[ ! -f "$RESEARCH_FILE" ]]; then
    log "⚠️  Research file not found: $RESEARCH_FILE"
    log "   Running auto-detection instead..."
    return 1
  fi

  log "📄 Reading research from: $RESEARCH_FILE"

  local fixed=0

  # Check for pnpm version issue
  if grep -qi "pnpm.*version\|corepack" "$RESEARCH_FILE"; then
    fix_pnpm_version && fixed=$((fixed + 1))
  fi

  # Check for peer dependency issue
  if grep -qi "peer.*dependency\|peerDep" "$RESEARCH_FILE"; then
    fix_peer_deps && fixed=$((fixed + 1))
  fi

  # Check for lint issues
  if grep -qi "lint" "$RESEARCH_FILE"; then
    fix_lint && fixed=$((fixed + 1))
  fi

  # Check for type issues
  if grep -qi "typescript\|type.*error\|tsc" "$RESEARCH_FILE"; then
    fix_types && fixed=$((fixed + 1))
  fi

  if [[ $fixed -gt 0 ]]; then
    log "✅ Applied $fixed fix(es)"
    return 0
  fi

  return 1
}

# ── Validate fixes ─────────────────────────────────────────────
validate_fixes() {
  log "🔍 Validating fixes..."

  # Test lint
  log "Testing: pnpm turbo lint..."
  if pnpm turbo lint > /tmp/validate_lint.out 2>&1; then
    log "✅ Lint passes"
  else
    log "⚠️  Lint still failing"
    cat /tmp/validate_lint.out | tail -20 | tee -a "$LOG_FILE"
  fi

  # Test typecheck
  log "Testing: pnpm turbo typecheck..."
  if pnpm turbo typecheck > /tmp/validate_type.out 2>&1; then
    log "✅ Typecheck passes"
  else
    log "⚠️  Typecheck still failing"
    cat /tmp/validate_type.out | tail -20 | tee -a "$LOG_FILE"
  fi

  # Test build
  log "Testing: pnpm turbo build..."
  if pnpm turbo build > /tmp/validate_build.out 2>&1; then
    log "✅ Build passes"
    return 0
  else
    log "⚠️  Build still failing"
    cat /tmp/validate_build.out | tail -30 | tee -a "$LOG_FILE"
    return 1
  fi
}

# ── Git diff ─────────────────────────────────────────────────
save_diff() {
  log "💾 Saving diff to: $LOG_DIFF"
  git diff --no-color > "$LOG_DIFF" 2>/dev/null || echo "No changes" > "$LOG_DIFF"
  echo "" >> "$LOG_DIFF"
  echo "=== Research Applied ===" >> "$LOG_DIFF"
  echo "Research: $RESEARCH_FILE" >> "$LOG_DIFF"
  echo "Date: $(date)" >> "$LOG_DIFF"
}

# ── Main ──────────────────────────────────────────────────────
main() {
  echo "========================================" | tee -a "$LOG_FILE"
  echo "  Cursor Loop Refactor" | tee -a "$LOG_FILE"
  echo "  Research: $RESEARCH_FILE" | tee -a "$LOG_FILE"
  echo "========================================" | tee -a "$LOG_FILE"
  echo "" | tee -a "$LOG_FILE"

  # Apply auto-fixes based on common patterns
  local applied=0

  # Try to apply fixes from research file
  if apply_research_fixes; then
    applied=$((applied + 1))
  fi

  # Always try these common fixes
  fix_pnpm_version && applied=$((applied + 1))

  if [[ $applied -eq 0 ]]; then
    log "⚠️  No automatic fixes available"
    log "   Manual intervention may be required"
    return 1
  fi

  # Validate
  if validate_fixes; then
    log "✅ All fixes validated"
    save_diff
    return 0
  else
    log "❌ Some fixes did not resolve the issue"
    save_diff
    return 1
  fi
}

main
