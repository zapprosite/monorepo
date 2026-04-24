#!/usr/bin/env bash
# vibe.sh — Vibe Coding Loop: NL → SPEC → Pipeline → Execute → Ship
# Usage: vibe.sh "build auth module" [--dry-run] [--spec SPEC-NNN]
set -euo pipefail

VIBE_DIR="${HOME}/.local/share/ai-shortcuts/star"
MONOREPO_DIR="/srv/monorepo"
LOG_FILE="${MONOREPO_DIR}/logs/vibe-daemon.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log() { echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $*" | tee -a "$LOG_FILE" 2>/dev/null || true; }
info() { log "${BLUE}[INFO]${NC} $*"; }
ok() { log "${GREEN}[OK]${NC} $*"; }
warn() { log "${YELLOW}[WARN]${NC} $*"; }
err() { log "${RED}[ERR]${NC} $*"; }

show_banner() {
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  ⭐ VIBE CODING LOOP${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
}

# ──────────────────────────────────────────────────────────────
# Step 1: Classify intent
# ──────────────────────────────────────────────────────────────
classify_intent() {
    local input="$1"
    
    info "[1/5] Classificando intent..."
    
    # Fast path: command prefixes → skip star
    if [[ "$input" == //* ]] || [[ "$input" == --* ]] || [[ "$input" == /* ]]; then
        echo "COMMAND"
        return
    fi
    
    # Portuguese NL patterns → star mode
    if [[ "$input" =~ ^(queria|preciso|gostaria|faz|fazer|build|criar|montar|botar|colocar) ]]; then
        echo "STAR"
        return
    fi
    
    # Contains technical command patterns → skip star
    if [[ "$input" =~ ^(docker|kubectl|git |pnpm|npm|yarn|curl|wget) ]] || \
       [[ "$input" =~ (GET|POST|PUT|DELETE|HEAD)\ /api ]] || \
       [[ "$input" =~ \/\/ ]]; then
        echo "COMMAND"
        return
    fi
    
    # Portuguese verbs → star mode
    if [[ "$input" =~ (queria|preciso|gostaria|quero|fazer|criar|montar|botar|colocar) ]]; then
        echo "STAR"
        return
    fi
    
    # Fallback: ask LLM
    local result
    result=$(curl -s -X POST http://localhost:11434/v1/chat/completions \
        -H "Content-Type: application/json" \
        -d "$(jq -n \
            --arg model "gemma4:latest" \
            --arg content "Classify:
$input

STAR = natural language intent to build/create
COMMAND = command, technical spec, or not a build request

One word only:" \
            '{
                model: $model,
                messages: [{"role": "user", "content": $content}],
                max_tokens: 10,
                temperature: 0
            }')" 2>/dev/null || echo '{"choices":[{"message":{"content":"STAR"}}]}')
    
    local classification
    classification=$(echo "$result" | jq -r '.choices[0].message.content // "STAR"' | tr -d '[:space:]')
    
    if [[ "$classification" == "STAR" ]]; then
        echo "STAR"
    else
        echo "COMMAND"
    fi
}

# ──────────────────────────────────────────────────────────────
# Step 2: Translate NL → SPEC
# ──────────────────────────────────────────────────────────────
translate_to_spec() {
    local nl="$1"
    local dry_run="${2:-false}"
    
    info "[2/5] Traduzindo para SPEC..."
    
    local spec_id="SPEC-$(date +%Y%m%d%H%M%S | tail -c 6)"
    local spec_file="${MONOREPO_DIR}/docs/SPECS/${spec_id}.md"
    
    # Get monorepo context
    local apps=""
    if [ -d "${MONOREPO_DIR}/apps" ]; then
        apps=$(ls "${MONOREPO_DIR}/apps" 2>/dev/null | tr '\n' ',' | sed 's/,$//')
    fi
    
    # Build SPEC content
    local spec_content="---
name: ${spec_id}
description: \"${nl}\"
status: draft
priority: medium
author: William Rodrigues
date: $(date +%Y-%m-%d)
tags: [vibe, auto-generated]
---

# ${spec_id}

## Resumo

${nl}

## Problema

[Descreva o problema que esta feature resolve]

## Solucao Proposta

[Descreva a solucao tecnica]

## Arquitetura

[Diagrama se aplicavel]

## Tasks

1. [ ] Task 1
2. [ ] Task 2
3. [ ] Task 3

## Acceptance Criteria

- [ ] AC-1: [Criterio de aceite]
- [ ] AC-2: [Criterio de aceite]

## Tech Stack

- TypeScript + Node.js
- Fastify + tRPC
- PostgreSQL + Qdrant
"
    
    if [ "$dry_run" != "true" ]; then
        mkdir -p "$(dirname "$spec_file")"
        echo "$spec_content" > "$spec_file"
        ok "SPEC criada: ${spec_file}"
    else
        echo "$spec_content"
    fi
    
    echo "$spec_id"
}

# ──────────────────────────────────────────────────────────────
# Step 3: Generate pipeline from SPEC
# ──────────────────────────────────────────────────────────────
generate_pipeline() {
    local spec_id="$1"
    local dry_run="${2:-false}"
    
    info "[3/5] Gerando pipeline..."
    
    local spec_file="${MONOREPO_DIR}/docs/SPECS/${spec_id}.md"
    local pipeline_file="${MONOREPO_DIR}/tasks/pipeline.json"
    
    if [ ! -f "$spec_file" ]; then
        err "SPEC not found: ${spec_file}"
        return 1
    fi
    
    # Extract tasks from SPEC
    local tasks=$(grep -E "^\d+\. \[ \]" "$spec_file" 2>/dev/null | sed 's/^[0-9]*\. \[ \] //' || echo "")
    
    # Build pipeline.json
    local pipeline_id="pipeline-$(date +%Y%m%d%H%M%S)"
    
    local pipeline_json="{
  \"id\": \"${pipeline_id}\",
  \"spec\": \"${spec_id}\",
  \"status\": \"PENDING\",
  \"created\": \"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",
  \"phases\": [
    {
      \"phase\": 1,
      \"name\": \"Implementation\",
      \"tasks\": [
        {
          \"id\": \"TASK-001\",
          \"name\": \"Implement ${spec_id}\",
          \"type\": \"implement\",
          \"status\": \"pending\",
          \"spec_ref\": \"${spec_id}\",
          \"acceptance_criteria\": [\"AC-1\", \"AC-2\"],
          \"retry_count\": 0
        }
      ]
    }
  ],
  \"gitea\": {
    \"workflow_run_id\": null,
    \"workflow_status\": null,
    \"pr_number\": null
  },
  \"stats\": {
    \"total\": 1,
    \"done\": 0,
    \"failed\": 0,
    \"pending\": 1
  }
}"
    
    if [ "$dry_run" != "true" ]; then
        mkdir -p "$(dirname "$pipeline_file")"
        echo "$pipeline_json" > "$pipeline_file"
        ok "Pipeline gerado: ${pipeline_file}"
    else
        echo "$pipeline_json"
    fi
}

# ──────────────────────────────────────────────────────────────
# Step 4: Execute vibe loop
# ──────────────────────────────────────────────────────────────
execute_loop() {
    local spec_id="${1:-}"
    local dry_run="${2:-false}"
    
    info "[4/5] Executando Vibe Loop..."
    
    if [ -n "$spec_id" ]; then
        local pipeline_file="${MONOREPO_DIR}/tasks/pipeline.json"
        
        if [ ! -f "$pipeline_file" ]; then
            err "Pipeline not found. Run 'vibe.sh --spec ${spec_id}' first."
            return 1
        fi
        
        # Update SPEC status to active
        local spec_file="${MONOREPO_DIR}/docs/SPECS/${spec_id}.md"
        if [ -f "$spec_file" ]; then
            sed -i "s/status: draft/status: active/" "$spec_file" 2>/dev/null || true
        fi
    fi
    
    # Show what we have
    echo ""
    echo -e "${YELLOW}  📋 Pipeline:${NC} ${MONOREPO_DIR}/tasks/pipeline.json"
    echo -e "${YELLOW}  📄 SPEC:${NC} ${MONOREPO_DIR}/docs/SPECS/${spec_id}.md"
    echo ""
    
    if [ "$dry_run" == "true" ]; then
        ok "[DRY-RUN] Loop não executado (dry-run mode)"
        return 0
    fi
    
    ok "Loop ready to execute via Claude Code or autopilot"
    echo ""
    echo -e "${CYAN}  Para executar o loop, use:${NC}"
    echo -e "    ${GREEN}//vibe-loop${NC}  ou  ${GREEN}cd ${MONOREPO_DIR} && claude -p \"//vibe-loop\"${NC}"
    echo ""
}

# ──────────────────────────────────────────────────────────────
# Step 5: Show summary
# ──────────────────────────────────────────────────────────────
show_summary() {
    local spec_id="$1"
    local mode="$2"
    
    echo ""
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  ⭐ VIBE COMPLETO${NC}"
    echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "  ${GREEN}✅ SPEC:${NC} ${spec_id}"
    echo -e "  ${GREEN}📋 Pipeline:${NC} tasks/pipeline.json"
    echo ""
    echo -e "  Modo: ${mode}"
    echo ""
    echo -e "${CYAN}  Próximos passos:${NC}"
    echo -e "    1. Edite a SPEC em: docs/SPECS/${spec_id}.md"
    echo -e "    2. Execute: cd ${MONOREPO_DIR} && claude -p \"//vibe-loop\""
    echo -e "    3. Ou: vibe.sh --run --spec ${spec_id}"
    echo ""
}

# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────
main() {
    local input=""
    local mode="full"
    local dry_run="false"
    local run_only="false"
    local spec_id=""
    
    # Parse args
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --dry-run|-n)
                dry_run="true"
                shift
                ;;
            --run|-r)
                run_only="true"
                shift
                ;;
            --spec|-s)
                spec_id="$2"
                shift 2
                ;;
            --help|-h)
                echo "Usage: vibe.sh [input] [--dry-run] [--run] [--spec SPEC-ID]"
                echo ""
                echo "Examples:"
                echo "  vibe.sh \"build auth module\""
                echo "  vibe.sh \"build auth module\" --dry-run"
                echo "  vibe.sh --run --spec SPEC-123456"
                echo "  vibe.sh --spec SPEC-123456  # quick mode"
                exit 0
                ;;
            *)
                if [ -z "$input" ]; then
                    input="$1"
                fi
                shift
                ;;
        esac
    done
    
    mkdir -p "$(dirname "$LOG_FILE")"
    show_banner
    
    # Quick mode: just run pipeline
    if [ "$run_only" == "true" ]; then
        execute_loop "$spec_id" "$dry_run"
        return $?
    fi
    
    # No input → show help
    if [ -z "$input" ]; then
        echo -e "${YELLOW}Usage:${NC} vibe.sh \"task description\" [--dry-run] [--run] [--spec SPEC-ID]"
        echo ""
        echo "Examples:"
        echo -e "  ${GREEN}vibe.sh \"build auth module\"${NC}"
        echo -e "  ${GREEN}vibe.sh \"build auth module\" --dry-run${NC}"
        echo -e "  ${GREEN}vibe.sh --run --spec SPEC-123456${NC}"
        return 0
    fi
    
    info "Input: $input"
    
    # Step 1: Classify
    local intent
    intent=$(classify_intent "$input")
    info "Intent: $intent"
    
    if [ "$intent" == "COMMAND" ]; then
        ok "Input is a technical command — execute directly"
        echo ""
        echo -e "  ${GREEN}→${NC} $input"
        echo ""
        return 0
    fi
    
    # Step 2: Translate to SPEC
    spec_id=$(translate_to_spec "$input" "$dry_run")
    
    # Step 3: Generate pipeline
    generate_pipeline "$spec_id" "$dry_run"
    
    # Step 4: Execute loop
    execute_loop "$spec_id" "$dry_run"
    
    # Step 5: Summary
    show_summary "$spec_id" "full"
}

main "$@"
