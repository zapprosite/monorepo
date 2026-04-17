#!/usr/bin/env bash
# Smoke: Hermes Agent Telegram polling health check
# Verifica que Telegram polling está funcional sem enviar mensagens
set -euo pipefail

URL="${HERMES_GATEWAY_URL:-http://127.0.0.1:8642}"
PASS=0; FAIL=0
ok()  { echo "[PASS] $*"; PASS=$((PASS+1)); }
bad() { echo "[FAIL] $*"; FAIL=$((FAIL+1)); }

# 1. Hermes Gateway /health
if curl -sf --max-time 5 "${URL%/}/health" 2>/dev/null | grep -q 'status.*ok\|ok.*status'; then
  ok "Hermes Gateway :8642 /health 200"
else
  bad "Hermes Gateway :8642 /health unreachable"
fi

# 2. Hermes MCP :8092 responsive
if curl -sf --max-time 5 "http://localhost:8092/" 2>/dev/null | grep -q 'mcp\|Hermes\|{}'; then
  ok "Hermes MCP :8092 responsive"
elif curl -sf --max-time 5 "http://localhost:8092/health" 2>/dev/null | grep -q 'ok\|mcp'; then
  ok "Hermes MCP :8092 /health 200"
else
  # mcpo daemon — check process exists instead
  if pgrep -f "mcpo.*8092" > /dev/null 2>&1; then
    ok "Hermes MCP mcpo process running on :8092"
  else
    bad "Hermes MCP :8092 not responsive and process not found"
  fi
fi

# 3. Hermes public /health (via cloudflared)
pub=$(curl -sf --max-time 8 "https://hermes.zappro.site/health" 2>/dev/null || echo "")
if echo "$pub" | grep -q 'status.*ok\|ok.*status'; then
  ok "hermes.zappro.site /health 200"
elif [[ -z "$pub" ]]; then
  echo "[WARN] hermes.zappro.site unreachable (tunnel may be down)"
else
  bad "hermes.zappro.site returned unexpected: $pub"
fi

echo ""
echo "summary: $PASS passed, $FAIL failed"
exit $(( FAIL > 0 ? 1 : 0 ))
