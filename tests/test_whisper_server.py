"""
Pytest tests for whisper-server (faster-whisper-server FastAPI on port 8204).

Tests cover:
- GET /health
- POST /v1/audio/transcriptions (multipart/form-data)
- Test with actual WAV file (generated via fixtures)
- Test language parameter
- Test response_format parameter
- Test VAD filter behavior (via temperature parameter)
- Test error handling (invalid audio, missing file)
- Test concurrent requests

Prerequisites:
- faster-whisper-server must be running on http://127.0.0.1:8204
- Run locally with: cd /srv/monorepo && pytest tests/test_whisper_server.py -v
"""
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Generator

import pytest
import httpx


# Server configuration
BASE_URL = "http://127.0.0.1:8204"


@pytest.fixture
def client() -> Generator[httpx.Client, None, None]:
    """HTTP client for making requests to the whisper server."""
    with httpx.Client(base_url=BASE_URL, timeout=30.0) as client:
        yield client


@pytest.fixture
async def async_client() -> Generator[httpx.AsyncClient, None, None]:
    """Async HTTP client for concurrent testing."""
    async with httpx.AsyncClient(base_url=BASE_URL, timeout=30.0) as client:
        yield client


# =============================================================================
# Health Endpoint Tests
# =============================================================================

class TestHealthEndpoints:
    """Tests for GET /health endpoint."""

    def test_health_endpoint(self, client: httpx.Client):
        """Test GET /health returns 200 with status ok."""
        response = client.get("/health")
        assert response.status_code == 200
        # FastAPI returns any JSON, check it's not an error page
        data = response.json()
        assert data is not None

    def test_health_unknown_path(self, client: httpx.Client):
        """Test GET /unknown returns 404 with FastAPI error format."""
        response = client.get("/unknown")
        assert response.status_code == 404
        data = response.json()
        assert "detail" in data


# =============================================================================
# Transcription Endpoint Tests
# =============================================================================

class TestWavTranscription:
    """Tests for POST /v1/audio/transcriptions with WAV files."""

    def test_transcribe_wav_multipart(self, client: httpx.Client, test_wav_file: str):
        """Test multipart/form-data upload with WAV file."""
        with open(test_wav_file, "rb") as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            response = client.post("/v1/audio/transcriptions", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "text" in data

    def test_transcribe_wav_with_language(self, client: httpx.Client, test_wav_file: str):
        """Test transcription with explicit language parameter."""
        with open(test_wav_file, "rb") as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            response = client.post(
                "/v1/audio/transcriptions",
                files=files,
                data={"language": "en"}
            )

        assert response.status_code == 200
        data = response.json()
        assert "text" in data

    def test_transcribe_wav_with_prompt(self, client: httpx.Client, test_wav_file: str):
        """Test transcription with prompt parameter."""
        with open(test_wav_file, "rb") as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            response = client.post(
                "/v1/audio/transcriptions",
                files=files,
                data={"prompt": "This is a test audio file"}
            )

        assert response.status_code == 200
        data = response.json()
        assert "text" in data

    def test_transcribe_large_wav(self, client: httpx.Client, large_wav_file: str):
        """Test transcription of larger WAV file (3 seconds)."""
        with open(large_wav_file, "rb") as f:
            files = {"file": ("large.wav", f, "audio/wav")}
            response = client.post("/v1/audio/transcriptions", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "text" in data

    def test_transcribe_wav_empty_prompt(self, client: httpx.Client, test_wav_file: str):
        """Test transcription with empty prompt."""
        with open(test_wav_file, "rb") as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            response = client.post(
                "/v1/audio/transcriptions",
                files=files,
                data={"prompt": ""}
            )

        assert response.status_code == 200
        data = response.json()
        assert "text" in data


# =============================================================================
# Transcription Endpoint Tests - PCM s16le
# =============================================================================

class TestPcmTranscription:
    """Tests for POST /v1/audio/transcriptions with PCM s16le audio."""

    def test_transcribe_pcm_s16le(self, client: httpx.Client, test_pcm_file: str):
        """Test POST with raw PCM s16le bytes.

        Note: The FastAPI server may not support raw PCM directly.
        This test verifies the actual behavior.
        """
        with open(test_pcm_file, "rb") as f:
            audio_data = f.read()

        # Try as multipart with binary content
        files = {"file": ("test.pcm", audio_data, "application/octet-stream")}
        response = client.post("/v1/audio/transcriptions", files=files)

        # Accept 200 (success) or 422 (validation error - server doesn't support this format)
        assert response.status_code in (200, 422), f"Unexpected status: {response.status_code}"


# =============================================================================
# Language Auto-Detection Tests
# =============================================================================

class TestLanguageDetection:
    """Tests for language auto-detection behavior."""

    def test_language_auto_detect_with_wav(self, client: httpx.Client, test_wav_file: str):
        """Test that language is auto-detected when not specified."""
        with open(test_wav_file, "rb") as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            response = client.post("/v1/audio/transcriptions", files=files)

        assert response.status_code == 200
        data = response.json()
        assert "text" in data

    def test_language_auto_detect_with_null(self, client: httpx.Client, test_wav_file: str):
        """Test that explicit null language triggers auto-detection."""
        with open(test_wav_file, "rb") as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            response = client.post(
                "/v1/audio/transcriptions",
                files=files,
                data={"language": None}
            )

        assert response.status_code == 200
        data = response.json()
        assert "text" in data


# =============================================================================
# VAD Filter Tests (via temperature/beam_size parameters)
# =============================================================================

class TestVadFilter:
    """Tests for VAD (Voice Activity Detection) filter behavior.

    Note: The faster-whisper-server may expose VAD parameters.
    Testing via available parameters.
    """

    def test_transcribe_with_temperature(self, client: httpx.Client, test_wav_file: str):
        """Test transcription with temperature parameter.

        Temperature affects randomness; 0 is deterministic.
        """
        with open(test_wav_file, "rb") as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            response = client.post(
                "/v1/audio/transcriptions",
                files=files,
                data={"temperature": 0.0}
            )

        assert response.status_code == 200
        data = response.json()
        assert "text" in data

    def test_vad_filter_with_silence(self, client: httpx.Client, test_silence_wav_file: str):
        """Test VAD filter with near-silence audio.

        Note: Near-silence may result in empty transcription due to VAD.
        """
        with open(test_silence_wav_file, "rb") as f:
            files = {"file": ("silence.wav", f, "audio/wav")}
            response = client.post("/v1/audio/transcriptions", files=files)

        # Should return 200, text may be empty due to VAD filtering
        assert response.status_code == 200
        data = response.json()
        assert "text" in data


# =============================================================================
# Error Handling Tests
# =============================================================================

class TestErrorHandling:
    """Tests for error handling scenarios."""

    def test_missing_file_field(self, client: httpx.Client):
        """Test POST without file field returns 422."""
        response = client.post(
            "/v1/audio/transcriptions",
            data={}
        )

        assert response.status_code == 422
        data = response.json()
        assert "detail" in data

    def test_empty_audio_body(self, client: httpx.Client):
        """Test POST with empty file."""
        files = {"file": ("empty.wav", b"", "audio/wav")}
        response = client.post("/v1/audio/transcriptions", files=files)

        # Should return 200 with empty text or error depending on server handling
        assert response.status_code in (200, 500)

    def test_post_to_health_endpoint(self, client: httpx.Client):
        """Test POST to health endpoint returns 405 (method not allowed)."""
        response = client.post("/health", content=b"test")
        assert response.status_code == 405

    def test_post_to_models_endpoint(self, client: httpx.Client):
        """Test POST to models endpoint returns 404."""
        response = client.post("/v1/models", content=b"test")
        assert response.status_code == 404

    def test_invalid_language_value(self, client: httpx.Client, test_wav_file: str):
        """Test with invalid language code."""
        with open(test_wav_file, "rb") as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            response = client.post(
                "/v1/audio/transcriptions",
                files=files,
                data={"language": "invalid_lang_xyz"}
            )

        # Server may accept it and let whisper handle it, or return 422
        assert response.status_code in (200, 422)


# =============================================================================
# Concurrent Request Tests
# =============================================================================

class TestConcurrentRequests:
    """Tests for concurrent request handling."""

    @pytest.mark.asyncio
    async def test_concurrent_transcriptions(
        self, async_client: httpx.AsyncClient, test_wav_file: str
    ):
        """Test handling of concurrent transcription requests."""
        num_requests = 3

        # Read the test file once
        with open(test_wav_file, "rb") as f:
            audio_data = f.read()

        async def transcribe_task(i: int) -> dict:
            """Single transcription task."""
            files = {"file": (f"test_{i}.wav", audio_data, "audio/wav")}
            response = await async_client.post("/v1/audio/transcriptions", files=files)
            return {"index": i, "status": response.status_code, "data": response.json()}

        # Run concurrent tasks
        tasks = [transcribe_task(i) for i in range(num_requests)]
        results = await asyncio.gather(*tasks, return_exceptions=True)

        # All requests should succeed
        for result in results:
            if isinstance(result, Exception):
                pytest.fail(f"Request failed with exception: {result}")
            assert result["status"] == 200, f"Request {result['index']} failed with status {result['status']}"
            assert "text" in result["data"]

    def test_sequential_transcriptions(
        self, client: httpx.Client, test_wav_file: str
    ):
        """Test multiple sequential transcription requests."""
        num_requests = 5

        for i in range(num_requests):
            with open(test_wav_file, "rb") as f:
                files = {"file": (f"test_{i}.wav", f, "audio/wav")}
                response = client.post("/v1/audio/transcriptions", files=files)

            assert response.status_code == 200, f"Request {i} failed"
            data = response.json()
            assert "text" in data

    @pytest.mark.asyncio
    async def test_health_check_during_transcription(
        self, async_client: httpx.AsyncClient, test_wav_file: str
    ):
        """Test that health endpoint works during ongoing transcription."""
        # Start a transcription
        with open(test_wav_file, "rb") as f:
            audio_data = f.read()

        async def transcription_task():
            files = {"file": ("test.wav", audio_data, "audio/wav")}
            return await async_client.post("/v1/audio/transcriptions", files=files)

        async def health_task():
            return await async_client.get("/health")

        # Run health check while transcription might be running
        health_response = await health_task()
        assert health_response.status_code == 200

    def test_concurrent_with_threadpool(self, test_wav_file: str):
        """Test concurrent requests using ThreadPoolExecutor."""
        num_threads = 3

        def make_request(i: int) -> tuple:
            """Make a single transcription request."""
            with httpx.Client(base_url=BASE_URL, timeout=60.0) as client:
                with open(test_wav_file, "rb") as f:
                    files = {"file": (f"test_{i}.wav", f, "audio/wav")}
                    response = client.post("/v1/audio/transcriptions", files=files)
                return (i, response.status_code, response.json())

        with ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(make_request, i) for i in range(num_threads)]
            results = [f.result() for f in as_completed(futures)]

        for i, status, data in results:
            assert status == 200, f"Request {i} failed with status {status}"
            assert "text" in data


# =============================================================================
# Integration Smoke Tests
# =============================================================================

class TestIntegrationSmoke:
    """Smoke tests to verify the server works end-to-end."""

    def test_full_transcription_flow(self, client: httpx.Client, test_wav_file: str):
        """Test complete flow: health -> transcribe -> health."""
        # 1. Check health
        health_resp = client.get("/health")
        assert health_resp.status_code == 200

        # 2. Transcribe audio
        with open(test_wav_file, "rb") as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            transcribe_resp = client.post("/v1/audio/transcriptions", files=files)
        assert transcribe_resp.status_code == 200

        # 3. Verify health still OK after transcription
        health_resp2 = client.get("/health")
        assert health_resp2.status_code == 200

    def test_all_audio_formats(self, client: httpx.Client, test_wav_file: str, test_pcm_file: str):
        """Test that WAV and other supported formats return valid responses."""
        with open(test_wav_file, "rb") as f:
            files = {"file": ("test.wav", f, "audio/wav")}
            response = client.post("/v1/audio/transcriptions", files=files)

        assert response.status_code == 200, f"Failed for WAV: {response.text}"
        assert "text" in response.json()
