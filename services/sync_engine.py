"""
HCE v2.1 — Sync Engine (Phase 4)
Scans source directories, generates embeddings via Ollama, upserts to Qdrant.
Async embeddings + content-hash deduplication to reduce redundant writes.
"""
import os
import hashlib
import logging
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Set

import aiohttp

logger = logging.getLogger(__name__)

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")
QDRANT_COLLECTION = os.environ.get("QDRANT_COLLECTION", "hce_context")


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


async def _embed(session: aiohttp.ClientSession, text: str) -> List[float]:
    """Async embedding call to Ollama."""
    async with session.post(
        f"{OLLAMA_URL}/api/embeddings",
        json={"model": EMBED_MODEL, "prompt": text},
        timeout=aiohttp.ClientTimeout(total=60),
    ) as resp:
        resp.raise_for_status()
        data = await resp.json()
        return data["embedding"]


async def _fetch_existing_hashes(
    session: aiohttp.ClientSession, doc_ids: List[str]
) -> Dict[str, str]:
    """
    Retrieve existing content hashes from Qdrant for the given IDs.
    Returns {doc_id: hash} for docs that already exist.
    """
    if not doc_ids:
        return {}

    payload = {
        "ids": doc_ids,
        "with_payload": True,
        "with_vector": False,
    }

    try:
        async with session.post(
            f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}/points/retrieve",
            json=payload,
            timeout=aiohttp.ClientTimeout(total=30),
        ) as resp:
            resp.raise_for_status()
            data = await resp.json()
    except Exception as exc:
        logger.warning("Failed to fetch existing hashes from Qdrant: %s", exc)
        return {}

    results: Dict[str, str] = {}
    for point in data.get("result", []):
        pid = point.get("id")
        phash = point.get("payload", {}).get("hash")
        if pid is not None and phash is not None:
            results[str(pid)] = phash
    return results


async def upsert_to_qdrant(docs: List[Dict[str, Any]]) -> None:
    """
    Async upsert to Qdrant with content-hash deduplication.
    Only embeds and upserts documents whose hash has changed.
    """
    if not docs:
        logger.info("No documents to upsert.")
        return

    async with aiohttp.ClientSession() as session:
        doc_ids = [doc["id"] for doc in docs]
        existing_hashes = await _fetch_existing_hashes(session, doc_ids)

        changed_docs = [
            doc for doc in docs if existing_hashes.get(doc["id"]) != doc["hash"]
        ]
        skipped = len(docs) - len(changed_docs)
        if skipped:
            logger.info("Skipped %d unchanged documents based on content hash.", skipped)
        if not changed_docs:
            logger.info("All documents unchanged. Nothing to upsert.")
            return

        points = []
        for doc in changed_docs:
            vector = await _embed(session, doc["text"])
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

        async with session.put(
            f"{QDRANT_URL}/collections/{QDRANT_COLLECTION}/points",
            json={"points": points},
            timeout=aiohttp.ClientTimeout(total=60),
        ) as resp:
            resp.raise_for_status()
            logger.info(
                "Upserted %d documents to Qdrant (%d skipped)",
                len(points),
                skipped,
            )


async def run_sync(source_paths: List[str]) -> None:
    docs = scan_sources(source_paths)
    if not docs:
        logger.info("No documents found.")
        return
    await upsert_to_qdrant(docs)


# Backwards-compatible synchronous wrapper for callers that need it
def run_sync_sync(source_paths: List[str]) -> None:
    asyncio.run(run_sync(source_paths))
