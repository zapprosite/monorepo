"""
Pytest configuration and fixtures for voice pipeline e2e tests.
"""
import os
import socket
import struct
import wave
import tempfile
import pytest

# =============================================================================
# Service endpoints
# =============================================================================

STT_URL = os.environ.get("STT_URL", "http://localhost:8204")
LITELLM_URL = os.environ.get("LITELLM_URL", "http://localhost:4000")
TTS_URL = os.environ.get("TTS_URL", "http://localhost:8015")

# =============================================================================
# Service availability checks
# =============================================================================

def is_port_reachable(host: str, port: int, timeout: float = 2.0) -> bool:
    """Check if a TCP port is reachable."""
    try:
        with socket.create_connection((host, port), timeout=timeout):
            return True
    except (socket.timeout, ConnectionRefusedError, OSError):
        return False


def is_http_reachable(url: str, timeout: float = 2.0) -> bool:
    """Check if an HTTP endpoint is reachable."""
    import urllib.request
    try:
        urllib.request.urlopen(url, timeout=timeout)
        return True
    except Exception:
        return False


class ServiceAvailability:
    """Registry of service availability discovered at session start."""

    def __init__(self):
        self.services: dict[str, bool] = {}
        self.urls: dict[str, str] = {}

    def register(self, name: str, url: str, reached: bool):
        self.services[name] = reached
        self.urls[name] = url

    def is_available(self, name: str) -> bool:
        return self.services.get(name, False)

    def get_url(self, name: str) -> str:
        return self.urls.get(name, "")

    def summary(self) -> str:
        lines = ["Service availability:"]
        for name, reached in self.services.items():
            status = "OK" if reached else "UNAVAILABLE"
            url = self.urls.get(name, "")
            lines.append(f"  [{status}] {name} -> {url}")
        return "\n".join(lines)


# Global availability registry
availability = ServiceAvailability()


# =============================================================================
# Pytest hooks
# =============================================================================

def pytest_configure(config):
    """Configure pytest markers."""
    config.addinivalue_line("markers", "e2e: marks end-to-end tests")
    config.addinivalue_line("markers", "slow: marks slow tests")
    config.addinivalue_line("markers", "requires_stt: marks tests requiring STT service")
    config.addinivalue_line("markers", "requires_llm: marks tests requiring LLM service")
    config.addinivalue_line("markers", "requires_tts: marks tests requiring TTS service")


def pytest_sessionstart(session):
    """Test service connectivity at session start."""
    print("\n" + "=" * 60)
    print("VOICE PIPELINE E2E SESSION — Checking service availability")
    print("=" * 60)

    # STT (whisper-server)
    from urllib.parse import urlparse
    parsed = urlparse(STT_URL)
    stt_host = parsed.hostname or "localhost"
    stt_port = parsed.port or 8204
    stt_reached = is_port_reachable(stt_host, stt_port)
    availability.register("stt", STT_URL, stt_reached)

    # LLM (LiteLLM)
    parsed = urlparse(LITELLM_URL)
    llm_host = parsed.hostname or "localhost"
    llm_port = parsed.port or 4000
    llm_reached = is_port_reachable(llm_host, llm_port)
    availability.register("llm", LITELLM_URL, llm_reached)

    # TTS (Edge TTS)
    parsed = urlparse(TTS_URL)
    tts_host = parsed.hostname or "localhost"
    tts_port = parsed.port or 8015
    tts_reached = is_port_reachable(tts_host, tts_port)
    availability.register("tts", TTS_URL, tts_reached)

    print(availability.summary())
    print("=" * 60 + "\n")


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture(scope="session")
def stt_url():
    """STT service URL (whisper-server)."""
    return STT_URL


@pytest.fixture(scope="session")
def litellm_url():
    """LiteLLM service URL."""
    return LITELLM_URL


@pytest.fixture(scope="session")
def tts_url():
    """TTS service URL (Edge TTS)."""
    return TTS_URL


@pytest.fixture(scope="session")
def stt_available():
    """Return whether STT service is reachable."""
    return availability.is_available("stt")


@pytest.fixture(scope="session")
def llm_available():
    """Return whether LLM service is reachable."""
    return availability.is_available("llm")


@pytest.fixture(scope="session")
def tts_available():
    """Return whether TTS service is reachable."""
    return availability.is_available("tts")


@pytest.fixture(scope="session")
def service_availability():
    """Expose the full availability registry to tests."""
    return availability


# =============================================================================
# Audio generation fixtures
# =============================================================================

SAMPLE_RATE = 16000


def generate_sine_wave_pcm(frequency: float, duration: float, sample_rate: int = SAMPLE_RATE) -> bytes:
    """Generate sine wave audio as PCM s16le bytes."""
    import math
    n_samples = int(sample_rate * duration)
    samples = []
    for i in range(n_samples):
        t = i / sample_rate
        value = int(16000 * math.sin(2 * math.pi * frequency * t))
        value = max(-32768, min(32767, value))
        samples.append(struct.pack('<h', value))
    return b''.join(samples)


def create_wav_from_pcm(pcm_data: bytes, sample_rate: int = SAMPLE_RATE) -> bytes:
    """Create a WAV file from PCM s16le data."""
    n_samples = len(pcm_data) // 2
    wav_buffer = tempfile.SpooledTemporaryFile(max_size=len(pcm_data) + 44, mode='w+b')

    with wave.open(wav_buffer, 'wb') as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)  # 16-bit
        wav.setframerate(sample_rate)
        wav.writeframes(pcm_data)

    wav_buffer.seek(0)
    return wav_buffer.read()


@pytest.fixture(scope="session")
def portuguese_audio_wav(tmp_path_factory):
    """Generate a Portuguese speech-like test audio (440Hz tone as placeholder).

    In production, this would use a real Portuguese voice sample.
    The 440Hz tone serves as a placeholder that STT can still process.
    """
    tmp_dir = tmp_path_factory.mktemp("audio")
    duration = 2.0  # 2 seconds

    # Generate a complex waveform that resembles speech patterns
    # (multiple frequencies combined)
    import math
    pcm_data = b''
    n_samples = int(SAMPLE_RATE * duration)
    for i in range(n_samples):
        t = i / SAMPLE_RATE
        # Combine multiple frequencies to create speech-like pattern
        value = (
            int(8000 * math.sin(2 * math.pi * 200 * t)) +      # base
            int(4000 * math.sin(2 * math.pi * 400 * t)) +       # formants
            int(2000 * math.sin(2 * math.pi * 800 * t)) +       # higher
            int(1000 * math.sin(2 * math.pi * 1200 * t))       # contour
        )
        value = max(-32768, min(32767, value))
        pcm_data += struct.pack('<h', value)

    wav_data = create_wav_from_pcm(pcm_data)
    wav_path = tmp_dir / "portuguese_test.wav"
    wav_path.write_bytes(wav_data)

    yield str(wav_path)


@pytest.fixture(scope="session")
def short_test_wav(tmp_path_factory):
    """Generate a short 1-second test WAV file."""
    tmp_dir = tmp_path_factory.mktemp("audio")

    pcm_data = generate_sine_wave_pcm(frequency=440.0, duration=1.0)
    wav_data = create_wav_from_pcm(pcm_data)

    wav_path = tmp_dir / "short_test.wav"
    wav_path.write_bytes(wav_data)

    yield str(wav_path)


@pytest.fixture(scope="session")
def sample_audio_path(tmp_path_factory):
    """Path to sample Portuguese audio if available, otherwise generates one.

    Checks for existing sample audio in docs/SPECS or generates a placeholder.
    """
    # Try to use existing Portuguese audio sample
    existing_sample = "/srv/monorepo/docs/SPECS/resposta-julia.ogg"
    if os.path.exists(existing_sample):
        yield existing_sample
        return

    # Fall back to generated audio
    tmp_dir = tmp_path_factory.mktemp("audio")
    pcm_data = generate_sine_wave_pcm(frequency=300.0, duration=2.0)
    wav_data = create_wav_from_pcm(pcm_data)

    wav_path = tmp_dir / "sample_audio.wav"
    wav_path.write_bytes(wav_data)

    yield str(wav_path)


# =============================================================================
# Additional test fixtures for whisper-server tests
# =============================================================================

@pytest.fixture(scope="session")
def test_pcm_file(tmp_path_factory):
    """Create a small test PCM s16le file (880Hz sine wave, 1 second)."""
    tmp_dir = tmp_path_factory.mktemp("audio_pcm")

    # Generate a 880Hz sine wave for 1 second
    pcm_data = generate_sine_wave_pcm(frequency=880.0, duration=1.0)

    pcm_path = tmp_dir / "test_880hz.pcm"
    pcm_path.write_bytes(pcm_data)

    yield str(pcm_path)


@pytest.fixture(scope="session")
def test_silence_wav_file(tmp_path_factory):
    """Create a test WAV file with silence (for VAD testing)."""
    tmp_dir = tmp_path_factory.mktemp("audio_silence")

    # Silence as PCM s16le
    n_samples = int(SAMPLE_RATE * 1.0)
    pcm_data = b'\x00\x00' * n_samples
    wav_data = create_wav_from_pcm(pcm_data)

    wav_path = tmp_dir / "test_silence.wav"
    wav_path.write_bytes(wav_data)

    yield str(wav_path)


@pytest.fixture(scope="session")
def invalid_audio_file(tmp_path_factory):
    """Create an invalid audio file (not audio at all)."""
    tmp_dir = tmp_path_factory.mktemp("audio_invalid")

    invalid_path = tmp_dir / "invalid.bin"
    invalid_path.write_bytes(b"This is not an audio file at all!" * 100)

    yield str(invalid_path)


@pytest.fixture(scope="session")
def large_wav_file(tmp_path_factory):
    """Create a larger WAV file for concurrent request testing (3 seconds, 1kHz)."""
    tmp_dir = tmp_path_factory.mktemp("audio_large")

    # 3 seconds of audio at 1kHz
    pcm_data = generate_sine_wave_pcm(frequency=1000.0, duration=3.0)
    wav_data = create_wav_from_pcm(pcm_data)

    wav_path = tmp_dir / "test_large.wav"
    wav_path.write_bytes(wav_data)

    yield str(wav_path)


@pytest.fixture(scope="session")
def test_wav_file(tmp_path_factory, short_test_wav):
    """Alias for short_test_wav for backward compatibility."""
    return short_test_wav
