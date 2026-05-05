"""
HCE v2.0 — Sync Engine
Scans source directories, generates embeddings via Ollama, upserts to Qdrant.
"""
import os
import hashlib
import logging
from pathlib import Path
from typing import List, Dict, Any

import requests

logger = logging.getLogger(__name__)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = os.environ.get("QDRANT_COLLECTION", "hce_context")


def _embed(text: str) -> List[float]:
    """Synchronous embedding call to Ollama."""
    resp = requests.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={"model": EMBED_MODEL, "prompt": text},
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["embedding"]


def _content_hash(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def scan_sources(paths: List[str]) -> List[Dict[str, Any]]:
    docs: List[Dict[str, Any]] = []
    for p in paths:
        root = Path(p)
        if not root.exists():
            logger.warning("Source path does not exist: %s", p)
            continue
        for f in root.rglob("*"):
            if f.is_file() and f.suffix in {".md", ".txt"}:
                text = f.read_text(encoding="utf-8")
                docs.append(
                    {
                        "id": f"{f.parent.name}/{f.name}",
                        "text": text,
                        "hash": _content_hash(text),
                        "source": str(f),
                    }
                )
    return docs


def upsert_to_qdrant(docs: List[Dict[str, Any]]) -> None:
    """Sync upsert to Qdrant. No hash-based skip yet."""
    points = []
    for doc in docs:
        vector = _embed(doc["text"])
        points.append(
            {
                "id": doc["id"],
                "vector": vector,
                "payload": {
                    "text": doc["text"],
                    "hash": doc["hash"],
                    "source": doc["source"],
                },
            }
        )

    resp = requests.put(
        f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}/points",
        json={"points": points},
        timeout=60,
    )
    resp.raise_for_status()
    logger.info("Upserted %d documents to Qdrant", len(points))


def run_sync(source_paths: List[str]) -> None:
    docs = scan_sources(source_paths)
    if not docs:
        logger.info("No documents found.")
        return
    upsert_to_qdrant(docs)
