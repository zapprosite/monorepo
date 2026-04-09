#!/bin/bash
# Voice Proxy Smoke Test — wav2vec2-proxy
# Tests zappro-wav2vec2-proxy container and its /v1/listen endpoint
# Does NOT use set -e — must complete all steps

# =============================================================================
# Config
# =============================================================================
TTS_BRIDGE_URL="${TTS_BRIDGE_URL:-http://localhost:8013}"
VOICE_PROXY_URL="${VOICE_PROXY_URL:-http://localhost:8203}"
CONTAINER_NAME="zappro-wav2vec2-proxy"

# =============================================================================
# Helpers
# =============================================================================
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[VOICE-PROXY]${NC} $(date '+%H:%M:%S') $1"; }

curl_post() { curl -sf -m 30 "$1" -H "Content-Type: audio/mpeg" -H "Transfer-Encoding: chunked" --data-binary "@$2" 2>/dev/null; }

# =============================================================================
# Bootstrap
# =============================================================================
echo "========================================"
echo "Voice Proxy Smoke Test"
echo "========================================"

# =============================================================================
# 1. Container Check
# =============================================================================
log "=== Container Check ==="
CONTAINER_RUNNING=false
if docker ps --filter "name=${CONTAINER_NAME}" --filter "status=running" --format "{{.Names}}" | grep -q "^${CONTAINER_NAME}$"; then
    CONTAINER_RUNNING=true
fi
CONTAINER_STATUS=$([ "$CONTAINER_RUNNING" = true ] && echo "✅" || echo "❌")
log "Container ${CONTAINER_NAME}: ${CONTAINER_STATUS}"

# =============================================================================
# 2. Health Endpoint
# =============================================================================
log "=== Health Endpoint ==="
HEALTH_OK=false
if curl -sf -m 10 "${VOICE_PROXY_URL}/health" > /dev/null 2>&1; then
    HEALTH_OK=true
fi
HEALTH_STATUS=$([ "$HEALTH_OK" = true ] && echo "✅" || echo "❌")
log "Health ${VOICE_PROXY_URL}/health: ${HEALTH_STATUS}"

# =============================================================================
# 3. TTS Audio Generation (5 seconds)
# =============================================================================
log "=== TTS Audio Generation (pm_santa) ==="
TTS_FILE="/tmp/smoke_tts.mp3"
TTS_OK=false
if curl -sf -m 30 -X POST "${TTS_BRIDGE_URL}/v1/audio/speech" \
    -H "Content-Type: application/json" \
    -d '{"model":"kokoro","input":"Teste de audio. Olá, tudo bem? Estou testando o pipeline de voz.","voice":"pm_santa"}' \
    -o "$TTS_FILE" -w "%{http_code}" | grep -q "200" && [ -s "$TTS_FILE" ]; then
    TTS_OK=true
fi
TTS_STATUS=$([ "$TTS_OK" = true ] && echo "✅" || echo "❌")
log "TTS Generation: ${TTS_STATUS}"

# =============================================================================
# 4. Transcription via Voice Proxy
# =============================================================================
log "=== Transcription via Voice Proxy ==="
TRANSCRIPT_OK=false
RESPONSE=""
if [ "$TTS_OK" = true ] && [ -s "$TTS_FILE" ]; then
    RESPONSE=$(curl_post "${VOICE_PROXY_URL}/v1/listen?model=nova-3&language=pt-BR" "$TTS_FILE")
    if echo "$RESPONSE" | grep -q '"results"' && echo "$RESPONSE" | grep -q '"transcript"'; then
        TRANSCRIPT_OK=true
    fi
fi
TRANSCRIPT_STATUS=$([ "$TRANSCRIPT_OK" = true ] && echo "✅" || echo "❌")
log "Transcription: ${TRANSCRIPT_STATUS}"

# =============================================================================
# 5. Ollama Enhancement Check (ENTENDI:)
# =============================================================================
log "=== Ollama Enhancement Check ==="
OLLAMA_OK=false
if echo "$RESPONSE" | grep -q "ENTENDI:"; then
    OLLAMA_OK=true
fi
OLLAMA_STATUS=$([ "$OLLAMA_OK" = true ] && echo "✅" || echo "❌")
log "Ollama Enhancement (ENTENDI:): ${OLLAMA_STATUS}"

# =============================================================================
# 6. Summary & PASS/FAIL
# =============================================================================
TOTAL=4; PASSED=0; FAILED=0
[ "$CONTAINER_RUNNING" = true ] && PASSED=$((PASSED+1)) || FAILED=$((FAILED+1))
[ "$HEALTH_OK" = true ] && PASSED=$((PASSED+1)) || FAILED=$((FAILED+1))
[ "$TTS_OK" = true ] && PASSED=$((PASSED+1)) || FAILED=$((FAILED+1))
[ "$TRANSCRIPT_OK" = true ] && PASSED=$((PASSED+1)) || FAILED=$((FAILED+1))

echo ""
echo "========================================"
echo "RESULT: ${PASSED}/${TOTAL} passed"
echo "========================================"

# Show transcript if available
if [ -n "$RESPONSE" ]; then
    echo "Transcript response: $RESPONSE"
fi

# Cleanup
[ -f "$TTS_FILE" ] && rm -f "$TTS_FILE"

# =============================================================================
# Exit
# =============================================================================
if [ "$FAILED" -eq 0 ]; then
    log "PASS — Voice proxy smoke test successful"
    exit 0
else
    log "FAIL — Voice proxy smoke test failed"
    exit 1
fi
