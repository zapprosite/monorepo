#!/usr/bin/env python3
"""
HVAC RAG Healthcheck — Periodic pipe health verification

Checks:
  - OpenWebUI (chat.zappro.site/:3456)
  - zappro-clima-tutor (:4017) /health + /v1/models
  - LiteLLM (:4000 / api.zappro.site) — MiniMax model alias
  - Groq STT (api.groq.com /v1/audio/transcriptions)
  - Edge TTS (:8012 / TTS_BRIDGE_URL)
  - Ollama qwen2.5vl (:11434) — list models
  - Qdrant collection count
  - Juiz validation (synthetic query)
  - Sample query: field-tutor
  - Sample query: printable
  - Memory context (Mem0, Postgres, Qdrant)

Output: JSON report to stdout, errors to stderr
No raw query logs. Uses hashes for query identification.
Secrets are never printed — use test -n pattern for verification.
"""

import asyncio
import hashlib
import json
import sys
import os
import importlib.util
from datetime import datetime, timezone
from typing import Optional

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
QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
LITELLM_URL = os.environ.get("LITELLM_URL", "http://127.0.0.1:4000")
OPENWEBUI_URL = os.environ.get("OPENWEBUI_URL", "http://127.0.0.1:3456")
TTS_BRIDGE_URL = os.environ.get("TTS_BRIDGE_URL", "http://127.0.0.1:8012")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
COLLECTION_NAME = "hvac_manuals_v1"
REPORT_PATH = os.environ.get("HVAC_HEALTHCHECK_REPORT", "/tmp/hvac-healthcheck.json")

# =============================================================================
# Import Juiz (pure regex, no network)
# =============================================================================
def import_local_module(name: str, filename: str):
    spec = importlib.util.spec_from_file_location(name, os.path.join(os.path.dirname(__file__), filename))
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod

_juez_mod = import_local_module("hvac_juiz", "hvac_juiz.py")
judge = _juez_mod.judge

# Memory context health check
_mem_ctx_mod = import_local_module("hvac_memory_context", "hvac_memory_context.py")
memory_health_summary = _mem_ctx_mod.memory_health_summary

# Web search provider health check
_web_mod = import_local_module("hvac_web_search", "hvac_web_search.py")
web_search_health = _web_mod.web_search_health

# =============================================================================
# HTTP Client
# =============================================================================
import httpx

# =============================================================================
# Helpers
# =============================================================================

def safe_query_hash(query: str) -> str:
    """Return SHA256 prefix (8 chars) of query for logging."""
    return hashlib.sha256(query.encode()).hexdigest()[:8]


def qdrant_headers() -> dict:
    return {"Authorization": f"Bearer {QDRANT_API_KEY}", "Content-Type": "application/json"}


def litellm_models_url() -> str:
    base = LITELLM_URL.rstrip("/")
    if base.endswith("/v1"):
        return f"{base}/models"
    return f"{base}/v1/models"


async def check_health_endpoint() -> dict:
    """Check /health endpoint."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{PIPELINE_URL}/health")
            if r.status_code == 200:
                return {"status": "pass", "endpoint": "/health", "latency_ms": r.elapsed.total_seconds() * 1000}
            return {"status": "fail", "endpoint": "/health", "error": f"HTTP {r.status_code}"}
    except httpx.ConnectError:
        return {"status": "fail", "endpoint": "/health", "error": "connection refused"}
    except Exception as e:
        return {"status": "fail", "endpoint": "/health", "error": str(e)}
    return {"status": "fail", "endpoint": "/health", "error": "unknown"}


async def check_models_endpoint() -> dict:
    """Check /v1/models endpoint."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{PIPELINE_URL}/v1/models")
            if r.status_code == 200:
                data = r.json()
                models = data.get("data", [])
                return {
                    "status": "pass",
                    "endpoint": "/v1/models",
                    "latency_ms": r.elapsed.total_seconds() * 1000,
                    "models_available": len(models)
                }
            return {"status": "fail", "endpoint": "/v1/models", "error": f"HTTP {r.status_code}"}
    except httpx.ConnectError:
        return {"status": "fail", "endpoint": "/v1/models", "error": "connection refused"}
    except Exception as e:
        return {"status": "fail", "endpoint": "/v1/models", "error": str(e)}
    return {"status": "fail", "endpoint": "/v1/models", "error": "unknown"}


async def check_juiz_validation() -> dict:
    """Check Juiz with synthetic HVAC query (no network, pure regex)."""
    test_query = "RYYQ48BRA error code E6 compressor"
    q_hash = safe_query_hash(test_query)
    try:
        result, meta = judge(test_query)
        return {
            "status": "pass" if result.value in ("APPROVED", "BLOCKED") else "fail",
            "test_query_hash": q_hash,
            "juiz_result": result.value,
            "reason": meta.get("reason", ""),
            "latency_ms": meta.get("latency_ms", 0)
        }
    except Exception as e:
        return {"status": "fail", "test_query_hash": q_hash, "error": str(e)}


async def check_qdrant_collection() -> dict:
    """Check Qdrant collection exists and has points."""
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(
                f"{QDRANT_URL}/collections/{COLLECTION_NAME}",
                headers=qdrant_headers()
            )
            if r.status_code == 200:
                data = r.json()
                points_count = data.get("result", {}).get("points_count", 0)
                return {
                    "status": "pass",
                    "collection": COLLECTION_NAME,
                    "points_count": points_count,
                    "latency_ms": r.elapsed.total_seconds() * 1000
                }
            return {"status": "fail", "collection": COLLECTION_NAME, "error": f"HTTP {r.status_code}"}
    except httpx.ConnectError:
        return {"status": "fail", "collection": COLLECTION_NAME, "error": "connection refused"}
    except Exception as e:
        return {"status": "fail", "collection": COLLECTION_NAME, "error": str(e)}
    return {"status": "fail", "collection": COLLECTION_NAME, "error": "unknown"}


async def check_field_tutor_endpoint() -> dict:
    """Sample query to /v1/chat/completions/field-tutor."""
    test_query = "RYYQ48BRA error E6 inverter"
    q_hash = safe_query_hash(test_query)
    payload = {
        "model": "zappro-clima-tutor",
        "messages": [{"role": "user", "content": test_query}],
        "temperature": 0.3,
        "max_tokens": 256
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{PIPELINE_URL}/v1/chat/completions/field-tutor",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            latency = r.elapsed.total_seconds() * 1000
            if r.status_code == 200:
                data = r.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                fallback = data.get("fallback", False)
                return {
                    "status": "pass",
                    "endpoint": "/v1/chat/completions/field-tutor",
                    "query_hash": q_hash,
                    "latency_ms": latency,
                    "response_chars": len(content),
                    "fallback_used": fallback
                }
            return {
                "status": "fail",
                "endpoint": "/v1/chat/completions/field-tutor",
                "query_hash": q_hash,
                "latency_ms": latency,
                "error": f"HTTP {r.status_code}"
            }
    except httpx.ConnectError:
        return {"status": "fail", "endpoint": "/v1/chat/completions/field-tutor", "query_hash": q_hash, "error": "connection refused"}
    except httpx.TimeoutException:
        return {"status": "fail", "endpoint": "/v1/chat/completions/field-tutor", "query_hash": q_hash, "error": "timeout"}
    except Exception as e:
        return {"status": "fail", "endpoint": "/v1/chat/completions/field-tutor", "query_hash": q_hash, "error": str(e)}


async def check_printable_endpoint() -> dict:
    """Sample query to /v1/chat/completions/printable."""
    test_query = "RXYQ20BRA maintenance procedure"
    q_hash = safe_query_hash(test_query)
    payload = {
        "model": "zappro-clima-tutor",
        "messages": [{"role": "user", "content": test_query}],
        "temperature": 0.3,
        "max_tokens": 256
    }
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{PIPELINE_URL}/v1/chat/completions/printable",
                json=payload,
                headers={"Content-Type": "application/json"}
            )
            latency = r.elapsed.total_seconds() * 1000
            if r.status_code == 200:
                data = r.json()
                content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
                fallback = data.get("fallback", False)
                return {
                    "status": "pass",
                    "endpoint": "/v1/chat/completions/printable",
                    "query_hash": q_hash,
                    "latency_ms": latency,
                    "response_chars": len(content),
                    "fallback_used": fallback
                }
            return {
                "status": "fail",
                "endpoint": "/v1/chat/completions/printable",
                "query_hash": q_hash,
                "latency_ms": latency,
                "error": f"HTTP {r.status_code}"
            }
    except httpx.ConnectError:
        return {"status": "fail", "endpoint": "/v1/chat/completions/printable", "query_hash": q_hash, "error": "connection refused"}
    except httpx.TimeoutException:
        return {"status": "fail", "endpoint": "/v1/chat/completions/printable", "query_hash": q_hash, "error": "timeout"}
    except Exception as e:
        return {"status": "fail", "endpoint": "/v1/chat/completions/printable", "query_hash": q_hash, "error": str(e)}


async def check_memory_context() -> dict:
    """Check memory context services (Mem0, Postgres, Qdrant memory layer)."""
    try:
        result = await memory_health_summary()
        all_ok = all(v.get("status") == "ok" for v in result.get("services", {}).values())
        return {
            "status": "pass" if all_ok else "degraded",
            "endpoint": "/memory/health",
            "services": result.get("services", {}),
            "overall": result.get("overall", "unknown"),
        }
    except Exception as e:
        return {"status": "fail", "endpoint": "/memory/health", "error": str(e)}


async def check_web_search_provider() -> dict:
    """Check Tavily MCP search configuration and fallback availability."""
    try:
        return await web_search_health()
    except Exception as e:
        return {"status": "degraded", "service": "web_search", "provider": "tavily_mcp", "error": str(e)}


async def check_openwebui() -> dict:
    """Check OpenWebUI availability."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{OPENWEBUI_URL}/health")
            if r.status_code == 200:
                return {
                    "status": "pass",
                    "service": "openwebui",
                    "url": OPENWEBUI_URL,
                    "latency_ms": r.elapsed.total_seconds() * 1000
                }
            return {
                "status": "fail",
                "service": "openwebui",
                "url": OPENWEBUI_URL,
                "error": f"HTTP {r.status_code}"
            }
    except httpx.ConnectError:
        return {"status": "fail", "service": "openwebui", "url": OPENWEBUI_URL, "error": "connection refused"}
    except Exception as e:
        return {"status": "fail", "service": "openwebui", "url": OPENWEBUI_URL, "error": str(e)}


async def check_litellm_models() -> dict:
    """Check LiteLLM /v1/models for MiniMax availability."""
    litellm_key = os.environ.get("LITELLM_MASTER_KEY", "")
    headers = {"Authorization": f"Bearer {litellm_key}"} if litellm_key else {}
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(litellm_models_url(), headers=headers)
            if r.status_code == 200:
                data = r.json()
                models = data.get("data", [])
                model_ids = [m.get("id", "") for m in models]
                # Check for MiniMax model
                minimax_found = any("minimax" in mid.lower() or "mm" in mid.lower() for mid in model_ids)
                return {
                    "status": "pass",
                    "service": "litellm",
                    "url": LITELLM_URL,
                    "models_available": len(models),
                    "minimax_available": minimax_found,
                    "latency_ms": r.elapsed.total_seconds() * 1000
                }
            return {
                "status": "fail",
                "service": "litellm",
                "url": LITELLM_URL,
                "error": f"HTTP {r.status_code}"
            }
    except httpx.ConnectError:
        return {"status": "fail", "service": "litellm", "url": LITELLM_URL, "error": "connection refused"}
    except Exception as e:
        return {"status": "fail", "service": "litellm", "url": LITELLM_URL, "error": str(e)}


async def check_groq_stt() -> dict:
    """Check Groq STT endpoint (api.groq.com openai-compatible)."""
    # Verify Groq API key exists without exposing it
    groq_configured = bool(GROQ_API_KEY)
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            # Groq /v1/models endpoint for STT models
            r = await client.get(
                "https://api.groq.com/openai/v1/models",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"}
            )
            if r.status_code == 200:
                data = r.json()
                models = data.get("data", [])
                stt_models = [m.get("id", "") for m in models if "whisper" in m.get("id", "").lower()]
                return {
                    "status": "pass",
                    "service": "groq_stt",
                    "url": "api.groq.com",
                    "groq_configured": groq_configured,
                    "stt_models": stt_models,
                    "latency_ms": r.elapsed.total_seconds() * 1000
                }
            return {
                "status": "fail",
                "service": "groq_stt",
                "url": "api.groq.com",
                "groq_configured": groq_configured,
                "error": f"HTTP {r.status_code}"
            }
    except httpx.ConnectError:
        return {"status": "fail", "service": "groq_stt", "url": "api.groq.com", "error": "connection refused"}
    except Exception as e:
        return {"status": "fail", "service": "groq_stt", "url": "api.groq.com", "error": str(e)}


async def check_edge_tts() -> dict:
    """Check Edge TTS bridge."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{TTS_BRIDGE_URL}/health")
            if r.status_code == 200:
                return {
                    "status": "pass",
                    "service": "edge_tts",
                    "url": TTS_BRIDGE_URL,
                    "latency_ms": r.elapsed.total_seconds() * 1000
                }
            return {
                "status": "fail",
                "service": "edge_tts",
                "url": TTS_BRIDGE_URL,
                "error": f"HTTP {r.status_code}"
            }
    except httpx.ConnectError:
        return {"status": "fail", "service": "edge_tts", "url": TTS_BRIDGE_URL, "error": "connection refused"}
    except Exception as e:
        return {"status": "fail", "service": "edge_tts", "url": TTS_BRIDGE_URL, "error": str(e)}


async def check_ollama_models() -> dict:
    """Check Ollama for qwen2.5vl model availability."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            if r.status_code == 200:
                data = r.json()
                models = data.get("models", [])
                model_names = [m.get("name", "") for m in models]
                qwen_found = any("qwen2.5vl" in name for name in model_names)
                return {
                    "status": "pass",
                    "service": "ollama",
                    "url": OLLAMA_URL,
                    "models_count": len(models),
                    "qwen2.5vl_available": qwen_found,
                    "model_names": model_names[:5],  # First 5 only
                    "latency_ms": r.elapsed.total_seconds() * 1000
                }
            return {
                "status": "fail",
                "service": "ollama",
                "url": OLLAMA_URL,
                "error": f"HTTP {r.status_code}"
            }
    except httpx.ConnectError:
        return {"status": "fail", "service": "ollama", "url": OLLAMA_URL, "error": "connection refused"}
    except Exception as e:
        return {"status": "fail", "service": "ollama", "url": OLLAMA_URL, "error": str(e)}


# =============================================================================
# Main
# =============================================================================

async def run_healthcheck() -> dict:
    """Run all healthcheck probes and return report."""
    checks = await asyncio.gather(
        check_health_endpoint(),
        check_models_endpoint(),
        check_juiz_validation(),
        check_qdrant_collection(),
        check_field_tutor_endpoint(),
        check_printable_endpoint(),
        check_memory_context(),
        check_web_search_provider(),
        check_openwebui(),
        check_litellm_models(),
        check_groq_stt(),
        check_edge_tts(),
        check_ollama_models(),
        return_exceptions=True
    )

    results = []
    for i, check in enumerate(checks):
        if isinstance(check, Exception):
            results.append({"status": "fail", "error": str(check)})
        else:
            results.append(check)

    total = len(results)
    passed = sum(1 for r in results if r.get("status") in ("pass", "degraded"))

    report = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "overall_status": "pass" if passed == total else "fail",
        "checks_passed": passed,
        "checks_total": total,
        "checks": results
    }

    # Write report
    try:
        with open(REPORT_PATH, "w") as f:
            json.dump(report, f, indent=2)
    except Exception:
        pass

    return report


def main():
    report = asyncio.run(run_healthcheck())

    # Output to stderr for verbose mode
    print(json.dumps(report, indent=2))

    # Exit code: 0 if all pass, 1 if any fail
    sys.exit(0 if report["overall_status"] == "pass" else 1)


if __name__ == "__main__":
    main()
