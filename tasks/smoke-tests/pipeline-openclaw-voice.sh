#!/bin/bash
# OpenClaw Voice Pipeline Smoke Test
# Does NOT use set -e — must complete all tests even if some fail

# =============================================================================
# Infisical — fetch secrets from vault (falls back to env vars)
# =============================================================================
INFISICAL_TOKEN="${INFISICAL_TOKEN:-}"
if [ -z "$INFISICAL_TOKEN" ] && [ -f /srv/ops/secrets/infisical.service-token ]; then
    INFISICAL_TOKEN=$(cat /srv/ops/secrets/infisical.service-token 2>/dev/null | tr -d '\n')
fi

fetch_secret() {
    python3 -c "
import sys
from infisical_sdk import InfisicalSDKClient
import os
token = os.environ.get('INFISICAL_TOKEN', '')
if not token and os.path.exists('/srv/ops/secrets/infisical.service-token'):
    token = open('/srv/ops/secrets/infisical.service-token').read().strip()
client = InfisicalSDKClient(host='http://127.0.0.1:8200', token=token)
secrets = client.secrets.list_secrets(
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == '$1':
        print(s.secret_value, end='')
        break
" 2>/dev/null
}

# =============================================================================
# Config (env or Infisical)
# =============================================================================
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TEST_CHAT_ID="${TEST_CHAT_ID:-}"
OPENCLAW_CONTAINER_NAME="${OPENCLAW_CONTAINER_NAME:-openclaw-qgtzrmi6771lt8l7x8rqx72f}"
OPENCLAW_FQDN="${OPENCLAW_FQDN:-openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io}"
LITELLM_URL="${LITELLM_URL:-http://localhost:4000}"

# LITELLM_KEY — env var takes precedence, else try Infisical
if [ -z "${LITELLM_KEY:-}" ]; then
    LITELLM_KEY=$(fetch_secret "LITELLM_MASTER_KEY")
fi
if [ -z "$LITELLM_KEY" ]; then
    echo "ERROR: LITELLM_KEY not set and not found in Infisical" >&2
    echo "Set LITELLM_KEY env var or add LITELLM_MASTER_KEY to Infisical vault (project e42657ef)" >&2
    exit 1
fi

# MINIMAX_API_KEY — env var takes precedence, else try Infisical
if [ -z "${MINIMAX_API_KEY:-}" ]; then
    MINIMAX_API_KEY=$(fetch_secret "MINIMAX_API_KEY")
fi
if [ -z "$MINIMAX_API_KEY" ]; then
    echo "ERROR: MINIMAX_API_KEY not set and not found in Infisical" >&2
    echo "Set MINIMAX_API_KEY env var or add MINIMAX_API_KEY to Infisical vault (project e42657ef)" >&2
    exit 1
fi

# =============================================================================
# Helpers — colours
# =============================================================================
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[TEST]${NC} $1"; }
pass() { echo -e "${GREEN}[PASS]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
info() { echo -e "${YELLOW}[INFO]${NC} $1"; }

# =============================================================================
# Helpers — curl with timeout
# =============================================================================
curl_get()  { curl -sf -m 10 "$1" > /dev/null 2>&1; }
curl_code() { local code; code=$(curl -s -m 10 -o /dev/null -w "%{http_code}" "$1" 2>/dev/null); echo "${code:-000}"; }
curl_post() { curl -sf -m 30 -X POST "$1" -H "Authorization: Bearer $2" -H "Content-Type: application/json" -d "$3"; }

# =============================================================================
# Helpers — LiteLLM
# =============================================================================
llm_post() {
    local model="$1"; local prompt="$2"; local max_tokens="${3:-50}"
    local json_payload
    # Use python3 json.dumps to safely embed user-controlled prompt in JSON
    json_payload=$(python3 -c "
import json, sys
model = sys.argv[1]
prompt = sys.argv[2]
max_tokens = int(sys.argv[3])
print(json.dumps({'model': model, 'messages': [{'role': 'user', 'content': prompt}], 'max_tokens': max_tokens}))
" "$model" "$prompt" "$max_tokens" 2>/dev/null)
    curl_post "$LITELLM_URL/v1/chat/completions" "$LITELLM_KEY" "$json_payload"
}

tts_synthesize() {
    local voice="$1"; local text="$2"; local out="$3"
    local code
    local json_payload
    # Use python3 json.dumps to safely embed user-controlled text in JSON
    json_payload=$(python3 -c "
import json, sys
text = sys.argv[1]
voice = sys.argv[2]
print(json.dumps({'model': 'tts-1', 'input': text, 'voice': voice}))
" "$text" "$voice" 2>/dev/null)
    code=$(curl -s -m 30 -X POST "$LITELLM_URL/v1/audio/speech" \
        -H "Authorization: Bearer $LITELLM_KEY" \
        -H "Content-Type: application/json" \
        -d "$json_payload" \
        -o "$out" -w "%{http_code}")
    [ "$code" = "200" ] && [ -s "$out" ]
}

stt_transcribe() {
    local audio_file="$1"
    curl -sf -m 30 -X POST "$LITELLM_URL/v1/audio/transcriptions" \
        -H "Authorization: Bearer $LITELLM_KEY" \
        -F "file=@$audio_file" \
        -F "model=whisper-1" 2>/dev/null
}

# =============================================================================
# Helpers — JSON extraction (python3 one-liner, avoids jq dep)
# =============================================================================
json_get() { echo "$1" | python3 -c "import sys,json; d=json.load(sys.stdin)$2; print(d if d is not None else '')" 2>/dev/null; }

# =============================================================================
# Helpers — Telegram
# =============================================================================
tg_send() {
    local method="$1"; shift
    local -a args=(-F "chat_id=$TEST_CHAT_ID")
    while [ $# -gt 0 ]; do
        args+=(-F "$1"); shift
    done
    curl -sf -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/$method" "${args[@]}" 2>/dev/null | grep -q '"ok":true'
}

# =============================================================================
# Counters
# =============================================================================
TOTAL=0; PASSED=0; FAILED=0
test_result() {
    TOTAL=$((TOTAL+1))
    if [ $1 -eq 0 ]; then
        PASSED=$((PASSED+1)); pass "$2"
    else
        FAILED=$((FAILED+1)); fail "$2"
    fi
}

# =============================================================================
# Bootstrap
# =============================================================================
echo "========================================"
echo "OpenClaw Voice Pipeline Smoke Test"
echo "Data: $(date '+%d/%m/%Y')"
echo "========================================"
echo ""

# =============================================================================
# 1. Infrastructure Health
# =============================================================================
log "=== 1. Infrastructure Health ==="

# 1.1 OpenClaw container
log "1.1 OpenClaw container..."
docker ps --filter "name=$OPENCLAW_CONTAINER_NAME" --format '{{.Status}}' | grep -q "^Up"
test_result $? "OpenClaw container running"

# 1.2 Traefik proxy health (local)
log "1.2 Traefik proxy (localhost:80)..."
curl_get "http://localhost:80/ping"
test_result $? "Traefik proxy healthy"

# 1.3 OpenClaw FQDN DNS resolution
log "1.3 OpenClaw FQDN DNS..."
nslookup "$OPENCLAW_FQDN" >/dev/null 2>&1
test_result $? "OpenClaw FQDN DNS resolves"

# 1.4 OpenClaw via Cloudflare Tunnel (bot.zappro.site)
log "1.4 OpenClaw via Cloudflare Tunnel..."
# 200 = OpenClaw responding, 401 = routing OK but auth required (both = routing works)
HTTP_CODE=$(curl_code "https://bot.zappro.site/")
case "$HTTP_CODE" in
    200|401) test_result 0 "OpenClaw via bot.zappro.site (HTTP $HTTP_CODE)";;
    *)       test_result 1 "OpenClaw via bot.zappro.site (HTTP $HTTP_CODE)";;
esac

# 1.5 Container network isolation (Traefik ↔ OpenClaw)
log "1.5 Container network isolation..."
openclaw_nets=$(docker inspect "$OPENCLAW_CONTAINER_NAME" --format '{{json .NetworkSettings.Networks}}' 2>/dev/null | \
    python3 -c "import sys,json; nets=json.load(sys.stdin); print(' '.join(nets.keys()))" || echo "")
traefik_nets=$(docker inspect coolify-proxy --format '{{json .NetworkSettings.Networks}}' 2>/dev/null | \
    python3 -c "import sys,json; nets=json.load(sys.stdin); print(' '.join(nets.keys()))" || echo "")

shared_net=""
for net in $traefik_nets; do
    if echo "$openclaw_nets" | grep -q "$net"; then
        shared_net="$net"; break
    fi
done

if [ -n "$shared_net" ]; then
    test_result 0 "Traefik ↔ OpenClaw share network: $shared_net"
else
    info "WARNING: No shared network — Traefik may not reach OpenClaw!"
    info "  Traefik networks: $traefik_nets"
    info "  OpenClaw networks: $openclaw_nets"
    test_result 1 "Traefik ↔ OpenClaw network isolation"
fi

# 1.6 OpenClaw internal /healthz endpoint (inside container)
# Verify /healthz inside container — bypasses host networking stack entirely.
# Container is healthy per docker (1.1), this confirms the actual endpoint works.
log "1.6 OpenClaw container /healthz..."
docker exec "$OPENCLAW_CONTAINER_NAME" curl -sf -m 5 "http://127.0.0.1:8080/healthz" >/dev/null 2>&1
test_result $? "OpenClaw /healthz inside container"

# =============================================================================
# 2. STT — Speech-to-Text
# =============================================================================
log ""; log "=== 2. STT (Speech-to-Text) ==="

# 2.1 wav2vec2 health
log "2.1 wav2vec2 STT health..."
curl_get "http://localhost:8201/health"
test_result $? "wav2vec2 STT :8201"

# 2.2 wav2vec2 direct transcription
log "2.2 wav2vec2 transcription..."
AUDIO_FILE="/tmp/test_tts.wav"
if [ -s "$AUDIO_FILE" ]; then
    RESULT=$(curl -sf -m 30 -X POST "http://localhost:8201/v1/audio/transcriptions" \
        -F "file=@$AUDIO_FILE" 2>/dev/null)
    TEXT=$(json_get "$RESULT" ".get('text','')")
    [ -n "$TEXT" ]
    test_result $? "wav2vec2 transcription: '$TEXT'"
else
    info "2.2 Skipped — no test audio at $AUDIO_FILE"
fi

# 2.3 STT via LiteLLM (whisper-1 → wav2vec2 container)
log "2.3 STT via LiteLLM..."
if [ -s "$AUDIO_FILE" ]; then
    RESP=$(stt_transcribe "$AUDIO_FILE")
    echo "$RESP" | grep -q "text"
    test_result $? "STT via LiteLLM (whisper-1)"
else
    info "2.3 Skipped — no test audio"
fi

# =============================================================================
# 3. TTS — Text-to-Speech
# =============================================================================
log ""; log "=== 3. TTS (Text-to-Speech) ==="

# 3.1 Kokoro TTS male (pm_santa)
log "3.1 Kokoro TTS (pm_santa)..."
tts_synthesize "pm_santa" "Smoke test successful" "/tmp/smoke_tts.mp3"
test_result $? "Kokoro TTS synthesis (pm_santa)"

# 3.2 Kokoro TTS female (pf_dora)
log "3.2 Kokoro TTS (pf_dora)..."
tts_synthesize "pf_dora" "Smoke test female voice" "/tmp/smoke_tts_female.mp3"
test_result $? "Kokoro TTS (pf_dora female)"

# =============================================================================
# 4. Vision
# =============================================================================
log ""; log "=== 4. Vision ==="

# 4.1 Vision — qwen2.5-vl text-only probe
log "4.1 Vision qwen2.5-vl..."
RESP=$(llm_post "qwen2.5-vl" "Say only: OK" 10)
echo "$RESP" | grep -q "OK"
test_result $? "Vision qwen2.5-vl responding"

# 4.2 Vision — with image (base64)
log "4.2 Vision with image..."
IMG_FILE="/tmp/smoke_img.jpg"
if [ -s "$IMG_FILE" ]; then
    # Safely generate JSON payload — Python reads file directly, avoids shell injection
    PAYLOAD=$(IMG_PATH="$IMG_FILE" python3 -c "
import json, base64, os
with open(os.environ['IMG_PATH'], 'rb') as f:
    img_b64 = base64.b64encode(f.read()).decode()
d = {'model': 'qwen2.5-vl', 'messages': [{'role': 'user', 'content': [{'type': 'text', 'text': 'Describe this image in one word.'}, {'type': 'image_url', 'image_url': {'url': 'data:image/jpeg;base64,' + img_b64}}]}], 'max_tokens': 20}
print(json.dumps(d))
")
    RESP=$(curl -s -m 30 -X POST "$LITELLM_URL/v1/chat/completions" \
        -H "Authorization: Bearer $LITELLM_KEY" \
        -H "Content-Type: application/json" \
        -d "$PAYLOAD")
    echo "$RESP" | grep -q "choices"
    test_result $? "Vision qwen2.5-vl with image (base64)"
else
    info "4.2 Skipped — no test image at $IMG_FILE"
fi

# =============================================================================
# 5. LLM
# =============================================================================
log ""; log "=== 5. LLM ==="

# 5.1 Tom Cat 8B PT-BR via LiteLLM
log "5.1 Tom Cat 8B PT-BR..."
RESP=$(llm_post "tom-cat-8b" "Olá, como você está? Responda em uma palavra." 50)
if echo "$RESP" | grep -q "choices"; then
    TEXT=$(json_get "$RESP" "['choices'][0]['message']['content'][:50]")
    test_result 0 "Tom Cat 8B: $TEXT"
else
    test_result 1 "Tom Cat 8B failed"
fi

# 5.2 MiniMax M2.1 direct API
log "5.2 MiniMax M2.1..."
RESP=$(curl -s -m 15 -X POST "https://api.minimax.io/anthropic/v1/messages" \
    -H "Authorization: Bearer $MINIMAX_API_KEY" \
    -H "Content-Type: application/json" \
    -H "anthropic-version: 2023-06-01" \
    -d '{"model":"MiniMax-M2.1","messages":[{"role":"user","content":"Hi"}],"max_tokens":10}' 2>/dev/null)
echo "$RESP" | grep -q "type"
test_result $? "MiniMax M2.1 API"

# =============================================================================
# 6. Telegram E2E (optional — requires TEST_CHAT_ID)
# =============================================================================
if [ -n "$TEST_CHAT_ID" ] && [ -n "$TELEGRAM_BOT_TOKEN" ]; then
    log ""; log "=== 6. Telegram E2E ==="

    log "6.1 Send voice message..."
    [ -s "/tmp/smoke_tts.mp3" ] && tg_send "sendVoice" "voice=@/tmp/smoke_tts.mp3" "caption=Voice test from smoke test"
    test_result $? "Telegram send voice"

    log "6.2 Send photo..."
    tg_send "sendPhoto" "photo=https://picsum.photos/200" "caption=Vision test"
    test_result $? "Telegram send photo"

    log "6.3 Send text message..."
    tg_send "sendMessage" "text=Smoke test message from CLI"
    test_result $? "Telegram send message"
else
    info ""
    info "Telegram E2E skipped — TEST_CHAT_ID not set"
fi

# =============================================================================
# Summary
# =============================================================================
log ""
echo "========================================"
echo "SUMMARY"
echo "========================================"
echo -e "Total:   $TOTAL"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"; exit 0
else
    echo -e "${RED}Some tests failed!${NC}"; exit 1
fi
