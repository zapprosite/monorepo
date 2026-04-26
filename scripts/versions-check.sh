#!/bin/bash
# VERSION DRIFT CHECK — Validates tooling versions match package.json

set -e

echo "=== Version Drift Check ==="

# Read packageManager from package.json
PACKAGE_MANAGER=$(grep '"packageManager"' package.json | sed 's/.*pnpm@//' | tr -d '", ')

echo "package.json packageManager: pnpm@${PACKAGE_MANAGER}"
echo "Configured pnpm version:    $(pnpm --version | sed 's/v//')"

# Check if versions match
if [[ "$(pnpm --version | sed 's/v//')" != "${PACKAGE_MANAGER}" ]]; then
  echo "WARN: pnpm version mismatch detected"
  echo "Run: pnpm install"
  exit 1
fi

echo "✓ Version drift check passed"
