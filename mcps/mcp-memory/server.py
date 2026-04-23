#!/usr/bin/env python3
"""
mcp-memory — Mem0 Memory MCP Server
Provides semantic memory operations via Mem0 + Qdrant backend.
"""

import os
import json
import logging
from datetime import datetime
from typing import Optional, List, Dict, Any

from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
import mem0
from mem0 import Memory

# Config from environment
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")
COLLECTION_NAME = os.getenv("MEM0_COLLECTION", "will")
API_KEY = os.getenv("QDRANT_API_KEY", "")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Mem0 with Qdrant backend
config = {
    "vector_store": {
        "provider": "qdrant",
        "config": {
            "host": QDRANT_URL.replace("http://", "").replace("https://", "").split(":")[0],
            "port": int(QDRANT_URL.split(":")[-1]) if ":" in QDRANT_URL else 6333,
            "collection_name": COLLECTION_NAME,
            "embedding_model": "sentence-transformers/all-MiniLM-L6-v2",
        }
    },
    "llm": {
        "provider": "ollama",
        "config": {
            "model": "llama3.2",
            "ollama_base_url": OLLAMA_URL,
        }
    }
}

# Try to initialize Mem0, fallback to simple mode if Qdrant not available
try:
    memory = Memory.from_config(config)
    logger.info(f"Mem0 initialized with Qdrant at {QDRANT_URL}")
except Exception as e:
    logger.warning(f"Qdrant not available, using in-memory mode: {e}")
    memory = Memory()

# Create MCP server
server = Server("mcp-memory")

@server.list_tools()
async def list_tools() -> List[Tool]:
    """List available memory tools."""
    return [
        Tool(
            name="memory_add",
            description="Add a memory entry with semantic embedding",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Memory content to store"},
                    "user_id": {"type": "string", "description": "User identifier", "default": "default"},
                    "metadata": {"type": "object", "description": "Optional metadata", "default": {}}
                },
                "required": ["text"]
            }
        ),
        Tool(
            name="memory_search",
            description="Search memories semantically",
            inputSchema={
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "limit": {"type": "integer", "description": "Max results", "default": 5},
                    "user_id": {"type": "string", "description": "User identifier", "default": "default"}
                },
                "required": ["query"]
            }
        ),
        Tool(
            name="memory_get",
            description="Get a specific memory by ID",
            inputSchema={
                "type": "object",
                "properties": {
                    "memory_id": {"type": "string", "description": "Memory ID"}
                },
                "required": ["memory_id"]
            }
        ),
        Tool(
            name="memory_delete",
            description="Delete a memory by ID",
            inputSchema={
                "type": "object",
                "properties": {
                    "memory_id": {"type": "string", "description": "Memory ID to delete"}
                },
                "required": ["memory_id"]
            }
        ),
        Tool(
            name="memory_all",
            description="Get all memories for a user",
            inputSchema={
                "type": "object",
                "properties": {
                    "user_id": {"type": "string", "description": "User identifier", "default": "default"},
                    "limit": {"type": "integer", "description": "Max results", "default": 100}
                }
            }
        ),
        Tool(
            name="health",
            description="Health check for the memory server",
            inputSchema={"type": "object", "properties": {}}
        )
    ]

@server.call_tool()
async def call_tool(name: str, arguments: Any) -> List[TextContent]:
    """Execute memory operations."""
    try:
        if name == "health":
            return [TextContent(
                type="text",
                text=json.dumps({
                    "status": "healthy",
                    "service": "mcp-memory",
                    "collection": COLLECTION_NAME,
                    "qdrant": QDRANT_URL,
                    "timestamp": datetime.utcnow().isoformat()
                }, indent=2)
            )]

        elif name == "memory_add":
            result = memory.add(
                text=arguments["text"],
                user_id=arguments.get("user_id", "default"),
                metadata=arguments.get("metadata", {})
            )
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "memory_search":
            results = memory.search(
                query=arguments["query"],
                limit=arguments.get("limit", 5),
                user_id=arguments.get("user_id", "default")
            )
            return [TextContent(type="text", text=json.dumps(results, indent=2))]

        elif name == "memory_get":
            result = memory.get(memory_id=arguments["memory_id"])
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "memory_delete":
            result = memory.delete(memory_id=arguments["memory_id"])
            return [TextContent(type="text", text=json.dumps(result, indent=2))]

        elif name == "memory_all":
            results = memory.get_all(
                user_id=arguments.get("user_id", "default"),
                limit=arguments.get("limit", 100)
            )
            return [TextContent(type="text", text=json.dumps(results, indent=2))]

        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]

    except Exception as e:
        logger.error(f"Error in {name}: {e}")
        return [TextContent(type="text", text=json.dumps({"error": str(e)}))]

async def main():
    """Run the MCP server."""
    logger.info(f"Starting mcp-memory server on port 4016")
    logger.info(f"Qdrant: {QDRANT_URL}, Collection: {COLLECTION_NAME}")
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())

if __name__ == "__main__":
    import asyncio
    asyncio.run(main())
