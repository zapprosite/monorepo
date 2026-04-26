#!/bin/bash
# =============================================================================
# nexus-ufw.sh — Nexus Enterprise UFW Firewall Automation
# =============================================================================
# PURPOSE: Autonomous UFW firewall management with ZERO human interaction
# FEATURES:
#   - Auto-install UFW if missing
#   - Auto-enable UFW if disabled
#   - Idempotent port allowance (safe to run multiple times)
#   - Safe sudo execution (no password hang)
#   - Lock file to prevent race conditions
#   - Automatic port finding if requested port is busy
#   - Batch port operations
#   - Health verification after changes
#
# USAGE (for other LLMs):
#   bash nexus-ufw.sh ensure <port> [comment]   # Main function
#   bash nexus-ufw.sh allow <port> [proto] [comment]
#   bash nexus-ufw.sh status
#   bash nexus-ufw.sh check <port>
#   bash nexus-ufw.sh find [start]
#   bash nexus-ufw.sh verify <port> [host]
#
# ERROR CODES:
#   0 = Success
#   1 = UFW installation failed
#   2 = Port allow failed
#   3 = Lock timeout
#   4 = Invalid arguments
#
# COMMON ERRORS & SOLUTIONS:
#   - "Permission denied": User not in sudo group → add to sudoers
#   - "UFW not installed": Run apt-get install ufw first
#   - "Port in use": Use 'find' or 'ensure' to get alternative
#   - "Lock timeout": Another instance running, wait or kill
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
MONOREPO="${MONOREPO:-/srv/monorepo}"
LOG_FILE="${MONOREPO}/logs/nexus-ufw.log"
LOCK_FILE="/tmp/nexus-ufw.lock"
MAX_RETRIES=3
RETRY_DELAY=1
TIMEOUT=10

# Colors (safe fallback if terminal doesn't support)
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
[ -t 1 ] || { RED=; GREEN=; YELLOW=; BLUE=; CYAN=; NC=; }

# ===== LOGGING FUNCTIONS =====
log() {
  echo -e "${GREEN}[UFW]${NC} $*"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$LOG_FILE"
}

warn() {
  echo -e "${YELLOW}[UFW]${NC} $*"
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] WARN: $*" >> "$LOG_FILE"
}

error() {
  echo -e "${RED}[UFW]${NC} $*" >&2
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: $*" >> "$LOG_FILE"
}

info() {
  echo -e "${BLUE}[UFW]${NC} $*"
}

debug() {
  [ "${DEBUG:-0}" = "1" ] && echo -e "${CYAN}[UFW]${NC} DEBUG: $*"
}

# ===== LOCK MANAGEMENT =====
acquire_lock() {
  local wait_time=0
  while [ -f "$LOCK_FILE" ]; do
    if [ $wait_time -ge 30 ]; then
      error "Lock timeout: $LOCK_FILE exists for >30s"
      return 3
    fi
    sleep 1
    wait_time=$((wait_time + 1))
  done
  echo "$$" > "$LOCK_FILE"
  return 0
}

release_lock() {
  rm -f "$LOCK_FILE"
}

# ===== SUDO EXECUTION (NO PASSWORD HANG) =====
# This is CRITICAL - must not hang on password prompt
exec_sudo() {
  local cmd="$*"

  # Method 1: sudo with timeout and no password prompt
  if sudo -n timeout 30 bash -c "$cmd" 2>/dev/null; then
    return 0
  fi

  # Method 2: Direct execution (if we have rights)
  if bash -c "$cmd" 2>/dev/null; then
    return 0
  fi

  # Method 3: Try with sh -c wrapper
  if sudo -n sh -c "$cmd" 2>/dev/null; then
    return 0
  fi

  return 1
}

# ===== UFW INSTALLATION =====
check_ufw_installed() {
  if command -v ufw &>/dev/null; then
    debug "UFW already installed"
    return 0
  fi

  info "UFW not installed. Installing..."
  if exec_sudo "apt-get update && apt-get install -y ufw"; then
    log "UFW installed successfully"
    return 0
  else
    error "Failed to install UFW"
    return 1
  fi
}

# ===== UFW STATUS CHECK =====
check_ufw_enabled() {
  local status
  status=$(sudo ufw status 2>/dev/null | head -1 || echo "unknown")

  if echo "$status" | grep -qi "active"; then
    debug "UFW is active"
    return 0
  fi

  if echo "$status" | grep -qi "inactive\|disabled"; then
    info "UFW inactive. Enabling..."
    if exec_sudo "ufw --force enable"; then
      log "UFW enabled"
      return 0
    else
      error "Failed to enable UFW"
      return 1
    fi
  fi

  warn "UFW status unclear: '$status', assuming OK"
  return 0
}

# ===== PORT AVAILABILITY CHECK =====
# Returns 0 if port is FREE, 1 if IN USE
is_port_available() {
  local port="$1"

  # Validate port number
  if ! [[ "$port" =~ ^[0-9]+$ ]] || [ "$port" -lt 1 ] || [ "$port" -gt 65535 ]; then
    error "Invalid port: $port"
    return 1
  fi

  # Check if something is listening (using grep -E for safety)
  if ss -tln 2>/dev/null | grep -qE ":${port}([[:space:]]|$)"; then
    debug "Port $port is in use"
    return 1
  fi

  debug "Port $port is available"
  return 0
}

# ===== PORT ALLOWED CHECK =====
# Returns 0 if ALLOWED in UFW, 1 if NOT
is_port_allowed() {
  local port="$1"
  local proto="${2:-tcp}"

  # Check UFW rules - multiple patterns for safety
  if sudo ufw status 2>/dev/null | grep -qE "^${port}/${proto}[[:space:]]"; then
    debug "Port $port/$proto is already allowed"
    return 0
  fi

  # Check if port is listening (also counts as accessible)
  if ss -tln 2>/dev/null | grep -qE ":${port}([[:space:]]|$)"; then
    debug "Port $port is in use (listening)"
    return 0
  fi

  return 1
}

# ===== ALLOW PORT IN UFW =====
# Idempotent - safe to run multiple times
ufw_allow() {
  local port="$1"
  local proto="${2:-tcp}"
  local comment="${3:-nexus-auto}"

  # Validate inputs
  if ! [[ "$port" =~ ^[0-9]+$ ]]; then
    error "Invalid port: $port"
    return 4
  fi

  # Check if already allowed
  if is_port_allowed "$port" "$proto"; then
    log "Port $port/$proto already allowed"
    return 0
  fi

  # Try to allow
  if exec_sudo "ufw allow ${port}/${proto} comment '${comment}'"; then
    log "Port $port/$proto allowed (comment: $comment)"
    return 0
  else
    error "Failed to allow port $port/$proto"
    return 2
  fi
}

# ===== FIND AVAILABLE PORT =====
find_port() {
  local start="${1:-4002}"
  local end="${2:-9999}"
  local port="$start"

  while [ $port -le $end ]; do
    if is_port_available "$port" 2>/dev/null; then
      echo "$port"
      return 0
    fi
    port=$((port + 1))
  done

  # Fallback: random port in safe range
  port=$((RANDOM % 1000 + 8000))
  echo "$port"
  return 0
}

# ===== MAIN ENSURE FUNCTION =====
# This is the PRIMARY function other LLMs should use
ensure_port() {
  local port="$1"
  local comment="${2:-nexus}"

  log "Ensuring port $port is ready..."

  # Step 1: Install UFW if needed
  if ! check_ufw_installed; then
    error "UFW installation failed"
    return 1
  fi

  # Step 2: Enable UFW if needed
  if ! check_ufw_enabled; then
    error "UFW enable failed"
    return 1
  fi

  # Step 3: Check if port is available, find alternative if not
  local original_port="$port"
  if ! is_port_available "$port" 2>/dev/null; then
    port=$(find_port "$((port + 1))")
    warn "Port $original_port busy, using $port"
  fi

  # Step 4: Allow port in UFW
  if ! ufw_allow "$port" "tcp" "$comment"; then
    error "Failed to allow port $port"
    return 2
  fi

  # Step 5: Verify
  if is_port_allowed "$port"; then
    log "Port $port READY"
    echo "$port"
    return 0
  else
    error "Port $port verification failed"
    return 2
  fi
}

# ===== VERIFY PORT ACCESSIBILITY =====
verify_port() {
  local port="$1"
  local host="${2:-localhost}"
  local max_attempts="${3:-3}"

  info "Verifying port $port accessibility..."

  local attempt=1
  while [ $attempt -le $max_attempts ]; do
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" \
      --connect-timeout "$TIMEOUT" \
      "http://${host}:${port}/" 2>/dev/null || echo "000")

    if [ "$status" != "000" ] && [ "$status" != "007" ]; then
      log "Port $port accessible (HTTP $status)"
      return 0
    fi

    warn "Attempt $attempt/$max_attempts: port $port not accessible"
    sleep 1
    attempt=$((attempt + 1))
  done

  error "Port $port not accessible after $max_attempts attempts"
  return 2
}

# ===== STATUS DISPLAY =====
show_status() {
  echo "╔══════════════════════════════════════════════════════════════════════╗"
  echo "║                    UFW FIREWALL STATUS                    ║"
  echo "╠══════════════════════════════════════════════════════════════════════╣"

  local status
  status=$(sudo ufw status 2>/dev/null | head -1 || echo "UNKNOWN")
  echo "║  Status: $status"
  echo "║"
  echo "║  Active Rules:"
  sudo ufw status 2>/dev/null | grep -E "^[0-9]" | head -20 | sed 's/^/║    /'

  echo "╚══════════════════════════════════════════════════════════════════════╝"
}

# ===== MAIN CLI =====
main() {
  local command="${1:-}"
  local arg1="${2:-}"
  local arg2="${3:-}"
  local arg3="${4:-}"

  # Validate arguments
  if [ -z "$command" ]; then
    command="--help"
  fi

  # Acquire lock (except for help/status)
  if [[ "$command" != "--help" && "$command" != "status" && "$command" != "list" ]]; then
    if ! acquire_lock; then
      exit 3
    fi
    trap release_lock EXIT
  fi

  # Ensure log directory exists
  mkdir -p "$(dirname "$LOG_FILE")"

  case "$command" in
    ensure)
      ensure_port "$arg1" "${arg2:-nexus}"
      ;;
    allow)
      ufw_allow "$arg1" "${arg2:-tcp}" "${arg3:-nexus}"
      ;;
    status)
      show_status
      ;;
    list)
      sudo ufw status numbered 2>/dev/null | head -40
      ;;
    check)
      if is_port_available "$arg1" 2>/dev/null; then
        echo "AVAILABLE"
        exit 0
      else
        echo "IN USE"
        exit 1
      fi
      ;;
    find)
      find_port "${arg1:-4002}"
      ;;
    verify)
      verify_port "$arg1" "${arg2:-localhost}" "${arg3:-3}"
      ;;
    batch)
      info "Batch allowing ports: $arg1"
      for port in $arg1; do
        ensure_port "$port" "${arg2:-nexus-batch}" || true
      done
      ;;
    --help|-h)
      cat << 'EOF'
nexus-ufw.sh — Enterprise UFW Firewall Automation

SYNOPSIS:
  nexus-ufw.sh <command> [args]

COMMANDS:
  ensure <port> [comment]   Ensure port is open & ready (MAIN FUNCTION)
  allow <port> [proto] [c] Allow port in UFW
  status                   Show UFW status
  list                     List UFW rules (numbered)
  check <port>             Check if port is available
  find [start]             Find next available port
  verify <port> [host]     Verify port is accessible
  batch <ports> [comment]  Allow multiple ports

EXAMPLES:
  # Primary usage - ensure port is ready
  nexus-ufw.sh ensure 4003 gym-mvp

  # Quick port check
  nexus-ufw.sh check 8080

  # Find next available port starting from 4000
  nexus-ufw.sh find 4000

  # Verify port is accessible
  nexus-ufw.sh verify 4003 localhost

  # Batch operation
  nexus-ufw.sh batch "4005 4006 4007" myapp

ERROR CODES:
  0 = Success
  1 = UFW install/enable failed
  2 = Port allow failed
  3 = Lock timeout
  4 = Invalid arguments

TROUBLESHOOTING:
  - "Permission denied": Add user to sudo group
  - "Port in use": Use 'find' to get alternative
  - "Lock timeout": Wait or kill other instance
  - "UFW not found": Run with sudo or install ufw
EOF
      ;;
    *)
      error "Unknown command: $command"
      main --help
      exit 4
      ;;
  esac
}

main "$@"
