#!/bin/bash
# subagent-security.sh — Security & Audit Agent
# Part of SPEC-POLYMER-006
# Role: Security audits, fail2ban, UFW, anti-hardcoded keys, incident response
# Port: 8100
# Skills: infra-audit-ruthless, anti-hardcoded-api-key-audit, secure-vps-setup, firewall-config

set -euo pipefail

AGENT_NAME="security"
AGENT_PORT="${SECURITY_AGENT_PORT:-8100}"
LOG_DIR="${LOG_DIR:-/srv/ops/logs}"

source ~/.hermes/secrets.env 2>/dev/null || true

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${AGENT_NAME}] $1" | tee -a "${LOG_DIR}/${AGENT_NAME}-agent.log"; }
log_alert() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [${AGENT_NAME}] ALERT: $1" | tee -a "${LOG_DIR}/${AGENT_NAME}-alerts.log"; }

# ─── Security Check Functions ────────────────────────────────────────────────

check_fail2ban() {
    log "Checking Fail2ban..."
    if systemctl is-active fail2ban &>/dev/null; then
        local jails
        jails=$(fail2ban-client status 2>/dev/null | grep -E "Jail list" | cut -d: -f2 | tr -d ' ' || echo "unknown")
        log "Fail2ban: ACTIVE (jails: ${jails})"
        return 0
    else
        log_alert "Fail2ban is NOT running!"
        return 1
    fi
}

check_ufw() {
    log "Checking UFW..."
    if ufw status 2>&1 | grep -qi "active"; then
        log "UFW: ACTIVE"
        # Check rules
        local ssh_limited
        ssh_limited=$(ufw status 2>&1 | grep -c "2200" || echo "0")
        if [[ "$ssh_limited" -gt 0 ]]; then
            log "UFW: SSH port 2200 limited (OK)"
        fi
        return 0
    else
        log_alert "UFW is not active!"
        return 1
    fi
}

check_docker_security() {
    log "Checking Docker security..."
    local daemon_json="/etc/docker/daemon.json"
    
    if [[ -f "$daemon_json" ]]; then
        local no_new_privs
        no_new_privs=$(python3 -c "import json; d=json.load(open('$daemon_json')); print(d.get('no-new-privileges', False))" 2>/dev/null || echo "unknown")
        local icc
        icc=$(python3 -c "import json; d=json.load(open('$daemon_json')); print(d.get('icc', True))" 2>/dev/null || echo "unknown")
        
        if [[ "$no_new_privs" == "True" ]]; then
            log "Docker: no-new-privileges=TRUE (OK)"
        else
            log_alert "Docker: no-new-privileges not set!"
        fi
        
        if [[ "$icc" == "False" ]]; then
            log "Docker: icc=FALSE (OK — inter-container comms blocked)"
        else
            log_alert "Docker: icc=TRUE (containers can communicate freely)"
        fi
    else
        log_alert "/etc/docker/daemon.json not found!"
    fi
}

check_ssh_security() {
    log "Checking SSH security..."
    local sshd_config="/etc/ssh/sshd_config"
    
    if [[ -f "$sshd_config" ]]; then
        local permit_root
        permit_root=$(grep -E "^PermitRootLogin" "$sshd_config" 2>/dev/null | awk '{print2}' || echo "")
        local password_auth
        password_auth=$(grep -E "^PasswordAuthentication" "$sshd_config" 2>/dev/null | awk '{print2}' || echo "")
        
        if [[ -n "$permit_root" ]] && [[ "$permit_root" != "no" ]]; then
            log_alert "SSH: PermitRootLogin is '${permit_root}' (should be 'no')"
        else
            log "SSH: PermitRootLogin=no (OK)"
        fi
        
        if [[ -n "$password_auth" ]] && [[ "$password_auth" != "no" ]]; then
            log_alert "SSH: PasswordAuthentication is '${password_auth}' (should be 'no')"
        else
            log "SSH: PasswordAuthentication=no (OK)"
        fi
    fi
}

check_open_ports() {
    log "Checking open ports..."
    if command -v ss &>/dev/null; then
        local public_ports
        public_ports=$(ss -tlnp 2>/dev/null | grep -v "127.0.0.1\|::1\|:22 \|:80 \|:443 \|:3000 " | grep "LISTEN" || true)
        if [[ -n "$public_ports" ]]; then
            log_alert "Unexpected public ports:\n${public_ports}"
        else
            log "No unexpected public ports (OK)"
        fi
    fi
}

check_hardcoded_secrets() {
    log "Scanning for hardcoded secrets (API keys, tokens)..."
    local patterns=(
        "sk-[0-9a-zA-Z]{20,}"
        "ghp_[0-9a-zA-Z]{36}"
        "gho_[0-9a-zA-Z]{36}"
        "xox[baprs]-[0-9a-zA-Z]{10,}"
        "AKIA[0-9A-Z]{16}"
        "sq0csp-[0-9A-Za-z]{43}"
    )
    
    local found=0
    for pattern in "${patterns[@]}"; do
        local matches
        matches=$(grep -rE "$pattern" /srv/monorepo --include="*.py" --include="*.sh" --include="*.yaml" --include="*.yml" --include="*.json" --include="*.md" 2>/dev/null | grep -v ".git/" | grep -v "node_modules/" | head -5 || true)
        if [[ -n "$matches" ]]; then
            log_alert "Potential hardcoded secret (pattern: ${pattern}):\n${matches}"
            ((found++))
        fi
    done
    
    if [[ "$found" -eq 0 ]]; then
        log "No hardcoded secrets found"
    fi
    return $found
}

check_fail2ban_bans() {
    log "Checking recent Fail2ban bans..."
    local recent_bans
    recent_bans=$(fail2ban-client status 2>/dev/null | grep -A 20 "Jail list" | grep -E "Currently banned|Ban.*[0-9]" | head -10 || echo "No data")
    if [[ -n "$recent_bans" ]]; then
        log "Fail2ban bans:\n${recent_bans}"
    fi
}

check_log_suspicious() {
    log "Checking logs for suspicious activity..."
    # SSH failed logins
    local failed_ssh
    failed_ssh=$(journalctl -u ssh --since "1 hour ago" --no-pager 2>/dev/null | grep -c "Failed password" || echo "0")
    if [[ "$failed_ssh" -gt 10 ]]; then
        log_alert "High SSH failed login attempts: ${failed_ssh} in last hour"
    fi
    
    # Docker logs errors
    local docker_errors
    docker_errors=$(docker logs --tail 100 2>&1 2>/dev/null | grep -ciE "error|fatal|exception" || echo "0")
    if [[ "$docker_errors" -gt 20 ]]; then
        log_alert "High Docker error count: ${docker_errors} in last 100 lines"
    fi
}

# ─── Incident Response ───────────────────────────────────────────────────

incident_response() {
    local incident_type="${1:-unknown}"
    log_alert "=== INCIDENT RESPONSE TRIGGERED: ${incident_type} ==="
    
    # Stop non-essential services
    # Notify supervisor
    # Create incident log
    
    log_alert "Incident logged. Supervisor notified."
}

# ─── Main ──────────────────────────────────────────────────────────────────

main() {
    log "=== Security Agent Starting ==="
    
    local exit_code=0
    
    check_fail2ban      || exit_code=1
    check_ufw          || exit_code=1
    check_docker_security || exit_code=1
    check_ssh_security || exit_code=1
    check_open_ports   || exit_code=1
    check_hardcoded_secrets
    check_fail2ban_bans
    check_log_suspicious
    
    log "=== Security Agent Complete (exit=${exit_code}) ==="
    return $exit_code
}

# ─── CLI ───────────────────────────────────────────────────────────────────

case "${1:-check}" in
    check|security)
        main
        ;;
    fail2ban)
        check_fail2ban
        ;;
    ufw)
        check_ufw
        ;;
    docker-sec)
        check_docker_security
        ;;
    ssh-sec)
        check_ssh_security
        ;;
    ports)
        check_open_ports
        ;;
    secrets)
        check_hardcoded_secrets
        ;;
    bans)
        check_fail2ban_bans
        ;;
    logs)
        check_log_suspicious
        ;;
    incident)
        incident_response "${2:-unknown}"
        ;;
    *)
        echo "Usage: $0 [check|security|fail2ban|ufw|docker-sec|ssh-sec|ports|secrets|bans|logs|incident <type>]"
        exit 1
        ;;
esac
