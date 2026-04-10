#!/bin/bash
set -euo pipefail

# =============================================================================
# Entrypoint: Fetch secrets from Infisical, then run the Python app
# =============================================================================
# Required env vars:
#   INFISICAL_TOKEN    - Service token for Infisical
#   INFISICAL_PROJECT_ID - Project ID in Infisical
#   INFISICAL_ENV      - Environment slug (e.g. dev, prod)
#   INFISICAL_SECRET_PATH - Secret path (default: /)
#
# The script fetches secrets from Infisical and exports them as env vars
# so the Python app can use them transparently.
# =============================================================================

INFISICAL_TOKEN="${INFISICAL_TOKEN:-}"
INFISICAL_PROJECT_ID="${INFISICAL_PROJECT_ID:-}"
INFISICAL_ENV="${INFISICAL_ENV:-dev}"
INFISICAL_SECRET_PATH="${INFISICAL_SECRET_PATH:-/}"
INFISICAL_HOST="${INFISICAL_HOST:-http://127.0.0.1:8200}"

# Secrets to fetch (comma-separated list)
# Adjust SECRET_KEYS for your project
SECRET_KEYS="${SECRET_KEYS:-OPENCLAW_GATEWAY_TOKEN,OPENCLAW_BASE_URL}"

echo "[entrypoint] Starting at $(date -Iseconds)" >&2
echo "[entrypoint] Fetching secrets from Infisical (project=$INFISICAL_PROJECT_ID, env=$INFISICAL_ENV)" >&2

if [ -z "$INFISICAL_TOKEN" ]; then
    echo "[entrypoint] WARNING: INFISICAL_TOKEN not set, using fallback env vars (dev mode)" >&2
    echo "[entrypoint] To enable Infisical, set INFISICAL_TOKEN, INFISICAL_PROJECT_ID env vars" >&2
else
    echo "[entrypoint] Fetching secrets from Infisical..." >&2

    python3 - "$INFISICAL_TOKEN" "$INFISICAL_PROJECT_ID" "$INFISICAL_ENV" "$INFISICAL_SECRET_PATH" "$SECRET_KEYS" << 'PYEOF' >&2
import sys
import os
from infisical_sdk import InfisicalSDKClient

token = sys.argv[1]
project_id = sys.argv[2]
env_slug = sys.argv[3]
secret_path = sys.argv[4]
secret_keys = [k.strip() for k in sys.argv[5].split(',')]

client = InfisicalSDKClient(host=os.environ.get('INFISICAL_HOST', 'http://127.0.0.1:8200'), token=token)

try:
    secrets = client.secrets.list_secrets(
        project_id=project_id,
        environment_slug=env_slug,
        secret_path=secret_path
    )
    fetched = 0
    for s in secrets.secrets:
        if s.secret_key in secret_keys:
            # Export for current and forked processes
            os.environ[s.secret_key] = s.secret_value
            fetched += 1
    print(f"[entrypoint] Fetched {fetched} secrets from Infisical", flush=True)
except Exception as e:
    print(f"[entrypoint] WARNING: Failed to fetch from Infisical: {e}", flush=True)
    sys.exit(0)  # Don't fail startup, use fallback env vars
PYEOF

    echo "[entrypoint] Secrets loaded" >&2
fi

echo "[entrypoint] Starting Python app: $*" >&2
exec "$@"
