#!/bin/bash
# hermes-supervisor.sh — Hermes Supervisor (Main Router)
# Part of SPEC-POLYMER-006
# Role: Route tasks to sub-agents based on mode, coordinate rate limiting
# Skills: all (loaded on demand)

set -euo pipefail

AGENT_NAME="supervisor"
LOG_DIR="${LOG_DIR:-/srv/ops/logs}"

source ~/.hermes/secrets.env 2>/dev/null || true

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${AGENT_NAME}] $1" | tee -a "${LOG_DIR}/${AGENT_NAME}.log"; }

# ─── Mode Detection ────────────────────────────────────────────────────────

detect_mode() {
    local message="${1:-}"
    local msg_lower=$(echo "$message" | tr '[:upper:]' '[:lower:]')
    
    # Emergency keywords
    if echo "$msg_lower" | grep -qE "(emergency|emergencia|incidente|down|crash|ataque|/panic|/alert)"; then
        echo "EMERGENCY"
        return
    fi
    
    # Senior keywords
    if echo "$msg_lower" | grep -qE "(/senior|auditoria|arquitetura|spec|specs|refatorar|especificacao)"; then
        echo "SÊNIOR"
        return
    fi
    
    # Dev keywords
    if echo "$msg_lower" | grep -qE "(/dev|codar|implementar|bug|teste|feature|fix)"; then
        echo "DEV"
        return
    fi
    
    # Default: JUNIOR
    echo "JUNIOR"
}

# ─── Agent Routing ──────────────────────────────────────────────────────────

route_to_agent() {
    local mode="${1}"
    local message="${2}"
    local msg_lower=$(echo "$message" | tr '[:upper:]' '[:lower:]')
    
    case "$mode" in
        EMERGENCY)
            # Route to security + backup agents
            echo "security"
            return
            ;;
        SÊNIOR)
            # Route to security or docs based on content
            if echo "$msg_lower" | grep -qE "(audit|seguranca|firewall|ufw|senior)"; then
                echo "security"
            elif echo "$msg_lower" | grep -qE "(doc|wiki|brain|second-brain|spec)"; then
                echo "docs"
            else
                echo "sre"
            fi
            return
            ;;
        JUNIOR)
            # Route based on keywords
            if echo "$msg_lower" | grep -qE "(docker|container|coolify|servico|service|health|zfs|backup)"; then
                echo "sre"
            elif echo "$msg_lower" | grep -qE "(doc|wiki|brain|skill|memory|context)"; then
                echo "docs"
            elif echo "$msg_lower" | grep -qE "(backup|snapshot|zfs|disaster)"; then
                echo "backup"
            elif echo "$msg_lower" | grep -qE "(security|audit|firewall|senior)"; then
                echo "security"
            else
                echo "sre"  # Default
            fi
            return
            ;;
        DEV)
            # Route to dev agent
            echo "dev"
            return
            ;;
        *)
            echo "sre"
            return
            ;;
    esac
}

# ─── Rate Limit Check ──────────────────────────────────────────────────────

check_rate_limit() {
    local agent="${1}"
    local max_rpm="${2:-500}"
    
    # Simple check — in production this would use Python rate limiter
    # For now, just check if agent has been called in last minute
    local rate_file="/tmp/hermes_rate_${agent}.lock"
    
    if [[ -f "$rate_file" ]]; then
        local last_call
        last_call=$(cat "$rate_file")
        local now
        now=$(date +%s)
        local age=$((now - last_call))
        
        if [[ $age -lt 1 ]]; then
            # Called less than 1 second ago
            echo "rate_limited"
            return
        fi
    fi
    
    # Update rate file
    date +%s > "$rate_file"
    echo "ok"
}

# ─── Execute on Agent ──────────────────────────────────────────────────────

execute_on_agent() {
    local agent="${1}"
    local task="${2}"
    shift 2
    
    log "Executing '${task}' on agent: ${agent}"
    
    case "$agent" in
        sre)
            /srv/monorepo/services/subagents/subagent-sre.sh check "$@"
            ;;
        backup)
            /srv/monorepo/services/subagents/subagent-backup.sh "$task" "$@"
            ;;
        security)
            /srv/monorepo/services/subagents/subagent-security.sh check "$@"
            ;;
        dev)
            log "DEV agent: Claude Code tasks would go here"
            # In production: spawn Claude Code subprocess
            ;;
        docs)
            log "DOCS agent: knowledge management tasks would go here"
            ;;
        *)
            log "Unknown agent: ${agent}"
            return 1
            ;;
    esac
}

# ─── Status ────────────────────────────────────────────────────────────────

show_status() {
    echo "=== Hermes Supervisor Status ==="
    echo "Mode: AUTO (detects from message)"
    echo ""
    echo "Registered Agents:"
    for agent in sre backup security dev docs; do
        local port_var="${agent^^}_AGENT_PORT"
        local port="${!port_var:-undefined}"
        local log_file="${LOG_DIR}/${agent}-agent.log"
        local last_line=""
        if [[ -f "$log_file" ]]; then
            last_line=$(tail -1 "$log_file" 2>/dev/null | cut -c1-80 || echo "empty")
        fi
        echo "  ${agent}: port=${port}, last=$(echo $last_line | tr -d '\n')"
    done
    echo ""
    echo "Rate Limit: 500 RPM total"
    echo ""
    echo "Recent Tasks:"
    if [[ -d "/tmp/hermes_tasks" ]]; then
        ls -t /tmp/hermes_tasks/ 2>/dev/null | head -5
    else
        echo "  (no task history)"
    fi
}

# ─── Main ──────────────────────────────────────────────────────────────────

main() {
    local message="${1:-}"
    local mode
    mode=$(detect_mode "$message")
    local agent
    agent=$(route_to_agent "$mode" "$message")
    
    log "Message: '${message:0:50}...' → Mode: ${mode} → Agent: ${agent}"
    
    # Check rate limit
    local rate_status
    rate_status=$(check_rate_limit "$agent")
    
    if [[ "$rate_status" == "rate_limited" ]]; then
        log "Rate limited for ${agent}, queuing task"
        # In production: enqueue to task queue
        echo "Task queued (rate limited)"
        return 1
    fi
    
    # Execute
    execute_on_agent "$agent" "$message"
}

# ─── CLI ───────────────────────────────────────────────────────────────────

case "${1:-status}" in
    status)
        show_status
        ;;
    mode)
        detect_mode "${2:-}"
        ;;
    route)
        route_to_agent "${2:-JUNIOR}" "${3:-}"
        ;;
    exec)
        shift
        local agent="${1:?Missing agent}"
        shift
        execute_on_agent "$agent" "cli" "$@"
        ;;
    *)
        # Default: auto-detect mode and route
        if [[ -n "${1:-}" ]]; then
            main "$@"
        else
            show_status
        fi
        ;;
esac
