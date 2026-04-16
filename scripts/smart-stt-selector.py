#!/usr/bin/env python3
"""
Smart STT Provider Selector — VRAM-aware
SPEC-055-v2: GPU Maximizada + Intelligent Cloud Fallback

Selecciona STT provider baseado na VRAM livre da GPU:
- > 12 GB livre: whisper-medium-pt LOCAL (:8204)
- 8-12 GB livre: GROQ whisper-turbo (cloud)
- < 8 GB livre: Deepgram Nova-3 (cloud)
"""
import subprocess
import os
import sys

# Anti-hardcoded: all config via environment variables
LOCAL_STT_URL = os.getenv("STT_DIRECT_URL", "http://localhost:8204")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY", "")

# VRAM thresholds (GB)
THRESHOLD_LOCAL = 12  # > 12GB: local
THRESHOLD_GROQ = 8    # 8-12GB: GROQ cloud


def get_vram_free_gb() -> float:
    """Get free VRAM in GB using nvidia-smi."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.free", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if result.returncode != 0:
            return 0.0
        # Memory.free is in MiB
        mem_free_mib = int(result.stdout.strip().split("\n")[0])
        return mem_free_mib / 1024  # Convert MiB to GiB
    except (subprocess.TimeoutExpired, FileNotFoundError, ValueError, IndexError):
        return 0.0


def get_stt_provider() -> str:
    """
    Returns the appropriate STT provider based on VRAM.

    Returns:
        "local"   - whisper-medium-pt at :8204
        "groq"    - GROQ whisper-turbo cloud
        "deepgram" - Deepgram Nova-3 cloud
    """
    vram_free = get_vram_free_gb()

    if vram_free > THRESHOLD_LOCAL:
        return "local"
    elif vram_free > THRESHOLD_GROQ:
        return "groq"
    else:
        return "deepgram"


def get_stt_url(provider: str) -> str:
    """Get the actual STT endpoint URL for the selected provider."""
    if provider == "local":
        return LOCAL_STT_URL
    elif provider == "groq":
        return "https://api.groq.com/v1/audio/transcriptions"
    elif provider == "deepgram":
        return "https://api.deepgram.com/v1/listen"
    else:
        return LOCAL_STT_URL  # Default to local


def main():
    provider = get_stt_provider()
    url = get_stt_url(provider)
    vram_free = get_vram_free_gb()

    # Output for shell scripts / environment
    print(f"STT_PROVIDER={provider}")
    print(f"STT_URL={url}")
    print(f"VRAM_FREE_GB={vram_free:.1f}")

    # Also output JSON for programmatic use
    import json
    result = {
        "provider": provider,
        "url": url,
        "vram_free_gb": round(vram_free, 1),
        "threshold_local_gb": THRESHOLD_LOCAL,
        "threshold_groq_gb": THRESHOLD_GROQ,
    }
    print(f"STT_CONFIG_JSON={json.dumps(result)}")


if __name__ == "__main__":
    main()
