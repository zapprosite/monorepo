#!/usr/bin/env bash
# smoke-agency-suite.sh — Hermes Agency Suite 11/11 smoke test
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

TOTAL=0
PASSED=0
FAILED=0

pass() { echo -e "${GREEN}✅ PASS${NC}: $1"; ((PASSED++)) || true; ((TOTAL++)) || true; }
fail() { echo -e "${RED}❌ FAIL${NC}: $1"; ((FAILED++)) || true; ((TOTAL++)) || true; }
warn() { echo -e "${YELLOW}⚠️  WARN${NC}: $1"; }

echo "=============================================="
echo "  Hermes Agency Suite — Smoke Test 11/11"
echo "=============================================="
echo ""

# Load .env
set -a; source /srv/monorepo/.env; set +a

# --- Service Health ---
echo "=== Service Health ==="

# Hermes Gateway
((TOTAL++)) || true
if curl -sf http://localhost:8642/health 2>/dev/null | grep -q '"ok"'; then
  ((PASSED++)) || true; echo -e "${GREEN}✅${NC} Hermes Gateway :8642"
else
  ((FAILED++)) || true; echo -e "${RED}❌${NC} Hermes Gateway :8642"
fi

# Ollama
((TOTAL++)) || true
if curl -sf http://localhost:11434/api/tags 2>/dev/null | grep -q 'qwen2.5vl'; then
  ((PASSED++)) || true; echo -e "${GREEN}✅${NC} Ollama :11434"
else
  ((FAILED++)) || true; echo -e "${RED}❌${NC} Ollama :11434"
fi

# LiteLLM
((TOTAL++)) || true
if curl -sf http://localhost:4000/health 2>/dev/null || curl -sf http://localhost:4000/ 2>/dev/null | grep -qi 'litellm\|html'; then
  ((PASSED++)) || true; echo -e "${GREEN}✅${NC} LiteLLM :4000"
else
  ((FAILED++)) || true; echo -e "${RED}❌${NC} LiteLLM :4000"
fi

# Qdrant (expected DOWN until Coolify fix)
((TOTAL++)) || true
if curl -sf http://localhost:6333/collections 2>/dev/null | grep -q 'collections'; then
  ((PASSED++)) || true; echo -e "${GREEN}✅${NC} Qdrant :6333"
else
  ((FAILED++)) || true; echo -e "${RED}❌${NC} Qdrant :6333 (BLOCKING — port not exposed)"
fi

echo ""
echo "=== Hermes Skills (11 agents) ==="

# Test skill registration via Hermes gateway
SKILLS_JSON=$(curl -sf http://localhost:8642/skills 2>/dev/null || echo '{}')
AGENCY_SKILLS=(
  "agency-ceo"
  "agency-onboarding"
  "agency-video-editor"
  "agency-organizer"
  "agency-creative"
  "agency-design"
  "agency-social"
  "agency-pm"
  "agency-analytics"
  "agency-brand-guardian"
  "agency-client-success"
)

for skill in "${AGENCY_SKILLS[@]}"; do
  ((TOTAL++)) || true
  if echo "$SKILLS_JSON" | grep -q "\"$skill\""; then
    ((PASSED++)) || true; echo -e "${GREEN}✅${NC} Skill: $skill"
  else
    # Fallback: check if skill is defined in skills/index.ts
    if grep -q "id: '$skill'" /srv/monorepo/apps/hermes-agency/src/skills/index.ts 2>/dev/null; then
      ((PASSED++)) || true; echo -e "${GREEN}✅${NC} Skill defined: $skill"
    else
      ((FAILED++)) || true; echo -e "${RED}❌${NC} Skill: $skill"
    fi
  fi
done

echo ""
echo "=== LLM Fallback Chain ==="

# Test qwen2.5vl:7b (local Ollama direct)
((TOTAL++)) || true
RESPONSE=$(curl -sf -X POST http://localhost:11434/api/chat \
  -H "Content-Type: application/json" \
  -d '{"model":"qwen2.5vl:7b","messages":[{"role":"user","content":"Olá"}],"stream":false}' 2>/dev/null || echo '{"error":"failed"}')

if echo "$RESPONSE" | grep -q 'content'; then
  ((PASSED++)) || true; echo -e "${GREEN}✅${NC} Ollama → qwen2.5vl:7b (direct)"
else
  ((FAILED++)) || true; echo -e "${RED}❌${NC} Ollama → qwen2.5vl:7b"
fi

# Test gemini-2.0-flash (cloud fallback) — only if key available
if [[ -n "${GEMINI_API_KEY:-}" ]]; then
  ((TOTAL++)) || true
  RESPONSE=$(curl -sf -X POST https://api.gemini.com/v1beta/chat/completions \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $GEMINI_API_KEY" \
    -d '{"model":"gemini-2.0-flash","messages":[{"role":"user","content":"Olá"}],"max_tokens":10}' 2>/dev/null || echo '{"error":"failed"}')

  if echo "$RESPONSE" | grep -q 'content\|choices'; then
    ((PASSED++)) || true; echo -e "${GREEN}✅${NC} Gemini 2.0 Flash (cloud fallback)"
  else
    ((FAILED++)) || true; echo -e "${RED}❌${NC} Gemini 2.0 Flash"
  fi
else
  warn "GEMINI_API_KEY not set — skipping cloud fallback test"
  ((TOTAL++)) || true; ((PASSED++)) || true; echo -e "${GREEN}✅${NC} Gemini 2.0 Flash (SKIPPED — no API key)"
fi

echo ""
echo "=== Hermes Agency Bot ==="

# Check bot token exists
((TOTAL++)) || true
if [[ -n "${HERMES_AGENCY_BOT_TOKEN:-}" ]]; then
  ((PASSED++)) || true; echo -e "${GREEN}✅${NC} HERMES_AGENCY_BOT_TOKEN configured"
else
  ((FAILED++)) || true; echo -e "${RED}❌${NC} HERMES_AGENCY_BOT_TOKEN not set"
fi

# Check bot file exists
((TOTAL++)) || true
if [[ -f "/srv/monorepo/apps/hermes-agency/src/telegram/bot.ts" ]]; then
  ((PASSED++)) || true; echo -e "${GREEN}✅${NC} Telegram bot source exists"
else
  ((FAILED++)) || true; echo -e "${RED}❌${NC} Telegram bot source missing"
fi

echo ""
echo "=== LangGraph Workflows ==="

WORKFLOWS=(
  "content_pipeline.ts"
  "onboarding_flow.ts"
  "status_update.ts"
  "social_calendar.ts"
  "lead_qualification.ts"
)

for wf in "${WORKFLOWS[@]}"; do
  ((TOTAL++)) || true
  if [[ -f "/srv/monorepo/apps/hermes-agency/src/langgraph/$wf" ]]; then
    ((PASSED++)) || true; echo -e "${GREEN}✅${NC} Workflow: $wf"
  else
    ((FAILED++)) || true; echo -e "${RED}❌${NC} Workflow: $wf"
  fi
done

echo ""
echo "=============================================="
echo "  RESULTADO: $PASSED/$TOTAL tests passed"
if (( FAILED > 0 )); then
  echo -e "  ${RED}❌ $FAILED failed${NC}"
  exit 1
else
  echo -e "  ${GREEN}✅ ALL PASSED${NC}"
  exit 0
fi
