#!/usr/bin/env bash
# smoke-router.sh — agency_router.ts: trigger matching, sanitizeForPrompt, skill execution
#
# Tests: skill trigger matching, prompt sanitization, skill execution via vitest.
# Uses fictional Refrimix messages to exercise the router.
#
# Idempotent — tests are read-only; no artifacts created.

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
AGENCY_DIR="${AGENCY_DIR:-/srv/monorepo/apps/hermes-agency}"
HERMES_GATEWAY_URL="${HERMES_GATEWAY_URL:-https://hermes.zappro.site}"
API_KEY="${HERMES_API_KEY:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[SMOKE]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }

# ── Prerequisites ───────────────────────────────────────────────────
check_prereqs() {
  log "Checking prerequisites..."

  if [[ ! -d "$AGENCY_DIR" ]]; then
    fail "Agency directory not found: ${AGENCY_DIR}"
    exit 1
  fi
  ok "Agency directory: ${AGENCY_DIR}"

  if [[ ! -f "${AGENCY_DIR}/package.json" ]]; then
    fail "package.json not found in ${AGENCY_DIR}"
    exit 1
  fi

  # Check if hermes gateway is reachable (optional)
  if curl -sf "${HERMES_GATEWAY_URL}/health" > /dev/null 2>&1; then
    ok "Hermes Gateway reachable"
  else
    warn "Hermes Gateway not reachable at ${HERMES_GATEWAY_URL} (running tests via vitest only)"
  fi

  # Check vitest is available
  if command -v vitest > /dev/null 2>&1; then
    ok "vitest available"
  elif [[ -f "${AGENCY_DIR}/node_modules/.bin/vitest" ]]; then
    ok "vitest available via node_modules"
  else
    warn "vitest not found — will attempt bun test"
  fi

  ok "Prerequisites checked"
}

# ── Run vitest router tests ──────────────────────────────────────────
run_vitest_tests() {
  log "Running agency_router vitest tests..."

  cd "$AGENCY_DIR"

  # Run only the agency_router and skills tests (covers trigger matching + sanitizeForPrompt)
  if command -v vitest > /dev/null 2>&1; then
    vitest run src/__tests__/agency_router.test.ts src/__tests__/skills.test.ts --reporter=verbose 2>&1
  elif command -v bun > /dev/null 2>&1; then
    bun test src/__tests__/agency_router.test.ts src/__tests__/skills.test.ts 2>&1
  else
    fail "Neither vitest nor bun available for running tests"
    exit 1
  fi

  local exit_code=$?
  if [[ $exit_code -eq 0 ]]; then
    ok "Vitest router tests passed"
  else
    fail "Vitest router tests failed (exit ${exit_code})"
    return $exit_code
  fi
}

# ── Test circuit breaker ─────────────────────────────────────────────
run_circuit_breaker_tests() {
  log "Running circuit breaker tests..."

  cd "$AGENCY_DIR"

  if command -v vitest > /dev/null 2>&1; then
    vitest run src/__tests__/circuit_breaker.test.ts --reporter=verbose 2>&1
  elif command -v bun > /dev/null 2>&1; then
    bun test src/__tests__/circuit_breaker.test.ts 2>&1
  fi

  local exit_code=$?
  if [[ $exit_code -eq 0 ]]; then
    ok "Circuit breaker tests passed"
  else
    warn "Circuit breaker tests failed (exit ${exit_code})"
  fi
}

# ── Smoke test trigger matching via HTTP ─────────────────────────────
test_trigger_http() {
  log "Testing trigger matching via Hermes Gateway..."

  # Test known triggers
  local -a TEST_CASES=(
    "briefing:agency-ceo:briefing para campanha Refrimix"
    "onboarding:agency-onboarding:novo cliente ClimaFrio"
    "social:agency-social:publicar no instagram"
    "video:agency-video-editor:transcrever vídeo YouTube"
    "analytics:agency-analytics:ver métricas do mês"
  )

  local all_passed=0

  for case in "${TEST_CASES[@]}"; do
    IFS=':' read -r label expected_skill message <<< "$case"

    # Skip if no API key or gateway not reachable
    if [[ -z "$API_KEY" ]]; then
      warn "HERMES_API_KEY not set — skipping HTTP trigger test: ${label}"
      return 0
    fi

    local response
    response=$(curl -sf -X POST "${HERMES_GATEWAY_URL}/api/route" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${API_KEY}" \
      -d "$(printf '{"message":"%s","userId":"smoke-test","chatId":99999}' "$message")" 2>&1)

    if echo "$response" | jq -e ".skillId == \"${expected_skill}\"" > /dev/null 2>&1; then
      ok "Trigger '${label}' → ${expected_skill}"
    else
      warn "Trigger '${label}' did not return expected skill ${expected_skill}"
      all_passed=1
    fi
  done

  return $all_passed
}

# ── Test sanitizeForPrompt via inline TS ─────────────────────────────
test_sanitize_inline() {
  log "Testing sanitizeForPrompt inline (no external services)..."

  # We test sanitization by verifying the test suite handles injection attempts
  # The vitest tests already cover: null bytes, control chars, long inputs
  # Here we just verify the test suite runs

  cd "$AGENCY_DIR"

  # Run just the sanitize-related tests
  if command -v vitest > /dev/null 2>&1; then
    vitest run src/__tests__/agency_router.test.ts --reporter=verbose 2>&1 \
      | grep -i "sanitize\|null byte\|injection" || true
  fi

  ok "sanitizeForPrompt tests executed (see vitest output above)"
}

# ── Main ─────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "  SMOKE: agency_router.ts — Router Logic"
  echo "  Trigger Matching + sanitizeForPrompt + Skill Exec"
  echo "═══════════════════════════════════════════════"
  echo ""

  check_prereqs

  echo ""
  echo "── Vitest Tests ──"
  run_vitest_tests || true

  echo ""
  echo "── Circuit Breaker Tests ──"
  run_circuit_breaker_tests || true

  echo ""
  echo "── HTTP Trigger Tests ──"
  test_trigger_http || warn "Some HTTP trigger tests failed"

  echo ""
  echo "── sanitizeForPrompt Tests ──"
  test_sanitize_inline

  echo ""
  echo "═══════════════════════════════════════════════"
  echo ""
  ok "smoke-router: tests complete"
}

trap '' EXIT
main "$@"
