#!/bin/bash
# ship.sh — Create PR or ISSUE on Gitea
# Anti-hardcoded: all config via process.env
set -euo pipefail

ACTION="${1:-}"
SPEC="${2:-}"

log() { echo "[$(date '+%H:%M:%S')] $1"; }

# Get Git remote info
get-remote-url() {
  git remote get-url gitea 2>/dev/null || git remote get-url origin 2>/dev/null
}

get-current-branch() {
  git branch --show-current
}

# Create PR on Gitea
create-pr() {
  local branch
  local base_branch="main"
  branch=$(get-current-branch)

  log "Criando PR: $branch -> $base_branch"

  # Check if gh CLI is available (works for both GitHub and Gitea)
  if command -v gh &> /dev/null; then
    gh pr create --base "$base_branch" --head "$branch" --title "Feature: $SPEC" --body "Pipeline completed for $SPEC"
  else
    log "GH CLI nao disponivel, tentand via git push"
    git push gitea HEAD
  fi
}

# Create ISSUE on Gitea
create-issue() {
  local pipeline
  local spec="$SPEC"

  pipeline=$(cat tasks/pipeline.json 2>/dev/null | jq -r '.pipeline // "unknown"' || echo "unknown")

  log "Criando ISSUE para pipeline: $pipeline (SPEC: $spec)"

  # Use Gitea API if available
  if [ -n "${GITEA_TOKEN:-}" ]; then
    local gitea_url
    gitea_url=$(get-remote-url | sed 's/git@[^:]*://' | sed 's/\.git//')
    gitea_url="https://$(echo "$gitea_url" | sed 's/.*@//')"

    curl -X POST "$gitea_url/api/v1/repos/issues" \
      -H "Authorization: Bearer $GITEA_TOKEN" \
      -H "Content-Type: application/json" \
      -d "{\"title\": \"Pipeline Failed: $spec\", \"body\": \"Pipeline $pipeline failed. Manual intervention required.\"}"
  else
    log "GITEA_TOKEN nao disponivel, ISSUE nao criado"
    return 1
  fi
}

# Main
case "$ACTION" in
  --pr)
    create-pr
    ;;
  --issue)
    create-issue
    ;;
  *)
    echo "Usage: ship.sh [--pr|--issue] [SPEC-NNN]"
    exit 1
    ;;
esac
