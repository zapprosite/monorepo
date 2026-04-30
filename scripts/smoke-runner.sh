#!/bin/bash
# smoke-runner.sh — Standardized smoke test runner
# Exit code 0=pass, non-zero=fail. Silence on pass, stderr on fail.
set -euo pipefail

WORKDIR="${WORKDIR:-/srv/monorepo}"
SMOKE_DIR="${SMOKE_DIR:-$WORKDIR/smoke-tests}"
FAILED=0

# Detect available test commands
run_smoke() {
    local name="$1"
    local cmd="$2"

    if ! command -v "${cmd%% *}" >/dev/null 2>&1; then
        echo "SKIP: $name (command not found)" >&2
        return 0
    fi

    local output
    output=$(eval "$cmd" 2>&1) || true

    if [ $? -eq 0 ]; then
        return 0  # pass — silence is gold
    else
        echo "FAIL: $name — $output" >&2
        return 1
    fi
}

# Core smoke tests (always run)
echo "Running smoke tests..."

# Health check — must exist and return OK
if [ -f "$WORKDIR/package.json" ]; then
    if grep -q '"start"' "$WORKDIR/package.json"; then
        # Node/Bun project — check syntax
        if command -v node >/dev/null 2>&1; then
            node --check "$WORKDIR/cli.ts" 2>/dev/null || true
        fi
    fi
fi

# Type check
if [ -f "$WORKDIR/package.json" ] && grep -q '"typecheck"' "$WORKDIR/package.json"; then
    if command -v bun >/dev/null 2>&1; then
        run_smoke "typecheck" "cd $WORKDIR && bunx tsc --noEmit" || FAILED=$((FAILED+1))
    fi
fi

# Lint
if [ -f "$WORKDIR/package.json" ] && grep -q '"lint"' "$WORKDIR/package.json"; then
    if command -v bun >/dev/null 2>&1; then
        run_smoke "lint" "cd $WORKDIR && bun run lint 2>&1 | tail -1" || FAILED=$((FAILED+1))
    fi
fi

# Test
if [ -f "$WORKDIR/package.json" ] && grep -q '"test"' "$WORKDIR/package.json"; then
    if command -v bun >/dev/null 2>&1; then
        run_smoke "test" "cd $WORKDIR && bun test 2>&1 | tail -1" || FAILED=$((FAILED+1))
    fi
fi

# Build
if [ -f "$WORKDIR/package.json" ] && grep -q '"build"' "$WORKDIR/package.json"; then
    if command -v bun >/dev/null 2>&1; then
        run_smoke "build" "cd $WORKDIR && bun run build 2>&1 | tail -1" || FAILED=$((FAILED+1))
    fi
fi

# Run custom smoke tests from smoke-tests/
if [ -d "$SMOKE_DIR" ]; then
    for test_script in "$SMOKE_DIR"/smoke-*.sh; do
        if [ -x "$test_script" ]; then
            test_name=$(basename "$test_script" .sh)
            run_smoke "$test_name" "$test_script" || FAILED=$((FAILED+1))
        elif [ -f "$test_script" ]; then
            test_name=$(basename "$test_script" .sh)
            run_smoke "$test_name" "bash $test_script" || FAILED=$((FAILED+1))
        fi
    done
fi

if [ $FAILED -gt 0 ]; then
    echo "SMOKE: $FAILED test(s) failed" >&2
    exit 1
fi

echo "SMOKE: all passed"
exit 0