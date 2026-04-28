#!/usr/bin/env bash
# fix-mem0.sh — Corrige Mem0 para usar LiteLLM + Qdrant local
# Run once: bash /srv/monorepo/scripts/fix-mem0.sh
set -euo pipefail

echo "[fix-mem0] Installing litellm..."
python3 -m pip install litellm -q --target /home/will/.hermes/hermes-agent/venv/lib/python3.11/site-packages/ 2>/dev/null || true

echo "[fix-mem0] Testing Mem0 connection..."

python3 << 'PYEOF'
import os
from mem0.memory.main import Memory
from mem0.configs.base import MemoryConfig, VectorStoreConfig, LlmConfig, EmbedderConfig

for line in open('/srv/monorepo/.env').read().splitlines():
    if '=' in line and not line.startswith('#'):
        k,_,v=line.partition('=')
        os.environ[k.strip()]=v.strip()

litellm_key = os.environ.get('LITELLM_MASTER_KEY','')

config = MemoryConfig(
    vector_store=VectorStoreConfig(
        provider="qdrant",
        config={
            "collection_name": "will",
            "url": "http://localhost:6333",
            "api_key": os.environ.get("QDRANT_API_KEY", ""),
        }
    ),
    llm=LlmConfig(
        provider="openai",
        config={
            "model": "Gemma4-12b-it",
            "api_key": litellm_key,
            "openai_base_url": "http://localhost:4000/v1",
        }
    ),
    embedder=EmbedderConfig(
        provider="openai",
        config={
            "model": "embedding-nomic",
            "api_key": litellm_key,
            "openai_base_url": "http://localhost:4000/v1",
        }
    ),
)

m = Memory(config=config)
r = m.add("Mem0 fix verified 2026-04-23", user_id="system_check")
print(f"[fix-mem0] Mem0 add: SUCCESS — {r.get('id','OK')}")

results = m.search("Mem0 fix verified", filters={"user_id": "system_check"}, limit=1)
print(f"[fix-mem0] Mem0 search: SUCCESS — {len(results)} results")
PYEOF

echo "[fix-mem0] Done."
