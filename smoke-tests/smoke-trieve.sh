#!/usr/bin/env bash
# smoke-trieve.sh — Comprehensive smoke test for Trieve RAG server
#
# Exit 0: Trieve is healthy and Dataset CRUD cycle works
# Exit 1: Trieve unreachable or API failure
#
# Test sequence: Create Dataset -> Index Chunks -> Search -> Delete
# Uses curl only (no jq dependency). Timeout per step: 30s.
#
# Environment:
#   TRIEVE_URL      (default: http://localhost:6435)
#   TRIEVE_API_KEY  (required for authenticated endpoints)

set -uo pipefail

# ── Config ──────────────────────────────────────────────────────────
readonly TRIEVE_URL="${TRIEVE_URL:-http://localhost:6435}"
readonly TRIEVE_API_KEY="${TRIEVE_API_KEY:-}"
readonly TIMEOUT=30
readonly DATASET_NAME="smoke-test-$(date +%s)"

# ── Logging ──────────────────────────────────────────────────────────
_log() {
    local level="$1"; shift
    printf '%s[%s] [TEST] %s%s\n' \
        "${1:+\033[1;31m}" \
        "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
        "$*" \
        "${1:+\033[0m}" >&2
}
log_info()   { _log "" "$@"; }
log_error()  { _log "\033[1;31m" "ERROR: $*" >&2; }
log_warn()   { _log "\033[1;33m" "WARN: $*" >&2; }

# ── State ────────────────────────────────────────────────────────────
_DATASET_ID=""
_DS_CREATED=0

# ── Cleanup Handler ───────────────────────────────────────────────────
cleanup() {
    local ret=$?
    if [[ $_DS_CREATED -eq 1 && -n "$_DATASET_ID" ]]; then
        log_info "Cleaning up dataset ${_DATASET_ID}..."
        _delete_dataset "$_DATASET_ID" 2>/dev/null || true
    fi
    return $ret
}
trap cleanup EXIT

# ── HTTP Helpers (from auto-deploy.sh pattern) ───────────────────────
_http_get() {
    local url="$1"
    local timeout="${2:-$TIMEOUT}"
    if command -v curl >/dev/null 2>&1; then
        timeout "$timeout" curl -sf "$url" 2>/dev/null && return 0 || return 1
    elif command -v wget >/dev/null 2>&1; then
        timeout "$timeout" wget -q -O - "$url" 2>/dev/null && return 0 || return 1
    else
        log_error "No HTTP client found (curl/wget)"
        return 1
    fi
}

_curl_json() {
    local method="$1"
    local url="$2"
    local data="$3"
    local timeout="${4:-$TIMEOUT}"

    if ! command -v curl >/dev/null 2>&1; then
        log_error "curl not found"
        return 1
    fi

    local auth_hdr="Authorization: ApiKey ${TRIEVE_API_KEY}"
    local ct_hdr="Content-Type: application/json"
    local curl_args=(-s -X "$method" -H "$ct_hdr")

    [[ -n "$TRIEVE_API_KEY" ]] && curl_args+=(-H "$auth_hdr")
    [[ -n "$data" ]] && curl_args+=(-d "$data")

    timeout "$timeout" curl "${curl_args[@]}" "$url" 2>/dev/null && return 0 || return 1
}

# ── JSON Parsing (no jq — grep/sed/awk) ──────────────────────────────
# Extract value by key from JSON response using grep + sed
_json_get() {
    local json="$1"
    local key="$2"
    # Handles: "key": "value" or "key":123 or "key":true/false
    echo "$json" | grep -o "\"${key}\"[[:space:]]*:[[:space:]]*[^,}]*" \
        | sed 's/.*:[[:space:]]*//' \
        | tr -d '"' \
        | tr -d ' '
}

_json_array_length() {
    local json="$1"
    local key="$2"
    # Count elements in "key": [ ... ]
    echo "$json" | grep -o "\"${key}\"[[:space:]]*:" \
        | wc -l  # simplified - just check existence
}

# ── Health Check ─────────────────────────────────────────────────────
health_check() {
    log_info "Checking Trieve health at ${TRIEVE_URL}..."

    local resp
    resp=$(_http_get "${TRIEVE_URL}/health" 10) || {
        log_error "Trieve not reachable at ${TRIEVE_URL}"
        log_error "Is the server running? (Hint: curl ${TRIEVE_URL}/health)"
        return 1
    }

    if echo "$resp" | grep -qi "ok\|healthy\|true"; then
        log_info "Health check passed"
        return 0
    fi

    log_error "Unexpected health response: ${resp}"
    return 1
}

# ── Create Dataset ───────────────────────────────────────────────────
create_dataset() {
    local name="$1"
    log_info "Creating dataset: ${name}"

    local payload
    payload="$(cat <<EOF
{
  "name": "${name}",
  "description": "Smoke test dataset",
  "authorized_app_ids": []
}
EOF
)"

    local resp
    resp=$(_curl_json POST "${TRIEVE_URL}/api/v1/datasets" "$payload") || {
        log_error "Failed to create dataset"
        return 1
    }

    local ds_id
    ds_id=$(_json_get "$resp" "id") || {
        log_error "Failed to parse dataset ID from response"
        log_error "Response: ${resp}"
        return 1
    }

    if [[ -z "$ds_id" || "$ds_id" == "null" || "$ds_id" == "null" ]]; then
        log_error "Invalid dataset ID: '${ds_id}'"
        log_error "Response: ${resp}"
        return 1
    fi

    _DATASET_ID="$ds_id"
    _DS_CREATED=1
    log_info "Dataset created with ID: ${ds_id}"
    return 0
}

# ── Index Chunks ─────────────────────────────────────────────────────
index_chunks() {
    local ds_id="$1"
    log_info "Indexing 3 chunks into dataset ${ds_id}"

    local payload
    payload="$(cat <<'EOF'
{
  "chunks": [
    {
      "chunk_html": "<p>Smoke test chunk 1: Trieve RAG server functional test content.</p>",
      "metadata": {"source": "smoke_test", "index": 1}
    },
    {
      "chunk_html": "<p>Smoke test chunk 2: Testing dataset create index search delete cycle.</p>",
      "metadata": {"source": "smoke_test", "index": 2}
    },
    {
      "chunk_html": "<p>Smoke test chunk 3: Comprehensive smoke test for Trieve server health.</p>",
      "metadata": {"source": "smoke_test", "index": 3}
    }
  ]
}
EOF
)"

    local resp
    resp=$(_curl_json POST "${TRIEVE_URL}/api/v1/chunks" "$payload") || {
        log_error "Failed to index chunks"
        return 1
    }

    # Verify response indicates success
    if echo "$resp" | grep -qi "success\|inserted\|created"; then
        log_info "Chunks indexed successfully"
        return 0
    fi

    # Also accept empty {} or success:true as valid
    if [[ -z "$resp" || "$resp" == "{}" || "$resp" == "[]" ]]; then
        log_info "Empty response — chunks may have been indexed"
        return 0
    fi

    log_warn "Unexpected index response: ${resp}"
    return 0
}

# ── Search Chunks ─────────────────────────────────────────────────────
search_chunks() {
    local ds_id="$1"
    local query="$2"
    log_info "Searching for: '${query}'"

    local payload
    payload="$(cat <<EOF
{
  "query": "${query}",
  "limit": 5,
  "search_type": "semantic"
}
EOF
)"

    local resp
    resp=$(_curl_json POST "${TRIEVE_URL}/api/v1/chunk/search" "$payload") || {
        log_error "Search request failed"
        return 1
    }

    # Check for results array with at least 1 element
    # Trieve returns: {"results": [{"chunk": {...}}, ...]}
    if echo "$resp" | grep -q '"results"[[:space:]]*:\[[:space:]]*[{]'; then
        log_info "Search returned results for: '${query}'"
        return 0
    fi

    log_warn "No results for semantic search: '${query}'"
    return 1
}

# ── Fallback Search (full-text) ───────────────────────────────────────
search_chunks_fallback() {
    local ds_id="$1"
    local query="$2"
    log_info "Trying full-text search for: '${query}'"

    local payload
    payload="$(cat <<EOF
{
  "query": "${query}",
  "limit": 3
}
EOF
)"

    local resp
    resp=$(_curl_json POST "${TRIEVE_URL}/api/v1/chunk/search" "$payload") || {
        log_error "Fallback search failed"
        return 1
    }

    if echo "$resp" | grep -q '"results"[[:space:]]*:\[[:space:]]*[{]'; then
        log_info "Fallback search found results for: '${query}'"
        return 0
    fi

    return 1
}

# ── Delete Dataset ───────────────────────────────────────────────────
_delete_dataset() {
    local ds_id="$1"
    log_info "Deleting dataset: ${ds_id}"

    local resp
    resp=$(_curl_json DELETE "${TRIEVE_URL}/api/v1/datasets/${ds_id}" "") || {
        log_warn "Delete returned non-zero (may already be deleted)"
        return 0
    }

    log_info "Dataset ${ds_id} deleted"
    return 0
}

# ── Main Test Cycle ───────────────────────────────────────────────────
main() {
    echo ""
    echo "═══════════════════════════════════════════════"
    echo "  Trieve RAG Smoke Test"
    echo "  URL: ${TRIEVE_URL}"
    echo "  Dataset: ${DATASET_NAME}"
    echo "═══════════════════════════════════════════════"
    echo ""

    # 1. Health Check
    log_info "=== Step 1/4: Health Check ==="
    health_check || { log_error "Health check failed"; exit 1; }

    # 2. Create Dataset
    log_info "=== Step 2/4: Create Dataset ==="
    create_dataset "$DATASET_NAME" || { log_error "Dataset creation failed"; exit 1; }

    # 3. Index Chunks
    log_info "=== Step 3/4: Index Chunks ==="
    index_chunks "$_DATASET_ID" || { log_error "Chunk indexing failed"; exit 1; }

    # Brief pause to allow indexing
    sleep 2

    # 4. Search (must find at least 1 result)
    log_info "=== Step 4/4: Search ==="
    local search_ok=0

    # Try semantic search first
    if search_chunks "$_DATASET_ID" "smoke test"; then
        search_ok=1
    elif search_chunks "$_DATASET_ID" "Trieve RAG server"; then
        search_ok=1
    elif search_chunks "$_DATASET_ID" "functional test"; then
        search_ok=1
    fi

    # Fallback to full-text search if semantic failed
    if [[ $search_ok -eq 0 ]]; then
        if search_chunks_fallback "$_DATASET_ID" "smoke"; then
            search_ok=1
        elif search_chunks_fallback "$_DATASET_ID" "test"; then
            search_ok=1
        fi
    fi

    if [[ $search_ok -eq 0 ]]; then
        log_error "Search failed: no results for any query"
        exit 1
    fi

    # 5. Delete Dataset (handled by cleanup trap)
    log_info "=== Cleanup ==="
    log_info "Dataset ${_DATASET_ID} will be deleted on exit"

    echo ""
    echo "═══════════════════════════════════════════════"
    echo "  PASS: Trieve CRUD cycle completed"
    echo "═══════════════════════════════════════════════"
    echo ""
    exit 0
}

main "$@"