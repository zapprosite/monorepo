#!/usr/bin/env bash
# auto-fix.sh — tentativas de correção automática antes de retry

set -euo pipefail

echo "🔧 auto-fix: tentando correções..."

# 1. Lint com auto-fix
echo "[1/3] pnpm turbo lint -- --fix"
pnpm turbo lint -- --fix 2>&1 || true

# 2. Typecheck
echo "[2/3] pnpm turbo typecheck"
pnpm turbo typecheck 2>&1 || true

# 3. Clean (limpa cache para retry limpo)
echo "[3/3] pnpm turbo clean"
pnpm turbo clean 2>&1 || true

echo "✅ auto-fix completo"