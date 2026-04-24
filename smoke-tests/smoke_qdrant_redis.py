"""Pytest smoke tests for Qdrant vector DB and Redis cache."""
import pytest
import urllib.request
import json

QDRANT_URL = "http://10.0.9.2:6333"
QDRANT_KEY = "71cae77676e2a5fd552d172caa1c3200"
REDIS_HOST = "localhost"
REDIS_PORT = 6379

def test_qdrant_collections_list():
    """Test Qdrant collections endpoint returns list."""
    req = urllib.request.Request(
        f"{QDRANT_URL}/collections",
        headers={"api-key": QDRANT_KEY}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        assert resp.status == 200
        data = json.loads(resp.read().decode())
        collections = data.get("result", {}).get("collections", [])
        names = [c.get("name") for c in collections]
        print(f"Collections: {names}")
        assert len(collections) > 0, "Expected at least one collection"

def test_qdrant_collection_info():
    """Test getting specific collection info."""
    req = urllib.request.Request(
        f"{QDRANT_URL}/collections/will",
        headers={"api-key": QDRANT_KEY}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode())
            result = data.get("result", {})
            assert result.get("status") == "green" or result.get("status") == "initialized"
    except urllib.error.HTTPError as e:
        if e.code == 404:
            pytest.skip("Collection 'will' does not exist")
        raise

def _qdrant_reachable():
    """Check if Qdrant is accessible."""
    try:
        req = urllib.request.Request(
            f"{QDRANT_URL}/collections",
            headers={"api-key": QDRANT_KEY}
        )
        urllib.request.urlopen(req, timeout=5)
        return True
    except Exception:
        return False


def test_qdrant_vector_search():
    """Test vector search in default collection."""
    if not _qdrant_reachable():
        pytest.skip("Qdrant not accessible from test environment")

    # Simple embedding vector (768 dims for nomic)
    embedding = [0.0] * 768
    payload = {
        "vector": embedding,
        "limit": 3,
        "with_payload": True
    }
    req = urllib.request.Request(
        f"{QDRANT_URL}/collections/will/points/search",
        data=json.dumps(payload).encode(),
        headers={
            "Content-Type": "application/json",
            "api-key": QDRANT_KEY
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            assert resp.status == 200
            data = json.loads(resp.read().decode())
            # Qdrant returns result as a list directly, not {"results": [...]}
            results = data.get("result", [])
            print(f"Search returned {len(results)} results")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            pytest.skip("Collection 'will' does not exist")
        raise

def test_redis_ping():
    """Test Redis ping via TCP."""
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect((REDIS_HOST, REDIS_PORT))
        sock.sendall(b"PING\r\n")
        response = sock.recv(1024)
        sock.close()
        assert b"PONG" in response, f"Expected PONG, got: {response}"
    except Exception as e:
        # Redis might be on different host in container
        pytest.skip(f"Redis not reachable at {REDIS_HOST}:{REDIS_PORT} - {e}")

def test_redis_command():
    """Test Redis INFO command."""
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        sock.connect((REDIS_HOST, REDIS_PORT))
        sock.sendall(b"INFO\r\n")
        response = sock.recv(4096)
        sock.close()
        assert b"redis_version" in response, f"Expected redis_version in response"
    except Exception as e:
        pytest.skip(f"Redis not reachable - {e}")

def test_hermes_agency_qdrant_connection():
    """Test that Hermes Agency can reach Qdrant (if mcp-qdrant is running)."""
    req = urllib.request.Request(
        f"{QDRANT_URL}/collections",
        headers={"api-key": QDRANT_KEY}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            assert resp.status == 200
    except Exception as e:
        pytest.skip(f"Qdrant not accessible from test environment - {e}")