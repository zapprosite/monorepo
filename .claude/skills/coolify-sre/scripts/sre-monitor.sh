#!/bin/bash
#===========================================
# Coolify SRE Monitor — Unified monitoring
# Replaces: auto-healer, resource-monitor, tunnel-health, smoke-tunnel
# Cron: */5 * * * * (every 5 minutes)
#===========================================
set -euo pipefail

COOLIFY_URL="${COOLIFY_URL:-http://localhost:8000}"
COOLIFY_API_KEY=""
INFISICAL_PROJECT_ID="e42657ef-98b2-4b9c-9a04-46c093bd6d37"
INFISICAL_ENV="dev"
INFISICAL_TOKEN_PATH="/srv/ops/secrets/infisical.service-token"

LOG_DIR="/srv/ops/logs"
SRE_LOG="$LOG_DIR/sre-monitor.log"
HEAL_LOG="$LOG_DIR/healing.log"
RESOURCE_LOG="$LOG_DIR/resource-alerts.log"

THRESHOLD_CPU=70
THRESHOLD_MEMORY=80

COOLIFY_APP_NAMES="openclaw:openclaw-qgtzrmi6771lt8l7x8rqx72f openwebui:open-webui-wbmqefxhd7vdn2dme3i6s9an qdrant:qdrant-c95x9bgnhpedt0zp7dfsims7 n8n:n8n-jbu1zy377ies2zhc3qmd03gz"
IMMUTABLE_CONTAINERS="coolify-proxy cloudflared coolify-db prometheus grafana loki alertmanager"
PINNED_CONTAINERS="openclaw zappro-kokoro zappro-wav2vec2 zappro-wav2vec2-proxy zappro-tts-bridge zappro-litellm zappro-litellm-db openwebui"

HEALTH_ENDPOINTS="litellm:http://localhost:4000/health wav2vec2:http://localhost:8201/health tts-bridge:http://localhost:8013/health kokoro:http://localhost:8012/health qdrant:http://localhost:6333/healthz"

SUBDOMAINS="api.zappro.site bot.zappro.site chat.zappro.site coolify.zappro.site git.zappro.site grafana.zappro.site list.zappro.site llm.zappro.site md.zappro.site monitor.zappro.site n8n.zappro.site painel.zappro.site prometheus.zappro.site qdrant.zappro.site supabase.zappro.site vault.zappro.site"

HEALED_COUNT=0
FAILED_COUNT=0
ALERT_COUNT=0

mkdir -p "$LOG_DIR"

# Load .env if present
if [[ -f "${COOLIFY_ENV_FILE:-.env}" ]]; then
  set -a
  source "${COOLIFY_ENV_FILE:-.env}"
  set +a
fi

# Restart loop detection: rolling 30-minute window, max 3 heal attempts
HEAL_WINDOW_SECONDS=1800
HEAL_THRESHOLD=3

# Record a heal attempt timestamp for a container
record_heal() {
  local name="$1"
  echo "$(date +%s)" >> "$LOG_DIR/.heal-timestamps.$name"
}

# Count heal attempts in rolling 30-minute window
count_heals_in_window() {
  local name="$1"
  local cutoff
  cutoff=$(($(date +%s) - HEAL_WINDOW_SECONDS))
  local count=0
  local tmpfile="$LOG_DIR/.heal-timestamps.$name"
  [[ ! -f "$tmpfile" ]] && echo 0 && return
  while read -r ts; do
    [[ -z "$ts" ]] && continue
    [[ "$ts" -gt "$cutoff" ]] && count=$((count + 1))
  done < "$tmpfile"
  echo "$count"
}

# Reset heal record on successful healthy run
reset_heal_record() {
  local name="$1"
  rm -f "$LOG_DIR/.heal-timestamps.$name"
  rm -f "$LOG_DIR/.heal-count.$name"
}

# Check and enforce restart loop guard; returns 0 if healing is allowed, 1 if blocked
check_restart_loop() {
  local name="$1"
  local heals
  heals=$(count_heals_in_window "$name")
  if [[ "$heals" -gt "$HEAL_THRESHOLD" ]]; then
    echo "RESTART_LOOP_DETECTED: $name — $heals restarts in 30 min, skipping" >&2
    log_heal "RESTART_LOOP_BLOCKED $name heals=$heals"
    return 1
  fi
  return 0
}

log_sre() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1" | tee -a "$SRE_LOG"; }
log_heal() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1" >> "$HEAL_LOG"; }
log_resource() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1" >> "$RESOURCE_LOG"; }

load_api_key() {
  # COOLIFY_API_KEY sourced from .env at script start
  # If not set, log warning and skip Coolify API checks
  if [[ -z "$COOLIFY_API_KEY" ]]; then
    return 1
  fi
}

check_coolify_apps() {
  log_sre "INFO === Coolify Apps Check ==="
  if [[ -z "$COOLIFY_API_KEY" ]]; then
    log_sre "WARN COOLIFY_API_KEY unavailable, skipping Coolify API check"
    return
  fi

  for entry in $COOLIFY_APP_NAMES; do
    local app_name="${entry%%:*}"
    local container_name="${entry#*:}"

    local status
    status=$(docker inspect "$container_name" --format='{{.State.Status}}:{{.State.Health.Status}}' 2>/dev/null || echo "unknown:none")

    local state="${status%%:*}"
    local health="${status##*:}"
    local display_status="$state:$health"

    local status_icon="✅"
    case "$display_status" in
      running:healthy) status_icon="✅" ;;
      running:*) status_icon="⚠️" ;;
      exited:*|dead:*) status_icon="🔴" ;;
      *) status_icon="❓" ;;
    esac

    log_sre "INFO $status_icon coolify/$app_name ($container_name) status=$display_status"

    if [[ "$health" == "unhealthy" ]]; then
      if echo "$IMMUTABLE_CONTAINERS" | grep -qw "$app_name"; then
        log_sre "CRITICAL IMMUTABLE $app_name — NO ACTION PERMITTED"
      else
        heal_container "$container_name" "health=unhealthy"
      fi
    elif [[ "$state" != "running" ]]; then
      heal_container "$container_name" "state=$state"
    else
      # Container is healthy/running — clear restart loop tracking
      reset_heal_record "$container_name"
    fi
  done
}

check_docker_containers() {
  log_sre "INFO === Docker Containers Check ==="
  local containers
  containers=$(docker ps -a --format '{{.Names}}\t{{.Status}}' 2>/dev/null || echo "")

  while IFS=$'\t' read -r name status; do
    [[ -z "$name" ]] && continue

    local health
    health=$(docker inspect "$name" --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")
    local state
    state=$(docker inspect "$name" --format='{{.State.Status}}' 2>/dev/null || echo "unknown")

    if echo "$IMMUTABLE_CONTAINERS" | grep -qw "$name"; then
      log_sre "INFO IMMUTABLE $name state=$state health=$health — status only, no action"
      continue
    fi

    local status_icon="✅"
    case "$state" in
      running)
        if [[ "$health" == "healthy" ]] || [[ "$health" == "none" ]]; then
          status_icon="✅"
          reset_heal_record "$name"
        elif [[ "$health" == "unhealthy" ]]; then
          status_icon="⚠️"
          heal_container "$name" "health=unhealthy"
        fi
        ;;
      exited|dead|stopped)
        status_icon="🔴"
        heal_container "$name" "state=$state"
        ;;
    esac

    log_sre "INFO $status_icon docker/$name state=$state health=$health"
  done <<< "$containers"
}

check_health_endpoints() {
  log_sre "INFO === Health Endpoints Check ==="
  for entry in $HEALTH_ENDPOINTS; do
    local name="${entry%%:*}"
    local url="${entry#*:}"
    local http_code
    http_code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

    local status_icon="✅"
    case "$http_code" in
      200|204|401) status_icon="✅" ;;
      000) status_icon="🔴"; log_sre "WARN ROUTE_FAIL $name $url → connection refused" ;;
      *) status_icon="⚠️"; log_sre "WARN ROUTE_OK $name $url → HTTP $http_code" ;;
    esac

    log_sre "INFO $status_icon endpoint/$name $url → $http_code"
  done
}

check_resources() {
  log_sre "INFO === Resource Usage Check ==="
  local stats
  stats=$(docker stats --no-stream --format "{{.Name}},{{.CPUPerc}},{{.MemUsage}},{{.MemPerc}}" 2>/dev/null || echo "")

  while IFS=',' read -r name cpu mem perc; do
    [[ -z "$name" ]] && continue

    local cpu_val="${cpu%\%}"
    local mem_val="${perc%\%}"

    local alerts=""
    if (( $(echo "$cpu_val > $THRESHOLD_CPU" | bc -l 2>/dev/null || echo 0) )); then
      alerts="CPU ${cpu_val}%"
    fi
    if (( $(echo "$mem_val > $THRESHOLD_MEMORY" | bc -l 2>/dev/null || echo 0) )); then
      alerts="${alerts:+$alerts | }Memory ${mem_val}%"
    fi

    if [[ -n "$alerts" ]]; then
      log_sre "WARN ⚠️ $name: $alerts"
      log_resource "WARN $name cpu=${cpu_val}% mem=${mem_val}%"
      ALERT_COUNT=$((ALERT_COUNT + 1))
    fi
  done <<< "$stats"
}

check_subdomains() {
  log_sre "INFO === Subdomain Tunnel Check ==="
  for sub in $SUBDOMAINS; do
    local http_code
    http_code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 15 "https://$sub" 2>/dev/null || echo "000")

    case "$http_code" in
      000) log_sre "🔴 DOWN $sub → connection refused" ;;
      502|503) log_sre "⚠️ DEGRADED $sub → HTTP $http_code" ;;
      *) log_sre "✅ UP $sub → HTTP $http_code" ;;
    esac
  done
}

heal_container() {
  local name="$1"
  local reason="$2"

  if echo "$IMMUTABLE_CONTAINERS" | grep -qw "$name"; then
    log_sre "CRITICAL IMMUTABLE container $name reported $reason — NO ACTION PERMITTED"
    return 0
  fi

  # Restart loop guard
  if ! check_restart_loop "$name"; then
    return 1
  fi

  log_sre "INFO HEALING $name ($reason) — restarting..."
  log_heal "HEALING $name reason=$reason"

  if docker restart "$name" 2>/dev/null; then
    sleep 10
    record_heal "$name"
    local new_state
    new_state=$(docker inspect "$name" --format='{{.State.Status}}' 2>/dev/null || echo "unknown")
    if [[ "$new_state" == "running" ]]; then
      log_sre "INFO ✅ RESTART OK $name"
      log_heal "RESTART_OK $name"
      HEALED_COUNT=$((HEALED_COUNT + 1))
    else
      log_sre "ERROR ❌ RESTART FAILED $name (state=$new_state) — NEEDS MANUAL INTERVENTION"
      log_heal "RESTART_FAILED $name state=$new_state"
      FAILED_COUNT=$((FAILED_COUNT + 1))
    fi
  else
    log_sre "ERROR ❌ docker restart failed for $name — NEEDS MANUAL INTERVENTION"
    log_heal "DOCKER_RESTART_FAILED $name"
    FAILED_COUNT=$((FAILED_COUNT + 1))
  fi
}

main() {
  log_sre "INFO === SRE Monitor START ==="

  load_api_key

  check_coolify_apps
  check_docker_containers
  check_health_endpoints
  check_resources
  check_subdomains

  log_sre "INFO === SRE Monitor DONE healed=$HEALED_COUNT failed=$FAILED_COUNT alerts=$ALERT_COUNT ==="
}

main "$@"