#!/usr/bin/env python3
"""
HVAC RAG Healthcheck — Periodic pipe health verification

Checks:
  - /health endpoint
  - /v1/models endpoint
  - Juiz validation (synthetic query)
  - Qdrant collection count
  - Sample query: field-tutor
  - Sample query: printable

Output: JSON report to stdout, errors to stderr
No raw query logs. Uses hashes for query identification.
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
# Configuration
# =============================================================================
PIPELINE_URL = os.environ.get("HVAC_PIPELINE_URL", "http://127.0.0.1:4017")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
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

_juez_mod = import_local_module("hvac_juiz", "hvac-juiz.py")
juiz = _juez_mod.judge

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
    headers = {"Content-Type": "application/json"}
    if QDRANT_API_KEY:
        headers["Authorization"] = f"Bearer {QDRANT_API_KEY}"
    return headers


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
        result, meta = juiz(test_query)
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
    if not QDRANT_API_KEY:
        return {
            "status": "pass",
            "collection": COLLECTION_NAME,
            "skipped": True,
            "reason": "qdrant_api_key_not_set_in_process_env"
        }
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
        "model": "hvac-manual-strict",
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
        "model": "hvac-manual-strict",
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
        return_exceptions=True
    )

    results = []
    for i, check in enumerate(checks):
        if isinstance(check, Exception):
            results.append({"status": "fail", "error": str(check)})
        else:
            results.append(check)

    total = len(results)
    passed = sum(1 for r in results if r.get("status") == "pass")

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
