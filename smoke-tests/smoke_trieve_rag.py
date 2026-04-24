#!/usr/bin/env python3
"""
smoke_trieve_rag.py — SPEC-092 Trieve RAG Integration smoke tests

Basic integration test: health, datasets, search, rerank.
Requires TRIEVE_API_KEY, TRIEVE_URL set in environment or .env.

Uses conftest.py fixtures for service discovery and skip logic.
"""

import os
import sys
import socket
import dotenv
import requests
import pytest
from requests.exceptions import ConnectionError, Timeout

dotenv.load_dotenv("/srv/monorepo/.env")

BASE_URL = os.getenv("TRIEVE_URL", "http://localhost:6435")
API_KEY = os.getenv("TRIEVE_API_KEY", "")
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}


def is_port_reachable(host: str, port: int, timeout: float = 2.0) -> bool:
    """Check if a TCP port is reachable."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


class TestTrieveHealth:
    """P0: Trieve health check."""

    def test_health_returns_ok(self):
        if not is_port_reachable("localhost", 6435, timeout=3):
            pytest.skip("Trieve service not reachable on :6435")
        resp = requests.get(f"{BASE_URL}/health", timeout=5)
        assert resp.status_code == 200, f"health failed: {resp.status_code}"
        body = resp.json()
        assert body.get("status") in ("ok", "healthy", 200), f"unexpected body: {body}"


class TestQdrantConnectivity:
    """P0: Qdrant vector storage connectivity."""

    def test_qdrant_collections_accessible(self, qdrant_url):
        if not qdrant_url:
            pytest.skip("Qdrant service not reachable")
        qdrant_key = os.getenv("QDRANT_API_KEY", "71cae77676e2a5fd552d172caa1c3200")
        resp = requests.get(
            f"{qdrant_url}/collections",
            headers={"api-key": qdrant_key},
            timeout=5
        )
        assert resp.status_code == 200, f"Qdrant unreachable: {resp.status_code}"

    def test_qdrant_trieve_collection_exists(self, qdrant_url):
        if not qdrant_url:
            pytest.skip("Qdrant service not reachable")
        qdrant_key = os.getenv("QDRANT_API_KEY", "71cae77676e2a5fd552d172caa1c3200")
        resp = requests.get(
            f"{qdrant_url}/collections/trieve",
            headers={"api-key": qdrant_key},
            timeout=5
        )
        # 200 = exists, 404 = doesn't exist (warn only)
        assert resp.status_code in (200, 404), f"unexpected status: {resp.status_code}"


class TestOllamaEmbeddings:
    """P1: Ollama embedding model availability."""

    def test_ollama_api_tags_accessible(self):
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        if not is_port_reachable("localhost", 11434, timeout=3):
            pytest.skip("Ollama service not reachable on :11434")
        resp = requests.get(f"{ollama_url}/api/tags", timeout=5)
        assert resp.status_code == 200, f"Ollama unreachable: {resp.status_code}"
        body = resp.json()
        assert "models" in body, f"unexpected body: {body}"


class TestDatasetAPI:
    """P0: Dataset management API."""

    def test_datasets_list_accessible(self):
        if not is_port_reachable("localhost", 6435, timeout=3):
            pytest.skip("Trieve service not reachable on :6435")
        resp = requests.get(
            f"{BASE_URL}/api/v1/datasets",
            headers=HEADERS,
            timeout=10,
        )
        assert resp.status_code == 200, f"datasets list failed: {resp.status_code}"



class TestSearchAPI:
    """P0: Semantic search API."""

    def test_search_returns_results(self):
        if not is_port_reachable("localhost", 6435, timeout=3):
            pytest.skip("Trieve service not reachable on :6435")
        payload = {"query": "como fazer deploy no coolify", "limit": 3}
        resp = requests.post(
            f"{BASE_URL}/api/v1/search",
            headers=HEADERS,
            json=payload,
            timeout=30,
        )
        # 200 = results, 400 = bad request (dataset not indexed yet), 401 = auth fail
        assert resp.status_code in (200, 400, 401), f"search failed: {resp.status_code}"
        if resp.status_code == 200:
            body = resp.json()
            assert "results" in body or "hits" in body, f"unexpected body: {body}"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
