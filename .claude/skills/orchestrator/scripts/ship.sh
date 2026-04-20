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
REPO="${GITEA_REPO:-will/homelab-monorepo}"

if [ "$MODE" == "--issue" ]; then
  # Cria issue em vez de PR
  curl -s -X POST "https://git.zappro.site/api/v1/repos/$REPO/issues" \
    -H "Authorization: token $GITEA_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"title":"[AUTOMATED] Pipeline failed","body":"Ver tasks/agent-states/"}'
  echo "✅ Issue criada"
else
  # Cria PR
  BRANCH=$(git branch --show-current)
  curl -s -X POST "https://git.zappro.site/api/v1/repos/$REPO/pulls" \
    -H "Authorization: token $GITEA_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"head\":\"$BRANCH\",\"base\":\"main\",\"title\":\"Pipeline: $(cat tasks/pipeline.json | jq -r .spec)\"}"
  echo "✅ PR criada"
fi
