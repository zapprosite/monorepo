#!/bin/bash
# zfs-health.sh — ZFS health check for Hermes SRE monitoring
# Part of POLYMER-001 / ZFS disaster recovery skill
# Run by: sudo zpool status tank
set -euo pipefail

POOL="${ZFS_POOL:-tank}"
ALERT_THRESHOLD="${ALERT_THRESHOLD:-90}"  # space used % for alert

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

# 1. Pool health
HEALTH=$(sudo zpool health "$POOL" 2>/dev/null || echo "UNKNOWN")
if [[ "$HEALTH" != "ONLINE" ]]; then
    log "CRITICAL: Pool $POOL health: $HEALTH"
    exit 2
fi

# 2. Space usage
CAPACITY=$(sudo zpool list -H -o capacity "$POOL" 2>/dev/null | tr -d '%' || echo "0")
if [[ "$CAPACITY" -ge "$ALERT_THRESHOLD" ]]; then
    log "WARN: Pool $POOL at ${CAPACITY}% capacity"
    exit 1
fi

# 3. Recent snapshot check (should have at least one in last 7 days)
RECENT_SNAP=$(sudo zfs list -t snapshot -r "$POOL" -H -p -o creation -s creation 2>/dev/null | \
    tail -1 | xargs -I{} date -d "{}" +%s 2>/dev/null || echo "0")
SEVEN_DAYS_AGO=$(date -d '7 days ago' +%s)
if [[ "$RECENT_SNAP" -lt "$SEVEN_DAYS_AGO" ]]; then
    log "WARN: No ZFS snapshot in last 7 days on pool $POOL"
    exit 1
fi

log "OK: pool=$POOL health=$HEALTH capacity=${CAPACITY}%"
exit 0
