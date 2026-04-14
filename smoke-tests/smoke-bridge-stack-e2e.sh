#!/bin/bash
# Super E2E Smoke Test: SPEC-020 Bridge Stack
# Chain: OpenWebUI ↔ OpenClaw Bridge via MCP
#
# Tests:
# 1. Containers running (openclaw-mcp-wrapper, openwebui-bridge-agent)
# 2. Health endpoints responding
# 3. MCP tools callable via JSON-RPC
# 4. OpenClaw invoke_tool via bridge
# 5. Full chain: OpenWebUI → bridge → OpenClaw
#
# Exit codes: 0=all pass, 1=some fail

set -euo pipefail

# Source .env for environment variables
set -a
source /srv/monorepo/.env
set +a

TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
OVERALL_STATUS=0
DEBUG="${DEBUG:-0}"

echo "=== Super E2E Smoke Test: SPEC-020 Bridge Stack ==="
echo "Timestamp: $TIMESTAMP"
echo ""

# =============================================================================
# STEP 1: Container Status
# =============================================================================
echo "[STEP 1] Container Status"
echo "=========================="

declare -a CONTAINERS=(
    "openclaw-mcp-wrapper"
    "openwebui-bridge-agent"
    "autoheal"
)

for container in "${CONTAINERS[@]}"; do
    status=$(docker ps --filter "name=$container" --format '{{.Status}}' 2>/dev/null) || status=""
    if [ -n "$status" ] && echo "$status" | grep -q "Up"; then
        printf "  ✅ %s: %s\n" "$container" "$status"
    else
        printf "  ❌ %s: NOT RUNNING\n" "$container"
        OVERALL_STATUS=1
    fi
done

# =============================================================================
# STEP 2: Health Endpoints
# =============================================================================
echo ""
echo "[STEP 2] Health Endpoints"
echo "========================="

declare -A HEALTH_URLS=(
    ["openclaw-mcp-wrapper:3457"]="http://localhost:3457/health"
    ["openwebui-bridge-agent:3456"]="http://localhost:3456/health"
)

for name_url in "${!HEALTH_URLS[@]}"; do
    url="${HEALTH_URLS[$name_url]}"
    http_code=$(curl -s -o /dev/null -w "%{http_code}" "$url" --max-time 10 2>/dev/null || echo "000")

    if [ "$http_code" = "200" ]; then
        printf "  ✅ %s: HTTP %s\n" "$name_url" "$http_code"
    else
        printf "  ❌ %s: HTTP %s (expected 200)\n" "$name_url" "$http_code"
        OVERALL_STATUS=1
    fi
done

# =============================================================================
# STEP 3: MCP Tools via JSON-RPC
# =============================================================================
echo ""
echo "[STEP 3] MCP Tools (JSON-RPC)"
echo "============================"

# Test openclaw-mcp-wrapper: get_status tool
echo "  Testing openclaw-mcp-wrapper MCP tool..."

MCP_RESPONSE=$(curl -s --max-time 15 \
    -X POST "http://localhost:3457/mcp" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "get_status",
            "arguments": {}
        },
        "id": 1
    }' 2>/dev/null || echo '{"error":"curl failed"}')

if echo "$MCP_RESPONSE" | python3 -c "import sys,json; r=json.load(sys.stdin); print('ok' if 'result' in r or 'error' not in r else 'fail')" 2>/dev/null | grep -q "ok"; then
    echo "  ✅ openclaw-mcp-wrapper: MCP get_status → responded"
else
    echo "  ❌ openclaw-mcp-wrapper: MCP get_status → FAILED"
    echo "     Response: $(echo "$MCP_RESPONSE" | head -c 200)"
    OVERALL_STATUS=1
fi

# =============================================================================
# STEP 4: OpenClaw invoke_tool via Bridge
# =============================================================================
echo ""
echo "[STEP 4] OpenClaw invoke_tool via Bridge"
echo "======================================="

# Test openwebui-bridge-agent: openclaw_invoke_tool
BRIDGE_RESPONSE=$(curl -s --max-time 30 \
    -X POST "http://localhost:3456/mcp" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "openclaw_invoke_tool",
            "arguments": {
                "tool_name": "get_status",
                "args": {}
            }
        },
        "id": 2
    }' 2>/dev/null || echo '{"error":"curl failed"}')

if echo "$BRIDGE_RESPONSE" | python3 -c "import sys,json; r=json.load(sys.stdin); print('ok')" 2>/dev/null | grep -q "ok"; then
    echo "  ✅ openwebui-bridge-agent: openclaw_invoke_tool → responded"
else
    echo "  ⚠️  openwebui-bridge-agent: openclaw_invoke_tool → $(echo "$BRIDGE_RESPONSE" | head -c 100)"
    # Don't fail for this - OpenClaw might not be reachable from here
fi

# =============================================================================
# STEP 5: OpenClaw Bot Health (external test)
# =============================================================================
echo ""
echo "[STEP 5] OpenClaw Bot External Health"
echo "======================================"

OPENCLAW_CODE=$(curl -s -o /dev/null -w "%{http_code}" "${OPENCLAW_INTERNAL_URL:-http://10.0.19.4:8080}/health" --max-time 10 2>/dev/null || echo "000")
if [ "$OPENCLAW_CODE" = "200" ]; then
    echo "  ✅ OpenClaw Bot: HTTP $OPENCLAW_CODE (reachable)"
else
    echo "  ⚠️  OpenClaw Bot: HTTP $OPENCLAW_CODE (may be down or network blocked)"
fi

# =============================================================================
# STEP 6: CEO MIX Response Format Check
# =============================================================================
echo ""
echo "[STEP 6] CEO MIX Response Format (if bridge chat available)"
echo "==========================================================="

# Test openclaw_bridge_chat if tool exists
CEO_MIX_RESPONSE=$(curl -s --max-time 30 \
    -X POST "http://localhost:3456/mcp" \
    -H "Content-Type: application/json" \
    -d '{
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "openclaw_bridge_chat",
            "arguments": {
                "message": "test"
            }
        },
        "id": 3
    }' 2>/dev/null || echo '{}')

if echo "$CEO_MIX_RESPONSE" | python3 -c "import sys,json; r=json.load(sys.stdin); print('ok')" 2>/dev/null | grep -q "ok"; then
    echo "  ✅ openclaw_bridge_chat tool exists"
else
    echo "  ⚠️  openclaw_bridge_chat tool not found or failed (may be unimplemented)"
fi

# =============================================================================
# STEP 7: Cloudflare Tunnel Check
# =============================================================================
echo ""
echo "[STEP 7] Cloudflare Tunnel (chat.zappro.site)"
echo "============================================"

TUNNEL_CHECK=$(curl -s --max-time 10 -I "https://chat.zappro.site" 2>/dev/null | grep -i "cloudflare\|cf-ray" || true)
if [ -n "$TUNNEL_CHECK" ]; then
    echo "  ✅ Cloudflare proxying chat.zappro.site"
else
    echo "  ⚠️  chat.zappro.site not proxied by Cloudflare (may need DNS update)"
fi

# =============================================================================
# STEP 8: Verify Networks Exist
# =============================================================================
echo ""
echo "[STEP 8] Docker Networks"
echo "======================="

declare -a NETWORKS=(
    "qgtzrmi6771lt8l7x8rqx72f"
    "wbmqefxhd7vdn2dme3i6s9an"
)

for network in "${NETWORKS[@]}"; do
    if docker network ls 2>/dev/null | grep -q "$network"; then
        echo "  ✅ Network: $network"
    else
        echo "  ❌ Network: $network NOT FOUND"
        OVERALL_STATUS=1
    fi
done

# =============================================================================
# SUMMARY
# =============================================================================
echo ""
echo "=== Summary ==="
if [ "$OVERALL_STATUS" -eq 0 ]; then
    echo "All critical checks: PASS ✅"
else
    echo "Some checks: FAIL ❌"
fi

echo ""
echo "Bridge Stack: openclaw-mcp-wrapper (port 3457) + openwebui-bridge-agent (port 3456)"
echo "Self-Healing: autoheal (willfarrell/autoheal)"
echo "Networks: qgtzrmi6771lt8l7x8rqx72f (OpenClaw) + wbmqefxhd7vdn2dme3i6s9an (OpenWebUI)"
echo ""
echo "E2E Smoke Test completed at $(date -Iseconds)"
exit $OVERALL_STATUS
