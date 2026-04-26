#!/bin/bash
set -euo pipefail

echo "=== Docker Build Verification ==="
echo "Target: apps/api/Dockerfile"
echo ""

cd "$(dirname "$0")/.."

# Check Dockerfile exists
if [ ! -f "apps/api/Dockerfile" ]; then
    echo "ERROR: apps/api/Dockerfile not found"
    exit 1
fi

# Check package name matches prune target
PKG_NAME=$(grep '"name"' apps/api/package.json | head -1 | sed 's/.*: "\(.*\)".*/\1/' || echo "unknown")
PRUNE_TARGET=$(grep "turbo prune" apps/api/Dockerfile | sed 's/.*turbo prune \(.*\) --.*/\1/')

echo "Package name: $PKG_NAME"
echo "Prune target:  $PRUNE_TARGET"
echo ""

if [ "$PKG_NAME" != "$PRUNE_TARGET" ]; then
    echo "ERROR: Package name mismatch!"
    echo "  package.json: $PKG_NAME"
    echo "  Dockerfile:  $PRUNE_TARGET"
    exit 1
fi

echo "✓ Package name matches prune target"

# Check CMD points to correct directory
CMD_DIR=$(grep '^CMD' apps/api/Dockerfile | grep -o 'cd [^&]*' | awk '{print $2}')
echo ""
echo "CMD directory: $CMD_DIR"

if [ "$CMD_DIR" != "apps/api" ]; then
    echo "ERROR: CMD directory should be 'apps/api', got '$CMD_DIR'"
    exit 1
fi

echo "✓ CMD directory is correct"

# Check pnpm db:up is NOT present
if grep -q "pnpm db:up" apps/api/Dockerfile; then
    echo "ERROR: pnpm db:up found in CMD (script doesn't exist)"
    exit 1
fi

echo "✓ pnpm db:up removed from CMD"

echo ""
echo "=== All Checks Passed ==="
echo "Dockerfile is ready for build test."
echo ""
echo "To test docker build:"
echo "  docker build -f apps/api/Dockerfile -t zappro-api:test ."
