#!/bin/bash
# context-meter.sh — Mede context window usage do Claude Code CLI

set -euo pipefail

# Model context windows (tokens)
declare -A MODEL_WINDOWS=(
  ["claude-opus-4-7"]=200000
  ["claude-sonnet-4-6"]=100000
  ["claude-haiku-4-5"]=32000
  ["claude-opus-4"]=200000
  ["claude-sonnet-4"]=100000
  ["claude-haiku-4"]=32000
  ["MiniMax-M2.7"]=100000
  ["MiniMax-M2"]=100000
)

DEFAULT_WINDOW=200000

detect_model() {
  local settings="$HOME/.claude/settings.json"

  if [ -f "$settings" ]; then
    model=$(jq -r '.provider?.model // .model // empty' "$settings" 2>/dev/null || echo "")
    if [ -n "$model" ]; then
      echo "$model"
      return 0
    fi
  fi

  if [ -n "${CLAUDE_MODEL:-}" ]; then
    echo "$CLAUDE_MODEL"
    return 0
  fi

  echo "MiniMax-M2.7"
}

get_window_size() {
  local model="$1"
  local window="${MODEL_WINDOWS[$model]:-$DEFAULT_WINDOW}"
  echo "$window"
}

estimate_conversation_tokens() {
  local session_file="$HOME/.claude/projects/-srv-monorepo/current_session.json"

  if [ -f "$session_file" ]; then
    chars=$(wc -c < "$session_file" 2>/dev/null || echo 0)
    echo $((chars / 4))
    return
  fi

  echo 5000
}

estimate_overhead_tokens() {
  echo 2500
}

main() {
  model=$(detect_model)
  window=$(get_window_size "$model")
  conv_tokens=$(estimate_conversation_tokens)
  overhead_tokens=$(estimate_overhead_tokens)

  total_used=$((conv_tokens + overhead_tokens))
  percentage=$((total_used * 100 / window))

  if [ "${1:-}" = "--json" ]; then
    jq -n \
      --arg model "$model" \
      --arg window "$window" \
      --arg conv "$conv_tokens" \
      --arg overhead "$overhead_tokens" \
      --arg total "$total_used" \
      --arg pct "$percentage" \
      '{
        model: $model,
        window_tokens: ($window | tonumber),
        conversation_tokens: ($conv | tonumber),
        overhead_tokens: ($overhead | tonumber),
        total_used: ($total | tonumber),
        percentage: ($pct | tonumber)
      }'
  else
    echo "${percentage}% ${total_used}tokens/${window}"
  fi
}

main "$@"
