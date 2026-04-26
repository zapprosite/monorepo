#!/bin/bash
# =============================================================================
# nexus-cron-legacy.sh — Legacy Detection Cron Orchestrator
# =============================================================================
# PURPOSE: Main cron script for legacy detection and code quality monitoring
# METHOD:
#   1. Scan all tracked repositories for legacy files
#   2. Detect code smells (hardcoded, salada, placeholder)
#   3. Use Claude CLI for deep analysis (respects 500 RPM)
#   4. Create persistent alerts for issues
#   5. Remind user until action taken
#
# RATE LIMIT: Built-in rate limiting for Claude CLI (500 RPM)
#
# CRON SCHEDULE:
#   */30 * * * * - Full scan
#   0 */6 * * * - Deep analysis with Claude
#   0 9 * * 1-5 - Daily summary on weekdays
#
# TARGET REPOS:
#   - /srv/monorepo
#   - /srv/ops
#   - /srv/hermes-second-brain
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
MONOREPO="${MONOREPO:-/srv/monorepo}"
LOG_DIR="${MONOREPO}/logs"
LEGACY_LOG="${LOG_DIR}/nexus-legacy-cron.log"

# Scripts
LEGACY_DETECTOR="${MONOREPO}/scripts/nexus-legacy-detector.sh"
CODE_SCANNER="${MONOREPO}/scripts/nexus-code-scanner.sh"
ALERT_SCRIPT="${MONOREPO}/scripts/nexus-alert.sh"

# Target repositories
REPOS=(
  "/srv/monorepo"
  "/srv/ops"
  "/srv/hermes-second-brain"
)

# Detection thresholds
LEGACY_DAYS="${LEGACY_DAYS:-90}"
ARCHIVED_DAYS="${ARCHIVED_DAYS:-180}"

# Rate limit
MAX_RPM="${MAX_RPM:-500}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'
[ -t 1 ] || { RED=; GREEN=; YELLOW=; BLUE=; NC=; }

# ===== LOGGING =====
log() { echo -e "${GREEN}[CRON-LEGACY]${NC} $*"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LEGACY_LOG"; }
warn() { echo -e "${YELLOW}[CRON-LEGACY]${NC} $*"; }
error() { echo -e "${RED}[CRON-LEGACY]${NC} $*" >&2; }
info() { echo -e "${BLUE}[CRON-LEGACY]${NC} $*"; }

# ===== INIT =====
init() {
  mkdir -p "$LOG_DIR"
  touch "$LEGACY_LOG" 2>/dev/null

  # Check scripts exist
  for script in "$LEGACY_DETECTOR" "$CODE_SCANNER" "$ALERT_SCRIPT"; do
    if [ ! -x "$script" ]; then
      chmod +x "$script" 2>/dev/null
    fi
  done
}

# ===== SCAN SINGLE REPO =====
scan_repo() {
  local repo="$1"
  local days="${2:-$LEGACY_DAYS}"

  if [ ! -d "$repo" ]; then
    warn "Repo not found: $repo"
    return 1
  fi

  log "Scanning: $repo"

  # Run legacy detector
  if [ -x "$LEGACY_DETECTOR" ]; then
    local legacy_result
    legacy_result=$("$LEGACY_DETECTOR" scan "$repo" "$days" 2>&1)

    # Check for issues
    if echo "$legacy_result" | grep -q "^[0-9]"; then
      local count=$(echo "$legacy_result" | head -1 | cut -d'|' -f1)
      if [ "$count" -gt 0 ]; then
        log "Found $count legacy files in $repo"
        "$ALERT_SCRIPT" alert warn "Legacy files detected" "$repo has $count files not modified in $days days"
      fi
    fi
  fi

  # Run placeholder detection
  if [ -x "$LEGACY_DETECTOR" ]; then
    local placeholders_result
    placeholders_result=$("$LEGACY_DETECTOR" placeholders "$repo" 2>&1)

    if echo "$placeholders_result" | grep -q "PLACEHOLDERS"; then
      local count=$(echo "$placeholders_result" | grep "PLACEHOLDERS" | cut -d'|' -f2)
      if [ "$count" -gt 5 ]; then
        log "Found $count placeholder patterns in $repo"
        "$ALERT_SCRIPT" alert info "Placeholder patterns found" "$repo has $count TODO/FIXME/placeholder occurrences"
      fi
    fi
  fi

  # Run hardcoded detection
  if [ -x "$LEGACY_DETECTOR" ]; then
    local hardcoded_result
    hardcoded_result=$("$LEGACY_DETECTOR" hardcoded "$repo" 2>&1)

    if echo "$hardcoded_result" | grep -q "HARDCODED"; then
      local count=$(echo "$hardcoded_result" | grep "HARDCODED" | cut -d'|' -f2)
      if [ "$count" -gt 0 ]; then
        log "Found $count hardcoded values in $repo"
        "$ALERT_SCRIPT" alert error "Hardcoded values detected" "$repo has $count potential hardcoded secrets"
      fi
    fi
  fi

  # Run salada detection
  if [ -x "$LEGACY_DETECTOR" ]; then
    local salada_result
    salada_result=$("$LEGACY_DETECTOR" salada "$repo" 2>&1)

    if echo "$salada_result" | grep -q "SALADA"; then
      local count=$(echo "$salada_result" | grep "SALADA" | cut -d'|' -f2)
      if [ "$count" -gt 0 ]; then
        log "Found $count messy directories in $repo"
        "$ALERT_SCRIPT" alert warn "Messy directories (salada)" "$repo has $count directories needing organization"
      fi
    fi
  fi

  return 0
}

# ===== SCAN ALL REPOS =====
scan_all() {
  local days="${1:-$LEGACY_DAYS}"

  section "SCANNING ALL REPOSITORIES"

  local total_issues=0

  for repo in "${REPOS[@]}"; do
    scan_repo "$repo" "$days"
    local exit_code=$?

    if [ $exit_code -ne 0 ]; then
      warn "Scan failed for $repo"
    fi
  done

  section "SCAN COMPLETE"
}

# ===== DEEP ANALYSIS WITH CLAUDE CLI =====
deep_analysis() {
  section "DEEP ANALYSIS (Claude CLI)"

  if [ ! -x "$CODE_SCANNER" ]; then
    warn "Code scanner not available"
    return 1
  fi

  for repo in "${REPOS[@]}"; do
    if [ ! -d "$repo" ]; then
      continue
    fi

    log "Deep analyzing: $repo"

    # Rate limited scan
    "$CODE_SCANNER" legacy "$repo" 180 2>&1 | head -50

    sleep 2  # Rate limit buffer
  done

  section "DEEP ANALYSIS COMPLETE"
}

# ===== DAILY SUMMARY =====
daily_summary() {
  section "DAILY LEGACY SUMMARY"

  log "Generating daily summary..."

  echo "Repositories scanned:"
  for repo in "${REPOS[@]}"; do
    if [ -d "$repo" ]; then
      echo "  ✓ $repo"
    else
      echo "  ✗ $repo (not found)"
    fi
  done

  echo ""
  echo "Recent alerts:"
  "$ALERT_SCRIPT" list 2>/dev/null | head -20

  echo ""
  echo "Pending issues:"
  "$ALERT_SCRIPT" remind 2>/dev/null | head -20

  section "SUMMARY COMPLETE"
}

# ===== ESCALATE PENDING ALERTS =====
escalate_alerts() {
  if [ -x "$ALERT_SCRIPT" ]; then
    "$ALERT_SCRIPT" escalate 2>/dev/null
  fi
}

# ===== MAIN =====
main() {
  local command="${1:-scan}"

  init

  case "$command" in
    scan|all)
      scan_all "${2:-}"
      ;;
    deep|analyze)
      deep_analysis
      ;;
    summary|weekly|daily)
      daily_summary
      ;;
    escalate)
      escalate_alerts
      ;;
    test)
      # Test mode - scan one repo
      scan_repo "${2:-/srv/monorepo}" 30
      ;;
    "")
      echo "Usage: $0 <command> [args]"
      echo ""
      echo "Commands:"
      echo "  scan [days]     - Scan all repos (default: $LEGACY_DAYS days)"
      echo "  deep           - Deep analysis with Claude CLI"
      echo "  summary        - Daily summary"
      echo "  escalate       - Escalate pending alerts"
      echo "  test [repo]    - Test scan on one repo"
      echo ""
      echo "Cron setup:"
      echo "  */30 * * * * /srv/monorepo/scripts/nexus-cron-legacy.sh scan"
      echo "  0 */6 * * * /srv/monorepo/scripts/nexus-cron-legacy.sh deep"
      echo "  0 9 * * 1-5 /srv/monorepo/scripts/nexus-cron-legacy.sh summary"
      exit 1
      ;;
    *)
      error "Unknown command: $command"
      main ""
      exit 1
      ;;
  esac
}

main "$@"
