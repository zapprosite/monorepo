#!/bin/bash
# Anti-hardcoded: all config via process.env
set -euo pipefail

MODE="${1:-}"
# Load project .env (canonical source)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")"
if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a; source "$ROOT_DIR/.env"; set +a
fi
GITEA_TOKEN="${GITEA_TOKEN:-}"
if [[ -z "$GITEA_TOKEN" ]]; then
  echo "❌ GITEA_TOKEN not set in .env"
  exit 1
fi
# Use direct internal API (bypasses Cloudflare Access on port 443)
GITEA_API_BASE="${GITEA_API_BASE:-http://localhost:3300/api/v1}"
REPO="${GITEA_REPO:-will-zappro/monorepo}"

if [ "$MODE" == "--issue" ]; then
  # Cria issue em vez de PR
  curl -s -X POST "$GITEA_API_BASE/repos/$REPO/issues" \
    -H "Authorization: token $GITEA_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"[AUTOMATED] Pipeline failed","body":"Ver tasks/agent-states/"}'
  echo "✅ Issue criada"
else
  # Cria PR
  BRANCH=$(git branch --show-current)
  SPEC_NAME=$(jq -r '.spec // "unknown"' tasks/pipeline.json 2>/dev/null || echo "SPEC")
  curl -s -X POST "$GITEA_API_BASE/repos/$REPO/pulls" \
    -H "Authorization: token $GITEA_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"head\":\"$BRANCH\",\"base\":\"main\",\"title\":\"Pipeline: $SPEC_NAME\"}"
  echo "✅ PR criada"
fi
