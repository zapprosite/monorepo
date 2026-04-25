#!/bin/bash
# nexus-cron-helper.sh — Cron triggers for Nexus

set -euo pipefail

MONOREPO="/srv/monorepo"
LOG="$MONOREPO/logs/nexus-cron.log"

log() {
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG"
}

# Every 5 min: Check queue and alert if tasks pending
check_queue() {
  if [ -f "$MONOREPO/.claude/vibe-kit/queue.json" ]; then
    pending=$(jq -r '.pending // 0' "$MONOREPO/.claude/vibe-kit/queue.json" 2>/dev/null || echo 0)
    if [ "$pending" -gt 0 ]; then
      log "ALERT: $pending tasks pending in queue"
      # Could trigger auto-execute here
    fi
  fi
}

# Every 30 min: Health check
health_check() {
  log "Running health check..."
  bash "$MONOREPO/smoke-tests/smoke-hermes-ready.sh" >> "$LOG" 2>&1

  # Context window check
  if [ -f "$MONOREPO/scripts/context-decide.sh" ]; then
    context_status=$("$MONOREPO/scripts/context-decide.sh" decide)
    log "Context status: $context_status"
  fi

  log "Health check complete"
}

# Hourly: Nexus status
nexus_status() {
  log "Nexus status:"
  bash "$MONOREPO/.claude/vibe-kit/nexus.sh --status" >> "$LOG" 2>&1
}

# Daily: Cleanup old logs
cleanup_logs() {
  find "$MONOREPO/logs" -name "*.log" -mtime +7 -delete 2>/dev/null
  log "Cleaned logs older than 7 days"
}

case "${1:-check}" in
  queue) check_queue ;;
  health) health_check ;;
  status) nexus_status ;;
  cleanup) cleanup_logs ;;
  *)
    echo "Usage: $0 {queue|health|status|cleanup}"
    ;;
esac