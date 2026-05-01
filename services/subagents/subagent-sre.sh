#!/bin/bash
# subagent-sre.sh — SRE Infrastructure Agent
# Part of SPEC-POLYMER-006
# Role: Infrastructure monitoring, Docker, Coolify, health checks
# Port: 8096
# Skills: coolify-sre, docker-healthcheck-missing-binary, service-port-mismatch-debug

set -euo pipefail

AGENT_NAME="sre"
AGENT_PORT="${SRE_AGENT_PORT:-8096}"
LOG_DIR="${LOG_DIR:-/srv/ops/logs}"
METRICS_FILE="${LOG_DIR}/sre-agent-metrics.json"

source ~/.hermes/secrets.env 2>/dev/null || true

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${AGENT_NAME}] $1" | tee -a "${LOG_DIR}/${AGENT_NAME}-agent.log"; }

# ─── Health Check Functions ─────────────────────────────────────────────────

check_docker() {
    log "Checking Docker containers..."
    local running=$(docker ps --format '{{.Names}}' 2>/dev/null | wc -l)
    local total=$(docker ps -a --format '{{.Names}}' 2>/dev/null | wc -l)
    local unhealthy=$(docker ps --filter "health=unhealthy" --format '{{.Names}}' 2>/dev/null | wc -l)
    
    log "Docker: ${running}/${total} running, ${unhealthy} unhealthy"
    
    if [[ "$unhealthy" -gt 0 ]]; then
        log "ALERT: Unhealthy containers: $(docker ps --filter 'health=unhealthy' --format '{{.Names}}')"
        return 1
    fi
    return 0
}

check_coolify() {
    log "Checking Coolify..."
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" "http://localhost:3000/api/v1/health" 2>/dev/null || echo "000")
    if [[ "$status" == "200" ]]; then
        log "Coolify: OK (HTTP ${status})"
    else
        log "ALERT: Coolify unhealthy (HTTP ${status})"
        return 1
    fi
    return 0
}

check_health_endpoints() {
    log "Checking health endpoints..."
    local endpoints=(
        "localhost:6333:/health"        # Qdrant
        "localhost:4000:/health"       # LiteLLM
        "localhost:11434:/api/tags"    # Ollama
        "localhost:8092:/health"       # Hermes MCP
        "localhost:4002:/health"       # ai-gateway
    )
    
    local failed=0
    for ep in "${endpoints[@]}"; do
        IFS=':' read -r host port path <<< "$ep"
        local status
        # Don't use curl -f because 401 is valid (auth required)
        status=$(curl -s -o /dev/null -w "%{http_code}" "http://${host}:${port}${path}" 2>/dev/null || echo "000")
        # 200=OK, 401=auth required (OK), 000=no connection (FAIL)
        if [[ "$status" == "200" ]] || [[ "$status" == "401" ]]; then
            log "  ${host}:${port}${path} → ${status} OK"
        else
            log "  ${host}:${port}${path} → ${status} FAIL"
            ((failed++)) || true
        fi
    done
    
    return $failed
}

check_zfs() {
    log "Checking ZFS pool..."
    local state
    state=$(zpool status tank 2>/dev/null | grep "state:" | awk '{print $2}')
    if [[ "$state" == "ONLINE" ]]; then
        log "ZFS tank: ONLINE"
    else
        log "ALERT: ZFS tank state: ${state}"
        return 1
    fi
    return 0
}

check_disk_space() {
    log "Checking disk space..."
    local usage
    usage=$(df -h /srv | awk 'NR==2 {print $5}' | tr -d '%')
    if [[ "$usage" -gt 90 ]]; then
        log "ALERT: Disk usage at ${usage}%"
        return 1
    else
        log "Disk usage: ${usage}%"
    fi
    return 0
}

check_gpu() {
    if ! command -v nvidia-smi &>/dev/null; then
        return 0
    fi
    log "Checking GPU..."
    
    # Get GPU stats, handle NVML errors
    local gpu_output
    gpu_output=$(nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>&1) || {
        log "GPU: nvidia-smi failed: ${gpu_output}"
        return 0  # Don't fail the whole check for GPU
    }
    
    # Check for NVML errors in output
    if echo "$gpu_output" | grep -qi "failed\|error\|unbound"; then
        log "GPU: NVML error - ${gpu_output}"
        return 0
    fi
    
    local util mem_used mem_total temp
    util=$(echo "$gpu_output" | awk -F',' '{gsub(/[^0-9]/,"",$1); print $1}')
    mem_used=$(echo "$gpu_output" | awk -F',' '{gsub(/[^0-9]/,"",$2); print $2}')
    mem_total=$(echo "$gpu_output" | awk -F',' '{gsub(/[^0-9]/,"",$3); print $3}')
    temp=$(echo "$gpu_output" | awk -F',' '{gsub(/[^0-9]/,"",$4); print $4}')
    
    # Validate we got numbers
    if [[ -z "$util" ]] || [[ -z "$mem_total" ]]; then
        log "GPU: Could not parse output: ${gpu_output}"
        return 0
    fi
    
    local mem_pct=0
    if [[ "${mem_total:-0}" -gt 0 ]]; then
        mem_pct=$((mem_used * 100 / mem_total))
    fi
    
    log "GPU: util=${util}%, mem=${mem_used}/${mem_total}MB (${mem_pct}%), temp=${temp}C"
    
    if [[ "${util:-0}" -gt 95 ]] || [[ "${mem_pct:-0}" -gt 95 ]]; then
        log "ALERT: GPU at risk (util=${util}%, mem=${mem_pct}%)"
        return 1
    fi
    return 0
}

# ─── Main ──────────────────────────────────────────────────────────────────

main() {
    log "=== SRE Agent Starting ==="
    
    local exit_code=0
    
    check_docker      || exit_code=1
    check_coolify     || exit_code=1
    check_health_endpoints || exit_code=1
    check_zfs         || exit_code=1
    check_disk_space  || exit_code=1
    check_gpu         || exit_code=1
    
    log "=== SRE Agent Complete (exit=${exit_code}) ==="
    
    # Write metrics
    cat > "${METRICS_FILE}" << EOF
{
  "agent": "${AGENT_NAME}",
  "timestamp": "$(date -Iseconds)",
  "docker_running": $(docker ps --format '{{.Names}}' 2>/dev/null | wc -l),
  "docker_total": $(docker ps -a --format '{{.Names}}' 2>/dev/null | wc -l),
  "zfs_state": "$(zpool status tank 2>/dev/null | grep 'state:' | awk '{print $2}' || echo 'UNKNOWN')",
  "exit_code": ${exit_code}
}
EOF
    
    return $exit_code
}

# ─── CLI ───────────────────────────────────────────────────────────────────

case "${1:-check}" in
    check|health)
        main
        ;;
    docker)
        check_docker
        ;;
    coolify)
        check_coolify
        ;;
    endpoints)
        check_health_endpoints
        ;;
    zfs)
        check_zfs
        ;;
    disk)
        check_disk_space
        ;;
    gpu)
        check_gpu
        ;;
    metrics)
        cat "${METRICS_FILE}" 2>/dev/null || echo '{"error": "no metrics"}'
        ;;
    *)
        echo "Usage: $0 [check|health|docker|coolify|endpoints|zfs|disk|gpu|metrics]"
        exit 1
        ;;
esac
