#!/usr/bin/env bash
# smoke-hermes-local-voice.sh
# Validates 100% local STT + TTS + Vision for Hermes via Telegram
# Usage: bash smoke-hermes-local-voice.sh

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0

report() { echo -e "${2}${1}${NC}"; [[ "$3" == "PASS" ]] && ((++PASS)) || ((++FAIL)); }

echo "=== Hermes Local Voice Pipeline Smoke Tests ==="
echo ""

# ─── Create shared test WAV ───
TEST_WAV="/tmp/hermes_smoke_test.wav"
python3 -c "
import wave, struct
w = wave.open('$TEST_WAV', 'wb')
w.setnchannels(1); w.setsampwidth(2); w.setframerate(16000)
w.writeframes(struct.pack('<' + 'h' * 16000, *([0] * 16000)))
w.close()
" 2>/dev/null

GW_KEY="b361f14412042cc92710591923feffd5c3af32fc5ecc23a6402dbf953aed39ee"

# ─── STT: faster-whisper :8204 ───
echo "STT: faster-whisper :8204"
if curl -sf http://localhost:8204/health 2>/dev/null | grep -q "ok"; then
  report "  :8204/health OK" GREEN PASS
else
  report "  :8204/health FAIL" RED FAIL
fi

if curl -sf http://localhost:8204/v1/models 2>/dev/null | grep -q "whisper-1"; then
  report "  :8204/v1/models OK" GREEN PASS
else
  report "  :8204/v1/models FAIL" RED FAIL
fi

CODE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:8204/v1/audio/transcriptions \
  -F "file=@${TEST_WAV}" \
  -F "model=whisper-1" 2>/dev/null | tail -1)
if [ "$CODE" = "200" ]; then
  report "  :8204 multipart transcription OK" GREEN PASS
else
  report "  :8204 multipart transcription FAIL (HTTP $CODE)" RED FAIL
fi

# ─── TTS: Kokoro :8013 ───
echo ""
echo "TTS: Kokoro :8013"
if curl -sf http://localhost:8013/health 2>/dev/null | grep -q "healthy"; then
  report "  :8013/health OK" GREEN PASS
else
  report "  :8013/health FAIL" RED FAIL
fi

CODE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"test","voice":"pm_santa","response_format":"mp3"}' \
  -o /tmp/tts_test.mp3 2>/dev/null | tail -1)
if [ "$CODE" = "200" ] && [ -s /tmp/tts_test.mp3 ]; then
  report "  :8013 TTS synthesis OK" GREEN PASS
else
  report "  :8013 TTS synthesis FAIL (HTTP $CODE)" RED FAIL
fi

# ─── AI-Gateway: :4002 ───
echo ""
echo "AI-Gateway: :4002"
if curl -sf http://localhost:4002/health 2>/dev/null | grep -q "ai-gateway"; then
  report "  :4002/health OK" GREEN PASS
else
  report "  :4002/health FAIL" RED FAIL
fi

CODE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:4002/v1/audio/transcriptions \
  -H "Authorization: Bearer ${GW_KEY}" \
  -F "file=@${TEST_WAV}" \
  -F "model=whisper-1" 2>/dev/null | tail -1)
if [ "$CODE" = "200" ]; then
  report "  :4002 STT (whisper-1) OK" GREEN PASS
else
  report "  :4002 STT FAIL (HTTP $CODE)" RED FAIL
fi

CODE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:4002/v1/audio/speech \
  -H "Authorization: Bearer ${GW_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"model":"tts-1","input":"test","voice":"pm_santa"}' \
  -o /tmp/tts_agi_test.mp3 2>/dev/null | tail -1)
if [ "$CODE" = "200" ]; then
  report "  :4002 TTS (tts-1) OK" GREEN PASS
else
  report "  :4002 TTS FAIL (HTTP $CODE)" RED FAIL
fi

# ─── Hermes Gateway ───
echo ""
echo "Hermes Gateway: :8642"
if curl -sf http://localhost:8642/health 2>/dev/null | grep -q "ok"; then
  report "  :8642/health OK" GREEN PASS
else
  report "  :8642/health FAIL" RED FAIL
fi

# ─── Ollama ───
echo ""
echo "Ollama: :11434"
if curl -sf http://localhost:11434/api/tags 2>/dev/null | python3 -c "import sys,json; json.load(sys.stdin); print('ok')" 2>/dev/null | grep -q "ok"; then
  report "  :11434/api/tags OK" GREEN PASS
else
  report "  :11434/api/tags FAIL" RED FAIL
fi

MODELS=$(curl -s http://localhost:11434/api/tags 2>/dev/null | python3 -c "
import json,sys
d=json.load(sys.stdin)
for m in d.get('models',[]):
    print(m['name'])
" 2>/dev/null)

if echo "$MODELS" | grep -q "llava-phi3"; then
  report "  llava-phi3 available" GREEN PASS
else
  report "  llava-phi3 NOT available" YELLOW FAIL
fi

if echo "$MODELS" | grep -q "qwen2.5vl"; then
  report "  qwen2.5vl available" GREEN PASS
else
  report "  qwen2.5vl NOT available" YELLOW FAIL
fi

if echo "$MODELS" | grep -q "llama3-portuguese-tomcat-8b"; then
  report "  llama3-portuguese-tomcat-8b available" GREEN PASS
else
  report "  llama3-portuguese-tomcat-8b NOT available" YELLOW FAIL
fi

# ─── Summary ───
echo ""
echo "=== Summary: ${PASS} passed, ${FAIL} failed ==="
rm -f "$TEST_WAV" /tmp/tts_test.mp3 /tmp/tts_agi_test.mp3
if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}All tests passed — STT/TTS 100% local pipeline READY${NC}"
  exit 0
else
  echo -e "${RED}Some tests failed — review output above${NC}"
  exit 1
fi
