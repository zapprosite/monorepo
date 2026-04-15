#!/bin/bash
# Cursor Loop Research Agent — MiniMax LLM
# Fetches research analysis using MiniMax-M2.1
# Secrets: .env is canonical source (Infisical pruned 2026-04-13)

set -e

TOPIC="${1:-}"
if [ -z "$TOPIC" ]; then
    echo "Usage: $0 <topic>" >&2
    echo "Example: $0 'latest GPU benchmarks 2026'" >&2
    exit 1
fi

# =============================================================================
# Load .env — canonical source, anti-hardcoded pattern
# =============================================================================
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &>/dev/null && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a; source "$ENV_FILE"; set +a
fi

MINIMAX_API_KEY="${MINIMAX_API_KEY:-}"

if [ -z "$MINIMAX_API_KEY" ]; then
    echo "ERROR: MINIMAX_API_KEY not set in .env" >&2
    echo "Hint: Add MINIMAX_API_KEY to /srv/monorepo/.env" >&2
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
