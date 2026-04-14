#!/usr/bin/env bash
# health-check.sh — Full monorepo health check
# Usage: bash /srv/monorepo/scripts/health-check.sh
set -euo pipefail

# Source .env for environment variables
set -a
source /srv/monorepo/.env
set +a

TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
LOG_PREFIX="[health-check ${TIMESTAMP}]"
LOG_FILE="${LOG_FILE:-/srv/ops/logs/health-check.log}"

log() { echo "$LOG_PREFIX $1" | tee -a "$LOG_FILE"; }
ok()  { echo "$LOG_PREFIX ✅ $1" | tee -a "$LOG_FILE"; }
fail(){ echo "$LOG_PREFIX ❌ $1" | tee -a "$LOG_FILE"; }

log "Starting monorepo health check"

# ── Docker containers ──────────────────────────────────────────
log "Checking Docker containers..."
if docker ps --format "{{.Names}}\t{{.Status}}" | grep -v "Up"; then
    fail "Some containers are not running"
else
    ok "All containers up"
fi

# ── Monorepo services ──────────────────────────────────────────
log "Checking monorepo services..."
SERVICES=(
    "6333:Qdrant:${QDRANT_URL:-http://localhost:6333}/health"
    "5678:n8n:${N8N_URL:-http://localhost:5678}/api/v1/health"
)
for entry in "${SERVICES[@]}"; do
    IFS=':' read -r port name url <<< "$entry"
    if curl -sf -m 5 "$url" > /dev/null 2>&1; then
        ok "$name is healthy"
    else
        fail "$name is NOT responding at $url"
    fi
done

# ── ZFS pool ────────────────────────────────────────────────────
log "Checking ZFS pool..."
if zpool status tank 2>&1 | grep -q "errors: No known data errors"; then
    ok "ZFS pool tank is healthy"
else
    fail "ZFS pool tank has errors"
fi

# ── Disk space ──────────────────────────────────────────────────
log "Checking disk space..."
USAGE=$(df -h /srv | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$USAGE" -lt 80 ]; then
    ok "Disk usage at ${USAGE}% (under threshold)"
else
    fail "Disk usage at ${USAGE}% (over 80% threshold)"
fi

# ── Git status ─────────────────────────────────────────────────
log "Checking git status..."
cd /srv/monorepo
if git diff --quiet && git diff --cached --quiet; then
    ok "Git working tree is clean"
else
    log "Git has uncommitted changes"
fi

# ── Docker logs (last 5 errors) ────────────────────────────────
log "Checking container error logs..."
for container in qdrant n8n n8n-postgres; do
    ERRORS=$(docker logs "$container" 2>&1 | grep -iE "error|fatal|panic" | tail -3 || true)
    if [ -n "$ERRORS" ]; then
        log "$container errors: $ERRORS"
    fi
done

log "Health check complete"
echo "$LOG_PREFIX Done at $(date '+%Y-%m-%d %H:%M:%S')" >> "$LOG_FILE"
