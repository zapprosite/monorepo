#!/usr/bin/env bash
# =============================================================================
# sync-hermes-env.sh — Sync ~/.hermes/.env from /srv/monorepo/.env
#
# Usage:
#   bash scripts/sync-hermes-env.sh
#
# What it syncs:
#   - QDRANT_API_KEY (critical: Mem0 uses it)
#   - MEM0_* vars (collection, embedding model, llm model)
#   - OLLAMA_* vars (URL, base URL, model, vision model)
#   - LITELLM_API_KEY (mem0 llm provider)
#   - MINIMAX_API_KEY (hermes provider)
#   - GROQ_API_KEY (STT)
#   - OPEN_AI_KEY (legacy)
#   - HF_TOKEN
#   - SESSION_SECRET, INTERNAL_API_SECRET
#   - AI_GATEWAY_FACADE_KEY
#
# The monorepo .env is the CANONICAL source for all API keys.
# ~/.hermes/.env is a subset used by hermes-agent CLI.
# =============================================================================
set -euo pipefail

SOURCE="/srv/monorepo/.env"
TARGET="$HOME/.hermes/.env"

if [[ ! -f "$SOURCE" ]]; then
    echo "ERROR: $SOURCE not found"
    exit 1
fi

echo "[sync-hermes-env] Syncing $SOURCE → $TARGET"

# ── Variables to sync ──────────────────────────────────────────────────────
VARS=(
    "QDRANT_API_KEY"
    "QDRANT_URL"
    "QDRANT_GRPC_URL"
    "QDRANT_COLLECTION"
    "QDRANT_VECTOR_DIM"
    "QDRANT_DISTANCE"
    "MEM0_COLLECTION"
    "MEM0_EMBEDDING_MODEL"
    "MEM0_LLM_MODEL"
    "MEM0_QDRANT_HOST"
    "MEM0_QDRANT_PORT"
    "MEM0_LLM_PROVIDER"
    "MEM0_API_KEY"
    "OLLAMA_URL"
    "OLLAMA_BASE_URL"
    "OLLAMA_EMBED_MODEL"
    "OLLAMA_MODEL"
    "OLLAMA_VISION_MODEL"
    "LITELLM_API_KEY"
    "MINIMAX_API_KEY"
    "MINIMAX_API_BASE"
    "HERMES_MINIMAX_BASE"
    "GROQ_API_KEY"
    "OPEN_AI_KEY"
    "HF_TOKEN"
    "SESSION_SECRET"
    "INTERNAL_API_SECRET"
    "AI_GATEWAY_FACADE_KEY"
    "CONTEXT7_ENABLED"
    "CONTEXT7_API_KEY"
    "TRIEVE_URL"
    "TRIEVE_API_KEY"
    "TRIEVE_DEFAULT_DATASET_ID"
    "TRIEVE_PG_PASSWORD"
    "KEYCLOAK_ADMIN_PASSWORD"
)

# ── Read source .env ────────────────────────────────────────────────────────
declare -A SOURCE_VALUES
while IFS= read -r line || [[ -n "$line" ]]; do
    # Skip comments and empty lines
    [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
    # Parse VAR=value
    if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*) ]]; then
        var_name="${BASH_REMATCH[1]}"
        var_value="${BASH_REMATCH[2]}"
        SOURCE_VALUES["$var_name"]="$var_value"
    fi
done < "$SOURCE"

# ── Update TARGET in-place ───────────────────────────────────────────────────
# We'll rebuild the file, preserving structure and non-synced vars
declare -A UPDATED

for var in "${VARS[@]}"; do
    if [[ -n "${SOURCE_VALUES[$var]:-}" ]]; then
        UPDATED["$var"]="${SOURCE_VALUES[$var]}"
        echo "  ✓ $var = ${SOURCE_VALUES[$var]:0:20}..."
    fi
done

# ── Patch each var individually in TARGET ───────────────────────────────────
for var in "${!UPDATED[@]}"; do
    value="${UPDATED[$var]}"
    
    if grep -q "^${var}=" "$TARGET" 2>/dev/null; then
        # Replace existing value (preserve quote style if present)
        # Use sed that handles special chars in value
        sed -i "s|^${var}=.*|${var}=${value}|" "$TARGET"
    else
        # Append if missing
        echo "${var}=${value}" >> "$TARGET"
    fi
done

echo "[sync-hermes-env] Done."
echo ""
echo "NOTE: For Mem0 to work, ensure QDRANT_API_KEY is the REAL key (64 chars),"
echo "      not masked. Check: curl -s -H \"api-key: \$(grep QDRANT_API_KEY ~/.hermes/.env | cut -d= -f2)\" http://localhost:6333/collections"
