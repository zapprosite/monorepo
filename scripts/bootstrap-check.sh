#!/usr/bin/env bash
# bootstrap-check.sh — Verify required secrets from .env and emit Bootstrap Effect JSON
# .env is the ONLY canonical source (Infisical pruned 2026-04-13)
# Usage: bash scripts/bootstrap-check.sh [--json]

set -euo pipefail

JSON_ONLY=false
[[ "${1:-}" == "--json" ]] && JSON_ONLY=true

# Load .env (canonical source)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

# ── Constants ─────────────────────────────────────────────────
# Minimum length to consider a secret (shorter values are masked as ****)
MIN_SECRET_LEN=8

# ── Required secrets ──────────────────────────────────────────
REQUIRED_SECRETS=(
  "COOLIFY_URL"
  "COOLIFY_API_KEY"
  "GITEA_TOKEN"
  "AI_GATEWAY_FACADE_KEY"
)

# ── Optional secrets ──────────────────────────────────────────
OPTIONAL_SECRETS=(
  "CONTEXT7_API_KEY"
  "TELEGRAM_BOT_TOKEN"
  "TELEGRAM_CHAT_ID"
)

# ── Helpers ────────────────────────────────────────────────────
declare -A SECRET_PURPOSE
SECRET_PURPOSE=(
  ["COOLIFY_URL"]="Coolify API endpoint"
  ["COOLIFY_API_KEY"]="Coolify API authentication"
  ["GITEA_TOKEN"]="Gitea Actions authentication"
  ["CLAUDE_API_KEY"]="Claude API for AI operations"
  ["CONTEXT7_API_KEY"]="Documentation lookup API"
  ["TELEGRAM_BOT_TOKEN"]="Telegram notifications"
  ["TELEGRAM_CHAT_ID"]="Telegram chat for notifications"
)

secret_is_set() {
  local value="${!1:-}"
  [[ -n "$value" && "$value" != "null" ]]
}

secret_masked() {
  local value="${!1:-}"
  if [[ -z "$value" ]]; then echo "NOT SET"
  elif [[ ${#value} -le $MIN_SECRET_LEN ]]; then echo "****"  # mask short secrets in JSON output
  else echo "${value:0:4}...${value: -4}"
  fi
}

secret_purpose() { echo "${SECRET_PURPOSE[$1]:-Unknown}"; }

# ── Main ──────────────────────────────────────────────────────
main() {
  local missing=() present=()
  for secret in "${REQUIRED_SECRETS[@]}"; do
    secret_is_set "$secret" && present+=("$secret") || missing+=("$secret")
  done

  local missing_count=${#missing[@]}
  local present_count=${#present[@]}
  local timestamp; timestamp=$(date -Iseconds)

  if [[ "$JSON_ONLY" == "true" ]]; then
    local configs="[" first=true
    for secret in "${missing[@]}"; do
      $first && first=false || configs+=","
      configs+=$(python3 -c "
import json, sys
key = $(printf '%s' "$secret" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
val = $(secret_masked "$secret" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
pur = $(secret_purpose "$secret" | python3 -c 'import sys,json; print(json.dumps(sys.stdin.read()))')
print(json.dumps({\"key\": key, \"source\": \".env\", \"current_value\": val, \"required_for\": pur}), end='')
")
    done
    configs+="]"
    cat << EOF
{
  "bootstrap_effect": {
    "task_id": "CURSOR-LEADER-01",
    "gate_type": "SECRET_MISSING",
    "timestamp": "$timestamp",
    "missing_secrets_count": $missing_count,
    "pending_configs": $configs,
    "hint": "Add missing secrets to .env (generate with: openssl rand -hex 32)"
  }
}
EOF
    [[ $missing_count -gt 0 ]] && exit 1 || exit 0
    return
  fi

  echo "═══════════════════════════════════════════"
  echo "  Bootstrap Check — Secrets Verification"
  echo "  Source: .env (canonical — Infisical pruned)"
  echo "═══════════════════════════════════════════"
  echo ""
  echo "Required Secrets ($present_count ✅, $missing_count ❌):"
  for secret in "${REQUIRED_SECRETS[@]}"; do
    if secret_is_set "$secret"; then echo "  ✅ $secret: $(secret_masked "$secret")"
    else echo "  ❌ $secret: NOT SET — add to .env (openssl rand -hex 32)"
    fi
  done
  echo ""
  echo "Optional Secrets:"
  for secret in "${OPTIONAL_SECRETS[@]}"; do
    if secret_is_set "$secret"; then echo "  ✅ $secret: $(secret_masked "$secret")"
    else echo "  ⚠️  $secret: NOT SET"
    fi
  done
  echo ""
  echo "═══════════════════════════════════════════"

  if [[ $missing_count -gt 0 ]]; then
    echo "🔴 Bootstrap Effect: $missing_count required secrets missing"
    bash "$0" --json
    exit 1
  else
    echo "✅ All required secrets present"
    exit 0
  fi
}

main
