#!/usr/bin/env bash
# gitea-pr.sh — Cria PR no Gitea automaticamente
# Uso: ./gitea-pr.sh [titulo] [base]
# Exemplo: ./gitea-pr.sh "feat: nova feature" main

set -euo pipefail

# Config
GITEA_URL="http://localhost:3300"
GITEA_TOKEN="50fca86d6a9ee37871f3a0cc3fa4efc7fc7cfb91"
GITEA_OWNER="will-zappro"
GITEA_REPO="monorepo"

# Args
TITLE="${1:-$(git log -1 --pretty=%s)}"
BASE="${2:-main}"
HEAD=$(git branch --show-current)

if [[ "$HEAD" == "$BASE" ]]; then
  echo "❌ Branch atual é '$BASE' — cria uma feature branch primeiro"
  exit 1
fi

# Body a partir dos commits na branch
BODY=$(git log --oneline "origin/$BASE..$HEAD" 2>/dev/null | head -20 | sed 's/^/- /' || echo "Automated PR")

echo "🔀 Criando PR: $HEAD → $BASE"
echo "   Title: $TITLE"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "$GITEA_URL/api/v1/repos/$GITEA_OWNER/$GITEA_REPO/pulls" \
  -H "Authorization: token $GITEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\": \"$TITLE\",
    \"head\": \"$HEAD\",
    \"base\": \"$BASE\",
    \"body\": \"## Commits\\n\\n$BODY\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY_RESP=$(echo "$RESPONSE" | head -n -1)

if [[ "$HTTP_CODE" -ge 200 && "$HTTP_CODE" -lt 300 ]]; then
  PR_URL=$(echo "$BODY_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('html_url',''))" 2>/dev/null)
  PR_NUM=$(echo "$BODY_RESP" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('number',''))" 2>/dev/null)
  echo "✅ PR #$PR_NUM criado: $PR_URL"
elif [[ "$HTTP_CODE" == "422" ]]; then
  # PR já existe
  EXISTING=$(curl -s "$GITEA_URL/api/v1/repos/$GITEA_OWNER/$GITEA_REPO/pulls?state=open&head=$HEAD" \
    -H "Authorization: token $GITEA_TOKEN" | \
    python3 -c "import json,sys; prs=json.load(sys.stdin); print(prs[0]['html_url'] if prs else 'unknown')" 2>/dev/null)
  echo "ℹ️ PR já existe: $EXISTING"
else
  echo "❌ Erro $HTTP_CODE: $BODY_RESP"
  exit 1
fi
