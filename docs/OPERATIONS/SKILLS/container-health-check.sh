#!/bin/bash
# container-health-check.sh — Homelab Container Health Check
# Verifies health of all critical containers in the homelab
# Usage: ./container-health-check.sh [--json] [--verbose]
# Schedule: */5 * * * * (or on-demand)

set -euo pipefail

# =============================================================================
# CONFIG
# =============================================================================

CRITICAL_CONTAINERS=(
    "Hermes Agent-qgtzrmi6771lt8l7x8rqx72f"
    "zappro-litellm"
    "zappro-wav2vec2"
    "zappro-litellm-db"
    "browser-qgtzrmi6771lt8l7x8rqx72f"
)

HIGH_PRIORITY_CONTAINERS=(
    "open-webui-wbmqefxhd7vdn2dme3i6s9an"
    "perplexity-agent"
    "grafana"
    "prometheus"
    "alertmanager"
)

ALL_CONTAINERS=(
    "${CRITICAL_CONTAINERS[@]}"
    "${HIGH_PRIORITY_CONTAINERS[@]}"
)

# Health endpoints: container -> "host:port/path"
declare -A HEALTH_ENDPOINTS=(
    ["Hermes Agent-qgtzrmi6771lt8l7x8rqx72f"]="localhost:8080/healthz"
    ["zappro-litellm"]="localhost:4000/health"
    ["zappro-wav2vec2"]="localhost:8201/health"
    ["coolify-proxy"]="localhost:80/ping"
    ["browser-qgtzrmi6771lt8l7x8rqx72f"]="tcp:9222"
)

CPU_THRESHOLD=80
MEMORY_THRESHOLD=90
LOG_LINES=50
ERROR_THRESHOLD=1

OUTPUT_JSON=false
VERBOSE=false
while [[ $# -gt 0 ]]; do
    case "$1" in
        --json) OUTPUT_JSON=true; shift ;;
        --verbose) VERBOSE=true; shift ;;
        *) shift ;;
    esac
done

# =============================================================================
# UTILITIES
# =============================================================================

timestamp() {
    date -u '+%Y-%m-%dT%H:%M:%SZ'
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo "[VERBOSE] $*" >&2
    fi
}

# -----------------------------------------------------------------------------
# Helper: container_status
# Returns: RUNNING | RESTARTING | STOPPED | UNKNOWN | MISSING
# -----------------------------------------------------------------------------
container_status() {
    local container="$1"
    local status
    status=$(docker inspect "$container" --format '{{.State.Status}}' 2>/dev/null || echo "MISSING")

    case "$status" in
        running) echo "RUNNING" ;;
        restarting) echo "RESTARTING" ;;
        exited|stopped|paused) echo "STOPPED" ;;
        MISSING) echo "MISSING" ;;
        *) echo "UNKNOWN" ;;
    esac
}

# -----------------------------------------------------------------------------
# Helper: container_health
# Returns: HEALTHY | UNHEALTHY | STARTING | NO_HEALTHCHECK | MISSING
# -----------------------------------------------------------------------------
container_health() {
    local container="$1"
    if ! docker inspect "$container" &>/dev/null; then
        echo "MISSING"
        return
    fi

    local health
    health=$(docker inspect "$container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}NO_HEALTHCHECK{{end}}' 2>/dev/null || echo "MISSING")

    case "$health" in
        healthy) echo "HEALTHY" ;;
        unhealthy) echo "UNHEALTHY" ;;
        starting) echo "STARTING" ;;
        NO_HEALTHCHECK) echo "NO_HEALTHCHECK" ;;
        *) echo "MISSING" ;;
    esac
}

# -----------------------------------------------------------------------------
# Helper: container_restart_count
# Returns: number of restarts since container start
# -----------------------------------------------------------------------------
container_restart_count() {
    local container="$1"
    docker inspect "$container" --format '{{.RestartCount}}' 2>/dev/null || echo "0"
}

# -----------------------------------------------------------------------------
# Helper: container_logs_errors
# Returns: count of ERROR lines in last N log lines
# -----------------------------------------------------------------------------
container_logs_errors() {
    local container="$1"
    local count
    count=$(docker logs "$container" --tail "$LOG_LINES" 2>&1 | grep -c -i "ERROR" || true)
    echo "${count:-0}"
}

# -----------------------------------------------------------------------------
# Helper: container_logs_warnings
# Returns: count of WARN lines in last N log lines
# -----------------------------------------------------------------------------
container_logs_warnings() {
    local container="$1"
    local count
    count=$(docker logs "$container" --tail "$LOG_LINES" 2>&1 | grep -c -i -E "(WARN|WARNING)" || true)
    echo "${count:-0}"
}

# -----------------------------------------------------------------------------
# Helper: container_cpu
# Returns: CPU percentage used by container
# -----------------------------------------------------------------------------
container_cpu() {
    local container="$1"
    local cpu
    cpu=$(docker stats "$container" --no-stream --format '{{.CPUPerc}}' 2>/dev/null | tr -d '%' | awk '{print $1}' || echo "0")
    # Handle empty or non-numeric
    [[ -z "$cpu" || ! "$cpu" =~ ^[0-9]*\.?[0-9]*$ ]] && cpu="0"
    printf "%.2f" "$cpu"
}

# -----------------------------------------------------------------------------
# Helper: container_memory_percent
# Returns: Memory usage percentage
# -----------------------------------------------------------------------------
container_memory_percent() {
    local container="$1"
    local mem
    mem=$(docker stats "$container" --no-stream --format '{{.MemPerc}}' 2>/dev/null | tr -d '%' | awk '{print $1}' || echo "0")
    # Handle empty or non-numeric
    [[ -z "$mem" || ! "$mem" =~ ^[0-9]*\.?[0-9]*$ ]] && mem="0"
    printf "%.2f" "$mem"
}

# -----------------------------------------------------------------------------
# Helper: container_memory_usage
# Returns: Memory usage string (e.g., "1.2GiB / 4GiB")
# -----------------------------------------------------------------------------
container_memory_usage() {
    local container="$1"
    docker stats "$container" --no-stream --format '{{.MemUsage}}' 2>/dev/null || echo "N/A"
}

# -----------------------------------------------------------------------------
# Helper: check_health_endpoint
# Returns: HTTP status code or "tcp_open" or "tcp_closed" or "error"
# -----------------------------------------------------------------------------
check_health_endpoint() {
    local endpoint="$1"
    local code

    if [[ "$endpoint" == tcp:* ]]; then
        # TCP check: extract host:port
        local host_port="${endpoint#tcp:}"
        local host="${host_port%:*}"
        local port="${host_port#*:}"
        if timeout 3 bash -c "echo >/dev/tcp/${host}/${port}" 2>/dev/null; then
            echo "tcp_open"
        else
            echo "tcp_closed"
        fi
    else
        # HTTP check
        local http_code
        http_code=$(curl -sf -m 5 -o /dev/null -w "%{http_code}" "$endpoint" 2>/dev/null)
        local curl_exit=$?
        if [[ $curl_exit -ne 0 ]]; then
            echo "error"
        else
            echo "$http_code"
        fi
    fi
}

# -----------------------------------------------------------------------------
# Helper: check_dmesg_oom
# Returns: count of OOM kills for this container in dmesg
# -----------------------------------------------------------------------------
check_dmesg_oom() {
    local container="$1"
    local oom_count=0
    if [[ -r /var/log/dmesg ]]; then
        local raw
        raw=$(grep -c "oom-killer" /var/log/dmesg 2>/dev/null || echo "0")
        oom_count=$(echo "$raw" | tr -d '[:space:]')
    fi
    # Also check journalctl for container name
    if command -v journalctl &>/dev/null; then
        local journal_count
        journal_count=$(journalctl -k -g "oom-killer" 2>/dev/null | grep -c "$container" 2>/dev/null || echo "0")
        journal_count=$(echo "$journal_count" | tr -d '[:space:]')
        oom_count=$((oom_count + journal_count))
    fi
    echo "${oom_count:-0}"
}

# -----------------------------------------------------------------------------
# Helper: is_zombie_process
# Returns: count of zombie processes for container
# -----------------------------------------------------------------------------
is_zombie_process() {
    local container="$1"
    local pids
    pids=$(docker inspect "$container" --format '{{.State.Pid}}' 2>/dev/null || echo "0")
    if [[ "$pids" == "0" ]]; then
        echo "0"
        return
    fi
    local zombie_count
    zombie_count=$(ps -o stat= -p "$pids" 2>/dev/null | grep -c "Z" || true)
    zombie_count=$(echo "$zombie_count" | tr -d '[:space:]')
    echo "${zombie_count:-0}"
}

# =============================================================================
# PER-CONTAINER CHECK
# =============================================================================

check_container() {
    local container="$1"
    local critical="$2"

    local name="$container"
    local status health restart_count error_count warn_count cpu mem mem_usage oom_count zombie endpoint result
    local issues=()

    # 1. Container Status
    status=$(container_status "$container")
    log_verbose "  status=$status"

    # 2. Health check
    health=$(container_health "$container")
    log_verbose "  health=$health"

    # 3. Restart count
    restart_count=$(container_restart_count "$container")
    log_verbose "  restarts=$restart_count"

    # 4. Log errors
    error_count=$(container_logs_errors "$container")
    warn_count=$(container_logs_warnings "$container")
    log_verbose "  errors=$error_count warns=$warn_count"

    # 5. Resource usage
    cpu=$(container_cpu "$container")
    mem=$(container_memory_percent "$container")
    mem_usage=$(container_memory_usage "$container")
    log_verbose "  cpu=${cpu}% mem=${mem}%"

    # 6. OOM check
    oom_count=$(check_dmesg_oom "$container")
    log_verbose "  oom=$oom_count"

    # 7. Zombie check
    zombie=$(is_zombie_process "$container")
    log_verbose "  zombie=$zombie"

    # 8. Health endpoint check (if applicable)
    endpoint="${HEALTH_ENDPOINTS[$container]:-}"
    log_verbose "  endpoint=$endpoint"
    if [[ -n "$endpoint" ]]; then
        result=$(check_health_endpoint "$endpoint")
        log_verbose "  endpoint_result=$result"
    else
        result="no_endpoint_defined"
    fi

    # =========================================================================
    # ISSUE DETECTION
    # =========================================================================

    if [[ "$status" == "MISSING" ]]; then
        issues+=("CONTAINER_MISSING")
    elif [[ "$status" == "STOPPED" ]]; then
        issues+=("CONTAINER_STOPPED")
    elif [[ "$status" == "RESTARTING" ]]; then
        issues+=("CONTAINER_RESTARTING")
    fi

    if [[ "$health" == "UNHEALTHY" ]]; then
        issues+=("HEALTH_UNHEALTHY")
    fi

    if [[ "$restart_count" -gt 3 ]]; then
        issues+=("EXCESSIVE_RESTARTS:${restart_count}")
    fi

    if [[ "$error_count" -ge "$ERROR_THRESHOLD" ]]; then
        issues+=("ERRORS_IN_LOGS:${error_count}")
    fi

    if [[ "$(echo "$cpu > $CPU_THRESHOLD" | bc 2>/dev/null || echo "0")" == "1" ]]; then
        issues+=("HIGH_CPU:${cpu}%")
    fi

    if [[ "$(echo "$mem > $MEMORY_THRESHOLD" | bc 2>/dev/null || echo "0")" == "1" ]]; then
        issues+=("HIGH_MEMORY:${mem}%")
    fi

    if [[ "$oom_count" -gt 0 ]]; then
        issues+=("OOM_KILLS:${oom_count}")
    fi

    if [[ "$zombie" -gt 0 ]]; then
        issues+=("ZOMBIE_PROCESSES:${zombie}")
    fi

    if [[ "$endpoint" != "no_endpoint_defined" && "$endpoint" != "" ]]; then
        if [[ "$result" == "error" || "$result" == "tcp_closed" ]]; then
            issues+=("HEALTH_ENDPOINT_FAILED:${endpoint}")
        elif [[ "$result" != "200" && "$result" != "tcp_open" && "$result" != "no_endpoint_defined" ]]; then
            issues+=("HEALTH_ENDPOINT_CODE:${result}")
        fi
    fi

    # Determine overall container status
    local overall="HEALTHY"
    if [[ ${#issues[@]} -gt 0 ]]; then
        overall="UNHEALTHY"
    fi

    # Output JSON fragment
    cat <<EOF
{
    "name": "${name}",
    "status": "${status}",
    "health": "${health}",
    "restarts": ${restart_count},
    "cpu_percent": ${cpu},
    "mem_percent": ${mem},
    "memory_usage": "${mem_usage}",
    "error_count": ${error_count},
    "warn_count": ${warn_count},
    "oom_kills": ${oom_count},
    "zombie_processes": ${zombie},
    "health_endpoint": "${endpoint}",
    "health_endpoint_result": "${result}",
    "issues": $(printf '%s\n' "${issues[@]}" | jq -R . | jq -s .),
    "overall_status": "${overall}"
}
EOF
}

# =============================================================================
# MAIN
# =============================================================================

main() {
    local ts
    ts=$(timestamp)

    local container_results=()
    local overall_status="HEALTHY"
    local total_containers=0
    local healthy_count=0
    local unhealthy_count=0
    local critical_down=0
    local alerts=()

    echo "CONTAINER HEALTH CHECK — $(date '+%Y-%m-%d %H:%M %Z')" >&2
    echo "==================================================" >&2

    # -----------------------------------------------------------------------------
    # CRITICAL CONTAINERS
    # -----------------------------------------------------------------------------
    echo "" >&2
    echo "--- CRITICAL CONTAINERS ---" >&2

    local critical_results_json="["
    local first=true
    for container in "${CRITICAL_CONTAINERS[@]}"; do
        total_containers=$((total_containers + 1))

        local result_json
        result_json=$(check_container "$container" "true")
        container_results+=("$result_json")

        if [[ "$first" == "true" ]]; then
            first=false
        else
            critical_results_json+=","
        fi
        critical_results_json+="$result_json"

        # Parse overall status from result
        local overall
        overall=$(echo "$result_json" | jq -r '.overall_status')
        local name
        name=$(echo "$result_json" | jq -r '.name')
        local status
        status=$(echo "$result_json" | jq -r '.status')

        echo "" >&2
        echo "  [$container]" >&2
        echo "    Status: $status" >&2

        if [[ "$overall" != "HEALTHY" ]]; then
            unhealthy_count=$((unhealthy_count + 1))
            overall_status="DEGRADED"

            local issues
            issues=$(echo "$result_json" | jq -r '.issues | join(", ")')
            echo "    Issues: $issues" >&2

            if [[ "$status" != "RUNNING" ]]; then
                critical_down=$((critical_down + 1))
                alerts+=("CRITICAL_DOWN:${container}:${status}")
            else
                alerts+=("CONTAINER_WARNING:${container}:${issues}")
            fi
        else
            healthy_count=$((healthy_count + 1))
            echo "    Health: OK" >&2
        fi
    done
    critical_results_json+="]"

    # -----------------------------------------------------------------------------
    # HIGH PRIORITY CONTAINERS
    # -----------------------------------------------------------------------------
    echo "" >&2
    echo "--- HIGH PRIORITY CONTAINERS ---" >&2

    local high_priority_results_json="["
    first=true
    for container in "${HIGH_PRIORITY_CONTAINERS[@]}"; do
        total_containers=$((total_containers + 1))

        local result_json
        result_json=$(check_container "$container" "false")
        container_results+=("$result_json")

        if [[ "$first" == "true" ]]; then
            first=false
        else
            high_priority_results_json+=","
        fi
        high_priority_results_json+="$result_json"

        local overall
        overall=$(echo "$result_json" | jq -r '.overall_status')
        local name
        name=$(echo "$result_json" | jq -r '.name')
        local status
        status=$(echo "$result_json" | jq -r '.status')

        echo "" >&2
        echo "  [$container]" >&2
        echo "    Status: $status" >&2

        if [[ "$overall" != "HEALTHY" ]]; then
            unhealthy_count=$((unhealthy_count + 1))
            if [[ "$overall_status" == "HEALTHY" ]]; then
                overall_status="DEGRADED"
            fi
            local issues
            issues=$(echo "$result_json" | jq -r '.issues | join(", ")')
            echo "    Issues: $issues" >&2
            alerts+=("CONTAINER_WARNING:${container}:${issues}")
        else
            healthy_count=$((healthy_count + 1))
            echo "    Health: OK" >&2
        fi
    done
    high_priority_results_json+="]"

    # -----------------------------------------------------------------------------
    # SUMMARY
    # -----------------------------------------------------------------------------
    echo "" >&2
    echo "==================================================" >&2
    echo "SUMMARY" >&2
    echo "  Total containers: $total_containers" >&2
    echo "  Healthy: $healthy_count" >&2
    echo "  Unhealthy: $unhealthy_count" >&2
    echo "  Critical down: $critical_down" >&2
    echo "  Overall status: $overall_status" >&2

    if [[ ${#alerts[@]} -gt 0 ]]; then
        echo "" >&2
        echo "ALERTS:" >&2
        for alert in "${alerts[@]}"; do
            echo "  - $alert" >&2
        done
    fi

    # -----------------------------------------------------------------------------
    # JSON OUTPUT
    # -----------------------------------------------------------------------------
    if [[ "$OUTPUT_JSON" == "true" ]]; then
        local all_results_json
        all_results_json=$(printf '%s\n' "${container_results[@]}" | jq -s .)

        cat <<EOF
{
  "timestamp": "${ts}",
  "containers": ${all_results_json},
  "summary": {
    "total": ${total_containers},
    "healthy": ${healthy_count},
    "unhealthy": ${unhealthy_count},
    "critical_down": ${critical_down}
  },
  "overall_status": "${overall_status}",
  "alerts": $(printf '%s\n' "${alerts[@]}" | jq -R . | jq -s .)
}
EOF
    fi
}

main "$@"
