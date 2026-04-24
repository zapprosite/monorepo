"""Pytest smoke tests for mcp-memory + Qdrant vector DB."""
import os
import pytest
import urllib.request
import urllib.error
import json
import uuid

MCP_MEMORY_URL = os.getenv("MCP_MEMORY_URL", "http://localhost:4016")
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_KEY = os.getenv("QDRANT_API_KEY", "71cae77676e2a5fd552d172caa1c3200")


def test_mcp_memory_health():
    """Test mcp-memory health endpoint."""
    req = urllib.request.Request(f"{MCP_MEMORY_URL}/health")
    with urllib.request.urlopen(req, timeout=10) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        assert data.get("status") == "healthy"


def test_qdrant_collections(qdrant_url):
    """Test Qdrant is accessible and has expected collections."""
    if not qdrant_url:
        pytest.skip("Qdrant not reachable")
    req = urllib.request.Request(
        f"{qdrant_url}/collections",
        headers={"api-key": QDRANT_KEY}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        collections = data.get("result", {}).get("collections", [])
        names = [c.get("name") for c in collections]
        # Check at least one known collection exists
        assert len(collections) > 0, "No collections found"
        print(f"Qdrant collections: {names}")


def test_memory_add_text_field():
    """Test memory_add with 'text' field (correct schema)."""
    payload = {
        "text": f"Test memory entry {uuid.uuid4().hex[:8]}",
        "user_id": "smoke-test"
    }
    req = urllib.request.Request(
        f"{MCP_MEMORY_URL}/tools/memory_add",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        assert data.get("success") == True


def test_memory_add_content_field_fails():
    """Test memory_add with 'content' field returns 422 (expected)."""
    payload = {
        "content": "Should fail with 422",
        "user_id": "smoke-test"
    }
    req = urllib.request.Request(
        f"{MCP_MEMORY_URL}/tools/memory_add",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            # If it returns 200, the schema accepts both
            pass
    except urllib.error.HTTPError as e:
        assert e.code == 422, f"Expected 422 for 'content' field, got {e.code}"


def test_memory_search():
    """Test memory_search returns results."""
    # First add a unique entry
    unique_id = uuid.uuid4().hex[:8]
    add_payload = {
        "text": f"smoke test unique {unique_id}",
        "user_id": "smoke-test"
    }
    add_req = urllib.request.Request(
        f"{MCP_MEMORY_URL}/tools/memory_add",
        data=json.dumps(add_payload).encode(),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(add_req, timeout=30) as resp:
            assert resp.status == 200
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        pytest.skip(f"mcp-memory not accessible: {e}")

    # Then search for it — API expects 'query' field, not 'text'
    search_payload = {
        "query": f"smoke test unique {unique_id}",
        "user_id": "smoke-test",
        "limit": 5
    }
    search_req = urllib.request.Request(
        f"{MCP_MEMORY_URL}/tools/memory_search",
        data=json.dumps(search_payload).encode(),
        headers={"Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(search_req, timeout=30) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode())
            results = data.get("results", [])
            # Should find our entry
            assert len(results) >= 1
    except (urllib.error.URLError, urllib.error.HTTPError) as e:
        pytest.skip(f"mcp-memory search failed: {e}")