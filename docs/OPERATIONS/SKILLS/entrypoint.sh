#!/bin/bash
set -euo pipefail

# =============================================================================
# Entrypoint: Fetch secrets from Infisical via CLI, then run app
# =============================================================================
# Required env vars:
#   INFISICAL_TOKEN      - Service token for Infisical (or set INFISICAL_DOMAIN)
#   INFISICAL_PROJECT_ID - Project ID in Infisical
#   INFISICAL_ENV        - Environment slug (e.g. dev, prod)
#   INFISICAL_SECRET_PATH - Secret path (default: /)
#   INFISICAL_DOMAIN     - Self-hosted Infisical URL (default: http://127.0.0.1:8200)
#
# Uses Infisical CLI for secret fetching (avoids SDK version issues)
# =============================================================================

INFISICAL_TOKEN="${INFISICAL_TOKEN:-}"
INFISICAL_PROJECT_ID="${INFISICAL_PROJECT_ID:-}"
INFISICAL_ENV="${INFISICAL_ENV:-dev}"
INFISICAL_SECRET_PATH="${INFISICAL_SECRET_PATH:-/}"
INFISICAL_DOMAIN="${INFISICAL_DOMAIN:-http://127.0.0.1:8200}"

# Secrets to fetch (comma-separated list)
SECRET_KEYS="${SECRET_KEYS:-OPENCLAW_GATEWAY_TOKEN,OPENCLAW_BASE_URL}"

echo "[entrypoint] Starting at $(date -Iseconds)" >&2
echo "[entrypoint] Fetching secrets from Infisical (project=$INFISICAL_PROJECT_ID, env=$INFISICAL_ENV)" >&2

if [ -z "$INFISICAL_TOKEN" ]; then
    echo "[entrypoint] WARNING: INFISICAL_TOKEN not set, using fallback env vars (dev mode)" >&2
    echo "[entrypoint] To enable Infisical, set INFISICAL_TOKEN, INFISICAL_PROJECT_ID env vars" >&2
else
    echo "[entrypoint] Fetching secrets via Infisical CLI..." >&2

    # Parse secret keys into array
    IFS=',' read -ra KEYS_ARRAY <<< "$SECRET_KEYS"

    fetched=0
    for key in "${KEYS_ARRAY[@]}"; do
        key=$(echo "$key" | xargs)  # trim whitespace
        if [ -z "$key" ]; then
            continue
        fi

        # Use infisical CLI to fetch secret
        secret_value=$(infisical secrets get "$key" \
            --projectId="$INFISICAL_PROJECT_ID" \
            --env="$INFISICAL_ENV" \
            --path="$INFISICAL_SECRET_PATH" \
            --domain="$INFISICAL_DOMAIN" \
            --token="$INFISICAL_TOKEN" \
            --output=json 2>/dev/null | \
            python3 -c "import sys,json; d=json.load(sys.stdin); print(d[0]['secretValue'] if isinstance(d,list) else d.get('secretValue',''))" 2>/dev/null || echo "")

        if [ -n "$secret_value" ]; then
            export "$key"="$secret_value"
            fetched=$((fetched + 1))
        fi
    done

    echo "[entrypoint] Fetched ${fetched} secrets from Infisical" >&2
fi

echo "[entrypoint] Starting Python app: $*" >&2
exec "$@"
