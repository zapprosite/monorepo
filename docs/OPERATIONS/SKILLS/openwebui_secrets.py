#!/usr/bin/env python3
"""
OpenWebUI Secrets Loader
========================
Carrega secrets do OpenWebUI via Infisical SDK.

Required secrets:
- OPENWEBUI_EMAIL
- OPENWEBUI_PASSWORD
- OPENWEBUI_JWT_TOKEN
- WEBUI_SECRET_KEY

Usage:
    from openwebui_secrets import get_openwebui_secrets

    secrets = get_openwebui_secrets()
    email = secrets.get("OPENWEBUI_EMAIL")
    password = secrets.get("OPENWEBUI_PASSWORD")

Environment variables:
    INFISICAL_TOKEN         Service token do Infisical (st.XXX)
    INFISICAL_PROJECT_ID    ID do projeto (default: homelab zappro)
    INFISICAL_ENV_SLUG      Environment (default: dev)
"""

import os
from typing import Dict, Optional

# =============================================================================
# Infisical SDK
# =============================================================================
INFISICAL_AVAILABLE = False
try:
    from infisical import Infisical
    INFISICAL_AVAILABLE = True
except ImportError:
    pass

# Default project ID for homelab zappro
DEFAULT_PROJECT_ID = "e42657ef-98b2-4b9c-9a04-46c093bd6d37"
DEFAULT_ENV_SLUG = "dev"

# Secrets required for OpenWebUI
REQUIRED_SECRETS = [
    "OPENWEBUI_EMAIL",
    "OPENWEBUI_PASSWORD",
    "OPENWEBUI_JWT_TOKEN",
    "WEBUI_SECRET_KEY",
]


def get_infisical_token() -> Optional[str]:
    """Get Infisical token from environment or service token file."""
    token = os.environ.get("INFISICAL_TOKEN")
    if token:
        return token

    # Fallback to service token file
    token_path = "/srv/ops/secrets/infisical.service-token"
    if os.path.exists(token_path):
        with open(token_path, "r") as f:
            token = f.read().strip()
        return token

    return None


def get_openwebui_secrets_from_infisical(
    project_id: Optional[str] = None,
    env_slug: Optional[str] = None,
) -> Dict[str, str]:
    """
    Fetch OpenWebUI secrets from Infisical vault.

    Args:
        project_id: Infisical project ID (default: homelab zappro)
        env_slug: Environment slug (default: dev)

    Returns:
        Dict with OPENWEBUI_EMAIL, OPENWEBUI_PASSWORD, OPENWEBUI_JWT_TOKEN, WEBUI_SECRET_KEY
    """
    if not INFISICAL_AVAILABLE:
        raise ImportError(
            "Infisical SDK nao instalado: pip install infisical"
        )

    token = get_infisical_token()
    if not token:
        raise ValueError("INFISICAL_TOKEN nao encontrado")

    project_id = project_id or os.environ.get("INFISICAL_PROJECT_ID", DEFAULT_PROJECT_ID)
    env_slug = env_slug or os.environ.get("INFISICAL_ENV_SLUG", DEFAULT_ENV_SLUG)

    client = Infisical(token=token)

    # List all secrets from the project
    secrets_response = client.secrets.list(project_id=project_id, environment=env_slug)

    # Build dict from secrets list
    secrets_dict = {}
    for secret in secrets_response:
        secrets_dict[secret.secret] = secret.value

    # Extract only the required OpenWebUI secrets
    result = {}
    for key in REQUIRED_SECRETS:
        result[key] = secrets_dict.get(key, "")

    return result


def get_openwebui_secrets() -> Dict[str, str]:
    """
    Get OpenWebUI secrets with fallback to environment variables.

    Returns:
        Dict with OPENWEBUI_EMAIL, OPENWEBUI_PASSWORD, OPENWEBUI_JWT_TOKEN, WEBUI_SECRET_KEY
    """
    # Try Infisical first
    if INFISICAL_AVAILABLE and get_infisical_token():
        try:
            return get_openwebui_secrets_from_infisical()
        except Exception:
            pass  # Fall back to env vars

    # Fallback to environment variables
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

    print("Carregando secrets do OpenWebUI...")
    secrets = get_openwebui_secrets()

    # Show which source was used
    if INFISICAL_AVAILABLE and get_infisical_token():
        print("Fonte: Infisical")
    else:
        print("Fonte: Environment variables")

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
