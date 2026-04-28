#!/usr/bin/env python3
"""HVAC RAG Healthcheck — P1 hardened version with correct skip semantics."""
import os
import json
import http.server
import socketserver
import threading
from typing import Any

import requests

# ── Configuration ────────────────────────────────────────────────────────────
QDRANT_URL = os.environ.get("QDRANT_URL", "http://127.0.0.1:6333")
QDRANT_API_KEY = os.environ.get("QDRANT_API_KEY", "")
OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
LITELLM_URL = os.environ.get("LITELLM_URL", "http://127.0.0.1:4000")
RAG_PIPE_URL = os.environ.get("RAG_PIPE_URL", "http://127.0.0.1:4017")

REQUEST_TIMEOUT = 5

# ── Helpers ──────────────────────────────────────────────────────────────────
def http_get(url: str, headers: dict | None = None, timeout: int = REQUEST_TIMEOUT) -> tuple[bool, int, str]:
    """Returns (success, status_code, error_msg)."""
    try:
        r = requests.get(url, headers=headers or {}, timeout=timeout)
        return (r.status_code == 200, r.status_code, "")
    except requests.RequestException as e:
        return (False, 0, str(e))


def check_qdrant() -> dict[str, Any]:
    """
    Business rules:
      1. QDRANT_API_KEY absent AND QDRANT_AUTH_DISABLED != 'true'  → warn + skipped
      2. QDRANT_AUTH_DISABLED='true'  → pass (auth explicitly bypassed)
      3. QDRANT_API_KEY present → call with key; 200 = pass, else fail
    """
    auth_disabled = os.environ.get("QDRANT_AUTH_DISABLED", "").lower() == "true"

    if not QDRANT_API_KEY and not auth_disabled:
        return {
            "status": "warn",
            "skipped": True,
            "reason": "qdrant_api_key_not_set",
            "message": "QDRANT_API_KEY is not set and QDRANT_AUTH_DISABLED is not true",
        }

    headers = {"api-key": QDRANT_API_KEY} if QDRANT_API_KEY else {}
    ok, code, err = http_get(f"{QDRANT_URL}/collections", headers=headers)

    if ok:
        return {"status": "pass", "skipped": False, "http_status": code}
    return {
        "status": "fail",
        "skipped": False,
        "http_status": code,
        "message": f"Qdrant returned {code}" + (f": {err}" if err else ""),
    }


def check_ollama() -> dict[str, Any]:
    ok, code, err = http_get(f"{OLLAMA_URL}/api/tags")
    if ok:
        return {"status": "pass", "http_status": code}
    return {
        "status": "fail",
        "http_status": code,
        "message": f"Ollama returned {code}" + (f": {err}" if err else ""),
    }


def check_litellm() -> dict[str, Any]:
    ok, code, err = http_get(f"{LITELLM_URL}/health")
    if ok:
        return {"status": "pass", "http_status": code}
    return {
        "status": "fail",
        "http_status": code,
        "message": f"LiteLLM returned {code}" + (f": {err}" if err else ""),
    }


def check_rag_pipe() -> dict[str, Any]:
    ok, code, err = http_get(f"{RAG_PIPE_URL}/health")
    if ok:
        return {"status": "pass", "http_status": code}
    return {
        "status": "fail",
        "http_status": code,
        "message": f"RAG pipe returned {code}" + (f": {err}" if err else ""),
    }


def compute_overall(components: dict[str, dict]) -> str:
    """
    Overall 'pass' only when:
      - QDRANT_AUTH_DISABLED=true explicitly  OR
      - ALL critical components (qdrant, ollama, litellm, rag_pipe) pass
    """
    if os.environ.get("QDRANT_AUTH_DISABLED", "").lower() == "true":
        return "pass"

    critical = ["qdrant", "ollama", "litellm", "rag_pipe"]
    for name in critical:
        comp = components.get(name, {})
        if comp.get("skipped"):
            return "warn"
        if comp.get("status") != "pass":
            return "fail"

    return "pass"


def full_check() -> dict[str, Any]:
    components = {
        "qdrant":   check_qdrant(),
        "ollama":   check_ollama(),
        "litellm":  check_litellm(),
        "rag_pipe": check_rag_pipe(),
    }
    overall = compute_overall(components)
    return {"status": overall, "components": components}


# ── HTTP Server ───────────────────────────────────────────────────────────────
class HealthHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        pass  # silence request logging

    def send_json(self, payload: dict, status: int = 200):
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(payload).encode())

    def do_GET(self):
        if self.path == "/health" or self.path == "/health/":
            result = full_check()
            # /health → simple view
            self.send_json({
                "status": result["status"],
            })
        elif self.path == "/health/detailed":
            result = full_check()
            self.send_json(result)
        else:
            self.send_json({"error": "not found"}, 404)


def run_server(port: int = 8080):
    # SO_REUSEADDR avoids "Address already in use" on rapid restarts
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), HealthHandler) as srv:
        srv.serve_forever()


# ── Entry point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    port = int(os.environ.get("HVAC_HEALTHCHECK_PORT", "8080"))
    print(f"[hvac-healthcheck] Listening on :{port}  (/health  /health/detailed)")
    run_server(port)
