#!/usr/bin/env python3
"""
Index service config files (docker-compose) into Qdrant
doc_type=service, project=monorepo

Usage:
  source /srv/monorepo/.env
  python3 .claude/brain-refactor/scripts/index-services-to-qdrant.py
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

SERVICE_FILES = [
    # app services
    "/srv/monorepo/apps/ai-gateway/docker-compose.yml",
    "/srv/monorepo/apps/list-web/docker-compose.yml",
    "/srv/monorepo/apps/obsidian-web/docker-compose.yml",
    # mcps
    "/srv/monorepo/mcps/mcp-memory/docker-compose.yml",
    # root compose
    "/srv/monorepo/docker-compose.yml",
    "/srv/monorepo/docker-compose.gitea-runner.yml",
    "/srv/monorepo/docker-compose.openwebui.yml",
]

# Service name mapping based on file path
SERVICE_MAP = {
    "apps/ai-gateway/docker-compose.yml": "ai-gateway",
    "apps/list-web/docker-compose.yml": "list-web",
    "apps/obsidian-web/docker-compose.yml": "obsidian-web",
    "mcps/mcp-memory/docker-compose.yml": "mcp-memory",
    "docker-compose.yml": "monitoring",
    "docker-compose.gitea-runner.yml": "gitea-runner",
    "docker-compose.openwebui.yml": "openwebui",
}

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
    rel_path = file_path.replace("/srv/monorepo/", "")
    service_name = SERVICE_MAP.get(rel_path, rel_path.split("/")[-1].replace(".yml", ""))

    return {
        "project": "monorepo",
        "doc_type": "service",
        "service_name": service_name,
        "owner": "william",
        "source_path": file_path,
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
    print(f"[INIT] Indexing service configs to Qdrant collection '{COLLECTION}'")
    print(f"[INIT] QDRANT_URL: {QDRANT_URL}")
    print(f"[INIT] Files to index: {len(SERVICE_FILES)}")
    print(f"[INIT] Using zero vectors (metadata-only indexing)")

    total_chunks = 0

    with httpx.Client(headers=HEADERS, timeout=60.0) as client:
        for file_path in SERVICE_FILES:
            chunks = index_file(client, file_path)
            total_chunks += chunks

    print(f"\n[DONE] Indexed {total_chunks} chunks from {len(SERVICE_FILES)} files")


if __name__ == "__main__":
    main()
