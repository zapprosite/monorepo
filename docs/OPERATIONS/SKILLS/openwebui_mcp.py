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
            content_str = content.decode("utf-8")
            if "<html" in content_str.lower() and content_str.lstrip().startswith("<"):
                raise Exception(f"Endpoint {path} returned HTML (auth required or endpoint disabled)")
            return json.loads(content_str)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise Exception(f"API request failed ({e.code}): {body}")


def api_request_raw(
    path: str,
    method: str = "GET",
    data: Optional[Dict[str, Any]] = None,
    token: Optional[str] = None,
    timeout: int = 30
) -> urllib.request.Request:
    """Make raw request to OpenWebUI API, return Request object for multipart."""
    if token is None:
        token = get_auth_token()

    headers = {"Authorization": f"Bearer {token}"}
    body = json.dumps(data).encode() if data else None
    url = f"{WEBUI_BASE_URL}{path}"

    return urllib.request.Request(url, data=body, headers=headers, method=method)


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
            raw_body = resp.read().decode("utf-8")

            # Try SSE parsing first (lines starting with "data:")
            sse_lines = [line[5:].strip() for line in raw_body.split("\n") if line.startswith("data:")]
            if sse_lines and sse_lines[0] != "[DONE]":
                for payload in sse_lines:
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
            else:
                # Fallback: parse entire response as JSON (non-streaming)
                try:
                    parsed = json.loads(raw_body)
                    msg = parsed.get("choices", [{}])[0].get("message", {})
                    content = msg.get("content", "")
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


def get_model(model_id: str) -> Dict[str, Any]:
    """Get details of a specific model."""
    return api_request(f"/api/v1/models/{model_id}")


def chat(model: str, message: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    """Send chat message and return the assistant's response."""
    payload = {
        "model": model,
        "messages": [{"role": "user", "content": message}]
    }
    if session_id:
        payload["session_id"] = session_id

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


def get_user(user_id: str) -> Dict[str, Any]:
    """Get a specific user by ID."""
    return api_request(f"/api/v1/users/{user_id}")


def transcribe_audio(audio_data: str, model: str = "whisper") -> Dict[str, Any]:
    """Transcribe audio data (base64 encoded audio file)."""
    import base64

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


def _check_html_result(result: Any, endpoint: str) -> Any:
    """Check if result is HTML (OpenWebUI returning login page for restricted endpoints)."""
    if isinstance(result, str) and "<html" in result.lower():
        raise Exception(f"Endpoint {endpoint} returned HTML — admin access may be required")
    return result


def list_chats() -> Dict[str, Any]:
    """List all chat conversations."""
    result = api_request("/api/v1/chats")
    chats = result if isinstance(result, list) else result.get("data", result.get("chats", []))
    return {
        "chats": [
            {
                "id": c.get("id", ""),
                "title": c.get("title", ""),
                "updated_at": c.get("updated_at", ""),
            }
            for c in chats
        ]
    }


def get_chat(chat_id: str) -> Dict[str, Any]:
    """Get a specific chat with full message history."""
    return api_request(f"/api/v1/chats/{chat_id}")


def get_config() -> Dict[str, Any]:
    """Get OpenWebUI server configuration."""
    result = api_request("/api/v1/config")
    # /api/v1/config may return HTML login page if not admin - return raw result
    if isinstance(result, dict) and "<html" in str(result).lower():
        return {"error": "Config endpoint not accessible (admin required)", "config": result}
    return result


def list_collections() -> Dict[str, Any]:
    """List knowledge collections."""
    result = api_request("/api/v1/collections")
    collections = result if isinstance(result, list) else result.get("data", result.get("collections", []))
    return {"collections": collections}


def create_collection(name: str, description: str = "") -> Dict[str, Any]:
    """Create a new knowledge collection."""
    payload = {"name": name}
    if description:
        payload["description"] = description
    return api_request("/api/v1/collections", method="POST", data=payload)


def list_files() -> Dict[str, Any]:
    """List all uploaded files."""
    result = api_request("/api/v1/files/")
    files = result if isinstance(result, list) else result.get("data", result.get("files", []))
    return {
        "files": [
            {
                "id": f.get("id", ""),
                "filename": f.get("filename", ""),
                "size": f.get("size", 0),
                "created_at": f.get("created_at", ""),
            }
            for f in files
        ]
    }


def upload_file(file_path: str, name: str = "") -> Dict[str, Any]:
    """Upload a file to OpenWebUI."""
    import base64

    if not os.path.isfile(file_path):
        raise Exception(f"File not found: {file_path}")

    with open(file_path, "rb") as f:
        file_data = f.read()
    file_b64 = base64.b64encode(file_data).decode()

    filename = name or os.path.basename(file_path)
    payload = {
        "filename": filename,
        "data": file_b64,
    }

    return api_request("/api/v1/files/", method="POST", data=payload)


def get_file(file_id: str) -> Dict[str, Any]:
    """Get file info/content by ID."""
    return api_request(f"/api/v1/files/{file_id}")


def get_analytics_summary() -> Dict[str, Any]:
    """Get analytics summary."""
    return api_request("/api/v1/analytics/summary")


def get_analytics_models() -> Dict[str, Any]:
    """Get per-model usage analytics."""
    return api_request("/api/v1/analytics/models")


def get_analytics_users() -> Dict[str, Any]:
    """Get per-user usage analytics."""
    return api_request("/api/v1/analytics/users")


def share_chat(chat_id: str) -> Dict[str, Any]:
    """Share a chat publicly."""
    return api_request(f"/api/v1/chats/{chat_id}/share", method="POST", data={})


def openclaw_bridge_chat(message: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    """Chat with OpenClaw via bridge agent - CEO MIX style responses."""
    BRIDGE_URL = "http://localhost:3335/mcp"

    payload = {
        "jsonrpc": "2.0",
        "method": "tools/call",
        "params": {
            "name": "bridge_chat",
            "arguments": {
                "message": message,
                **( {"session_id": session_id} if session_id else {} )
            }
        },
        "id": 1
    }

    req = urllib.request.Request(
        BRIDGE_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            if "result" in result:
                return result["result"]
            if "error" in result:
                raise Exception(f"Bridge error: {result['error']}")
            return result
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise Exception(f"Bridge request failed ({e.code}): {body}")


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
                    # Models
                    {
                        "name": "list_models",
                        "description": "List available models from OpenWebUI",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "get_model",
                        "description": "Get details of a specific model by ID",
                        "inputSchema": {
                            "type": "object",
                            "properties": {"model_id": {"type": "string", "description": "Model ID"}},
                            "required": ["model_id"]
                        }
                    },
                    # Chat
                    {
                        "name": "chat",
                        "description": "Send a chat message and get a response",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "model": {"type": "string", "description": "Model ID to use"},
                                "message": {"type": "string", "description": "Message content"},
                                "session_id": {"type": "string", "description": "Optional session ID for conversation continuity"}
                            },
                            "required": ["model", "message"]
                        }
                    },
                    # Chat History
                    {
                        "name": "list_chats",
                        "description": "List all chat conversations",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "get_chat",
                        "description": "Get a specific chat with full message history",
                        "inputSchema": {
                            "type": "object",
                            "properties": {"chat_id": {"type": "string", "description": "Chat ID"}},
                            "required": ["chat_id"]
                        }
                    },
                    {
                        "name": "share_chat",
                        "description": "Share a chat publicly",
                        "inputSchema": {
                            "type": "object",
                            "properties": {"chat_id": {"type": "string", "description": "Chat ID to share"}},
                            "required": ["chat_id"]
                        }
                    },
                    # Users
                    {
                        "name": "get_users",
                        "description": "List all users from OpenWebUI",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "get_user",
                        "description": "Get a specific user by ID",
                        "inputSchema": {
                            "type": "object",
                            "properties": {"user_id": {"type": "string", "description": "User ID"}},
                            "required": ["user_id"]
                        }
                    },
                    # Files
                    {
                        "name": "list_files",
                        "description": "List all uploaded files",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "upload_file",
                        "description": "Upload a file to OpenWebUI",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "file_path": {"type": "string", "description": "Path to the file to upload"},
                                "name": {"type": "string", "description": "Optional name for the file"}
                            },
                            "required": ["file_path"]
                        }
                    },
                    {
                        "name": "get_file",
                        "description": "Get file info/content by ID",
                        "inputSchema": {
                            "type": "object",
                            "properties": {"file_id": {"type": "string", "description": "File ID"}},
                            "required": ["file_id"]
                        }
                    },
                    # Collections
                    {
                        "name": "list_collections",
                        "description": "List knowledge collections",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "create_collection",
                        "description": "Create a new knowledge collection",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string", "description": "Collection name"},
                                "description": {"type": "string", "description": "Optional description"}
                            },
                            "required": ["name"]
                        }
                    },
                    # Config
                    {
                        "name": "get_config",
                        "description": "Get OpenWebUI server configuration",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    # Analytics
                    {
                        "name": "get_analytics_summary",
                        "description": "Get analytics summary (usage stats)",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "get_analytics_models",
                        "description": "Get per-model usage analytics",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "get_analytics_users",
                        "description": "Get per-user usage analytics",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    # Audio
                    {
                        "name": "transcribe_audio",
                        "description": "Transcribe audio data to text",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "audio_data": {"type": "string", "description": "Base64 encoded audio data or path to audio file"},
                                "model": {"type": "string", "description": "Transcription model (default: whisper)"}
                            },
                            "required": ["audio_data"]
                        }
                    },
                    # OpenClaw Bridge
                    {
                        "name": "openclaw_bridge_chat",
                        "description": "Chat with OpenClaw via bridge agent - CEO MIX style responses",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "message": {"type": "string", "description": "Message to send to OpenClaw"},
                                "session_id": {"type": "string", "description": "Optional session ID"}
                            },
                            "required": ["message"]
                        }
                    }
                ]
            }

        elif method == "tools/call":
            tool_name = params.get("name", "")
            arguments = params.get("arguments", {})

            if tool_name == "list_models":
                return list_models()
            elif tool_name == "get_model":
                return get_model(arguments.get("model_id", ""))
            elif tool_name == "chat":
                return chat(
                    model=arguments.get("model", ""),
                    message=arguments.get("message", ""),
                    session_id=arguments.get("session_id")
                )
            elif tool_name == "get_users":
                return get_users()
            elif tool_name == "get_user":
                return get_user(arguments.get("user_id", ""))
            elif tool_name == "transcribe_audio":
                return transcribe_audio(
                    audio_data=arguments.get("audio_data", ""),
                    model=arguments.get("model", "whisper")
                )
            elif tool_name == "list_chats":
                return list_chats()
            elif tool_name == "get_chat":
                return get_chat(arguments.get("chat_id", ""))
            elif tool_name == "get_config":
                return get_config()
            elif tool_name == "list_collections":
                return list_collections()
            elif tool_name == "create_collection":
                return create_collection(
                    name=arguments.get("name", ""),
                    description=arguments.get("description", "")
                )
            elif tool_name == "list_files":
                return list_files()
            elif tool_name == "upload_file":
                return upload_file(
                    file_path=arguments.get("file_path", ""),
                    name=arguments.get("name", "")
                )
            elif tool_name == "get_file":
                return get_file(arguments.get("file_id", ""))
            elif tool_name == "get_analytics_summary":
                return get_analytics_summary()
            elif tool_name == "get_analytics_models":
                return get_analytics_models()
            elif tool_name == "get_analytics_users":
                return get_analytics_users()
            elif tool_name == "share_chat":
                return share_chat(arguments.get("chat_id", ""))
            elif tool_name == "openclaw_bridge_chat":
                return openclaw_bridge_chat(
                    message=arguments.get("message", ""),
                    session_id=arguments.get("session_id")
                )
            else:
                raise Exception(f"Unknown tool: {tool_name}")

        elif method == "initialize":
            return {
                "protocolVersion": "2024-11-05",
                "serverInfo": {
                    "name": "openwebui-mcp",
                    "version": "1.1.0"
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
    print(f"Tools: 20 (list_models, get_model, chat, list_chats, get_chat, share_chat, get_users, get_user, list_files, upload_file, get_file, list_collections, create_collection, get_config, get_analytics_summary, get_analytics_models, get_analytics_users, transcribe_audio, openclaw_bridge_chat)", file=sys.stderr)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...", file=sys.stderr)
        server.shutdown()
        sys.exit(0)


if __name__ == "__main__":
    main()
