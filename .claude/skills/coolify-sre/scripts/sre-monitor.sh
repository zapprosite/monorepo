#!/bin/bash
#===========================================
# Coolify SRE Monitor — Unified monitoring v2
# Replaces: auto-healer, resource-monitor, tunnel-health, smoke-tunnel
# Improvements: restart loop RCA, verify-after-heal, enhanced logging
# Cron: */5 * * * * (every 5 minutes)
#===========================================
set -euo pipefail

COOLIFY_URL="${COOLIFY_URL:-http://localhost:8000}"
COOLIFY_API_KEY=""

LOG_DIR="/srv/ops/logs"
SRE_LOG="$LOG_DIR/sre-monitor.log"
HEAL_LOG="$LOG_DIR/healing.log"
RESOURCE_LOG="$LOG_DIR/resource-alerts.log"
RCA_LOG="$LOG_DIR/rca.log"

THRESHOLD_CPU=150
THRESHOLD_MEMORY=80

# Active subdomains for tunnel health check
SUBDOMAINS="api chat coolify git hermes list llm md monitor painel qdrant todo"

COOLIFY_APP_NAMES="qdrant:qdrant-c95x9bgnhpedt0zp7dfsims7"
IMMUTABLE_CONTAINERS="coolify-proxy cloudflared coolify-db prometheus grafana loki alertmanager coolify-redis"
PINNED_CONTAINERS="zappro-kokoro zappro-wav2vec2 zappro-wav2vec2-proxy zappro-tts-bridge zappro-litellm zappro-litellm-db"

# Enhanced health endpoints with expected status codes
HEALTH_ENDPOINTS="litellm|http://localhost:4000/health|200|401|404 wav2vec2|http://localhost:8201/health|200 tts-bridge|http://localhost:8013/health|200 kokoro|http://localhost:8012/health|200 qdrant|http://10.0.19.2:6333/healthz|200"


HEALED_COUNT=0
FAILED_COUNT=0
ALERT_COUNT=0
SKIPPED_COUNT=0

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
  local reason="$2"
  echo "$(date +%s)|$reason" >> "$LOG_DIR/.heal-timestamps.$name"
}

# Count heal attempts in rolling 30-minute window
count_heals_in_window() {
  local name="$1"
  local cutoff
  cutoff=$(($(date +%s) - HEAL_WINDOW_SECONDS))
  local count=0
  local tmpfile="$LOG_DIR/.heal-timestamps.$name"
  [[ ! -f "$tmpfile" ]] && echo 0 && return
  while read -r line; do
    [[ -z "$line" ]] && continue
    local ts="${line%%|*}"
    [[ "$ts" =~ ^[0-9]+$ ]] && [[ "$ts" -gt "$cutoff" ]] && count=$((count + 1))
  done < "$tmpfile"
  echo "$count"
}

# Get last heal reason
get_last_heal_reason() {
  local name="$1"
  local tmpfile="$LOG_DIR/.heal-timestamps.$name"
  [[ ! -f "$tmpfile" ]] && echo "unknown" && return
  tail -n1 "$tmpfile" | cut -d'|' -f2 || echo "unknown"
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
  if [[ "$heals" -ge "$HEAL_THRESHOLD" ]]; then
    local reason
    reason=$(get_last_heal_reason "$name")
    echo "RESTART_LOOP_DETECTED: $name — $heals restarts in 30 min, reason=$reason, skipping" >&2
    log_heal "RESTART_LOOP_BLOCKED $name heals=$heals last_reason=$reason"
    SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
    return 1
  fi
  return 0
}

log_sre() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1" | tee -a "$SRE_LOG"; }
log_heal() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1" >> "$HEAL_LOG"; }
log_resource() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1" >> "$RESOURCE_LOG"; }
log_rca() { echo "[$(date -u '+%Y-%m-%dT%H:%M:%SZ')] $1" >> "$RCA_LOG"; }

load_api_key() {
  if [[ -z "$COOLIFY_API_KEY" ]]; then
    return 1
  fi
}

# Root Cause Analysis for container issues
rca_container() {
  local name="$1"
  local reason="$2"

  log_rca "RCA_START container=$name reason=$reason"

  # Check Docker logs for common patterns
  local logs
  logs=$(docker logs "$name" --tail 20 2>&1 || echo "LOGS_UNAVAILABLE")

  # Pattern matching for common issues
  case "$logs" in
    *"dockerd: not found"*)
      log_rca "RCA_RESULT container=$name cause=Docker-Daemon-Missing suggestion='Container requires Docker-in-Docker but daemon not available'"
      ;;
    *"connection refused"*)
      log_rca "RCA_RESULT container=$name cause=Connection-Refused suggestion='Backend service not running or port blocked'"
      ;;
    *"permission denied"*)
      log_rca "RCA_RESULT container=$name cause=Permission-Denied suggestion='Check volume mounts and user permissions'"
      ;;
    *"ENOENT"*)
      log_rca "RCA_RESULT container=$name cause=File-Not-Found suggestion='Missing dependency or misconfigured volume'"
      ;;
    *"out of memory"*)
      log_rca "RCA_RESULT container=$name cause=OOM-Killed suggestion='Increase memory limit or optimize app'"
      ;;
    *"curl: not found"*)
      log_rca "RCA_RESULT container=$name cause=Healthcheck-Missing-Binary suggestion='Image does not have curl — change healthcheck to wget or install curl in Dockerfile'"
      ;;
    *"404"*|*"not found"*)
      log_rca "RCA_RESULT container=$name cause=HTTP-404 suggestion='Health endpoint misconfigured or app routing issue'"
      ;;
    *"500"*|*"Internal Server Error"*)
      log_rca "RCA_RESULT container=$name cause=HTTP-500 suggestion='App internal error, check application logs'"
      ;;
    *)
      log_rca "RCA_RESULT container=$name cause=Unknown logs_preview=$(echo "$logs" | tail -n5 | tr '\n' ' ')"
      ;;
  esac
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
        heal_container "$container_name" "health=unhealthy" || true
      fi
    elif [[ "$state" != "running" ]]; then
      heal_container "$container_name" "state=$state" || true
    else
      if [[ "$health" == "healthy" ]]; then
        reset_heal_record "$container_name"
      fi
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
        if [[ "$health" == "healthy" ]]; then
          status_icon="✅"
          reset_heal_record "$name"
        elif [[ "$health" == "unhealthy" ]]; then
          status_icon="⚠️"
          heal_container "$name" "health=unhealthy" || true
        elif [[ "$health" == "starting" ]]; then
          status_icon="⏳"
          log_sre "INFO ⏳ docker/$name state=$state health=$health — still starting"
        else
          # No healthcheck defined, check if running
          status_icon="✅"
          log_sre "INFO ✅ docker/$name state=$state health=none — no healthcheck configured"
        fi
        ;;
      exited|dead|stopped)
        status_icon="🔴"
        heal_container "$name" "state=$state" || true
        ;;
      restarting)
        status_icon="🔄"
        log_sre "INFO 🔄 docker/$name state=restarting — waiting for stabilization"
        ;;
    esac

    # Don't log healthy containers unless verbose
    [[ "$status_icon" != "✅" ]] && log_sre "INFO $status_icon docker/$name state=$state health=$health"
  done <<< "$containers"
}

check_health_endpoints() {
  log_sre "INFO === Health Endpoints Check ==="
  for entry in $HEALTH_ENDPOINTS; do
    # Format: name|http://host:port/path|code or name|http://host:port/path|code1|code2
    local name="${entry%%|*}"
    local rest="${entry#*|}"

    # Find last | to separate URL from expected codes (URL may contain ://)
    local last_pipe="${rest##*|}"
    local expected="$last_pipe"
    local url="${rest%|*}"

    local http_code
    http_code=$(curl -sk -o /dev/null -w "%{http_code}" --max-time 10 "$url" 2>/dev/null || echo "000")

    # Check if http_code matches any expected code
    local match=0
    IFS='|' read -ra EXPECTED_CODES <<< "$expected"
    for code in "${EXPECTED_CODES[@]}"; do
      [[ "$http_code" == "$code" ]] && match=1 && break
    done

    local status_icon="✅"
    if [[ "$match" -eq 1 ]]; then
      status_icon="✅"
    elif [[ "$http_code" == "000" ]]; then
      status_icon="🔴"
      log_sre "WARN ROUTE_FAIL $name $url → connection refused"
    else
      status_icon="⚠️"
      log_sre "WARN HEALTH_CODE_MISMATCH $name $url → HTTP $http_code (expected $expected)"
    fi

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
    local code exitcode http_code
    code=$(curl -sk --max-time 15 "https://${sub}.zappro.site" -o /dev/null -w '%{http_code}' 2>/dev/null)
    exitcode=$?
    if [[ $exitcode -eq 0 ]] && [[ ${#code} -eq 3 ]]; then
      http_code="$code"
    else
      http_code="000"
    fi

    case "$http_code" in
      000) log_sre "🔴 DOWN $sub → connection refused" ;;
      502|503) log_sre "⚠️ DEGRADED $sub → HTTP $http_code" ;;
      301|302) log_sre "✅ UP $sub → HTTP $http_code" ;;
      200) log_sre "✅ UP $sub → HTTP $http_code" ;;
      404) log_sre "✅ UP $sub → HTTP $http_code (API gateway — 404 normal)" ;;
      *) log_sre "⚠️ UNEXPECTED $sub → HTTP $http_code" ;;
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

  # Run RCA before healing
  rca_container "$name" "$reason"

  log_sre "INFO HEALING $name ($reason) — restarting..."
  log_heal "HEALING $name reason=$reason"

  if docker restart "$name" 2>/dev/null; then
    sleep 15
    record_heal "$name" "$reason"

    # Verify after heal
    local new_state
    new_state=$(docker inspect "$name" --format='{{.State.Status}}' 2>/dev/null || echo "unknown")
    local new_health
    new_health=$(docker inspect "$name" --format='{{.State.Health.Status}}' 2>/dev/null || echo "none")

    if [[ "$new_state" == "running" ]]; then
      if [[ "$new_health" == "healthy" ]] || [[ "$new_health" == "none" ]]; then
        log_sre "INFO ✅ RESTART_OK $name (state=$new_state health=$new_health)"
        log_heal "RESTART_OK $name verified=yes"
        HEALED_COUNT=$((HEALED_COUNT + 1))
        reset_heal_record "$name"
      else
        log_sre "WARN ⚠️ RESTART_PARTIAL $name (state=$new_state health=$new_health) — may need attention"
        log_heal "RESTART_PARTIAL $name health=$new_health"
        HEALED_COUNT=$((HEALED_COUNT + 1))
      fi
    else
      log_sre "ERROR ❌ RESTART_FAILED $name (state=$new_state) — NEEDS MANUAL INTERVENTION"
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

  load_api_key || true

  check_coolify_apps || true
  check_docker_containers || true
  check_health_endpoints || true
  check_resources || true
  check_subdomains || true

  log_sre "INFO === SRE Monitor DONE healed=$HEALED_COUNT failed=$FAILED_COUNT skipped=$SKIPPED_COUNT alerts=$ALERT_COUNT ==="
}

main "$@"
