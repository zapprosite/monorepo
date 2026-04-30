#!/bin/bash
# =============================================================================
# nexus-session-scheduler.sh — Claude Code Session Scheduler
# =============================================================================
# PURPOSE: Schedule and automate Claude Code CLI sessions
#
# FEATURES:
#   - Schedule sessions at specific times
#   - Run fit-v3 routines automatically
#   - Morning/evening routine automation
#   - Persistent session management
#
# USAGE:
#   nexus-session-scheduler.sh schedule <name> <cron> <command>
#   nexus-session-scheduler.sh list
#   nexus-session-scheduler.sh run <name>
#   nexus-session-scheduler.sh remove <name>
#   nexus-session-scheduler.sh now <command>
#
# CRON: * * * * * ~/.claude/scripts/nexus-session-scheduler.sh tick
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
SCRIPT_DIR="${SCRIPT_DIR:-$HOME/.claude/scripts}"
MONOREPO="${MONOREPO:-/srv/monorepo}"
SCHEDULE_FILE="${HOME}/.claude/projects/-tmp/memory/session-schedule.json"
LOG_FILE="${MONOREPO}/logs/nexus-session-scheduler.log"
LAST_TICK_FILE="${HOME}/.claude/projects/-tmp/memory/.last-tick"
LOCK_FILE="${HOME}/.claude/projects/-tmp/memory/.scheduler-lock"

# ===== COLORS =====
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
[ -t 1 ] || { RED=; YELLOW=; GREEN=; CYAN=; MAGENTA=; NC=; }

# ===== LOGGING =====
log() { echo -e "${GREEN}[SCHED]${NC} $*"; }
warn() { echo -e "${YELLOW}[SCHED]${NC} $*" >&2; }
error() { echo -e "${RED}[SCHED]${NC} $*" >&2; }
info() { echo -e "${CYAN}[SCHED]${NC} $*"; }

# ===== INIT =====
init() {
  mkdir -p "$(dirname "$SCHEDULE_FILE")" "$(dirname "$LOG_FILE")" "$(dirname "$LAST_TICK_FILE")" "$(dirname "$LOCK_FILE")"

  if [ ! -f "$SCHEDULE_FILE" ]; then
    cat > "$SCHEDULE_FILE" << 'EOF'
{
  "version": "1.0.0",
  "schedules": [],
  "last_update": null
}
EOF
  fi
}

# ===== LOCK MANAGEMENT =====
acquire_lock() {
  local lock_age=0
  if [ -f "$LOCK_FILE" ]; then
    lock_age=$(($(date +%s) - $(cat "$LOCK_FILE")))
  fi

  # Lock older than 5 minutes is stale
  if [ "$lock_age" -gt 300 ]; then
    warn "Stale lock found (${lock_age}s), removing"
    rm -f "$LOCK_FILE"
  fi

  if [ -f "$LOCK_FILE" ]; then
    return 1  # Lock held
  fi

  echo "$(date +%s)" > "$LOCK_FILE"
  return 0
}

release_lock() {
  rm -f "$LOCK_FILE"
}

# ===== SCHEDULE MANAGEMENT =====
list_schedules() {
  init

  echo ""
  echo -e "${MAGENTA}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${MAGENTA}║              SESSION SCHEDULES                             ║${NC}"
  echo -e "${MAGENTA}╠══════════════════════════════════════════════════════════════╣${NC}"

  local schedules=$(cat "$SCHEDULE_FILE" | jq -r '.schedules[] | @base64')
  if [ -z "$schedules" ] || [ "$schedules" = "null" ]; then
    echo -e "${MAGENTA}║${NC}  No schedules configured"
    echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════════╝${NC}"
    return 0
  fi

  echo "$schedules" | while read -r encoded; do
    local schedule=$(echo "$encoded" | base64 -d)
    local name=$(echo "$schedule" | jq -r '.name')
    local cron=$(echo "$schedule" | jq -r '.cron')
    local command=$(echo "$schedule" | jq -r '.command')
    local active=$(echo "$schedule" | jq -r '.active')
    local last_run=$(echo "$schedule" | jq -r '.last_run // "never"')

    local status_color="${GREEN}"
    [ "$active" = "false" ] && status_color="${RED}"

    echo -e "${MAGENTA}║${NC}"
    echo -e "${MAGENTA}║${NC}  ${CYAN}${name}${NC}"
    echo -e "${MAGENTA}║${NC}    Cron: ${cron}"
    echo -e "${MAGENTA}║${NC}    Command: ${command}"
    echo -e "${MAGENTA}║${NC}    Status: ${status_color}$active${NC} | Last: ${last_run}"
  done

  echo -e "${MAGENTA}╚══════════════════════════════════════════════════════════════╝${NC}"
}

add_schedule() {
  local name="${1:-}"
  local cron="${2:-}"
  local command="${3:-}"

  if [ -z "$name" ] || [ -z "$cron" ] || [ -z "$command" ]; then
    error "Usage: scheduler.sh schedule <name> <cron> <command>"
    return 1
  fi

  init

  # Validate name - alphanumeric, hyphens, underscores only
  if ! validate_command_name "$name"; then
    error "Invalid schedule name. Use only alphanumeric, hyphens, underscores."
    return 1
  fi

  # Validate cron format with strict validation
  if ! validate_cron "$cron"; then
    error "Invalid cron format: $cron"
    return 1
  fi

  # Validate command before adding
  if ! validate_command_name "$command"; then
    error "Invalid command. Use only alphanumeric, hyphens, underscores."
    return 1
  fi

  # Only allow whitelisted command prefixes
  case "$command" in
    fit-*|nexus-*|claude-*) ;;
    *)
      error "Command must start with: fit-, nexus-, or claude-"
      return 1
      ;;
  esac

  local schedule=$(cat << EOF
{
  "name": "${name}",
  "cron": "${cron}",
  "command": "${command}",
  "active": true,
  "created": "$(date -Iseconds)",
  "last_run": null
}
EOF
)

  # Remove existing with same name
  local existing=$(cat "$SCHEDULE_FILE" | jq ".schedules = (.schedules | map(select(.name != \"${name}\")))")
  echo "$existing" | jq ".schedules += [${schedule}]" > "${SCHEDULE_FILE}.tmp" && mv "${SCHEDULE_FILE}.tmp" "$SCHEDULE_FILE"

  log "Schedule added: $name ($cron)"
}

remove_schedule() {
  local name="${1:-}"

  if [ -z "$name" ]; then
    error "Usage: scheduler.sh remove <name>"
    return 1
  fi

  init

  local removed=$(cat "$SCHEDULE_FILE" | jq ".schedules = (.schedules | map(select(.name != \"${name}\")))")
  echo "$removed" > "${SCHEDULE_FILE}.tmp" && mv "${SCHEDULE_FILE}.tmp" "$SCHEDULE_FILE"

  log "Schedule removed: $name"
}

toggle_schedule() {
  local name="${1:-}"
  local active="${2:-toggle}"

  init

  local schedules=$(cat "$SCHEDULE_FILE" | jq -r '.schedules[] | @base64')
  local found=0

  echo "$schedules" | while read -r encoded; do
    local schedule=$(echo "$encoded" | base64 -d)
    local sched_name=$(echo "$schedule" | jq -r '.name')

    if [ "$sched_name" = "$name" ]; then
      found=1
      local new_active=$(echo "$schedule" | jq -r '.active')
      if [ "$active" = "toggle" ]; then
        [ "$new_active" = "true" ] && new_active=false || new_active=true
      else
        new_active="$active"
      fi

      echo "$schedule" | jq ".active = ${new_active}" > "${SCHEDULE_FILE}.update"
      # Update in file
      cat "$SCHEDULE_FILE" | jq "\
        .schedules = (.schedules | \
          map(if .name == \"${name}\" then \
            .active = ${new_active} else . end))" > "${SCHEDULE_FILE}.tmp" && \
        mv "${SCHEDULE_FILE}.tmp" "$SCHEDULE_FILE"

      log "Schedule $name: active=$new_active"
    fi
  done

  [ "$found" = 0 ] && error "Schedule not found: $name"
}

# ===== CRON MATCHING =====
matches_cron() {
  local cron_spec="${1:-}"
  local now="${2:-$(date +%s)}"

  # Simple cron matcher
  # Returns 0 if now matches cron_spec

  local minute=$(date -d "@$now" +%M)
  local hour=$(date -d "@$now" +%H)
  local dom=$(date -d "@$now" +%d)
  local mon=$(date -d "@$now" +%m)
  local dow=$(date -d "@$now" +%u)  # 1-7, Monday=1

  # Parse cron fields
  local cron_min=$(echo "$cron_spec" | awk '{print $1}')
  local cron_hour=$(echo "$cron_spec" | awk '{print $2}')
  local cron_dom=$(echo "$cron_spec" | awk '{print $3}')
  local cron_mon=$(echo "$cron_spec" | awk '{print $4}')
  local cron_dow=$(echo "$cron_spec" | awk '{print $5}')

  # Check each field
  check_field() {
    local val="$1"
    local pattern="$2"
    [ "$pattern" = "*" ] && return 0
    [ "$pattern" = "$val" ] && return 0
    echo "$pattern" | grep -q ',' && {
      echo "$pattern" | tr ',' '\n' | grep -qx "$val" && return 0
    }
    echo "$pattern" | grep -q '-' && {
      local start=$(echo "$pattern" | cut -d'-' -f1)
      local end=$(echo "$pattern" | cut -d'-' -f2)
      [ "$val" -ge "$start" ] && [ "$val" -le "$end" ] && return 0
    }
    return 1
  }

  check_field "$minute" "$cron_min" || return 1
  check_field "$hour" "$cron_hour" || return 1
  check_field "$dom" "$cron_dom" || return 1
  check_field "$mon" "$cron_mon" || return 1
  check_field "$dow" "$cron_dow" || return 1

  return 0
}

# ===== COMMAND VALIDATION =====

# Validate command name (alphanumeric, hyphens, underscores only)
validate_command_name() {
  local cmd="$1"
  # Reject if contains shell special chars: ; & | $ ` ( ) { } [ ] < > " ' \ ! # * ? ~
  if echo "$cmd" | grep -qP '[;&|`${}()\[\]<>"'\''\\!#*?~]'; then
    return 1
  fi
  return 0
}

# Validate cron field (digits, *, /, -, comma only)
validate_cron_field() {
  local field="$1"
  if ! echo "$field" | grep -qP '^[0-9*/, -]+$'; then
    return 1
  fi
  return 0
}

validate_cron() {
  local cron="$1"
  local minute=$(echo "$cron" | awk '{print $1}')
  local hour=$(echo "$cron" | awk '{print $2}')
  local dom=$(echo "$cron" | awk '{print $3}')
  local mon=$(echo "$cron" | awk '{print $4}')
  local dow=$(echo "$cron" | awk '{print $5}')

  validate_cron_field "$minute" || return 1
  validate_cron_field "$hour" || return 1
  validate_cron_field "$dom" || return 1
  validate_cron_field "$mon" || return 1
  validate_cron_field "$dow" || return 1
  return 0
}

# ===== RUN COMMAND =====
run_command() {
  local name="${1:-}"
  local command="${2:-}"

  info "Running schedule '$name': $command"

  # Log execution
  echo "[$(date -Iseconds)] EXEC: $name | $command" >> "$LOG_FILE"

  # Strict validation before execution
  if ! validate_command_name "$command"; then
    error "SECURITY: Command contains invalid characters: $command"
    echo "[$(date -Iseconds)] REJECTED: $command (invalid chars)" >> "$LOG_FILE"
    return 1
  fi

  # Execute based on command type - all use arrays to avoid eval
  case "$command" in
    fit-*)
      # Fit-v3 routines: fit-<subcommand>
      local fit_subcmd=$(echo "$command" | sed 's/fit-//')
      if ! validate_command_name "$fit_subcmd"; then
        error "SECURITY: Invalid fit subcommand: $fit_subcmd"
        return 1
      fi
      # Use array to avoid word splitting
      local -a fit_args=("/srv/monorepo/apps/fit-v3/fit-v3.sh")
      [[ -n "$fit_subcmd" ]] && fit_args+=("$fit_subcmd")
      "${fit_args[@]}" >> "$LOG_FILE" 2>&1
      ;;
    nexus-*)
      # Nexus scripts: nexus-<scriptname>
      local nexus_script=$(echo "$command" | sed 's/nexus-//')
      if ! validate_command_name "$nexus_script"; then
        error "SECURITY: Invalid nexus script name: $nexus_script"
        return 1
      fi
      local nexus_path="${SCRIPT_DIR}/nexus-${nexus_script}"
      if [[ ! -x "$nexus_path" ]]; then
        error "Nexus script not found or not executable: $nexus_path"
        echo "[$(date -Iseconds)] MISSING: $nexus_path" >> "$LOG_FILE"
        return 1
      fi
      "$nexus_path" >> "$LOG_FILE" 2>&1
      ;;
    claude-*)
      # Claude Code CLI commands - just log, not executed
      local claude_cmd=$(echo "$command" | sed 's/claude-//')
      echo "[$(date -Iseconds)] CLI: $claude_cmd" >> "$LOG_FILE"
      ;;
    *)
      # Direct command - STRICT WHITELIST ONLY
      # Only allow specific safe commands
      error "Direct arbitrary commands are disabled for security"
      echo "[$(date -Iseconds)] BLOCKED: $command (direct exec blocked)" >> "$LOG_FILE"
      return 1
      ;;
  esac

  local exit_code=$?
  if [ $exit_code -eq 0 ]; then
    log "Schedule '$name' completed successfully"
  else
    warn "Schedule '$name' failed with exit code $exit_code"
  fi

  return $exit_code
}

# ===== TICK (cron hook) =====
tick() {
  if ! acquire_lock; then
    info "Another tick running, skipping"
    return 0
  fi

  trap release_lock EXIT

  init

  local now=$(date +%s)
  local schedules=$(cat "$SCHEDULE_FILE" | jq -r '.schedules[] | @base64')

  echo "$schedules" | while read -r encoded; do
    local schedule=$(echo "$encoded" | base64 -d)
    local name=$(echo "$schedule" | jq -r '.name')
    local cron=$(echo "$schedule" | jq -r '.cron')
    local command=$(echo "$schedule" | jq -r '.command')
    local active=$(echo "$schedule" | jq -r '.active')
    local last_run=$(echo "$schedule" | jq -r '.last_run // empty')

    [ "$active" = "false" ] && continue

    # Check if cron matches
    if matches_cron "$cron" "$now"; then
      # Check last_run to avoid duplicate runs
      local should_run=1
      if [ -n "$last_run" ] && [ "$last_run" != "null" ]; then
        local last_run_sec=$(date -d "$last_run" +%s 2>/dev/null || echo 0)
        local elapsed=$((now - last_run_sec))
        # Don't run if less than 50 minutes since last
        [ "$elapsed" -lt 3000 ] && should_run=0
      fi

      if [ "$should_run" = 1 ]; then
        # Update last_run
        cat "$SCHEDULE_FILE" | jq ".schedules = (.schedules | map(if .name == \"${name}\" then .last_run = \"$(date -Iseconds)\" else . end))" > "${SCHEDULE_FILE}.tmp" && mv "${SCHEDULE_FILE}.tmp" "$SCHEDULE_FILE"

        # Run
        run_command "$name" "$command"
      fi
    fi
  done

  # Update last tick
  echo "$now" > "$LAST_TICK_FILE"
}

# ===== RUN NOW =====
run_now() {
  local name="${1:-}"

  if [ -z "$name" ]; then
    error "Usage: scheduler.sh run <name>"
    return 1
  fi

  init

  local schedules=$(cat "$SCHEDULE_FILE" | jq -r '.schedules[] | @base64')
  local found=0

  echo "$schedules" | while read -r encoded; do
    local schedule=$(echo "$encoded" | base64 -d)
    local sched_name=$(echo "$schedule" | jq -r '.name')

    if [ "$sched_name" = "$name" ]; then
      found=1
      local command=$(echo "$schedule" | jq -r '.command')
      run_command "$name" "$command"
      return $?
    fi
  done

  [ "$found" = 0 ] && error "Schedule not found: $name"
}

# ===== PRESET SCHEDULES =====
setup_presets() {
  init

  # Morning routine (7:00 AM weekdays)
  add_schedule "morning-fit" "0 7 * * 1-5" "fit-v3 preset morning"

  # Water reminder (every 2 hours during work)
  add_schedule "water-reminder" "0 */2 9-17 * *" "fit-v3 water 500"

  # Evening backup check (22:00)
  add_schedule "evening-backup" "0 22 * * *" "nexus-context-window-manager.sh status"

  log "Preset schedules configured"
}

# ===== HELP =====
show_help() {
  cat << 'EOF'
NEXUS SESSION SCHEDULER

Gerencia agendamento de sessões e rotinas do Claude Code CLI.

COMMANDS:
  schedule <name> <cron> <cmd>   Adicionar schedule
  list                          Listar schedules
  run <name>                    Executar agora
  remove <name>                 Remover schedule
  toggle <name> [on|off]        Ativar/desativar
  presets                       Configurar presets
  tick                          Verificar e executar (para cron)

CRON:
  * * * * * ~/.claude/scripts/nexus-session-scheduler.sh tick

CRON FORMAT:
  minute hour dom month dow
  * = any
  0 7 * * 1-5 = 7:00 AM Monday-Friday

EXAMPLES:
  scheduler.sh schedule morning-fit "0 7 * * 1-5" "fit-v3 preset morning"
  scheduler.sh schedule water "0 */2 9-17 * *" "fit-v3 water 500"
  scheduler.sh list
  scheduler.sh run morning-fit
  scheduler.sh presets

EOF
}

# ===== MAIN =====
main() {
  local command="${1:-}"
  local arg1="${2:-}"
  local arg2="${3:-}"
  local arg3="${4:-}"

  case "$command" in
    schedule)
      add_schedule "$arg1" "$arg2" "$arg3"
      ;;
    list)
      list_schedules
      ;;
    run)
      run_now "$arg1"
      ;;
    remove)
      remove_schedule "$arg1"
      ;;
    toggle)
      toggle_schedule "$arg1" "$arg2"
      ;;
    presets)
      setup_presets
      ;;
    tick)
      tick
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
