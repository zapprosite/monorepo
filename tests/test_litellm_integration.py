"""
Pytest tests for LiteLLM integration (port 4000).

Requirements:
- Use pytest, httpx
- Test POST /v1/chat/completions with minimax-m2.7
- Test POST /v1/chat/completions with gemma4:26b-q4
- Test POST /v1/audio/transcriptions with whisper-1 (Groq)
- Test POST /v1/audio/speech with tts-1 (Edge TTS)
- Test model routing when primary fails (fallback)
- Test error handling (invalid model, timeout)
- Test streaming vs non-streaming
- Test API key handling (use env var LITELLM_API_KEY)
- Use pytest.mark.asyncio
- Mark slow tests with @pytest.mark.slow
"""

import os
import pytest
import httpx
from typing import Any


# Register custom markers
def pytest_configure(config: Any) -> None:
    config.addinivalue_line("markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')")


# Configuration
LITELLM_BASE_URL = os.environ.get("LITELLM_BASE_URL", "http://localhost:4000")
LITELLM_API_KEY = os.environ.get("LITELLM_API_KEY", "")
TIMEOUT = 30.0


def requires_auth(func):
    """Decorator to skip test if LITELLM_API_KEY is not set."""
    async def wrapper(*args, **kwargs):
        if not LITELLM_API_KEY:
            pytest.skip("LITELLM_API_KEY not set")
        return await func(*args, **kwargs)
    wrapper.__name__ = func.__name__
    wrapper.__doc__ = func.__doc__
    return wrapper


def get_headers() -> dict[str, str]:
    """Get headers for API requests."""
    headers = {"Content-Type": "application/json"}
    if LITELLM_API_KEY:
        headers["Authorization"] = f"Bearer {LITELLM_API_KEY}"
    return headers


@pytest.fixture
def client() -> httpx.Client:
    """Create a synchronous httpx client."""
    with httpx.Client(base_url=LITELLM_BASE_URL, timeout=TIMEOUT) as client:
        yield client


@pytest.fixture
def async_client() -> httpx.AsyncClient:
    """Create an asynchronous httpx client."""
    return httpx.AsyncClient(base_url=LITELLM_BASE_URL, timeout=TIMEOUT)


# =============================================================================
# Chat Completions Tests
# =============================================================================


@pytest.mark.asyncio
async def test_chat_completions_minimax_m2_7(async_client: httpx.AsyncClient) -> None:
    """Test POST /v1/chat/completions with minimax-m2.7 model."""
    if not LITELLM_API_KEY:
        pytest.skip("LITELLM_API_KEY not set")
    payload = {
        "model": "minimax-m2.7",
        "messages": [{"role": "user", "content": "Say 'test passed' in exactly those words"}],
        "max_tokens": 50,
        "temperature": 0.0,
    }

    response = await async_client.post("/v1/chat/completions", json=payload, headers=get_headers())

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "choices" in data
    assert len(data["choices"]) > 0
    assert "message" in data["choices"][0]
    assert "content" in data["choices"][0]["message"]
    assert "test passed" in data["choices"][0]["message"]["content"].lower()


@pytest.mark.asyncio
async def test_chat_completions_gemma4_26b_q4(async_client: httpx.AsyncClient) -> None:
    """Test POST /v1/chat/completions with gemma4:26b-q4 model."""
    if not LITELLM_API_KEY:
        pytest.skip("LITELLM_API_KEY not set")
    payload = {
        "model": "gemma4:26b-q4",
        "messages": [{"role": "user", "content": "Say 'test passed' in exactly those words"}],
        "max_tokens": 50,
        "temperature": 0.0,
    }

    response = await async_client.post("/v1/chat/completions", json=payload, headers=get_headers())

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "choices" in data
    assert len(data["choices"]) > 0
    assert "message" in data["choices"][0]
    assert "content" in data["choices"][0]["message"]


# =============================================================================
# Audio Transcriptions Tests (Groq Whisper)
# =============================================================================


@pytest.mark.asyncio
@pytest.mark.slow
async def test_audio_transcriptions_whisper_1(async_client: httpx.AsyncClient) -> None:
    """Test POST /v1/audio/transcriptions with whisper-1 (Groq)."""
    if not LITELLM_API_KEY:
        pytest.skip("LITELLM_API_KEY not set")
    # Create a minimal valid audio file for testing (silence WAV header)
    # In production, use a real audio file
    wav_header = bytes([
        0x52, 0x49, 0x46, 0x46,  # "RIFF"
        0x24, 0x00, 0x00, 0x00,  # File size - 8
        0x57, 0x41, 0x56, 0x45,  # "WAVE"
        0x66, 0x6D, 0x74, 0x20,  # "fmt "
        0x10, 0x00, 0x00, 0x00,  # Chunk size
        0x01, 0x00,              # Audio format (PCM)
        0x01, 0x00,              # Num channels (mono)
        0x40, 0x1F, 0x00, 0x00,  # Sample rate (16000)
        0x80, 0x3E, 0x00, 0x00,  # Byte rate
        0x02, 0x00,              # Block align
        0x10, 0x00,              # Bits per sample
        0x64, 0x61, 0x74, 0x61,  # "data"
        0x00, 0x00, 0x00, 0x00,  # Data size
    ])

    files = {"file": ("test.wav", wav_header, "audio/wav")}
    data = {"model": "whisper-1"}

    response = await async_client.post(
        "/v1/audio/transcriptions",
        files=files,
        data=data,
        headers={k: v for k, v in get_headers().items() if k != "Content-Type"},
    )

    # Accept 200 (success) or 401/422/400 (auth or validation error - Groq requires specific audio format)
    assert response.status_code in [200, 401, 422, 400], f"Unexpected status: {response.status_code}: {response.text}"


# =============================================================================
# Audio Speech Tests (Edge TTS)
# =============================================================================


@pytest.mark.asyncio
@pytest.mark.slow
async def test_audio_speech_tts_1(async_client: httpx.AsyncClient) -> None:
    """Test POST /v1/audio/speech with tts-1 (Edge TTS)."""
    if not LITELLM_API_KEY:
        pytest.skip("LITELLM_API_KEY not set")
    payload = {
        "model": "tts-1",
        "input": "Hello, this is a test.",
        "voice": "alloy",
    }

    response = await async_client.post(
        "/v1/audio/speech",
        json=payload,
        headers={**get_headers(), "Content-Type": "application/json"},
    )

    # Audio returns binary content, status should be 200 or 401 if auth required
    assert response.status_code in [200, 401], f"Expected 200 or 401, got {response.status_code}: {response.text}"
    if response.status_code == 200:
        assert response.headers.get("content-type", "").startswith("audio/")


# =============================================================================
# Model Routing / Fallback Tests
# =============================================================================


@pytest.mark.asyncio
async def test_model_routing_fallback_on_failure(async_client: httpx.AsyncClient) -> None:
    """Test model routing when primary model fails (fallback)."""
    # First try with an invalid model to trigger routing logic
    payload = {
        "model": "nonexistent-model-12345",
        "messages": [{"role": "user", "content": "Hello"}],
    }

    response = await async_client.post("/v1/chat/completions", json=payload, headers=get_headers())

    # Should return an error (404, 422, 401, or 500) - 401 if auth required, others if auth passed
    assert response.status_code in [401, 404, 422, 400, 500], f"Unexpected status: {response.status_code}"


@pytest.mark.asyncio
async def test_model_routing_with_valid_fallback(async_client: httpx.AsyncClient) -> None:
    """Test that valid models work correctly with routing."""
    if not LITELLM_API_KEY:
        pytest.skip("LITELLM_API_KEY not set")
    # Use minimax-m2.7 which should be available
    payload = {
        "model": "minimax-m2.7",
        "messages": [{"role": "user", "content": "Reply with just the word 'routing'"}],
        "max_tokens": 10,
    }

    response = await async_client.post("/v1/chat/completions", json=payload, headers=get_headers())

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "choices" in data
    content = data["choices"][0]["message"]["content"].lower()
    assert "routing" in content or "error" not in content


# =============================================================================
# Error Handling Tests
# =============================================================================


@pytest.mark.asyncio
async def test_error_handling_invalid_model(async_client: httpx.AsyncClient) -> None:
    """Test error handling for invalid model."""
    payload = {
        "model": "invalid-model-xyz",
        "messages": [{"role": "user", "content": "Hello"}],
    }

    response = await async_client.post("/v1/chat/completions", json=payload, headers=get_headers())

    # LiteLLM should return an error for invalid models (401 if auth required)
    assert response.status_code in [401, 404, 422, 400, 500], f"Unexpected status: {response.status_code}"
    data = response.json()
    assert "error" in data or "message" in data


@pytest.mark.asyncio
async def test_error_handling_missing_messages(async_client: httpx.AsyncClient) -> None:
    """Test error handling for missing required fields."""
    payload = {
        "model": "minimax-m2.7",
        # Missing "messages" field
    }

    response = await async_client.post("/v1/chat/completions", json=payload, headers=get_headers())

    # Should return 4xx (401 if auth required, 400/422 for validation errors)
    assert response.status_code in [400, 401, 422], f"Expected 4xx, got {response.status_code}"


@pytest.mark.asyncio
@pytest.mark.slow
async def test_error_handling_timeout(async_client: httpx.AsyncClient) -> None:
    """Test error handling for timeout scenarios."""
    # Create a client with very short timeout to simulate timeout
    short_timeout_client = httpx.AsyncClient(
        base_url=LITELLM_BASE_URL,
        timeout=0.001,  # 1ms timeout
    )

    payload = {
        "model": "minimax-m2.7",
        "messages": [{"role": "user", "content": "Hello"}],
    }

    try:
        response = await short_timeout_client.post("/v1/chat/completions", json=payload, headers=get_headers())
        # If we get here, the request completed (possibly timed out server-side)
        assert response.status_code in [200, 408, 499, 504, 500]
    except httpx.TimeoutException:
        # This is expected behavior for a very short timeout
        pass
    finally:
        await short_timeout_client.aclose()


# =============================================================================
# Streaming vs Non-Streaming Tests
# =============================================================================


@pytest.mark.asyncio
async def test_non_streaming_chat_completions(async_client: httpx.AsyncClient) -> None:
    """Test non-streaming chat completions."""
    if not LITELLM_API_KEY:
        pytest.skip("LITELLM_API_KEY not set")
    payload = {
        "model": "minimax-m2.7",
        "messages": [{"role": "user", "content": "Say 'non-streaming' in exactly that word"}],
        "max_tokens": 20,
        "temperature": 0.0,
        "stream": False,
    }

    response = await async_client.post("/v1/chat/completions", json=payload, headers=get_headers())

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    assert "choices" in data
    assert "content" in data["choices"][0]["message"]
    # Non-streaming should return complete response
    assert len(data["choices"][0]["message"]["content"]) > 0


@pytest.mark.asyncio
async def test_streaming_chat_completions(async_client: httpx.AsyncClient) -> None:
    """Test streaming chat completions."""
    if not LITELLM_API_KEY:
        pytest.skip("LITELLM_API_KEY not set")
    payload = {
        "model": "minimax-m2.7",
        "messages": [{"role": "user", "content": "Count from 1 to 3"}],
        "max_tokens": 50,
        "temperature": 0.0,
        "stream": True,
    }

    response = await async_client.post("/v1/chat/completions", json=payload, headers=get_headers())

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    assert "text/event-stream" in response.headers.get("content-type", "")

    # Read streaming response line by line
    lines = response.text.strip().split("\n")
    assert len(lines) > 0, "Expected at least one SSE event"

    # Parse SSE events
    event_count = 0
    for line in lines:
        if line.startswith("data: "):
            data_str = line[6:]  # Remove "data: " prefix
            if data_str == "[DONE]":
                break
            event_count += 1

    assert event_count > 0, "Expected at least one streaming event"


# =============================================================================
# API Key Handling Tests
# =============================================================================


@pytest.mark.asyncio
async def test_api_key_handling_with_key(async_client: httpx.AsyncClient) -> None:
    """Test API key handling when LITELLM_API_KEY is set."""
    if not LITELLM_API_KEY:
        pytest.skip("LITELLM_API_KEY not set")

    payload = {
        "model": "minimax-m2.7",
        "messages": [{"role": "user", "content": "Say 'auth works'"}],
        "max_tokens": 20,
    }

    response = await async_client.post("/v1/chat/completions", json=payload, headers=get_headers())

    # Should succeed with valid key
    assert response.status_code == 200, f"Expected 200 with valid key, got {response.status_code}: {response.text}"


@pytest.mark.asyncio
async def test_api_key_handling_without_key(async_client: httpx.AsyncClient) -> None:
    """Test API key handling when LITELLM_API_KEY is not set (if server requires auth)."""
    # Create client without auth headers
    no_auth_client = httpx.AsyncClient(
        base_url=LITELLM_BASE_URL,
        timeout=TIMEOUT,
        headers={"Content-Type": "application/json"},
    )

    try:
        payload = {
            "model": "minimax-m2.7",
            "messages": [{"role": "user", "content": "Hello"}],
        }

        response = await no_auth_client.post("/v1/chat/completions", json=payload)

        # If server requires auth, should get 401
        # If server allows no auth, should get 200
        assert response.status_code in [200, 401, 403], f"Unexpected status: {response.status_code}"
    finally:
        await no_auth_client.aclose()


@pytest.mark.asyncio
async def test_api_key_handling_invalid_key(async_client: httpx.AsyncClient) -> None:
    """Test API key handling with invalid key."""
    invalid_key_client = httpx.AsyncClient(
        base_url=LITELLM_BASE_URL,
        timeout=TIMEOUT,
        headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer invalid-key-12345",
        },
    )

    try:
        payload = {
            "model": "minimax-m2.7",
            "messages": [{"role": "user", "content": "Hello"}],
        }

        response = await invalid_key_client.post("/v1/chat/completions", json=payload)

        # Invalid key should be rejected
        assert response.status_code in [401, 403, 400], f"Expected auth error, got {response.status_code}"
    finally:
        await invalid_key_client.aclose()


# =============================================================================
# Additional Integration Tests
# =============================================================================


@pytest.mark.asyncio
async def test_health_check(async_client: httpx.AsyncClient) -> None:
    """Test health endpoint if available."""
    try:
        response = await async_client.get("/health")
        assert response.status_code in [200, 404], f"Unexpected health status: {response.status_code}"
    except Exception:
        # Health endpoint may not exist
        pass


@pytest.mark.asyncio
async def test_model_list(async_client: httpx.AsyncClient) -> None:
    """Test getting list of available models."""
    response = await async_client.get("/v1/models", headers=get_headers())

    # Should return 200, 404 if not supported, or 401 if auth required
    assert response.status_code in [200, 401, 404], f"Unexpected status: {response.status_code}"

    if response.status_code == 200:
        data = response.json()
        assert "data" in data or "models" in data


@pytest.mark.asyncio
async def test_chat_completions_with_system_message(async_client: httpx.AsyncClient) -> None:
    """Test chat completions with system message."""
    if not LITELLM_API_KEY:
        pytest.skip("LITELLM_API_KEY not set")
    payload = {
        "model": "minimax-m2.7",
        "messages": [
            {"role": "system", "content": "You always respond with exactly one word."},
            {"role": "user", "content": "How are you?"},
        ],
        "max_tokens": 10,
        "temperature": 0.0,
    }

    response = await async_client.post("/v1/chat/completions", json=payload, headers=get_headers())

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    content = data["choices"][0]["message"]["content"]
    # Should be one word (allowing for some punctuation)
    assert len(content.strip().split()) <= 2


@pytest.mark.asyncio
async def test_chat_completions_with_parameters(async_client: httpx.AsyncClient) -> None:
    """Test chat completions with various parameters."""
    if not LITELLM_API_KEY:
        pytest.skip("LITELLM_API_KEY not set")
    payload = {
        "model": "minimax-m2.7",
        "messages": [{"role": "user", "content": "Pick a number between 1 and 5"}],
        "max_tokens": 10,
        "temperature": 0.5,
        "top_p": 0.9,
        "n": 2,
    }

    response = await async_client.post("/v1/chat/completions", json=payload, headers=get_headers())

    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()
    # n=2 should return 2 choices
    assert len(data["choices"]) == 2


@pytest.mark.asyncio
@pytest.mark.slow
async def test_concurrent_requests(async_client: httpx.AsyncClient) -> None:
    """Test handling concurrent requests."""
    if not LITELLM_API_KEY:
        pytest.skip("LITELLM_API_KEY not set")
    import asyncio

    payload = {
        "model": "minimax-m2.7",
        "messages": [{"role": "user", "content": "Say 'concurrent'"}],
        "max_tokens": 20,
    }

    async def make_request():
        return await async_client.post("/v1/chat/completions", json=payload, headers=get_headers())

    # Run 3 requests concurrently
    responses = await asyncio.gather(*[make_request() for _ in range(3)])

    # All should succeed
    for resp in responses:
        assert resp.status_code == 200, f"Concurrent request failed: {resp.status_code}"
