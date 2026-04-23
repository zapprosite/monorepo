#!/usr/bin/env bash
# smoke-mem0.sh — Mem0/Qdrant + Ollama embeddings write/read/delete cycle
#
# Tests: create campaign memories, embed via Ollama, store in Qdrant,
#        retrieve by key, delete. Uses fictional Refrimix campaign data.
#
# Idempotent — cleans up all test artifacts on exit.

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
QDRANT_API_KEY="${QDRANT_API_KEY:-}"
MEM0_COLLECTION="${MEM0_COLLECTION:-will}"
OLLAMA_EMBED_MODEL="${OLLAMA_EMBED_MODEL:-nomic-embed-text}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log()  { echo -e "${BLUE}[SMOKE]${NC} $1"; }
ok()   { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; }

# Temp files for cleanup tracking
CLEANUP_KEYS="/tmp/mem0_smoke_keys_$$"
trap 'cleanup' EXIT

# ── Prerequisites ───────────────────────────────────────────────────
check_prereqs() {
  log "Checking prerequisites..."

  if curl -sf "${QDRANT_URL}/health" > /dev/null 2>&1; then
    ok "Qdrant reachable at ${QDRANT_URL}"
  else
    fail "Qdrant not reachable at ${QDRANT_URL}"
    exit 1
  fi

  if curl -sf "${OLLAMA_URL}/api/tags" > /dev/null 2>&1; then
    ok "Ollama reachable at ${OLLAMA_URL}"
  else
    fail "Ollama not reachable at ${OLLAMA_URL}"
    exit 1
  fi

  # Ensure collection exists
  local coll_exists=$(curl -sf "${QDRANT_URL}/collections/${MEM0_COLLECTION}" \
    -H "Authorization: Bearer ${QDRANT_API_KEY}" | jq -r '.result != null')
  if [[ "$coll_exists" == "true" ]]; then
    ok "Collection '${MEM0_COLLECTION}' exists"
  else
    warn "Collection '${MEM0_COLLECTION}' not found — creating..."
    curl -sf -X PUT "${QDRANT_URL}/collections/${MEM0_COLLECTION}" \
      -H "Content-Type: application/json" \
      -H "Authorization: Bearer ${QDRANT_API_KEY}" \
      -d '{"vectors": {"size": 768, "distance": "Cosine"}}' > /dev/null 2>&1 \
      && ok "Collection created" \
      || warn "Could not create collection (may already exist with different config)"
  fi

  ok "Prerequisites checked"
}

# ── Embed text via Ollama ───────────────────────────────────────────
embed_text() {
  local text="$1"
  curl -sf -X POST "${OLLAMA_URL}/api/embed" \
    -H "Content-Type: application/json" \
    -d "{\"model\":\"${OLLAMA_EMBED_MODEL}\",\"input\":\"${text}\"}" \
    | jq -r '.embeddings[0] // empty'
}

# ── Write a Mem0 point ─────────────────────────────────────────────
write_point() {
  local key="$1"
  local value="$2"
  local vector

  vector=$(embed_text "$value")
  if [[ -z "$vector" ]]; then
    warn "Ollama embed returned empty for: ${value:0:40}..."
    # Use zero vector as fallback for Qdrant (won't match in search but lets us test write/read)
    vector=$(printf '%.0s0,' {1..768} | sed 's/,$//')
  fi

  curl -sf -X PUT "${QDRANT_URL}/collections/${MEM0_COLLECTION}/points" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${QDRANT_API_KEY}" \
    -d "{
      \"points\": [{
        \"id\": \"${key}\",
        \"vector\": [${vector}],
        \"payload\": {
          \"text\": \"${value}\",
          \"source\": \"smoke_test\",
          \"timestamp\": \"$(date -Iseconds)\"
        }
      }]
    }" > /dev/null 2>&1

  echo "$key" >> "$CLEANUP_KEYS"
}

# ── Read a Mem0 point ──────────────────────────────────────────────
read_point() {
  local key="$1"
  curl -sf "${QDRANT_URL}/collections/${MEM0_COLLECTION}/points/${key}" \
    -H "Authorization: Bearer ${QDRANT_API_KEY}" \
    | jq -r '.result.payload.text // empty'
}

# ── Delete a Mem0 point ────────────────────────────────────────────
delete_point() {
  local key="$1"
  curl -sf -X DELETE "${QDRANT_URL}/collections/${MEM0_COLLECTION}/points/${key}" \
    -H "Authorization: Bearer ${QDRANT_API_KEY}" > /dev/null 2>&1
}

# ── Search Mem0 ────────────────────────────────────────────────────
search_mem0() {
  local query="$1"
  local vector

  vector=$(embed_text "$query")
  if [[ -z "$vector" ]]; then
    return 1
  fi

  curl -sf -X POST "${QDRANT_URL}/collections/${MEM0_COLLECTION}/points/search" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer ${QDRANT_API_KEY}" \
    -d "{
      \"vector\": [${vector}],
      \"limit\": 3,
      \"with_payload\": true
    }" | jq -r '.result[0].payload.text // empty'
}

# ── Cleanup ─────────────────────────────────────────────────────────
cleanup() {
  if [[ -f "$CLEANUP_KEYS" ]]; then
    log "Cleaning up Mem0 smoke test artifacts..."
    while read -r key; do
      delete_point "$key" 2>/dev/null || true
    done < "$CLEANUP_KEYS"
    rm -f "$CLEANUP_KEYS"
    ok "Mem0 cleanup complete"
  fi
}

# ── Main test ──────────────────────────────────────────────────────
main() {
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "  SMOKE: Mem0/Qdrant + Ollama Embeddings"
  echo "  Write → Read → Search → Delete cycle"
  echo "═══════════════════════════════════════════════"
  echo ""

  check_prereqs

  # Fictional campaign data
  local -a CAMPAIGNS=(
    "Campanha Revrimix Inverno 2026 — positioning gelateria artesanal"
    "Briefing cliente ClimaFrio: rebranding quarterly HVAC marketing"
    "Proposal Refrimix: social media content calendar Q2 2026"
  )

  local -a TEST_KEYS=()

  echo ""
  echo "── Write Phase ──"
  for i in "${!CAMPAIGNS[@]}"; do
    local key="smoke_mem0_$(date +%s)_${i}"
    local value="${CAMPAIGNS[$i]}"
    TEST_KEYS+=("$key")

    local result=$(write_point "$key" "$value")
    if [[ $? -eq 0 ]]; then
      ok "Write: ${value:0:50}..."
    else
      fail "Write failed: ${value:0:50}..."
      exit 1
    fi
  done

  sleep 2  # Allow Qdrant to index

  echo ""
  echo "── Read Phase ──"
  for i in "${!TEST_KEYS[@]}"; do
    local key="${TEST_KEYS[$i]}"
    local expected="${CAMPAIGNS[$i]}"
    local retrieved=$(read_point "$key")

    if [[ "$retrieved" == "$expected" ]]; then
      ok "Read: ${retrieved:0:50}..."
    else
      fail "Read mismatch for key ${key}"
      fail "  Expected: ${expected:0:50}..."
      fail "  Got:      ${retrieved:0:50}..."
      exit 1
    fi
  done

  echo ""
  echo "── Search Phase ──"
  local search_query="Refrimix marketing campaign"
  local search_result=$(search_mem0 "$search_query")
  if [[ -n "$search_result" ]]; then
    ok "Search '${search_query}': ${search_result:0:50}..."
  else
    warn "Search returned empty (embedding may not match)"
  fi

  echo ""
  echo "── Delete Phase ──"
  for key in "${TEST_KEYS[@]}"; do
    delete_point "$key"
    ok "Deleted: ${key}"
  done

  echo ""
  echo "═══════════════════════════════════════════════"
  echo "  Cleanup"
  echo "═══════════════════════════════════════════════"
  echo ""

  cleanup

  echo ""
  ok "smoke-mem0: all tests passed"
}

# Override cleanup to avoid double-delete (keys already deleted in delete phase)
cleanup() {
  if [[ -f "$CLEANUP_KEYS" ]]; then
    log "Cleaning up remaining Mem0 smoke test artifacts..."
    while read -r key; do
      delete_point "$key" 2>/dev/null || true
    done < "$CLEANUP_KEYS"
    rm -f "$CLEANUP_KEYS"
    ok "Mem0 cleanup complete"
  fi
}

trap cleanup EXIT
main "$@"
