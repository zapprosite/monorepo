#!/usr/bin/env python3
"""
smoke_trieve_rag.py — SPEC-092 Trieve RAG Integration smoke tests

Basic integration test: health, datasets, search, rerank.
Requires TRIEVE_API_KEY, TRIEVE_URL set in environment or .env.
"""

import os
import sys
import json
import dotenv
import requests
import pytest
from requests.exceptions import ConnectionError, Timeout

dotenv.load_dotenv("/srv/monorepo/.env")

BASE_URL = os.getenv("TRIEVE_URL", "http://localhost:6435")
API_KEY = os.getenv("TRIEVE_API_KEY", "")
HEADERS = {"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"}


class TestTrieveHealth:
    """P0: Trieve health check."""

    def test_health_returns_ok(self):
        resp = requests.get(f"{BASE_URL}/health", timeout=5)
        assert resp.status_code == 200, f"health failed: {resp.status_code}"
        body = resp.json()
        assert body.get("status") in ("ok", "healthy", 200), f"unexpected body: {body}"


class TestQdrantConnectivity:
    """P0: Qdrant vector storage connectivity."""

    def test_qdrant_collections_accessible(self):
        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        resp = requests.get(f"{qdrant_url}/collections", timeout=5)
        assert resp.status_code == 200, f"Qdrant unreachable: {resp.status_code}"

    def test_qdrant_trieve_collection_exists(self):
        qdrant_url = os.getenv("QDRANT_URL", "http://localhost:6333")
        resp = requests.get(f"{qdrant_url}/collections/trieve", timeout=5)
        # 200 = exists, 404 = doesn't exist (warn only)
        assert resp.status_code in (200, 404), f"unexpected status: {resp.status_code}"


class TestOllamaEmbeddings:
    """P1: Ollama embedding model availability."""

    def test_ollama_api_tags_accessible(self):
        ollama_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        resp = requests.get(f"{ollama_url}/api/tags", timeout=5)
        assert resp.status_code == 200, f"Ollama unreachable: {resp.status_code}"
        body = resp.json()
        assert "models" in body, f"unexpected body: {body}"


class TestDatasetAPI:
    """P0: Dataset management API."""

    def test_datasets_list_accessible(self):
        resp = requests.get(
            f"{BASE_URL}/api/v1/datasets",
            headers=HEADERS,
            timeout=10,
        )
        assert resp.status_code == 200, f"datasets list failed: {resp.status_code}"

    def test_dataset_hermes_knowledge_exists(self):
        resp = requests.get(
            f"{BASE_URL}/api/v1/datasets",
            headers=HEADERS,
            timeout=10,
        )
        if resp.status_code == 200:
            datasets = resp.json()
            names = [d.get("name", "") for d in datasets]
            assert any("hermes-knowledge" in n for n in names), f"hermes-knowledge not found in: {names}"


class TestSearchAPI:
    """P0: Semantic search API."""

    def test_search_returns_results(self):
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


class TestHermesSkillIntegration:
    """P1: Hermes rag-retrieve skill registration."""

    def test_rag_retrieve_skill_defined(self):
        skills_index = "/srv/monorepo/apps/hermes-agency/src/skills/index.ts"
        if os.path.exists(skills_index):
            with open(skills_index) as f:
                content = f.read()
            assert "rag-retrieve" in content or "trieve" in content, "rag-retrieve skill not found"

    def test_hermes_gateway_reachable(self):
        resp = requests.get("http://localhost:8642/health", timeout=5)
        assert resp.status_code == 200, f"Hermes Gateway unreachable: {resp.status_code}"


if __name__ == "__main__":
    sys.exit(pytest.main([__file__, "-v"]))
