#!/usr/bin/env python3
"""
OpenWebUI Bridge Agent
======================
Bridge agent between OpenWebUI and OpenClaw.

Uses Python stdlib only: http.server, json, urllib.request

Usage:
    PORT=3335 OPENCLAW_USER=xxx OPENCLAW_PASSWORD=xxx python3 openwebui_bridge_agent.py

Environment variables:
    PORT              - MCP server port (default: 3335)
    OPENCLAW_BASE_URL - OpenClaw base URL (default: http://10.0.19.4:8080)
    OPENCLAW_USER     - OpenClaw Basic Auth username
    OPENCLAW_PASSWORD - OpenClaw Basic Auth password
"""

import os
import sys
import json
import base64
import socket
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Optional, Dict, Any, List


# =============================================================================
# Configuration
# =============================================================================

PORT = int(os.environ.get("PORT", 3456))
OPENCLAW_BASE_URL = os.environ.get("OPENCLAW_BASE_URL", "http://10.0.19.4:8080")
OPENCLAW_USER = os.environ.get("OPENCLAW_USER", "")
OPENCLAW_PASSWORD = os.environ.get("OPENCLAW_PASSWORD", "")


# =============================================================================
# OpenClaw API
# =============================================================================

def make_basic_auth() -> str:
    """Create Basic Auth header value."""
    credentials = f"{OPENCLAW_USER}:{OPENCLAW_PASSWORD}"
    encoded = base64.b64encode(credentials.encode()).decode()
    return f"Basic {encoded}"


def api_request(
    path: str,
    method: str = "GET",
    data: Optional[Dict[str, Any]] = None,
    timeout: int = 30
) -> Dict[str, Any]:
    """Make request to OpenClaw API with Basic Auth."""
    headers = {
        "Authorization": make_basic_auth(),
        "Content-Type": "application/json"
    }

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
    except Exception as e:
        raise Exception(f"OpenClaw API error: {str(e)}")


# =============================================================================
# Bridge Tools
# =============================================================================

def bridge_chat(message: str, session_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Send a message to OpenClaw via send_message tool.
    Returns response in CEO MIX format.
    """
    try:
        payload = {
            "tool": "send_message",
            "action": "json",
            "args": {
                "message": message
            }
        }

        if session_id:
            payload["args"]["session_id"] = session_id

        result = api_request("/tools/invoke", method="POST", data=payload)

        # Format response in CEO MIX style
        response_text = result.get("response", "") or result.get("text", "") or str(result)
        if isinstance(result, str):
            response_text = result

        return {
            "response": response_text,
            "style": "ceo_mix",
            "tool_used": "send_message",
            "action_taken": f"Sent message to OpenClaw: {message[:50]}..."
        }
    except Exception as e:
        return {
            "response": f"Erro ao comunicar com OpenClaw: {str(e)}",
            "style": "ceo_mix",
            "tool_used": "send_message",
            "action_taken": "Failed to send message"
        }


def bridge_status() -> Dict[str, Any]:
    """Check if OpenClaw is reachable and return status."""
    try:
        # Try health endpoint
        result = api_request("/", method="GET", timeout=5)
        return {
            "status": "ok",
            "openclaw_reachable": True,
            "openclaw_response": result
        }
    except Exception as e:
        return {
            "status": "error",
            "openclaw_reachable": False,
            "error": str(e)
        }


def bridge_list_tools() -> Dict[str, Any]:
    """List available OpenClaw tools from sessions_list result."""
    try:
        # Invoke sessions_list to get available tools
        result = api_request("/tools/invoke", method="POST", data={
            "tool": "sessions_list",
            "action": "json"
        })

        # Extract tools from sessions_list response
        tools: List[Dict[str, Any]] = []

        if isinstance(result, dict):
            # Try to find tools in common structures
            sessions = result.get("sessions", result.get("data", []))
            if isinstance(sessions, list):
                for session in sessions:
                    if isinstance(session, dict):
                        session_tools = session.get("tools", session.get("available_tools", []))
                        if isinstance(session_tools, list):
                            for t in session_tools:
                                if isinstance(t, dict) and t not in tools:
                                    tools.append(t)
                                elif isinstance(t, str) and {"name": t} not in tools:
                                    tools.append({"name": t})

        # Fallback: if no tools found, return generic list
        if not tools:
            tools = [
                {"name": "send_message", "description": "Send a message to OpenClaw"},
                {"name": "sessions_list", "description": "List active sessions"},
                {"name": "browser_action", "description": "Perform browser action"},
            ]

        return {
            "status": "ok",
            "tools": tools
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "tools": []
        }


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
            self.send_json({"status": "ok", "service": "openwebui-bridge-agent"})
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
                        "name": "bridge_chat",
                        "description": "Send a message to OpenClaw and get response in CEO MIX format",
                        "inputSchema": {
                            "type": "object",
                            "properties": {
                                "message": {"type": "string", "description": "Message to send to OpenClaw"},
                                "session_id": {"type": "string", "description": "Optional session ID"}
                            },
                            "required": ["message"]
                        }
                    },
                    {
                        "name": "bridge_status",
                        "description": "Check if OpenClaw is reachable",
                        "inputSchema": {"type": "object", "properties": {}}
                    },
                    {
                        "name": "bridge_list_tools",
                        "description": "List available OpenClaw tools",
                        "inputSchema": {"type": "object", "properties": {}}
                    }
                ]
            }

        elif method == "tools/call":
            tool_name = params.get("name", "")
            arguments = params.get("arguments", {})

            if tool_name == "bridge_chat":
                return bridge_chat(
                    message=arguments.get("message", ""),
                    session_id=arguments.get("session_id")
                )
            elif tool_name == "bridge_status":
                return bridge_status()
            elif tool_name == "bridge_list_tools":
                return bridge_list_tools()
            else:
                raise Exception(f"Unknown tool: {tool_name}")

        elif method == "initialize":
            return {
                "protocolVersion": "2024-11-05",
                "serverInfo": {"name": "openwebui-bridge-agent", "version": "1.0.0"},
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
    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        super().server_bind()

def main():
    server = ReuseAddrHTTPServer(("0.0.0.0", PORT), MCPHandler, bind_and_activate=False)
    server.allow_reuse_address = True
    server.server_bind()
    server.server_activate()
    print(f"OpenWebUI Bridge Agent running on port {PORT}", file=sys.stderr)
    print(f"OpenClaw base URL: {OPENCLAW_BASE_URL}", file=sys.stderr)
    print(f"Tools: bridge_chat, bridge_status, bridge_list_tools", file=sys.stderr)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...", file=sys.stderr)
        server.shutdown()
        sys.exit(0)


if __name__ == "__main__":
    main()
