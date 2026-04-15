#!/usr/bin/env bash
/**
 * SPEC-048 — Smoke test: texto + visão + TTS + STT via llm.zappro.site
 * Usa AI_GATEWAY_FACADE_KEY do .env
 */

set -a; source /srv/monorepo/.env; set +a

GW_URL="${AI_GATEWAY_URL:-http://localhost:4002}"
GW_KEY="$AI_GATEWAY_FACADE_KEY"
TESTS=0 PASS=0 FAIL=0

pass() { echo "  ✅ $1"; ((PASS++)); ((TESTS++)); }
fail() { echo "  ❌ $1"; ((FAIL++)); ((TESTS++)); }

echo "=== SPEC-048 Smoke: OpenAI Facade ==="
echo "Gateway: $GW_URL"
echo ""

# ── T1: Chat text (gpt-4o) ──────────────────────────────────────────────────
echo "[T1] Chat text (gpt-4o)"
res=$(curl -s --max-time 15 -X POST "$GW_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GW_KEY" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"Olá, como vai você?"}]}')
if echo "$res" | grep -q '"text":"Olá\|content":"Olá\|Olá'; then
  pass "T1"
else
  fail "T1 — response: $(echo "$res" | head -c 100)"
fi

# ── T2: Chat com PT-BR filter header ────────────────────────────────────────
echo "[T2] Chat PT-BR filter (x-ptbr-filter: true)"
res=$(curl -s --max-time 15 -X POST "$GW_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GW_KEY" \
  -H "x-ptbr-filter: true" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"vc tah bem?"}]}')
if echo "$res" | grep -q '"text":\|"content":'; then
  pass "T2"
else
  fail "T2 — response: $(echo "$res" | head -c 100)"
fi

# ── T3: Chat c/ símbolos → PT-BR filter limpa ────────────────────────────────
echo "[T3] PT-BR filter limpa símbolos"
res=$(curl -s --max-time 15 -X POST "$GW_URL/v1/chat/completions" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GW_KEY" \
  -H "x-ptbr-filter: true" \
  -d '{"model":"gpt-4o","messages":[{"role":"user","content":"→ • 1. Primeiro item → • 2. Segundo item"}]}')
txt=$(echo "$res" | grep -o '"text":"[^"]*"\|"content":"[^"]*"' | head -1)
if echo "$txt" | grep -vq '→\|•'; then
  pass "T3 — símbolos removidos"
else
  fail "T3 — símbolos ainda presentes: $txt"
fi

# ── T4: TTS pm_santa (default) ──────────────────────────────────────────────
echo "[T4] TTS pm_santa"
res=$(curl -s --max-time 20 -X POST "$GW_URL/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GW_KEY" \
  -d '{"model":"tts-1","input":"Olá mundo! Este é um teste de voz.","voice":"pm_santa","response_format":"mp3"}')
if [ "${#res}" -gt 1000 ]; then
  pass "T4 — mp3 gerado (${#res} bytes)"
else
  fail "T4 — resposta: $(echo "$res" | head -c 100)"
fi

# ── T5: TTS pf_dora (alta qualidade) ───────────────────────────────────────────
echo "[T5] TTS pf_dora"
res=$(curl -s --max-time 20 -X POST "$GW_URL/v1/audio/speech" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GW_KEY" \
  -d '{"model":"tts-1-hd","input":"Olá mundo! Este é um teste de voz.","voice":"pf_dora","response_format":"mp3"}')
if [ "${#res}" -gt 1000 ]; then
  pass "T5 — mp3 gerado (${#res} bytes)"
else
  fail "T5 — resposta: $(echo "$res" | head -c 100)"
fi

# ── T6: Models list ───────────────────────────────────────────────────────────
echo "[T6] Models list"
res=$(curl -s --max-time 5 "$GW_URL/v1/models" \
  -H "Authorization: Bearer $GW_KEY")
if echo "$res" | grep -q '"gpt-4o"'; then
  pass "T6"
else
  fail "T6 — response: $(echo "$res" | head -c 100)"
fi

# ── Results ───────────────────────────────────────────────────────────────────
echo ""
echo "=== Results: $PASS/$TESTS passed, $FAIL failed ==="
if [ "$FAIL" -gt 0 ]; then exit 1; fi
exit 0
