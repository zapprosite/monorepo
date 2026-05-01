#!/bin/bash
# =============================================================================
# nexus.sh — Nexus Orchestrator (CONSOLIDATED)
# =============================================================================
# Consolidates: nexus-auto, nexus-ctl, nexus-alert, nexus-context-window-manager,
#               nexus-session-scheduler, nexus-investigate, nexus-*-stats,
#               nexus-cron-helper, nexus-cron-legacy
#
# PURPOSE: Main orchestrator for autonomous Nexus operations
#
# USAGE:
#   nexus.sh start              Start autonomous loop
#   nexus.sh stop               Stop autonomous loop
#   nexus.sh status             Show system status
#   nexus.sh restart            Restart autonomous loop
#   nexus.sh reset              Reset state and queue
#   nexus.sh run <spec> [app]   Run SPEC through vibe-kit
#
#   nexus.sh alert <sev> <msg> [details]   Create alert
#   nexus.sh list-alerts         List active alerts
#   nexus.sh resolve <id>        Resolve alert
#
#   nexus.sh monitor            Monitor context window
#   nexus.sh save               Force save context state
#   nexus.sh new-session        Prepare new session
#
#   nexus.sh schedule <name> <cron> <cmd>  Add schedule
#   nexus.sh list-schedules     List schedules
#   nexus.sh tick               Cron tick (run scheduled tasks)
#
#   nexus.sh investigate <svc> [depth]  Investigate service health
#   nexus.sh all                Test all services
#
#   nexus.sh stats              Show all metrics
#   nexus.sh hermes             Hermes metrics
#   nexus.sh ollama             Ollama metrics
#   nexus.sh qdrant             Qdrant metrics
#   nexus.sh redis              Redis metrics
#
# EXIT CODES: 0=success, 1=error, 2=unknown command
# =============================================================================

set -uo pipefail

# ===== CONFIGURATION =====
MONOREPO="${MONOREPO:-/srv/monorepo}"
LOG_DIR="${MONOREPO}/logs"
NEXUS_LOG="${LOG_DIR}/nexus.log"
PID_FILE="${MONOREPO}/.claude/nexus.pid"
STATE_FILE="${MONOREPO}/.claude/vibe-kit/state.json"
QUEUE_FILE="${MONOREPO}/.claude/vibe-kit/queue.json"
AUTO_SCRIPT="${MONOREPO}/scripts/nexus-auto.sh"
VIBE_SCRIPT="${MONOREPO}/scripts/vibe.sh"

# Stats scripts (merged in)
HERMES_STATS="${MONOREPO}/scripts/nexus-hermes-stats.sh"
OLLAMA_STATS="${MONOREPO}/scripts/nexus-ollama-stats.sh"
QDRANT_STATS="${MONOREPO}/scripts/nexus-qdrant-stats.sh"
REDIS_STATS="${MONOREPO}/scripts/nexus-redis-stats.sh"

# Rate limiter
RATE_LIMITER="${MONOREPO}/scripts/nexus-rate-limiter.sh"

# Session scheduler state
SCHEDULE_FILE="${HOME}/.claude/projects/-tmp/memory/session-schedule.json"

# Alert system
ALERT_DIR="${LOG_DIR}/alerts"
ALERT_QUEUE="${ALERT_DIR}/queue.json"
ALERT_HISTORY="${ALERT_DIR}/history.json"

# Context manager state
MEMORY_DIR="${HOME}/.claude/projects/-tmp/memory"
CONTEXT_STATE="${MEMORY_DIR}/context-state.json"
CONTEXT_ALERTS="${MEMORY_DIR}/context-alerts.json"

# Watch daemon config
WATCH_PID_FILE="${MONOREPO}/.claude/nexus-watch.pid"
WATCH_LOG="${LOG_DIR}/nexus-watch.log"
PROCESSED_SPECS_FILE="${MONOREPO}/.claude/vibe-kit/.processed_specs.json"
WATCH_POLL_INTERVAL="${WATCH_POLL_INTERVAL:-60}"
SPEC_DIR="${SPEC_DIR:-/srv/monorepo/docs/SPECS}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
MAGENTA='\033[0;35m'
NC='\033[0m'
[ -t 1 ] || { RED=; GREEN=; YELLOW=; BLUE=; CYAN= MAGENTA=; NC=; }

# ===== LOGGING =====
log() { echo -e "${GREEN}[NEXUS]${NC} $*"; echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >> "$NEXUS_LOG" 2>/dev/null || true; }
warn() { echo -e "${YELLOW}[NEXUS]${NC} $*" >&2; }
error() { echo -e "${RED}[NEXUS]${NC} $*" >&2; }
info() { echo -e "${BLUE}[NEXUS]${NC} $*"; }

# ===== INIT =====
init() {
  mkdir -p "$LOG_DIR" "$(dirname "$PID_FILE")" "$(dirname "$STATE_FILE")" 2>/dev/null
  mkdir -p "$ALERT_DIR" "$MEMORY_DIR" "$(dirname "$SCHEDULE_FILE")" 2>/dev/null
  touch "$NEXUS_LOG" 2>/dev/null || true
}

# ===== ALERT SYSTEM =====
generate_alert_id() { echo "ALT-$(date +%Y%m%d-%H%M%S)-$((RANDOM % 10000))"; }

do_alert() {
  local severity="${1:-info}"
  local message="${2:-}"
  local details="${3:-}"

  [ -z "$message" ] && { error "Message required"; return 1; }

  local id=$(generate_alert_id)
  local timestamp=$(date -Iseconds)

  local alert=$(cat << EOF
{
  "id": "$id",
  "severity": "$severity",
  "message": "$message",
  "details": "$details",
  "created_at": "$timestamp",
  "updated_at": "$timestamp",
  "reminders": 0,
  "escalation_level": 0,
  "resolved": false,
  "resolved_at": null
}
EOF
)

  local alerts=$(cat "$ALERT_QUEUE" 2>/dev/null || echo "[]")
  echo "$alerts" | jq --argjson alert "$alert" '. + [$alert]' > "$ALERT_QUEUE.tmp" 2>/dev/null && \
    mv "$ALERT_QUEUE.tmp" "$ALERT_QUEUE"

  echo -e "${MAGENTA}[ALERT]${NC} [$severity] $message"
  log "Alert created: $id - $message"
}

list_alerts() {
  echo ""
  echo -e "${MAGENTA}==== ACTIVE ALERTS ====${NC}"

  local alerts=$(cat "$ALERT_QUEUE" 2>/dev/null | jq -c '.[]' 2>/dev/null)
  [ -z "$alerts" ] && { echo "  No active alerts"; return 0; }

  local count=0
  while IFS= read -r alert; do
    [ -z "$alert" ] && continue
    count=$((count + 1))
    local id=$(echo "$alert" | jq -r '.id')
    local severity=$(echo "$alert" | jq -r '.severity')
    local message=$(echo "$alert" | jq -r '.message')
    local created=$(echo "$alert" | jq -r '.created_at')
    echo -e "  ${RED}[$severity]${NC} $id: $message (created: $created)"
  done <<< "$alerts"

  echo "  Total: $count"
}

resolve_alert() {
  local id="${1:-}"
  [ -z "$id" ] && { error "Alert ID required"; return 1; }

  local alert=$(jq --arg id "$id" '.[] | select(.id == $id)' "$ALERT_QUEUE" 2>/dev/null)
  [ -z "$alert" ] && { error "Alert not found: $id"; return 1; }

  local resolved_at=$(date -Iseconds)
  alert=$(echo "$alert" | jq --arg resolved_at "$resolved_at" '.resolved_at = $resolved_at | .resolved = true')

  # Add to history
  local history=$(cat "$ALERT_HISTORY" 2>/dev/null || echo "[]")
  echo "$history" | jq --argjson alert "$alert" '. + [$alert]' > "$ALERT_HISTORY.tmp" && \
    mv "$ALERT_HISTORY.tmp" "$ALERT_HISTORY"

  # Remove from queue
  local queue=$(jq --arg id "$id" 'map(select(.id != $id))' "$ALERT_QUEUE" 2>/dev/null)
  echo "$queue" > "$ALERT_QUEUE"

  log "Resolved alert: $id"
}

# ===== CONTEXT MANAGER =====
estimate_context_usage() {
  local memory_size=0
  local session_file="${MONOREPO}/.claude/sessions/.active/.session.jsonl"

  [ -f "$CONTEXT_STATE" ] && memory_size=$(stat -c%s "$CONTEXT_STATE" 2>/dev/null || echo 0)
  [ -f "$session_file" ] && memory_size=$((memory_size + $(stat -c%s "$session_file" 2>/dev/null || echo 0)))

  local session_count=$(find "${MONOREPO}/.claude/sessions" -name "*.jsonl" -type f 2>/dev/null | wc -l)
  local total_size=$memory_size

  local estimated_pct=20
  [ "$total_size" -lt 20000 ] && estimated_pct=20
  [ "$total_size" -lt 40000 ] && estimated_pct=40
  [ "$total_size" -lt 60000 ] && estimated_pct=55
  [ "$total_size" -lt 80000 ] && estimated_pct=70
  [ "$total_size" -lt 100000 ] && estimated_pct=80
  [ "$total_size" -lt 120000 ] && estimated_pct=90
  [ "$total_size" -ge 120000 ] && estimated_pct=95

  [ "$session_count" -gt 10 ] && estimated_pct=$((estimated_pct + 3))
  [ "$estimated_pct" -gt 100 ] && estimated_pct=100

  echo "$estimated_pct"
}

save_context() {
  local reason="${1:-manual}"
  local usage=$(estimate_context_usage)
  local timestamp=$(date -Iseconds)
  local session_count=$(find "${MONOREPO}/.claude/sessions" -name "*.jsonl" -type f 2>/dev/null | wc -l)

  cat > "$CONTEXT_STATE" << EOF
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
  log "Context saved (reason: $reason, usage: ${usage}%)"
}

monitor_context() {
  local usage=$(estimate_context_usage)
  local timestamp=$(date -Iseconds)

  echo -e "${CYAN}Context usage: ${usage}%${NC}"

  if [ "$usage" -ge 95 ]; then
    do_alert "critical" "Context at ${usage}% - EMERGENCY SAVE REQUIRED"
    save_context "emergency-threshold"
    echo -e "${RED}EMERGENCY: Consider starting new session${NC}"
  elif [ "$usage" -ge 85 ]; then
    do_alert "error" "Context at ${usage}% - CRITICAL threshold"
    save_context "critical-threshold"
  elif [ "$usage" -ge 70 ]; then
    save_context "warn-threshold"
  fi
}

context_status() {
  local usage=$(estimate_context_usage)
  local session_count=$(find "${MONOREPO}/.claude/sessions" -name "*.jsonl" -type f 2>/dev/null | wc -l)
  local memory_count=$(find "$MEMORY_DIR" -name "*.md" -type f 2>/dev/null | wc -l)

  echo ""
  echo -e "${CYAN}==== CONTEXT STATUS ====${NC}"
  echo -e "  Usage: ${usage}%"
  echo -e "  Sessions: $session_count"
  echo -e "  Memory files: $memory_count"
}

# ===== SESSION SCHEDULER =====
init_scheduler() {
  mkdir -p "$(dirname "$SCHEDULE_FILE")"
  [ ! -f "$SCHEDULE_FILE" ] && echo '{"version":"1.0.0","schedules":[],"last_update":null}' > "$SCHEDULE_FILE"
}

matches_cron() {
  local cron_spec="${1:-}"
  local now="${2:-$(date +%s)}"

  local minute=$(date -d "@$now" +%M)
  local hour=$(date -d "@$now" +%H)
  local dom=$(date -d "@$now" +%d)
  local mon=$(date -d "@$now" +%m)
  local dow=$(date -d "@$now" +%u)

  local cron_min=$(echo "$cron_spec" | awk '{print $1}')
  local cron_hour=$(echo "$cron_spec" | awk '{print $2}')
  local cron_dom=$(echo "$cron_spec" | awk '{print $3}')
  local cron_mon=$(echo "$cron_spec" | awk '{print $4}')
  local cron_dow=$(echo "$cron_spec" | awk '{print $5}')

  check_field() {
    local val="$1"; local pattern="$2"
    [ "$pattern" = "*" ] && return 0
    [ "$pattern" = "$val" ] && return 0
    echo "$pattern" | grep -q ',' && { echo "$pattern" | tr ',' '\n' | grep -qx "$val" && return 0; }
    echo "$pattern" | grep -q '-' && { local start=$(echo "$pattern" | cut -d'-' -f1); local end=$(echo "$pattern" | cut -d'-' -f2); [ "$val" -ge "$start" ] && [ "$val" -le "$end" ] && return 0; }
    return 1
  }

  check_field "$minute" "$cron_min" || return 1
  check_field "$hour" "$cron_hour" || return 1
  check_field "$dom" "$cron_dom" || return 1
  check_field "$mon" "$cron_mon" || return 1
  check_field "$dow" "$cron_dow" || return 1
  return 0
}

list_schedules() {
  init_scheduler
  echo ""
  echo -e "${MAGENTA}==== SESSION SCHEDULES ====${NC}"

  local schedules=$(cat "$SCHEDULE_FILE" | jq -r '.schedules[] | @base64' 2>/dev/null)
  [ -z "$schedules" ] || [ "$schedules" = "null" ] && { echo "  No schedules configured"; return 0; }

  while IFS= read -r encoded; do
    [ -z "$encoded" ] && continue
    local schedule=$(echo "$encoded" | base64 -d)
    local name=$(echo "$schedule" | jq -r '.name')
    local cron=$(echo "$schedule" | jq -r '.cron')
    local command=$(echo "$schedule" | jq -r '.command')
    local active=$(echo "$schedule" | jq -r '.active')
    echo -e "  ${CYAN}$name${NC} | cron: $cron | cmd: $command | active: $active"
  done <<< "$schedules"
}

add_schedule() {
  local name="${1:-}"
  local cron="${2:-}"
  local command="${3:-}"

  [ -z "$name" ] || [ -z "$cron" ] || [ -z "$command" ] && { error "Usage: nexus.sh schedule <name> <cron> <command>"; return 1; }

  init_scheduler

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

  local existing=$(cat "$SCHEDULE_FILE" | jq ".schedules = (.schedules | map(select(.name != \"${name}\")))")
  echo "$existing" | jq ".schedules += [${schedule}]" > "$SCHEDULE_FILE.tmp" && mv "$SCHEDULE_FILE.tmp" "$SCHEDULE_FILE"

  log "Schedule added: $name ($cron)"
}

run_scheduler_tick() {
  init_scheduler
  local now=$(date +%s)
  local schedules=$(cat "$SCHEDULE_FILE" | jq -r '.schedules[] | @base64' 2>/dev/null)

  while IFS= read -r encoded; do
    [ -z "$encoded" ] && continue
    local schedule=$(echo "$encoded" | base64 -d)
    local name=$(echo "$schedule" | jq -r '.name')
    local cron=$(echo "$schedule" | jq -r '.cron')
    local command=$(echo "$schedule" | jq -r '.command')
    local active=$(echo "$schedule" | jq -r '.active')
    local last_run=$(echo "$schedule" | jq -r '.last_run // empty')

    [ "$active" = "false" ] && continue

    if matches_cron "$cron" "$now"; then
      if [ -n "$last_run" ] && [ "$last_run" != "null" ]; then
        local last_sec=$(date -d "$last_run" +%s 2>/dev/null || echo 0)
        local elapsed=$((now - last_sec))
        [ "$elapsed" -lt 3000 ] && continue
      fi

      # Update last_run
      cat "$SCHEDULE_FILE" | jq ".schedules = (.schedules | map(if .name == \"${name}\" then .last_run = \"$(date -Iseconds)\" else . end))" > "$SCHEDULE_FILE.tmp" && \
        mv "$SCHEDULE_FILE.tmp" "$SCHEDULE_FILE"

      info "Running schedule: $name ($command)"
      case "$command" in
        fit-*) bash "/srv/monorepo/apps/fit-v3/fit-v3.sh" $(echo "$command" | sed 's/fit-//') >> "$LOG_DIR/nexus-scheduler.log" 2>&1 ;;
        nexus-*) bash "${MONOREPO}/scripts/$(echo "$command" | sed 's/nexus-/nexus-/')" >> "$LOG_DIR/nexus-scheduler.log" 2>&1 ;;
        *) log "Schedule command not executed: $command" ;;
      esac
    fi
  done <<< "$schedules"
}

# ===== SERVICE INVESTIGATION =====
declare -A SERVICE_DEFS=(
  ["gym"]="4010:python"
  ["hermes"]="8642:python"
  ["api"]="4000:python"
  ["chat"]="3456:python"
  ["llm"]="4002:litellm"
  ["pgadmin"]="4050:python"
  ["qdrant"]="6333:qdrant"
  ["coolify"]="8000:php"
  ["git"]="3300:gitea"
)

investigate_service() {
  local svc="${1:-}"
  local depth="${2:-3}"
  local port="${SERVICE_DEFS[$svc]%%:*}"

  [ -z "$port" ] && { error "Unknown service: $svc"; return 2; }

  echo ""
  echo -e "${MAGENTA}==== INVESTIGATING: $svc ====${NC}"

  # Layer 1: HTTP check
  local http_code=$(curl -s -o /dev/null -w "%{http_code}" --connect-timeout 10 "https://${svc}.zappro.site/" 2>/dev/null || echo "000")

  if [ "$http_code" = "200" ] || [ "$http_code" = "301" ] || [ "$http_code" = "302" ]; then
    echo -e "${GREEN}✓${NC} HTTP: $http_code"

    # Layer 2: Port verification
    if ss -tln 2>/dev/null | grep -qE ":${port}([[:space:]]|$)"; then
      echo -e "${GREEN}✓${NC} Port $port: LISTENING"
    else
      echo -e "${RED}✗${NC} Port $port: NOT LISTENING (INCONSISTENT!)"
      return 1
    fi

    echo -e "${GREEN}VERDICT: HEALTHY${NC}"
    return 0
  else
    echo -e "${RED}✗${NC} HTTP: $http_code"
    if ss -tln 2>/dev/null | grep -qE ":${port}([[:space:]]|$)"; then
      echo -e "${YELLOW}!${NC} Port $port is listening but HTTP failed"
    fi
    echo -e "${RED}VERDICT: UNHEALTHY${NC}"
    return 1
  fi
}

investigate_all() {
  echo ""
  echo -e "${MAGENTA}==== TESTING ALL SERVICES ====${NC}"

  local healthy=0
  local unhealthy=0

  for svc in gym hermes api chat llm pgadmin qdrant coolify git; do
    if investigate_service "$svc" 3; then
      healthy=$((healthy + 1))
      echo -e "${GREEN}✓ $svc: HEALTHY${NC}"
    else
      unhealthy=$((unhealthy + 1))
      echo -e "${RED}✗ $svc: UNHEALTHY${NC}"
    fi
    echo ""
  done

  echo "Healthy: $healthy | Unhealthy: $unhealthy"
  [ "$unhealthy" -gt 0 ] && return 1 || return 0
}

# ===== STATS =====
show_stats() {
  echo ""
  echo -e "${CYAN}==== SYSTEM METRICS ====${NC}"

  # Hermes
  if [ -x "$HERMES_STATS" ]; then
    local hermes_health=$(curl -s "http://localhost:8642/health" 2>/dev/null | jq -r '.status' 2>/dev/null || echo "unknown")
    echo -e "  Hermes: ${hermes_health}"
  fi

  # Ollama
  if [ -x "$OLLAMA_STATS" ]; then
    local ollama_models=$(curl -s "http://localhost:11434/api/tags" 2>/dev/null | jq '.models | length' 2>/dev/null || echo "?")
    echo -e "  Ollama models: $ollama_models"
  fi

  # Qdrant
  if [ -x "$QDRANT_STATS" ]; then
    local collections=$(curl -s "http://localhost:6333/collections" 2>/dev/null | jq '.result.collections | length' 2>/dev/null || echo "?")
    echo -e "  Qdrant collections: $collections"
  fi

  # Redis
  if command -v redis-cli &>/dev/null; then
    local redis_info=$(redis-cli info 2>/dev/null | grep "connected_clients" | cut -d: -f2 | tr -d '\r')
    echo -e "  Redis clients: ${redis_info:-?}"
  fi
}

# ===== NEXUS CONTROL =====
do_start() {
  if [ -f "$PID_FILE" ] && pid=$(cat "$PID_FILE" 2>/dev/null) && [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
    error "Nexus already running with PID $pid"
    exit 1
  fi

  [ ! -f "$AUTO_SCRIPT" ] && { error "nexus-auto.sh not found"; exit 1; }

  log "Starting Nexus..."
  nohup bash "$AUTO_SCRIPT" loop >> "$NEXUS_LOG" 2>&1 &
  local new_pid=$!
  echo "$new_pid" > "$PID_FILE"
  sleep 0.5

  if kill -0 "$new_pid" 2>/dev/null; then
    log "Nexus started with PID $new_pid"
  else
    error "Failed to start Nexus"
    rm -f "$PID_FILE"
    exit 1
  fi
}

do_stop() {
  [ ! -f "$PID_FILE" ] && { error "PID file not found"; exit 1; }

  local pid=$(cat "$PID_FILE" 2>/dev/null)
  [ -z "$pid" ] && { rm -f "$PID_FILE"; exit 0; }

  if ! kill -0 "$pid" 2>/dev/null; then
    warn "Process $pid not running"
    rm -f "$PID_FILE"
    return 0
  fi

  log "Stopping Nexus (PID $pid)..."
  kill "$pid" 2>/dev/null || true

  local count=0
  while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
    sleep 0.5
    count=$((count + 1))
  done

  kill -9 "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  log "Nexus stopped"
}

do_status() {
  local pid=""
  local running=""
  local state="unknown"
  local pending=0
  local running_cnt=0
  local done=0

  if [ -f "$PID_FILE" ]; then
    pid=$(cat "$PID_FILE" 2>/dev/null || echo "")
    [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && running="yes"
  fi

  [ -f "$STATE_FILE" ] && state=$(jq -r '.phase // "unknown"' "$STATE_FILE" 2>/dev/null || echo "unknown")

  if [ -f "$QUEUE_FILE" ]; then
    pending=$(jq -r '.tasks | map(select(.status == "pending")) | length' "$QUEUE_FILE" 2>/dev/null || echo 0)
    running_cnt=$(jq -r '.tasks | map(select(.status == "running")) | length' "$QUEUE_FILE" 2>/dev/null || echo 0)
    done=$(jq -r '.tasks | map(select(.status == "done")) | length' "$QUEUE_FILE" 2>/dev/null || echo 0)
  fi

  echo ""
  echo -e "${CYAN}==== NEXUS STATUS ====${NC}"
  echo -e "  Running: $([ "$running" = "yes" ] && echo -e "${GREEN}yes${NC}" || echo -e "${RED}no${NC}")"
  echo -e "  PID: ${pid:-none}"
  echo -e "  State: $state"
  echo -e "  Queue: pending=$pending running=$running_cnt done=$done"
  echo ""
}

do_restart() {
  do_stop 2>/dev/null || true
  sleep 1
  do_start
}

do_reset() {
  if [ -f "$PID_FILE" ] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
    warn "Nexus is running, stopping first..."
    do_stop
  fi

  [ -f "$STATE_FILE" ] && jq '(.phase = "idle") | (.tasks_total = 0) | (.tasks_done = 0)' "$STATE_FILE" > "${STATE_FILE}.tmp" && mv "${STATE_FILE}.tmp" "$STATE_FILE"
  [ -f "$QUEUE_FILE" ] && echo '{"tasks": [], "pending": 0, "running": 0, "done": 0, "failed": 0}' > "$QUEUE_FILE"

  rm -f "$PID_FILE"
  log "Nexus reset complete"
}

do_run_spec() {
  local spec="${1:-}"
  [ -z "$spec" ] && { error "Usage: nexus.sh run <SPEC-ID> [app]"; exit 2; }
  [ ! -f "$VIBE_SCRIPT" ] && { error "vibe.sh not found"; exit 1; }

  local app="${2:-}"
  log "Running SPEC through vibe-kit: spec=$spec app=${app:-monorepo}"

  if [ -n "$app" ]; then
    bash "$VIBE_SCRIPT" --spec "$spec" --app "$app" --run
  else
    bash "$VIBE_SCRIPT" --spec "$spec" --run
  fi
}

# ===== WATCH DAEMON =====
do_watch() {
  # Idempotency: prevent double launch
  if [ -f "$WATCH_PID_FILE" ]; then
    local existing_pid
    existing_pid=$(cat "$WATCH_PID_FILE" 2>/dev/null)
    if [ -n "$existing_pid" ] && kill -0 "$existing_pid" 2>/dev/null; then
      error "Watch daemon already running with PID $existing_pid"
      exit 1
    fi
    rm -f "$WATCH_PID_FILE"
  fi

  # Daemonize
  log "Starting watch daemon (pid=$$)..."
  nohup bash "$0" _watch_loop >> "$WATCH_LOG" 2>&1 &
  local new_pid=$!
  echo "$new_pid" > "$WATCH_PID_FILE"
  sleep 0.5

  if kill -0 "$new_pid" 2>/dev/null; then
    log "Watch daemon started with PID $new_pid"
    echo "Watch daemon running on PID $new_pid (log: $WATCH_LOG)"
  else
    error "Failed to start watch daemon"
    rm -f "$WATCH_PID_FILE"
    exit 1
  fi
}

_watch_stop() {
  [ ! -f "$WATCH_PID_FILE" ] && { error "Watch PID file not found"; exit 1; }
  local pid=$(cat "$WATCH_PID_FILE")
  [ -z "$pid" ] && { rm -f "$WATCH_PID_FILE"; exit 0; }

  if ! kill -0 "$pid" 2>/dev/null; then
    warn "Watch process $pid not running"
    rm -f "$WATCH_PID_FILE"
    return 0
  fi

  log "Stopping watch daemon (PID $pid)..."
  kill "$pid" 2>/dev/null || true
  local count=0
  while kill -0 "$pid" 2>/dev/null && [ $count -lt 10 ]; do
    sleep 0.5
    count=$((count + 1))
  done
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$WATCH_PID_FILE"
  log "Watch daemon stopped"
}

_watch_status() {
  local running="no"
  local pid=""
  if [ -f "$WATCH_PID_FILE" ]; then
    pid=$(cat "$WATCH_PID_FILE" 2>/dev/null)
    [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null && running="yes"
  fi

  echo ""
  echo -e "${CYAN}==== NEXUS WATCH STATUS ====${NC}"
  echo -e "  Running: $([ "$running" = "yes" ] && echo -e "${GREEN}yes${NC}" || echo -e "${RED}no${NC}")"
  echo -e "  PID: ${pid:-none}"
  echo -e "  Poll interval: ${WATCH_POLL_INTERVAL}s"
  echo -e "  SPEC dir: $SPEC_DIR"
  echo -e "  Processed specs: $PROCESSED_SPECS_FILE"

  if [ -f "$PROCESSED_SPECS_FILE" ]; then
    local count
    count=$(jq 'length' "$PROCESSED_SPECS_FILE" 2>/dev/null || echo 0)
    echo -e "  Total processed: $count"
  fi
}

_trigger_next_pending() {
  # Check if anything is running or pending
  local pending running
  pending=$(jq -r '.pending // 0' "$QUEUE_FILE" 2>/dev/null || echo 0)
  running=$(jq -r '.running // 0' "$QUEUE_FILE" 2>/dev/null || echo 0)

  if [ "$pending" -gt 0 ] && [ "$running" -eq 0 ]; then
    log "Chain: triggering next pending SPEC..."
    # Find first pending task's spec
    local next_spec
    next_spec=$(jq -r '.tasks[] | select(.status == "pending") | .spec' "$QUEUE_FILE" 2>/dev/null | head -1)
    if [ -n "$next_spec" ] && [ "$next_spec" != "null" ]; then
      local next_app
      next_app=$(jq -r '.tasks[] | select(.status == "pending") | .app' "$QUEUE_FILE" 2>/dev/null | head -1)
      log "Chain: auto-starting spec=$next_spec app=${next_app:-monorepo}"
      bash "$VIBE_SCRIPT" --spec "$next_spec" --app "${next_app:-}" --do &
    fi
  else
    log "Chain: no pending tasks (pending=$pending running=$running)"
  fi
}

_watch_chain_loop() {
  log "Starting chain loop..."

  while true; do
    local pending running
    pending=$(jq -r '.pending // 0' "$QUEUE_FILE" 2>/dev/null || echo 0)
    running=$(jq -r '.running // 0' "$QUEUE_FILE" 2>/dev/null || echo 0)

    if [ "$pending" -gt 0 ] && [ "$running" -eq 0 ]; then
      local next_spec next_app
      next_spec=$(jq -r '.tasks[] | select(.status == "pending") | .spec' "$QUEUE_FILE" 2>/dev/null | head -1)
      next_app=$(jq -r '.tasks[] | select(.status == "pending") | .app' "$QUEUE_FILE" 2>/dev/null | head -1)

      if [ -n "$next_spec" ] && [ "$next_spec" != "null" ]; then
        log "Chain: running spec=$next_spec app=${next_app:-monorepo}"
        VIBE_SKIP_GIT_COMMIT=true VIBE_PHASE=do bash "$VIBE_SCRIPT" "$next_spec" "${next_app:-}"
        sleep 5
        continue
      fi
    fi

    sleep "$WATCH_POLL_INTERVAL"
  done
}

# Continuous loop command
do_loop_cmd() {
  local spec="${1:-}"
  local app="${2:-}"

  log "Starting loop mode (spec=$spec app=$app)"

  # If spec provided, run it first then chain
  if [ -n "$spec" ]; then
    VIBE_SKIP_GIT_COMMIT=true bash "$VIBE_SCRIPT" --spec "$spec" --app "$app" --do &
    local vibe_pid=$!
    log "Initial vibe PID: $vibe_pid"
    wait $vibe_pid 2>/dev/null || true
    sleep 3
  fi

  # Start chain loop (continuous execution of pending tasks)
  _watch_chain_loop
}

# Internal: the actual watch daemon loop
_execute_watch_loop() {
  echo $$ > "$WATCH_PID_FILE"

  local use_inotify=0
  if command -v inotifywait &>/dev/null; then
    use_inotify=1
    log "Watch: using inotifywait (event-driven)"
  else
    log "Watch: using stat polling (${WATCH_POLL_INTERVAL}s interval)"
  fi

  # Load processed specs
  local processed_specs="[]"
  if [ -f "$PROCESSED_SPECS_FILE" ]; then
    processed_specs=$(cat "$PROCESSED_SPECS_FILE" 2>/dev/null || echo "[]")
  fi

  # Graceful shutdown trap
  trap 'log "Watch: SIGTERM received — exiting cleanly"; rm -f "$WATCH_PID_FILE"; exit 0' SIGTERM

  if [ $use_inotify -eq 1 ]; then
    # Event-driven via inotifywait
    inotifywait -m -e create -e moved_to --format '%f' "$SPEC_DIR" 2>/dev/null | \
    while read -r filename; do
      if [[ "$filename" == *.md ]] && [[ "$filename" != README* ]] && [[ "$filename" != INDEX* ]]; then
        _watch_handle_new_spec "$filename" "$processed_specs"
      fi
    done
  else
    # Polling fallback
    while true; do
      sleep "$WATCH_POLL_INTERVAL"
      _watch_scan_new_specs "$processed_specs"
    done
  fi
}

_watch_handle_new_spec() {
  local spec_name="$1"
  local processed_specs="$2"

  # Extract spec ID from filename (e.g., "SPEC-001-crm-mvp.md" -> "SPEC-001")
  local spec_id
  spec_id=$(echo "$spec_name" | sed 's/\.md$//')

  # Check if already processed
  if echo "$processed_specs" | jq -e -r '.[]' 2>/dev/null | grep -qx "$spec_id"; then
    return 0
  fi

  # Check if vibe-kit is already running
  local running
  running=$(jq -r '.running // 0' "$QUEUE_FILE" 2>/dev/null || echo 0)
  if [ "$running" -gt 0 ]; then
    log "Watch: vibe-kit already running (running=$running), skipping $spec_id"
    return 0
  fi

  # Mark as processed
  processed_specs=$(echo "$processed_specs" | jq ". + [\"$spec_id\"]")
  echo "$processed_specs" > "$PROCESSED_SPECS_FILE"

  log "Watch: new SPEC detected -> $spec_id"

  # Trigger run-vibe.sh in background
  bash "$VIBE_SCRIPT" --spec "$spec_id" --do &
  log "Watch: triggered run-vibe.sh for $spec_id (pid=$!)"
}

_watch_scan_new_specs() {
  local processed_specs="$1"

  for spec_file in "$SPEC_DIR"/*.md; do
    [ -f "$spec_file" ] || continue
    local basename
    basename=$(basename "$spec_file")

    # Skip non-spec files
    [[ "$basename" == README* ]] && continue
    [[ "$basename" == INDEX* ]] && continue
    [[ "$basename" == _legacy* ]] && continue

    local spec_id
    spec_id=$(echo "$basename" | sed 's/\.md$//')

    # Skip already processed
    if echo "$processed_specs" | jq -e -r '.[]' 2>/dev/null | grep -qx "$spec_id"; then
      continue
    fi

    _watch_handle_new_spec "$basename" "$processed_specs"
  done
}

# ===== MAIN CLI =====
show_help() {
  cat << 'EOF'
nexus.sh — Nexus Orchestrator (CONSOLIDATED)

USAGE:
  nexus.sh <command> [args]

CORE COMMANDS:
  start              Start autonomous loop
  stop               Stop autonomous loop
  status             Show system status
  restart            Restart autonomous loop
  reset              Reset state and queue
  run <spec> [app]   Run SPEC through vibe-kit

ALERTS:
  alert <sev> <msg> [details]   Create alert (severity: info, warn, error, critical)
  list-alerts                  List active alerts
  resolve <id>                 Resolve alert

CONTEXT:
  monitor            Monitor context window
  save               Force save context state
  context-status     Show context status

SCHEDULING:
  schedule <name> <cron> <cmd>  Add schedule
  list-schedules                  List schedules
  tick                            Cron tick (run scheduled tasks)

INVESTIGATION:
  investigate <svc> [depth]  Investigate service health
  all                         Test all services

METRICS:
  stats               Show all metrics

Run individual stats:
  nexus.sh hermes     Hermes metrics
  nexus.sh ollama      Ollama metrics
  nexus.sh qdrant      Qdrant metrics
  nexus.sh redis       Redis metrics

WATCH COMMANDS:
  watch              Start watch daemon (polls for new SPECs in docs/SPECS/)
  watch-stop         Stop watch daemon
  watch-status       Show watch daemon status

LOOP COMMANDS:
  loop [spec] [app]  Run spec (optional) then chain continuously (Replit AI Agent mode)

EXAMPLES:
  nexus.sh start
  nexus.sh alert warn "High memory usage" "80% full"
  nexus.sh list-alerts
  nexus.sh monitor
  nexus.sh investigate hermes 3
  nexus.sh all
  nexus.sh watch
  nexus.sh loop SPEC-001 crm-mvp
EOF
}

main() {
  init

  local command="${1:-}"
  shift || true

  case "$command" in
    # Core control
    start) do_start ;;
    stop) do_stop ;;
    status) do_status ;;
    restart) do_restart ;;
    reset) do_reset ;;
    run) do_run_spec "$@" ;;

    # Alerts
    alert|add-alert) do_alert "$@" ;;
    list-alerts|alerts) list_alerts ;;
    resolve) resolve_alert "$1" ;;

    # Context
    monitor) monitor_context ;;
    save) save_context "manual" ;;
    context-status|context) context_status ;;
    new-session) save_context "pre-new-session" ;;

    # Scheduling
    schedule) add_schedule "$@" ;;
    list-schedules|schedules) list_schedules ;;
    tick) run_scheduler_tick ;;

    # Investigation
    investigate) investigate_service "$@" ;;
    all) investigate_all ;;

    # Stats
    stats|metrics) show_stats ;;
    hermes) bash "$HERMES_STATS" 2>/dev/null || echo "Hermes stats not available" ;;
    ollama) bash "$OLLAMA_STATS" 2>/dev/null || echo "Ollama stats not available" ;;
    qdrant) bash "$QDRANT_STATS" 2>/dev/null || echo "Qdrant stats not available" ;;
    redis) bash "$REDIS_STATS" 2>/dev/null || echo "Redis stats not available" ;;

    # Watch daemon
    watch) do_watch ;;
    watch-stop) _watch_stop ;;
    watch-status) _watch_status ;;
    _watch_loop) _execute_watch_loop ;;

    # Continuous loop
    loop) do_loop_cmd "$@" ;;

    help|--help|-h)
      show_help
      exit 0
      ;;
    *)
      [ -z "$command" ] && { show_help; exit 2; }
      error "Unknown command: $command"
      show_help
      exit 2
      ;;
  esac
}

main "$@"