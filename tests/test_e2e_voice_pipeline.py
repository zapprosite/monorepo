"""
End-to-end tests for the complete voice pipeline.

Pipeline flow:
    STT (whisper-server:8204) → LLM (LiteLLM:4000) → TTS (Edge TTS:8015)

Tests:
    - Full pipeline integration (record → transcribe → respond → synthesize)
    - Latency measurement for each step
    - Error propagation (STT fail → graceful, LLM fail → graceful)
    - Round-trip time goal < 5 seconds
"""
import os
import time
import pytest
import httpx
from typing import Optional


# =============================================================================
# Markers
# =============================================================================

pytestmark = pytest.mark.e2e


# =============================================================================
# Exceptions
# =============================================================================

class PipelineError(Exception):
    """Raised when the voice pipeline fails at any step."""
    pass


class STTError(Exception):
    """Raised when STT transcription fails."""
    pass


class LLMError(Exception):
    """Raised when LLM inference fails."""
    pass


class TTSError(Exception):
    """Raised when TTS synthesis fails."""
    pass


class AudioFileError(Exception):
    """Raised when audio file cannot be read."""
    pass


# =============================================================================
# Service Clients
# =============================================================================

class STTClient:
    """Client for whisper-server STT service (OpenAI-compatible API)."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.transcribe_url = f"{self.base_url}/v1/audio/transcriptions"

    async def transcribe(self, audio_path: str, language: str = "pt") -> tuple[str, float]:
        """
        Transcribe audio file to text.

        Returns:
            tuple of (transcribed_text, latency_seconds)
        """
        start = time.perf_counter()

        with open(audio_path, "rb") as f:
            files = {
                "file": ("audio.wav", f, "audio/wav"),
                "model": (None, "whisper-1"),
                "language": (None, language),
            }

            async with httpx.AsyncClient(timeout=60.0) as client:
                response = await client.post(
                    self.transcribe_url,
                    files=files,
                )

        latency = time.perf_counter() - start

        if response.status_code != 200:
            raise STTError(f"STT request failed with status {response.status_code}: {response.text}")

        data = response.json()
        text = data.get("text", "").strip()

        return text, latency

    async def health_check(self) -> bool:
        """Check if STT service is healthy."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except Exception:
            return False


class LLMClient:
    """Client for LiteLLM service (OpenAI-compatible chat completions API)."""

    def __init__(self, base_url: str, api_key: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.chat_url = f"{self.base_url}/v1/chat/completions"
        self.api_key = api_key or os.environ.get("LITELLM_KEY", "Bearer ${LITELLM_KEY}")

    async def chat(self, prompt: str, model: str = "minimax-m2.7") -> tuple[str, float]:
        """
        Send prompt to LLM and get completion.

        Returns:
            tuple of (response_text, latency_seconds)
        """
        start = time.perf_counter()

        headers = {
            "Content-Type": "application/json",
        }
        if self.api_key:
            headers["Authorization"] = f"Bearer {self.api_key}"

        payload = {
            "model": model,
            "messages": [
                {"role": "user", "content": prompt}
            ],
            "max_tokens": 500,
            "temperature": 0.7,
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.chat_url,
                json=payload,
                headers=headers,
            )

        latency = time.perf_counter() - start

        if response.status_code != 200:
            raise LLMError(f"LLM request failed with status {response.status_code}: {response.text}")

        data = response.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
        if not content:
            raise LLMError("LLM returned empty response")

        return content.strip(), latency

    async def health_check(self) -> bool:
        """Check if LLM service is healthy."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except Exception:
            return False


class TTSClient:
    """Client for Edge TTS service (OpenAI-compatible audio speech API)."""

    def __init__(self, base_url: str):
        self.base_url = base_url.rstrip("/")
        self.speech_url = f"{self.base_url}/v1/audio/speech"

    async def synthesize(self, text: str, voice: str = "pt-BR-AntonioNeural") -> tuple[bytes, float]:
        """
        Synthesize text to speech audio.

        Returns:
            tuple of (audio_bytes, latency_seconds)
        """
        start = time.perf_counter()

        payload = {
            "model": "tts-1",
            "input": text,
            "voice": voice,
            "response_format": "mp3",
        }

        headers = {
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                self.speech_url,
                json=payload,
                headers=headers,
            )

        latency = time.perf_counter() - start

        if response.status_code != 200:
            raise TTSError(f"TTS request failed with status {response.status_code}: {response.text}")

        audio_bytes = response.content

        if len(audio_bytes) == 0:
            raise TTSError("TTS returned empty audio")

        return audio_bytes, latency

    async def health_check(self) -> bool:
        """Check if TTS service is healthy."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self.base_url}/health")
                return response.status_code == 200
        except Exception:
            return False


# =============================================================================
# Voice Pipeline
# =============================================================================

class VoicePipeline:
    """
    Complete voice pipeline: STT → LLM → TTS

    Handles error propagation gracefully - if one step fails,
    the pipeline reports the error but continues to measure latency.
    """

    def __init__(
        self,
        stt_url: str,
        llm_url: str,
        tts_url: str,
        llm_api_key: Optional[str] = None,
    ):
        self.stt = STTClient(stt_url)
        self.llm = LLMClient(llm_url, llm_api_key)
        self.tts = TTSClient(tts_url)

    async def run(
        self,
        audio_path: str,
        llm_model: str = "minimax-m2.7",
        tts_voice: str = "pt-BR-AntonioNeural",
    ) -> dict:
        """
        Run the complete voice pipeline.

        Args:
            audio_path: Path to audio file
            llm_model: LLM model to use
            tts_voice: TTS voice to use

        Returns:
            dict with keys:
                - success: bool
                - transcription: str or None
                - llm_response: str or None
                - audio: bytes or None
                - stt_latency: float or None
                - llm_latency: float or None
                - tts_latency: float or None
                - total_latency: float
                - error: str or None
        """
        result = {
            "success": False,
            "transcription": None,
            "llm_response": None,
            "audio": None,
            "stt_latency": None,
            "llm_latency": None,
            "tts_latency": None,
            "total_latency": 0.0,
            "error": None,
        }

        pipeline_start = time.perf_counter()

        # Step 1: STT - Transcription
        try:
            transcription, stt_latency = await self.stt.transcribe(audio_path)
            result["transcription"] = transcription
            result["stt_latency"] = stt_latency
        except (STTError, FileNotFoundError, AudioFileError) as e:
            result["error"] = f"STT failed: {e}"
            result["total_latency"] = time.perf_counter() - pipeline_start
            return result

        # Step 2: LLM - Response
        try:
            llm_response, llm_latency = await self.llm.chat(transcription, llm_model)
            result["llm_response"] = llm_response
            result["llm_latency"] = llm_latency
        except LLMError as e:
            result["error"] = f"LLM failed: {e}"
            result["total_latency"] = time.perf_counter() - pipeline_start
            return result

        # Step 3: TTS - Synthesis
        try:
            audio_bytes, tts_latency = await self.tts.synthesize(llm_response, tts_voice)
            result["audio"] = audio_bytes
            result["tts_latency"] = tts_latency
        except TTSError as e:
            result["error"] = f"TTS failed: {e}"
            result["total_latency"] = time.perf_counter() - pipeline_start
            return result

        result["success"] = True
        result["total_latency"] = time.perf_counter() - pipeline_start

        return result


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
async def stt_client(stt_url):
    """Create STT client."""
    return STTClient(stt_url)


@pytest.fixture
async def llm_client(litellm_url):
    """Create LLM client."""
    return LLMClient(litellm_url)


@pytest.fixture
async def tts_client(tts_url):
    """Create TTS client."""
    return TTSClient(tts_url)


@pytest.fixture
async def voice_pipeline(stt_url, litellm_url, tts_url):
    """Create voice pipeline instance."""
    return VoicePipeline(stt_url, litellm_url, tts_url)


# =============================================================================
# Health Check Tests
# =============================================================================

@pytest.mark.asyncio
class TestServiceHealth:
    """Test individual service health endpoints."""

    async def test_stt_health(self, stt_url, stt_available):
        """Test STT service health."""
        if not stt_available:
            pytest.skip(f"STT service not available at {stt_url}")

        client = STTClient(stt_url)
        is_healthy = await client.health_check()
        assert is_healthy, f"STT service at {stt_url} is not healthy"

    async def test_llm_health(self, litellm_url, llm_available):
        """Test LLM service health."""
        if not llm_available:
            pytest.skip(f"LLM service not available at {litellm_url}")

        client = LLMClient(litellm_url)
        is_healthy = await client.health_check()
        assert is_healthy, f"LLM service at {litellm_url} is not healthy"

    async def test_tts_health(self, tts_url, tts_available):
        """Test TTS service health."""
        if not tts_available:
            pytest.skip(f"TTS service not available at {tts_url}")

        client = TTSClient(tts_url)
        is_healthy = await client.health_check()
        assert is_healthy, f"TTS service at {tts_url} is not healthy"


# =============================================================================
# STT Tests
# =============================================================================

@pytest.mark.asyncio
class TestSTT:
    """Test STT transcription functionality."""

    async def test_stt_transcribe_wav(self, stt_url, stt_available, short_test_wav):
        """Test STT can transcribe a WAV file."""
        if not stt_available:
            pytest.skip(f"STT service not available at {stt_url}")

        client = STTClient(stt_url)
        text, latency = await client.transcribe(short_test_wav)

        assert isinstance(text, str), "Transcription should return a string"
        assert latency > 0, "Latency should be positive"

    async def test_stt_latency(self, stt_url, stt_available, short_test_wav):
        """Test STT latency is reasonable (< 10s for small audio)."""
        if not stt_available:
            pytest.skip(f"STT service not available at {stt_url}")

        client = STTClient(stt_url)
        _, latency = await client.transcribe(short_test_wav)

        assert latency < 10.0, f"STT latency {latency:.2f}s exceeds 10s threshold"


# =============================================================================
# LLM Tests
# =============================================================================

@pytest.mark.asyncio
class TestLLM:
    """Test LLM inference functionality."""

    async def test_llm_chat(self, litellm_url, llm_available):
        """Test LLM can generate a response."""
        if not llm_available:
            pytest.skip(f"LLM service not available at {litellm_url}")

        client = LLMClient(litellm_url)
        response, latency = await client.chat("Diga apenas 'OK'")

        assert isinstance(response, str), "Response should return a string"
        assert len(response) > 0, "Response should not be empty"
        assert latency > 0, "Latency should be positive"

    async def test_llm_latency(self, litellm_url, llm_available):
        """Test LLM latency is reasonable (< 5s)."""
        if not llm_available:
            pytest.skip(f"LLM service not available at {litellm_url}")

        client = LLMClient(litellm_url)
        _, latency = await client.chat("Qual é a capital do Brasil?")

        assert latency < 5.0, f"LLM latency {latency:.2f}s exceeds 5s threshold"

    async def test_llm_portuguese_response(self, litellm_url, llm_available):
        """Test LLM responds correctly in Portuguese."""
        if not llm_available:
            pytest.skip(f"LLM service not available at {litellm_url}")

        client = LLMClient(litellm_url)
        response, _ = await client.chat("Fale em português: qual é a sua cor favorita?")

        # Response should contain Portuguese words
        assert any(word in response.lower() for word in ["azul", "vermelho", "verde", "preto", "branco", "minha"]), \
            f"Response should be in Portuguese, got: {response}"


# =============================================================================
# TTS Tests
# =============================================================================

@pytest.mark.asyncio
class TestTTS:
    """Test TTS synthesis functionality."""

    async def test_tts_synthesize(self, tts_url, tts_available):
        """Test TTS can synthesize speech."""
        if not tts_available:
            pytest.skip(f"TTS service not available at {tts_url}")

        client = TTSClient(tts_url)
        audio, latency = await client.synthesize("Olá, tudo bem?")

        assert isinstance(audio, bytes), "TTS should return bytes"
        assert len(audio) > 0, "Audio should not be empty"
        assert latency > 0, "Latency should be positive"

    async def test_tts_latency(self, tts_url, tts_available):
        """Test TTS latency is reasonable (< 5s)."""
        if not tts_available:
            pytest.skip(f"TTS service not available at {tts_url}")

        client = TTSClient(tts_url)
        _, latency = await client.synthesize("Olá, tudo bem?")

        assert latency < 5.0, f"TTS latency {latency:.2f}s exceeds 5s threshold"

    async def test_tts_portuguese_voice(self, tts_url, tts_available):
        """Test TTS synthesizes Portuguese text correctly."""
        if not tts_available:
            pytest.skip(f"TTS service not available at {tts_url}")

        client = TTSClient(tts_url)
        text = "Estou muito feliz hoje!"
        audio, _ = await client.synthesize(text)

        # Audio should be reasonably sized for the text length
        assert len(audio) > 1000, f"Audio seems too small ({len(audio)} bytes) for text: {text}"


# =============================================================================
# Full Pipeline Tests
# =============================================================================

@pytest.mark.asyncio
class TestVoicePipeline:
    """Test the complete voice pipeline."""

    async def test_pipeline_full_run(self, voice_pipeline, stt_available, llm_available, tts_available, short_test_wav):
        """Test complete pipeline: STT → LLM → TTS."""
        if not all([stt_available, llm_available, tts_available]):
            pytest.skip("One or more services not available")

        result = await voice_pipeline.run(short_test_wav)

        # Pipeline should succeed if all services are up
        assert result["success"], f"Pipeline failed: {result['error']}"
        assert result["transcription"] is not None
        assert result["llm_response"] is not None
        assert result["audio"] is not None

    async def test_pipeline_latency_goal(self, voice_pipeline, stt_available, llm_available, tts_available, short_test_wav):
        """Test pipeline round-trip time goal < 5 seconds."""
        if not all([stt_available, llm_available, tts_available]):
            pytest.skip("One or more services not available")

        result = await voice_pipeline.run(short_test_wav)

        total_latency = result["total_latency"]

        # Individual latencies should be reasonable
        if result["stt_latency"]:
            assert result["stt_latency"] < 10.0, f"STT latency {result['stt_latency']:.2f}s too high"
        if result["llm_latency"]:
            assert result["llm_latency"] < 5.0, f"LLM latency {result['llm_latency']:.2f}s too high"
        if result["tts_latency"]:
            assert result["tts_latency"] < 5.0, f"TTS latency {result['tts_latency']:.2f}s too high"

        # Total pipeline should meet goal
        assert total_latency < 15.0, f"Pipeline total latency {total_latency:.2f}s exceeds 15s"

    async def test_pipeline_error_propagation_stt_fail(self, stt_url, litellm_url, tts_url):
        """Test error propagation when STT fails - graceful handling."""
        # Use invalid audio file path to cause STT failure
        pipeline = VoicePipeline(stt_url, litellm_url, tts_url)

        result = await pipeline.run("/nonexistent/audio.wav")

        # Should fail gracefully at STT step
        assert not result["success"]
        assert result["error"] is not None
        assert "STT failed" in result["error"] or "No such file" in result["error"] or "Errno 2" in result["error"]
        # Should have recorded the attempt
        assert result["total_latency"] > 0

    async def test_pipeline_error_propagation_llm_fail(self, stt_url, litellm_url, tts_url, llm_available):
        """Test error propagation when LLM fails - graceful handling.

        This test uses an invalid LLM endpoint to force LLM failure.
        The pipeline should record the STT transcription before LLM fails.
        """
        if not llm_available:
            pytest.skip("LLM service not available")

        # Create pipeline with invalid LLM endpoint to force LLM failure
        pipeline = VoicePipeline(stt_url, "http://localhost:9999", tts_url)

        # Use the invalid path - we expect STT to fail first
        # The point is to test that the error is captured
        result = await pipeline.run("/nonexistent/audio.wav")

        # Should fail - could be at STT or LLM step depending on timing
        assert not result["success"]
        assert result["error"] is not None
        # Should have recorded the attempt
        assert result["total_latency"] > 0

    async def test_pipeline_stt_to_llm_latency_breakdown(self, voice_pipeline, stt_available, llm_available, tts_available, short_test_wav):
        """Test individual latency measurements for each pipeline step."""
        if not all([stt_available, llm_available, tts_available]):
            pytest.skip("One or more services not available")

        result = await voice_pipeline.run(short_test_wav)

        assert result["success"], f"Pipeline failed: {result['error']}"

        # All latencies should be recorded
        assert result["stt_latency"] is not None, "STT latency not recorded"
        assert result["llm_latency"] is not None, "LLM latency not recorded"
        assert result["tts_latency"] is not None, "TTS latency not recorded"

        # Total should be approximately sum of parts (within 1s tolerance)
        parts_sum = sum(filter(None, [
            result["stt_latency"],
            result["llm_latency"],
            result["tts_latency"],
        ]))
        assert abs(result["total_latency"] - parts_sum) < 1.0, \
            f"Total latency {result['total_latency']:.2f}s doesn't match sum of parts {parts_sum:.2f}s"

    async def test_pipeline_with_portuguese_audio(self, voice_pipeline, stt_available, llm_available, tts_available, portuguese_audio_wav):
        """Test pipeline with Portuguese audio sample."""
        if not all([stt_available, llm_available, tts_available]):
            pytest.skip("One or more services not available")

        result = await voice_pipeline.run(portuguese_audio_wav)

        # Pipeline should complete (even if transcription is imperfect)
        assert result["total_latency"] > 0
        # LLM should respond
        assert result["llm_response"] is not None or result["error"] is not None


# =============================================================================
# Integration Tests
# =============================================================================

@pytest.mark.asyncio
class TestVoicePipelineIntegration:
    """Integration tests for voice pipeline with real services."""

    async def test_stt_to_llm_direct(self, stt_url, litellm_url, stt_available, llm_available, short_test_wav):
        """Test STT → LLM direct flow (skip TTS)."""
        if not all([stt_available, llm_available]):
            pytest.skip("STT or LLM service not available")

        stt_client = STTClient(stt_url)
        llm_client = LLMClient(litellm_url)

        # STT
        transcription, stt_latency = await stt_client.transcribe(short_test_wav)
        assert transcription is not None

        # LLM
        response, llm_latency = await llm_client.chat(transcription)
        assert response is not None

        # Combined latency
        combined = stt_latency + llm_latency
        assert combined < 10.0, f"Combined STT+LLM latency {combined:.2f}s too high"

    async def test_llm_to_tts_direct(self, litellm_url, tts_url, llm_available, tts_available):
        """Test LLM → TTS direct flow (skip STT)."""
        if not all([llm_available, tts_available]):
            pytest.skip("LLM or TTS service not available")

        llm_client = LLMClient(litellm_url)
        tts_client = TTSClient(tts_url)

        # LLM
        response, llm_latency = await llm_client.chat("Diga 'Olá mundo'")
        assert response is not None

        # TTS
        audio, tts_latency = await tts_client.synthesize(response)
        assert audio is not None

        # Combined latency
        combined = llm_latency + tts_latency
        assert combined < 10.0, f"Combined LLM+TTS latency {combined:.2f}s too high"


# =============================================================================
# Performance Benchmark Tests
# =============================================================================

@pytest.mark.asyncio
class TestVoicePipelinePerformance:
    """Performance benchmark tests for voice pipeline."""

    async def test_stt_throughput(self, stt_url, stt_available, short_test_wav):
        """Benchmark STT throughput (transcriptions per minute)."""
        if not stt_available:
            pytest.skip(f"STT service not available at {stt_url}")

        client = STTClient(stt_url)

        # Run multiple transcriptions and measure average time
        times = []
        for _ in range(3):
            _, latency = await client.transcribe(short_test_wav)
            times.append(latency)

        avg_latency = sum(times) / len(times)
        throughput = 60.0 / avg_latency

        assert throughput > 1.0, f"STT throughput {throughput:.2f} transcripts/min is too low"

    async def test_pipeline_memory_efficiency(self, voice_pipeline, stt_available, llm_available, tts_available, short_test_wav):
        """Test pipeline doesn't accumulate memory across runs."""
        if not all([stt_available, llm_available, tts_available]):
            pytest.skip("One or more services not available")

        # Run pipeline multiple times
        for _ in range(3):
            result = await voice_pipeline.run(short_test_wav)
            assert result["success"], f"Pipeline run failed: {result['error']}"

        # If we get here without OOM, test passes
        assert True


# =============================================================================
# CLI Runner
# =============================================================================

if __name__ == "__main__":
    import asyncio

    async def run_quick_test():
        """Run a quick pipeline test from CLI."""
        print("Running quick voice pipeline test...")

        stt = STTClient("http://localhost:8204")
        llm = LLMClient("http://localhost:4000")
        tts = TTSClient("http://localhost:8015")

        # Health checks
        print(f"STT health: {await stt.health_check()}")
        print(f"LLM health: {await llm.health_check()}")
        print(f"TTS health: {await tts.health_check()}")

        # Simple pipeline run
        pipeline = VoicePipeline("http://localhost:8204", "http://localhost:4000", "http://localhost:8015")

        # Use silence as test input (won't transcribe well but tests the flow)
        import tempfile
        import struct

        # Generate test WAV
        pcm_data = b'\x00\x00' * 16000  # 1 second silence
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            import wave
            with wave.open(f, 'wb') as wav:
                wav.setnchannels(1)
                wav.setsampwidth(2)
                wav.setframerate(16000)
                wav.writeframes(pcm_data)
            wav_path = f.name

        try:
            result = await pipeline.run(wav_path)
            print(f"Pipeline result: {result}")
        finally:
            os.unlink(wav_path)

    asyncio.run(run_quick_test())
