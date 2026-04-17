#!/bin/bash
# self-healing.sh — Homelab Self-Healing Cron
# Monitors container health, route health, and network isolation
# Heals automatically when possible, alerts when human intervention required
# Schedule: */5 * * * *
# Output: /srv/ops/logs/self-healing.log (JSON status for external monitoring)

set -euo pipefail

# Source environment variables for any tokens/secrets
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ -f "$SCRIPT_DIR/../../../.env" ]]; then
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/../../../.env"
fi

# =============================================================================
# CONFIG
# =============================================================================

LOG_FILE="/srv/ops/logs/self-healing.log"
RATE_LIMIT_FILE="/tmp/container-restart-attempts.json"
MAX_RESTART_ATTEMPTS=3
RATE_LIMIT_WINDOW_SECONDS=3600  # 1 hour

# Critical containers that should always be Up (healthy)
CRITICAL_CONTAINERS=(
    "hermes-agent"
    "zappro-litellm"
    "zappro-wav2vec2"
    "coolify-proxy"
    "zappro-litellm-db"
)

# Network pairs that should share a Docker network (for isolation check)
NETWORK_PAIRS=(
    "coolify-proxy:hermes-agent"
    "zappro-litellm:zappro-wav2vec2"
)

# =============================================================================
# UTILITIES
# =============================================================================

log() {
    local level="$1"
    local action="$2"
    local target="$3"
    local detail="$4"
    local timestamp
    timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    echo "${timestamp} ${level} ${action} ${target} ${detail}" >> "$LOG_FILE"
}

json_status() {
    local status="$1"
    local healed="$2"
    local failed="$3"
    local alerts="$4"
    local timestamp
    timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
    cat <<EOF
{
  "timestamp": "${timestamp}",
  "status": "${status}",
  "healed": ${healed},
  "failed": ${failed},
  "alerts": ${alerts},
  "details": {
    "containers_checked": ${#CRITICAL_CONTAINERS[@]},
    "routes_checked": 4,
    "network_pairs_checked": ${#NETWORK_PAIRS[@]}
  }
}
EOF
}

get_container_status() {
    local container="$1"
    docker inspect "$container" --format '{{.State.Status}}' 2>/dev/null || echo "missing"
}

get_container_health() {
    local container="$1"
    docker inspect "$container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || echo "missing"
}

is_container_healthy() {
    local container="$1"
    local status health
    status=$(get_container_status "$container")
    health=$(get_container_health "$container")
    [[ "$status" == "running" && ("$health" == "healthy" || "$health" == "none") ]]
}

get_restart_count() {
    local container="$1"
    docker inspect "$container" --format '{{.RestartCount}}' 2>/dev/null || echo "0"
}

get_rate_limit_count() {
    local container="$1"
    if [[ ! -f "$RATE_LIMIT_FILE" ]]; then
        echo "0"
        return
    fi
    local count last_attempt now
    count=$(jq -r ".$container.count // 0" "$RATE_LIMIT_FILE" 2>/dev/null || echo "0")
    last_attempt=$(jq -r ".$container.last_attempt // \"1970-01-01T00:00:00Z\"" "$RATE_LIMIT_FILE" 2>/dev/null || echo "1970-01-01T00:00:00Z")
    now=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

    # Reset if outside window
    if [[ "$now" > "$last_attempt" ]]; then
        local elapsed
        elapsed=$(($(date -d "$now" +%s) - $(date -d "$last_attempt" +%s)))
        if [[ $elapsed -gt $RATE_LIMIT_WINDOW_SECONDS ]]; then
            echo "0"
            return
        fi
    fi
    echo "$count"
}

increment_rate_limit() {
    local container="$1"
    local temp_file
    temp_file=$(mktemp)

    if [[ ! -f "$RATE_LIMIT_FILE" ]]; then
        echo "{\"${container}\": {\"count\": 1, \"last_attempt\": \"$(date -u '+%Y-%m-%dT%H:%M:%SZ')\"}}" > "$RATE_LIMIT_FILE"
        return
    fi

    local current_count
    current_count=$(get_rate_limit_count "$container")
    local updated_count=$((current_count + 1))

    jq --arg c "$container" --arg ts "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" \
       '.[$c] = {"count": ('"$updated_count"' + (.[$c].count // 0)), "last_attempt": $ts}' \
       "$RATE_LIMIT_FILE" > "$temp_file" && mv "$temp_file" "$RATE_LIMIT_FILE"
}

get_shared_networks() {
    local container_a="$1"
    local container_b="$2"
    local nets_a nets_b shared=""
    nets_a=$(docker inspect "$container_a" --format '{{json .NetworkSettings.Networks}}' 2>/dev/null | \
        python3 -c "import sys,json; nets=json.load(sys.stdin); print('\n'.join(nets.keys()))" 2>/dev/null || echo "")
    nets_b=$(docker inspect "$container_b" --format '{{json .NetworkSettings.Networks}}' 2>/dev/null | \
        python3 -c "import sys,json; nets=json.load(sys.stdin); print('\n'.join(nets.keys()))" 2>/dev/null || echo "")

    for net in $nets_a; do
        if echo "$nets_b" | grep -q "^${net}$"; then
            shared="${shared}${net} "
        fi
    done
    echo "${shared}" | xargs
}

# =============================================================================
# CHECKS
# =============================================================================

check_container_health() {
    local container="$1"
    local status health
    status=$(get_container_status "$container")
    health=$(get_container_health "$container")
    echo "${status}|${health}"
}

check_route() {
    local url="$1"
    local expected_code="${2:-200}"
    local result
    result=$(curl -sf -m 5 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    echo "$result"
}

# =============================================================================
# HEALING ACTIONS
# =============================================================================

heal_container() {
    local container="$1"
    local rate_count
    rate_count=$(get_rate_limit_count "$container")

    if [[ $rate_count -ge $MAX_RESTART_ATTEMPTS ]]; then
        log "ALERT" "RATE_LIMITED" "$container" "Max restart attempts (${MAX_RESTART_ATTEMPTS}) reached in last hour"
        return 1
    fi

    log "INFO" "RESTARTING" "$container" "Attempt to heal container"

    if docker restart "$container" 2>/dev/null; then
        increment_rate_limit "$container"
        sleep 5
        if is_container_healthy "$container"; then
            log "HEALED" "RESTART_SUCCESS" "$container" "Container restarted and healthy"
            return 0
        else
            log "FAILED" "RESTART_UNHEALTHY" "$container" "Container restarted but not healthy"
            return 1
        fi
    else
        log "FAILED" "RESTART_ERROR" "$container" "docker restart command failed"
        return 1
    fi
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    local healed_count=0
    local failed_count=0
    local alert_count=0
    local overall_status="OK"

    # Ensure log directory exists
    mkdir -p "$(dirname "$LOG_FILE")"

    # -----------------------------------------------------------------------------
    # 1. CONTAINER HEALTH CHECKS
    # -----------------------------------------------------------------------------
    for container in "${CRITICAL_CONTAINERS[@]}"; do
        local status health
        read -r status health <<< "$(check_container_health "$container" | tr '|' ' ')"

        if [[ "$status" == "missing" ]]; then
            log "ALERT" "CONTAINER_MISSING" "$container" "Container does not exist"
            alert_count=$((alert_count + 1))
            overall_status="DEGRADED"
            continue
        fi

        if [[ "$status" != "running" ]]; then
            log "WARN" "CONTAINER_DOWN" "$container" "Status=${status}"
            if heal_container "$container"; then
                healed_count=$((healed_count + 1))
            else
                failed_count=$((failed_count + 1))
                alert_count=$((alert_count + 1))
                overall_status="DEGRADED"
            fi
            continue
        fi

        if [[ "$health" != "healthy" && "$health" != "none" ]]; then
            log "WARN" "CONTAINER_UNHEALTHY" "$container" "Health=${health}"
            if heal_container "$container"; then
                healed_count=$((healed_count + 1))
            else
                failed_count=$((failed_count + 1))
                alert_count=$((alert_count + 1))
                overall_status="DEGRADED"
            fi
            continue
        fi

        log "INFO" "CONTAINER_OK" "$container" "Status=${status}, Health=${health}"
    done

    # -----------------------------------------------------------------------------
    # 2. ROUTE HEALTH CHECKS
    # -----------------------------------------------------------------------------
    # Traefik ping
    local traefik_code
    traefik_code=$(check_route "http://localhost:80/ping")
    if [[ "$traefik_code" == "200" ]]; then
        log "INFO" "ROUTE_OK" "traefik-ping" "http://localhost:80/ping -> ${traefik_code}"
    else
        log "ALERT" "ROUTE_FAILED" "traefik-ping" "http://localhost:80/ping -> ${traefik_code} (expected 200)"
        alert_count=$((alert_count + 1))
        overall_status="DEGRADED"
    fi

    # Hermes Gateway routing via Cloudflare Tunnel
    local hermes_code
    hermes_code=$(check_route "https://hermes.zappro.site/health")
    if [[ "$hermes_code" == "200" ]]; then
        log "INFO" "ROUTE_OK" "hermes-tunnel" "https://hermes.zappro.site/health -> ${hermes_code}"
    else
        log "ALERT" "ROUTE_FAILED" "hermes-tunnel" "https://hermes.zappro.site/health -> ${hermes_code} (expected 200)"
        alert_count=$((alert_count + 1))
        overall_status="DEGRADED"
    fi

    # LiteLLM health
    local litellm_code
    litellm_code=$(check_route "http://localhost:4000/health")
    if [[ "$litellm_code" == "200" ]]; then
        log "INFO" "ROUTE_OK" "litellm-health" "http://localhost:4000/health -> ${litellm_code}"
    else
        log "ALERT" "ROUTE_FAILED" "litellm-health" "http://localhost:4000/health -> ${litellm_code} (expected 200)"
        alert_count=$((alert_count + 1))
        overall_status="DEGRADED"
    fi

    # wav2vec2 health
    local wav2vec2_code
    wav2vec2_code=$(check_route "http://localhost:8201/health")
    if [[ "$wav2vec2_code" == "200" ]]; then
        log "INFO" "ROUTE_OK" "wav2vec2-health" "http://localhost:8201/health -> ${wav2vec2_code}"
    else
        log "ALERT" "ROUTE_FAILED" "wav2vec2-health" "http://localhost:8201/health -> ${wav2vec2_code} (expected 200)"
        alert_count=$((alert_count + 1))
        overall_status="DEGRADED"
    fi

    # -----------------------------------------------------------------------------
    # 3. NETWORK ISOLATION CHECKS
    # -----------------------------------------------------------------------------
    for pair in "${NETWORK_PAIRS[@]}"; do
        local container_a="${pair%%:*}"
        local container_b="${pair##*:}"
        local shared_networks
        shared_networks=$(get_shared_networks "$container_a" "$container_b")

        if [[ -n "$shared_networks" ]]; then
            log "INFO" "NETWORK_OK" "${container_a}<->${container_b}" "Shared networks: ${shared_networks}"
        else
            log "ALERT" "NETWORK_ISOLATED" "${container_a}<->${container_b}" "No shared network - human intervention required"
            alert_count=$((alert_count + 1))
            overall_status="DEGRADED"
        fi
    done

    # -----------------------------------------------------------------------------
    # SUMMARY
    # -----------------------------------------------------------------------------
    if [[ $alert_count -gt 0 ]]; then
        log "ALERT" "SUMMARY" "self-healing" "healed=${healed_count} failed=${failed_count} alerts=${alert_count}"
    elif [[ $healed_count -gt 0 ]]; then
        log "INFO" "SUMMARY" "self-healing" "healed=${healed_count} failed=0 alerts=0"
    else
        log "INFO" "SUMMARY" "self-healing" "All checks passed - no healing needed"
    fi

    # JSON status for external monitoring (stdout)
    json_status "$overall_status" "$healed_count" "$failed_count" "$alert_count"
}

main "$@"
