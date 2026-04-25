#!/bin/bash
# context-predict.sh — Prediz tokens necessários para uma task

set -euo pipefail

# Estima tokens para uma task description
estimate_task_tokens() {
  local task_desc="$1"

  # Base: system prompt overhead (~1500 tokens)
  local base=1500

  # Estima por palavras na descrição
  # ~1.3 tokens por palavra em inglês, 2.0 para PT-BR
  local word_count
  word_count=$(echo "$task_desc" | wc -w)

  # Detecta idioma
  if echo "$task_desc" | grep -q "ç\|ão\|é\|í\|ó"; then
    base=$((base + word_count * 2))
  else
    # ~1.3 tokens por palavra = 13/10
    base=$((base + (word_count * 13) / 10))
  fi

  # Adiciona para palavras-chave que indicam complexidade
  if echo "$task_desc" | grep -qiE "implement|create|build|refactor|design|architecture"; then
    base=$((base + 500))
  fi
  if echo "$task_desc" | grep -qiE "test|spec|eval"; then
    base=$((base + 300))
  fi
  if echo "$task_desc" | grep -qiE "debug|fix|error|bug"; then
    base=$((base + 200))
  fi

  echo "$base"
}

# Prediz se task cabe no contexto restante
will_fit() {
  local task_desc="$1"
  local remaining_tokens="$2"

  local task_tokens
  task_tokens=$(estimate_task_tokens "$task_desc")

  if [ "$task_tokens" -le "$remaining_tokens" ]; then
    return 0  # cabe
  else
    return 1  # não cabe
  fi
}

main() {
  local mode="${1:-estimate}"

  case "$mode" in
    estimate)
      local desc="${2:-}"
      if [ -z "$desc" ]; then
        echo "Usage: $0 estimate <task_description>"
        exit 1
      fi
      estimate_task_tokens "$desc"
      ;;

    fit)
      local remaining="${2:-0}"
      local desc="${3:-}"
      if [ -z "$desc" ]; then
        echo "Usage: $0 fit <remaining_tokens> <task_description>"
        exit 1
      fi
      if will_fit "$desc" "$remaining"; then
        echo "fits"
        exit 0
      else
        echo "overflow"
        exit 1
      fi
      ;;

    *)
      echo "Usage: $0 {estimate|fit} [args]"
      exit 1
      ;;
  esac
}

main "$@"
