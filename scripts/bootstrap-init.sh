#!/usr/bin/env bash
# bootstrap-init.sh — Load secrets from Infisical vault into shell env
# Usage: source <(bash scripts/bootstrap-init.sh)
set -euo pipefail

INFISICAL_TOKEN="${INFISICAL_TOKEN:-st.799590ae-d36f-4e64-b940-aea0fb85cad8.6e0c269870bb4b5e004e3ed6ab3a1fe1.c9872f2b30bc650e7b27c851df04b0ad}"
INFISICAL_API_URL="${INFISICAL_API_URL:-http://127.0.0.1:8200}"

export COOLIFY_URL=$(infisical secrets get COOLIFY_URL --env=dev --plain 2>/dev/null) || true
export COOLIFY_API_KEY=$(infisical secrets get COOLIFY_API_KEY --env=dev --plain 2>/dev/null) || true
export GITEA_TOKEN=$(infisical secrets get GITEA_TOKEN --env=dev --plain 2>/dev/null) || true
export CLAUDE_API_KEY=$(infisical secrets get CLAUDE_API_KEY --env=dev --plain 2>/dev/null) || true
export TAVILY_API_KEY=$(infisical secrets get TAVILY_API_KEY --env=dev --plain 2>/dev/null) || true

echo "Loaded $(infisical secrets --env=dev 2>/dev/null | grep -c '│') secrets from Infisical vault"
