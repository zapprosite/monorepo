#!/bin/bash
# smoke-orchestrator-v3.sh — Smoke test for orchestrator v3 pipeline scripts
# Verifies all required scripts exist and have proper bash -euo pipefail header

set -euo pipefail

SCRIPT_DIR="$(dirname "$0")/../.claude/skills/orchestrator/scripts"
FAILED=0

# Required scripts list
SCRIPTS=(
    "run-pipeline.sh"
    "wait-for-phase.sh"
    "check-gate.sh"
    "snapshot.sh"
    "rollback.sh"
    "ship.sh"
)

echo "=== Orchestrator v3 Smoke Test ==="
echo ""

# Check each script exists
for script in "${SCRIPTS[@]}"; do
    path="$SCRIPT_DIR/$script"
    if [ -f "$path" ]; then
        echo "✅ $script exists"
    else
        echo "❌ $script MISSING"
        FAILED=1
    fi
done

echo ""

# Check run-pipeline.sh is executable
if [ -x "$SCRIPT_DIR/run-pipeline.sh" ]; then
    echo "✅ run-pipeline.sh is executable"
else
    echo "❌ run-pipeline.sh is NOT executable"
    FAILED=1
fi

echo ""

# Verify bash -euo pipefail header on all scripts
REQUIRED_HEADER="set -euo pipefail"
for script in "${SCRIPTS[@]}"; do
    path="$SCRIPT_DIR/$script"
    if [ -f "$path" ]; then
        # Get first non-comment, non-empty line
        first_line=$(grep -v '^#' "$path" | grep -v '^$' | head -1)
        if [ "$first_line" = "$REQUIRED_HEADER" ]; then
            echo "✅ $script has proper header"
        else
            echo "❌ $script missing or incorrect header (expected: $REQUIRED_HEADER)"
            FAILED=1
        fi
    fi
done

echo ""

if [ $FAILED -eq 0 ]; then
    echo "=== ALL SMOKE TESTS PASSED ==="
    exit 0
else
    echo "=== SMOKE TESTS FAILED ==="
    exit 1
fi
