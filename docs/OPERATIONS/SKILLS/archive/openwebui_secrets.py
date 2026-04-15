#!/usr/bin/env python3
"""
OpenWebUI Secrets Loader
========================
Carrega secrets do OpenWebUI via .env (fonte canonica).

SPEC-029/ADR-001: .env e a UNICA fonte de secrets. Infisical SDK e proibido.

Required secrets (from .env):
- OPENWEBUI_EMAIL
- OPENWEBUI_PASSWORD
- OPENWEBUI_JWT_TOKEN
- WEBUI_SECRET_KEY

Usage:
    from openwebui_secrets import get_openwebui_secrets

    secrets = get_openwebui_secrets()
    email = secrets.get("OPENWEBUI_EMAIL")
    password = secrets.get("OPENWEBUI_PASSWORD")
"""

import os
from typing import Dict


# =============================================================================
# Secrets from .env only (canonical source — SPEC-029/ADR-001)
# =============================================================================
REQUIRED_SECRETS = [
    "OPENWEBUI_EMAIL",
    "OPENWEBUI_PASSWORD",
    "OPENWEBUI_JWT_TOKEN",
    "WEBUI_SECRET_KEY",
]


def get_openwebui_secrets() -> Dict[str, str]:
    """
    Get OpenWebUI secrets from .env (canonical source).

    Returns:
        Dict with OPENWEBUI_EMAIL, OPENWEBUI_PASSWORD, OPENWEBUI_JWT_TOKEN, WEBUI_SECRET_KEY
    """
    return {
        "OPENWEBUI_EMAIL": os.environ.get("OPENWEBUI_EMAIL", ""),
        "OPENWEBUI_PASSWORD": os.environ.get("OPENWEBUI_PASSWORD", ""),
        "OPENWEBUI_JWT_TOKEN": os.environ.get("OPENWEBUI_JWT_TOKEN", ""),
        "WEBUI_SECRET_KEY": os.environ.get("WEBUI_SECRET_KEY", ""),
    }


# =============================================================================
# CLI (for testing)
# =============================================================================
if __name__ == "__main__":
    import json

    print("Carregando secrets do OpenWebUI (fonte: .env)...")
    secrets = get_openwebui_secrets()

    # Mask sensitive values for display
    display = {}
    for key, value in secrets.items():
        if value:
            if "PASSWORD" in key or "SECRET" in key or "TOKEN" in key:
                display[key] = value[:4] + "***" if len(value) > 4 else "***"
            else:
                display[key] = value
        else:
            display[key] = "(not set)"

    print(json.dumps(display, indent=2))
