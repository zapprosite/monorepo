#!/bin/bash
# hermes-metrics.sh — Unified metrics collector (replaces nexus-*-stats.sh)
# Part of SPEC-POLYMER-005
# Collects: Qdrant, Ollama, Redis, GPU, LLM stats in ONE script
set -euo pipefail

LOG_DIR="${LOG_DIR:-/srv/ops/logs}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
METRICS_FILE="${LOG_DIR}/metrics-$(date +%Y%m%d).json"

# Load secrets for internal access
load_secrets() {
    export QDRANT_API_KEY=$(grep -E '^QDRANT_API_KEY=' ~/.hermes/secrets.env 2>/dev/null | cut -d= -f2 || echo "")
    export POSTGRES_PASSWORD=$(grep -E '^POSTGRES_PASSWORD=' ~/.hermes/secrets.env 2>/dev/null | cut -d= -f2 || echo "")
    export REDIS_PASSWORD=$(grep -E '^REDIS_PASSWORD=' ~/.hermes/secrets.env 2>/dev/null | cut -d= -f2 || echo "")
}
load_secrets

log() { echo "[${TIMESTAMP}] $1" | tee -a "${LOG_DIR}/metrics.log"; }

collect_qdrant() {
    local qdrant_metrics="${LOG_DIR}/qdrant-metrics.json"
    if curl -sf http://localhost:6333/collections 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
result = data.get('result', {})
print(json.dumps({
    'collections_count': len(result.get('collections', [])),
    'timestamp': '${TIMESTAMP}'
}))
" > "${qdrant_metrics}" 2>/dev/null; then
        log "Qdrant: OK ($(cat ${qdrant_metrics} | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[\"collections_count\"])' 2>/dev/null || echo '?') collections)"
    else
        log "Qdrant: FAILED (no response)"
    fi
}

collect_ollama() {
    local ollama_metrics="${LOG_DIR}/ollama-metrics.json"
    if curl -sf http://localhost:11434/api/tags 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
models = data.get('models', [])
print(json.dumps({
    'models_count': len(models),
    'timestamp': '${TIMESTAMP}'
}))
" > "${ollama_metrics}" 2>/dev/null; then
        log "Ollama: OK ($(cat ${ollama_metrics} | python3 -c 'import sys,json;d=json.load(sys.stdin);print(d[\"models_count\"])' 2>/dev/null || echo '?') models)"
    else
        log "Ollama: FAILED (no response)"
    fi
}

collect_redis() {
    if command -v redis-cli &>/dev/null; then
        local redis_info=$(redis-cli -a "${REDIS_PASSWORD:-}" info clients 2>/dev/null | grep -E "^connected_clients|^used_memory_human" || echo "unknown")
        log "Redis: ${redis_info}"
    fi
}

collect_gpu() {
    if command -v nvidia-smi &>/dev/null; then
        local gpu_stats=$(nvidia-smi --query-gpu=utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits 2>/dev/null || echo "?,?,?,?")
        local gpu_util=$(echo "$gpu_stats" | cut -d',' -f1 | tr -d ' ')
        local gpu_mem=$(echo "$gpu_stats" | cut -d',' -f2 | tr -d ' ')
        local gpu_temp=$(echo "$gpu_stats" | cut -d',' -f4 | tr -d ' ')
        log "GPU: util=${gpu_util}% mem=${gpu_mem}MB temp=${gpu_temp}C"
    else
        log "GPU: nvidia-smi not available"
    fi
}

collect_litellm() {
    local litellm_health="${LOG_DIR}/litellm-metrics.json"
    local health_code=$(curl -sf -o /dev/null -w "%{http_code}" http://localhost:4000/health 2>/dev/null || echo "000")
    if [[ "$health_code" == "200" ]]; then
        log "LiteLLM: OK (200)"
    elif [[ "$health_code" == "401" ]]; then
        log "LiteLLM: OK (auth required, health endpoint protected)"
    else
        log "LiteLLM: FAILED (HTTP ${health_code})"
    fi
}

collect_docker() {
    local running=$(docker ps --format '{{.Names}}' 2>/dev/null | wc -l)
    local total=$(docker ps -a --format '{{.Names}}' 2>/dev/null | wc -l)
    log "Docker: ${running}/${total} containers running"
}

# Main
main() {
    log "=== Hermes Metrics Collection Started ==="
    collect_qdrant
    collect_ollama
    collect_redis
    collect_gpu
    collect_litellm
    collect_docker
    log "=== Hermes Metrics Collection Complete ==="
}

main "$@"
