"""
test_context.py
Phase 2 — Tests for apps.api.context
"""
import os
import sys
from pathlib import Path

# Ensure repo root is on path for libs.* imports
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from fastapi.testclient import TestClient
from apps.api.context import app

client = TestClient(app)


def test_root_health():
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert resp.json()["service"] == "hce-api"


def test_context_health():
    resp = client.get("/context/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    assert resp.json()["service"] == "context"


def test_post_context_shape():
    payload = {
        "session_id": "sess-123",
        "query": "What is HVAC?",
        "sources": ["src-a", "src-b"],
        "max_tokens": 512,
    }
    resp = client.post("/context", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["session_id"] == "sess-123"
    assert "chunks" in data
    assert isinstance(data["chunks"], list)
    assert "total_tokens" in data


def test_post_context_with_session_memory():
    # Save something to memory first
    from libs.memory import manager
    manager.save_session("sess-mem", "previous context about compressors")

    payload = {
        "session_id": "sess-mem",
        "query": "tell me more",
        "sources": [],
        "max_tokens": 1024,
    }
    resp = client.post("/context", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    # Should contain both query and memory chunks
    texts = [c["text"] for c in data["chunks"]]
    assert "tell me more" in texts
    assert "previous context about compressors" in texts
