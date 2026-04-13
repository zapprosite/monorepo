#!/bin/bash
# Cursor Loop Research Agent — MiniMax LLM
# Fetches research analysis using MiniMax-M2.1 via Infisical SDK secret

# NOTE: No set -e — script must complete even if some steps fail

TOPIC="${1:-}"
if [ -z "$TOPIC" ]; then
    echo "Usage: $0 <topic>" >&2
    echo "Example: $0 'latest GPU benchmarks 2026'" >&2
    exit 1
fi

# =============================================================================
# Infisical — fetch MINIMAX_API_KEY from vault (falls back to env var)
# =============================================================================
INFISICAL_TOKEN="${INFISICAL_TOKEN:-}"
if [ -z "$INFISICAL_TOKEN" ] && [ -f /srv/ops/secrets/infisical.service-token ]; then
    INFISICAL_TOKEN=$(cat /srv/ops/secrets/infisical.service-token 2>/dev/null | tr -d '\n')
fi

fetch_minimax_key() {
    python3 -c "
import sys
from infisical_sdk import InfisicalSDKClient
import os

token = os.environ.get('INFISICAL_TOKEN', '')
if not token and os.path.exists('/srv/ops/secrets/infisical.service-token'):
    token = open('/srv/ops/secrets/infisical.service-token').read().strip()

if not token:
    sys.exit(1)

client = InfisicalSDKClient(host='http://127.0.0.1:8200', token=token)
secrets = client.secrets.list_secrets(
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == 'MINIMAX_API_KEY':
        print(s.secret_value, end='')
        break
" 2>/dev/null
}

# Try env var first, then Infisical
MINIMAX_API_KEY="${MINIMAX_API_KEY:-}"
if [ -z "$MINIMAX_API_KEY" ]; then
    MINIMAX_API_KEY=$(fetch_minimax_key)
fi

if [ -z "$MINIMAX_API_KEY" ]; then
    echo "ERROR: MINIMAX_API_KEY not set and not found in Infisical" >&2
    echo "Set MINIMAX_API_KEY env var or ensure MINIMAX_API_KEY exists in Infisical vault" >&2
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
# Call MiniMax API — escape JSON content properly
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
    -d "$PAYLOAD" 2>/dev/null)

# Parse response — extract content from MiniMax response
echo "$RESPONSE" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    if 'content' in data:
        for block in data['content']:
            if block.get('type') == 'text':
                print(block['text'])
    elif 'error' in data:
        print(f\"Error: {data['error'].get('type', 'unknown')}\", file=sys.stderr)
        print(data['error'].get('message', ''), file=sys.stderr)
        sys.exit(1)
    else:
        # Output raw for debugging
        print(data, file=sys.stderr)
        sys.exit(1)
except Exception as e:
    print(f\"Parse error: {e}\", file=sys.stderr)
    sys.exit(1)
"