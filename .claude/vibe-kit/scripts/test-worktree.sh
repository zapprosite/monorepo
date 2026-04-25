#!/usr/bin/env bash
#
# test-worktree.sh — Run tests in isolated Git worktree with smart rate limiting
#
# Usage:
#   bash .claude/vibe-kit/scripts/test-worktree.sh <spec> <command> [rpm]
#
# Smart Rate Limiting:
#   - Token bucket with burst allowance
#   - Auto-detects Retry-After headers
#   - Exponential backoff + jitter on 429
#   - Adaptive refill based on observed limits
#

set -euo pipefail

# ─── Smart defaults ────────────────────────────────────────────
DEFAULT_RPM=50
MAX_RPM=200
BURST=10

WORKTREE_DIR="${WORKTREE_DIR:-/tmp/nexus-worktrees}"
SPEC="${1:-}"
COMMAND="${2:-pnpm test}"
TARGET_RPM="${3:-${DEFAULT_RPM}}"

# Clamp RPM to safe range
TARGET_RPM=$(( TARGET_RPM > MAX_RPM ? MAX_RPM : TARGET_RPM ))
TARGET_RPM=$(( TARGET_RPM < 10 ? 10 : TARGET_RPM ))

# Token bucket state
TOKENS="${BURST}"
LAST_REFILL=$(date +%s.%N)
REFILL_RATE=$(echo "scale=6; ${TARGET_RPM} / 60" | bc)

# Backoff state
base_delay=0.5
max_delay=32
retry_count=0

WORKTREE_NAME="nexus-test-$(date +%s)"
# ────────────────────────────────────────────────────────────────

if [[ -z "$SPEC" ]]; then
    echo "Usage: $0 <spec> [command] [rpm]"
    echo "Example: $0 SPEC-204 'pnpm test -- --grep api'"
    echo "Example: $0 SPEC-204 'pnpm test' 100"
    echo ""
    echo "Rate limiting: ${TARGET_RPM} RPM (burst ${BURST}, max ${MAX_RPM})"
    exit 1
fi

log() { echo -e "\033[0;36m[WORKTREE]\033[0m $*"; }
warn() { echo -e "\033[0;33m[WARN]\033[0m $*" >&2; }
error() { echo -e "\033[0;31m[ERROR]\033[0m $*" >&2; }

# ─── Token bucket refill ────────────────────────────────────────
refill_bucket() {
    local now=$(date +%s.%N)
    local elapsed=$(echo "$now - $LAST_REFILL" | bc)
    local refill=$(echo "$elapsed * $REFILL_RATE" | bc)

    TOKENS=$(echo "$TOKENS + $refill" | bc)
    TOKENS=$(echo "$TOKENS > $BURST ? $BURST : $TOKENS" | bc)

    # Clamp to burst limit
    TOKENS=$(printf "%.0f" "$TOKENS" 2>/dev/null || echo "$BURST")
    [[ "$TOKENS" -gt "$BURST" ]] && TOKENS="$BURST"

    LAST_REFILL="$now"
}

# ─── Consume one token (blocking if needed) ───────────────────
consume_token() {
    while true; do
        refill_bucket

        if [[ "${TOKENS%%.*}" -ge 1 ]] 2>/dev/null; then
            TOKENS=$(echo "$TOKENS - 1" | bc)
            return 0
        fi

        # Wait for refill
        local wait_time=$(echo "(1 - $TOKENS) / $REFILL_RATE" | bc)
        sleep "$wait_time" 2>/dev/null || sleep 1
    done
}

# ─── Execute command with smart rate limiting ───────────────────
execute_with_limit() {
    local cmd="$*"
    local exit_code=0

    # Detect if cmd uses curl/wget/etc and wraps it
    if [[ "$cmd" =~ (curl|wget|http|fetch|axios|request) ]]; then
        warn "HTTP request detected — using smart rate limiting"
    fi

    # For non-HTTP commands, just execute directly (tests use mocks)
    if ! [[ "$cmd" =~ (curl|wget|http|fetch|axios|request|api) ]]; then
        eval "$cmd"
        return $?
    fi

    # HTTP commands get rate limited
    while true; do
        consume_token

        set +e
        response=$(eval "$cmd" 2>&1)
        exit_code=$?
        set -e

        # Check for rate limit indicators
        if echo "$response" | grep -qiE "(rate.limit|429|too.many|retry.after)"; then
            retry_after=$(echo "$response" | grep -i "retry-after" | sed 's/[^0-9]//g' || echo "")

            if [[ -n "$retry_after" ]] && [[ "$retry_after" -gt 0 ]]; then
                log "Rate limited — waiting ${retry_after}s (server says retry)"
                sleep "$retry_after"
            else
                retry_count=$((retry_count + 1))
                local delay=$(echo "$base_delay * 2^$retry_count + (RANDOM % 100) / 1000" | bc)
                delay=$(echo "$delay > $max_delay ? $max_delay : $delay" | bc)
                log "Rate limited — backing off ${delay}s (attempt $retry_count)"
                sleep "$delay"
                continue
            fi
        elif [[ $exit_code -eq 0 ]]; then
            echo "$response"
            return 0
        else
            echo "$response" >&2
            return $exit_code
        fi
    done
}

# ─── Create worktree ───────────────────────────────────────────
log "Creating worktree: ${WORKTREE_NAME}"
WORKTREE_PATH="${WORKTREE_DIR}/${WORKTREE_NAME}"

mkdir -p "${WORKTREE_DIR}"

git worktree add "${WORKTREE_PATH}" -b "${WORKTREE_NAME}" 2>/dev/null || {
    error "Failed to create worktree"
    exit 1
}

cleanup() {
    log "Cleaning up worktree: ${WORKTREE_PATH}"
    git worktree remove "${WORKTREE_PATH}" --force 2>/dev/null || true
    git branch -D "${WORKTREE_NAME}" 2>/dev/null || true
}

trap cleanup EXIT

log "Worktree: ${WORKTREE_PATH}"
log "Rate limit: ${TARGET_RPM} RPM (burst ${BURST}, token bucket)"

# ─── Install deps ──────────────────────────────────────────────
log "Installing dependencies..."
cd "${WORKTREE_PATH}"
pnpm install --frozen-lockfile > /dev/null 2>&1

# ─── Run command ───────────────────────────────────────────────
log "Executing: ${COMMAND}"

# If command has HTTP calls, use rate limiter
if [[ "$COMMAND" =~ (curl|wget|http|fetch|axios|request|api) ]]; then
    execute_with_limit "$COMMAND"
else
    # Direct execution for normal tests (they use mocks, not real HTTP)
    eval "$COMMAND"
fi
TEST_EXIT=$?

if [[ $TEST_EXIT -eq 0 ]]; then
    log "Tests PASSED"
else
    error "Tests FAILED (exit code: $TEST_EXIT)"
fi

exit $TEST_EXIT
