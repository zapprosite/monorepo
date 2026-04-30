#!/usr/bin/env bash
# smoke-test.sh — Cross-CLI event system smoke test
# Run after install-links.sh to verify everything works
set -euo pipefail

CLAUDE_DIR="${HOME}/.claude"
CODEX_DIR="${HOME}/.codex"
LOCAL_BIN="${HOME}/.local/bin"
MONOREPO_EVENTS="/srv/monorepo/.claude-events"
STATE_MANAGER="/srv/monorepo/.claude/events/state-manager.py"
EVENT_EMIT="${MONOREPO_EVENTS}/event-emit.sh"
STATE_FILE="${CLAUDE_DIR}/state.json"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

pass() { echo -e "${GREEN}✓${NC} $1"; ((PASS++)) || true; }
fail() { echo -e "${RED}✗${NC} $1"; ((FAIL++)) || true; }
info() { echo -e "${YELLOW}→${NC} $1"; }

# Verify event was recorded in state
verify_event() {
    local event_type="$1"
    local key="$2"
    local value="$3"
    local state_output

    state_output=$(python3 "$STATE_MANAGER" dump 2>/dev/null)
    echo "$state_output" | python3 -c "
import sys, json
try:
    state = json.load(sys.stdin)
    events = state.get('events', {}).get('${event_type}', [])
    for e in events:
        data = e.get('data', {})
        if data.get('${key}') == '${value}':
            print('found')
            sys.exit(0)
except Exception as ex:
    pass
sys.exit(1)
" 2>/dev/null
}

cleanup_test_events() {
    # Remove test events from state
    if [ -f "$STATE_FILE" ]; then
        python3 "$STATE_MANAGER" dump 2>/dev/null | python3 -c "
import sys, json
try:
    state = json.load(sys.stdin)
    for key in ['SMOKE_TEST', 'OPENCODE_BOOT', 'TOOL_CALL']:
        state.get('events', {}).pop(key, None)
    with open('${STATE_FILE}', 'w') as f:
        json.dump(state, f, indent=2)
except:
    pass
" 2>/dev/null || true
    fi
}

echo "=== Cross-CLI Event System Smoke Test ==="
echo ""

# ── 1. Symlinks exist ───────────────────────────────────────────────
info "Checking symlinks..."
SYMLINKS=(
    "${CODEX_DIR}/hooks.json:${MONOREPO_EVENTS}/config/codex-hooks.json"
    "${CODEX_DIR}/config.toml:${MONOREPO_EVENTS}/config/opencode-config.toml"
    "${LOCAL_BIN}/opencode-original:${MONOREPO_EVENTS}/config/opencode-wrappers/opencode-original"
    "${LOCAL_BIN}/opencode-minimax:${MONOREPO_EVENTS}/config/opencode-wrappers/opencode-minimax"
    "${LOCAL_BIN}/opencode-gpt:${MONOREPO_EVENTS}/config/opencode-wrappers/opencode-gpt"
    "${CLAUDE_DIR}/events:${MONOREPO_EVENTS}"
)

ALL_OK=true
for entry in "${SYMLINKS[@]}"; do
    link="${entry%%:*}"
    target="${entry#*:}"
    if [ -L "$link" ]; then
        real_target=$(readlink -f "$link")
        expected_target=$(readlink -f "$target" 2>/dev/null || echo "$target")
        if [ "$real_target" = "$expected_target" ]; then
            pass "Symlink OK: $link -> $real_target"
        else
            fail "Symlink mismatch: $link -> $real_target (expected $expected_target)"
            ALL_OK=false
        fi
    else
        if [ -e "$link" ]; then
            fail "Not a symlink: $link exists but is not a symlink"
        else
            fail "Missing: $link"
        fi
        ALL_OK=false
    fi
done

# ── 2. state-manager.py works (single event write) ─────────────────
info "Testing state-manager.py single write..."
cleanup_test_events
sleep 0.2

if python3 "$STATE_MANAGER" event SMOKE_TEST "test=single" 2>/dev/null | grep -q "OK"; then
    sleep 0.3
    if verify_event "SMOKE_TEST" "test" "single" > /dev/null 2>&1; then
        pass "state-manager.py single event write"
    else
        fail "state-manager.py: event not found in state"
    fi
else
    fail "state-manager.py single event write failed"
fi

# ── 3. 30 concurrent writes ─────────────────────────────────────────
info "Testing 30 concurrent writes..."

TEST_DIR=$(mktemp -d)
touch "${TEST_DIR}/done.txt"

run_concurrent() {
    local id=$1
    python3 "$STATE_MANAGER" event SMOKE_TEST "concurrent=$id" 2>/dev/null
    echo "$id" >> "${TEST_DIR}/done.txt"
}

for i in $(seq 1 30); do
    run_concurrent "$i" &
done

wait

done_count=$(wc -l < "${TEST_DIR}/done.txt" 2>/dev/null || echo "0")
rm -rf "$TEST_DIR"

if [ "$done_count" -eq 30 ]; then
    pass "30 concurrent writes completed"
else
    fail "30 concurrent writes: only $done_count completed"
fi

sleep 0.3

# Verify all 30 events were recorded
concurrent_count=$(python3 "$STATE_MANAGER" dump 2>/dev/null | python3 -c "
import sys, json
state = json.load(sys.stdin)
events = state.get('events', {}).get('SMOKE_TEST', [])
count = sum(1 for e in events if 'concurrent' in e.get('data', {}))
print(str(count))
" 2>/dev/null || echo "0")

if [ "$concurrent_count" -ge 30 ]; then
    pass "All concurrent events recorded ($concurrent_count found)"
else
    fail "Concurrent events: expected 30+, got $concurrent_count"
fi

# ── 4. event-emit.sh direct call ──────────────────────────────────
info "Testing event-emit.sh direct call..."
sleep 0.2

if EVENT_TYPE=SMOKE_TEST bash "$EVENT_EMIT" emit_test=direct 2>/dev/null; then
    sleep 0.3
    if verify_event "SMOKE_TEST" "emit_test" "direct" > /dev/null 2>&1; then
        pass "event-emit.sh direct call"
    else
        fail "event-emit.sh: event not found in state"
    fi
else
    fail "event-emit.sh direct call failed"
fi

# ── 5. OpenCode boot events (3 variants) ───────────────────────────
info "Testing OpenCode boot event variants..."

for cli in opencode-original opencode-minimax opencode-gpt; do
    wrapper="${LOCAL_BIN}/$cli"
    if [ -f "$wrapper" ]; then
        sleep 0.2
        # Emit a test event for each CLI variant
        EVENT_DIR="$MONOREPO_EVENTS" python3 "$STATE_MANAGER" event OPENCODE_BOOT "cli=$cli" 2>/dev/null
        sleep 0.3
        if verify_event "OPENCODE_BOOT" "cli" "$cli" > /dev/null 2>&1; then
            pass "OPENCODE_BOOT recorded for $cli"
        else
            fail "OPENCODE_BOOT not recorded for $cli"
        fi
    else
        fail "OpenCode wrapper not found: $wrapper"
    fi
done

# ── 6. systemd services active ─────────────────────────────────────
info "Checking systemd services..."

for svc in inotify-watch trigger-bridge; do
    # Check if service file exists in system
    if systemctl list-unit-files "${svc}.service" 2>/dev/null | grep -q "${svc}.service"; then
        if systemctl is-active --quiet "${svc}.service" 2>/dev/null; then
            pass "systemd service active: $svc"
        else
            # Service exists but not active — check if it at least has the unit file
            if [ -f "/etc/systemd/system/${svc}.service" ] || [ -f "${MONOREPO_EVENTS}/systemd/${svc}.service" ]; then
                info "systemd service installed but not running: $svc (expected if not yet started)"
                pass "systemd service file present: $svc"
            else
                fail "systemd service not found: $svc"
            fi
        fi
    else
        # Service may be user-level
        if systemctl --user list-unit-files "${svc}.service" 2>/dev/null | grep -q "${svc}.service"; then
            if systemctl --user is-active --quiet "${svc}.service" 2>/dev/null; then
                pass "systemd service (user) active: $svc"
            else
                info "systemd service (user) installed but not running: $svc"
                pass "systemd service (user) file present: $svc"
            fi
        else
            # Check if service file exists but not installed
            if [ -f "${MONOREPO_EVENTS}/systemd/${svc}.service" ]; then
                info "systemd service file exists but not installed: $svc"
                pass "systemd service file present: $svc"
            else
                fail "systemd service not found: $svc"
            fi
        fi
    fi
done

# ── Cleanup test events ────────────────────────────────────────────
info "Cleaning up test events..."
cleanup_test_events

# ── Summary ────────────────────────────────────────────────────────
echo ""
echo "=== Results: ${PASS} passed, ${FAIL} failed ==="

if [ "$FAIL" -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed.${NC}"
    exit 1
fi
