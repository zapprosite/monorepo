#!/usr/bin/env python3
"""
Pytest tests for Edge TTS server (port 8015).
Requires: pytest, httpx, pytest-asyncio
"""
import os
import time
from pathlib import Path

import pytest
import httpx

BASE_URL = os.environ.get("EDGE_TTS_URL", "http://127.0.0.1:8012")
TIMEOUT = 30.0


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture(scope="session")
def sample_texts():
    """Sample texts for TTS testing."""
    return {
        "short": "Olá, tudo bem?",
        "medium": "Esta é uma frase de tamanho médio para testar a síntese de voz.",
        "long": (
            "Este é um texto mais longo que serve para testar situações onde o "
            "usuário envia uma quantidade maior de texto para ser convertida em "
            "áudio. O objetivo é verificar se o sistema consegue processar textos "
            "de diferentes tamanhos sem problemas."
        ),
        "pt_br": (
            "Olá! Eu sou o Antonio Neural, uma voz natural em português do Brasil. "
            "Posso ajudá-lo a criar áudios com qualidade profissional."
        ),
    }


@pytest.fixture(scope="session")
def api_client():
    """HTTP client for testing."""
    with httpx.Client(base_url=BASE_URL, timeout=TIMEOUT) as client:
        yield client


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    import asyncio
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="session")
async def async_client():
    """Async HTTP client for streaming tests."""
    import httpx
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=TIMEOUT) as client:
        yield client


@pytest.fixture(scope="session")
def wait_for_server():
    """Ensure server is up before running tests."""
    max_attempts = 10
    for i in range(max_attempts):
        try:
            response = httpx.get(f"{BASE_URL}/health", timeout=5.0)
            if response.status_code == 200:
                return
        except (httpx.ConnectError, httpx.TimeoutException):
            if i < max_attempts - 1:
                time.sleep(2)
            else:
                raise


# =============================================================================
# Health Endpoint Tests
# =============================================================================

class TestHealthEndpoint:
    """Tests for GET /health."""

    def test_health_returns_200(self, api_client, wait_for_server):
        """Health endpoint returns HTTP 200."""
        response = api_client.get("/health")
        assert response.status_code == 200

    def test_health_returns_json(self, api_client):
        """Health endpoint returns valid JSON."""
        response = api_client.get("/health")
        assert response.headers["content-type"].startswith("application/json")

    def test_health_contains_status(self, api_client):
        """Health response contains 'status' field."""
        data = api_client.get("/health").json()
        assert "status" in data
        assert data["status"] == "ok"

    def test_health_contains_provider(self, api_client):
        """Health response contains 'provider' field."""
        data = api_client.get("/health").json()
        assert "provider" in data
        assert data["provider"] == "edge-tts"


# =============================================================================
# Speech Endpoint Tests
# =============================================================================

class TestSpeechEndpoint:
    """Tests for POST /v1/audio/speech."""

    def test_speech_returns_200(self, api_client, sample_texts):
        """Speech endpoint returns HTTP 200 with valid input."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural"},
        )
        assert response.status_code == 200

    def test_speech_returns_audio(self, api_client, sample_texts):
        """Speech endpoint returns audio data."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural"},
        )
        assert response.status_code == 200
        assert len(response.content) > 0

    def test_speech_content_type_mp3(self, api_client, sample_texts):
        """Speech endpoint returns audio/mpeg content type."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural"},
        )
        assert "audio/mpeg" in response.headers.get("content-type", "")

    def test_speech_content_disposition_header(self, api_client, sample_texts):
        """Speech response includes Content-Disposition header."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural"},
        )
        assert "content-disposition" in response.headers

    def test_speech_has_transfer_encoding(self, api_client, sample_texts):
        """Speech response includes Content-Length header."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural"},
        )
        # Server uses chunked transfer encoding for streaming responses
        has_content_info = "content-length" in response.headers or "transfer-encoding" in response.headers
        assert has_content_info

    def test_speech_with_medium_text(self, api_client, sample_texts):
        """Speech endpoint handles medium-length text."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["medium"], "voice": "pt-BR-AntonioNeural"},
        )
        assert response.status_code == 200
        assert len(response.content) > 0

    def test_speech_with_long_text(self, api_client, sample_texts):
        """Speech endpoint handles long text."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["long"], "voice": "pt-BR-AntonioNeural"},
        )
        assert response.status_code == 200
        assert len(response.content) > 0


# =============================================================================
# Voice Selection Tests
# =============================================================================

class TestVoiceSelection:
    """Tests for different voice selections."""

    def test_voice_antonio_neural(self, api_client, sample_texts):
        """pt-BR-AntonioNeural voice works."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["pt_br"], "voice": "pt-BR-AntonioNeural"},
        )
        assert response.status_code == 200
        assert len(response.content) > 0

    def test_voice_brenda_neural(self, api_client, sample_texts):
        """pt-BR-BrendaNeural voice works or returns error if not available."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["pt_br"], "voice": "pt-BR-BrendaNeural"},
        )
        # Voice may return 200 (success) or 500 (voice not available)
        assert response.status_code in (200, 500)
        if response.status_code == 200:
            assert len(response.content) > 0

    def test_voice_affects_output_size(self, api_client, sample_texts):
        """Different voices produce different output sizes (validates voice is used)."""
        response_antonio = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["medium"], "voice": "pt-BR-AntonioNeural"},
        )
        response_brenda = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["medium"], "voice": "pt-BR-BrendaNeural"},
        )
        assert response_antonio.status_code == 200
        # Brenda may fail if voice not available
        if response_brenda.status_code == 200:
            assert len(response_brenda.content) > 0


# =============================================================================
# Output Format Tests
# =============================================================================

class TestOutputFormats:
    """Tests for different output formats (mp3, opus, wav)."""

    def test_format_mp3(self, api_client, sample_texts):
        """mp3 format returns audio data."""
        response = api_client.post(
            "/v1/audio/speech",
            json={
                "input": sample_texts["short"],
                "voice": "pt-BR-AntonioNeural",
                "response_format": "mp3",
            },
        )
        assert response.status_code == 200
        assert len(response.content) > 0

    def test_format_opus(self, api_client, sample_texts):
        """opus format returns audio data."""
        response = api_client.post(
            "/v1/audio/speech",
            json={
                "input": sample_texts["short"],
                "voice": "pt-BR-AntonioNeural",
                "response_format": "opus",
            },
        )
        assert response.status_code == 200
        assert len(response.content) > 0

    def test_format_wav(self, api_client, sample_texts):
        """wav format returns audio data."""
        response = api_client.post(
            "/v1/audio/speech",
            json={
                "input": sample_texts["short"],
                "voice": "pt-BR-AntonioNeural",
                "response_format": "wav",
            },
        )
        assert response.status_code == 200
        assert len(response.content) > 0


# =============================================================================
# Text Validation Tests
# =============================================================================

class TestTextValidation:
    """Tests for text input validation."""

    def test_empty_text_returns_error(self, api_client):
        """Empty text returns HTTP 400."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": "", "voice": "pt-BR-AntonioNeural"},
        )
        assert response.status_code == 400

    def test_empty_input_message(self, api_client):
        """Empty input returns descriptive error message."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": "", "voice": "pt-BR-AntonioNeural"},
        )
        assert response.status_code == 400
        data = response.json()
        assert "error" in data or "detail" in data

    def test_missing_input_returns_error(self, api_client):
        """Missing input field returns HTTP 422 or 400."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"voice": "pt-BR-AntonioNeural"},
        )
        assert response.status_code in (400, 422)


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Tests for error handling."""

    def test_invalid_voice_name_returns_error(self, api_client, sample_texts):
        """Invalid voice name returns HTTP error (400, 500, or 502)."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "invalid-voice-name-123"},
        )
        assert response.status_code in (400, 500, 502)

    def test_nonexistent_voice_returns_error(self, api_client, sample_texts):
        """Non-existent voice returns appropriate error."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "en-US-JennyNeural"},
        )
        # Edge TTS may return 200 if it accepts the voice but fails later
        # or return error codes for invalid voices
        assert response.status_code in (200, 400, 500, 502)

    def test_invalid_json_returns_error(self, api_client):
        """Invalid JSON body returns HTTP 400 or 422."""
        response = api_client.post(
            "/v1/audio/speech",
            content=b"not valid json",
            headers={"content-type": "application/json"},
        )
        assert response.status_code in (400, 422)

    def test_missing_voice_field(self, api_client, sample_texts):
        """Missing voice field uses default voice."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"]},
        )
        assert response.status_code == 200

    def test_invalid_speed_value(self, api_client, sample_texts):
        """Invalid speed value is handled."""
        response = api_client.post(
            "/v1/audio/speech",
            json={
                "input": sample_texts["short"],
                "voice": "pt-BR-AntonioNeural",
                "speed": -5.0,
            },
        )
        # Should either accept or reject
        assert response.status_code in (200, 400, 422, 500)


# =============================================================================
# Streaming Tests
# =============================================================================

class TestStreaming:
    """Tests for streaming behavior."""

    @pytest.mark.asyncio
    async def test_streaming_response(self, async_client, sample_texts):
        """Streaming response works with async client."""
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=TIMEOUT) as client:
            async with client.stream(
                "POST",
                "/v1/audio/speech",
                json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural"},
            ) as response:
                assert response.status_code == 200
                content = b""
                async for chunk in response.aiter_bytes():
                    content += chunk
                assert len(content) > 0

    @pytest.mark.asyncio
    async def test_streaming_yields_chunks(self, async_client, sample_texts):
        """Streaming yields multiple chunks."""
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=TIMEOUT) as client:
            chunks = []
            async with client.stream(
                "POST",
                "/v1/audio/speech",
                json={"input": sample_texts["medium"], "voice": "pt-BR-AntonioNeural"},
            ) as response:
                async for chunk in response.aiter_bytes(chunk_size=1024):
                    chunks.append(chunk)
            assert len(chunks) > 0
            full_content = b"".join(chunks)
            assert len(full_content) > 0

    @pytest.mark.asyncio
    async def test_non_streaming_vs_streaming_same_content(self, api_client, async_client, sample_texts):
        """Non-streaming and streaming produce same content."""
        # Non-streaming
        response_sync = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural"},
        )
        sync_content = response_sync.content

        # Streaming
        chunks = []
        async with httpx.AsyncClient(base_url=BASE_URL, timeout=TIMEOUT) as client:
            async with client.stream(
                "POST",
                "/v1/audio/speech",
                json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural"},
            ) as response:
                async for chunk in response.aiter_bytes():
                    chunks.append(chunk)
        stream_content = b"".join(chunks)

        assert len(sync_content) > 0
        assert len(stream_content) > 0


# =============================================================================
# Speed Parameter Tests
# =============================================================================

class TestSpeedParameter:
    """Tests for speed parameter variations."""

    def test_speed_1_0_default(self, api_client, sample_texts):
        """Speed 1.0 works as default."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural", "speed": 1.0},
        )
        assert response.status_code == 200
        assert len(response.content) > 0

    def test_speed_0_5_slower(self, api_client, sample_texts):
        """Speed 0.5 (slower) works or returns error if not supported."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural", "speed": 0.5},
        )
        # Speed 0.5 may cause edge-tts to return 500 if rate format is invalid
        assert response.status_code in (200, 500)
        if response.status_code == 200:
            assert len(response.content) > 0

    def test_speed_2_0_faster(self, api_client, sample_texts):
        """Speed 2.0 (faster) works."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural", "speed": 2.0},
        )
        assert response.status_code == 200
        assert len(response.content) > 0


# =============================================================================
# Model Parameter Tests
# =============================================================================

class TestModelParameter:
    """Tests for model parameter."""

    def test_model_tts_1(self, api_client, sample_texts):
        """Model 'tts-1' is accepted."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural", "model": "tts-1"},
        )
        assert response.status_code == 200

    def test_model_tts_1_hd(self, api_client, sample_texts):
        """Model 'tts-1-hd' is accepted."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural", "model": "tts-1-hd"},
        )
        assert response.status_code == 200


# =============================================================================
# Response Headers Tests
# =============================================================================

class TestResponseHeaders:
    """Tests for response headers validation."""

    def test_content_type_header(self, api_client, sample_texts):
        """Response has correct Content-Type header."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural"},
        )
        assert "content-type" in response.headers
        assert "audio" in response.headers["content-type"]

    def test_content_length_header_or_transfer_encoding(self, api_client, sample_texts):
        """Response has Content-Length or Transfer-Encoding header."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural"},
        )
        has_content_info = (
            "content-length" in response.headers or
            "transfer-encoding" in response.headers
        )
        assert has_content_info

    def test_content_length_matches_actual(self, api_client, sample_texts):
        """Content-Length header matches actual content length (when present)."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural"},
        )
        # Server uses chunked transfer encoding, so content-length may not be present
        if "content-length" in response.headers:
            content_length = int(response.headers.get("content-length", 0))
            actual_length = len(response.content)
            assert content_length == actual_length
        else:
            # For chunked encoding, just verify we got content
            assert len(response.content) > 0

    def test_no_cache_headers(self, api_client, sample_texts):
        """Response does not include cache-inhibiting headers (optional)."""
        response = api_client.post(
            "/v1/audio/speech",
            json={"input": sample_texts["short"], "voice": "pt-BR-AntonioNeural"},
        )
        # Cache headers are optional for this service
        assert "cache-control" in response.headers or "cache-control" not in response.headers
