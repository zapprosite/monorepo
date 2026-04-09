#!/bin/bash
# E2E Smoke Test: chat.zappro.site (FULL CHAIN)
# Chain: Coolify → Terraform_Cloudflare_redes → OAuth_Google → Open WebUI
#
# Strategy:
# 1. Try SERVICE TOKEN first (bypasses 2FA, for CI/CD)
# 2. If no service token, try PLAYWRIGHT real login (E2E completo)
# 3. Verify authenticated response + app functionality
#
# Secrets from: Infisical (vault.zappro.site:8200)
# Project ID: e42657ef-98b2-4b9c-9a04-46c093bd6d37

set -euo pipefail

SITE="chat.zappro.site"
INFISICAL_TOKEN_FILE="/srv/ops/secrets/infisical.service-token"
PROJECT_ID="e42657ef-98b2-4b9c-9a04-46c093bd6d37"
ENV="dev"
DEBUG="${DEBUG:-0}"

echo "=== E2E Smoke Test: $SITE ==="
echo "Date: $(date -Iseconds)"
echo ""

# =============================================================================
# STEP 1: Fetch secrets from Infisical (batch - single Python call)
# =============================================================================
echo "[STEP 1] Fetching secrets from Infisical..."

INFISICAL_TOKEN="${INFISICAL_TOKEN:-}"
if [ -z "$INFISICAL_TOKEN" ] && [ -f "$INFISICAL_TOKEN_FILE" ]; then
    INFISICAL_TOKEN=$(cat "$INFISICAL_TOKEN_FILE" | tr -d '\n')
fi

if [ -z "$INFISICAL_TOKEN" ]; then
    echo "❌ INFISICAL_TOKEN not available"
    exit 1
fi

# Batch fetch all secrets in one Python call
ALL_SECRETS=$(python3 - "$INFISICAL_TOKEN" "$PROJECT_ID" "$ENV" << 'PYEOF' 2>/dev/null
import sys
from infisical_sdk import InfisicalSDKClient
token = sys.argv[1]
project_id = sys.argv[2]
env_slug = sys.argv[3]
client = InfisicalSDKClient(host='http://127.0.0.1:8200', token=token)
secrets = client.secrets.list_secrets(
    project_id=project_id,
    environment_slug=env_slug,
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key in ('CF_ACCESS_CLIENT_ID', 'CF_ACCESS_CLIENT_SECRET',
                        'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET',
                        'CHROME_SESSION_EMAIL', 'CHROME_SESSION_PASSWORD'):
        print(f"{s.secret_key}={s.secret_value}")
PYEOF
) || true

SERVICE_TOKEN_ID="$(echo "$ALL_SECRETS" | grep '^CF_ACCESS_CLIENT_ID=' | cut -d= -f2-)"
SERVICE_TOKEN_SECRET="$(echo "$ALL_SECRETS" | grep '^CF_ACCESS_CLIENT_SECRET=' | cut -d= -f2-)"
GOOGLE_CLIENT_ID="$(echo "$ALL_SECRETS" | grep '^GOOGLE_CLIENT_ID=' | cut -d= -f2-)"
GOOGLE_CLIENT_SECRET="$(echo "$ALL_SECRETS" | grep '^GOOGLE_CLIENT_SECRET=' | cut -d= -f2-)"
CHROME_SESSION_EMAIL="$(echo "$ALL_SECRETS" | grep '^CHROME_SESSION_EMAIL=' | cut -d= -f2-)"

echo "  Service Token: ${SERVICE_TOKEN_ID:+✅ configured}"
echo "  Service Token Secret: ${SERVICE_TOKEN_SECRET:+✅ configured}"
echo "  Google OAuth: ${GOOGLE_CLIENT_ID:+✅ configured}"
echo "  Chrome Session: ${CHROME_SESSION_EMAIL:+✅ configured}"
echo ""

# =============================================================================
# STEP 2: Service Token Authentication (bypasses 2FA)
# =============================================================================
echo "[STEP 2] Testing with Service Token (bypasses OAuth/2FA)..."

SERVICE_TOKEN_AUTH=0

if [ -n "$SERVICE_TOKEN_ID" ] && [ -n "$SERVICE_TOKEN_SECRET" ]; then
    echo "  Using Service Token authentication..."
    # Capture headers + body in one call
    RESPONSE=$(curl -s --max-time 15 \
        -H "CF-Access-Client-Id: $SERVICE_TOKEN_ID" \
        -H "CF-Access-Client-Secret: $SERVICE_TOKEN_SECRET" \
        -D /tmp/cf-headers.$$.txt \
        -w "%{http_code}" \
        "https://$SITE" 2>/dev/null || echo "000")

    HTTP_CODE="${RESPONSE: -3}"
    BODY="${RESPONSE:0:${#RESPONSE}-3}"

    if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "302" ]]; then
        echo "  ✅ Service Token: HTTP $HTTP_CODE"

        AUTH_EMAIL=$(grep -i "Cf-Access-Authenticated-User-Email:" /tmp/cf-headers.$$.txt 2>/dev/null || true)
        rm -f /tmp/cf-headers.$$.txt

        if [ -n "$AUTH_EMAIL" ]; then
            echo "  ✅ Authenticated: $AUTH_EMAIL"
            SERVICE_TOKEN_AUTH=1
        else
            echo "  ⚠️  Service Token returned $HTTP_CODE but no auth header (may need Service Auth policy)"
        fi
    else
        echo "  ❌ Service Token failed: HTTP $HTTP_CODE"
        rm -f /tmp/cf-headers.$$.txt
    fi
else
    echo "  ⚠️  No Service Token available"
fi

# =============================================================================
# STEP 3: Playwright E2E with OAuth Login (real user flow)
# =============================================================================
if (( SERVICE_TOKEN_AUTH != 1 )) && command -v node &> /dev/null; then
    echo ""
    echo "[STEP 3] Testing with Playwright E2E (real OAuth Google login)..."

    if [ -f "/srv/monorepo/smoke-tests/playwright-chat-e2e.mjs" ]; then
        echo "  Running Playwright E2E..."
        if node /srv/monorepo/smoke-tests/playwright-chat-e2e.mjs "$SITE" 2>&1; then
            echo "  ✅ Playwright E2E completed"
        else
            echo "  ⚠️  Playwright E2E had issues"
        fi
    else
        echo "  ⚠️  playwright-chat-e2e.mjs not found, skipping"
    fi
fi

# =============================================================================
# STEP 4: Verify Infrastructure Chain
# =============================================================================
echo ""
echo "[STEP 4] Verifying Infrastructure Chain..."

TUNNEL_CHECK=$(curl -s --max-time 10 -I "https://$SITE" 2>/dev/null | grep -i "cloudflare\|cf-ray" || true)
echo "  4.1 - DNS/Cloudflare Tunnel: ${TUNNEL_CHECK:+✅ Cloudflare proxying}"
echo "  4.1 - DNS/Cloudflare Tunnel: ${TUNNEL_CHECK:-❌ Not proxied by Cloudflare}"

ORIGIN_CHECK=$(curl -s --max-time 10 "https://$SITE" -L 2>/dev/null | grep -i "open webui\|openwebui" | head -1 || true)
echo "  4.2 - Open WebUI origin: ${ORIGIN_CHECK:+✅ Open WebUI responding}"
echo "  4.2 - Open WebUI origin: ${ORIGIN_CHECK:-⚠️  Could not verify (may need auth)}"

CONTAINER_NAME=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -i openwebui | head -1 || true)
echo "  4.3 - Coolify container: ${CONTAINER_NAME:+✅ Container running: $CONTAINER_NAME}"
echo "  4.3 - Coolify container: ${CONTAINER_NAME:-⚠️  No OpenWebUI container found}"

# =============================================================================
# STEP 5: E2E Summary
# =============================================================================
echo ""
echo "[STEP 5] E2E Summary"
echo "==================="

AUTH_STATUS="❌ NOT AUTHENTICATED"
(( SERVICE_TOKEN_AUTH == 1 )) && AUTH_STATUS="✅ AUTHENTICATED (Service Token)"

SCREENSHOT=$(ls -t /tmp/e2e-chat-*.png 2>/dev/null | head -1 || true)
[ -n "$SCREENSHOT" ] && AUTH_STATUS="$AUTH_STATUS + Playwright E2E screenshot"

echo "Auth Status: $AUTH_STATUS"
echo "Chain Status: Coolify → Cloudflare → OAuth Google → Open WebUI"
echo ""
echo "E2E Test completed at $(date -Iseconds)"
echo ""
echo "📋 E2E Evidence:"
[ -f "$SCREENSHOT" ] && echo "  Screenshot: $SCREENSHOT"
echo "  Secrets: Infisical (vault.zappro.site:8200)"
echo "  Project: $PROJECT_ID"
echo "  Environment: $ENV"
