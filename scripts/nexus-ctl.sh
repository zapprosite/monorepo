#!/bin/bash
# =============================================================================
# nexus-ctl.sh — Control the Nexus autonomous system
# =============================================================================
# COMMANDS: start, stop, status, restart, reset
# EXIT CODES: 0=success, 1=error, 2=unknown command
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
MONOREPO="${MONOREPO:-/srv/monorepo}"
LOG_DIR="${MONOREPO}/logs"
NEXUS_LOG="${LOG_DIR}/nexus-ctl.log"
PID_FILE="${MONOREPO}/.claude/nexus.pid"
STATE_FILE="${MONOREPO}/.claude/vibe-kit/state.json"
QUEUE_FILE="${MONOREPO}/.claude/vibe-kit/queue.json"
AUTO_SCRIPT="${MONOREPO}/scripts/nexus-auto.sh"

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
  echo -e "${GREEN}[${ts}]${NC} $*" | tee -a "$NEXUS_LOG"
}

log_error() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo -e "${RED}[${ts}] ERROR:${NC} $*" | tee -a "$NEXUS_LOG" >&2
}

log_warn() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo -e "${YELLOW}[${ts}] WARN:${NC} $*" | tee -a "$NEXUS_LOG"
}

# ===== INIT =====
init() {
  mkdir -p "$LOG_DIR" "$(dirname "$PID_FILE")" "$(dirname "$STATE_FILE")" 2>/dev/null
  touch "$NEXUS_LOG" 2>/dev/null || true
}

# ===== HELP =====
show_help() {
  cat <<EOF
${CYAN}nexus-ctl.sh${NC} — Nexus autonomous system control

${YELLOW}USAGE:${NC}
  nexus-ctl.sh <command>

${YELLOW}COMMANDS:${NC}
  ${GREEN}start${NC}   Start the Nexus autonomous loop
  ${GREEN}stop${NC}    Stop the Nexus autonomous loop
  ${GREEN}status${NC}  Show current system status
  ${GREEN}restart${NC} Restart the Nexus loop (stop + start)
  ${GREEN}reset${NC}   Reset Nexus state and clear queue
  ${GREEN}help${NC}    Show this help message

${YELLOW}EXIT CODES:${NC}
  0 — Success
  1 — Error occurred
  2 — Unknown command

${YELLOW}LOG FILE:${NC}
  $NEXUS_LOG
EOF
}

# ===== STATUS =====
get_status() {
  local pid=""
  local running=""
  local state=""

  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || echo "")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      running="yes"
    fi
  fi

  if [ -f "$STATE_FILE" ]; then
    state="$(jq -r '.phase // "unknown"' "$STATE_FILE" 2>/dev/null || echo "unknown")"
  fi

  local pending=0
  local running_cnt=0
  local done=0
  if [ -f "$QUEUE_FILE" ]; then
    pending=$(jq -r '.tasks | map(select(.status == "pending")) | length' "$QUEUE_FILE" 2>/dev/null || echo 0)
    running_cnt=$(jq -r '.tasks | map(select(.status == "running")) | length' "$QUEUE_FILE" 2>/dev/null || echo 0)
    done=$(jq -r '.tasks | map(select(.status == "done")) | length' "$QUEUE_FILE" 2>/dev/null || echo 0)
  fi

  echo ""
  echo -e "${CYAN}=== Nexus Status ===${NC}"
  echo -e "  PID File:     ${BLUE}$PID_FILE${NC}"
  echo -e "  Running PID:   ${BLUE}${pid:-none}${NC}"
  echo -e "  Is Running:    $([ "$running" = "yes" ] && echo -e "${GREEN}yes${NC}" || echo -e "${RED}no${NC}")"
  echo -e "  State Phase:   ${BLUE}${state}${NC}"
  echo -e "  Queue:"
  echo -e "    Pending: ${YELLOW}${pending}${NC}"
  echo -e "    Running: ${CYAN}${running_cnt}${NC}"
  echo -e "    Done:    ${GREEN}${done}${NC}"
  echo ""
}

# ===== START =====
do_start() {
  if [ -f "$PID_FILE" ] && pid=$(cat "$PID_FILE" 2>/dev/null) && [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    log_error "Nexus already running with PID $pid"
    exit 1
  fi

  if [ ! -f "$AUTO_SCRIPT" ]; then
    log_error "nexus-auto.sh not found at $AUTO_SCRIPT"
    exit 1
  fi

  log "Starting Nexus autonomous loop..."
  mkdir -p "$LOG_DIR"

  nohup bash "$AUTO_SCRIPT" loop >> "$NEXUS_LOG" 2>&1 &
  local new_pid=$!
  echo "$new_pid" > "$PID_FILE"

  sleep 0.5
  if kill -0 "$new_pid" 2>/dev/null; then
    log "Nexus started with PID $new_pid"
    exit 0
  else
    log_error "Failed to start Nexus"
    rm -f "$PID_FILE"
    exit 1
  fi
}

# ===== STOP =====
do_stop() {
  if [ ! -f "$PID_FILE" ]; then
    log_error "PID file not found. Is Nexus running?"
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

  log "Stopping Nexus (PID $pid)..."
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
  log "Nexus stopped"
  exit 0
}

# ===== RESTART =====
do_restart() {
  log "Restarting Nexus..."
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    "$0" stop || true
    sleep 1
  fi
  "$0" start
}

# ===== RESET =====
do_reset() {
  log "Resetting Nexus state..."

  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    log_warn "Nexus is running. Stopping first..."
    "$0" stop || true
  fi

  local state_file="${MONOREPO}/.claude/vibe-kit/state.json"
  local queue_file="${MONOREPO}/.claude/vibe-kit/queue.json"

  if [ -f "$state_file" ]; then
    jq '(.phase = "idle") | (.tasks_total = 0) | (.tasks_done = 0)' "$state_file" > "${state_file}.tmp" && \
      mv "${state_file}.tmp" "$state_file"
    log "State file reset"
  fi

  if [ -f "$queue_file" ]; then
    echo '{"tasks": [], "pending": 0, "running": 0, "done": 0, "failed": 0}' > "$queue_file"
    log "Queue cleared"
  fi

  rm -f "$PID_FILE"
  log "Nexus reset complete"
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
    help|--help|-h)
      show_help
      exit 0
      ;;
    "")
      log_error "No command specified"
      show_help
      exit 2
      ;;
    *)
      log_error "Unknown command: $command"
      show_help
      exit 2
      ;;
  esac
}

main "$@"