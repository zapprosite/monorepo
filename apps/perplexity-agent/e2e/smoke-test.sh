#!/bin/bash
#===========================================
# Playwright E2E Smoke Test Runner
# Usage: ./smoke-test.sh [--local] [--verbose]
#===========================================

set -e

LOCAL_MODE="${1:-}"
BASE_URL="${BASE_URL:-http://localhost:4004}"

if [[ "$LOCAL_MODE" == "--local" ]]; then
  BASE_URL="http://localhost:4004"
fi

echo "=== Playwright E2E Smoke Test ==="
echo "Target: $BASE_URL"

# Check if container is running
if ! docker ps | grep -q perplexity-agent; then
  echo "❌ Container perplexity-agent not running"
  exit 1
fi

# Check if base URL is reachable
if ! curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" | grep -q "200\|301\|302"; then
  echo "❌ Cannot reach $BASE_URL"
  exit 1
fi

# Install dependencies if needed
cd /srv/monorepo/apps/perplexity-agent
if [[ ! -f "node_modules/@playwright/test" ]]; then
  echo "Installing Playwright..."
  npm install -D @playwright/test
  npx playwright install chromium
fi

# Run tests
export BASE_URL
npx playwright test \
  --config=e2e/playwright.config.ts \
  --reporter=list \
  "$@" 2>&1

EXIT_CODE=$?

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✅ All E2E tests passed"
else
  echo "❌ E2E tests failed (exit $EXIT_CODE)"
fi

exit $EXIT_CODE
