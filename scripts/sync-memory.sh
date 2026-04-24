#!/bin/bash
# sync-memory.sh — Sync monorepo context to long-term memory
# Usage: bash scripts/sync-memory.sh
# Checks health via SSH if running on build machine, locally if on srv

set -euo pipefail

MONOREPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MEMORY_FILE="${HOME}/.hermes/sb-context.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')
REMOTE="${REMOTE_SRV:-will@srv.zappro.site}"

# ── Detect if we should SSH ─────────────────────────────────────
check_remote() {
  local host="$1"
  local port="$2"
  if curl -sf -m 2 "http://localhost:${port}/health" >/dev/null 2>&1; then
    return 0
  elif ssh -o ConnectTimeout=3 -o StrictHostKeyChecking=no "$host" \
    "curl -sf -m 2 http://localhost:${port}/health" >/dev/null 2>&1; then
    return 0
  fi
  return 1
}

echo "=== Syncing monorepo context to memory ==="

# Build context snapshot
{
  echo "---
last_sync: ${TIMESTAMP}
source: monorepo/sync-memory.sh
---"
  echo ""
  echo "# Monorepo Context Snapshot — ${TIMESTAMP}"
  echo ""
  echo "## Active Apps"
  for app in apps/*/; do
    app_name=$(basename "$app")
    if [[ -f "${app}package.json" ]]; then
      echo "- ${app_name}"
    fi
  done
  echo ""
  echo "## Recent Changes"
  if git -C "${MONOREPO_ROOT}" log --oneline -5 >/dev/null 2>&1; then
    git -C "${MONOREPO_ROOT}" log --oneline -5 | sed 's/^/  /'
  fi
  echo ""
  echo "## Health Status (via ${REMOTE})"
  for service in ai-gateway:4002 litellm:4000 qdrant:6333; do
    IFS=':' read -r name port <<< "$service"
    if check_remote "$REMOTE" "$port"; then
      echo "- ${name}: ✅"
    else
      echo "- ${name}: ❌"
    fi
  done
  if check_remote "$REMOTE" 8642; then
    echo "- hermes-gateway: ✅"
  else
    echo "- hermes-gateway: ❌"
  fi

} > "${MEMORY_FILE}"

echo "[OK] Context synced to ${MEMORY_FILE}"
