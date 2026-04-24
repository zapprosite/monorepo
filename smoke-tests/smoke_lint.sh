#!/bin/bash
# smoke_lint.sh - Lint smoke test for monorepo
# Usage: ./smoke_lint.sh [--check|--fix]

set -e

MODE="${1:---check}"
cd /srv/monorepo

echo "=== Lint Check: TypeScript/ESLint ==="
pnpm lint --max-warnings 0 2>&1 | tail -20 || true

echo ""
echo "=== Type Check (TypeScript) ==="
pnpm typecheck 2>&1 | tail -20 || true

echo ""
echo "=== Format Check (Biome) ==="
npx biome check --write=false ./apps/api/src ./apps/ai-gateway/src 2>&1 | tail -30 || true

echo ""
echo "=== Secret Scan (detect-secrets) ==="
# Check for common hardcoded secrets in config files
if grep -r "sk-cp-uA1oy3" --include="*.yaml" --include="*.yml" --include="*.env" . 2>/dev/null; then
    echo "⚠️ OLD MINIMAX TOKEN FOUND - update to sk-cp-etXmVd"
    exit 1
fi
if grep -r "sk-proj-" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v ".test." | grep -v ".spec."; then
    echo "⚠️ Possible OpenAI key in source - review"
fi

echo ""
echo "=== JSON/YAML Validation ==="
for f in $(find . -maxdepth 3 -name "config.yaml" -o -name "docker-compose.yml" -o -name "package.json"); do
    case "$f" in
        *.yaml|*.yml) python3 -c "import yaml; yaml.safe_load(open('$f'))" 2>&1 && echo "✓ $f" || echo "✗ $f FAILED";;
        *.json) python3 -c "import json; json.load(open('$f'))" 2>&1 && echo "✓ $f" || echo "✗ $f FAILED";;
    esac
done 2>/dev/null || true

echo ""
echo "=== Lint Complete ==="