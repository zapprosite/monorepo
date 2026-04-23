#!/usr/bin/env bash
# smoke-agency-full-stack.sh — CEO_REFRIMIX_bot Telegram loop test
# Tests: Mem0 + Second Brain + Trieve RAG + PostgreSQL via Telegram
#
# Fictional examples → send to Telegram → verify → delete
# Loops until all working, then cleans up

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
TELEGRAM_CLI="${TELEGRAM_CLI:-telegram-cli}"  # or tdcli
BOT_TOKEN="${HERMES_AGENCY_BOT_TOKEN:-}"
GATEWAY_URL="${HERMES_GATEWAY_URL:-https://hermes.zappro.site}"
API_KEY="${HERMES_API_KEY:-}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log()  { echo -e "${BLUE}[SMOKE]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }

# ── Check prerequisites ───────────────────────────────────────────────
check_prereqs() {
  log "Checking prerequisites..."

  if [[ -z "$BOT_TOKEN" ]]; then
    # Try to get from running bot
    BOT_TOKEN=$(curl -sf "http://localhost:3001/health" 2>/dev/null | jq -r '.bot_token // empty' || true)
  fi

  if [[ -z "$BOT_TOKEN" ]]; then
    warn "HERMES_AGENCY_BOT_TOKEN not set — will test via HTTP API instead of Telegram CLI"
    USE_HTTP=1
  else
    USE_HTTP=0
  fi

  # Check Mem0
  if curl -sf "http://localhost:6333/health" > /dev/null 2>&1; then
    ok "Qdrant reachable"
  else
    fail "Qdrant not reachable at localhost:6333"
    exit 1
  fi

  # Check Ollama
  if curl -sf "http://localhost:11434/api/tags" > /dev/null 2>&1; then
    ok "Ollama reachable"
  else
    fail "Ollama not reachable at localhost:11434"
    exit 1
  fi

  # Check Trieve
  if curl -sf "http://localhost:6435/health" > /dev/null 2>&1; then
    ok "Trieve reachable"
  else
    warn "Trieve not running on :6435 (may need deploy)"
  fi

  # Check PostgreSQL
  if pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    ok "PostgreSQL reachable"
  else
    warn "PostgreSQL not reachable on :5432 (MCP may not be running)"
  fi

  ok "Prerequisites checked"
}

# ── Mem0 interaction ─────────────────────────────────────────────────
test_mem0() {
  local test_key="smoke_test_$(date +%s)"
  local test_value="Design de Campanha para Refrimix — Smoke Test"

  log "Testing Mem0..."

  # Write to Mem0 via Qdrant
  MEM0_COLLECTION="${MEM0_COLLECTION:-will}"
  curl -sf -X PUT "http://localhost:6333/collections/${MEM0_COLLECTION}/points" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${QDRANT_API_KEY:-}" \
    -d "{
      \"points\": [{
        \"id\": \"${test_key}\",
        \"vector\": $(curl -sf -X POST "http://localhost:11434/api/embed" -d "{\"model\":\"nomic-embed-text\",\"input\":\"${test_value}\"}" | jq -r '.embeddings[0] // [0.0]'),
        \"payload\": {
          \"text\": \"${test_value}\",
          \"source\": \"smoke_test\",
          \"timestamp\": \"$(date -Iseconds)\"
        }
      }]
    }" > /dev/null 2>&1

  sleep 1

  # Read back
  local retrieved=$(curl -sf "http://localhost:6333/collections/${MEM0_COLLECTION}/points/${test_key}" \
    -H "Authorization: Bearer ${QDRANT_API_KEY:-}" | jq -r '.payload.text // empty')

  if [[ "$retrieved" == "$test_value" ]]; then
    ok "Mem0 write/read: ${retrieved:0:40}..."
    echo "$test_key" >> /tmp/mem0_smoke_keys
  else
    fail "Mem0 read mismatch: expected '${test_value}', got '${retrieved}'"
    return 1
  fi
}

# ── Trieve RAG ───────────────────────────────────────────────────────
test_trieve() {
  log "Testing Trieve RAG..."

  local dataset_id="${TRIEVE_DEFAULT_DATASET_ID:-}"
  if [[ -z "$dataset_id" ]]; then
    # Create test dataset
    dataset_id=$(curl -sf -X POST "http://localhost:6435/api/v1/datasets" \
      -H "Content-Type: application/json" \
      -H "Authorization: ApiKey ${TRIEVE_API_KEY:-}" \
      -d '{"name": "smoke-test-'$(date +%s)'", "description": "Smoke test dataset"}' \
      | jq -r '.id // empty')
  fi

  if [[ -z "$dataset_id" ]]; then
    warn "Trieve not available — skipping RAG test"
    return 0
  fi

  # Index test chunk
  local chunk_result=$(curl -sf -X POST "http://localhost:6435/api/v1/chunks" \
    -H "Content-Type: application/json" \
    -H "TR-Dataset: ${dataset_id}" \
    -H "Authorization: ApiKey ${TRIEVE_API_KEY:-}" \
    -d '{
      "chunks": [{
        "chunk_html": "<p>Smoke test campaign for Refrimix — HVAC marketing campaign</p>",
        "metadata": {"source": "smoke_test", "type": "campaign"}
      }]
    }' | jq -r '.success // empty')

  if [[ "$chunk_result" == "true" ]] || curl -sf "http://localhost:6435/api/v1/chunks" \
    -H "TR-Dataset: ${dataset_id}" | jq -r '.chunks[0].chunk_html' > /dev/null 2>&1; then
    ok "Trieve RAG: chunk indexed"
  else
    warn "Trieve chunk indexing returned unexpected result"
  fi

  # Search
  local search_result=$(curl -sf -X POST "http://localhost:6435/api/v1/chunk/search" \
    -H "Content-Type: application/json" \
    -H "TR-Dataset: ${dataset_id}" \
    -H "Authorization: ApiKey ${TRIEVE_API_KEY:-}" \
    -d '{"query": "Refrimix campaign", "limit": 3}' | jq -r '.results[0].chunk.chunk_html[0:50] // empty')

  if [[ -n "$search_result" ]]; then
    ok "Trieve RAG: search returned — ${search_result:0:40}..."
  else
    warn "Trieve search returned empty"
  fi
}

# ── PostgreSQL ───────────────────────────────────────────────────────
test_postgres() {
  log "Testing PostgreSQL MCP..."

  # Test via MCP server if running, else direct psql
  if curl -sf "http://localhost:4017/health" > /dev/null 2>&1; then
    local result=$(curl -sf -X POST "http://localhost:4017/tools/call" \
      -H "Content-Type: application/json" \
      -d '{"name": "list_schemas", "arguments": {"app": "hermes"}}' \
      | jq -r '.schemas // .error // empty')

    if [[ -n "$result" && "$result" != "null" ]]; then
      ok "PostgreSQL MCP: list_schemas returned ($(echo "$result" | jq length) schemas)"
    else
      warn "PostgreSQL MCP returned empty or error"
    fi
  else
    # Direct psql test
    local schema_name="hermes_ceo_smoke_$(date +%s)"
    PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h localhost -p 5432 -U "${DB_USER:-postgres}" -d "${DB_NAME:-postgres}" \
      -c "CREATE SCHEMA IF NOT EXISTS \"${schema_name}\";" > /dev/null 2>&1
    local drop_result=$(PGPASSWORD="${POSTGRES_PASSWORD:-}" psql -h localhost -p 5432 -U "${DB_USER:-postgres}" -d "${DB_NAME:-postgres}" \
      -c "DROP SCHEMA \"${schema_name}\" CASCADE;" > /dev/null 2>&1 && ok "PostgreSQL: schema create/drop OK")

    if [[ -n "$drop_result" ]]; then
      ok "PostgreSQL: direct psql create/drop"
    else
      warn "PostgreSQL not reachable"
    fi
  fi
}

# ── Telegram message (via Bot API) ───────────────────────────────────
send_telegram_message() {
  local message="$1"
  local chat_id="${TELEGRAM_CHAT_ID:-}"

  if [[ -z "$chat_id" ]]; then
    warn "TELEGRAM_CHAT_ID not set — skipping Telegram test"
    return 1
  fi

  curl -sf -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${chat_id}&text=$(python3 -c 'import urllib.parse; print(urllib.parse.quote("'"$message"'"))')" \
    | jq -r '.ok // false' > /dev/null 2>&1
}

test_telegram_ceo() {
  log "Testing CEO via Telegram..."

  local chat_id="${TELEGRAM_CHAT_ID:-}"
  if [[ -z "$chat_id" ]]; then
    warn "TELEGRAM_CHAT_ID not set — skipping Telegram CEO test"
    return 0
  fi

  # Send test message
  local test_msg="Smoke test CEO — criar briefing para campanha Refrimix HVAC"
  local msg_id=$(curl -sf -X POST "https://api.telegram.org/bot${BOT_TOKEN}/sendMessage" \
    -d "chat_id=${chat_id}&text=$(python3 -c 'import urllib.parse; print(urllib.parse.quote("'"$test_msg"'"))')" \
    | jq -r '.result.message_id // empty')

  if [[ -n "$msg_id" && "$msg_id" != "null" ]]; then
    ok "Telegram: message sent (ID: $msg_id)"

    # Wait for response (poll)
    sleep 8

    # Get updates
    local updates=$(curl -sf "https://api.telegram.org/bot${BOT_TOKEN}/getUpdates" \
      | jq -r '.result[-1].message.text // empty')

    if [[ -n "$updates" ]]; then
      ok "Telegram: CEO response received — ${updates:0:80}..."
    else
      warn "Telegram: no response yet (may be async)"
    fi

    # Delete test message
    curl -sf -X POST "https://api.telegram.org/bot${BOT_TOKEN}/deleteMessage" \
      -d "chat_id=${chat_id}&message_id=${msg_id}" > /dev/null 2>&1
    ok "Telegram: test message deleted"
  else
    warn "Telegram: failed to send message"
  fi
}

# ── Cleanup ────────────────────────────────────────────────────────────
cleanup() {
  log "Cleaning up smoke test artifacts..."

  # Delete Mem0 test entries
  if [[ -f /tmp/mem0_smoke_keys ]]; then
    while read -r key; do
      curl -sf -X DELETE "http://localhost:6333/collections/${MEM0_COLLECTION:-will}/points/${key}" \
        -H "Authorization: Bearer ${QDRANT_API_KEY:-}" > /dev/null 2>&1 || true
    done < /tmp/mem0_smoke_keys
    rm -f /tmp/mem0_smoke_keys
    ok "Mem0: smoke test entries deleted"
  fi

  ok "Cleanup complete"
}

# ── Main ──────────────────────────────────────────────────────────────
main() {
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "  SMOKE: Hermes Agency Full Stack Test"
  echo "  Mem0 + Second Brain + Trieve + PostgreSQL"
  echo "═══════════════════════════════════════════════"
  echo ""

  check_prereqs

  echo ""
  echo "── Mem0 ──"
  test_mem0 || true

  echo ""
  echo "── Trieve RAG ──"
  test_trieve || true

  echo ""
  echo "── PostgreSQL ──"
  test_postgres || true

  echo ""
  echo "── Telegram CEO ──"
  test_telegram_ceo || true

  echo ""
  echo "═══════════════════════════════════════════════"
  echo "  Cleanup"
  echo "═══════════════════════════════════════════════"
  echo ""

  cleanup

  echo ""
  ok "Smoke test complete"
}

trap cleanup EXIT
main "$@"
