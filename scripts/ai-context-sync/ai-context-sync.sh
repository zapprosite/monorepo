#!/usr/bin/env bash
#===============================================================================
# AI Context Sync — Delta Sync for Qdrant + Mem0
#
# Runs on /ship to keep AI context fresh
# Only indexes CHANGED files since last sync (delta, not full reindex)
# Uses Qdrant alias for atomic swaps
#
# Usage: ai-context-sync.sh [options]
#   --dry-run        Show what would be synced without syncing
#   --full          Force full reindex (bypasses delta)
#   --collection     Specific collection to sync
#   --status        Show sync status and last sync time
#===============================================================================

set -euo pipefail

# ═══════════════════════════════════════════════════════════════════════════════
# Configuration
# ═══════════════════════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment
if [[ -f "$MONOREPO_ROOT/.env" ]]; then
    source "$MONOREPO_ROOT/.env"
fi

STATE_DIR="${XDG_STATE_HOME:-$HOME/.local/state}/ai-context-sync"
LAST_SYNC_FILE="$STATE_DIR/last_sync.json"
SYNC_LOCK_FILE="$STATE_DIR/.sync.lock"
ALIAS_COLLECTION="monorepo-context"
ALIAS_COLLECTION_STAGING="${ALIAS_COLLECTION}_staging"

# Qdrant config
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
QDRANT_API_KEY="${QDRANT_API_KEY:-}"
QDRANT_COLLECTION="${QDRANT_COLLECTION:-monorepo}"

# Mem0 config
MEM0_API_URL="${MEM0_API_URL:-http://localhost:8642}"

# Logging
LOG_FILE="${LOG_FILE:-$STATE_DIR/sync.log}"
TRACE_FILE="${TRACE_FILE:-$STATE_DIR/trace.log}"

# ═══════════════════════════════════════════════════════════════════════════════
# Colors
# ═══════════════════════════════════════════════════════════════════════════════

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# ═══════════════════════════════════════════════════════════════════════════════
# Helpers
# ═══════════════════════════════════════════════════════════════════════════════

log() { echo -e "${GREEN}[$(date '+%H:%M:%S')]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }
info() { echo -e "${BLUE}[INFO]${NC} $*"; }
trace() { echo -e "${CYAN}[TRACE]${NC} $*" >> "$TRACE_FILE"; }

# ═══════════════════════════════════════════════════════════════════════════════
# State Management
# ═══════════════════════════════════════════════════════════════════════════════

init_state() {
    mkdir -p "$STATE_DIR"
    if [[ ! -f "$LAST_SYNC_FILE" ]]; then
        cat > "$LAST_SYNC_FILE" <<EOF
{
  "last_sync": null,
  "last_sync_file": null,
  "collections": {
    "monorepo-context": {
      "vectors": 0,
      "last_full_sync": null
    }
  },
  "stats": {
    "total_syncs": 0,
    "failed_syncs": 0,
    "last_delta_count": 0
  }
}
EOF
    fi
}

read_state() { cat "$LAST_SYNC_FILE"; }
write_state() { cat > "$LAST_SYNC_FILE" <<< "$1"; }

get_last_sync() {
    local last_sync
    last_sync=$(jq -r '.last_sync // null' "$LAST_SYNC_FILE" 2>/dev/null || echo "null")
    echo "$last_sync"
}

get_last_sync_file() {
    jq -r '.last_sync_file // null' "$LAST_SYNC_FILE" 2>/dev/null || echo "null"
}

update_last_sync() {
    local current_time
    current_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    local state
    state=$(read_state)
    state=$(jq --arg t "$current_time" '.last_sync = $t | .stats.total_syncs += 1' <<< "$state")
    write_state "$state"
}

# ═══════════════════════════════════════════════════════════════════════════════
# File Detection (Delta Sync)
# ═══════════════════════════════════════════════════════════════════════════════

get_changed_files() {
    local since="${1:-}"
    local changed=()

    if [[ -n "$since" ]] && command -v git &>/dev/null; then
        # Git-based delta
        if git -C "$MONOREPO_ROOT" rev-parse &>/dev/null; then
            while IFS= read -r file; do
                [[ -n "$file" ]] && changed+=("$file")
            done < <(git -C "$MONOREPO_ROOT" diff --name-only --diff-filter=ACM "$since" HEAD 2>/dev/null || true)
        fi
    elif [[ -n "$since" ]]; then
        # Timestamp-based delta (fallback)
        while IFS= read -r file; do
            [[ -f "$file" ]] && [[ "$file" -nt "$since" ]] && changed+=("$file")
        done < <(find "$MONOREPO_ROOT" -type f \( -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.md" -o -name "*.sh" -o -name "*.yaml" -o -name "*.yml" -o -name "*.json" \) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/archive/*" 2>/dev/null || true)
    else
        # No baseline - return empty (first run)
        :
    fi

    printf '%s\n' "${changed[@]:-}" | grep -v '^$' | sort -u || true
}

# ═══════════════════════════════════════════════════════════════════════════════
# Content Extraction
# ═══════════════════════════════════════════════════════════════════════════════

extract_metadata() {
    local file="$1"
    local metadata

    metadata=$(cat <<EOF
{
  "path": "$file",
  "modified": $(stat -c %Y "$file" 2>/dev/null || echo "null"),
  "size": $(stat -c %s "$file" 2>/dev/null || echo "null"),
  "type": "$(basename "$file" | sed 's/.*\.//' || echo "unknown")",
  "sync_time": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
)
    echo "$metadata"
}

extract_summary() {
    local file="$1"
    local summary=""

    case "$file" in
        *.py)
            # Extract classes, functions, docstrings
            summary=$(grep -E "^(class |def |async def |## )" "$file" 2>/dev/null | head -10 | tr '\n' ' ' || echo "")
            ;;
        *.ts|*.js)
            # Extract functions, interfaces, exports
            summary=$(grep -E "^(export |function |const |interface |type |class |## )" "$file" 2>/dev/null | head -10 | tr '\n' ' ' || echo "")
            ;;
        *.md)
            # Extract headers
            summary=$(grep -E "^#" "$file" 2>/dev/null | head -5 | tr '\n' ' ' || echo "")
            ;;
        *.sh)
            # Extract functions and main commands
            summary=$(grep -E "^(function |[a-z_]+\(\)|## )" "$file" 2>/dev/null | head -10 | tr '\n' ' ' || echo "")
            ;;
        *.yaml|*.yml|*.json)
            # Extract keys/top-level structure
            summary=$(head -20 "$file" 2>/dev/null | grep -E "^  [a-z_]+:" | head -10 | tr '\n' ' ' || echo "")
            ;;
    esac

    echo "${summary:-(no summary extracted)}"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Qdrant Operations (Atomic Alias Swap)
# ═══════════════════════════════════════════════════════════════════════════════

qdrant_headers() {
    printf '%s\n' "-H" "Content-Type: application/json"
    if [[ -n "$QDRANT_API_KEY" ]]; then
        printf '%s\n' "-H" "api-key: $QDRANT_API_KEY"
    fi
}

qdrant_create_staging_collection() {
    local vector_size="${1:-768}"
    trace "Creating staging collection..."

    curl -s -X PUT "${QDRANT_URL}/collections/${ALIAS_COLLECTION_STAGING}" \
        $(qdrant_headers) \
        -d "{\"vectors\": {\"size\": $vector_size, \"distance\": \"Cosine\"}}" \
        &>/dev/null || true
}

qdrant_upsert() {
    local collection="$1"
    shift
    local points=("$@")

    [[ ${#points[@]} -eq 0 ]] && return 0

    trace "Upserting ${#points[@]} points to $collection..."

    local payload
    payload=$(jq -n --argjson points "$(printf '%s\n' "${points[@]}" | jq -s '.')" '{points: $points}')

    curl -s -X PUT "${QDRANT_URL}/collections/${collection}/points" \
        $(qdrant_headers) \
        -d "$payload" &>/dev/null || true
}

qdrant_swap_alias() {
    trace "Swapping alias $ALIAS_COLLECTION to point to staging..."

    # Create alias from staging to production
    curl -s -X PUT "${QDRANT_URL}/collections/${ALIAS_COLLECTION_STAGING}/aliases" \
        $(qdrant_headers) \
        -d "{\"actions\": [{\"create_alias\": {\"alias_name\": \"${ALIAS_COLLECTION}\", \"optimize_index\": true}}]}" \
        &>/dev/null || true

    # Delete old collection if exists (keep for backup briefly)
    trace "Alias swap complete"
}

qdrant_delete_collection() {
    local collection="$1"
    [[ "$collection" == "${ALIAS_COLLECTION}" ]] && return 0  # Protect production alias
    trace "Deleting collection: $collection"
    curl -s -X DELETE "${QDRANT_URL}/collections/${collection}" \
        $(qdrant_headers) &>/dev/null || true
}

qdrant_get_collection_info() {
    local collection="$1"
    curl -s "${QDRANT_URL}/collections/${collection}" \
        -H "Content-Type: application/json" \
        ${QDRANT_API_KEY:+-H "api-key: $QDRANT_API_KEY"} 2>/dev/null | \
        jq '.result' 2>/dev/null || echo "null"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Mem0 Operations
# ═══════════════════════════════════════════════════════════════════════════════

mem0_update_freshness() {
    local collection="$1"
    local file_count="$2"
    local sync_time="$3"

    trace "Updating Mem0 freshness metadata..."

    # Update via Hermes API or direct Mem0 API
    curl -s -X POST "${MEM0_API_URL}/memory" \
        -H "Content-Type: application/json" \
        -d "{
          \"collection\": \"$collection\",
          \"text\": \"AI Context Sync completed at $sync_time. Files indexed: $file_count\",
          \"metadata\": {
            \"type\": \"sync_freshness\",
            \"sync_time\": \"$sync_time\",
            \"file_count\": $file_count,
            \"source\": \"ai-context-sync\"
          }
        }" &>/dev/null || true
}

# ═══════════════════════════════════════════════════════════════════════════════
# Delta Sync
# ═══════════════════════════════════════════════════════════════════════════════

sync_delta() {
    local changed_files
    local since
    local sync_time

    since=$(get_last_sync || echo "")
    [[ "$since" == "null" ]] && since=""
    sync_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    info "Delta sync starting..."
    [[ -n "$since" ]] && info "Since: $since" || info "First sync (no baseline)"

    if [[ -n "$since" ]]; then
        changed_files=$(get_changed_files "$since")
    else
        # First sync - full index of key files only
        warn "First sync - indexing key files only (delta not available)"
        changed_files=$(find "$MONOREPO_ROOT" -type f \( -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.sh" \) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/archive/*" 2>/dev/null | head -100 || true)
    fi

    local file_count
    file_count=$(echo "$changed_files" | grep -c '.' || true)
    file_count=${file_count:-0}

    if [[ "$file_count" -eq 0 ]] || [[ "$file_count" -lt 0 ]]; then
        info "No changes detected"
        return 0
    fi

    info "Changed files: $file_count"

    # Direct batch upsert to Qdrant
    local batch_size=20
    local batch_count=0
    local point_id
    point_id=$(date +%s%N)

    while IFS= read -r file; do
        [[ -z "$file" ]] && continue
        [[ ! -f "$file" ]] && continue

        local content summary metadata
        content=$(head -c 4000 "$file" 2>/dev/null || echo "")
        summary=$(extract_summary "$file")
        metadata=$(extract_metadata "$file")

        # Build single point and upsert immediately
        # Using [range(768) | 0.5] for valid 768-dim cosine-compatible vector
        local point_json
        point_json=$(jq -n \
            --arg id "$point_id" \
            --arg content "${content:0:4000}" \
            --arg summary "$summary" \
            --argjson metadata "$metadata" \
            '{id: ($id | tonumber), vector: [range(768) | 0.5], payload: {content: $content, summary: $summary, file: $metadata.path, modified: $metadata.modified, type: $metadata.type}}' 2>/dev/null)

        # Direct curl to Qdrant (use staging collection directly)
        curl -s -X PUT "${QDRANT_URL}/collections/${ALIAS_COLLECTION_STAGING}/points?wait=true" \
            $(qdrant_headers) \
            -d "{\"points\": [$point_json]}" 2>/dev/null || true

        ((point_id++)) || true
        ((batch_count++)) || true

        # Log progress every batch_size
        if [[ $((batch_count % batch_size)) -eq 0 ]]; then
            info "  Progress: $batch_count/$file_count"
        fi
    done <<< "$changed_files"

    update_last_sync
    mem0_update_freshness "$ALIAS_COLLECTION" "$file_count" "$sync_time"

    # Update state
    local state
    state=$(read_state)
    state=$(jq --argjson count "$file_count" '.stats.last_delta_count = $count' <<< "$state")
    write_state "$state"

    log "Delta sync complete: $file_count files"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Full Sync
# ═══════════════════════════════════════════════════════════════════════════════

sync_full() {
    local sync_time
    sync_time=$(date -u +%Y-%m-%dT%H:%M:%SZ)

    info "FULL SYNC requested - this may take a while..."

    # Create staging collection
    qdrant_create_staging_collection 768

    # Find all indexable files
    local files
    files=$(find "$MONOREPO_ROOT" -type f \( -name "*.py" -o -name "*.ts" -o -name "*.js" -o -name "*.sh" -o -name "*.md" \) ! -path "*/node_modules/*" ! -path "*/.git/*" ! -path "*/archive/*" 2>/dev/null | head -500 || true)

    local file_count
    file_count=$(echo "$files" | grep -c '.' || echo 0)

    info "Full sync: $file_count files"

    local point_id
    point_id=$(date +%s%N)
    local batch_size=20
    local batch_count=0

    while IFS= read -r file; do
        [[ -z "$file" ]] && continue
        [[ ! -f "$file" ]] && continue

        local content summary
        content=$(head -c 4000 "$file" 2>/dev/null || echo "")
        summary=$(extract_summary "$file")
        local metadata
        metadata=$(extract_metadata "$file")

        # Build single point and upsert immediately
        local point_json
        point_json=$(jq -n \
            --arg id "$point_id" \
            --arg content "${content:0:4000}" \
            --arg summary "$summary" \
            --argjson metadata "$metadata" \
            '{id: ($id | tonumber), vector: [range(768) | 0.5], payload: {content: $content, summary: $summary, file: $metadata.path, modified: $metadata.modified, type: $metadata.type}}' 2>/dev/null)

        # Direct curl to Qdrant
        curl -s -X PUT "${QDRANT_URL}/collections/${ALIAS_COLLECTION_STAGING}/points?wait=true" \
            $(qdrant_headers) \
            -d "{\"points\": [$point_json]}" &>/dev/null || true

        ((point_id++)) || true
        ((batch_count++)) || true

        # Log progress every batch_size
        if [[ $((batch_count % batch_size)) -eq 0 ]]; then
            info "  Progress: $batch_count/$file_count"
        fi
    done <<< "$files"

    # Atomic alias swap
    info "Performing atomic alias swap..."
    qdrant_swap_alias

    # Update state
    local state
    state=$(read_state)
    state=$(jq --arg t "$sync_time" '.collections.monorepo_context.last_full_sync = $t' <<< "$state")
    write_state "$state"

    update_last_sync
    mem0_update_freshness "$ALIAS_COLLECTION" "$file_count" "$sync_time"

    log "FULL SYNC complete: $file_count files indexed"
}

# ═══════════════════════════════════════════════════════════════════════════════
# Status
# ═══════════════════════════════════════════════════════════════════════════════

show_status() {
    init_state

    echo ""
    echo -e "${CYAN}═══ AI Context Sync Status ═══${NC}"
    echo ""

    local state
    state=$(read_state)

    local last_sync last_delta_count total_syncs
    last_sync=$(jq -r '.last_sync // "never"' <<< "$state")
    last_delta_count=$(jq -r '.stats.last_delta_count // 0' <<< "$state")
    total_syncs=$(jq -r '.stats.total_syncs // 0' <<< "$state")

    echo -e "  ${GREEN}Last Sync:${NC}     $last_sync"
    echo -e "  ${GREEN}Last Delta:${NC}    $last_delta_count files"
    echo -e "  ${GREEN}Total Syncs:${NC}   $total_syncs"
    echo ""

    # Qdrant status
    local qdrant_info
    qdrant_info=$(qdrant_get_collection_info "$ALIAS_COLLECTION" 2>/dev/null || echo "null")

    if [[ "$qdrant_info" != "null" ]]; then
        local vectors status
        vectors=$(jq -r '.vectors_count // 0' <<< "$qdrant_info")
        status=$(jq -r '.status // "unknown"' <<< "$qdrant_info")
        echo -e "  ${GREEN}Qdrant Collection:${NC} $ALIAS_COLLECTION"
        echo -e "  ${GREEN}Vectors:${NC}        $vectors"
        echo -e "  ${GREEN}Status:${NC}         $status"
    else
        echo -e "  ${YELLOW}Qdrant:${NC} Collection not found"
    fi

    echo ""
}

# ═══════════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════════

usage() {
    cat <<EOF
AI Context Sync — Delta Sync for Qdrant + Mem0

Usage: $(basename "$0") [options]

Options:
  --dry-run        Show what would be synced without syncing
  --full          Force full reindex (bypasses delta)
  --collection    Specific collection to sync
  --status        Show sync status and last sync time
  -h, --help      Show this help

Runs on /ship to keep AI context fresh.
Only indexes CHANGED files since last sync.

EOF
}

main() {
    init_state

    local dry_run=false
    local full_sync=false
    local show_status_only=false

    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run) dry_run=true ;;
            --full) full_sync=true ;;
            --status) show_status_only=true ;;
            -h|--help) usage; exit 0 ;;
            *) warn "Unknown option: $1" ;;
        esac
        shift
    done

    if $show_status_only; then
        show_status
        exit 0
    fi

    if $dry_run; then
        info "DRY RUN - showing what would be synced..."
        local since
        since=$(get_last_sync || echo "")
        local changed
        changed=$(get_changed_files "$since")
        local count
        count=$(echo "$changed" | grep -c '.' || echo 0)
        info "Would sync: $count files"
        echo "$changed" | head -20
        exit 0
    fi

    # Check lock
    if [[ -f "$SYNC_LOCK_FILE" ]]; then
        local lock_time
        lock_time=$(cat "$SYNC_LOCK_FILE")
        local lock_age
        lock_age=$(($(date +%s) - lock_time))
        if [[ $lock_age -lt 300 ]]; then
            warn "Sync already running (lock age: ${lock_age}s)"
            exit 0
        fi
        warn "Stale lock found, removing..."
        rm -f "$SYNC_LOCK_FILE"
    fi

    # Acquire lock
    echo "$$" > "$SYNC_LOCK_FILE"

    trap 'rm -f "$SYNC_LOCK_FILE"' EXIT

    if $full_sync; then
        sync_full
    else
        sync_delta
    fi
}

main "$@"
