#!/bin/bash
# Cursor Loop Research Agent — MiniMax LLM
# Fetches research analysis using MiniMax-M2.1
# Secrets: .env as canonical source (synced from Infisical by external process)

set -e

TOPIC="${1:-}"
if [ -z "$TOPIC" ]; then
    echo "Usage: $0 <topic>" >&2
    echo "Example: $0 'latest GPU benchmarks 2026'" >&2
    exit 1
fi

# =============================================================================
# .env canonical source — no direct Infisical SDK calls
# All secrets synced from Infisical to .env by external process
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env"

# Load from .env (supports ${VAR:-default} syntax via set -a)
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

MINIMAX_API_KEY="${MINIMAX_API_KEY:-}"

# Fallback: Infisical REST API via service token (only if .env lookup failed)
if [ -z "$MINIMAX_API_KEY" ]; then
    TOKEN_PATH="/srv/ops/secrets/infisical.service-token"
    INFISICAL_PROJECT_ID="${INFISICAL_PROJECT_ID:-e42657ef-98b2-4b9c-9a04-46c093bd6d37}"
    INFISICAL_ENV="${INFISICAL_ENV:-dev}"

    if [[ -f "$TOKEN_PATH" ]]; then
        INFISICAL_TOKEN=$(<"$TOKEN_PATH")
        if [[ -n "$INFISICAL_TOKEN" ]]; then
            # Use REST API (no SDK) — Infisical must be running locally on port 8200
            MINIMAX_API_KEY=$(python3 -c "
import urllib.request, urllib.error, json, os

token = '''$INFISICAL_TOKEN'''.strip()
project_id = '''$INFISICAL_PROJECT_ID'''
env_slug = '''$INFISICAL_ENV'''

req = urllib.request.Request(
    f'http://127.0.0.1:8200/api/v3/secrets/raw/MINIMAX_API_KEY',
    headers={
        'Authorization': f'Bearer {token}',
        'X-Infisical-Project-ID': project_id,
        'X-Infisical-Environment': env_slug,
    }
)
try:
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.load(resp)
        print(data.get('secret', {}).get('secretValue', ''))
except urllib.error.URLError:
    print('', end='')
" 2>/dev/null || echo "")
        fi
    fi
fi

if [ -z "$MINIMAX_API_KEY" ]; then
    echo "ERROR: MINIMAX_API_KEY not found in .env or Infisical vault" >&2
    echo "Hint: Ensure secrets are synced from Infisical to .env" >&2
    exit 1
fi

# =============================================================================
# Build research prompt
# =============================================================================
RESEARCH_PROMPT="You are a research analyst. Provide a comprehensive, structured analysis of the following topic. Include key facts, recent developments, trade-offs, and actionable insights.

Topic: $TOPIC

Format your response with clear sections:
1. Overview
2. Key Facts & Recent Developments
3. Trade-offs & Considerations
4. Actionable Insights

Be thorough but concise. Format with markdown headings (##)."

# =============================================================================
# Call MiniMax API
# =============================================================================
PAYLOAD=$(python3 -c "
import json, sys
content = '''$RESEARCH_PROMPT'''
payload = {
    'model': 'MiniMax-M2.1',
    'messages': [{'role': 'user', 'content': content}],
    'max_tokens': 1024,
    'thinking': {'type': 'disabled'}
}
print(json.dumps(payload))
")

RESPONSE=$(curl -s -m 30 -X POST "https://api.minimax.io/anthropic/v1/messages" \
    -H "Authorization: Bearer $MINIMAX_API_KEY" \
    -H "Content-Type: application/json" \
    -H "anthropic-version: 2023-06-01" \
    -d "$PAYLOAD")

if [ -z "$RESPONSE" ]; then
    echo "ERROR: Empty response from MiniMax API" >&2
    exit 1
fi

# Parse response — extract content from MiniMax response
echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'content' in data:
        for block in data['content']:
            if block.get('type') == 'text' and block.get('text'):
                print(block['text'])
                break
        else:
            print('WARNING: No text content in response', file=sys.stderr)
    elif 'error' in data:
        print(f\"Error: {data['error'].get('type', 'unknown')}\", file=sys.stderr)
        print(data['error'].get('message', ''), file=sys.stderr)
        sys.exit(1)
    else:
        print('WARNING: Unexpected response format', file=sys.stderr)
        print(data, file=sys.stderr)
        sys.exit(1)
except json.JSONDecodeError as e:
    print(f\"Parse error: {e}\", file=sys.stderr)
    sys.exit(1)
"
