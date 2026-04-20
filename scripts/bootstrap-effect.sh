#!/usr/bin/env bash
# bootstrap-effect.sh — Format Bootstrap Effect JSON for display
# Usage: bash scripts/bootstrap-effect.sh

set -euo pipefail

INPUT_FILE="${1:-/tmp/bootstrap.out}"
OUTPUT_FILE="${2:-}"

# ── Parse and format ───────────────────────────────────────────
format_bootstrap_effect() {
  local json=$(cat "$INPUT_FILE" 2>/dev/null | jq -r '.bootstrap_effect // empty')

  if [[ -z "$json" || "$json" == "null" ]]; then
    echo "⚠️  No Bootstrap Effect found in input"
    return 1
  fi

  local task_id=$(echo "$json" | jq -r '.task_id')
  local gate_type=$(echo "$json" | jq -r '.gate_type')
  local timestamp=$(echo "$json" | jq -r '.timestamp')
  local missing_count=$(echo "$json" | jq -r '.missing_secrets_count')
  local smoke_output=$(echo "$json" | jq -r '.smoke_test.current_output')

  echo "╔══════════════════════════════════════════════════════════╗"
  echo "║            🔴 BOOTSTRAP EFFECT DETECTED                ║"
  echo "╠══════════════════════════════════════════════════════════╣"
  echo "║  Task:    $task_id"
  echo "║  Gate:    $gate_type"
  echo "║  Time:    $timestamp"
  echo "║  Missing: $missing_count secret(s)"
  echo "╠══════════════════════════════════════════════════════════╣"

  # List pending configs
  local configs=$(echo "$json" | jq -r '.pending_configs[] | @json' 2>/dev/null)
  if [[ -n "$configs" ]]; then
    echo "║  📋 PENDING CONFIGS:"
    echo "$json" | jq -r '.pending_configs[] | "║    ❌ \(.key): \(.current_value)\n║       Required for: \(.required_for)"'
  fi

  local actions=$(echo "$json" | jq -r '.human_actions // [] | if type == "array" then . else [] end')
  if [[ -n "$actions" && "$actions" != "[]" ]]; then
    echo "╠══════════════════════════════════════════════════════════╣"
    echo "║  💡 HUMAN ACTIONS REQUIRED:"
    echo "$json" | jq -r '.human_actions[] | "║    \(.)"'
  fi

  local verify=$(echo "$json" | jq -r '.verify_commands // [] | if type == "array" then . else [] end')
  if [[ -n "$verify" && "$verify" != "[]" ]]; then
    echo "╠══════════════════════════════════════════════════════════╣"
    echo "║  🔍 VERIFY COMMANDS:"
    echo "$json" | jq -r '.verify_commands[] | "║    \(.)"'
  fi

  echo "╚══════════════════════════════════════════════════════════╝"
  echo ""

  # Smoke test status
  if [[ "$smoke_output" != "200" ]]; then
    echo "⚠️  SMOKE TEST: Health check returned $smoke_output"
    echo "   Expected: 200 (healthy)"
    echo ""
  fi
}

# ── Save to file ───────────────────────────────────────────────
save_output() {
  if [[ -n "$OUTPUT_FILE" ]]; then
    format_bootstrap_effect > "$OUTPUT_FILE"
    echo "💾 Saved to: $OUTPUT_FILE"
  fi
}

# ── Main ──────────────────────────────────────────────────────
main() {
  if [[ ! -f "$INPUT_FILE" ]]; then
    echo "⚠️  Input file not found: $INPUT_FILE"
    echo "   Run bootstrap-check.sh first and redirect output"
    echo ""
    echo "   Example: bash scripts/bootstrap-check.sh > /tmp/bootstrap.out"
    echo "            bash scripts/bootstrap-effect.sh /tmp/bootstrap.out"
    return 1
  fi

  format_bootstrap_effect
  save_output
}

main
