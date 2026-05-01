#!/bin/bash
# gpu-monitor.sh — Conditional GPU monitor
# Part of SPEC-POLYMER-005
# Runs only when GPU is actively used (mining/training/inference)
set -euo pipefail

MODE="${1:-check}"  # check | conditional | stats | alert

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] GPU: $1"; }

check_gpu_available() {
    if ! command -v nvidia-smi &>/dev/null; then
        log "nvidia-smi not available (no NVIDIA GPU)"
        exit 0
    fi
    return 0
}

check_active_usage() {
    # Check if any GPU-intensive process is running
    local gpu_procs=$(nvidia-smi --query-compute-apps=pid,process_name --format=csv,noheader 2>/dev/null | wc -l)
    echo $gpu_procs
}

mode_conditional() {
    # Only alert if GPU usage is abnormally high AND no known intensive process
    local util=$(nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits 2>/dev/null | tr -d ' ')
    local mem_used=$(nvidia-smi --query-gpu=memory.used --format=csv,noheader,nounits 2>/dev/null | tr -d ' ')
    local mem_total=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | tr -d ' ')
    local mem_pct=$((mem_used * 100 / mem_total))
    
    if [[ "$util" -gt 95 ]]; then
        log "ALERT: GPU utilization at ${util}% (possible runaway process)"
        nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv 2>/dev/null
    fi
    
    if [[ "$mem_pct" -gt 95 ]]; then
        log "ALERT: GPU memory at ${mem_pct}% (${mem_used}/${mem_total} MB)"
    fi
    
    if [[ "$util" -lt 5 ]] && [[ "$mem_pct" -lt 10 ]]; then
        log "GPU idle (util=${util}%, mem=${mem_pct}%) — no action needed"
    fi
}

mode_check() {
    check_gpu_available || exit 0
    nvidia-smi --query-gpu=name,utilization.gpu,utilization.memory,memory.used,memory.total,temperature.gpu,power.draw --format=csv 2>/dev/null | while IFS=, read -r name util mem_used mem_total temp power; do
        log "${name} | GPU=${util} | Mem=${mem_used}/${mem_total}MB | Temp=${temp} | Power=${power}"
    done
}

mode_stats() {
    check_gpu_available || exit 0
    log "=== GPU Statistics ==="
    nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total,fan.speed,temperature.gpu,power.draw,power.limit --format=csv,noheader 2>/dev/null
    log "=== Running Processes ==="
    nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader 2>/dev/null || log "No GPU processes running"
}

case "$MODE" in
    conditional)
        check_gpu_available || exit 0
        mode_conditional
        ;;
    check)
        mode_check
        ;;
    stats)
        mode_stats
        ;;
    *)
        echo "Usage: gpu-monitor.sh [conditional|check|stats]"
        exit 1
        ;;
esac
