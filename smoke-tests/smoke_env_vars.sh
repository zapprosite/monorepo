#!/bin/bash
# smoke_env_vars.sh - Validate environment variables in config

set -e
cd /srv/monorepo

echo "=== HC-33: API_BASE validation ==="
# Check config.yaml for api_base with path (should NOT have path)
if grep -E "api_base:\s*https?://[^/]+/" /home/will/zappro-lite/config.yaml 2>/dev/null | grep -v "^[[:space:]]*#"; then
    echo "⚠️ api_base contains PATH - this violates HC-33!"
    grep -n -E "api_base:\s*https?://[^/]+/" /home/will/zappro-lite/config.yaml | grep -v "^[[:space:]]*#"
    exit 1
fi

echo "✓ api_base entries are clean (no path)"

echo ""
echo "=== Token Validation ==="
# Check .env files don't have old/placeholder tokens
for env in /home/will/zappro-lite/.env /srv/monorepo/.env; do
    if [ -f "$env" ]; then
        if grep -q "your-trieve-api-key\|your-openai-key\|TODO" "$env" 2>/dev/null; then
            echo "⚠️ Placeholder tokens found in $env"
        fi
    fi
done

echo ""
echo "=== Required Env Vars ==="
required_vars="MINIMAX_API_KEY OPENROUTER_API_KEY LITELLM_MASTER_KEY"
for var in $required_vars; do
    if grep -q "$var" /home/will/zappro-lite/.env 2>/dev/null; then
        echo "✓ $var found"
    else
        echo "✗ $var missing in zappro-lite/.env"
    fi
done

echo ""
echo "=== Environment validation complete ==="