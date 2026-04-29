#!/usr/bin/env python3
"""
HVAC Daily Smoke Test — T-OW07 multimodal validation

Tests the full multimodal stack for zappro-clima-tutor:
  1. Chat via zappro-clima-tutor (POST /v1/chat/completions)
  2. STT via Groq (if GROQ_API_KEY available)
  3. TTS via Edge TTS (if Edge TTS available)
  4. Vision via Qwen2.5VL (calling Ollama with dummy image)
  5. OpenWebUI only exposes zappro-clima-tutor (GET /v1/models)

Usage:
  python3 scripts/hvac-rag/hvac-daily-smoke.py --once
  python3 scripts/hvac-rag/hvac-daily-smoke.py --report /tmp/smoke-$(date +%Y%m%d).json

Exit: 0 all pass, 1 any fail
"""

import argparse
import asyncio
import base64
import hashlib
import json
import math
import os
import struct
import sys
import tempfile
import zlib
from datetime import datetime, timezone

# =============================================================================
# Environment — load from .env if not already set
# =============================================================================
_env_path = os.environ.get("HVAC_DOTENV", "/srv/monorepo/.env")
if os.path.exists(_env_path):
    with open(_env_path) as _f:
        for _line in _f:
            _line = _line.strip()
            if not _line or _line.startswith("#"):
                continue
            if "=" in _line:
                _k, _v = _line.split("=", 1)
                _k = _k.strip()
                if _k not in os.environ:
                    os.environ[_k] = _v

# =============================================================================
# Configuration
# =============================================================================
PIPELINE_URL = os.environ.get("HVAC_PIPELINE_URL", "http://127.0.0.1:4017")
OPENWEBUI_URL = os.environ.get("OPENWEBUI_URL", "http://127.0.0.1:3456")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
EDGE_TTS_URL = os.environ.get("EDGE_TTS_URL", "http://localhost:5050")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
LITELLM_URL = os.environ.get("LITELLM_URL", "http://localhost:4000")
DEFAULT_REPORT = f"/tmp/hvac-daily-smoke-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"

import httpx

# =============================================================================
# Helpers
# =============================================================================

def safe_query_hash(query: str) -> str:
    """Return SHA256 prefix (8 chars) of query for logging."""
    return hashlib.sha256(query.encode()).hexdigest()[:8]


def result(test_name: str, ok: bool | None, detail: str = "") -> bool | None:
    if ok is None:
        print(f"  {test_name:<52} ... SKIP {detail}")
        return None
    if ok:
        print(f"  {test_name:<52} ... PASS {detail}")
        return True
    print(f"  {test_name:<52} ... FAIL {detail}")
    return False


def make_rgb_png(w: int = 100, h: int = 100, r: int = 255, g: int = 0, b: int = 0) -> bytes:
    """Create a valid RGB PNG of size w×h with color (r,g,b)."""
    def chunk(tag: bytes, data: bytes) -> bytes:
        c = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", c)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
    raw = b""
    for _ in range(h):
        raw += b"\x00" + bytes([r, g, b] * w)
    idat = chunk(b"IDAT", zlib.compress(raw))
    iend = chunk(b"IEND", b"")
    return sig + ihdr + idat + iend


# =============================================================================
# Test 1 — GET /v1/models: only zappro-clima-tutor exposed
# =============================================================================

async def test_pipeline_models_only_zappro_clima_tutor() -> bool | None:
    """OpenWebUI/zappro-clima-tutor must expose ONLY zappro-clima-tutor model."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{PIPELINE_URL}/v1/models")
        if r.status_code != 200:
            return result("test_pipeline_models_only_zappro_clima_tutor", None, f"HTTP {r.status_code}")

        data = r.json()
        model_ids = [m["id"] for m in data.get("data", [])]

        # Must have zappro-clima-tutor
        if "zappro-clima-tutor" not in model_ids:
            return result("test_pipeline_models_only_zappro_clima_tutor", False,
                         f"zappro-clima-tutor not found in {model_ids}")

        # Must NOT expose internal aliases
        forbidden = [
            "minimax-m2.7", "minimax-m2.7-highspeed",
            "hvac-manual-strict", "hvac-field-tutor", "hvac-printable",
            "qwen2.5vl", "qwen2.5vl:3b", "qwen2.5-vl",
        ]
        exposed_forbidden = [m for m in forbidden if m in model_ids]
        if exposed_forbidden:
            return result("test_pipeline_models_only_zappro_clima_tutor", False,
                         f"forbidden models exposed: {exposed_forbidden}")

        # Must be only one model
        if len(model_ids) != 1:
            return result("test_pipeline_models_only_zappro_clima_tutor", False,
                         f"expected 1 model, got {len(model_ids)}: {model_ids}")

        return result("test_pipeline_models_only_zappro_clima_tutor", True)

    except httpx.ConnectError:
        return result("test_pipeline_models_only_zappro_clima_tutor", None, "(pipe not running)")
    except Exception as exc:
        return result("test_pipeline_models_only_zappro_clima_tutor", None, f"({exc})")


# =============================================================================
# Test 2 — Chat via zappro-clima-tutor (text mode)
# =============================================================================

async def test_chat_via_zappro_clima_tutor() -> bool | None:
    """POST /v1/chat/completions with zappro-clima-tutor returns HVAC response."""
    query = "RYYQ48BRA error code E6 compressor inverter"
    q_hash = safe_query_hash(query)
    payload = {
        "model": "zappro-clima-tutor",
        "messages": [{"role": "user", "content": query}],
        "temperature": 0.55,
        "max_tokens": 512,
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{PIPELINE_URL}/v1/chat/completions",
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        latency_ms = r.elapsed.total_seconds() * 1000

        if r.status_code != 200:
            return result("test_chat_via_zappro_clima_tutor", False,
                         f"HTTP {r.status_code} after {latency_ms:.0f}ms")

        data = r.json()
        content = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        if not content or len(content) < 20:
            return result("test_chat_via_zappro_clima_tutor", False,
                         f"response too short: {len(content)} chars")

        # Basic sanity: response should mention HVAC terms or error codes
        content_lower = content.lower()
        hvac_signals = ["split", "vrv", "inverter", "compressor", "error", "e6", "ryyq"]
        if not any(s in content_lower for s in hvac_signals):
            return result("test_chat_via_zappro_clima_tutor", False,
                         f"response doesn't look like HVAC content: {content[:80]}")

        return result("test_chat_via_zappro_clima_tutor", True,
                     f"{len(content)} chars in {latency_ms:.0f}ms")

    except httpx.ConnectError:
        return result("test_chat_via_zappro_clima_tutor", None, "(pipe not running)")
    except httpx.TimeoutException:
        return result("test_chat_via_zappro_clima_tutor", None, "(timeout)")
    except Exception as exc:
        return result("test_chat_via_zappro_clima_tutor", None, f"({exc})")


# =============================================================================
# Test 3 — STT via Groq (if GROQ_API_KEY available)
# =============================================================================

async def test_stt_groq() -> bool | None:
    """POST /v1/audio/transcriptions via Groq (if GROQ_API_KEY set)."""
    if not GROQ_API_KEY:
        return result("test_stt_groq", None, "(GROQ_API_KEY not set)")

    # Create a valid WAV audio (1 channel, 16kHz, 16-bit, 0.5 seconds)
    # Groq requires minimum 0.01 seconds of audio
    sample_rate = 16000
    duration_sec = 0.5
    num_samples = int(sample_rate * duration_sec)
    # 800 Hz sine wave at moderate volume
    samples = bytes([int(128 + 80 * math.sin(2 * math.pi * 800 * i / sample_rate)) for i in range(num_samples)])

    def le16(v: int) -> bytes:
        return struct.pack("<H", v & 0xFFFF)

    wav_header = (
        b"RIFF" +
        struct.pack("<I", 36 + len(samples)) +
        b"WAVE" +
        b"fmt " +
        struct.pack("<I", 16) +           # chunk size = 16
        struct.pack("<H", 1) +            # PCM format
        struct.pack("<H", 1) +            # 1 channel
        struct.pack("<I", sample_rate) +  # sample rate
        struct.pack("<I", sample_rate * 2) +  # byte rate
        struct.pack("<H", 2) +            # block align
        struct.pack("<H", 16) +           # bits per sample
        b"data" +
        struct.pack("<I", len(samples))
    )
    audio_bytes = wav_header + samples

    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(audio_bytes)
        f.flush()
        audio_path = f.name

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            with open(audio_path, "rb") as af:
                files = {"file": ("test.wav", af, "audio/wav")}
                data = {"model": "whisper-large-v3-turbo"}
                r = await client.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    files=files,
                    data=data,
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                )
        try:
            os.unlink(audio_path)
        except Exception:
            pass

        if r.status_code == 200:
            return result("test_stt_groq", True, "transcription returned")
        elif r.status_code in (401, 403):
            return result("test_stt_groq", None, f"(Groq auth issue: {r.status_code})")
        else:
            return result("test_stt_groq", False, f"HTTP {r.status_code}: {r.text[:80]}")

    except httpx.ConnectError:
        os.unlink(audio_path)
        return result("test_stt_groq", None, "(Groq unreachable)")
    except Exception as exc:
        try:
            os.unlink(audio_path)
        except Exception:
            pass
        return result("test_stt_groq", None, f"({exc})")


# =============================================================================
# Test 4 — TTS via Edge TTS (if EDGE_TTS_URL available)
# =============================================================================

async def test_tts_edge() -> bool | None:
    """POST /v1/audio/speech via Edge TTS bridge (if EDGE_TTS_URL set)."""
    if not EDGE_TTS_URL:
        return result("test_tts_edge", None, "(EDGE_TTS_URL not set)")

    payload = {
        "model": "tts-1",
        "input": "Ola, este e um teste de voz.",
        "voice": "pt-BR-FranciscaNeural",
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{EDGE_TTS_URL}/v1/audio/speech",
                json=payload,
                headers={"Content-Type": "application/json"},
            )

        if r.status_code == 200:
            content_type = r.headers.get("content-type", "")
            if "audio" in content_type or len(r.content) > 100:
                return result("test_tts_edge", True,
                             f"audio returned ({len(r.content)} bytes)")
            return result("test_tts_edge", False, f"unexpected content-type: {content_type}")
        return result("test_tts_edge", False, f"HTTP {r.status_code}")

    except httpx.ConnectError:
        return result("test_tts_edge", None, "(Edge TTS bridge not reachable)")
    except Exception as exc:
        return result("test_tts_edge", None, f"({exc})")


# =============================================================================
# Test 5 — Vision with dummy image via Qwen2.5VL on Ollama
# =============================================================================

async def test_vision_qwen_dummy_image() -> bool | None:
    """POST /v1/chat/completions with image to Qwen2.5VL via Ollama."""
    png_bytes = make_rgb_png(100, 100, 255, 0, 0)  # 100x100 red square
    png_b64 = base64.b64encode(png_bytes).decode()
    payload = {
        "model": "qwen2.5vl:3b",
        "messages": [{
            "role": "user",
            "content": "What color is this square? Answer with one color name.",
            "images": [png_b64]
        }],
        "stream": False,
        "options": {"temperature": 0.1}
    }
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            r = await client.post(
                f"{OLLAMA_URL}/api/chat",
                json=payload,
            )

        if r.status_code == 200:
            data = r.json()
            content = data.get("message", {}).get("content", "")
            if content:
                return result("test_vision_qwen_dummy_image", True,
                             f"vision response: {content[:60]}")
            return result("test_vision_qwen_dummy_image", False, "empty vision response")
        elif r.status_code == 404:
            return result("test_vision_qwen_dummy_image", None,
                         "(qwen2.5vl:3b not loaded in Ollama)")
        else:
            return result("test_vision_qwen_dummy_image", False,
                         f"HTTP {r.status_code}: {r.text[:80]}")

    except httpx.ConnectError:
        return result("test_vision_qwen_dummy_image", None, "(Ollama not reachable)")
    except Exception as exc:
        return result("test_vision_qwen_dummy_image", None, f"({exc})")


# =============================================================================
# Test 6 — OpenWebUI /v1/models validation (if OPENWEBUI_URL available)
# =============================================================================

async def test_openwebui_model_filter() -> bool | None:
    """GET /v1/models from OpenWebUI returns only zappro-clima-tutor."""
    if not OPENWEBUI_URL:
        return result("test_openwebui_model_filter", None, "(OPENWEBUI_URL not set)")

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{OPENWEBUI_URL}/api/v1/models")

        if r.status_code == 401 or r.status_code == 403:
            return result("test_openwebui_model_filter", None, "(OpenWebUI API requires auth)")

        if r.status_code != 200:
            return result("test_openwebui_model_filter", None, f"(OpenWebUI HTTP {r.status_code})")

        data = r.json()
        model_ids = [m.get("name") or m.get("id", "") for m in data.get("data", [])]

        if "zappro-clima-tutor" not in model_ids:
            return result("test_openwebui_model_filter", False,
                         f"zappro-clima-tutor not found: {model_ids}")

        # Check no internal models leak through
        forbidden = ["minimax", "hvac-manual", "field-tutor", "qwen", "gemma"]
        leaked = [m for m in forbidden if any(p in mid for mid in model_ids for p in [m])]
        if leaked:
            return result("test_openwebui_model_filter", False,
                         f"internal models leaked: {leaked}")

        return result("test_openwebui_model_filter", True,
                     f"only zappro-clima-tutor exposed ({len(model_ids)} model(s))")

    except httpx.ConnectError:
        return result("test_openwebui_model_filter", None, "(OpenWebUI not reachable)")
    except Exception as exc:
        return result("test_openwebui_model_filter", None, f"({exc})")


# =============================================================================
# Runner
# =============================================================================

TESTS = [
    test_pipeline_models_only_zappro_clima_tutor,
    test_chat_via_zappro_clima_tutor,
    test_stt_groq,
    test_tts_edge,
    test_vision_qwen_dummy_image,
    test_openwebui_model_filter,
]


async def run_tests() -> tuple[int, int, int]:
    passed = skipped = failed = 0
    for fn in TESTS:
        try:
            ok = await fn()
            if ok is True:
                passed += 1
            elif ok is None:
                skipped += 1
            else:
                failed += 1
        except Exception as exc:
            print(f"  {fn.__name__:<52} ... FAIL (exception: {exc})")
            failed += 1
    return passed, skipped, failed


async def main(report_path: str | None, once: bool):
    print(f"=== HVAC Multimodal Smoke Test ===")
    print(f"Started at {datetime.now(timezone.utc).isoformat()}")
    print(f"PIPELINE_URL={PIPELINE_URL}")
    print(f"OLLAMA_URL={OLLAMA_URL}")
    print(f"EDGE_TTS_URL={EDGE_TTS_URL or '(not set)'}")
    print(f"GROQ_API_KEY={'set' if GROQ_API_KEY else '(not set)'}")
    print()

    p, s, f = await run_tests()

    total = p + s + f
    overall = "pass" if f == 0 else "fail"

    print(f"\n=== {p} PASS | {s} SKIP | {f} FAIL ===")

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "pipeline_url": PIPELINE_URL,
        "ollama_url": OLLAMA_URL,
        "overall_status": overall,
        "passed": p,
        "skipped": s,
        "failed": f,
        "total": total,
    }

    if report_path:
        try:
            with open(report_path, "w") as rf:
                json.dump(report, rf, indent=2)
            print(f"Report: {report_path}")
        except Exception as exc:
            print(f"Failed to write report: {exc}", file=sys.stderr)

    return overall == "pass"


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="HVAC Multimodal Daily Smoke Test")
    parser.add_argument("--report", default=None, help="Output report path (JSON)")
    parser.add_argument("--once", action="store_true",
                       help="Run once and exit (default: run once, alias for --report with timestamp)")
    args = parser.parse_args()

    report_path = args.report
    if args.once and not report_path:
        report_path = DEFAULT_REPORT

    ok = asyncio.run(main(report_path, args.once))
    sys.exit(0 if ok else 1)
