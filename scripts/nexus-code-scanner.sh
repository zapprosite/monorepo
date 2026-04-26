#!/bin/bash
# =============================================================================
# nexus-code-scanner.sh — Claude CLI Powered Code Analysis
# =============================================================================
# PURPOSE: Use Claude Code CLI (-p mode) to analyze code for quality issues
# METHOD:
#   1. Scan repository structure
#   2. Use Claude CLI for deep analysis (non-interactive)
#   3. Detect patterns: hardcoded, salada, placeholder, legacy
#   4. Generate actionable reports
#
# RATE LIMIT: Respects minimax 500 RPM (built-in to CLI)
#
# USAGE:
#   nexus-code-scanner.sh analyze <path>
#   nexus-code-scanner.sh quick <path>
#   nexus-code-scanner.sh deep <path>
#   nexus-code-scanner.sh legacy <path>
#
# OUTPUT: Structured JSON report + terminal output
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
MONOREPO="${MONOREPO:-/srv/monorepo}"
LOG_DIR="${MONOREPO}/logs"
SCAN_LOG="${LOG_DIR}/nexus-scan.log"
REPORT_FILE="${LOG_DIR}/scan-report.json"
CLAUDE_RATE_LIMIT="${CLAUDE_RATE_LIMIT:-500}"  # RPM

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
[ -t 1 ] || { RED=; GREEN=; YELLOW=; BLUE=; CYAN=; MAGENTA=; NC=; }

# ===== LOGGING =====
log() { echo -e "${GREEN}[SCAN]${NC} $*"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$SCAN_LOG" 2>/dev/null; }
warn() { echo -e "${YELLOW}[SCAN]${NC} $*"; }
error() { echo -e "${RED}[SCAN]${NC} $*" >&2; echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >> "$SCAN_LOG"; }
info() { echo -e "${BLUE}[SCAN]${NC} $*"; }
section() { echo ""; echo -e "${MAGENTA}==== $* ====${NC}"; }

# ===== INIT =====
init() {
  mkdir -p "$LOG_DIR"
  touch "$SCAN_LOG" 2>/dev/null
}

# ===== CHECK IF CLAUDE CLI IS AVAILABLE =====
check_claude() {
  if ! command -v claude &>/dev/null; then
    error "Claude CLI not found. Install with: npm install -g @anthropic/claude-code"
    return 1
  fi

  # Check version
  local version=$(claude --version 2>/dev/null || echo "unknown")
  info "Claude CLI version: $version"
  return 0
}

# ===== RATE LIMITER =====
# Simple token bucket: track requests and enforce delay
declare -g LAST_REQUEST_TIME=0
declare -g REQUEST_COUNT=0
REQUEST_WINDOW=60  # seconds

rate_limit() {
  local rpm="$1"

  local now=$(date +%s)
  local elapsed=$((now - LAST_REQUEST_TIME))

  # Reset counter if window passed
  if [ $elapsed -ge $REQUEST_WINDOW ]; then
    LAST_REQUEST_TIME=$now
    REQUEST_COUNT=0
  fi

  # Check if we need to wait
  REQUEST_COUNT=$((REQUEST_COUNT + 1))

  if [ $REQUEST_COUNT -gt $rpm ]; then
    local wait_time=$((REQUEST_WINDOW - elapsed))
    if [ $wait_time -gt 0 ]; then
      info "Rate limit reached ($rpm RPM). Waiting ${wait_time}s..."
      sleep $wait_time
      LAST_REQUEST_TIME=$(date +%s)
      REQUEST_COUNT=1
    fi
  fi
}

# ===== QUICK STRUCTURE SCAN =====
quick_scan() {
  local path="$1"

  section "QUICK STRUCTURE SCAN"

  if [ ! -d "$path" ]; then
    error "Path does not exist: $path"
    return 1
  fi

  info "Analyzing directory structure..."

  # Count files by type
  echo "File types:"
  find "$path" -type f -name "*.*" 2>/dev/null | sed 's/.*\.//' | sort | uniq -c | sort -rn | head -20 | while read count ext; do
    echo "  .$ext: $count files"
  done

  # Directory depth analysis
  echo ""
  echo "Deep directories (>5 levels):"
  find "$path" -type d -mindepth 6 2>/dev/null | head -10 | while read dir; do
    echo "  $dir"
  done

  # Large files
  echo ""
  echo "Large files (>1MB):"
  find "$path" -type f -size +1M 2>/dev/null | head -10 | while read file; do
    local size=$(du -h "$file" 2>/dev/null | cut -f1)
    echo "  $file ($size)"
  done
}

# ===== DEEP ANALYSIS WITH CLAUDE CLI =====
deep_analyze() {
  local path="$1"

  section "DEEP ANALYSIS WITH CLAUDE CLI"

  if ! check_claude; then
    warn "Claude CLI not available, using basic analysis"
    quick_scan "$path"
    return 1
  fi

  info "Running Claude-powered analysis..."

  # Rate limit
  rate_limit $CLAUDE_RATE_LIMIT

  # Analyze with Claude CLI
  local prompt="Analyze the code at $path for the following issues:

1. LEGACY: Files not modified in 90+ days that seem abandoned
2. SALADA: Directories with too many different file types (messy organization)
3. HARDCODED: Hardcoded values, API keys, passwords, secrets, IPs, ports
4. PLACEHOLDER: TODO comments, FIXME, placeholder names, empty files
5. ARCHITECTURE: Wrong file locations, circular dependencies, tight coupling

Return a JSON report:
{
  \"summary\": {
    \"legacy_count\": N,
    \"salada_dirs\": N,
    \"hardcoded_count\": N,
    \"placeholder_count\": N,
    \"arch_issues\": N
  },
  \"issues\": [
    {\"type\": \"legacy\", \"file\": \"path\", \"reason\": \"why legacy\", \"age_days\": N}
  ]
}

Focus on actionable findings. Check:
- /srv/monorepo for the monorepo
- /srv/ops for infrastructure
- /srv/hermes-second-brain for knowledge management"

  # Run Claude in print mode
  local result
  result=$(claude -p "$prompt" --output-format json 2>/dev/null | jq -r '.result // empty' 2>/dev/null)

  if [ -z "$result" ]; then
    warn "Claude CLI analysis failed, using basic scan"
    quick_scan "$path"
    return 1
  fi

  echo "$result" | jq '.' 2>/dev/null || echo "$result"

  # Save to report
  echo "$result" | jq '.' > "$REPORT_FILE" 2>/dev/null
  info "Full report saved to $REPORT_FILE"

  return 0
}

# ===== LEGACY ANALYSIS =====
legacy_analyze() {
  local path="$1"
  local days="${2:-90}"

  section "LEGACY ANALYSIS (>$days days)"

  if [ ! -d "$path" ]; then
    error "Path does not exist: $path"
    return 1
  fi

  info "Finding legacy files..."

  local now=$(date +%s)
  local threshold=$((days * 86400))
  local count=0

  # Find code files
  while IFS= read -r file; do
    [ -z "$file" ] && continue

    local mtime=$(stat -c %Y "$file" 2>/dev/null || echo "0")
    local age=$((now - mtime))

    if [ $age -gt $threshold ]; then
      local age_days=$((age / 86400))
      echo "$file|$age_days"
      count=$((count + 1))

      if [ $count -ge 50 ]; then
        echo "... and more (showing first 50)"
        break
      fi
    fi
  done < <(find "$path" -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.go" -o -name "*.java" -o -name "*.sh" -o -name "*.yml" -o -name "*.yaml" \) 2>/dev/null | head -5000)

  echo ""
  info "Found $count legacy files (>$days days old)"
}

# ===== MAIN =====
main() {
  local command="${1:-}"
  local arg1="${2:-}"
  local arg2="${3:-}"

  init

  case "$command" in
    quick|structure)
      quick_scan "$arg1"
      ;;
    analyze|deep|full)
      deep_analyze "$arg1"
      ;;
    legacy|old)
      legacy_analyze "$arg1" "${arg2:-90}"
      ;;
    check)
      check_claude
      ;;
    "")
      echo "Usage: $0 <command> [path] [args]"
      echo ""
      echo "Commands:"
      echo "  quick <path>       - Quick structure scan"
      echo "  analyze <path>     - Deep analysis with Claude CLI"
      echo "  legacy <path> [d] - Find legacy files (default: 90 days)"
      echo "  check             - Check Claude CLI availability"
      echo ""
      echo "Examples:"
      echo "  $0 quick /srv/monorepo"
      echo "  $0 analyze /srv/monorepo"
      echo "  $0 legacy /srv/monorepo 180"
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
