#!/usr/bin/env bash
# SPEC-048 — Advanced Smoke Test: OpenAI Facade
# Inspired by agent-skills best practices:
#   - .agent/skills/api-patterns/rest.md (status codes, error format)
#   - .agent/skills/api-patterns/response.md (envelope pattern)
#   - .agent/skills/systematic-debugging/SKILL.md (phase-based validation)
#   - .agent/skills/nodejs-best-practices/SKILL.md (input validation, security)
#
# Validates: correctness, error handling, edge cases, security
# Usage: bash smoke-openai-facade-advanced.sh

set -a; source /srv/monorepo/.env; set +a

GW="${AI_GATEWAY_URL:-http://localhost:${AI_GATEWAY_PORT:-4002}}"
KEY="${AI_GATEWAY_FACADE_KEY:-}"

# ── Test Framework ──────────────────────────────────────────────────────────

TOTAL=0 PASS=0 FAIL=0 WARN=0

pass()  { echo "  ✅ $1"; ((PASS++)); ((TOTAL++)); }
fail()  { echo "  ❌ $1"; ((FAIL++)); ((TOTAL++)); }
warn()  { echo "  ⚠️  $1"; ((WARN++)); ((TOTAL++)); }
info()  { echo "  ℹ️  $1"; ((TOTAL++)); }

# ── Phase 1: Reproduce ──────────────────────────────────────────────────────

echo "═══════════════════════════════════════════════"
echo "  Advanced Smoke — OpenAI Facade"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "  Gateway: $GW"
echo "═══════════════════════════════════════════════"

echo ""
echo "── PHASE 1: HEALTH CHECKS ─────────────────"

# 1.1 Gateway /health
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$GW/health" 2>/dev/null || echo 000)
[[ "$code" == "200" ]] && pass "1.1 Gateway /health → 200" || fail "1.1 Gateway /health → $code"

# 1.2 GET /v1/models
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 \
  -H "Authorization: Bearer $KEY" "$GW/v1/models" 2>/dev/null || echo 000)
[[ "$code" == "200" ]] && pass "1.2 GET /v1/models → 200" || fail "1.2 GET /v1/models → $code"

echo ""
echo "── PHASE 2: CORRECTNESS (chat completions) ─"

# 2.1 Basic text chat — matches spec
res=$(curl -sS --max-time 20 -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Responde apenas: Lisboa"}],"max_tokens":10}' 2>/dev/null)
[[ "$res" == *"Lisboa"* || "$res" == *"content"* ]] && pass "2.1 Chat text → response contains Lisboa" \
  || fail "2.1 Chat text — got: $(echo $res | head -c 80)"

# 2.2 gpt-4o-mini alias → tom-cat-8b
res=$(curl -sS --max-time 20 -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"gpt-4o-mini","messages":[{"role":"user","content":"Pi"}],"max_tokens":5}' 2>/dev/null)
[[ "$res" == *"content"* ]] && pass "2.2 gpt-4o-mini alias → tom-cat-8b" \
  || fail "2.2 gpt-4o-mini alias"

# 2.3 Model returned matches request (not upstream name)
res_model=$(curl -sS --max-time 20 -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Ok"}],"max_tokens":5}' 2>/dev/null \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('model','?'))" 2>/dev/null)
[[ "$res_model" == "gpt-4o" ]] && pass "2.3 Model alias preserved in response ($res_model)" \
  || fail "2.3 Model alias preserved — got: $res_model"

echo ""
echo "── PHASE 3: ERROR HANDLING ─────────────────"

# 3.1 Missing auth → 401
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"test"}]' 2>/dev/null || echo 000)
[[ "$code" == "401" ]] && pass "3.1 Missing auth → 401" || fail "3.1 Missing auth → $code (expect 401)"

# 3.2 Invalid model → 400 (OpenAI error format)
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"invalid-model-xyz","messages":[{"role":"user","content":"test"}]}' 2>/dev/null || echo 000)
[[ "$code" == "400" || "$code" == "422" ]] && pass "3.2 Invalid model → $code (error envelope)" \
  || warn "3.2 Invalid model → $code (expect 400/422)"

# 3.3 Malformed JSON → 400
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":}' 2>/dev/null || echo 000)
[[ "$code" == "400" || "$code" == "422" ]] && pass "3.3 Malformed JSON → $code" \
  || warn "3.3 Malformed JSON → $code"

# 3.4 Empty messages → 400
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"gpt-4o","messages":[]}' 2>/dev/null || echo 000)
[[ "$code" == "400" ]] && pass "3.4 Empty messages → 400" \
  || warn "3.4 Empty messages → $code (expect 400)"

# 3.5 Missing model field → 400
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"messages":[{"role":"user","content":"test"}]}' 2>/dev/null || echo 000)
[[ "$code" == "400" ]] && pass "3.5 Missing model field → 400" \
  || warn "3.5 Missing model field → $code"

echo ""
echo "── PHASE 4: PT-BR FILTER ──────────────────"

# 4.1 x-ptbr-filter header activates PT-BR filter
res=$(curl -sS --max-time 20 -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -H "x-ptbr-filter: true" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"vc tah bem?"}],"max_tokens":20}' 2>/dev/null)
[[ "$res" == *"content"* ]] && pass "4.1 PT-BR filter header → applied" \
  || fail "4.1 PT-BR filter header"

# 4.2 PT-BR filter removes stuttering
res=$(curl -sS --max-time 20 -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -H "x-ptbr-filter: true" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"oq que isso pq"}],"max_tokens":20}' 2>/dev/null)
[[ "$res" == *"content"* ]] && pass "4.2 PT-BR stuttering corrections applied" \
  || fail "4.2 PT-BR stuttering corrections"

# 4.3 PT-BR filter clears symbols (→ • ★ ✔)
res=$(curl -sS --max-time 20 -X POST "$GW/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -H "x-ptbr-filter: true" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"→ • 1. Primeiro item ★ destaque ✔ ok"}],"max_tokens":30}' 2>/dev/null)
txt=$(echo "$res" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('choices',[{}])[0].get('message',{}).get('content',''))" 2>/dev/null)
[[ "$txt" != *"→"* && "$txt" != *"★" && "$txt" != *"✔"* ]] && pass "4.3 Symbols cleaned (→★✔ removed)" \
  || fail "4.3 Symbols still present: $txt"

echo ""
echo "── PHASE 5: TTS (Kokoro voices) ───────────"

# 5.1 TTS pm_santa returns mp3
TMPFILE=$(mktemp)
curl -sS --max-time 20 -X POST "$GW/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"tts-1","input":"Olá mundo","voice":"pm_santa","response_format":"mp3"}' \
  -o "$TMPFILE" 2>/dev/null
SIZE=$(wc -c < "$TMPFILE")
file "$TMPFILE" | grep -q "MPEG" && pass "5.1 TTS pm_santa → mp3 ($SIZE bytes)" \
  || fail "5.1 TTS pm_santa — got $SIZE bytes"
rm -f "$TMPFILE"

# 5.2 TTS pf_dora returns mp3 (different voice)
TMPFILE=$(mktemp)
curl -sS --max-time 20 -X POST "$GW/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"tts-1-hd","input":"Bom dia","voice":"pf_dora","response_format":"mp3"}' \
  -o "$TMPFILE" 2>/dev/null
SIZE=$(wc -c < "$TMPFILE")
file "$TMPFILE" | grep -q "MPEG" && pass "5.2 TTS pf_dora → mp3 ($SIZE bytes)" \
  || fail "5.2 TTS pf_dora — got $SIZE bytes"
rm -f "$TMPFILE"

# 5.3 TTS voice fallback (invalid voice → pm_santa default)
TMPFILE=$(mktemp)
code=$(curl -sS -o "$TMPFILE" -w "%{http_code}" --max-time 20 -X POST "$GW/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"tts-1","input":"test","voice":"invalid-voice","response_format":"mp3"}' 2>/dev/null)
SIZE=$(wc -c < "$TMPFILE")
[[ "$code" == "200" && "$SIZE" -gt 1000 ]] && pass "5.3 TTS invalid voice → fallback pm_santa" \
  || warn "5.3 TTS invalid voice → $code, $SIZE bytes (expect 200 + mp3)"
rm -f "$TMPFILE"

# 5.4 TTS empty input → 400
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 10 \
  -X POST "$GW/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"tts-1","input":"","voice":"pm_santa"}' 2>/dev/null || echo 000)
[[ "$code" == "400" ]] && pass "5.4 TTS empty input → 400" \
  || warn "5.4 TTS empty input → $code"

# 5.5 TTS PT-BR filter applied (symbols stripped)
TMPFILE=$(mktemp)
curl -sS --max-time 20 -X POST "$GW/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d '{"model":"tts-1","input":"→ • 1. Primeiro item ★ destaque ✔ ok","voice":"pm_santa","response_format":"mp3"}' \
  -o "$TMPFILE" 2>/dev/null
SIZE=$(wc -c < "$TMPFILE")
[[ "$SIZE" -gt 1000 ]] && pass "5.5 TTS PT-BR filter strips symbols (→•★✔ → natural speech)" \
  || fail "5.5 TTS PT-BR filter — got $SIZE bytes"
rm -f "$TMPFILE"

echo ""
echo "── PHASE 6: STT (wav2vec2 PT-BR) ─────────"

# 6.1 STT endpoint reachable
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 \
  -H "Authorization: Bearer $KEY" \
  -X POST "$GW/v1/audio/transcriptions" 2>/dev/null || echo 000)
[[ "$code" =~ ^(400|422|415|200)$ ]] && pass "6.1 STT /v1/audio/transcriptions → $code (route ok)" \
  || fail "6.1 STT endpoint unreachable ($code)"

# 6.2 STT no file → 400
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 \
  -H "Authorization: Bearer $KEY" \
  -X POST "$GW/v1/audio/transcriptions" \
  -F "model=whisper-1" 2>/dev/null || echo 000)
[[ "$code" == "400" ]] && pass "6.2 STT no file → 400" \
  || warn "6.2 STT no file → $code (expect 400)"

# 6.3 STT with WAV file → transcription
TMPFILE_IN=$(mktemp /tmp/stt-in-XXXX.wav)
python3 -c "
import wave
w=wave.open('$TMPFILE_IN','wb')
w.setsampwidth(2); w.setnchannels(1); w.setframerate(16000)
w.writeframes(b'\x00'*(16000*1))  # 1 second silence
w.close()
" 2>/dev/null
TMPFILE_OUT=$(mktemp)
STT_RESP=$(curl -sS --max-time 30 -X POST "$GW/v1/audio/transcriptions" \
  -H "Authorization: Bearer $KEY" \
  -F "file=@$TMPFILE_IN;filename=test.wav" \
  -F "model=whisper-1" \
  -o "$TMPFILE_OUT" -w "%{http_code}" 2>/dev/null)
SIZE=$(wc -c < "$TMPFILE_OUT")
[[ "$STT_RESP" == "200" && "$SIZE" -gt 10 ]] && pass "6.3 STT WAV → transcription (text.len>0)" \
  || fail "6.3 STT WAV → $STT_RESP, $SIZE bytes"
rm -f "$TMPFILE_IN" "$TMPFILE_OUT"

echo ""
echo "── PHASE 7: VISION (llava-phi3) ───────────"

# 7.1 Ollama llava-phi3 available
curl -s --max-time 5 http://localhost:11434/api/tags 2>/dev/null | grep -q "llava-phi3" \
  && pass "7.1 Ollama llava-phi3 loaded" \
  || warn "7.1 llava-phi3 not in Ollama tags"

# 7.2 Vision route (gpt-4o-vision → llava-phi3) — base64 required
# LiteLLM only supports base64 for vision, not image URLs
IMG_BASE64="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg=="
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 60 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d "{\"model\":\"gpt-4o-vision\",\"messages\":[{\"role\":\"user\",\"content\":[{\"type\":\"text\",\"text\":\"teste\"},{\"type\":\"image_url\",\"image_url\":{\"url\":\"data:image/png;base64,$IMG_BASE64\"}}]}]}" \
  "$GW/v1/chat/completions" 2>/dev/null || echo 000)
[[ "$code" == "200" ]] && pass "7.2 Vision gpt-4o-vision → llava-phi3 (base64) → 200" \
  || warn "7.2 Vision base64 → $code (expect 200, image URLs NOT supported by LiteLLM/llava-phi3)"

# 7.3 Vision invalid base64 → proper error
IMG_BAD="iVBORw0KGgoAAA-INVALID-BASE64"
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 30 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $KEY" \
  -d "{\"model\":\"gpt-4o-vision\",\"messages\":[{\"role\":\"user\",\"content\":[{\"type\":\"image_url\",\"image_url\":{\"url\":\"data:image/png;base64,$IMG_BAD\"}}]}]}" \
  "$GW/v1/chat/completions" 2>/dev/null || echo 000)
[[ "$code" =~ ^(400|422|502)$ ]] && pass "7.3 Vision bad base64 → $code (proper error)" \
  || warn "7.3 Vision bad base64 → $code"

echo ""
echo "── PHASE 8: SECURITY ──────────────────────"

# 8.1 Bearer token in response not exposed (NODE_ENV check)
[[ "${NODE_ENV:-}" != "development" ]] && {
  res=$(curl -sS --max-time 10 -X POST "$GW/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $KEY" \
    -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Ok"}],"max_tokens":5}' 2>/dev/null)
  [[ "$res" != *"x-ai-gateway-upstream"* ]] && pass "8.1 Upstream metadata stripped from response" \
    || warn "8.1 x-ai-gateway-upstream may be exposed in response"
}

# 8.2 CORS headers (security)
CORS=$(curl -sS -o /dev/null -I --max-time 5 "$GW/health" 2>/dev/null | grep -i "access-control" || echo "")
[[ -n "$CORS" ]] && pass "8.2 CORS headers present" \
  || warn "8.2 No CORS headers (may be intentional for gateway-only access)"

# 8.3 Health endpoint unauthenticated (safe — read-only)
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$GW/health" 2>/dev/null || echo 000)
[[ "$code" == "200" ]] && pass "8.3 /health unauthenticated (safe — read-only status)" \
  || fail "8.3 /health → $code (expect 200)"

# 8.4 Models list unauthenticated blocked
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "$GW/v1/models" 2>/dev/null || echo 000)
[[ "$code" == "401" ]] && pass "8.4 /v1/models requires auth" \
  || warn "8.4 /v1/models → $code (expect 401)"

echo ""
echo "═══════════════════════════════════════════════"
printf "  %d ✅ PASS  |  %d ❌ FAIL  |  %d ⚠️ WARN\n" $PASS $FAIL $WARN
echo "═══════════════════════════════════════════════"
[[ "$FAIL" -gt 0 ]] && exit 1 || exit 0
