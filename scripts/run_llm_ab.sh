#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${1:-http://localhost:4018/v1}"
MODEL="${2:-nexus-local-code}"
CONCURRENCY="${3:-2}"
REQUESTS="${4:-6}"

set -a
source /srv/monorepo/.env >/dev/null 2>&1 || true
export LITELLM_API_KEY="${LITELLM_API_KEY:-${LITELLM_MASTER_KEY:-}}"
set +a

python3 /srv/monorepo/scripts/llm_ab_benchmark.py \
  --base-url "$BASE_URL" \
  --model "$MODEL" \
  --concurrency "$CONCURRENCY" \
  --requests "$REQUESTS"
