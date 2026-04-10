#!/bin/bash
set -euo pipefail

# =============================================================================
# Entrypoint: Fetch secrets from Infisical via REST API (curl), then run app
# =============================================================================
# Required env vars:
#   INFISICAL_TOKEN    - Service token for Infisical
#   INFISICAL_PROJECT_ID - Project ID in Infisical
#   INFISICAL_ENV      - Environment slug (e.g. dev, prod)
#   INFISICAL_SECRET_PATH - Secret path (default: /)
#
# Uses curl + Infisical REST API v3 instead of Python SDK (avoids SDK version issues)
# =============================================================================

INFISICAL_TOKEN="${INFISICAL_TOKEN:-}"
INFISICAL_PROJECT_ID="${INFISICAL_PROJECT_ID:-}"
INFISICAL_ENV="${INFISICAL_ENV:-dev}"
INFISICAL_SECRET_PATH="${INFISICAL_SECRET_PATH:-/}"
INFISICAL_HOST="${INFISICAL_HOST:-http://127.0.0.1:8200}"

# Secrets to fetch (comma-separated list)
SECRET_KEYS="${SECRET_KEYS:-OPENCLAW_GATEWAY_TOKEN,OPENCLAW_BASE_URL}"

echo "[entrypoint] Starting at $(date -Iseconds)" >&2
echo "[entrypoint] Fetching secrets from Infisical (project=$INFISICAL_PROJECT_ID, env=$INFISICAL_ENV)" >&2

if [ -z "$INFISICAL_TOKEN" ]; then
    echo "[entrypoint] WARNING: INFISICAL_TOKEN not set, using fallback env vars (dev mode)" >&2
    echo "[entrypoint] To enable Infisical, set INFISICAL_TOKEN, INFISICAL_PROJECT_ID env vars" >&2
else
    echo "[entrypoint] Fetching secrets via Infisical API v3 (Python urllib)..." >&2

    # Parse secret keys into array
    IFS=',' read -ra KEYS_ARRAY <<< "$SECRET_KEYS"

    # Fetch all secrets from Infisical via REST API using Python
    python3 - "$INFISICAL_HOST" "$INFISICAL_TOKEN" "$INFISICAL_PROJECT_ID" "$INFISICAL_ENV" "$INFISICAL_SECRET_PATH" "$SECRET_KEYS" << 'PYEOF' >&2
import sys
import urllib.request
import json

host = sys.argv[1]
token = sys.argv[2]
project_id = sys.argv[3]
env_slug = sys.argv[4]
secret_path = sys.argv[5]
secret_keys = [k.strip() for k in sys.argv[6].split(',')]

url = f"{host}/api/v3/secrets/raw?project_id={project_id}&environment={env_slug}&secret_path={secret_path}"

req = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}"})
try:
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = json.loads(resp.read())
        fetched = 0
        for key in secret_keys:
            for s in data.get('secrets', []):
                if s['secretKey'] == key:
                    import os
                    os.environ[key] = s['secretValue']
                    fetched += 1
                    break
        print(f"[entrypoint] Fetched {fetched} secrets from Infisical")
except Exception as e:
    print(f"[entrypoint] WARNING: Failed to fetch from Infisical API: {e}")
PYEOF
fi

echo "[entrypoint] Starting Python app: $*" >&2
exec "$@"
