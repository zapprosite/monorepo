#!/bin/bash
set -e

# Smoke Test Script for Slices 10-12 (Maintenance, Loyalty, Email)
# Tests all tRPC endpoints via curl

BASE_URL="http://localhost:4001/trpc"
HEADER_CONTENT_TYPE="Content-Type: application/json"

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Starting Smoke Tests for Slices 10-12..."
echo "📍 Target: $BASE_URL"
echo ""

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0

# Function to test tRPC endpoint
test_trpc() {
  local name=$1
  local endpoint=$2
  local method=$3
  local payload=$4

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  echo -n "Test $TOTAL_TESTS: $name ... "

  if [ "$method" == "GET" ]; then
    response=$(curl -s -X GET "$BASE_URL/$endpoint" \
      -H "$HEADER_CONTENT_TYPE" 2>&1)
  else
    response=$(curl -s -X POST "$BASE_URL/$endpoint" \
      -H "$HEADER_CONTENT_TYPE" \
      -d "$payload" 2>&1)
  fi

  # Check for success patterns
  if echo "$response" | grep -q '"result"' || echo "$response" | grep -q 'data' || echo "$response" | grep -q 'success'; then
    echo -e "${GREEN}✓ PASSED${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
  else
    echo -e "${RED}✗ FAILED${NC}"
    echo "Response: $response"
  fi
}

echo "═══════════════════════════════════════════════════════════"
echo "📋 MAINTENANCE MODULE (Slice 10)"
echo "═══════════════════════════════════════════════════════════"

# Maintenance: Create Plan
test_trpc "Maintenance - Create Plan" \
  "maintenance.createPlan" \
  "POST" \
  '{"nomeEmpresa":"Empresa Test","tipoEquipamento":"ar-condicionado","periodicidadeDias":90}'

# Maintenance: List Plans
test_trpc "Maintenance - List Plans" \
  "maintenance.listPlans" \
  "POST" \
  '{"limit":10,"offset":0}'

# Maintenance: Calculate Next Date
test_trpc "Maintenance - Calculate Next Date" \
  "maintenance.calculateNextDate" \
  "POST" \
  '{"periodicidadeDias":90}'

# Maintenance: Detect Overdue
test_trpc "Maintenance - Detect Overdue" \
  "maintenance.detectOverdue" \
  "POST" \
  '{"lastMaintenance":"2026-01-01T00:00:00Z","periodDays":30}'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "💎 LOYALTY MODULE (Slice 11)"
echo "═══════════════════════════════════════════════════════════"

# Loyalty: Calculate Score
test_trpc "Loyalty - Calculate Score" \
  "loyalty.calculateScore" \
  "POST" \
  '{"clienteId":"550e8400-e29b-41d4-a716-446655440000"}'

# Loyalty: List Loyalty (with filters)
test_trpc "Loyalty - List Loyalty" \
  "loyalty.listLoyalty" \
  "POST" \
  '{"status":"ativo","limit":10,"offset":0}'

# Loyalty: Get Dashboard
test_trpc "Loyalty - Get Dashboard" \
  "loyalty.getDashboard" \
  "POST" \
  '{}'

# Loyalty: Trigger Reactivation
test_trpc "Loyalty - Trigger Reactivation" \
  "loyalty.triggerReactivation" \
  "POST" \
  '{"clientId":"550e8400-e29b-41d4-a716-446655440000"}'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📧 EMAIL MODULE (Slice 12)"
echo "═══════════════════════════════════════════════════════════"

# Email: Create Template
test_trpc "Email - Create Template" \
  "email.createTemplate" \
  "POST" \
  '{"nome":"Welcome Template","assunto":"Bem-vindo!","corpo":"<h1>Welcome</h1>","categoriTemplate":"bem-vindo"}'

# Email: List Templates
test_trpc "Email - List Templates" \
  "email.listTemplates" \
  "POST" \
  '{"limit":10,"offset":0}'

# Email: Get Template
test_trpc "Email - Get Template" \
  "email.getTemplate" \
  "POST" \
  '{"templateId":"550e8400-e29b-41d4-a716-446655440000"}'

# Email: Create Campaign
test_trpc "Email - Create Campaign" \
  "email.createCampaign" \
  "POST" \
  '{"nome":"Test Campaign","tipoCampanha":"marketing","destinatariosJSON":["test@example.com"]}'

# Email: List Campaigns
test_trpc "Email - List Campaigns" \
  "email.listCampaigns" \
  "POST" \
  '{"limit":10,"offset":0}'

# Email: Get Campaign
test_trpc "Email - Get Campaign" \
  "email.getCampaign" \
  "POST" \
  '{"campaignId":"550e8400-e29b-41d4-a716-446655440000"}'

# Email: Update Campaign
test_trpc "Email - Update Campaign" \
  "email.updateCampaign" \
  "POST" \
  '{"campaignId":"550e8400-e29b-41d4-a716-446655440000","statusCampanha":"agendada"}'

# Email: Send Test Email
test_trpc "Email - Send Test Email" \
  "email.sendTestEmail" \
  "POST" \
  '{"campaignId":"550e8400-e29b-41d4-a716-446655440000","recipientEmail":"test@example.com"}'

# Email: Send Campaign
test_trpc "Email - Send Campaign" \
  "email.sendCampaign" \
  "POST" \
  '{"campaignId":"550e8400-e29b-41d4-a716-446655440000"}'

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📊 TEST SUMMARY"
echo "═══════════════════════════════════════════════════════════"
echo -e "Total Tests:  $TOTAL_TESTS"
echo -e "Passed:       ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed:       ${RED}$((TOTAL_TESTS - PASSED_TESTS))${NC}"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
  echo -e "\n${GREEN}✅ All smoke tests passed!${NC}"
  exit 0
else
  echo -e "\n${RED}❌ Some tests failed${NC}"
  exit 1
fi
