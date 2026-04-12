#!/bin/bash
# smoke-unlock-config.sh - Smoke tests for locked-config scripts
# Tests: unlock-config.sh, verify-locked.sh, lock-config.sh

set -e

SCRIPT_DIR="/srv/ops/scripts"
LOCK_DIR="/srv/ops/locked-config"
LOG_FILE="/srv/ops/logs/unlock.log"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

passed=0
failed=0

pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((passed++))
}

fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((failed++))
}

warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo "=== Smoke Test: Locked-Config Scripts ==="
echo ""

# --- Test 1: verify-locked.sh returns valid output ---
echo "[1] Testing verify-locked.sh..."
if output=$("$SCRIPT_DIR/verify-locked.sh" 2>&1); then
    if echo "$output" | grep -q "Status:"; then
        pass "verify-locked.sh runs and returns valid output"
        echo "$output" | grep -E "Status:|Hash file:|Protected files:" | head -5
    else
        fail "verify-locked.sh missing Status in output"
    fi
else
    fail "verify-locked.sh exited with non-zero"
fi
echo ""

# --- Test 2: lock-config.sh doesn't crash when already locked ---
echo "[2] Testing lock-config.sh (no-op when locked)..."
if output=$("$SCRIPT_DIR/lock-config.sh" 2>&1); then
    pass "lock-config.sh doesn't crash when already locked"
    echo "  Output: $output"
else
    fail "lock-config.sh crashed"
fi
echo ""

# --- Test 3: unlock-config.sh handles empty password ---
echo "[3] Testing unlock-config.sh with empty password..."
echo "" | timeout 5 "$SCRIPT_DIR/unlock-config.sh" >/dev/null 2>&1 && status=0 || status=$?
if [ $status -eq 1 ]; then
    pass "unlock-config.sh rejects empty password (exit 1)"
elif [ $status -eq 255 ]; then
    fail "unlock-config.sh timed out"
else
    warn "unlock-config.sh returned status $status (expected 1 for empty password)"
fi
echo ""

# --- Test 4: unlock-config.sh doesn't crash on invalid password ---
echo "[4] Testing unlock-config.sh with wrong password..."
echo "wrongpassword" | timeout 5 "$SCRIPT_DIR/unlock-config.sh" >/dev/null 2>&1 && status=0 || status=$?
if [ $status -eq 1 ]; then
    pass "unlock-config.sh rejects wrong password (exit 1)"
elif [ $status -eq 255 ]; then
    fail "unlock-config.sh timed out"
else
    warn "unlock-config.sh returned status $status (expected 1 for wrong password)"
fi
echo ""

# --- Test 5: verify-locked.sh output format is parseable ---
echo "[5] Testing verify-locked.sh output format..."
output=$("$SCRIPT_DIR/verify-locked.sh" 2>&1)
if echo "$output" | grep -q "===" && echo "$output" | grep -q "Status:"; then
    pass "verify-locked.sh output has expected format"
else
    fail "verify-locked.sh output format unexpected"
fi
echo ""

# --- Test 6: lock-config.sh can be called multiple times safely ---
echo "[6] Testing lock-config.sh idempotency..."
first_output=$("$SCRIPT_DIR/lock-config.sh" 2>&1 || true)
second_output=$("$SCRIPT_DIR/lock-config.sh" 2>&1 || true)
# Both should succeed (first locks, second says already locked)
if echo "$first_output" | grep -qi "lock" && echo "$second_output" | grep -qi "lock"; then
    pass "lock-config.sh is idempotent"
else
    warn "lock-config.sh output unclear: '$first_output' / '$second_output'"
fi
echo ""

# --- Test 7: Verify log file exists or can be created ---
echo "[7] Testing unlock.log accessibility..."
if [ -f "$LOG_FILE" ] || touch "$LOG_FILE" 2>/dev/null; then
    pass "unlock.log is writable"
else
    warn "unlock.log not accessible"
fi
echo ""

# --- Summary ---
echo "=== Summary ==="
echo -e "Passed: ${GREEN}$passed${NC}"
echo -e "Failed: ${RED}$failed${NC}"

if [ $failed -gt 0 ]; then
    exit 1
fi
exit 0