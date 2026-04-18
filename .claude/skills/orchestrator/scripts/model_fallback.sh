#!/usr/bin/env bash
# model_fallback.sh — Get fallback model when budget or context limits exceeded
# Part of: SPEC-071-V6 (COST ENGINE)
# Usage: bash model_fallback.sh <current_model> [--budget-exceeded | --context-exceeded]
#        bash model_fallback.sh --list
# Exit 0 + echo model name if fallback available
# Exit 1 + echo "" if no fallback (at cheapest model)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$(dirname "$(dirname "$(dirname "$SCRIPT_DIR")")")")"
BUDGET_FILE="$ROOT_DIR/.orchestrator/budget.yml"

CURRENT_MODEL="${1:-}"
TRIGGER="${2:-budget-exceeded}"

# ── Model fallback chain (from most to least expensive) ─────────────────────
# Format: model:priority (lower = more expensive, try first)
FALLBACK_CHAIN=(
  "o1-preview:1"
  "o1-mini:2"
  "gpt-4o:3"
  "gpt-4o-mini:4"
  "claude-3-haiku:5"
  "gemma4-12b-it:100"
  "llama3-portuguese-tomcat-8b:101"
  "minimax-m2.7:102"
)

# ── Load from budget.yml if exists ──────────────────────────────────────────
load_chain_from_budget() {
  if [[ ! -f "$BUDGET_FILE" ]]; then
    return 1
  fi

  local in_fallback="no"
  while IFS= read -r line; do
    line=$(echo "$line" | sed 's/^[[:space:]]*//')
    if [[ "$line" =~ ^model_fallback: ]]; then
      in_fallback="yes"
      continue
    fi
    if [[ "$in_fallback" == "yes" ]]; then
      if [[ "$line" =~ ^# ]]; then
        continue
      fi
      if [[ "$line" =~ ^[[:alpha:]] ]]; then
        # New key, stop
        break
      fi
      # Extract model name (dash-prefixed list items)
      local model
      model=$(echo "$line" | sed 's/^-\s*//' | tr -d '"' | tr -d "'")
      # Validate: model names must be alphanumeric with hyphens/underscores only
      if [[ -n "$model" && "$model" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "Model: $model"
      fi
    fi
  done < "$BUDGET_FILE"
}

# ── Get next fallback model ───────────────────────────────────────────────────
get_fallback() {
  local current="$1"
  local trigger="$2"  # budget-exceeded or context-exceeded

  # Try to load chain from budget.yml first
  local chain=()
  local budget_chain=()
  while IFS= read -r line; do
    local model
    model=$(echo "$line" | sed 's/^Model:\s*//')
    if [[ -n "$model" ]]; then
      budget_chain+=("$model")
    fi
  done < <(load_chain_from_budget 2>/dev/null || true)

  # Use budget chain if found
  if [[ ${#budget_chain[@]} -gt 0 ]]; then
    local found="no"
    for model in "${budget_chain[@]}"; do
      if [[ "$found" == "yes" ]]; then
        echo "$model"
        return 0
      fi
      if [[ "$model" == "$current" ]]; then
        found="yes"
      fi
    done
    # Already at cheapest
    echo ""
    return 1
  fi

  # Use default chain
  local found="no"
  for entry in "${FALLBACK_CHAIN[@]}"; do
    local model priority
    model=$(echo "$entry" | cut -d: -f1)
    priority=$(echo "$entry" | cut -d: -f2)

    if [[ "$model" == "$current" ]]; then
      found="yes"
      continue
    fi

    if [[ "$found" == "yes" ]]; then
      echo "$model"
      return 0
    fi
  done

  # No fallback available
  echo ""
  return 1
}

# ── Get model info ────────────────────────────────────────────────────────────
get_model_info() {
  local model="$1"

  declare -A MODEL_COSTS=(
    ["o1-preview"]="15.00,60.00"
    ["o1-mini"]="3.00,12.00"
    ["gpt-4o"]="2.50,10.00"
    ["gpt-4o-mini"]="0.15,0.60"
    ["claude-3-haiku"]="0.25,1.25"
    ["gemma4-12b-it"]="0.00,0.00"
    ["llama3-portuguese-tomcat-8b"]="0.00,0.00"
    ["minimax-m2.7"]="0.00,0.00"
  )

  local cost_data="${MODEL_COSTS[$model]:-0.00,0.00}"
  local input_price output_price
  input_price=$(echo "$cost_data" | cut -d, -f1)
  output_price=$(echo "$cost_data" | cut -d, -f2)

  echo "model=$model input_price=\$$input_price/1M output_price=\$$output_price/1M"
}

# ── List chain ────────────────────────────────────────────────────────────────
list_chain() {
  echo "=== MODEL FALLBACK CHAIN ==="
  echo ""
  echo "Primary → ... → Cheapest (local/free models)"
  echo ""

  # Show budget chain first if exists
  local budget_chain=()
  while IFS= read -r line; do
    local model
    model=$(echo "$line" | sed 's/^Model:\s*//')
    if [[ -n "$model" ]]; then
      budget_chain+=("$model")
    fi
  done < <(load_chain_from_budget 2>/dev/null || true)

  if [[ ${#budget_chain[@]} -gt 0 ]]; then
    echo "Budget-configured chain (from $BUDGET_FILE):"
    local i=1
    for model in "${budget_chain[@]}"; do
      echo "  $i. $model ($(get_model_info "$model"))"
      ((i++))
    done
  else
    echo "Default chain:"
    local i=1
    for entry in "${FALLBACK_CHAIN[@]}"; do
      local model priority
      model=$(echo "$entry" | cut -d: -f1)
      priority=$(echo "$entry" | cut -d: -f2)
      echo "  $i. $model ($(get_model_info "$model"))"
      ((i++))
    done
  fi

  echo ""
  echo "Trigger types:"
  echo "  --budget-exceeded   Use when pipeline budget is exceeded"
  echo "  --context-exceeded  Use when context window is exceeded"
}

# ── Main ─────────────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--list" ]]; then
  list_chain
  exit 0
fi

if [[ -z "$CURRENT_MODEL" ]]; then
  echo "Usage: model_fallback.sh <current_model> [--budget-exceeded|--context-exceeded]" >&2
  echo "       model_fallback.sh --list" >&2
  exit 1
fi

FALLBACK_MODEL=$(get_fallback "$CURRENT_MODEL" "$TRIGGER")

if [[ -z "$FALLBACK_MODEL" ]]; then
  echo "[model_fallback] No fallback available for $CURRENT_MODEL (already at cheapest)" >&2
  echo ""
  exit 1
fi

echo "[model_fallback] Current: $CURRENT_MODEL"
echo "[model_fallback] Trigger: $TRIGGER"
echo "[model_fallback] Fallback: $FALLBACK_MODEL"
echo "[model_fallback] Info: $(get_model_info "$FALLBACK_MODEL")"

# If budget exceeded, also run track_cost check
if [[ "$TRIGGER" == "budget-exceeded" ]]; then
  echo "[model_fallback] Budget exceeded — consider running track_cost.sh --check-budget"
fi

echo "$FALLBACK_MODEL"
exit 0
