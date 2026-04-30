#!/bin/bash
# =============================================================================
# health-check.sh — Health check system control
# =============================================================================
# COMMANDS: start, stop, status, restart, reset (or run once with no args)
# EXIT CODES: 0=success, 1=error, 2=unknown command
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
MONOREPO="${MONOREPO:-/srv/monorepo}"
LOG_DIR="${MONOREPO}/logs"
LOG_FILE="${LOG_DIR}/health-check.log"
PID_FILE="${MONOREPO}/.claude/health-check.pid"
CHECK_INTERVAL="${CHECK_INTERVAL:-60}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
[ -t 1 ] || { RED=; GREEN=; YELLOW=; BLUE=; CYAN=; NC=; }

# ===== LOGGING =====
log() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo -e "${GREEN}[${ts}]${NC} $*" | tee -a "$LOG_FILE"
}

log_error() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo -e "${RED}[${ts}] ERROR:${NC} $*" | tee -a "$LOG_FILE" >&2
}

log_warn() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo -e "${YELLOW}[${ts}] WARN:${NC} $*" | tee -a "$LOG_FILE"
}

# ===== INIT =====
init() {
  mkdir -p "$LOG_DIR" "$(dirname "$PID_FILE")" 2>/dev/null
  touch "$LOG_FILE" 2>/dev/null || true
}

# ===== HELP =====
show_help() {
  cat <<EOF
${CYAN}health-check.sh${NC} — System health check control

${YELLOW}USAGE:${NC}
  health-check.sh <command>
  health-check.sh        # Run health check once

${YELLOW}COMMANDS:${NC}
  ${GREEN}start${NC}   Start continuous health check monitor
  ${GREEN}stop${NC}    Stop health check monitor
  ${GREEN}status${NC}  Show current health status
  ${GREEN}restart${NC} Restart health check monitor
  ${GREEN}reset${NC}   Clear health check logs and state
  ${GREEN}help${NC}    Show this help message

${YELLOW}EXIT CODES:${NC}
  0 — Success
  1 — Error occurred
  2 — Unknown command

${YELLOW}ENVIRONMENT:${NC}
  CHECK_INTERVAL  Interval between checks (default: 60s)
  LOG_FILE        Log file (default: $LOG_FILE)

${YELLOW}LOG FILE:${NC}
  $LOG_FILE
EOF
}

# ===== HEALTH CHECK =====
run_health_check() {
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"

  log "Running health check at $timestamp"

  # Source .env for environment variables
  if [ -f "${MONOREPO}/.env" ]; then
    set -a
    source "${MONOREPO}/.env"
    set +a
  fi

  local exit_code=0

  # Docker containers
  log "Checking Docker containers..."
  if docker ps --format "{{.Names}}\t{{.Status}}" 2>/dev/null | grep -v "Up" > /dev/null; then
    log_error "Some containers are not running"
    exit_code=1
  else
    log "All Docker containers up"
  fi

  # Services health
  log "Checking services..."
  local services=(
    "Qdrant:${QDRANT_URL:-http://localhost:6333}/health"
  )
  for entry in "${services[@]}"; do
    IFS=':' read -r name url <<< "$entry"
    if curl -sf -m 5 "$url" > /dev/null 2>&1; then
      log "$name is healthy"
    else
      log_error "$name is NOT responding at $url"
      exit_code=1
    fi
  done

  # ZFS pool
  log "Checking ZFS pool..."
  if zpool status tank 2>&1 | grep -q "errors: No known data errors"; then
    log "ZFS pool tank is healthy"
  else
    log_error "ZFS pool tank has errors"
    exit_code=1
  fi

  # Disk space
  log "Checking disk space..."
  local usage
  usage=$(df -h /srv | awk 'NR==2 {print $5}' | tr -d '%')
  if [ "$usage" -lt 80 ]; then
    log "Disk usage at ${usage}% (under threshold)"
  else
    log_error "Disk usage at ${usage}% (over 80% threshold)"
    exit_code=1
  fi

  # Git status
  log "Checking git status..."
  cd "$MONOREPO" || true
  if git diff --quiet && git diff --cached --quiet; then
    log "Git working tree is clean"
  else
    log_warn "Git has uncommitted changes"
  fi

  if [ $exit_code -eq 0 ]; then
    log "Health check complete — all systems OK"
  else
    log "Health check complete — some issues found"
  fi

  return $exit_code
}

# ===== RUN MONITOR =====
run_monitor() {
  log "Starting health check monitor (interval: ${CHECK_INTERVAL}s)..."
  mkdir -p "$LOG_DIR"

  while true; do
    run_health_check || true
    sleep "$CHECK_INTERVAL"
  done
}

# ===== START =====
do_start() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      log_error "health-check monitor already running with PID $pid"
      exit 1
    fi
    rm -f "$PID_FILE"
  fi

  log "Starting health check monitor..."
  nohup bash "$0" monitor >> "$LOG_FILE" 2>&1 &
  local new_pid=$!
  echo "$new_pid" > "$PID_FILE"

  sleep 0.5
  if kill -0 "$new_pid" 2>/dev/null; then
    log "Health check monitor started with PID $new_pid"
    exit 0
  else
    log_error "Failed to start health check monitor"
    rm -f "$PID_FILE"
    exit 1
  fi
}

# ===== STOP =====
do_stop() {
  if [ ! -f "$PID_FILE" ]; then
    log_error "PID file not found. Is health-check running?"
    exit 1
  fi

  local pid
  pid=$(cat "$PID_FILE" 2>/dev/null)
  if [ -z "$pid" ]; then
    log_error "PID file is empty"
    rm -f "$PID_FILE"
    exit 1
  fi

  if ! kill -0 "$pid" 2>/dev/null; then
    log_warn "Process $pid is not running. Cleaning up PID file."
    rm -f "$PID_FILE"
    exit 0
  fi

  log "Stopping health-check (PID $pid)..."
  kill "$pid" 2>/dev/null || true

  local count=0
  while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
    sleep 0.5
    count=$((count + 1))
  done

  if kill -0 "$pid" 2>/dev/null; then
    log_warn "Process still alive, sending SIGKILL..."
    kill -9 "$pid" 2>/dev/null || true
    sleep 0.5
  fi

  if kill -0 "$pid" 2>/dev/null; then
    log_error "Failed to stop process $pid"
    exit 1
  fi

  rm -f "$PID_FILE"
  log "Health-check stopped"
  exit 0
}

# ===== STATUS =====
get_status() {
  local pid=""
  local running=""

  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || echo "")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      running="yes"
    fi
  fi

  local last_check="never"
  if [ -f "$LOG_FILE" ]; then
    last_check=$(tail -5 "$LOG_FILE" 2>/dev/null | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}' | tail -1 || echo "never")
  fi

  echo ""
  echo -e "${CYAN}=== Health Check Status ===${NC}"
  echo -e "  PID File:      ${BLUE}$PID_FILE${NC}"
  echo -e "  Running PID:   ${BLUE}${pid:-none}${NC}"
  echo -e "  Is Running:    $([ "$running" = "yes" ] && echo -e "${GREEN}yes${NC}" || echo -e "${RED}no${NC}")"
  echo -e "  Last Check:    ${BLUE}${last_check}${NC}"
  echo -e "  Log File:      ${BLUE}$LOG_FILE${NC}"
  echo -e "  Check Interval:${BLUE}${CHECK_INTERVAL}s${NC}"
  echo ""

  # Show recent health status from logs
  echo -e "${CYAN}=== Recent Log Entries ===${NC}"
  tail -10 "$LOG_FILE" 2>/dev/null | while IFS= read -r line; do
    if echo "$line" | grep -q "ERROR"; then
      echo -e "  ${RED}$line${NC}"
    elif echo "$line" | grep -q "WARN"; then
      echo -e "  ${YELLOW}$line${NC}"
    else
      echo -e "  $line"
    fi
  done
  echo ""
}

# ===== RESTART =====
do_restart() {
  log "Restarting health-check..."
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    "$0" stop || true
    sleep 1
  fi
  "$0" start
}

# ===== RESET =====
do_reset() {
  log "Resetting health-check state..."

  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    log_warn "Health-check is running. Stopping first..."
    "$0" stop || true
  fi

  if [ -f "$LOG_FILE" ]; then
    echo "" > "$LOG_FILE"
    log "Log file cleared"
  fi

  rm -f "$PID_FILE"
  log "Health-check reset complete"
  exit 0
}

# ===== MAIN =====
main() {
  init

  local command="${1:-}"

  case "$command" in
    start)   do_start ;;
    stop)    do_stop ;;
    status)  get_status; exit 0 ;;
    restart) do_restart ;;
    reset)   do_reset ;;
    monitor) run_monitor ;;
    help|--help|-h)
      show_help
      exit 0
      ;;
    "")
      run_health_check
      exit $?
      ;;
    *)
      log_error "Unknown command: $command"
      show_help
      exit 2
      ;;
  esac
}

main "$@"