#!/usr/bin/env bash
# SPEC-047 T403 — Smoke: ai-gateway OpenAI-compat (chat, models, audio stub)
# Anti-hardcoded: tudo via .env
set -euo pipefail

set -a; source "${ENV_FILE:-/srv/monorepo/.env}"; set +a

BASE="${AI_GATEWAY_BASE_URL:-http://localhost:${AI_GATEWAY_PORT:-4002}}"
KEY="${AI_GATEWAY_FACADE_KEY:-}"
PASS=0; FAIL=0

ok()  { echo "[ OK ] $*"; PASS=$((PASS+1)); }
bad() { echo "[FAIL] $*"; FAIL=$((FAIL+1)); }
chk() {
  local label="$1" url="$2" expect="${3:-200}"
  local args=(-sS -o /dev/null -w "%{http_code}" --max-time 8)
  [[ -n "$KEY" ]] && args+=(-H "Authorization: Bearer ${KEY}")
  local code; code=$(curl "${args[@]}" "$url" 2>/dev/null || echo 000)
  [[ "$code" == "$expect" ]] && ok "$label ($code)" || bad "$label (got $code, want $expect)"
}

# Health — no auth
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "${BASE}/health" || echo 000)
[[ "$code" == "200" ]] && ok "/health 200" || bad "/health got $code"

# Models list
chk "GET /v1/models" "${BASE}/v1/models"

# Unauth → 401
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 "${BASE}/v1/models" || echo 000)
[[ "$code" == "401" ]] && ok "unauth → 401" || bad "unauth → expected 401, got $code"

# Chat completions — only if gateway is running (skip gracefully if 502 upstream)
body='{"model":"gpt-4o","messages":[{"role":"user","content":"responde apenas: ok"}]}'
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d "$body" "${BASE}/v1/chat/completions" || echo 000)
case "$code" in
  200) ok "POST /v1/chat/completions 200 (LiteLLM live)" ;;
  502) echo "[WARN] POST /v1/chat/completions 502 — LiteLLM unreachable (gateway ok)" ;;
  401) bad "POST /v1/chat/completions 401 — auth rejected" ;;
  *)   bad "POST /v1/chat/completions unexpected: $code" ;;
esac

# Bad request → 400
bad_body='{"model":"gpt-4o","messages":[]}'
code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 5 \
  -H "Authorization: Bearer ${KEY}" \
  -H "Content-Type: application/json" \
  -d "$bad_body" "${BASE}/v1/chat/completions" || echo 000)
[[ "$code" == "400" ]] && ok "empty messages → 400" || bad "empty messages → expected 400, got $code"

echo
echo "summary: $PASS ok, $FAIL fail"
exit $(( FAIL > 0 ? 1 : 0 ))
