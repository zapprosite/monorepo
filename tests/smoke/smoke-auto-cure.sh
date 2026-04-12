#!/bin/bash
# smoke-auto-cure.sh - Smoke tests for auto-cure-scanner.sh
# Tests: runs scanner, verifies output format, checks log creation

set -e

SCRIPT="/srv/monorepo/tasks/autonomous/auto-cure-scanner.sh"
LOG_DIR="/srv/monorepo/logs/autonomous"

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

echo "=== Smoke Test: Auto-Cure Scanner ==="
echo ""

# --- Test 1: Script exists and is executable ---
echo "[1] Checking auto-cure-scanner.sh exists..."
if [ -f "$SCRIPT" ]; then
    pass "auto-cure-scanner.sh exists"
else
    fail "auto-cure-scanner.sh not found at $SCRIPT"
    exit 1
fi

if [ -x "$SCRIPT" ]; then
    pass "auto-cure-scanner.sh is executable"
else
    warn "auto-cure-scanner.sh not executable, running with bash"
fi
echo ""

# --- Test 2: Script runs without crashing ---
echo "[2] Testing script execution (no crash)..."
mkdir -p "$LOG_DIR"
if output=$(bash "$SCRIPT" 2>&1); then
    pass "auto-cure-scanner.sh runs without crash"
else
    fail "auto-cure-scanner.sh exited with error"
fi
echo ""

# --- Test 3: Output contains scan sections ---
echo "[3] Checking output format (scan sections)..."
required_sections=("SCAN 1" "SCAN 2" "SCAN 3" "SCAN 4" "SCAN 5")
missing=0
for section in "${required_sections[@]}"; do
    if echo "$output" | grep -q "$section"; then
        echo -e "  ${GREEN}Found${NC} $section"
    else
        echo -e "  ${RED}Missing${NC} $section"
        ((missing++))
    fi
done
if [ $missing -eq 0 ]; then
    pass "All required scan sections present"
else
    fail "Missing $missing scan sections"
fi
echo ""

# --- Test 4: Output contains PASS/FAIL/WARN indicators ---
echo "[4] Checking output has PASS/FAIL/WARN indicators..."
indicators=0
if echo "$output" | grep -q "PASS"; then
    pass_count=$(echo "$output" | grep -c "PASS" || true)
    echo -e "  ${GREEN}Found${NC} $pass_count PASS lines"
    ((indicators++))
fi
if echo "$output" | grep -q "FAIL"; then
    fail_count=$(echo "$output" | grep -c "FAIL" || true)
    echo -e "  ${GREEN}Found${NC} $fail_count FAIL lines"
    ((indicators++))
fi
if echo "$output" | grep -q "WARN"; then
    warn_count=$(echo "$output" | grep -c "WARN" || true)
    echo -e "  ${GREEN}Found${NC} $warn_count WARN lines"
    ((indicators++))
fi
if [ $indicators -gt 0 ]; then
    pass "Output contains status indicators (PASS/FAIL/WARN)"
else
    fail "Output missing PASS/FAIL/WARN indicators"
fi
echo ""

# --- Test 5: Output contains scan start and complete markers ---
echo "[5] Checking for scan markers..."
if echo "$output" | grep -q "AUTO-CURE SCAN STARTING"; then
    pass "Found SCAN STARTING marker"
else
    fail "Missing SCAN STARTING marker"
fi
if echo "$output" | grep -q "SCAN COMPLETE"; then
    pass "Found SCAN COMPLETE marker"
else
    fail "Missing SCAN COMPLETE marker"
fi
echo ""

# --- Test 6: Log file was created ---
echo "[6] Checking log file creation..."
# Find the most recent log file
if [ -d "$LOG_DIR" ]; then
    latest_log=$(ls -t "$LOG_DIR"/auto-cure-*.log 2>/dev/null | head -1)
    if [ -n "$latest_log" ]; then
        pass "Log file created: $(basename "$latest_log")"
        # Verify log has content
        if [ -s "$latest_log" ]; then
            pass "Log file has content ($(wc -l < "$latest_log") lines)"
        else
            warn "Log file is empty"
        fi
    else
        warn "No log file found in $LOG_DIR"
    fi
else
    warn "Log directory $LOG_DIR does not exist"
fi
echo ""

# --- Test 7: Output includes pinned services check ---
echo "[7] Checking for pinned services section..."
if echo "$output" | grep -qE "PINNED|Services Status"; then
    pass "Found pinned services section"
else
    warn "Missing pinned services section"
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