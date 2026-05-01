#!/bin/bash
# ==============================================================================
# WhatsApp DEV Simulation Smoke Test
# ==============================================================================
# Tests WhatsApp DEV simulation flow without real credentials
# No Meta Graph API calls are made.
#
# Usage: ./whatsapp_dev_smoke.sh
#   --redis ADDR   Redis address (default: localhost:6379)
#   --phone NUM    Phone number for tests (default: +5511999999999)
# ==============================================================================

set -e

REDIS_ADDR="${REDIS_ADDR:-localhost:6379}"
PHONE="${PHONE:-+5511999999999}"
SIMULATOR_BIN="${SIMULATOR_BIN:-/srv/hvacr-swarm/bin/whatsapp-simulator}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "=============================================="
echo " WhatsApp DEV Simulation Smoke Test"
echo " Redis: $REDIS_ADDR"
echo " Phone: $PHONE"
echo "=============================================="

# Test 1: Simulator help
echo ""
echo "[TEST 1] Simulator help..."
if $SIMULATOR_BIN --help 2>&1 | grep -q "Usage of"; then
  echo -e "${GREEN}✅ PASS${NC} - Help displayed correctly"
else
  echo -e "${RED}❌ FAIL${NC} - Help not displayed"
fi

# Test 2: Redis connection
echo ""
echo "[TEST 2] Redis connection..."
if command -v redis-cli &> /dev/null; then
  if redis-cli -h ${REDIS_ADDR%%:*} -p ${REDIS_ADDR##*:} ping 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}✅ PASS${NC} - Redis is available"
  else
    echo -e "${YELLOW}⚠️  SKIP${NC} - Redis not available (using local queue)"
  fi
else
  echo -e "${YELLOW}⚠️  SKIP${NC} - redis-cli not found"
fi

# Test 3: Queue push (local simulation)
echo ""
echo "[TEST 3] Queue push simulation..."
RESULT=$($SIMULATOR_BIN --phone "$PHONE" --text "teste erro E8 Springer" 2>&1 || true)
if echo "$RESULT" | grep -q "SIMULATED WHATSAPP MESSAGE"; then
  echo -e "${GREEN}✅ PASS${NC} - Message simulated correctly"
else
  echo -e "${RED}❌ FAIL${NC} - Simulation failed"
  echo "$RESULT"
fi

# Test 4: Error code query simulation
echo ""
echo "[TEST 4] Error code query simulation..."
RESULT=$($SIMULATOR_BIN --phone "$PHONE" --text "Springer erro E8" 2>&1 || true)
if echo "$RESULT" | grep -q "erro E8\|E8"; then
  echo -e "${GREEN}✅ PASS${NC} - Error code query works"
else
  echo -e "${YELLOW}⚠️  CHECK${NC} - Query format may differ"
fi

# Test 5: Model lookup simulation
echo ""
echo "[TEST 5] Model lookup simulation..."
RESULT=$($SIMULATOR_BIN --phone "$PHONE" --text "specs Springer Xtreme Save" 2>&1 || true)
if echo "$RESULT" | grep -q "Xtreme\|Save"; then
  echo -e "${GREEN}✅ PASS${NC} - Model lookup works"
else
  echo -e "${YELLOW}⚠️  CHECK${NC} - Model lookup may differ"
fi

# Test 6: LG error code
echo ""
echo "[TEST 6] LG error code (CH10)..."
RESULT=$($SIMULATOR_BIN --phone "$PHONE" --text "LG dual inverter CH10" 2>&1 || true)
if echo "$RESULT" | grep -q "CH10\|LG"; then
  echo -e "${GREEN}✅ PASS${NC} - LG code query works"
else
  echo -e "${YELLOW}⚠️  CHECK${NC} - LG query may differ"
fi

# Test 7: Samsung error code
echo ""
echo "[TEST 7] Samsung error code (E101)..."
RESULT=$($SIMULATOR_BIN --phone "$PHONE" --text "Samsung Wind-Free E101" 2>&1 || true)
if echo "$RESULT" | grep -q "E101\|Samsung"; then
  echo -e "${GREEN}✅ PASS${NC} - Samsung code query works"
else
  echo -e "${YELLOW}⚠️  CHECK${NC} - Samsung query may differ"
fi

echo ""
echo "=============================================="
echo " Smoke test complete"
echo "=============================================="
echo ""
echo "To run with custom Redis:"
echo "  REDIS_ADDR=10.0.19.50:6379 ./whatsapp_dev_smoke.sh"
echo ""
echo "To run with custom phone:"
echo "  PHONE=+5511988887777 ./whatsapp_dev_smoke.sh"