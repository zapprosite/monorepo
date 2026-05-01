#!/bin/bash
#===========================================
# Playwright E2E Smoke Test Runner
# Usage: ./smoke-test.sh [--local] [--verbose]
# Exits: 0 = all pass, 1 = failure
#===========================================

set -o pipefail

LOCAL_MODE="${1:-}"
BASE_URL="${BASE_URL:-http://localhost:4004}"
PERPLEXITY_CONTAINER="${PERPLEXITY_CONTAINER:-perplexity-agent}"

if [[ "$LOCAL_MODE" == "--local" ]]; then
  BASE_URL="http://localhost:4004"
fi

echo "=== Playwright E2E Smoke Test ==="
echo "Target: $BASE_URL"

# Check if container is running (skip in CI)
if [[ "${CI:-false}" != "true" ]]; then
  if ! docker ps | grep -q perplexity-agent; then
    echo "❌ Container perplexity-agent not running"
    exit 1
  fi
  echo "✅ Container is running"
fi

# Check if base URL is reachable
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$BASE_URL/_stcore/health" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" != "200" ]]; then
  echo "❌ Cannot reach $BASE_URL/_stcore/health (HTTP $HTTP_CODE)"
  exit 1
fi
echo "✅ Service is up (HTTP $HTTP_CODE)"

# Install dependencies if needed
cd /srv/monorepo/apps/perplexity-agent
if [[ ! -f "node_modules/@playwright/test" ]]; then
  echo "Installing Playwright..."
  npm install -D @playwright/test
  npx playwright install chromium
fi

# Run tests
export BASE_URL
export CI

EXIT_CODE=0
npx playwright test \
  --config=e2e/playwright.config.ts \
  --reporter=list \
  "$@" 2>&1 || EXIT_CODE=$?

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✅ All E2E tests passed"
else
  echo "❌ E2E tests failed (exit $EXIT_CODE)"
fi

exit $EXIT_CODE
