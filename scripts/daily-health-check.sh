#!/usr/bin/env bash
# daily-health-check.sh — Daily AI services health check
# Usage: bash /srv/monorepo/scripts/daily-health-check.sh
set -euo pipefail

# ── Load Environment ────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
set -a
source /srv/monorepo/.env 2>/dev/null || true
set +a

# ── Config ──────────────────────────────────────────────────────
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_FILE="${LOG_FILE:-/srv/ops/logs/daily-health-check.log}"
TELEGRAM_BOT_TOKEN="${HOMELAB_LOGS_BOT_TOKEN:-${TELEGRAM_BOT_TOKEN:-}}"
TELEGRAM_CHAT_ID="${HOMELAB_LOGS_CHAT_ID:-}"
GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
GRAFANA_TOKEN="${GRAFANA_TOKEN:-}"

# ── Services Configuration ─────────────────────────────────────
declare -A SERVICES=(
    ["ai-gateway:4002"]="http://localhost:4002/health"
    ["litellm:4000"]="http://localhost:4000/health"
    ["qdrant:6333"]="http://localhost:6333/health"
    ["qdrant-dashboard:6334"]="http://localhost:6334/health"
    ["ollama:11434"]="http://localhost:11434/api/tags"
    ["trieve:6435"]="http://localhost:6435/api/v1/health"
    ["grafana:3000"]="http://localhost:3000/api/health"
    ["coolify:8000"]="http://localhost:8000/api/health"
)

# ── Helpers ────────────────────────────────────────────────────
log() { echo "[${TIMESTAMP}] $1" | tee -a "$LOG_FILE"; }
ok()  { echo "[${TIMESTAMP}] ✅ $1" | tee -a "$LOG_FILE"; }
fail(){ echo "[${TIMESTAMP}] ❌ $1" | tee -a "$LOG_FILE"; }
warn(){ echo "[${TIMESTAMP}] ⚠️  $1" | tee -a "$LOG_FILE"; }

send_telegram() {
    local message="$1"
    if [[ -z "$TELEGRAM_BOT_TOKEN" ]]; then
        log "TELEGRAM_BOT_TOKEN not set, skipping Telegram notification"
        return 1
    fi
    if [[ -z "$TELEGRAM_CHAT_ID" ]]; then
        log "TELEGRAM_CHAT_ID not set, skipping Telegram notification"
        return 1
    fi

    local url="https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage"
    curl -sf -X POST "$url" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${message}" \
        -d "parse_mode=HTML" \
        -d "disable_web_page_preview=true" > /dev/null 2>&1
}

# ── Report Building ────────────────────────────────────────────
REPORT="🩺 <b>Daily Health Check Report</b>%0A"
REPORT+="📅 ${TIMESTAMP}%0A%0A"

# ── 1. Check All Service Health Endpoints ─────────────────────
log "Checking service health endpoints..."
HEALTH_OK=0
HEALTH_FAIL=0

for entry in "${!SERVICES[@]}"; do
    IFS='=' read -r name url <<< "$entry"
    if curl -sf -m 5 "$url" > /dev/null 2>&1; then
        ok "$name is healthy"
        HEALTH_OK=$((HEALTH_OK + 1))
    else
        fail "$name is NOT responding"
        HEALTH_FAIL=$((HEALTH_FAIL + 1))
        REPORT+="❌ <b>${name}</b> — DOWN%0A"
    fi
done

REPORT+="%0A📊 <b>Health Status:</b>%0A"
REPORT+="✅ Healthy: ${HEALTH_OK}%0A"
REPORT+="❌ Failed: ${HEALTH_FAIL}%0A%0A"

# ── 2. Check Docker Containers ─────────────────────────────────
log "Checking Docker containers..."
CONTAINER_ISSUES=$(docker ps --format "{{.Names}}\t{{.Status}}" | grep -v "Up" || true)
if [[ -n "$CONTAINER_ISSUES" ]]; then
    fail "Some containers are not running:"
    log "$CONTAINER_ISSUES"
    REPORT+="⚠️  <b>Docker Containers with Issues:</b>%0A"
    while IFS=$'\t' read -r name status; do
        REPORT+="• ${name}: ${status}%0A"
    done <<< "$CONTAINER_ISSUES"
    REPORT+="%0A"
else
    ok "All Docker containers are running"
fi

# ── 3. Check Grafana for Error Rate ────────────────────────────
log "Checking Grafana metrics..."
if [[ -n "$GRAFANA_TOKEN" && -n "$GRAFANA_URL" ]]; then
    # Query error rate from Prometheus/Grafana
    ERROR_RATE=$(curl -sf -m 10 "${GRAFANA_URL}/api/ds/query" \
        -H "Authorization: Bearer ${GRAFANA_TOKEN}" \
        -H "Content-Type: application/json" \
        -d '{
            "queries": [{
                "refId": "A",
                "expr": "rate(http_requests_total{status=~\"5..\"}[5m])",
                "datasource": {"type": "prometheus", "uid": "prometheus"}
            }],
            "from": "now-1h",
            "to": "now"
        }' 2>/dev/null | jq -r '.results.A.frames[0].data.values[1][0] // "unknown"' || echo "unknown")

    if [[ "$ERROR_RATE" != "unknown" && "$ERROR_RATE" != "nan" ]]; then
        ERROR_PCT=$(echo "$ERROR_RATE * 100" | bc 2>/dev/null || echo "N/A")
        if (( $(echo "$ERROR_RATE > 0.05" | bc -l 2>/dev/null || echo 0) )); then
            warn "Error rate is ${ERROR_PCT}% (threshold: 5%)"
            REPORT+="⚠️  <b>Error Rate:</b> ${ERROR_PCT}% (HIGH)%0A"
        else
            ok "Error rate is ${ERROR_PCT}% (within threshold)"
            REPORT+="✅ <b>Error Rate:</b> ${ERROR_PCT}% (OK)%0A"
        fi
    else
        REPORT+="⚠️  <b>Error Rate:</b> Could not fetch%0A"
    fi
else
    log "Grafana credentials not configured, skipping error rate check"
    REPORT+="⚠️  <b>Error Rate:</b> Grafana not configured%0A"
fi

# ── 4. Check Backup Status ─────────────────────────────────────
log "Checking backup status..."
BACKUP_ISSUES=""

# PostgreSQL backup check
PG_BACKUP=$(find /srv/backups/postgres -type f -mtime -1 2>/dev/null | head -1)
if [[ -n "$PG_BACKUP" ]]; then
    ok "PostgreSQL backup found: $(basename $PG_BACKUP)"
    REPORT+="✅ <b>PostgreSQL Backup:</b> $(basename $PG_BACKUP)%0A"
else
    warn "No PostgreSQL backup in last 24h"
    BACKUP_ISSUES+="• PostgreSQL: No recent backup%0A"
fi

# Qdrant snapshot check
QDRANT_BACKUP=$(find /srv/backups/qdrant -type f -mtime -1 2>/dev/null | head -1)
if [[ -n "$QDRANT_BACKUP" ]]; then
    ok "Qdrant backup found: $(basename $QDRANT_BACKUP)"
    REPORT+="✅ <b>Qdrant Backup:</b> $(basename $QDRANT_BACKUP)%0A"
else
    warn "No Qdrant backup in last 24h"
    BACKUP_ISSUES+="• Qdrant: No recent backup%0A"
fi

# Redis RDB backup check
REDIS_BACKUP=$(find /srv/backups/redis -type f -mtime -1 2>/dev/null | head -1)
if [[ -n "$REDIS_BACKUP" ]]; then
    ok "Redis backup found: $(basename $REDIS_BACKUP)"
    REPORT+="✅ <b>Redis Backup:</b> $(basename $REDIS_BACKUP)%0A"
else
    warn "No Redis backup in last 24h"
    BACKUP_ISSUES+="• Redis: No recent backup%0A"
fi

if [[ -n "$BACKUP_ISSUES" ]]; then
    REPORT+="%0A⚠️  <b>Backup Issues:</b>%0A${BACKUP_ISSUES}"
fi

# ── 5. Check Disk and Memory ───────────────────────────────────
log "Checking disk space..."
DISK_USAGE=$(df -h /srv | awk 'NR==2 {print $5}' | tr -d '%')
if [[ "$DISK_USAGE" -lt 80 ]]; then
    ok "Disk usage at ${DISK_USAGE}% (OK)"
    REPORT+="✅ <b>Disk Usage:</b> ${DISK_USAGE}% (OK)%0A"
else
    warn "Disk usage at ${DISK_USAGE}% (threshold: 80%)"
    REPORT+="⚠️  <b>Disk Usage:</b> ${DISK_USAGE}% (HIGH)%0A"
fi

log "Checking memory..."
MEMORY_USAGE=$(free | awk '/Mem:/ {printf "%.0f", $3/$2 * 100}')
if [[ "$MEMORY_USAGE" -lt 90 ]]; then
    ok "Memory usage at ${MEMORY_USAGE}% (OK)"
    REPORT+="✅ <b>Memory Usage:</b> ${MEMORY_USAGE}% (OK)%0A"
else
    warn "Memory usage at ${MEMORY_USAGE}% (threshold: 90%)"
    REPORT+="⚠️  <b>Memory Usage:</b> ${MEMORY_USAGE}% (HIGH)%0A"
fi

# ── 6. Check ZFS Pool ───────────────────────────────────────────
log "Checking ZFS pool status..."
if zpool status tank 2>&1 | grep -q "errors: No known data errors"; then
    ok "ZFS pool tank is healthy"
    REPORT+="✅ <b>ZFS Pool:</b> Healthy%0A"
else
    fail "ZFS pool tank has errors"
    REPORT+="❌ <b>ZFS Pool:</b> ERRORS DETECTED%0A"
fi

# ── Final Summary ─────────────────────────────────────────────
REPORT+="%0A%0A🔧 <b>Full report saved to:</b> ${LOG_FILE}"

# ── Send Telegram Notification ──────────────────────────────────
if [[ $HEALTH_FAIL -gt 0 || -n "$BACKUP_ISSUES" ]]; then
    REPORT+="%0A%0A🚨 <b>ACTION REQUIRED</b>"
    log "Health check completed with ISSUES - sending alert"
    send_telegram "$REPORT" || true
else
    log "Health check completed successfully - all services OK"
    send_telegram "$REPORT" || true
fi

# ── Exit Code ──────────────────────────────────────────────────
if [[ $HEALTH_FAIL -gt 0 ]]; then
    exit 1
fi
exit 0
