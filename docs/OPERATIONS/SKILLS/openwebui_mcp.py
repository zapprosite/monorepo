#!/usr/bin/env python3
"""
OpenWebUI MCP Server
====================
Wraps OpenWebUI REST API as an MCP server using HTTP/SSE.

Uses Python stdlib only: http.server, json, urllib.request

Usage:
    python3 openwebui_mcp.py

Environment variables:
    PORT            - MCP server port (default: 8090)
    WEBUI_BASE_URL  - OpenWebUI base URL (default: http://localhost:8080)
    WEBUI_SECRET_KEY - Bearer token for auth (or sign-in below)
    WEBUI_EMAIL     - Email for sign-in auth
    WEBUI_PASSWORD  - Password for sign-in auth
"""

import os
import sys
import json
import time
import threading
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from typing import Optional, Dict, Any, List

# =============================================================================
# Configuration
# =============================================================================

PORT = int(os.environ.get("PORT", 8090))
WEBUI_BASE_URL = os.environ.get("WEBUI_BASE_URL", "http://localhost:8080")
WEBUI_SECRET_KEY = os.environ.get("WEBUI_SECRET_KEY", "")
WEBUI_EMAIL = os.environ.get("WEBUI_EMAIL", "")
WEBUI_PASSWORD = os.environ.get("WEBUI_PASSWORD", "")

# =============================================================================
# Auth
# =============================================================================

_cached_token: Optional[str] = None
_token_lock = threading.Lock()


def get_auth_token() -> str:
    """Get JWT token from cache, WEBUI_SECRET_KEY, or sign-in."""
    global _cached_token

    if WEBUI_SECRET_KEY:
        return WEBUI_SECRET_KEY

    with _token_lock:
        if _cached_token:
            return _cached_token

        if WEBUI_EMAIL and WEBUI_PASSWORD:
            token = _sign_in()
            _cached_token = token
            return token

        raise Exception(
            "Auth required: set WEBUI_SECRET_KEY or WEBUI_EMAIL+WEBUI_PASSWORD"
        )


def _sign_in() -> str:
    """Sign in to OpenWebUI and get JWT token."""
    req = urllib.request.Request(
        f"{WEBUI_BASE_URL}/api/v1/auths/signin",
        data=json.dumps({
            "email": WEBUI_EMAIL,
            "password": WEBUI_PASSWORD
        }).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            token = data.get("token", "")
            if not token:
                raise Exception("No token in sign-in response")
            return token
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise Exception(f"Sign-in failed ({e.code}): {body}")


# =============================================================================
# OpenWebUI API
# =============================================================================

def api_request(
    path: str,
    method: str = "GET",
    data: Optional[Dict[str, Any]] = None,
    token: Optional[str] = None,
    timeout: int = 30
) -> Dict[str, Any]:
    """Make request to OpenWebUI API."""
    if token is None:
        token = get_auth_token()

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }
    if data is not None:
        headers["Content-Type"] = "application/json"

    body = json.dumps(data).encode() if data else None
    url = f"{WEBUI_BASE_URL}{path}"

    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read()
            if not content:
                return {}
            return json.loads(content)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise Exception(f"API request failed ({e.code}): {body}")


def api_request_stream(
    path: str,
    method: str = "POST",
    data: Optional[Dict[str, Any]] = None,
    token: Optional[str] = None
) -> str:
    """Make streaming request to OpenWebUI API, return combined text."""
    if token is None:
        token = get_auth_token()

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "text/event-stream"
    }
    if data is not None:
        headers["Content-Type"] = "application/json"

    body = json.dumps(data).encode() if data else None
    url = f"{WEBUI_BASE_URL}{path}"

    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            chunks = []
            for line in resp:
                line = line.decode("utf-8")
                if line.startswith("data:"):
                    payload = line[5:].strip()
                    if payload == "[DONE]":
                        break
                    try:
                        parsed = json.loads(payload)
                        delta = parsed.get("choices", [{}])[0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            chunks.append(content)
                    except json.JSONDecodeError:
                        pass
            return "".join(chunks)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise Exception(f"API streaming request failed ({e.code}): {body}")


# =============================================================================
# MCP Tools
# =============================================================================

def list_models() -> Dict[str, Any]:
    """List available models from OpenWebUI."""
    result = api_request("/api/v1/models")
    models = result.get("data", result.get("models", []))
    return {
        "models": [
            {
                "id": m.get("id", m.get("name", "")),
                "name": m.get("name", ""),
                "owned_by": m.get("owned_by", ""),
            }
            for m in models
        ]
    }


def chat(model: str, message: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    """Send chat message and return the assistant's response."""
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": message}]
    }
    if session_id:
        payload["session_id"] = session_id

    # Streaming chat for better UX
    reply = api_request_stream("/api/v1/chat/completions", method="POST", data=payload)

    return {
        "model": model,
        "content": reply,
        "role": "assistant"
    }


def get_users() -> Dict[str, Any]:
    """List users from OpenWebUI."""
    result = api_request("/api/v1/users")
    users = result.get("data", result.get("users", []))
    return {
        "users": [
            {
                "id": u.get("id", ""),
                "name": u.get("name", ""),
                "email": u.get("email", ""),
                "role": u.get("role", ""),
            }
            for u in users
        ]
    }


def transcribe_audio(audio_data: str, model: str = "whisper") -> Dict[str, Any]:
    """Transcribe audio data (base64 encoded audio file)."""
    import base64

    # audio_data can be a file path or base64 data
    # If it's a file path, read the file
    if os.path.isfile(audio_data):
        with open(audio_data, "rb") as f:
            audio_bytes = f.read()
        audio_b64 = base64.b64encode(audio_bytes).decode()
    else:
        audio_b64 = audio_data

    payload = {
        "model": model,
        "audio": audio_b64
    }

    try:
        result = api_request("/api/v1/audio/transcriptions", method="POST", data=payload, timeout=60)
        return {"text": result.get("text", result.get("content", ""))}
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise Exception(f"Transcription failed ({e.code}): {body}")


# =============================================================================
# MCP Protocol Helpers
# =============================================================================

def build_json_response(result: Dict[str, Any], error: Optional[str] = None) -> Dict[str, Any]:
    """Build a JSON-RPC-compatible response."""
    if error:
        return {
            "jsonrpc": "2.0",
            "error": {"code": -32600, "message": error}
        }
    return {
        "jsonrpc": "2.0",
        "result": result
    }


def sse_event(event_type: str, data: Dict[str, Any]) -> bytes:
    """Format data as SSE event."""
    content = json.dumps(data)
    return f"event: {event_type}\ndata: {content}\n\n".encode("utf-8")


# =============================================================================
# MCP HTTP Handler
# =============================================================================

_sessions: Dict[str, Dict[str, Any]] = {}
_sessions_lock = threading.Lock()


class MCPHandler(BaseHTTPRequestHandler):

    def log_message(self, format, *args):
        """Suppress default logging."""
        pass

    def send_json(self, obj: Dict[str, Any], status: int = 200):
        """Send JSON response."""
        body = json.dumps(obj).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(body)

    def send_sse(self, data: bytes):
        """Send SSE data."""
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "keep-alive")
        self.send_header("Transfer-Encoding", "chunked")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        """Handle GET requests."""
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/health":
            self.send_json({"status": "ok", "service": "openwebui-mcp"})
            return

        if path == "/sse":
            # SSE endpoint for streaming - send initial connection event
            self.send_sse(sse_event("message", {"type": "connected"}))
            return

        self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        """Handle POST requests (MCP tool invocations)."""
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/mcp":
            self.handle_mcp()
            return

        self.send_json({"error": "Not found"}, 404)

    def handle_mcp(self):
        """Handle MCP RPC calls."""
        try:
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length) if content_length > 0 else b"{}"
            request = json.loads(body.decode("utf-8"))
        except (json.JSONDecodeError, ValueError) as e:
            self.send_json(build_json_response({}, f"Invalid JSON: {e}"), 400)
            return

        method = request.get("method", "")
        params = request.get("params", {})
        req_id = request.get("id")

        try:
            result = self._dispatch_method(method, params)
            response = build_json_response(result)
        except Exception as e:
            response = build_json_response({}, str(e))

        if req_id is not None:
            response["id"] = req_id

        self.send_json(response)

    def _dispatch_method(self, method: str, params: Dict[str, Any]) -> Any:
        """Dispatch MCP method to handler."""
        if method == "tools/list":
            return {
                "tools": [
                    {
                        "name": "list_models",
                        "description": "List available models from OpenWebUI",
                        "inputSchema": {
                            "type": "object",
                            "properties": {}
                        }
                    },
                    {
                        "name": "chat",
                        "description": "Send a chat message and get a response",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "model": {
                                    "type": "string",
                                    "description": "Model ID to use"
                                },
                                "message": {
                                    "type": "string",
                                    "description": "Message content"
                                },
                                "session_id": {
                                    "type": "string",
                                    "description": "Optional session ID for conversation continuity"
                                }
                            },
                            "required": ["model", "message"]
                        }
                    },
                    {
                        "name": "get_users",
                        "description": "List users from OpenWebUI",
                        "inputSchema": {
                            "type": "object",
                            "properties": {}
                        }
                    },
                    {
                        "name": "transcribe_audio",
                        "description": "Transcribe audio data to text",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "audio_data": {
                                    "type": "string",
                                    "description": "Base64 encoded audio data or path to audio file"
                                },
                                "model": {
                                    "type": "string",
                                    "description": "Transcription model (default: whisper)"
                                }
                            },
                            "required": ["audio_data"]
                        }
                    }
                ]
            }

        elif method == "tools/call":
            tool_name = params.get("name", "")
            arguments = params.get("arguments", {})

            if tool_name == "list_models":
                return list_models()
            elif tool_name == "chat":
                return chat(
                    model=arguments.get("model", ""),
                    message=arguments.get("message", ""),
                    session_id=arguments.get("session_id")
                )
            elif tool_name == "get_users":
                return get_users()
            elif tool_name == "transcribe_audio":
                return transcribe_audio(
                    audio_data=arguments.get("audio_data", ""),
                    model=arguments.get("model", "whisper")
                )
            else:
                raise Exception(f"Unknown tool: {tool_name}")

        elif method == "initialize":
            return {
                "protocolVersion": "2024-11-05",
                "serverInfo": {
                    "name": "openwebui-mcp",
                    "version": "1.0.0"
                },
                "capabilities": {
                    "tools": {}
                }
            }

        elif method == "ping":
            return {"status": "pong"}

        else:
            raise Exception(f"Unknown method: {method}")


# =============================================================================
# Main
# =============================================================================

def main():
    server = HTTPServer(("0.0.0.0", PORT), MCPHandler)
    print(f"OpenWebUI MCP Server running on port {PORT}", file=sys.stderr)
    print(f"OpenWebUI base URL: {WEBUI_BASE_URL}", file=sys.stderr)
    print(f"Endpoints:", file=sys.stderr)
    print(f"  GET  /health  - Health check", file=sys.stderr)
    print(f"  POST /mcp     - MCP RPC", file=sys.stderr)
    print(f"  GET  /sse     - SSE stream", file=sys.stderr)
    print(f"Tools: list_models, chat, get_users, transcribe_audio", file=sys.stderr)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...", file=sys.stderr)
        server.shutdown()
        sys.exit(0)


if __name__ == "__main__":
    main()
