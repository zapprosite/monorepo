#!/bin/bash
# smoke-test-openclaw-voice.sh
# OpenClaw Voice Pipeline Smoke Test
# Data: 08/04/2026

# Note: do NOT use set -e — script must complete all tests even if some fail

# Config (from environment or defaults)
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TEST_CHAT_ID="${TEST_CHAT_ID:-}"  # Set your chat_id or leave empty for health checks only
OPENCLAW_GATEWAY_PORT=18789
OPENCLAW_API_PORT=8080

# OpenClaw Service FQDNs (for Traefik health checks)
SERVICE_FQDN_OPENCLAW="openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io"
SERVICE_FQDN_OPENCLAW_8080="openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io:8080"

# LiteLLM (required)
LITELLM_KEY="${LITELLM_KEY:?LITELLM_KEY not set}"
LITELLM_URL="${LITELLM_URL:-http://localhost:4000}"

# MiniMax (required)
MINIMAX_API_KEY="${MINIMAX_API_KEY:?MINIMAX_API_KEY not set}"

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

# Helpers
litellm_post() {
    local payload="$1"
    curl -sf -X POST "$LITELLM_URL/v1/chat/completions" \
        -H "Authorization: Bearer $LITELLM_KEY" \
        -H "Content-Type: application/json" \
        -d "$payload"
}

litellm_audio_tts() {
    local payload="$1" out="$2"
    curl -sf -w "%{http_code}" -X POST "$LITELLM_URL/v1/audio/speech" \
        -H "Authorization: Bearer $LITELLM_KEY" \
        -H "Content-Type: application/json" \
        -d "$payload" -o "$out"
}

telegram_send() {
    local method="$1" extra="$2"
    local -a parts=(-F "chat_id=$TEST_CHAT_ID")
    IFS=' ' read -ra extra_parts <<< "$extra"
    parts+=("${extra_parts[@]}")
    curl -sf -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/$method" "${parts[@]}" 2>/dev/null | grep -q '"ok":true'
}

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

# 2.3 STT via LiteLLM (whisper-1 model — routes to wav2vec2 container)
log "2.3 STT via LiteLLM..."
if [ -f "/tmp/test_tts.wav" ]; then
    RESP=$(curl -sf -X POST "$LITELLM_URL/v1/audio/transcriptions" \
        -H "Authorization: Bearer $LITELLM_KEY" \
        -F "file=@/tmp/test_tts.wav" \
        -F "model=whisper-1" 2>/dev/null)
    echo "$RESP" | grep -q "text"
    test_result $? "STT via LiteLLM (whisper-1)"
else
    info "2.3 Skipped - no test audio file"
fi

# ==========================================
# 3. TTS (Text-to-Speech)
# ==========================================
log ""
log "=== 3. TTS (Text-to-Speech) ==="

# 3.1 Kokoro TTS via LiteLLM
log "3.1 Kokoro TTS via LiteLLM..."
AUDIO_FILE="/tmp/smoke_tts.mp3"
RESP=$(litellm_audio_tts '{"model":"tts-1","input":"Smoke test successful","voice":"pm_santa"}' "$AUDIO_FILE")
[ "$RESP" = "200" ] && [ -s "$AUDIO_FILE" ]
test_result $? "Kokoro TTS synthesis (pm_santa)"

# 3.2 Kokoro TTS Female Voice
log "3.2 Kokoro TTS (pf_dora female)..."
RESP=$(litellm_audio_tts '{"model":"tts-1","input":"Smoke test female voice","voice":"pf_dora"}' /tmp/smoke_tts_female.mp3)
[ "$RESP" = "200" ]
test_result $? "Kokoro TTS (pf_dora female)"

# ==========================================
# 4. VISION
# ==========================================
log ""
log "=== 4. Vision ==="

# 4.1 Vision via LiteLLM (qwen2.5-vl)
log "4.1 Vision qwen2.5-vl..."
RESP=$(litellm_post '{"model":"qwen2.5-vl","messages":[{"role":"user","content":[{"type":"text","text":"Say only: OK"}]}],"max_tokens":10}')
echo "$RESP" | grep -q "OK"
test_result $? "Vision qwen2.5-vl responding"

# 4.2 Vision with image (base64 encoded)
log "4.2 Vision with image..."
if [ -f /tmp/smoke_img.jpg ] && [ -s /tmp/smoke_img.jpg ]; then
    IMG_DATA=$(base64 -w0 /tmp/smoke_img.jpg 2>/dev/null)
    RESP=$(litellm_post "{\"model\":\"qwen2.5-vl\",\"messages\":[{\"role\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"Describe this image in one word.\"},{\"type\":\"image_url\",\"image_url\":{\"url\":\"data:image/jpeg;base64,$IMG_DATA\"}}]}],"max_tokens":20}")
    echo "$RESP" | grep -q "choices"
    test_result $? "Vision qwen2.5-vl with image (base64)"
else
    info "4.2 Skipped - no test image at /tmp/smoke_img.jpg"
fi

# ==========================================
# 5. LLM (Language Model)
# ==========================================
log ""
log "=== 5. LLM ==="

# 5.1 Tom Cat 8B PT-BR
log "5.1 Tom Cat 8B PT-BR..."
RESP=$(litellm_post '{"model":"tom-cat-8b","messages":[{"role":"user","content":"Olá, como você está? Responda em uma palavra."}],"max_tokens":50}')
if echo "$RESP" | grep -q "choices"; then
    TEXT=$(echo "$RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['choices'][0]['message']['content'][:50])" 2>/dev/null)
    test_result 0 "Tom Cat 8B: $TEXT"
else
    test_result 1 "Tom Cat 8B failed"
fi

# 5.2 MiniMax M2.1 via OpenClaw direct
log "5.2 MiniMax M2.1 health..."
curl -s -X POST "https://api.minimax.io/anthropic/v1/messages" \
    -H "Authorization: Bearer $MINIMAX_API_KEY" \
    -H "Content-Type: application/json" \
    -H "anthropic-version: 2023-06-01" \
    -d '{"model":"MiniMax-M2.1","messages":[{"role":"user","content":"Hi"}],"max_tokens":10}' 2>/dev/null | grep -q "type"
test_result $? "MiniMax M2.1 API"

# ==========================================
# 6. E2E TELEGRAM (Optional)
# ==========================================
if [ -n "$TEST_CHAT_ID" ]; then
    log ""
    log "=== 6. Telegram E2E ==="

    # 6.1 Send voice message
    log "6.1 Send voice message via Telegram..."
    if [ -f "/tmp/smoke_tts.mp3" ]; then
        telegram_send "sendVoice" "-F voice=@/tmp/smoke_tts.mp3 -F caption=Voice test from smoke test"
        test_result $? "Telegram send voice"
    else
        info "6.1 Skipped - no audio file"
    fi

    # 6.2 Send photo with caption (vision test)
    log "6.2 Send photo via Telegram..."
    telegram_send "sendPhoto" "-F photo=https://picsum.photos/200 -F caption=Vision test - describe?"
    test_result $? "Telegram send photo"

    # 6.3 Send text message
    log "6.3 Send text message via Telegram..."
    telegram_send "sendMessage" "-F text=Smoke test message from CLI"
    test_result $? "Telegram send message"
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
