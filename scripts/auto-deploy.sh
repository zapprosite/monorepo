#!/bin/bash
# auto-deploy.sh — Subdomain creation + Coolify deploy
# Usage: auto-deploy.sh <app-name> [branch] [port]
set -euo pipefail

APP_NAME="${1:-}"
BRANCH="${2:-main}"
PORT="${3:-3000}"

if [ -z "$APP_NAME" ]; then
    echo "Usage: auto-deploy.sh <app-name> [branch] [port]" >&2
    exit 1
fi

DOMAIN="${APP_NAME}.zappro.site"
SUBDOMAIN_SCRIPT="/srv/ops/scripts/create-subdomain.sh"

# 1. Create subdomain if not exists
if [ -x "$SUBDOMAIN_SCRIPT" ]; then
    echo "[deploy] Creating subdomain: $DOMAIN"
    bash "$SUBDOMAIN_SCRIPT" "$APP_NAME" "http://localhost:$PORT" || true
else
    echo "[deploy] Subdomain script not found: $SUBDOMAIN_SCRIPT — skipping"
fi

# 2. Trigger Coolify deploy (via API)
COOLIFY_HOST="${COOLIFY_HOST:-https://coolify.zappro.site}"
COOLIFY_API_KEY="${COOLIFY_API_KEY:-}"

if [ -n "$COOLIFY_API_KEY" ]; then
    echo "[deploy] Triggering Coolify deploy for $APP_NAME (branch: $BRANCH)"

    # Get application UUID from name (simplified — assumes one app per name)
    APP_UUID=$(curl -s -H "Authorization: Bearer $COOLIFY_API_KEY" \
        "$COOLIFY_HOST/api/v1/applications" 2>/dev/null | \
        jq -r ".data[] | select(.name == \"$APP_NAME\") | .uuid" 2>/dev/null | head -1)

    if [ -n "$APP_UUID" ]; then
        curl -s -X POST \
            -H "Authorization: Bearer $COOLIFY_API_KEY" \
            "$COOLIFY_HOST/api/v1/applications/$APP_UUID/deploy" \
            -d "{\"branch\": \"$BRANCH\"}" | jq -r '.message // .error // "ok"' 2>/dev/null || true
        echo "[deploy] Deploy triggered for $APP_NAME"
    else
        echo "[deploy] App not found in Coolify: $APP_NAME"
    fi
else
    echo "[deploy] COOLIFY_API_KEY not set — skipping Coolify trigger"
fi

# 3. Wait and verify
echo "[deploy] Verifying deployment..."
sleep 5

if curl -sf "https://$DOMAIN/health" >/dev/null 2>&1; then
    echo "[deploy] SUCCESS: https://$DOMAIN/health — OK"
    exit 0
elif curl -sf "https://$DOMAIN/" >/dev/null 2>&1; then
    echo "[deploy] SUCCESS: https://$DOMAIN/ — responding"
    exit 0
else
    echo "[deploy] WARNING: $DOMAIN not responding yet (may need more time)"
    exit 1
fi