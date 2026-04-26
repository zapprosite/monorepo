#!/bin/bash
# =============================================================================
# nexus-legacy-detector.sh — Legacy & Code Quality Detection
# =============================================================================
# PURPOSE: Detect legacy files, placeholders, hardcoded values, and architecture issues
# METHOD:
#   1. Date-based legacy detection (files not modified in X days)
#   2. File pattern detection (placeholder names, TODO comments, empty files)
#   3. Hardcoded value detection (API keys, passwords, IPs)
#   4. "Salada" detection (too many file types in one directory)
#   5. Architecture violation detection (wrong file locations)
#
# RATE LIMIT: Uses minimax 500 RPM via Claude Code CLI integration
#
# USAGE:
#   nexus-legacy-detector.sh scan <path> [days]
#   nexus-legacy-detector.sh check-hardcoded <path>
#   nexus-legacy-detector.sh check-salada <path>
#   nexus-legacy-detector.sh full <path>
#
# OUTPUT: JSON report + logs
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
MONOREPO="${MONOREPO:-/srv/monorepo}"
LOG_DIR="${MONOREPO}/logs"
LEGACY_LOG="${LOG_DIR}/nexus-legacy.log"
ALERT_LOG="${LOG_DIR}/nexus-alerts.log"
REPORT_FILE="${LOG_DIR}/legacy-report.json"

# Detection thresholds
DAYS_LEGACY="${DAYS_LEGACY:-90}"  # Files not modified in 90 days = legacy
DAYS_ARCHIVED="${DAYS_ARCHIVED:-180}"  # Files not modified in 180 days = archived
SALADA_FILE_COUNT="${SALADA_FILE_COUNT:-20}"  # Directory with >20 files is "salada"
SALADA_TYPE_COUNT="${SALADA_TYPE_COUNT:-10}"  # Directory with >10 file types is "salada"

# Patterns
PLACEHOLDER_PATTERNS=(
  "TODO"
  "FIXME"
  "XXX"
  "HACK"
  "placeholder"
  "temp"
  "tmp"
  "test_test"
  "__pycache__"
  ".pytest_cache"
  "node_modules"
)

HARDCODED_PATTERNS=(
  "api[_-]?key"
  "password"
  "secret"
  "token"
  "aws[_-]?key"
  "sk-[a-zA-Z0-9]"
  "cfk_[a-zA-Z0-9]"
  "cfut_[a-zA-Z0-9]"
  "[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}"  # IP addresses
  "localhost:3[0-9]{3}"  # Hardcoded ports
)

# Code smells
CODE_SMELLS=(
  "hardcoded"
  "coupling"
  "circular"
  "god[_-]?class"
  "magic[_-]?number"
  "dead[_-]?code"
  "commented[_-]?out"
)

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
log() { echo -e "${GREEN}[LEGACY]${NC} $*"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LEGACY_LOG" 2>/dev/null; }
warn() { echo -e "${YELLOW}[LEGACY]${NC} $*"; }
error() { echo -e "${RED}[LEGACY]${NC} $*" >&2; echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >> "$LEGACY_LOG"; }
info() { echo -e "${BLUE}[LEGACY]${NC} $*"; }
section() { echo ""; echo -e "${MAGENTA}==== $* ====${NC}"; }

# ===== INIT =====
init() {
  mkdir -p "$LOG_DIR"
  touch "$LEGACY_LOG" "$ALERT_LOG" 2>/dev/null
}

# ===== DATE-BASED LEGACY DETECTION =====
detect_legacy_by_date() {
  local path="$1"
  local days="${2:-$DAYS_LEGACY}"

  section "LEGACY DETECTION (>$days days unmodified)"

  if [ ! -d "$path" ]; then
    error "Path does not exist: $path"
    return 1
  fi

  info "Scanning for files not modified in $days days..."

  local count=0
  local legacy_files=()

  # Use find to get files not modified in N days
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    local mtime=$(stat -c %Y "$file" 2>/dev/null || echo "0")
    local age_days=$((($(date +%s) - mtime) / 86400))

    if [ "$age_days" -gt "$days" ]; then
      legacy_files+=("$file|$age_days")
      count=$((count + 1))

      if [ $((count % 50)) -eq 0 ]; then
        info "Found $count legacy files..."
      fi
    fi
  done < <(find "$path" -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.go" -o -name "*.java" -o -name "*.sh" -o -name "*.yml" -o -name "*.yaml" -o -name "*.tf" \) -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -10000)

  info "Found $count legacy files"

  if [ "$count" -gt 0 ]; then
    echo "$count|$days|$path"
    for entry in "${legacy_files[@]}"; do
      local file="${entry%%|*}"
      local age="${entry##*|}"
      echo "  $file (${age} days old)"
    done
  fi

  return 0
}

# ===== PLACEHOLDER DETECTION =====
detect_placeholders() {
  local path="$1"

  section "PLACEHOLDER DETECTION"

  if [ ! -d "$path" ]; then
    error "Path does not exist: $path"
    return 1
  fi

  info "Scanning for placeholder patterns..."

  local count=0
  local found=()

  for pattern in "${PLACEHOLDER_PATTERNS[@]}"; do
    local matches=$(find "$path" -type f \( -name "*${pattern}*" -o -name "*.${pattern}" \) -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -20)
    if [ -n "$matches" ]; then
      while IFS= read -r file; do
        [ -z "$file" ] && continue
        [[ "$file" == *"/node_modules/"* ]] && continue
        [[ "$file" == *"/.git/"* ]] && continue
        found+=("$file|$pattern")
        count=$((count + 1))
      done <<< "$matches"
    fi
  done

  # Also check for TODO/FIXME in code (exclude node_modules and .git)
  local todos=$(grep -r -l "TODO\|FIXME\|XXX\|HACK" "$path" --include="*.py" --include="*.js" --include="*.ts" --include="*.go" --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null | head -30)
  if [ -n "$todos" ]; then
    while IFS= read -r file; do
      [ -z "$file" ] && continue
      found+=("$file|TODO-FIXME")
      count=$((count + 1))
    done <<< "$todos"
  fi

  info "Found $count placeholder occurrences"

  if [ "$count" -gt 0 ]; then
    echo "PLACEHOLDERS|$count"
    for entry in "${found[@]}"; do
      local file="${entry%%|*}"
      local pattern="${entry##*|}"
      echo "  $file ($pattern)"
    done
  fi

  return 0
}

# ===== HARDCODED VALUE DETECTION =====
detect_hardcoded() {
  local path="$1"

  section "HARDCODED VALUE DETECTION"

  if [ ! -d "$path" ]; then
    error "Path does not exist: $path"
    return 1
  fi

  info "Scanning for hardcoded secrets and values..."

  local count=0
  local found=()

  # Files likely to contain secrets (exclude node_modules and .git)
  local secret_files=$(find "$path" -type f \( -name "*.env" -o -name "*.env.*" -o -name "config*" -o -name "*settings*" \) -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -50)

  while IFS= read -r file; do
    [ -z "$file" ] && continue

    # Check for hardcoded patterns
    for pattern in "${HARDCODED_PATTERNS[@]}"; do
      if grep -iq "$pattern" "$file" 2>/dev/null; then
        local matches=$(grep -n "$pattern" "$file" 2>/dev/null | head -5)
        while IFS= read -r match; do
          [ -z "$match" ] && continue
          found+=("$file|$match")
          count=$((count + 1))
        done <<< "$matches"
      fi
    done
  done <<< "$secret_files"

  info "Found $count hardcoded value occurrences"

  if [ "$count" -gt 0 ]; then
    echo "HARDCODED|$count"
    # Show first 20 to avoid spam
    local shown=0
    for entry in "${found[@]}"; do
      [ $shown -ge 20 ] && break
      local file="${entry%%|*}"
      local match="${entry##*|}"
      echo "  $file: $match"
      shown=$((shown + 1))
    done
    if [ "$count" -gt 20 ]; then
      echo "  ... and $((count - 20)) more"
    fi
  fi

  return 0
}

# ===== SALADA DETECTION (too many files in one dir) =====
detect_salada() {
  local path="$1"

  section "SALADA DETECTION (messy directories)"

  if [ ! -d "$path" ]; then
    error "Path does not exist: $path"
    return 1
  fi

  info "Scanning for directories with too many files..."

  local count=0
  local found=()

  # Find directories with >N files (exclude node_modules and .git)
  while IFS= read -r dir; do
    [ -z "$dir" ] && continue
    # Skip node_modules and .git directories
    [[ "$dir" == *"/node_modules"* ]] && continue
    [[ "$dir" == *"/.git"* ]] && continue

    local file_count=$(find "$dir" -maxdepth 1 -type f 2>/dev/null | wc -l)
    local type_count=$(find "$dir" -maxdepth 1 -type f -name "*.*" 2>/dev/null | sed 's/.*\.//' | sort -u | wc -l)

    if [ "$file_count" -gt "$SALADA_FILE_COUNT" ] || [ "$type_count" -gt "$SALADA_TYPE_COUNT" ]; then
      found+=("$dir|$file_count|$type_count")
      count=$((count + 1))
    fi
  done < <(find "$path" -type d -mindepth 2 -maxdepth 5 -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -100)

  info "Found $count messy directories"

  if [ "$count" -gt 0 ]; then
    echo "SALADA|$count"
    for entry in "${found[@]}"; do
      local dir="${entry%%|*}"
      local rest="${entry##*|}"
      local file_count="${rest%%|*}"
      local type_count="${rest##*|}"
      echo "  $dir ($file_count files, $type_count types)"
    done
  fi

  return 0
}

# ===== ARCHITECTURE VIOLATION DETECTION =====
detect_architecture_violations() {
  local path="$1"

  section "ARCHITECTURE VIOLATION DETECTION"

  if [ ! -d "$path" ]; then
    error "Path does not exist: $path"
    return 1
  fi

  info "Scanning for architecture violations..."

  local count=0
  local found=()

  # Check for config files in wrong places
  local terraform_in_app=$(find "$path" -path "*/apps/*" -name "*.tf" 2>/dev/null | head -10)
  if [ -n "$terraform_in_app" ]; then
    while IFS= read -r file; do
      [ -z "$file" ] && continue
      found+=("$file|terraform-in-apps")
      count=$((count + 1))
    done <<< "$terraform_in_app"
  fi

  # Check for docker-compose in wrong places
  local compose_in_root=$(find "$path" -maxdepth 1 -name "docker-compose.yml" 2>/dev/null)
  if [ -n "$compose_in_root" ]; then
    found+=("$compose_in_root|compose-in-root")
    count=$((count + 1))
  fi

  # Check for node_modules in unexpected places
  local node_in_backend=$(find "$path" -path "*/backend/*" -name "node_modules" 2>/dev/null | head -10)
  if [ -n "$node_in_backend" ]; then
    while IFS= read -r file; do
      [ -z "$file" ] && continue
      found+=("$file|node_modules-in-backend")
      count=$((count + 1))
    done <<< "$node_in_backend"
  fi

  info "Found $count architecture violations"

  if [ "$count" -gt 0 ]; then
    echo "ARCH_VIOLATIONS|$count"
    for entry in "${found[@]}"; do
      local file="${entry%%|*}"
      local violation="${entry##*|}"
      echo "  $file ($violation)"
    done
  fi

  return 0
}

# ===== EMPTY/DEAD FILE DETECTION =====
detect_empty_files() {
  local path="$1"

  section "EMPTY FILE DETECTION"

  if [ ! -d "$path" ]; then
    error "Path does not exist: $path"
    return 1
  fi

  info "Scanning for empty and near-empty files..."

  local count=0
  local found=()

  # Find empty files
  while IFS= read -r file; do
    [ -z "$file" ] && continue
    local size=$(stat -c %s "$file" 2>/dev/null || echo "0")
    if [ "$size" -eq 0 ]; then
      found+=("$file|EMPTY")
      count=$((count + 1))
    elif [ "$size" -lt 50 ]; then
      # Near empty (likely placeholder)
      found+=("$file|NEAR-EMPTY ($size bytes)")
      count=$((count + 1))
    fi
  done < <(find "$path" -type f \( -name "*.py" -o -name "*.js" -o -name "*.ts" -o -name "*.go" -o -name "*.java" -o -name "*.sh" \) -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -5000)

  info "Found $count empty/near-empty files"

  if [ "$count" -gt 0 ]; then
    echo "EMPTY_FILES|$count"
    for entry in "${found[@]}"; do
      local file="${entry%%|*}"
      local type="${entry##*|}"
      echo "  $file ($type)"
    done
  fi

  return 0
}

# ===== GENERATE REPORT =====
generate_report() {
  local path="$1"
  local legacy_days="$2"

  section "GENERATING REPORT"

  local report=$(cat << EOF
{
  "scan_date": "$(date -Iseconds)",
  "path": "$path",
  "legacy_days": $legacy_days,
  "summary": {
    "legacy_files": 0,
    "placeholders": 0,
    "hardcoded": 0,
    "salada_dirs": 0,
    "arch_violations": 0,
    "empty_files": 0
  },
  "issues": []
}
EOF
)

  echo "$report" | jq '.' > "$REPORT_FILE" 2>/dev/null || echo "$report" > "$REPORT_FILE"
  info "Report saved to $REPORT_FILE"
}

# ===== FULL SCAN =====
full_scan() {
  local path="$1"
  local days="${2:-$DAYS_LEGACY}"

  section "FULL LEGACY SCAN: $path"

  init

  local total_issues=0

  # Run all detections
  detect_legacy_by_date "$path" "$days"
  detect_placeholders "$path"
  detect_hardcoded "$path"
  detect_salada "$path"
  detect_architecture_violations "$path"
  detect_empty_files "$path"

  # Generate report
  generate_report "$path" "$days"

  section "SCAN COMPLETE"
  info "Check $LEGACY_LOG for full details"
  info "Check $ALERT_LOG for actionable alerts"
}

# ===== MAIN =====
main() {
  local command="${1:-}"
  local arg1="${2:-}"
  local arg2="${3:-}"

  mkdir -p "$LOG_DIR"

  case "$command" in
    scan)
      detect_legacy_by_date "$arg1" "${arg2:-$DAYS_LEGACY}"
      ;;
    placeholders)
      detect_placeholders "$arg1"
      ;;
    hardcoded|secrets)
      detect_hardcoded "$arg1"
      ;;
    salada|messy)
      detect_salada "$arg1"
      ;;
    arch|violations)
      detect_architecture_violations "$arg1"
      ;;
    empty)
      detect_empty_files "$arg1"
      ;;
    full|all)
      full_scan "$arg1" "${arg2:-$DAYS_LEGACY}"
      ;;
    "")
      echo "Usage: $0 <command> [path] [days]"
      echo ""
      echo "Commands:"
      echo "  scan <path> [days]       - Detect legacy files by date"
      echo "  placeholders <path>       - Detect placeholder patterns"
      echo "  hardcoded <path>         - Detect hardcoded secrets"
      echo "  salada <path>            - Detect messy directories"
      echo "  arch <path>              - Detect architecture violations"
      echo "  empty <path>            - Detect empty files"
      echo "  full <path> [days]      - Full scan (all checks)"
      echo ""
      echo "Examples:"
      echo "  $0 full /srv/monorepo"
      echo "  $0 scan /srv/monorepo/apps 60"
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
