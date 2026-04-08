#!/bin/bash
# Smoke test: chat.zappro.site (Open WebUI via Cloudflare Tunnel + Zero Trust Access)
# NOTA: Open WebUI está protegido por Cloudflare Access (Google OAuth).
#       O 200 final após follow-redirect é a página de LOGIN do Access, não do Open WebUI.
#       Smoke test válido = verificar que o túnel está ativo e o Access redireciona corretamente.
# Timeout: 10s por request

set -euo pipefail

SITE="chat.zappro.site"

echo "=== Smoke Test: $SITE ==="
echo ""

# Test 1: HTTP → HTTPS redirect
echo -n "Test 1 - HTTP→HTTPS redirect: "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://$SITE" 2>/dev/null || echo "000")
if [[ "$HTTP_CODE" == "301" || "$HTTP_CODE" == "302" ]]; then
    echo "✅ PASS (HTTP $HTTP_CODE)"
else
    echo "❌ FAIL (HTTP $HTTP_CODE, esperado 301/302)"
    exit 1
fi

# Test 2: HTTPS → Cloudflare Access gate (redirect for authentication)
echo -n "Test 2 - Cloudflare Access gate: "
HTTPS_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://$SITE" 2>/dev/null || echo "000")
if [[ "$HTTPS_CODE" == "301" || "$HTTPS_CODE" == "302" ]]; then
    echo "✅ PASS (HTTP $HTTPS_CODE → Access redirect)"
else
    echo "❌ FAIL (HTTP $HTTPS_CODE, esperado 301/302)"
    exit 1
fi

# Test 3: Verify redirect Location header points to Cloudflare Access
echo -n "Test 3 - Redirect para Cloudflare Access: "
LOCATION=$(curl -s -o /dev/null -w "%{redirect_url}" --max-time 10 "https://$SITE" 2>/dev/null || echo "")
if echo "$LOCATION" | grep -qi "cloudflareaccess\|zappro.cloudflareaccess"; then
    echo "✅ PASS (Location: $LOCATION)"
else
    echo "❌ FAIL (Location inesperado: $LOCATION)"
    exit 1
fi

# Test 4: SSL/TLS certificate valid
echo -n "Test 4 - SSL/TLS certificate: "
SSL_RESULT=$(curl -s -o /dev/null -w "%{ssl_verify_result}" --max-time 10 "https://$SITE" 2>/dev/null || echo "1")
if [ "$SSL_RESULT" = "0" ]; then
    echo "✅ PASS (SSL válido)"
else
    echo "❌ FAIL (SSL verification failed: $SSL_RESULT)"
    exit 1
fi

# Test 5: Verify Cloudflare Access login page (after following redirect)
echo -n "Test 5 - Cloudflare Access login page: "
RESPONSE=$(curl -s --max-time 10 -L "https://$SITE" 2>/dev/null || true)
if echo "$RESPONSE" | grep -qi "Sign in"; then
    echo "✅ PASS (Access login page renderizada)"
else
    echo "❌ FAIL (Expected Access login page)"
    exit 1
fi

echo ""
echo "✅ Todos os smoke tests passaram para https://$SITE"
echo "   Túnel ativo, Cloudflare Access redirecionando corretamente."
echo ""
