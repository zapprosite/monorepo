#!/bin/bash
# Voice Pipeline E2E Telegram — Lightweight Test
# Send voice pipeline status to Telegram — executes in ~15s
# Does NOT use set -e — must complete all steps

# =============================================================================
# Config
# =============================================================================
TELEGRAM_BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
TEST_CHAT_ID="${TEST_CHAT_ID:-7220607041}"
OPENCLAW_FQDN="${OPENCLAW_FQDN:-openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io}"
TTS_BRIDGE_URL="${TTS_BRIDGE_URL:-http://localhost:8013}"
WAV2VEC2_URL="${WAV2VEC2_URL:-http://localhost:8203}"

# =============================================================================
# Infisical — fetch secrets
# =============================================================================
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
    if s.secret_key == sys.argv[1]:
        print(s.secret_value, end='')
        break
" "$1" 2>/dev/null
}

# Env takes precedence
if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    TELEGRAM_BOT_TOKEN=$(fetch_secret "TELEGRAM_BOT_TOKEN")
fi

# =============================================================================
# Helpers
# =============================================================================
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()  { echo -e "${BLUE}[E2E]${NC} $(date '+%H:%M:%S') $1"; }

curl_get()  { curl -sf -m 10 "$1" > /dev/null 2>&1; }
curl_code() { local code; code=$(curl -s -m 10 -o /dev/null -w "%{http_code}" "$1" 2>/dev/null); echo "${code:-000}"; }

# =============================================================================
# Telegram send
# =============================================================================
tg_send() {
    local text="$1"
    local escaped
    escaped=$(python3 -c "import sys,json; print(json.dumps(sys.argv[1])[1:-1])" "$text" 2>/dev/null)

    curl -sf -m 15 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -F "chat_id=${TEST_CHAT_ID}" \
        -F "text=${escaped}" \
        -F "parse_mode=MarkdownV2" > /dev/null 2>&1
}

tg_voice() {
    local file="$1"; local caption="$2"
    local esc_caption
    esc_caption=$(python3 -c "import sys,json; print(json.dumps(sys.argv[1])[1:-1])" "$caption" 2>/dev/null)

    curl -sf -m 15 -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVoice" \
        -F "chat_id=${TEST_CHAT_ID}" \
        -F "voice=@$file" \
        -F "caption=${esc_caption}" \
        -F "parse_mode=MarkdownV2" > /dev/null 2>&1
}

# =============================================================================
# Bootstrap
# =============================================================================
echo "========================================"
echo "Voice Pipeline E2E Telegram Test"
echo "========================================"

# =============================================================================
# 1. Health Checks (lightweight)
# =============================================================================
log "=== Health Checks ==="

OPENCLAW_HEALTH=false
if curl_get "https://bot.zappro.site/"; then
    OPENCLAW_HEALTH=true
fi

TTS_BRIDGE_HEALTH=false
if curl_get "${TTS_BRIDGE_URL}/health"; then
    TTS_BRIDGE_HEALTH=true
fi

WAV2VEC2_HEALTH=false
if curl_get "${WAV2VEC2_URL}/health"; then
    WAV2VEC2_HEALTH=true
fi

OPENCLAW_STATUS=$([ "$OPENCLAW_HEALTH" = true ] && echo "✅" || echo "❌")
TTS_STATUS=$([ "$TTS_BRIDGE_HEALTH" = true ] && echo "✅" || echo "❌")
WAV_STATUS=$([ "$WAV2VEC2_HEALTH" = true ] && echo "✅" || echo "❌")

# =============================================================================
# 2. TTS Synthesis (pm_santa)
# =============================================================================
log "TTS Synthesis (pm_santa)..."
TTS_FILE="/tmp/e2e_tts.mp3"
TTS_OK=false
if curl -sf -m 30 -X POST "${TTS_BRIDGE_URL}/v1/audio/speech" \
    -H "Content-Type: application/json" \
    -d '{"model":"kokoro","input":"Pipeline do Santos FC operando normalmente. Tudo OK!","voice":"pm_santa"}' \
    -o "$TTS_FILE" -w "%{http_code}" | grep -q "200" && [ -s "$TTS_FILE" ]; then
    TTS_OK=true
fi
TTS_STATUS=$([ "$TTS_OK" = true ] && echo "✅" || echo "❌")

# =============================================================================
# 3. STT Transcription (wav2vec2)
# =============================================================================
log "STT Transcription..."
STT_OK=false
if [ -s "$TTS_FILE" ]; then
    RESULT=$(curl -sf -m 60 -X POST "${WAV2VEC2_URL}/v1/listen?model=nova-3&language=pt-BR" \
        -H "Authorization: Token test" \
        -H "Content-Type: audio/mpeg" \
        --data-binary "@$TTS_FILE" 2>/dev/null)
    if echo "$RESULT" | python3 -c "import sys,json; json.load(sys.stdin); print(True)" 2>/dev/null; then
        TRANSCRIPT=$(echo "$RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['results']['channels'][0]['alternatives'][0]['transcript'])" 2>/dev/null)
        if [ -n "$TRANSCRIPT" ]; then
            STT_OK=true
        fi
    fi
fi
STT_STATUS=$([ "$STT_OK" = true ] && echo "✅" || echo "❌")

# =============================================================================
# Summary
# =============================================================================
TOTAL=4; PASSED=0; FAILED=0
[ "$OPENCLAW_HEALTH" = true ] && PASSED=$((PASSED+1)) || FAILED=$((FAILED+1))
[ "$TTS_OK" = true ] && PASSED=$((PASSED+1)) || FAILED=$((FAILED+1))
[ "$WAV2VEC2_HEALTH" = true ] && PASSED=$((PASSED+1)) || FAILED=$((FAILED+1))
[ "$STT_OK" = true ] && PASSED=$((PASSED+1)) || FAILED=$((FAILED+1))

echo ""
echo "========================================"
echo "RESULT: ${PASSED}/${TOTAL} passed"
echo "========================================"

# =============================================================================
# Telegram Report
# =============================================================================
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TEST_CHAT_ID" ]; then
    log "Sending Telegram report..."

    if [ "$FAILED" -eq 0 ]; then
        MSG="✅ *Voice Pipeline E2E — ALL PASS*
\`$(date '+%Y-%m-%d %H:%M')\`

✅ OpenClaw via Tunnel
✅ TTS Bridge :8013
✅ wav2vec2 STT :8201
✅ STT transcription

*${PASSED}/${TOTAL} tests passed*"
    else
        MSG="🔴 *Voice Pipeline E2E — FAILURES*
\`$(date '+%Y-%m-%d %H:%M')\`

${OPENCLAW_STATUS} OpenClaw via Tunnel
${TTS_STATUS} TTS Bridge :8013
${WAV_STATUS} wav2vec2 STT :8201
${STT_STATUS} STT transcription

*${PASSED}/${TOTAL} tests passed*

Run full smoke test for details:
\`bash tasks/smoke-tests/pipeline-openclaw-voice.sh\`"
    fi

    tg_send "$MSG"

    if [ "$TTS_OK" = true ] && [ -s "$TTS_FILE" ]; then
        log "Sending voice message..."
        tg_voice "$TTS_FILE" "Voice pipeline synthesized and transcribed" 2>/dev/null || log "Voice send failed"
    fi
else
    log "Telegram skipped — no bot token or chat ID"
fi

# =============================================================================
# Exit
# =============================================================================
if [ "$FAILED" -eq 0 ]; then
    exit 0
else
    exit 1
fi
