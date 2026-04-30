#!/bin/bash
# =============================================================================
# vibe-ctl.sh — Control the vibe-kit autonomous system
# =============================================================================
# COMMANDS: start, stop, status, restart, reset
# EXIT CODES: 0=success, 1=error, 2=unknown command
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
MONOREPO="${MONOREPO:-/srv/monorepo}"
WORKDIR="${MONOREPO}/.claude/vibe-kit"
LOG_DIR="${WORKDIR}/logs"
VIBE_LOG="${LOG_DIR}/vibe-ctl.log"
PID_FILE="${WORKDIR}/.vibe.pid"
STATE_FILE="${WORKDIR}/state.json"
QUEUE_FILE="${WORKDIR}/queue.json"
RUN_SCRIPT="${WORKDIR}/run-vibe.sh"
PIPELINE_FILE="${WORKDIR}/pipeline.json"

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
  echo -e "${GREEN}[${ts}]${NC} $*" | tee -a "$VIBE_LOG"
}

log_error() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo -e "${RED}[${ts}] ERROR:${NC} $*" | tee -a "$VIBE_LOG" >&2
}

log_warn() {
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  echo -e "${YELLOW}[${ts}] WARN:${NC} $*" | tee -a "$VIBE_LOG"
}

# ===== INIT =====
init() {
  mkdir -p "$LOG_DIR" "$(dirname "$PID_FILE")" 2>/dev/null
  touch "$VIBE_LOG" 2>/dev/null || true
}

# ===== HELP =====
show_help() {
  cat <<EOF
${CYAN}vibe-ctl.sh${NC} — vibe-kit autonomous system control

${YELLOW}USAGE:${NC}
  vibe-ctl.sh <command>

${YELLOW}COMMANDS:${NC}
  ${GREEN}start${NC}   Start the vibe-kit loop
  ${GREEN}stop${NC}    Stop the vibe-kit loop
  ${GREEN}status${NC}  Show current vibe-kit status
  ${GREEN}restart${NC} Restart the vibe-kit loop (stop + start)
  ${GREEN}reset${NC}   Reset vibe-kit state and queue
  ${GREEN}help${NC}    Show this help message

${YELLOW}EXIT CODES:${NC}
  0 — Success
  1 — Error occurred
  2 — Unknown command

${YELLOW}LOG FILE:${NC}
  $VIBE_LOG

${YELLOW}VIBE_PARALLEL ENV:${NC}
  Controls max parallel workers (default: 5)
  Example: VIBE_PARALLEL=10 vibe-ctl.sh start
EOF
}

# ===== STATUS =====
get_status() {
  local pid=""
  local running=""
  local phase=""
  local spec=""

  if [ -f "$PID_FILE" ]; then
    pid="$(cat "$PID_FILE" 2>/dev/null || echo "")"
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      running="yes"
    fi
  fi

  if [ -f "$STATE_FILE" ]; then
    phase="$(jq -r '.phase // "unknown"' "$STATE_FILE" 2>/dev/null || echo "unknown")"
    spec="$(jq -r '.spec // "none"' "$STATE_FILE" 2>/dev/null || echo "none")"
  fi

  local pending=0
  local running_cnt=0
  local done=0
  local failed=0
  if [ -f "$QUEUE_FILE" ]; then
    pending=$(jq -r '.tasks | map(select(.status == "pending")) | length' "$QUEUE_FILE" 2>/dev/null || echo 0)
    running_cnt=$(jq -r '.tasks | map(select(.status == "running")) | length' "$QUEUE_FILE" 2>/dev/null || echo 0)
    done=$(jq -r '.tasks | map(select(.status == "done")) | length' "$QUEUE_FILE" 2>/dev/null || echo 0)
    failed=$(jq -r '.tasks | map(select(.status == "failed")) | length' "$QUEUE_FILE" 2>/dev/null || echo 0)
  fi

  local max_workers=5
  if [ -f "$PIPELINE_FILE" ]; then
    max_workers=$(jq -r '.max_workers // 5' "$PIPELINE_FILE" 2>/dev/null || echo 5)
  fi

  echo ""
  echo -e "${CYAN}=== Vibe-kit Status ===${NC}"
  echo -e "  PID File:      ${BLUE}$PID_FILE${NC}"
  echo -e "  Running PID:   ${BLUE}${pid:-none}${NC}"
  echo -e "  Is Running:    $([ "$running" = "yes" ] && echo -e "${GREEN}yes${NC}" || echo -e "${RED}no${NC}")"
  echo -e "  Phase:         ${BLUE}${phase}${NC}"
  echo -e "  SPEC:          ${BLUE}${spec}${NC}"
  echo -e "  Max Workers:   ${BLUE}${max_workers}${NC}"
  echo -e "  Queue:"
  echo -e "    Pending: ${YELLOW}${pending}${NC}"
  echo -e "    Running: ${CYAN}${running_cnt}${NC}"
  echo -e "    Done:    ${GREEN}${done}${NC}"
  echo -e "    Failed:  ${RED}${failed}${NC}"
  echo ""
}

# ===== START =====
do_start() {
  if [ -f "$PID_FILE" ]; then
    local pid
    pid=$(cat "$PID_FILE" 2>/dev/null)
    if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
      log_error "vibe-kit already running with PID $pid"
      exit 1
    fi
    rm -f "$PID_FILE"
  fi

  if [ ! -f "$RUN_SCRIPT" ]; then
    log_error "run-vibe.sh not found at $RUN_SCRIPT"
    exit 1
  fi

  log "Starting vibe-kit..."
  mkdir -p "$LOG_DIR"

  local max_workers="${VIBE_PARALLEL:-5}"
  log "Using VIBE_PARALLEL=$max_workers"

  nohup bash "$RUN_SCRIPT" >> "$VIBE_LOG" 2>&1 &
  local new_pid=$!
  echo "$new_pid" > "$PID_FILE"

  sleep 0.5
  if kill -0 "$new_pid" 2>/dev/null; then
    log "vibe-kit started with PID $new_pid"
    exit 0
  else
    log_error "Failed to start vibe-kit"
    rm -f "$PID_FILE"
    exit 1
  fi
}

# ===== STOP =====
do_stop() {
  if [ ! -f "$PID_FILE" ]; then
    log_error "PID file not found. Is vibe-kit running?"
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

  log "Stopping vibe-kit (PID $pid)..."
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
  log "vibe-kit stopped"
  exit 0
}

# ===== RESTART =====
do_restart() {
  log "Restarting vibe-kit..."
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    "$0" stop || true
    sleep 1
  fi
  "$0" start
}

# ===== RESET =====
do_reset() {
  log "Resetting vibe-kit state..."

  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    log_warn "vibe-kit is running. Stopping first..."
    "$0" stop || true
  fi

  if [ -f "$STATE_FILE" ]; then
    jq '(.phase = "idle") | (.spec = null) | (.tasks_total = 0) | (.tasks_done = 0)' \
       "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
    log "State file reset"
  fi

  if [ -f "$QUEUE_FILE" ]; then
    echo '{"tasks": [], "pending": 0, "running": 0, "done": 0, "failed": 0}' > "$QUEUE_FILE"
    log "Queue cleared"
  fi

  rm -f "$PID_FILE"
  log "vibe-kit reset complete"
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