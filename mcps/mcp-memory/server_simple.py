#!/usr/bin/env python3
"""
mcp-memory — Simple Memory MCP Server
Provides vector memory operations via Qdrant backend.
"""

import os
import json
import uuid
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from qdrant_client import QdrantClient
from qdrant_client.http import models
from qdrant_client.http.exceptions import UnexpectedResponse

# Config from environment
QDRANT_HOST = os.getenv("QDRANT_HOST", "localhost")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))
QDRANT_URL = os.getenv("QDRANT_URL", f"http://{QDRANT_HOST}:{QDRANT_PORT}")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
COLLECTION_NAME = os.getenv("MEM0_COLLECTION", "will")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="mcp-memory")

# Initialize Qdrant client
try:
    client = QdrantClient(
        url=QDRANT_URL,
        api_key=QDRANT_API_KEY if QDRANT_API_KEY else None
    )
    # Test connection
    client.get_collections()
    logger.info(f"Connected to Qdrant at {QDRANT_URL}")
except Exception as e:
    logger.warning(f"Qdrant not available: {e}. Using mock mode.")
    client = None

# Ensure collection exists
def ensure_collection():
    """Create collection if it doesn't exist."""
    if client is None:
        return False
    try:
        collections = client.get_collections().collections
        if not any(c.name == COLLECTION_NAME for c in collections):
            client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=models.VectorParams(
                    size=1536,  # Standard embedding size
                    distance=models.Distance.COSINE
                )
            )
            logger.info(f"Created collection: {COLLECTION_NAME}")
        return True
    except Exception as e:
        logger.error(f"Error ensuring collection: {e}")
        return False

# Try to ensure collection on startup
ensure_collection()

# --- MCP Tools (JSON over HTTP) ---

class MemoryEntry(BaseModel):
    text: str
    user_id: str = "default"
    metadata: Dict[str, Any] = {}

class SearchQuery(BaseModel):
    query: str
    limit: int = 5
    user_id: str = "default"

@app.get("/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "mcp-memory",
        "collection": COLLECTION_NAME,
        "qdrant": QDRANT_URL,
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/tools/memory_add")
async def memory_add(entry: MemoryEntry):
    """Add a memory entry."""
    if client is None:
        raise HTTPException(status_code=503, detail="Qdrant not available")

    try:
        point_id = str(uuid.uuid4())
        client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                models.PointStruct(
                    id=point_id,
                    vector=[0.0] * 1536,  # Placeholder - in production, use embedding model
                    payload={
                        "text": entry.text,
                        "user_id": entry.user_id,
                        "metadata": entry.metadata,
                        "created_at": datetime.utcnow().isoformat()
                    }
                )
            ]
        )
        return {"success": True, "id": point_id, "message": "Memory added"}
    except Exception as e:
        logger.error(f"Error adding memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/tools/memory_search")
async def memory_search(query: SearchQuery):
    """Search memories."""
    if client is None:
        raise HTTPException(status_code=503, detail="Qdrant not available")

    try:
        # In production, compute actual embedding for query
        # For now, return recent entries
        results = client.scroll(
            collection_name=COLLECTION_NAME,
            scroll_filter=models.Filter(
                must=[
                    models.FieldCondition(
                        key="user_id",
                        match=models.MatchValue(value=query.user_id)
                    )
                ]
            ),
            limit=query.limit
        )

        memories = []
        for point in results[0]:
            memories.append({
                "id": point.id,
                "text": point.payload.get("text"),
                "user_id": point.payload.get("user_id"),
                "metadata": point.payload.get("metadata", {}),
                "created_at": point.payload.get("created_at")
            })

        return {"results": memories, "count": len(memories)}
    except Exception as e:
        logger.error(f"Error searching memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/tools/memory_delete/{memory_id}")
async def memory_delete(memory_id: str):
    """Delete a memory by ID."""
    if client is None:
        raise HTTPException(status_code=503, detail="Qdrant not available")

    try:
        client.delete(
            collection_name=COLLECTION_NAME,
            points_selector=models.PointIdsList(points=[memory_id])
        )
        return {"success": True, "id": memory_id, "message": "Memory deleted"}
    except Exception as e:
        logger.error(f"Error deleting memory: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/tools/memory_all")
async def memory_all(user_id: str = "default", limit: int = 100):
    """Get all memories for a user."""
    if client is None:
        raise HTTPException(status_code=503, detail="Qdrant not available")

    try:
        # Get all points without filter (collection is per-user)
        results = client.scroll(
            collection_name=COLLECTION_NAME,
            limit=limit
        )

        memories = []
        for point in results[0]:
            # Filter by user_id client-side
            if point.payload.get("user_id") == user_id:
                memories.append({
                    "id": point.id,
                    "text": point.payload.get("text"),
                    "user_id": point.payload.get("user_id"),
                    "metadata": point.payload.get("metadata", {}),
                    "created_at": point.payload.get("created_at")
                })

        return {"results": memories, "count": len(memories)}
    except Exception as e:
        logger.error(f"Error getting all memories: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
async def root():
    return {
        "service": "mcp-memory",
        "version": "1.0.0",
        "endpoints": ["/health", "/tools/memory_add", "/tools/memory_search", "/tools/memory_delete/{id}", "/tools/memory_all"]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=4016)
