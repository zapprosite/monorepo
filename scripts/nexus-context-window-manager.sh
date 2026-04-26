#!/bin/bash
# =============================================================================
# nexus-context-window-manager.sh — Claude Code Context Window Manager
# =============================================================================
# PURPOSE: Monitor Claude Code CLI context, save state before overflow,
#          and orchestrate seamless session transitions
#
# FEATURES:
#   - Context window usage estimation
#   - Automatic state preservation
#   - New session initiation
#   - Memory persistence across sessions
#
# USAGE:
#   nexus-context-window-manager.sh monitor     # Start monitoring
#   nexus-context-window-manager.sh save        # Force save current state
#   nexus-context-window-manager.sh status       # Show context status
#   nexus-context-window-manager.sh new-session  # Start fresh session
#
# CRON: */5 * * * * ~/.claude/scripts/nexus-context-window-manager.sh monitor
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
SCRIPT_DIR="${SCRIPT_DIR:-$HOME/.claude/scripts}"
MONOREPO="${MONOREPO:-/srv/monorepo}"
MEMORY_DIR="${HOME}/.claude/projects/-tmp/memory"
STATE_FILE="${MEMORY_DIR}/context-state.json"
ALERT_FILE="${MEMORY_DIR}/context-alerts.json"
LOG_FILE="${MONOREPO}/logs/nexus-context-manager.log"

# Context thresholds (percentage)
WARN_THRESHOLD="${WARN_THRESHOLD:-70}"
CRIT_THRESHOLD="${CRIT_THRESHOLD:-85}"
EMERG_THRESHOLD="${EMERG_THRESHOLD:-95}"

# Timing
CHECK_INTERVAL="${CHECK_INTERVAL:-300}"  # 5 minutes
COOLDOWN_FILE="${MEMORY_DIR}/.last-context-save"

# ===== COLORS =====
RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'
[ -t 1 ] || { RED=; YELLOW=; GREEN=; CYAN=; NC=; }

# ===== LOGGING =====
log() { echo -e "${GREEN}[CTX-MGR]${NC} $*"; }
warn() { echo -e "${YELLOW}[CTX-MGR]${NC} $*" >&2; }
error() { echo -e "${RED}[CTX-MGR]${NC} $*" >&2; }
info() { echo -e "${CYAN}[CTX-MGR]${NC} $*"; }

# ===== STATE MANAGEMENT =====
init() {
  mkdir -p "$(dirname "$STATE_FILE")" "$(dirname "$LOG_FILE")" "$(dirname "$COOLDOWN_FILE")"
  mkdir -p "$MEMORY_DIR"

  if [ ! -f "$STATE_FILE" ]; then
    cat > "$STATE_FILE" << 'EOF'
{
  "version": "1.0.0",
  "last_check": null,
  "context_usage_percent": 0,
  "last_save": null,
  "session_count": 0,
  "alerts": []
}
EOF
  fi

  if [ ! -f "$ALERT_FILE" ]; then
    cat > "$ALERT_FILE" << 'EOF'
[]
EOF
  fi
}

# ===== CONTEXT ESTIMATION =====
estimate_context_usage() {
  # Heurística baseada em:
  # - Tamanho do arquivo de memória
  # - Historico de mensagens
  # - Tempo desde última limpeza
  #
  # NOTA: Claude Code CLI não expõe usage público via API
  # Este método usa proxies: tamanho arquivo + padrão histórico

  local memory_size=0
  local session_file="${MONOREPO}/.claude/sessions/.active/.session.jsonl"

  # Tamanho memória
  if [ -f "$STATE_FILE" ]; then
    memory_size=$(stat -f%z "$STATE_FILE" 2>/dev/null || stat -c%s "$STATE_FILE" 2>/dev/null || echo 0)
  fi

  # Tamanho sessão ativa
  local session_size=0
  if [ -f "$session_file" ]; then
    session_size=$(stat -f%z "$session_file" 2>/dev/null || stat -c%s "$session_file" 2>/dev/null || echo 0)
  fi

  # Count recent memory files
  local memory_count=$(find "$MEMORY_DIR" -name "*.md" -type f 2>/dev/null | wc -l)

  # Count session files
  local session_count=$(find "${MONOREPO}/.claude/sessions" -name "*.jsonl" -type f 2>/dev/null | wc -l)

  # Estimate percentage (base: 50KB session = 50%, 100KB = 80%, 150KB+ = 95%+)
  local total_size=$((memory_size + session_size))
  local estimated_pct=0

  if [ "$total_size" -lt 20000 ]; then
    estimated_pct=20
  elif [ "$total_size" -lt 40000 ]; then
    estimated_pct=40
  elif [ "$total_size" -lt 60000 ]; then
    estimated_pct=55
  elif [ "$total_size" -lt 80000 ]; then
    estimated_pct=70
  elif [ "$total_size" -lt 100000 ]; then
    estimated_pct=80
  elif [ "$total_size" -lt 120000 ]; then
    estimated_pct=90
  else
    estimated_pct=95
  fi

  # Boost for many memory files
  if [ "$memory_count" -gt 20 ]; then
    estimated_pct=$((estimated_pct + 5))
  fi

  # Boost for many sessions
  if [ "$session_count" -gt 10 ]; then
    estimated_pct=$((estimated_pct + 3))
  fi

  # Cap at 100
  [ "$estimated_pct" -gt 100 ] && estimated_pct=100

  echo "$estimated_pct"
}

# ===== SAVE STATE =====
save_state() {
  local reason="${1:-manual}"

  # Check cooldown (don't save too frequently)
  if [ -f "$COOLDOWN_FILE" ]; then
    local last_save=$(cat "$COOLDOWN_FILE" 2>/dev/null)
    local now=$(date +%s)
    local elapsed=$((now - last_save))
    if [ "$elapsed" -lt "$CHECK_INTERVAL" ]; then
      info "Cooldown active, skipping save (${elapsed}s since last)"
      return 0
    fi
  fi

  log "Saving state (reason: $reason)..."

  local timestamp=$(date -Iseconds)

  # Update state file
  local usage=$(estimate_context_usage)
  local session_count=$(find "${MONOREPO}/.claude/sessions" -name "*.jsonl" -type f 2>/dev/null | wc -l)

  cat > "$STATE_FILE" << EOF
{
  "version": "1.0.0",
  "last_check": "${timestamp}",
  "context_usage_percent": ${usage},
  "last_save": "${timestamp}",
  "last_save_reason": "${reason}",
  "session_count": ${session_count},
  "alerts": []
}
EOF

  # Record cooldown
  echo "$(date +%s)" > "$COOLDOWN_FILE"

  # Append to log
  echo "[${timestamp}] SAVE: reason=${reason} usage=${usage}% sessions=${session_count}" >> "$LOG_FILE"

  log "State saved successfully"
  return 0
}

# ===== ALERTING =====
send_alert() {
  local level="${1:-warn}"
  local message="${2:-}"

  local alert_id="ALERT-$(date +%Y%m%d)-$$"

  local alert_entry=$(cat << EOF
{
  "id": "${alert_id}",
  "level": "${level}",
  "message": "${message}",
  "timestamp": "$(date -Iseconds)",
  "acknowledged": false
}
EOF
)

  # Add to alerts file
  local alerts=$(cat "$ALERT_FILE" 2>/dev/null || echo "[]")
  local new_alerts=$(echo "$alerts" | jq ". + [${alert_entry}]" 2>/dev/null || echo "[${alert_entry}]")
  echo "$new_alerts" > "$ALERT_FILE"

  case "$level" in
    critical) error "[CRITICAL] $message" ;;
    error) error "[ERROR] $message" ;;
    warn) warn "[WARN] $message" ;;
    *) info "[INFO] $message" ;;
  esac
}

# ===== CONTEXT STATUS =====
show_status() {
  init

  local usage=$(estimate_context_usage)
  local memory_count=$(find "$MEMORY_DIR" -name "*.md" -type f 2>/dev/null | wc -l)
  local session_count=$(find "${MONOREPO}/.claude/sessions" -name "*.jsonl" -type f 2>/dev/null | wc -l)
  local last_save="never"
  if [ -f "$COOLDOWN_FILE" ]; then
    local ts=$(cat "$COOLDOWN_FILE")
    if [ -n "$ts" ]; then
      last_save=$(date -d "@$ts" "+%H:%M:%S" 2>/dev/null || echo "$ts")
    fi
  fi

  echo ""
  echo -e "${CYAN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${CYAN}║            CLAUDE CODE CONTEXT MANAGER — STATUS             ║${NC}"
  echo -e "${CYAN}╠══════════════════════════════════════════════════════════════╣${NC}"

  # Usage bar
  local bar_len=40
  local filled_len=$((usage * bar_len / 100))
  local empty_len=$((bar_len - filled_len))
  local bar=""
  for i in $(seq 1 "$filled_len"); do bar="${bar}█"; done
  for i in $(seq 1 "$empty_len"); do bar="${bar}░"; done

  local color="$GREEN"
  [ "$usage" -ge "$WARN_THRESHOLD" ] && color="$YELLOW"
  [ "$usage" -ge "$CRIT_THRESHOLD" ] && color="$RED"

  echo -e "${CYAN}║${NC} Context Usage: ${color}${usage}%${NC} [${bar}]"

  # Memory files
  echo -e "${CYAN}║${NC} Memory files: ${memory_count}"
  echo -e "${CYAN}║${NC} Session files: ${session_count}"
  echo -e "${CYAN}║${NC} Last save: ${last_save}"

  # Thresholds
  echo -e "${CYAN}║${NC} Thresholds: WARN=${WARN_THRESHOLD}% CRIT=${CRIT_THRESHOLD}% EMERG=${EMERG_THRESHOLD}%"
  echo -e "${CYAN}╚══════════════════════════════════════════════════════════════╝${NC}"

  # Show pending alerts
  local alerts=$(cat "$ALERT_FILE" 2>/dev/null | jq -r '.[] | select(.acknowledged == false) | "\(.level): \(.message)"' 2>/dev/null)
  if [ -n "$alerts" ]; then
    echo ""
    echo -e "${RED}PENDING ALERTS:${NC}"
    echo "$alerts" | while read -r line; do
      echo -e "  ${RED}!${NC} $line"
    done
  fi
}

# ===== MONITOR =====
monitor() {
  init

  local usage=$(estimate_context_usage)
  local timestamp=$(date -Iseconds)

  # Update last_check
  local state=$(cat "$STATE_FILE")
  echo "$state" | jq ".last_check = \"${timestamp}\" | .context_usage_percent = ${usage}" > "$STATE_FILE.tmp" && mv "$STATE_FILE.tmp" "$STATE_FILE"

  # Log
  echo "[${timestamp}] CHECK: usage=${usage}%" >> "$LOG_FILE"

  # Check thresholds and act
  if [ "$usage" -ge "$EMERG_THRESHOLD" ]; then
    send_alert "critical" "Context at ${usage}% - EMERGENCY SAVE REQUIRED"
    save_state "emergency-threshold"
    info "EMERGENCY: Consider starting new session with /new"
    return 1
  fi

  if [ "$usage" -ge "$CRIT_THRESHOLD" ]; then
    send_alert "error" "Context at ${usage}% - CRITICAL save and consider /new"
    save_state "critical-threshold"
    return 1
  fi

  if [ "$usage" -ge "$WARN_THRESHOLD" ]; then
    send_alert "warn" "Context at ${usage}% - WARNING threshold reached"
    save_state "warn-threshold"
    return 0
  fi

  # Normal - periodic save every 30 min
  local last_save=$(cat "$COOLDOWN_FILE" 2>/dev/null || echo 0)
  local now=$(date +%s)
  local elapsed=$((now - last_save))

  if [ "$elapsed" -gt 1800 ]; then  # 30 min
    save_state "periodic"
  fi

  return 0
}

# ===== NEW SESSION =====
new_session() {
  local project="${1:-}"

  log "Preparing new Claude Code session..."

  # Save current state first
  save_state "pre-new-session"

  # Build session info for handoff
  local session_info=$(cat << EOF
{
  "previous_session": "$(hostname)",
  "timestamp": "$(date -Iseconds)",
  "reason": "context-management",
  "state_file": "${STATE_FILE}",
  "project": "${project:-${MONOREPO}}"
}
EOF
)

  echo "$session_info" > "${MEMORY_DIR}/last-session-handoff.json"

  log "Session state saved to: ${MEMORY_DIR}/last-session-handoff.json"
  log "To start new session, run: claude -p ${project:-${MONOREPO}}"
}

# ===== HELP =====
show_help() {
  cat << 'EOF'
NEXUS CONTEXT WINDOW MANAGER

Monitora e gerencia o context window do Claude Code CLI, salvando
estado automaticamente antes de overflow.

COMMANDS:
  monitor      Verificar uso de context e agir conforme thresholds
  save         Forçar save do estado atual
  status       Mostrar status atual do context
  new-session  Salvar estado e preparar para nova sessão

THRESHOLDS:
  WARN    70%  - Save automático
  CRIT    85%  - Save + alerta
  EMERG   95%  - Save + alerta crítico + recomendar /new

CRON:
  */5 * * * * ~/.claude/scripts/nexus-context-window-manager.sh monitor

FILES:
  ~/.claude/projects/-tmp/memory/context-state.json   - Estado atual
  ~/.claude/projects/-tmp/memory/context-alerts.json  - Alertas pendentes
  /srv/monorepo/logs/nexus-context-manager.log         - Log de operações

EOF
}

# ===== MAIN =====
main() {
  local command="${1:-}"

  case "$command" in
    monitor)
      monitor
      ;;
    save)
      save_state "manual"
      ;;
    status)
      show_status
      ;;
    new-session)
      new_session "${2:-}"
      ;;
    help|--help|-h)
      show_help
      ;;
    *)
      show_help
      ;;
  esac
}

main "$@"
