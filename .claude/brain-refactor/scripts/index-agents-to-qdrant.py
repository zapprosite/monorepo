#!/usr/bin/env python3
"""
Index Hermes agent source files into Qdrant
doc_type=agent, project=hermes

Usage:
  source /srv/monorepo/.env
  python3 scripts/index-agents-to-qdrant.py
"""
import os
import uuid
from pathlib import Path
from typing import Any

import httpx

# Config
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY")
COLLECTION = "will"
VECTOR_SIZE = 768

if not QDRANT_API_KEY:
    raise RuntimeError("QDRANT_API_KEY not set in .env")

HEADERS = {
    "Content-Type": "application/json",
    "Authorization": f"Bearer {QDRANT_API_KEY}",
}

AGENT_FILES = [
    "/home/will/.hermes/hermes-agent/run_agent.py",
    "/home/will/.hermes/hermes-agent/model_tools.py",
    "/home/will/.hermes/hermes-agent/toolsets.py",
    "/home/will/.hermes/hermes-agent/cli.py",
    "/home/will/.hermes/hermes-agent/AGENTS.md",
]

GATEWAY_FILES = [
    "/home/will/.hermes/hermes-agent/gateway/channel_directory.py",
    "/home/will/.hermes/hermes-agent/gateway/config.py",
    "/home/will/.hermes/hermes-agent/gateway/delivery.py",
    "/home/will/.hermes/hermes-agent/gateway/display_config.py",
    "/home/will/.hermes/hermes-agent/gateway/hooks.py",
    "/home/will/.hermes/hermes-agent/gateway/mirror.py",
    "/home/will/.hermes/hermes-agent/gateway/pairing.py",
    "/home/will/.hermes/hermes-agent/gateway/restart.py",
    "/home/will/.hermes/hermes-agent/gateway/run.py",
    "/home/will/.hermes/hermes-agent/gateway/session_context.py",
    "/home/will/.hermes/hermes-agent/gateway/session.py",
    "/home/will/.hermes/hermes-agent/gateway/status.py",
    "/home/will/.hermes/hermes-agent/gateway/sticker_cache.py",
    "/home/will/.hermes/hermes-agent/gateway/stream_consumer.py",
]

ALL_FILES = AGENT_FILES + GATEWAY_FILES

# Zero vector for metadata-only indexing
ZERO_VECTOR = [0.0] * VECTOR_SIZE


def chunk_text(text: str, chunk_size: int = 1000, overlap: int = 100) -> list[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    text_len = len(text)
    while start < text_len:
        end = start + chunk_size
        chunks.append(text[start:end])
        start += chunk_size - overlap
    return chunks


def compute_id(file_path: str, chunk_idx: int) -> str:
    """Generate deterministic UUID point ID from file path and chunk index."""
    raw = f"{file_path}:{chunk_idx}"
    return str(uuid.uuid5(uuid.NAMESPACE_DNS, raw))


def get_metadata(file_path: str) -> dict[str, Any]:
    """Build Qdrant payload metadata."""
    path = Path(file_path)
    filename = path.name

    if "/gateway/" in file_path:
        service = "gateway"
    elif filename in ("run_agent.py", "model_tools.py", "toolsets.py", "cli.py"):
        service = "hermes-agent-core"
    else:
        service = "hermes-agent"

    return {
        "project": "hermes",
        "doc_type": "agent",
        "service_name": service,
        "owner": "william",
        "source_path": file_path,
        "filename": filename,
    }


def index_file(client: httpx.Client, file_path: str) -> int:
    """Index a single file into Qdrant. Returns number of chunks indexed."""
    if not os.path.exists(file_path):
        print(f"[SKIP] File not found: {file_path}")
        return 0

    with open(file_path, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()

    if not content.strip():
        print(f"[SKIP] Empty file: {file_path}")
        return 0

    chunks = chunk_text(content)
    metadata_base = get_metadata(file_path)

    points = []
    for idx, chunk in enumerate(chunks):
        point_id = compute_id(file_path, idx)
        payload = {
            **metadata_base,
            "text": chunk,
            "chunk_index": idx,
            "total_chunks": len(chunks),
        }
        points.append({"id": point_id, "vector": ZERO_VECTOR, "payload": payload})

    # Upsert points
    url = f"{QDRANT_URL}/collections/{COLLECTION}/points"
    response = client.put(url, json={"points": points})

    if response.status_code in (200, 201):
        print(f"[OK] Indexed {file_path} ({len(chunks)} chunks)")
        return len(chunks)
    else:
        print(f"[ERROR] Failed to index {file_path}: {response.status_code} {response.text}")
        return 0


def main():
    print(f"[INIT] Indexing Hermes agent files to Qdrant collection '{COLLECTION}'")
    print(f"[INIT] QDRANT_URL: {QDRANT_URL}")
    print(f"[INIT] Files to index: {len(ALL_FILES)}")
    print(f"[INIT] Using zero vectors (metadata-only indexing)")

    total_chunks = 0

    with httpx.Client(headers=HEADERS, timeout=60.0) as client:
        for file_path in ALL_FILES:
            chunks = index_file(client, file_path)
            total_chunks += chunks

    print(f"\n[DONE] Indexed {total_chunks} chunks from {len(ALL_FILES)} files")


if __name__ == "__main__":
    main()
