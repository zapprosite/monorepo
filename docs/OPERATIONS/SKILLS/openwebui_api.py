#!/usr/bin/env python3
"""
OpenWebUI API Wrapper
=====================
Wraps OpenWebUI REST API for Claude Code CLI usage.

Usage:
    from openwebui_api import list_models, chat, get_config

Environment variables:
    OPENWEBUI_URL        Base URL (default: https://chat.zappro.site)
    OPENWEBUI_EMAIL      Account email for sign-in
    OPENWEBUI_PASSWORD   Account password
    OPENWEBUI_JWT_TOKEN  Pre-set JWT token (bypasses sign-in)

Infisical (optional):
    INFISICAL_TOKEN       Infisical access token
    INFISICAL_PROJECT_ID  Infisical project ID
"""

import os
import json
import urllib.request
import urllib.error
from typing import Optional, Dict, Any, List

INFISICAL_AVAILABLE = False
try:
    from infisical import Infisical
    INFISICAL_AVAILABLE = True
except ImportError:
    pass


def _get_infisical_secrets(token: str, project_id: str, env: str = "prod") -> Dict[str, str]:
    """Fetch secrets from Infisical."""
    if not INFISICAL_AVAILABLE:
        raise ImportError("Infisical SDK not installed: pip install infisical")
    client = Infisical(token=token)
    secrets = client.secrets.list(project_id=project_id, environment=env)
    return {s.secret: s.value for s in secrets}


def get_config() -> Dict[str, str]:
    """Load configuration from env vars, optionally from Infisical."""
    config = {
        "url": os.environ.get("OPENWEBUI_URL", "https://chat.zappro.site"),
        "email": os.environ.get("OPENWEBUI_EMAIL", ""),
        "password": os.environ.get("OPENWEBUI_PASSWORD", ""),
        "jwt_token": os.environ.get("OPENWEBUI_JWT_TOKEN", ""),
        "infisical_token": os.environ.get("INFISICAL_TOKEN", ""),
        "infisical_project_id": os.environ.get("INFISICAL_PROJECT_ID", ""),
    }

    if config["infisical_token"] and config["infisical_project_id"]:
        try:
            secrets = _get_infisical_secrets(
                config["infisical_token"],
                config["infisical_project_id"]
            )
            config["email"] = secrets.get("OPENWEBUI_EMAIL", config["email"])
            config["password"] = secrets.get("OPENWEBUI_PASSWORD", config["password"])
            config["jwt_token"] = secrets.get("OPENWEBUI_JWT_TOKEN", config["jwt_token"])
        except Exception as e:
            print(f"Warning: Infisical fetch failed: {e}", file=__import__('sys').stderr)

    return config


def _get_token(config: Dict[str, str]) -> str:
    """Obtain bearer token: JWT from sign-in, or pre-set JWT/API key."""
    if config["jwt_token"]:
        return config["jwt_token"]

    if config["email"] and config["password"]:
        req = urllib.request.Request(
            f"{config['url']}/api/v1/auths/signin",
            data=json.dumps({
                "email": config["email"],
                "password": config["password"]
            }).encode(),
            headers={"Content-Type": "application/json"},
            method="POST"
        )
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
                return data.get("token", "")
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"Sign-in failed ({e.code}): {e.read().decode()}")

    raise RuntimeError("Need OPENWEBUI_JWT_TOKEN or OPENWEBUI_EMAIL + OPENWEBUI_PASSWORD")


def _api_request(
    path: str,
    method: str = "GET",
    data: Optional[Dict[str, Any]] = None,
    token: Optional[str] = None,
) -> Dict[str, Any]:
    """Make authenticated request to OpenWebUI API."""
    config = get_config()
    if token is None:
        token = _get_token(config)

    headers = {"Authorization": f"Bearer {token}"}
    if data is not None:
        headers["Content-Type"] = "application/json"

    body = json.dumps(data).encode() if data else None
    url = f"{config['url']}{path}"

    req = urllib.request.Request(url, data=body, headers=headers, method=method)

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read()
            return json.loads(content) if content else {}
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"API request failed ({e.code}): {e.read().decode()}")


def list_models() -> List[Dict[str, Any]]:
    """Return available models from OpenWebUI."""
    result = _api_request("/api/v1/models")
    return result.get("data", result.get("models", []))


def chat(model: str, message: str, token: Optional[str] = None) -> str:
    """Send a chat message and return the assistant's response."""
    result = _api_request(
        "/api/v1/chat/completions",
        method="POST",
        data={
            "model": model,
            "messages": [{"role": "user", "content": message}]
        },
        token=token,
    )
    if "choices" in result:
        return result["choices"][0].get("message", {}).get("content", "")
    return ""


def get_config() -> Dict[str, Any]:
    """Return OpenWebUI server configuration."""
    return _api_request("/api/v1/config")
