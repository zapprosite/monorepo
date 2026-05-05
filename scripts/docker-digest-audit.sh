#!/usr/bin/env bash
# =============================================================================
# docker-digest-audit.sh — Detect :latest/:nightly tags in Docker compose files
# =============================================================================
# Usage:
#   bash docker-digest-audit.sh [--ci] [--paths /srv/monorepo /srv/ops]
#
# Exit codes:
#   0 = clean (no violations)
#   1 = violations found
#   2 = script error
#
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

CI_MODE=false
SEARCH_PATHS=(
  "/srv/monorepo"
  "/srv/ops"
  "/srv/edge-tts"
  "/srv/monorepo/services"
)

usage() {
  cat <<'EOF'
docker-digest-audit.sh — Audit Docker compose files for :latest/:nightly tags

Flags:
  --ci          CI mode — exit 1 on violation, no color
  --paths DIR...  Override search paths
  --help        This message
EOF
  exit 0
}

for arg in "$@"; do
  case "$arg" in
    --ci) CI_MODE=true ;;
    --help) usage ;;
    --paths) shift; SEARCH_PATHS=(); while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do SEARCH_PATHS+=("$1"); shift; done ;;
  esac
done

if $CI_MODE; then
  RED=''; GREEN=''; YELLOW=''; NC=''
fi

VIOLATIONS=0
REPORT=""

echo ""
echo -e "${GREEN}━━━ Docker Digest Audit ━━━${NC}"
echo ""

for path in "${SEARCH_PATHS[@]}"; do
  if [[ ! -d "$path" ]]; then
    continue
  fi

  while IFS= read -r -d '' file; do
    while IFS=: read -r line_num content; do
      image=$(echo "$content" | grep -oP 'image:\s*\K[^\s]+' | head -1)
      if [[ -n "$image" ]]; then
        REPORT+="  ${RED}VIOLATION${NC} | $file:$line_num | $image"$'\n'
        ((VIOLATIONS++)) || true
      fi
    done < <(grep -nE 'image:.*:(latest|nightly)\b' "$file" 2>/dev/null)
  done < <(find "$path" -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' -print0 2>/dev/null)
done

# Also check for :latest in environment variables (Ollama models, etc.)
for path in "${SEARCH_PATHS[@]}"; do
  if [[ ! -d "$path" ]]; then
    continue
  fi
  while IFS= read -r -d '' file; do
    while IFS=: read -r line_num content; do
      if echo "$content" | grep -qP ':latest\b'; then
        REPORT+="  ${YELLOW}ENV-LATEST${NC} | $file:$line_num | $content"$'\n'
        ((VIOLATIONS++)) || true
      fi
    done < <(grep -nE 'MODEL.*:latest|EMBEDDING.*:latest' "$file" 2>/dev/null)
  done < <(find "$path" -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' -print0 2>/dev/null)
done

echo ""
if [[ -n "$REPORT" ]]; then
  echo "$REPORT"
fi

if [[ $VIOLATIONS -eq 0 ]]; then
  echo -e "${GREEN}━━━ AUDIT PASSED: 0 violations ━━━${NC}"
  exit 0
else
  echo -e "${RED}━━━ AUDIT FAILED: $VIOLATIONS violation(s) ━━━${NC}"
  if $CI_MODE; then
    exit 1
  fi
  exit 1
fi
