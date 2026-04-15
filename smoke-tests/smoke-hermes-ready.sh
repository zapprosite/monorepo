#!/usr/bin/env bash
# Smoke: hermes-agent /health + /ready + rate-limit headers (SPEC-047 T554)
# Anti-hardcoded: tudo via .env
set -euo pipefail

set -a; source "${ENV_FILE:-/srv/monorepo/.env}"; set +a

URL="${HERMES_GATEWAY_URL:-http://127.0.0.1:8642}"
PUBLIC="${HERMES_PUBLIC_URL:-https://hermes.zappro.site}"
PASS=0; FAIL=0
ok()  { echo "[ OK ] $*"; PASS=$((PASS+1)); }
bad() { echo "[FAIL] $*"; FAIL=$((FAIL+1)); }

# /health local
body=$(curl -fsS --max-time 5 "${URL%/}/health" 2>/dev/null || echo "")
if [[ "$body" == *'"status": "ok"'* || "$body" == *'"status":"ok"'* ]]; then
  ok "local /health 200 ($body)"
else
  bad "local /health unreachable or bad body: $body"
fi

# /ready (opcional — se implementado)
rcode=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "${URL%/}/ready" || echo 000)
case "$rcode" in
  200) ok "local /ready 200 (downstream healthy)" ;;
  404) echo "[WARN] /ready not implemented yet (T551)" ;;
  503) bad "local /ready 503 — downstream unhealthy (LiteLLM/TTS/STT)" ;;
  *)   bad "local /ready unexpected code: $rcode" ;;
esac

# Public edge (Cloudflare tunnel + nginx rate-limit)
hdrs=$(curl -sSI --max-time 8 "${PUBLIC%/}/health" 2>/dev/null || echo "")
if [[ "$hdrs" == *"HTTP/"*"200"* ]]; then
  ok "public /health via CF+nginx 200"
  [[ "$hdrs" =~ [Xx]-[Rr]ate[Ll]imit ]] && ok "rate-limit headers present" || echo "[WARN] no rate-limit headers"
elif [[ -z "$hdrs" ]]; then
  echo "[WARN] public URL unreachable (tunnel down?) — skipping edge tests"
else
  bad "public /health: $(echo "$hdrs" | head -1)"
fi

echo
echo "summary: $PASS ok, $FAIL fail"
exit $(( FAIL > 0 ? 1 : 0 ))
