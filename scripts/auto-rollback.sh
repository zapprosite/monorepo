#!/usr/bin/env bash
# =============================================================================
# auto-rollback.sh — Detect post-deploy failure and revert to previous state
# =============================================================================
# SPEC-210 Phase 6: Automated rollback via ZFS snapshot restore
#
# Usage:
#   bash auto-rollback.sh [--check] [--rollback SNAPSHOT]
#
# --check   : Verify current state against health expectations
# --rollback : Restore to specified ZFS snapshot
#
set -euo pipefail

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

# ────────────────────────────────────────────────────────────────────────
# Pre-deploy: Create ZFS snapshot
# ────────────────────────────────────────────────────────────────────────
create_deploy_snapshot() {
  local ts
  ts=$(date +%Y%m%d-%H%M%S)

  echo "Creating pre-deploy snapshots..."
  sudo zfs snapshot -r tank/monorepo@deploy-${ts} 2>/dev/null
  sudo zfs snapshot -r tank/docker-data@deploy-${ts} 2>/dev/null
  echo "Snapshots: @deploy-${ts}"

  # Record snapshot name for potential rollback
  echo "deploy-${ts}" > /tmp/last-deploy-snapshot.txt
  echo "LAST_SNAPSHOT=deploy-${ts}"
}

# ────────────────────────────────────────────────────────────────────────
# Health check: Are all critical services up?
# ────────────────────────────────────────────────────────────────────────
health_check() {
  local failures=0

  SERVICES=(
    "gitea:https://git.zappro.site:200"
    "coolify:https://coolify.zappro.site:200"
    "qdrant:http://localhost:6333/health:200"
    "ollama:http://localhost:11434:200"
    "litellm:https://llm.zappro.site/health:200"
    "hermes:http://localhost:8642/health:200"
  )

  echo -e "${GREEN}━━━ Health Check ━━━${NC}"

  for svc_line in "${SERVICES[@]}"; do
    IFS=':' read -r name url expected_code <<<"$svc_line"
    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$url" 2>/dev/null || echo "000")

    if [[ "$code" == "$expected_code" ]]; then
      echo -e "  ${GREEN}✓${NC} $name"
    else
      echo -e "  ${RED}✗${NC} $name — HTTP $code (expected $expected_code)"
      failures=$((failures + 1))
    fi
  done

  echo ""
  if [[ $failures -gt 0 ]]; then
    echo -e "${RED}$failures service(s) unhealthy${NC}"
    return 1
  else
    echo -e "${GREEN}All services healthy${NC}"
    return 0
  fi
}

# ────────────────────────────────────────────────────────────────────────
# Rollback: Restore to ZFS snapshot
# ────────────────────────────────────────────────────────────────────────
rollback_to_snapshot() {
  local snapshot_name="${1:-}"

  if [[ -z "$snapshot_name" ]]; then
    # Read last deploy snapshot
    snapshot_name=$(cat /tmp/last-deploy-snapshot.txt 2>/dev/null || echo "")
    if [[ -z "$snapshot_name" ]]; then
      # Use most recent snapshot
      snapshot_name=$(zfs list -t snapshot -o name -s creation tank/monorepo 2>/dev/null | grep 'deploy-' | tail -1)
    fi
  fi

  if [[ -z "$snapshot_name" ]]; then
    echo -e "${RED}No snapshot found for rollback${NC}"
    exit 1
  fi

  echo -e "${RED}⚠️  ROLLBACK: Restoring to snapshot $snapshot_name${NC}"
  echo ""
  echo "This will:"
  echo "  1. Revert /srv/monorepo to snapshot $snapshot_name"
  echo "  2. Revert Docker volumes to snapshot $snapshot_name"
  echo ""
  echo -e "${RED}All changes since the snapshot will be LOST.${NC}"
  echo ""
  read -p "Type 'rollback' to confirm: " confirm
  [[ "$confirm" != "rollback" ]] && echo "Aborted." && exit 1

  echo "Rolling back..."

  # Rollback monorepo
  sudo zfs rollback -r "tank/monorepo@$snapshot_name" 2>/dev/null || {
    echo "Cannot rollback directly (later snapshots exist). Using clone..."
    local clone_name="tank/monorepo-rollback-temp"
    sudo zfs clone "tank/monorepo@$snapshot_name" "$clone_name"
    sudo rsync -av --delete "/$clone_name/" /srv/monorepo/
    sudo zfs destroy "$clone_name"
  }

  # Rollback docker data
  sudo zfs rollback -r "tank/docker-data@$snapshot_name" 2>/dev/null || true

  echo -e "${GREEN}Rollback complete. Restart services:${NC}"
  echo "  docker compose -f /srv/monorepo/docker-compose.enterprise.yml up -d"
}

# ────────────────────────────────────────────────────────────────────────
# Main
# ────────────────────────────────────────────────────────────────────────
case "${1:-}" in
  --check)
    health_check
    ;;
  --rollback)
    rollback_to_snapshot "${2:-}"
    ;;
  --snapshot)
    create_deploy_snapshot
    ;;
  *)
    echo "auto-rollback.sh — SPEC-210 DR tooling"
    echo ""
    echo "  --check      Run health check on all critical services"
    echo "  --snapshot   Create pre-deploy ZFS snapshot"
    echo "  --rollback   Restore to last deploy snapshot"
    ;;
esac
