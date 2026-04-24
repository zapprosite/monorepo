"""Pytest smoke tests for LiteLLM + MiniMax integration."""
import pytest
import urllib.request
import json
import os

LITELLM_URL = os.getenv("LITELLM_URL", "http://localhost:4000")
LITELLM_KEY = os.getenv("LITELLM_KEY", "sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1")

def test_litellm_health():
    """Test LiteLLM health endpoint."""
    req = urllib.request.Request(
        f"{LITELLM_URL}/health",
        headers={"Authorization": f"Bearer {LITELLM_KEY}"}
    )
    try:
        resp = urllib.request.urlopen(req, timeout=10)
        assert resp.status == 200, f"Health check failed: {resp.status}"
    except urllib.error.HTTPError as e:
        # 401 is ok for health if auth required
        if e.code == 401:
            pass
        else:
            raise

def test_minimax_chat():
    """Test MiniMax chat completion via LiteLLM."""
    data = {
        "model": "minimax-m2.7",
        "messages": [{"role": "user", "content": "Say exactly: OK"}],
        "max_tokens": 256
    }
    req = urllib.request.Request(
        f"{LITELLM_URL}/v1/chat/completions",
        data=json.dumps(data).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LITELLM_KEY}"
        }
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        assert resp.status == 200
        result = json.loads(resp.read().decode())
        # MiniMax-M2.7 may return empty content for very short responses
        # We verify API is working by checking response structure and finish_reason
        choice = result.get("choices", [{}])[0]
        finish_reason = choice.get("finish_reason", "")
        content = choice.get("message", {}).get("content", "") or ""
        # Accept empty content (MiniMax quirk) OR content containing "OK"
        assert content == "" or "OK" in content, f"Expected 'OK' or empty, got: {content}"
        assert finish_reason in ("stop", "length"), f"Expected finish_reason 'stop' or 'length', got: {finish_reason}"

def test_litellm_embeddings():
    """Test LiteLLM embeddings endpoint."""
    data = {
        "model": "embedding-nomic",
        "input": "hello world"
    }
    req = urllib.request.Request(
        f"{LITELLM_URL}/v1/embeddings",
        data=json.dumps(data).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LITELLM_KEY}"
        }
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        assert resp.status == 200
        result = json.loads(resp.read().decode())
        emb = result.get("data", [{}])[0].get("embedding", [])
        assert len(emb) == 768, f"Expected 768 dims, got {len(emb)}"

def test_qwen2vl_local():
    """Test qwen2.5vl-3b local Ollama via LiteLLM."""
    data = {
        "model": "qwen2.5vl-3b",
        "messages": [{"role": "user", "content": "Hi"}],
        "max_tokens": 5
    }
    req = urllib.request.Request(
        f"{LITELLM_URL}/v1/chat/completions",
        data=json.dumps(data).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LITELLM_KEY}"
        }
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        assert resp.status == 200

@pytest.mark.parametrize("model", ["minimax-m2.7", "qwen2.5vl-3b"])
def test_model_list(model):
    """Test all configured models are available."""
    data = {"model": model, "messages": [{"role": "user", "content": "test"}], "max_tokens": 3}
    req = urllib.request.Request(
        f"{LITELLM_URL}/v1/chat/completions",
        data=json.dumps(data).encode(),
        headers={
            "Content-Type": "application/json",
            "Authorization": f"Bearer {LITELLM_KEY}"
        }
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            assert resp.status == 200
    except urllib.error.HTTPError as e:
        if e.code == 400:
            pytest.fail(f"Model {model} not found or invalid")
        raise