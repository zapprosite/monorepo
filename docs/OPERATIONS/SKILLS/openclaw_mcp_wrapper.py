#!/usr/bin/env python3
"""
OpenClaw MCP Wrapper
====================
MCP server that wraps OpenClaw Bot's HTTP Control API.

Uses Python stdlib only: http.server, json, urllib.request

Usage:
    python3 openclaw_mcp_wrapper.py

Environment variables:
    PORT              - MCP server port (default: 3334)
    OPENCLAW_BASE_URL - OpenClaw base URL (default: http://localhost:8080)
    OPENCLAW_TOKEN    - Bearer token for OpenClaw auth
"""

import os
import sys
import json
import base64
import threading
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse
from typing import Optional, Dict, Any


# =============================================================================
# Configuration
# =============================================================================

PORT = int(os.environ.get("PORT", 3457))
OPENCLAW_BASE_URL = os.environ.get("OPENCLAW_BASE_URL", "http://localhost:8080")
OPENCLAW_TOKEN = os.environ.get("OPENCLAW_TOKEN", "") or os.environ.get("OPENCLAW_GATEWAY_TOKEN", "")
OPENCLAW_USER = os.environ.get("OPENCLAW_USER", "")
OPENCLAW_PASSWORD = os.environ.get("OPENCLAW_PASSWORD", "")


# =============================================================================
# OpenClaw API
# =============================================================================

def api_request(
    path: str,
    method: str = "GET",
    data: Optional[Dict[str, Any]] = None,
    timeout: int = 30
) -> Dict[str, Any]:
    """Make request to OpenClaw API with Bearer token auth."""
    headers = {}
    if OPENCLAW_TOKEN:
        headers["Authorization"] = f"Bearer {OPENCLAW_TOKEN}"
    elif OPENCLAW_USER and OPENCLAW_PASSWORD:
        # Fallback to Basic Auth (dev only)
        auth_str = f"{OPENCLAW_USER}:{OPENCLAW_PASSWORD}"
        auth_bytes = base64.b64encode(auth_str.encode()).decode()
        headers["Authorization"] = f"Basic {auth_bytes}"

    if data is not None:
        headers["Content-Type"] = "application/json"

    body = json.dumps(data).encode() if data else None
    url = f"{OPENCLAW_BASE_URL}{path}"

    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            content = resp.read()
            if not content:
                return {}
            return json.loads(content)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        raise Exception(f"OpenClaw API failed ({e.code}): {body}")


# =============================================================================
# MCP Tools
# =============================================================================

def get_status() -> Dict[str, Any]:
    """Get OpenClaw status (health check)."""
    result = api_request("/")
    return {"status": "ok", "openclaw": result}


def invoke_tool(tool: str, action: str = "json", args: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Invoke a tool on OpenClaw."""
    payload = {"tool": tool, "action": action}
    if args:
        payload["args"] = args
    return api_request("/tools/invoke", method="POST", data=payload)


def restart_browser() -> Dict[str, Any]:
    """Restart OpenClaw browser."""
    try:
        api_request("/stop", method="POST")
        api_request("/start", method="POST")
        return {"status": "restarted"}
    except Exception as e:
        return {"error": str(e)}


def list_sessions() -> Dict[str, Any]:
    """List all OpenClaw sessions."""
    return invoke_tool("sessions_list", action="json", args={})


def send_message(session_id: str, message: str) -> Dict[str, Any]:
    """Send a message to an OpenClaw session."""
    result = invoke_tool("sessions_send_message", action="json", args={"sessionId": session_id, "message": message})
    if "error" in result or (isinstance(result, dict) and result.get("ok") == False):
        return {"error": "Message tool not available - browser may not be running"}
    return result


def get_browser_status() -> Dict[str, Any]:
    """Check if OpenClaw browser is running via browser_is_running tool."""
    try:
        result = invoke_tool("browser_is_running", action="json", args={})
        if "error" in str(result).lower() or (isinstance(result, dict) and not result.get("ok", True)):
            return {"browser_running": False, "error": "Browser status tool not available"}
        return {"browser_running": True, "details": result}
    except Exception as e:
        return {"browser_running": False, "error": str(e)}


# =============================================================================
# MCP Protocol Helpers
# =============================================================================

def build_json_response(result: Dict[str, Any], error: Optional[str] = None) -> Dict[str, Any]:
    """Build a JSON-RPC-compatible response."""
    if error:
        return {"jsonrpc": "2.0", "error": {"code": -32600, "message": error}}
    return {"jsonrpc": "2.0", "result": result}


# =============================================================================
# MCP HTTP Handler
# =============================================================================

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

    def do_GET(self):
        """Handle GET requests."""
        if self.path == "/health":
            self.send_json({"status": "ok", "service": "openclaw-mcp-wrapper"})
            return
        self.send_json({"error": "Not found"}, 404)

    def do_POST(self):
        """Handle POST requests."""
        if self.path == "/mcp":
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
                        "name": "get_status",
                        "description": "Get OpenClaw status/health",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "invoke_tool",
                        "description": "Invoke a tool on OpenClaw",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "tool": {"type": "string", "description": "Tool name (e.g. sessions_list, browser_*)"},
                                "action": {"type": "string", "description": "Action (default: json)"},
                                "args": {"type": "object", "description": "Optional arguments"}
                            },
                            "required": ["tool"]
                        }
                    },
                    {
                        "name": "restart_browser",
                        "description": "Restart OpenClaw browser (stop + start)",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "list_sessions",
                        "description": "List all OpenClaw sessions",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "send_message",
                        "description": "Send a message to an OpenClaw session",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "session_id": {"type": "string", "description": "Session ID to send message to"},
                                "message": {"type": "string", "description": "Message text to send"}
                            },
                            "required": ["session_id", "message"]
                        }
                    },
                    {
                        "name": "get_browser_status",
                        "description": "Check if OpenClaw browser is running",
                        "inputSchema": {"type": "object", "properties": {}}
                    }
                ]
            }

        elif method == "tools/call":
            tool_name = params.get("name", "")
            arguments = params.get("arguments", {})

            if tool_name == "get_status":
                return get_status()
            elif tool_name == "invoke_tool":
                return invoke_tool(
                    tool=arguments.get("tool", ""),
                    action=arguments.get("action", "json"),
                    args=arguments.get("args")
                )
            elif tool_name == "restart_browser":
                return restart_browser()
            elif tool_name == "list_sessions":
                return list_sessions()
            elif tool_name == "send_message":
                return send_message(
                    session_id=arguments.get("session_id", ""),
                    message=arguments.get("message", "")
                )
            elif tool_name == "get_browser_status":
                return get_browser_status()
            else:
                raise Exception(f"Unknown tool: {tool_name}")

        elif method == "initialize":
            return {
                "protocolVersion": "2024-11-05",
                "serverInfo": {"name": "openclaw-mcp-wrapper", "version": "1.0.0"},
                "capabilities": {"tools": {}}
            }

        elif method == "ping":
            return {"status": "pong"}

        else:
            raise Exception(f"Unknown method: {method}")


# =============================================================================
# Main
# =============================================================================

class ReuseAddrHTTPServer(HTTPServer):
    allow_reuse_address = True

def main():
    server = ReuseAddrHTTPServer(("0.0.0.0", PORT), MCPHandler)
    print(f"OpenClaw MCP Wrapper running on port {PORT}", file=sys.stderr)
    print(f"OpenClaw base URL: {OPENCLAW_BASE_URL}", file=sys.stderr)
    print(f"Tools: get_status, invoke_tool, restart_browser, list_sessions, send_message, get_browser_status", file=sys.stderr)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...", file=sys.stderr)
        server.shutdown()
        sys.exit(0)


if __name__ == "__main__":
    main()
