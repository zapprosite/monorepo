#!/usr/bin/env bash
# bootstrap-check.sh — Verify required secrets and emit Bootstrap Effect JSON
# Usage: bash scripts/bootstrap-check.sh [--json]

set -euo pipefail

STATE_FILE="tasks/pipeline-state.json"
INFISICAL_HOST="${INFISICAL_HOST:-http://127.0.0.1:8200}"
JSON_ONLY=false

[[ "${1:-}" == "--json" ]] && JSON_ONLY=true

# ── Required secrets ──────────────────────────────────────────
REQUIRED_SECRETS=(
  "COOLIFY_URL"
  "COOLIFY_API_KEY"
  "GITEA_TOKEN"
  "CLAUDE_API_KEY"
)

# ── Optional secrets ──────────────────────────────────────────
OPTIONAL_SECRETS=(
  "TAVILY_API_KEY"
  "CONTEXT7_API_KEY"
  "TELEGRAM_BOT_TOKEN"
  "TELEGRAM_CHAT_ID"
)

# ── Helpers ────────────────────────────────────────────────────
secret_is_set() {
  local key=$1
  local value="${!key:-}"
  [[ -n "$value" && "$value" != "null" && "$value" != "" ]]
}

secret_masked() {
  local key=$1
  local value="${!key:-}"
  if [[ -z "$value" ]]; then
    echo "NOT SET"
  elif [[ ${#value} -le 8 ]]; then
    echo "$value"
  else
    echo "${value:0:4}...${value: -4}"
  fi
}

check_infisical_health() {
  curl -s -o /dev/null -w "%{http_code}" "$INFISICAL_HOST/health" 2>/dev/null || echo "000"
}

secret_purpose() {
  case "$1" in
    COOLIFY_URL) echo "Coolify API endpoint" ;;
    COOLIFY_API_KEY) echo "Coolify API authentication" ;;
    GITEA_TOKEN) echo "Gitea Actions authentication" ;;
    CLAUDE_API_KEY) echo "Claude API for AI operations" ;;
    TAVILY_API_KEY) echo "Web research API" ;;
    CONTEXT7_API_KEY) echo "Documentation lookup API" ;;
    TELEGRAM_BOT_TOKEN) echo "Telegram notifications" ;;
    TELEGRAM_CHAT_ID) echo "Telegram chat for notifications" ;;
    *) echo "Unknown" ;;
  esac
}

# ── Main ──────────────────────────────────────────────────────
main() {
  local missing=()
  local present=()
  local infisical_health=$(check_infisical_health)

  for secret in "${REQUIRED_SECRETS[@]}"; do
    if secret_is_set "$secret"; then
      present+=("$secret")
    else
      missing+=("$secret")
    fi
  done

  local missing_count=${#missing[@]}
  local present_count=${#present[@]}
  local timestamp=$(date -Iseconds)

  if [[ "$JSON_ONLY" == "true" ]]; then
    # JSON output only
    local configs="["
    local first=true
    for secret in "${missing[@]}"; do
      $first && first=false || configs+=","
      configs+="{\"key\":\"$secret\",\"source\":\"Infisical vault\",\"current_value\":\"$(secret_masked $secret)\",\"required_for\":\"$(secret_purpose $secret)\"}"
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
    "smoke_test": {
      "description": "Infisical health",
      "command": "curl -s $INFISICAL_HOST/health",
      "expected_output": "healthy",
      "current_output": "$infisical_health"
    }
  }
}
EOF
    [[ $missing_count -gt 0 ]] && exit 1 || exit 0
    return
  fi

  # Human-readable output
  echo "═══════════════════════════════════════════"
  echo "  Bootstrap Check — Secrets Verification"
  echo "═══════════════════════════════════════════"
  echo ""
  echo "Infisical Health: $infisical_health"
  [[ "$infisical_health" != "200" ]] && echo "⚠️  Infisical not reachable at $INFISICAL_HOST"
  echo ""

  echo "Required Secrets ($present_count ✅, $missing_count ❌):"
  for secret in "${REQUIRED_SECRETS[@]}"; do
    if secret_is_set "$secret"; then
      echo "  ✅ $secret: $(secret_masked $secret)"
    else
      echo "  ❌ $secret: NOT SET"
    fi
  done

  echo ""
  echo "Optional Secrets:"
  for secret in "${OPTIONAL_SECRETS[@]}"; do
    if secret_is_set "$secret"; then
      echo "  ✅ $secret: $(secret_masked $secret)"
    else
      echo "  ⚠️  $secret: NOT SET"
    fi
  done

  echo ""
  echo "═══════════════════════════════════════════"

  if [[ $missing_count -gt 0 ]]; then
    echo "🔴 Bootstrap Effect: $missing_count required secrets missing"
    echo ""
    echo "=== Bootstrap Effect JSON ==="
    bash "$0" --json
    echo "=== End Bootstrap Effect JSON ==="
    exit 1
  else
    echo "✅ All required secrets present"
    exit 0
  fi
}

main
