#!/bin/bash
#===========================================
# CI/CD Entry Point for Perplexity Agent E2E
# Exit codes: 0 = pass, 1 = fail
#===========================================

set -o pipefail

BASE_URL="${BASE_URL:-http://localhost:4004}"
PERPLEXITY_CONTAINER="${PERPLEXITY_CONTAINER:-perplexity-agent}"

E2E_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
AGENT_DIR="$(dirname "$E2E_DIR")"

echo "=== Perplexity Agent E2E CI ==="
echo "Target: $BASE_URL"
echo "CI: ${CI:-false}"

# --- Step 1: Check if service is reachable ---
echo ""
echo "[1/4] Checking service availability..."

check_http() {
  curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$1" 2>/dev/null
}

if [[ "$CI" == "true" ]]; then
  HTTP_CODE=$(check_http "$BASE_URL/_stcore/health")
  CURL_RC=$?
  if [[ $CURL_RC -ne 0 ]]; then
    echo "❌ Cannot reach $BASE_URL/_stcore/health (curl exit $CURL_RC)"
    exit 1
  fi
  if [[ "$HTTP_CODE" != "200" ]]; then
    echo "❌ Service responded with HTTP $HTTP_CODE (expected 200)"
    exit 1
  fi
  echo "✅ Service is up (HTTP $HTTP_CODE)"
else
  if ! docker ps --format '{{.Names}}' | grep -q "^${PERPLEXITY_CONTAINER}$"; then
    echo "❌ Container '$PERPLEXITY_CONTAINER' not running"
    exit 1
  fi
  echo "✅ Container '$PERPLEXITY_CONTAINER' is running"

  HTTP_CODE=$(check_http "$BASE_URL/_stcore/health")
  CURL_RC=$?
  if [[ $CURL_RC -ne 0 ]]; then
    echo "❌ Cannot reach $BASE_URL/_stcore/health (curl exit $CURL_RC)"
    exit 1
  fi
  if [[ "$HTTP_CODE" != "200" ]]; then
    echo "❌ Service responded with HTTP $HTTP_CODE"
    exit 1
  fi
  echo "✅ Service is up (HTTP $HTTP_CODE)"
fi

# --- Step 2: Ensure Playwright is installed ---
echo ""
echo "[2/4] Checking Playwright..."

cd "$AGENT_DIR"

if [[ ! -x "$AGENT_DIR/node_modules/.bin/playwright" ]]; then
  echo "Installing Playwright..."
  npm install -D @playwright/test >/dev/null 2>&1
  npx playwright install chromium --with-deps >/dev/null 2>&1
  echo "✅ Playwright installed"
else
  echo "✅ Playwright found"
fi

# --- Step 3: Run Playwright tests ---
echo ""
echo "[3/4] Running Playwright tests..."
echo "Config: $E2E_DIR/playwright.config.ts"

export BASE_URL
export CI

EXIT_CODE=0
npx playwright test \
  --config="$E2E_DIR/playwright.config.ts" \
  --reporter=list \
  2>&1 || EXIT_CODE=$?

echo ""
echo "[4/4] Done"

if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✅ E2E TESTS PASSED"
else
  echo "❌ E2E TESTS FAILED (exit $EXIT_CODE)"
fi

exit $EXIT_CODE
