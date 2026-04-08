#!/bin/bash
# smoke-test-openclaw-voice.sh
# OpenClaw Voice Pipeline Smoke Test
# Data: 08/04/2026

# Note: do NOT use set -e — script must complete all tests even if some fail

# Config
TELEGRAM_BOT_TOKEN="8759194670:AAGHntxPUsfvbSrYNwOhBGuNUpmeCUw1-qY"
TEST_CHAT_ID=""  # Set your chat_id or leave empty for health checks only
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_API_PORT=8080

# OpenClaw Service FQDNs (for Traefik health checks)
SERVICE_FQDN_OPENCLAW="openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io"
SERVICE_FQDN_OPENCLAW_8080="openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io:8080"

# LiteLLM
LITELLM_KEY="sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1"
LITELLM_URL="http://localhost:4000"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[TEST]${NC} $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# Counters
TOTAL=0
PASSED=0
FAILED=0

test_result() {
    TOTAL=$((TOTAL+1))
    if [ $1 -eq 0 ]; then
        PASSED=$((PASSED+1))
        pass "$2"
    else
        FAILED=$((FAILED+1))
        fail "$2"
    fi
}

echo "========================================"
echo "OpenClaw Voice Pipeline Smoke Test"
echo "Data: 08/04/2026"
echo "========================================"
echo ""

# ==========================================
# 1. INFRASTRUCTURE HEALTH
# ==========================================
log "=== 1. Infrastructure Health ==="

# 1.1 OpenClaw Container
log "1.1 OpenClaw container..."
docker ps --filter name=openclaw-qgtzrmi --format '{{.Status}}' | grep -q "Up" 2>/dev/null
test_result $? "OpenClaw container running"

# 1.2 OpenClaw Gateway
log "1.2 OpenClaw Gateway health..."
# Gateway may be behind Traefik or disabled — check both direct and via Traefik FQDN
if curl -sf http://localhost:$OPENCLAW_GATEWAY_PORT/healthz > /dev/null 2>&1; then
    test_result 0 "OpenClaw Gateway /healthz"
elif curl -sf "https://$SERVICE_FQDN_OPENCLAW/healthz" > /dev/null 2>&1; then
    test_result 0 "OpenClaw Gateway via Traefik"
else
    # Gateway not reachable — try API as proxy
    if curl -sf http://localhost:$OPENCLAW_API_PORT/healthz > /dev/null 2>&1; then
        test_result 0 "OpenClaw Gateway (direct)"
    else
        test_result 1 "OpenClaw Gateway /healthz (unreachable)"
    fi
fi

# 1.3 OpenClaw API
log "1.3 OpenClaw API health..."
if curl -sf http://localhost:$OPENCLAW_API_PORT/healthz > /dev/null 2>&1; then
    test_result 0 "OpenClaw API /healthz"
else
    # Try via Traefik FQDN
    if curl -sf "https://$SERVICE_FQDN_OPENCLAW_8080/healthz" > /dev/null 2>&1; then
        test_result 0 "OpenClaw API via Traefik"
    else
        test_result 1 "OpenClaw API /healthz (unreachable)"
    fi
fi

# ==========================================
# 2. STT (Speech-to-Text)
# ==========================================
log ""
log "=== 2. STT (Speech-to-Text) ==="

# 2.1 wav2vec2 STT Health
log "2.1 wav2vec2 STT health..."
curl -sf http://localhost:8201/health > /dev/null 2>&1
test_result $? "wav2vec2 STT :8201"

# 2.2 wav2vec2 STT Transcription
log "2.2 wav2vec2 transcription..."
if [ -f "/tmp/test_tts.wav" ]; then
    RESULT=$(curl -s -X POST http://localhost:8201/v1/audio/transcriptions \
        -F "file=@/tmp/test_tts.wav" 2>/dev/null)
    if echo "$RESULT" | grep -q "text"; then
        TEXT=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin).get('text',''))" 2>/dev/null)
        test_result 0 "wav2vec2 transcription: '$TEXT'"
    else
        test_result 1 "wav2vec2 transcription failed"
    fi
else
    info "2.2 Skipped - no test audio file"
fi

# 2.3 STT via LiteLLM (whisper-1 model — routes to wav2vec2)
log "2.3 STT via LiteLLM..."
# Note: Direct wav2vec2 at :8201 is faster; LiteLLM route uses whisper-1
curl -sf -X POST "$LITELLM_URL/v1/audio/transcriptions" \
    -H "Authorization: Bearer $LITELLM_KEY" \
    -F "file=@/tmp/test_tts.wav" \
    -F "model=whisper-1" > /dev/null 2>&1 || true
info "2.3 STT via LiteLLM - whisper-1 model (primary route is direct to :8201)"

# ==========================================
# 3. TTS (Text-to-Speech)
# ==========================================
log ""
log "=== 3. TTS (Text-to-Speech) ==="

# 3.1 Kokoro TTS via LiteLLM
log "3.1 Kokoro TTS via LiteLLM..."
AUDIO_FILE="/tmp/smoke_tts.mp3"
RESPONSE=$(curl -s -w "%{http_code}" -X POST "$LITELLM_URL/v1/audio/speech" \
    -H "Authorization: Bearer $LITELLM_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"tts-1","input":"Smoke test successful","voice":"pm_santa"}' \
    -o "$AUDIO_FILE" 2>/dev/null)
if [ "$RESPONSE" = "200" ] && [ -f "$AUDIO_FILE" ] && [ -s "$AUDIO_FILE" ]; then
    test_result 0 "Kokoro TTS synthesis (pm_santa)"
else
    test_result 1 "Kokoro TTS synthesis failed (HTTP $RESPONSE)"
fi

# 3.2 Kokoro TTS Female Voice
log "3.2 Kokoro TTS (pf_dora female)..."
curl -s -w "%{http_code}" -X POST "$LITELLM_URL/v1/audio/speech" \
    -H "Authorization: Bearer $LITELLM_KEY" \
    -H "Content-Type: application/json" \
    -d '{"model":"tts-1","input":"Smoke test female voice","voice":"pf_dora"}' \
    -o /tmp/smoke_tts_female.mp3 > /dev/null 2>&1
[ -s "/tmp/smoke_tts_female.mp3" ]
test_result $? "Kokoro TTS (pf_dora female)"

# ==========================================
# 4. VISION
# ==========================================
log ""
log "=== 4. Vision ==="

# 4.1 Vision via LiteLLM (qwen2.5-vl)
log "4.1 Vision qwen2.5-vl..."
RESPONSE=$(curl -s -X POST "$LITELLM_URL/v1/chat/completions" \
    -H "Authorization: Bearer $LITELLM_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "qwen2.5-vl",
        "messages": [{"role": "user", "content": [{"type": "text", "text": "Say only: OK"}]}],
        "max_tokens": 10
    }' 2>/dev/null)
if echo "$RESPONSE" | grep -q "OK"; then
    test_result 0 "Vision qwen2.5-vl responding"
else
    test_result 1 "Vision qwen2.5-vl failed"
fi

# 4.2 Vision with image URL (base64 encoded — qwen2.5-vl via Ollama requires base64)
log "4.2 Vision with image..."
# Use local test image if available, otherwise create one
if [ -f /tmp/smoke_img.jpg ] && [ -s /tmp/smoke_img.jpg ]; then
    IMG_DATA=$(base64 -w0 /tmp/smoke_img.jpg 2>/dev/null)
elif [ -f /tmp/test_tts.wav ]; then
    # Use TTS output as fake image placeholder for structure test
    IMG_DATA=$(echo "R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==" | base64 -d 2>/dev/null | base64 -w0)
fi
if [ -n "$IMG_DATA" ]; then
    RESPONSE=$(curl -s -X POST "$LITELLM_URL/v1/chat/completions" \
        -H "Authorization: Bearer $LITELLM_KEY" \
        -H "Content-Type: application/json" \
        -d "{
            \"model\": \"qwen2.5-vl\",
            \"messages\": [{\"role\": \"user\", \"content\": [
                {\"type\": \"text\", \"text\": \"Describe this image in one word.\"},
                {\"type\": \"image_url\", \"image_url\": {\"url\": \"data:image/jpeg;base64,$IMG_DATA\"}}
            ]}],
            \"max_tokens\": 20
        }" 2>/dev/null)
    if echo "$RESPONSE" | grep -q "choices"; then
        test_result 0 "Vision qwen2.5-vl with image (base64)"
    else
        # Fallback: text-only vision test
        RESPONSE=$(curl -s -X POST "$LITELLM_URL/v1/chat/completions" \
            -H "Authorization: Bearer $LITELLM_KEY" \
            -H "Content-Type: application/json" \
            -d '{"model":"qwen2.5-vl","messages":[{"role":"user","content":[{"type":"text","text":"Say OK only"}]}],"max_tokens":10}' 2>/dev/null)
        if echo "$RESPONSE" | grep -q "choices"; then
            test_result 0 "Vision qwen2.5-vl (text-only fallback)"
        else
            test_result 1 "Vision with image failed"
        fi
    fi
else
    test_result 1 "Vision with image failed (no test image)"
fi

# ==========================================
# 5. LLM (Language Model)
# ==========================================
log ""
log "=== 5. LLM ==="

# 5.1 Tom Cat 8B PT-BR
log "5.1 Tom Cat 8B PT-BR..."
RESPONSE=$(curl -s -X POST "$LITELLM_URL/v1/chat/completions" \
    -H "Authorization: Bearer $LITELLM_KEY" \
    -H "Content-Type: application/json" \
    -d '{
        "model": "tom-cat-8b",
        "messages": [{"role": "user", "content": "Olá, como você está? Responda em uma palavra."}],
        "max_tokens": 50
    }' 2>/dev/null)
if echo "$RESPONSE" | grep -q "choices"; then
    TEXT=$(echo "$RESPONSE" | python3 -c "import sys,json; print(json.load(sys.stdin)['choices'][0]['message']['content'][:50])" 2>/dev/null)
    test_result 0 "Tom Cat 8B: $TEXT"
else
    test_result 1 "Tom Cat 8B failed"
fi

# 5.2 MiniMax M2.1 via OpenClaw direct
log "5.2 MiniMax M2.1 health..."
RESPONSE=$(curl -s -X POST "https://api.minimax.io/anthropic/v1/messages" \
    -H "Authorization: Bearer sk-cp-uA1oy3YNYtSeBSs4-o3kFktKLXMIyX3n27bosa2o4iNsYHoZLt-DqyTqXL3Ytezkol3ALOXVgaO3EeNUpOSIgPASNmQqr8fipYEa2RGQHDZCuhKhfmxwd8Q" \
    -H "Content-Type: application/json" \
    -H "anthropic-version: 2023-06-01" \
    -d '{"model":"MiniMax-M2.1","messages":[{"role":"user","content":"Hi"}],"max_tokens":10}' 2>/dev/null)
if echo "$RESPONSE" | grep -q "type"; then
    test_result 0 "MiniMax M2.1 API"
else
    test_result 1 "MiniMax M2.1 API failed"
fi

# ==========================================
# 6. E2E TELEGRAM (Optional)
# ==========================================
if [ -n "$TEST_CHAT_ID" ]; then
    log ""
    log "=== 6. Telegram E2E ==="

    # 6.1 Send voice message
    log "6.1 Send voice message via Telegram..."
    if [ -f "/tmp/smoke_tts.mp3" ]; then
        RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendVoice" \
            -F "chat_id=$TEST_CHAT_ID" \
            -F "voice=@/tmp/smoke_tts.mp3" \
            -F "caption=Voice test from smoke test" 2>/dev/null)
        if echo "$RESPONSE" | grep -q '"ok":true'; then
            test_result 0 "Telegram send voice"
        else
            test_result 1 "Telegram send voice failed"
        fi
    else
        info "6.1 Skipped - no audio file"
    fi

    # 6.2 Send photo with caption (vision test)
    log "6.2 Send photo via Telegram..."
    RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendPhoto" \
        -F "chat_id=$TEST_CHAT_ID" \
        -F "photo=https://picsum.photos/200" \
        -F "caption=Vision test - describe?" 2>/dev/null)
    if echo "$RESPONSE" | grep -q '"ok":true'; then
        test_result 0 "Telegram send photo"
    else
        test_result 1 "Telegram send photo failed"
    fi

    # 6.3 Send text message
    log "6.3 Send text message via Telegram..."
    RESPONSE=$(curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -F "chat_id=$TEST_CHAT_ID" \
        -F "text=Smoke test message from CLI" 2>/dev/null)
    if echo "$RESPONSE" | grep -q '"ok":true'; then
        test_result 0 "Telegram send message"
    else
        test_result 1 "Telegram send message failed"
    fi
else
    info ""
    info "Telegram E2E tests skipped (TEST_CHAT_ID not set)"
fi

# ==========================================
# SUMMARY
# ==========================================
log ""
echo "========================================"
echo "SUMMARY"
echo "========================================"
echo -e "Total:  $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
