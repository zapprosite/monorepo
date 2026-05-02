#!/usr/bin/env python3
"""
Hermes Mem0 Wrapper — Universal Memory Layer
============================================
Mem0 v2.0.0 + Ollama (nomic-embed-text 768D) + LiteLLM (MiniMax-M2.7)

Usage:
    python3 mem0_wrapper.py add "fact" --category user_pref
    python3 mem0_wrapper.py search "query"
    python3 mem0_wrapper.py get_all

Environment (from ~/.hermes/secrets.env):
    LITELLM_MASTER_KEY, QDRANT_API_KEY, OPENAI_API_KEY=not-needed
"""

import os, sys, argparse, json
from pathlib import Path

# Load secrets from ~/.hermes/secrets.env
_SCRIPTS_DIR = Path(__file__).parent
_HERMES_HOME = Path.home() / ".hermes"
_SECRETS_PATH = _HERMES_HOME / "secrets.env"
if _SECRETS_PATH.exists():
    with open(_SECRETS_PATH) as f:
        for line in f:
            if "=" in line and not line.startswith("#"):
                k, _, v = line.partition("=")
                os.environ[k.strip()] = v.strip()

# LiteLLM config for Mem0 LLM
os.environ["LITELLM_BASE_URL"] = "http://localhost:4018"
os.environ["LITELLM_API_KEY"] = os.environ.get("LITELLM_MASTER_KEY", "")

from mem0 import Memory
from mem0.configs.base import MemoryConfig, LlmConfig, EmbedderConfig, VectorStoreConfig

_MEMORY_CONFIG = None
_memory_instance = None

def get_memory():
    global _memory_instance
    if _memory_instance is not None:
        return _memory_instance

    config = MemoryConfig(
        llm=LlmConfig(
            provider="litellm",
            config={"model": "minimax-m2.7"}
        ),
        embedder=EmbedderConfig(
            provider="ollama",
            config={
                "model": "nomic-embed-text",
                "embedding_dims": 768,
                "ollama_base_url": "http://localhost:11434",
            }
        ),
        vector_store=VectorStoreConfig(
            provider="qdrant",
            config={
                "collection_name": "mem0",
                "url": "http://127.0.0.1",
                "port": 6333,
                "api_key": os.environ.get("QDRANT_API_KEY", ""),
                "embedding_model_dims": 768,
            }
        ),
        history_db_path=str(Path.home() / ".mem0" / "history.db"),
    )
    _memory_instance = Memory(config=config)
    return _memory_instance


def cmd_add(fact: str, category: str = "general"):
    m = get_memory()
    result = m.add(fact, user_id="will", infer=False, metadata={"category": category})
    return result


def cmd_search(query: str, limit: int = 5):
    m = get_memory()
    results = m.search(query, filters={"user_id": "will"}, limit=limit)
    return results


def cmd_get_all():
    m = get_memory()
    results = m.get_all(filters={"user_id": "will"})
    return results


def main():
    parser = argparse.ArgumentParser(description="Hermes Mem0 Universal Memory")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_add = sub.add_parser("add", help="Add a fact to memory")
    p_add.add_argument("fact", help="Fact to store")
    p_add.add_argument("--category", "-c", default="general", help="Category label")

    p_search = sub.add_parser("search", help="Search memory")
    p_search.add_argument("query", help="Search query")
    p_search.add_argument("--limit", "-n", type=int, default=5)

    p_get = sub.add_parser("get_all", help="Get all memories")

    args = parser.parse_args()

    if args.cmd == "add":
        result = cmd_add(args.fact, args.category)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    elif args.cmd == "search":
        result = cmd_search(args.query, args.limit)
        print(json.dumps(result, indent=2, ensure_ascii=False))
    elif args.cmd == "get_all":
        result = cmd_get_all()
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
