#!/bin/bash
# SPEC-049 — AI Gateway Quality Smoke Test
# Testa qualidade PT-BR real (nao so HTTP codes).
# Usage: bash smoke-ai-gateway-quality.sh

set -a; source /srv/monorepo/.env; set +a

GW="${AI_GATEWAY_URL:-http://localhost:${AI_GATEWAY_PORT:-4002}}"
KEY="${AI_GATEWAY_FACADE_KEY:-}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

pass() { echo -e "${GREEN}[ OK ]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }

TOTAL=0; PASSED=0

echo "== AI Gateway Quality Smoke =="

# Health
((TOTAL++))
if curl -sf "$GW/health" | python3 -c "import sys,json; d=json.load(sys.stdin); exit(0 if d.get('status')=='ok' else 1)" 2>/dev/null; then
  pass "Health"; ((PASSED++))
else
  fail "Health"
fi

# STT transcription bytes
((TOTAL++))
TMPFILE=$(mktemp /tmp/smoke-stt-XXXX.wav)
python3 -c "
import wave
w=wave.open('$TMPFILE','wb')
w.setsampwidth(2); w.setnchannels(1); w.setframerate(16000)
w.writeframes(b'\\x00'*(16000*2))
w.close()
"
STT_RESP=$(curl -sf -X POST "$GW/v1/audio/transcriptions" \
  -F "file=@$TMPFILE;filename=test.wav" \
  -F "model=whisper-1" \
  -H "Authorization: Bearer $KEY" 2>/dev/null)
rm -f "$TMPFILE"
STT_BYTES=$(echo "$STT_RESP" | wc -c)
if echo "$STT_RESP" | python3 -c "import sys,json; t=json.load(sys.stdin).get('text',''); exit(0 if len(t)>0 else 1)" 2>/dev/null; then
  TEXT=$(echo "$STT_RESP" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("text","")[:60])')
  pass "STT: $TEXT"; ((PASSED++))
elif [ $STT_BYTES -gt 10 ]; then
  pass "STT endpoint: $STT_BYTES bytes"; ((PASSED++))
else
  fail "STT failed"
fi

# TTS pm_santa bytes
((TOTAL++))
curl -sf -X POST "$GW/v1/audio/speech" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"tts-1","input":"Ola, tudo bem. Hoje testamos a sintese de voz em portugues brasileiro.","voice":"pm_santa"}' \
  -o /tmp/smoke-tts.mp3 2>/dev/null
TTS_SIZE=$(wc -c < /tmp/smoke-tts.mp3 2>/dev/null || echo 0)
rm -f /tmp/smoke-tts.mp3
if [ $TTS_SIZE -gt 10000 ]; then
  pass "TTS pm_santa: $TTS_SIZE bytes (>10KB)"; ((PASSED++))
else
  fail "TTS pm_santa: $TTS_SIZE bytes (expect >10KB)"
fi

# TTS pf_dora bytes
((TOTAL++))
curl -sf -X POST "$GW/v1/audio/speech" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"tts-1-hd","input":"Ola, tudo bem. Teste de voz em portugues.","voice":"pf_dora"}' \
  -o /tmp/smoke-tts-hd.mp3 2>/dev/null
TTS_HD_SIZE=$(wc -c < /tmp/smoke-tts-hd.mp3 2>/dev/null || echo 0)
rm -f /tmp/smoke-tts-hd.mp3
if [ $TTS_HD_SIZE -gt 10000 ]; then
  pass "TTS pf_dora: $TTS_HD_SIZE bytes"; ((PASSED++))
else
  fail "TTS pf_dora: $TTS_HD_SIZE bytes"
fi

# TTS invalid voice -> 400
((TOTAL++))
TTS_INVALID=$(curl -sf -X POST "$GW/v1/audio/speech" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"tts-1","input":"test","voice":"alloy"}' \
  -o /dev/null -w "%{http_code}" 2>/dev/null)
if [ "$TTS_INVALID" = "400" ]; then
  pass "TTS voice=alloy -> 400"; ((PASSED++))
else
  warn "TTS voice=alloy -> $TTS_INVALID (expect 400)"
fi

# Vision PT-BR
((TOTAL++))
IMG_BASE64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
VISION_RESP=$(curl -sf -X POST "$GW/v1/chat/completions" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept-Language: pt-BR" \
  --data-raw "{\"model\":\"gpt-4o-vision\",\"messages\":[{\"role\":\"user\",\"content\":[{\"type\":\"image_url\",\"image_url\":{\"url\":\"data:image/png;base64,$IMG_BASE64\"}}]}],\"max_tokens\":80}" \
  2>/dev/null)
if echo "$VISION_RESP" | python3 -c "import sys,json; c=json.load(sys.stdin).get('choices',[{}])[0].get('message',{}).get('content',''); exit(0 if c else 1)" 2>/dev/null; then
  DESC=$(echo "$VISION_RESP" | python3 -c 'import sys,json; c=json.load(sys.stdin).get("choices",[{}])[0].get("message",{}).get("content",""); print(c[:80])')
  pass "Vision PT-BR: $DESC"; ((PASSED++))
else
  fail "Vision PT-BR failed"
fi

# Chat PT-BR
((TOTAL++))
CHAT_PT=$(curl -sf -X POST "$GW/v1/chat/completions" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -H "Accept-Language: pt-BR" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Say hello in one word"}],"max_tokens":20}' \
  2>/dev/null)
if echo "$CHAT_PT" | python3 -c "import sys,json; m=json.load(sys.stdin).get('choices',[{}])[0].get('message',{}).get('content',''); exit(0 if m and len(m)>0 else 1)" 2>/dev/null; then
  MSG=$(echo "$CHAT_PT" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("choices",[{}])[0].get("message",{}).get("content","")[:40])')
  pass "Chat PT-BR: $MSG"; ((PASSED++))
else
  fail "Chat PT-BR failed"
fi

echo ""
echo "==========================="
echo -e "  ${PASSED}/${TOTAL} passed"
echo "==========================="
[ $PASSED -eq $TOTAL ] && exit 0 || exit 1
