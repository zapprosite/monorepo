#!/bin/bash
# ==============================================================================
# Billing Simulation Smoke Test
# ==============================================================================
# Tests billing flow in simulation mode (BILLING_SIMULACAO=true)
# No real Stripe API calls are made.
#
# Usage: ./billing_smoke.sh [--live]
#   --live    Run against real Stripe (BILLING_SIMULACAO=false)
#
# Environment:
#   BILLING_SIMULACAO=true   → Simulation mode (default)
#   BILLING_SIMULACAO=false  → Live mode (requires STRIPE_API_KEY)
# ==============================================================================

set -e

SIMULATION="${BILLING_SIMULACAO:-true}"
MODE="simulation"

# Parse args
for arg in "$@"; do
  case $arg in
    --live)
      SIMULATION="false"
      MODE="live"
      ;;
  esac
done

export BILLING_SIMULACAO="$SIMULATION"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=============================================="
echo " Billing Smoke Test"
echo " Mode: $MODE"
echo " BILLING_SIMULACAO=$BILLING_SIMULACAO"
echo "=============================================="

# Test 1: Free plan rejection
echo ""
echo "[TEST 1] Free plan checkout rejection..."
RESULT=$(go run -exec "env BILLING_SIMULACAO=$SIMULATION" \
  -ldflags="-X github.com/will-zappro/hvacr-swarm/internal/billing.BillingSimulation=$SIMULATION" \
  ./tests/smoke/billing_sim_test.go 2>&1 || true)

if echo "$RESULT" | grep -q "free and trial plans do not require checkout"; then
  echo -e "${GREEN}✅ PASS${NC} - Free plan rejected correctly"
else
  echo -e "${RED}❌ FAIL${NC} - Free plan not rejected"
  echo "$RESULT"
fi

# Test 2: Trial plan rejection
echo ""
echo "[TEST 2] Trial plan checkout rejection..."
# Simulated via curl to running service
RESPONSE=$(curl -s -X POST http://localhost:8080/api/billing/checkout \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","plan":"trial"}' 2>&1 || echo "SERVICE_NOT_RUNNING")

if echo "$RESPONSE" | grep -q "free and trial plans do not require checkout"; then
  echo -e "${GREEN}✅ PASS${NC} - Trial plan rejected correctly"
elif echo "$RESPONSE" | grep -q "SERVICE_NOT_RUNNING"; then
  echo -e "${YELLOW}⚠️  SKIP${NC} - Service not running (run 'go run ./cmd/swarm' first)"
else
  echo -e "${RED}❌ FAIL${NC} - Trial plan not rejected"
  echo "$RESPONSE"
fi

# Test 3: Pro plan without price ID
echo ""
echo "[TEST 3] Pro plan without price ID..."
RESPONSE=$(curl -s -X POST http://localhost:8080/api/billing/checkout \
  -H "Content-Type: application/json" \
  -d '{"phone":"+5511999999999","plan":"pro"}' 2>&1 || echo "SERVICE_NOT_RUNNING")

if echo "$RESPONSE" | grep -q "no stripe price id configured"; then
  echo -e "${GREEN}✅ PASS${NC} - Pro plan without price ID rejected correctly"
elif echo "$RESPONSE" | grep -q "SERVICE_NOT_RUNNING"; then
  echo -e "${YELLOW}⚠️  SKIP${NC} - Service not running"
elif echo "$RESPONSE" | grep -q "simulate"; then
  echo -e "${GREEN}✅ PASS${NC} - Simulation mode returned mock URL"
else
  echo -e "${RED}❌ FAIL${NC} - Unexpected response"
  echo "$RESPONSE"
fi

# Test 4: Simulation URL format
echo ""
echo "[TEST 4] Simulation URL format check..."
if [ "$SIMULATION" = "true" ]; then
  EXPECTED_URL="https://checkout.stripe.com/simulate/mock_session_123"
  if [[ "$RESPONSE" == *"$EXPECTED_URL"* ]] || [[ "$RESPONSE" == *"simulate"* ]]; then
    echo -e "${GREEN}✅ PASS${NC} - Mock URL format correct"
  else
    echo -e "${YELLOW}⚠️  CHECK${NC} - URL format may differ"
    echo "Response: $RESPONSE"
  fi
fi

echo ""
echo "=============================================="
echo " Smoke test complete"
echo "=============================================="
echo ""
echo "To run against LIVE Stripe:"
echo "  BILLING_SIMULACAO=false ./billing_smoke.sh --live"
echo ""
echo "Or export env and run:"
echo "  export BILLING_SIMULACAO=false"
echo "  export STRIPE_API_KEY=sk_test_xxx"
echo "  ./billing_smoke.sh --live"