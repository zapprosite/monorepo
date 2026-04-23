#!/usr/bin/env bash
# smoke-trieve-rag.sh — SPEC-092 Trieve RAG Integration validation
# Tests: Trieve health, Qdrant collections, Ollama embeddings, dataset API, search
# Anti-hardcoded: all config via .env (set -a; source)

set -euo pipefail

ENV_FILE="${ENV_FILE:-/srv/monorepo/.env}"
# shellcheck disable=SC1090
set -a; source "$ENV_FILE"; set +a

# ── Defaults ────────────────────────────────────────────────────
TRIEVE_URL="${TRIEVE_URL:-http://localhost:6435}"
TRIEVE_KEY="${TRIEVE_API_KEY:-}"
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
EMBED_MODEL="${EMBEDDING_MODEL:-nomic-ai/e5-mistral-7b-instruct}"

# ── Colors ───────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0

pass() { echo -e "${GREEN}[PASS]${NC} $1"; ((PASS++)) || true; }
fail() { echo -e "${RED}[FAIL]${NC} $1"; ((FAIL++)) || true; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; ((WARN++)) || true; }

TOTAL=0

echo "=============================================="
echo "  Trieve RAG — Smoke Test (SPEC-092)"
echo "=============================================="

# ── 1. Trieve Health ──────────────────────────────────────────
echo ""
echo "── 1. Trieve :6435 ─────────────────────────"

((TOTAL++)) || true
body=$(curl -sf --max-time 5 "${TRIEVE_URL%/}/health" 2>/dev/null || echo "")
if echo "$body" | grep -qE 'ok|healthy|200'; then
  pass "Trieve /health → 200"
else
  fail "Trieve /health unreachable or bad body: $body"
fi

# ── 2. Qdrant Connection ────────────────────────────────────────
echo ""
echo "── 2. Qdrant :6333 ─────────────────────────"

((TOTAL++)) || true
body=$(curl -sf --max-time 5 "${QDRANT_URL%/}/collections" 2>/dev/null || echo "")
if echo "$body" | grep -qE 'collections|result'; then
  pass "Qdrant /collections → accessible"
else
  fail "Qdrant :6333 unreachable"
fi

# Check 'trieve' collection exists
((TOTAL++)) || true
body=$(curl -sf --max-time 5 "${QDRANT_URL%/}/collections/trieve" 2>/dev/null || echo "")
if echo "$body" | grep -qE 'trieve|vectors|status'; then
  pass "Qdrant 'trieve' collection exists"
else
  warn "Qdrant 'trieve' collection not found (create via Trieve)"
fi

# ── 3. Ollama Embedding ─────────────────────────────────────────
echo ""
echo "── 3. Ollama :11434 Embedding ───────────────"

((TOTAL++)) || true
body=$(curl -sf --max-time 5 "${OLLAMA_URL%/}/api/tags" 2>/dev/null || echo "")
if echo "$body" | grep -q 'models'; then
  pass "Ollama /api/tags → accessible"
else
  fail "Ollama :11434 unreachable"
fi

# Check embedding model available
((TOTAL++)) || true
body=$(curl -s "${OLLAMA_URL%/}/api/tags" 2>/dev/null || echo "")
if echo "$body" | grep -q "$EMBED_MODEL"; then
  pass "Embedding model '$EMBED_MODEL' available"
else
  warn "Embedding model '$EMBED_MODEL' not loaded (pull if needed)"
fi

# ── 4. Dataset API ──────────────────────────────────────────────
echo ""
echo "── 4. Dataset Management ─────────────────────"

# List datasets (requires auth)
((TOTAL++)) || true
ds_response=$(curl -sf --max-time 10 \
  -H "Authorization: Bearer ${TRIEVE_KEY}" \
  "${TRIEVE_URL%/}/api/v1/datasets" 2>/dev/null || echo '{}')
if echo "$ds_response" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok')" 2>/dev/null | grep -q "ok"; then
  pass "Dataset list API accessible"
else
  fail "Dataset API inaccessible (check TRIEVE_API_KEY)"
fi

# Check for 'hermes-knowledge' dataset
((TOTAL++)) || true
if echo "$ds_response" | grep -qE 'hermes-knowledge|hermes-second-brain'; then
  pass "Dataset 'hermes-knowledge' exists"
else
  warn "Dataset 'hermes-knowledge' not found (create in FASE 2)"
fi

# ── 5. Search API ────────────────────────────────────────────────
echo ""
echo "── 5. Search API ─────────────────────────────"

# RAG semantic search — PT-BR query
((TOTAL++)) || true
search_resp=$(curl -sf --max-time 30 \
  -H "Authorization: Bearer ${TRIEVE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"query":"como fazer deploy no coolify","limit":3}' \
  "${TRIEVE_URL%/}/api/v1/search" 2>/dev/null || echo '{"error":"failed"}')

result_count=$(echo "$search_resp" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('results',[])))" 2>/dev/null || echo "0")
if echo "$result_count" | grep -qE '[1-3]'; then
  pass "Search API returned $result_count results"
elif echo "$search_resp" | grep -qE 'error|empty|no.*result'; then
  warn "Search returned no results (may need indexing)"
else
  warn "Search API not returning expected format"
fi

# ── 6. Hermes Skill ──────────────────────────────────────────────
echo ""
echo "── 6. Hermes rag-retrieve Skill ──────────────"

# Verify skill exists in hermes skills index
((TOTAL++)) || true
if grep -qE "rag-retrieve|trieve|rag_retrieve" /srv/monorepo/apps/hermes-agency/src/skills/index.ts 2>/dev/null; then
  pass "rag-retrieve skill defined in Hermes"
else
  warn "rag-retrieve skill not yet implemented (FASE 3)"
fi

# Hermes gateway reachable
((TOTAL++)) || true
if curl -sf --max-time 5 http://localhost:8642/health 2>/dev/null | grep -qE 'ok|healthy'; then
  pass "Hermes Gateway :8642 reachable"
else
  warn "Hermes Gateway :8642 unreachable"
fi

# ── Summary ─────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo -e "  ${GREEN}$PASS passed${NC} | ${RED}$FAIL failed${NC} | ${YELLOW}$WARN warnings${NC}"
echo "=============================================="
echo "Total tests: $TOTAL"
echo ""

if (( FAIL > 0 )); then
  echo "RESULT: FAILED"
  exit 1
else
  echo "RESULT: PASSED"
  exit 0
fi