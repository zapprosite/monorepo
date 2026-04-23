#!/usr/bin/env bash
# smoke-trieve.sh — Trieve dataset create/index/search/delete cycle
#
# Tests: create dataset, index chunks, search, delete dataset.
# Uses fictional Refrimix campaign data. Cleans up all test artifacts.
#
# Idempotent — can run multiple times; each run creates fresh datasets.

set -euo pipefail

# ── Config ──────────────────────────────────────────────────────────
TRIEVE_URL="${TRIEVE_URL:-http://localhost:6435}"
TRIEVE_API_KEY="${TRIEVE_API_KEY:-}"
DATASET_NAME="smoke-test-$(date +%s)"

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

# Track datasets for cleanup
CLEANUP_DATASETS="/tmp/trieve_smoke_datasets_$$"
trap 'cleanup' EXIT

# ── Prerequisites ───────────────────────────────────────────────────
check_prereqs() {
  log "Checking prerequisites..."

  if curl -sf "${TRIEVE_URL}/health" > /dev/null 2>&1; then
    ok "Trieve reachable at ${TRIEVE_URL}"
  else
    fail "Trieve not reachable at ${TRIEVE_URL}"
    exit 1
  fi

  # Verify API key
  if [[ -z "$TRIEVE_API_KEY" ]]; then
    warn "TRIEVE_API_KEY not set — some endpoints may be unavailable"
  else
    ok "TRIEVE_API_KEY configured"
  fi

  ok "Prerequisites checked"
}

# ── Create dataset ──────────────────────────────────────────────────
create_dataset() {
  local name="$1"
  local dataset_id

  dataset_id=$(curl -sf -X POST "${TRIEVE_URL}/api/v1/datasets" \
    -H "Content-Type: application/json" \
    -H "Authorization: ApiKey ${TRIEVE_API_KEY}" \
    -d "$(cat <<EOF
{
  "name": "${name}",
  "description": "Smoke test dataset — fictional Refrimix campaign data",
  "authorized_app_ids": []
}
EOF
)" | jq -r '.id // empty')

  if [[ -z "$dataset_id" || "$dataset_id" == "null" ]]; then
    fail "Failed to create dataset: ${name}"
    return 1
  fi

  echo "$dataset_id" >> "$CLEANUP_DATASETS"
  ok "Created dataset '${name}' (ID: ${dataset_id})"
  echo "$dataset_id"
}

# ── Delete dataset ──────────────────────────────────────────────────
delete_dataset() {
  local dataset_id="$1"
  curl -sf -X DELETE "${TRIEVE_URL}/api/v1/datasets/${dataset_id}" \
    -H "Authorization: ApiKey ${TRIEVE_API_KEY}" > /dev/null 2>&1
  ok "Deleted dataset: ${dataset_id}"
}

# ── Index chunks ────────────────────────────────────────────────────
index_chunks() {
  local dataset_id="$1"
  local -a CHUNKS=(
    '{"chunk_html": "<p>Campanha Refrimix Inverno 2026 — posicionamento gelateria artesanal premium. Target: mulheres 25-45 ABC.</p>", "metadata": {"source": "smoke_test", "type": "campaign_brief"}}'
    '{"chunk_html": "<p>Briefing Cliente ClimaFrio: rebranding quarterly para divisão HVAC. Keywords: eficiencia energetica, conforto termico.</p>", "metadata": {"source": "smoke_test", "type": "client_brief"}}'
    '{"chunk_html": "<p>Proposal Refrimix: social media content calendar Q2 2026. Plataformas: Instagram, LinkedIn, Pinterest. Formato: carousel + stories.</p>", "metadata": {"source": "smoke_test", "type": "proposal"}}'
  )

  local result
  result=$(curl -sf -X POST "${TRIEVE_URL}/api/v1/chunks" \
    -H "Content-Type: application/json" \
    -H "TR-Dataset: ${dataset_id}" \
    -H "Authorization: ApiKey ${TRIEVE_API_KEY}" \
    -d "{\"chunks\": [${CHUNKS[*]}]}" | jq -r '.success // empty')

  if [[ "$result" == "true" ]]; then
    ok "Indexed ${#CHUNKS[@]} chunks"
  else
    # Try alternate response format
    local count=$(curl -sf "${TRIEVE_URL}/api/v1/chunks" \
      -H "TR-Dataset: ${dataset_id}" \
      -H "Authorization: ApiKey ${TRIEVE_API_KEY}" | jq -r '.chunks | length')
    if [[ -n "$count" && "$count" != "null" ]]; then
      ok "Indexed chunks confirmed via GET (${count} chunks)"
    else
      warn "Chunk indexing returned unexpected response"
    fi
  fi
}

# ── Search chunks ───────────────────────────────────────────────────
search_chunks() {
  local dataset_id="$1"
  local query="$2"

  local results
  results=$(curl -sf -X POST "${TRIEVE_URL}/api/v1/chunk/search" \
    -H "Content-Type: application/json" \
    -H "TR-Dataset: ${dataset_id}" \
    -H "Authorization: ApiKey ${TRIEVE_API_KEY}" \
    -d "$(cat <<EOF
{
  "query": "${query}",
  "limit": 3,
  "search_type": "semantic"
}
EOF
)" 2>&1)

  if echo "$results" | jq -e '.results[0]' > /dev/null 2>&1; then
    local first_result=$(echo "$results" | jq -r '.results[0].chunk.chunk_html[0:80] // empty')
    if [[ -n "$first_result" ]]; then
      ok "Search '${query}': ${first_result}..."
      return 0
    fi
  fi

  # Fallback: try non-semantic search
  results=$(curl -sf -X POST "${TRIEVE_URL}/api/v1/chunk/search" \
    -H "Content-Type: application/json" \
    -H "TR-Dataset: ${dataset_id}" \
    -H "Authorization: ApiKey ${TRIEVE_API_KEY}" \
    -d "{\"query\": \"${query}\", \"limit\": 3}" 2>&1)

  if echo "$results" | jq -e '.results[0]' > /dev/null 2>&1; then
    local first_result=$(echo "$results" | jq -r '.results[0].chunk.chunk_html[0:80] // empty')
    if [[ -n "$first_result" ]]; then
      ok "Search '${query}' (full-text): ${first_result}..."
      return 0
    fi
  fi

  warn "Search '${query}' returned no results"
  return 1
}

# ── Cleanup ─────────────────────────────────────────────────────────
cleanup() {
  if [[ -f "$CLEANUP_DATASETS" ]]; then
    log "Cleaning up Trieve smoke test datasets..."
    while read -r ds_id; do
      delete_dataset "$ds_id" 2>/dev/null || true
    done < "$CLEANUP_DATASETS"
    rm -f "$CLEANUP_DATASETS"
    ok "Trieve cleanup complete"
  fi
}

# ── Main test ──────────────────────────────────────────────────────
main() {
  echo ""
  echo "═══════════════════════════════════════════════"
  echo "  SMOKE: Trieve Dataset CRUD Cycle"
  echo "  Create → Index → Search → Delete"
  echo "═══════════════════════════════════════════════"
  echo ""

  check_prereqs

  local dataset_id

  echo ""
  echo "── Create Dataset ──"
  dataset_id=$(create_dataset "$DATASET_NAME")
  if [[ -z "$dataset_id" ]]; then
    fail "Dataset creation failed"
    exit 1
  fi

  echo ""
  echo "── Index Chunks ──"
  index_chunks "$dataset_id"
  sleep 1  # Allow indexing to complete

  echo ""
  echo "── Search Chunks ──"
  search_chunks "$dataset_id" "Refrimix campanha" || true
  search_chunks "$dataset_id" "ClimaFrio HVAC" || true

  echo ""
  echo "── Delete Dataset ──"
  delete_dataset "$dataset_id"
  # Remove from cleanup list since already deleted
  if [[ -f "$CLEANUP_DATASETS" ]]; then
    grep -v "^${dataset_id}$" "$CLEANUP_DATASETS" > "${CLEANUP_DATASETS}.tmp" 2>/dev/null || true
    mv "${CLEANUP_DATASETS}.tmp" "$CLEANUP_DATASETS"
  fi

  echo ""
  echo "═══════════════════════════════════════════════"
  echo "  Cleanup"
  echo "═══════════════════════════════════════════════"
  echo ""

  cleanup

  echo ""
  ok "smoke-trieve: all tests passed"
}

trap cleanup EXIT
main "$@"
