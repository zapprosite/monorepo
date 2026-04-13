"""Credential management using Infisical REST API via curl + jq.

Replaces infisical-sdk dependency to avoid pydantic version conflicts.
Uses curl subprocess against Infisical v3 REST endpoint — zero Python SDK deps.
"""
import os
import subprocess
from typing import Optional

INFISICAL_PROJECT_ID = "e42657ef-98b2-4b9c-9a04-46c093bd6d37"
INFISICAL_ENV = "dev"
TOKEN_PATH = "/srv/ops/secrets/infisical.service-token"

# INFISICAL_HOST defaults to localhost (host execution).
# When running in Docker, docker-compose.scraper.yml sets:
#   INFISICAL_HOST=http://host.docker.internal:8200
INFISICAL_HOST = os.environ.get("INFISICAL_HOST", "http://127.0.0.1:8200")

# Path to the bash helper that calls curl + jq
FETCH_SECRET_SCRIPT = os.environ.get(
    "FETCH_SECRET_SCRIPT", "/srv/hvacr-swarm/scripts/fetch-secret.sh"
)

# Brand credential keys
BRAND_CREDENTIALS = {
    "lg": {
        "email": "LG_BRAZIL_EMAIL",
        "password": "LG_BRAZIL_PASSWORD",
    },
    "samsung": {
        "email": "SAMSUNG_BRAZIL_EMAIL",
        "password": "SAMSUNG_BRAZIL_PASSWORD",
    },
    "daikin": {
        "email": "DAIKIN_BRAZIL_EMAIL",
        "password": "DAIKIN_BRAZIL_PASSWORD",
    },
    "springer": {
        "email": "SPRINGER_BRAZIL_EMAIL",
        "password": "SPRINGER_BRAZIL_PASSWORD",
    },
}


def _fetch_infisical_secret(secret_key: str) -> str:
    """Fetch a secret from Infisical vault via curl + jq (no SDK required).

    Calls fetch-secret.sh which uses the Infisical v3 REST API directly.
    Works on host and inside Docker — no infisical-sdk / pydantic dependency.
    """
    env = os.environ.copy()
    env["INFISICAL_HOST"] = INFISICAL_HOST
    env["INFISICAL_PROJECT_ID"] = INFISICAL_PROJECT_ID
    env["INFISICAL_ENV"] = INFISICAL_ENV
    env["INFISICAL_TOKEN_PATH"] = TOKEN_PATH

    result = subprocess.run(
        ["bash", FETCH_SECRET_SCRIPT, secret_key],
        capture_output=True,
        text=True,
        timeout=15,
        env=env,
    )
    if result.returncode != 0:
        raise RuntimeError(
            f"Failed to fetch secret '{secret_key}': {result.stderr.strip()}"
        )
    value = result.stdout.strip()
    if not value:
        raise RuntimeError(f"Secret '{secret_key}' returned empty value from Infisical")
    return value


def get_brand_credentials(brand: str) -> dict:
    """Get credentials for a brand."""
    if brand not in BRAND_CREDENTIALS:
        raise ValueError(f"Unknown brand: {brand}. Valid: {list(BRAND_CREDENTIALS.keys())}")

    keys = BRAND_CREDENTIALS[brand]
    return {
        "email": _fetch_infisical_secret(keys["email"]),
        "password": _fetch_infisical_secret(keys["password"]),
    }


def get_openrouter_key() -> str:
    """Fetch OPENROUTER_API_KEY from Infisical."""
    return _fetch_infisical_secret("OPENROUTER_API_KEY")


def get_groq_key() -> str:
    """Fetch GROQ_API_KEY from Infisical."""
    return _fetch_infisical_secret("GROQ_API_KEY")


class BrandCredentials:
    """Lazy-loading credentials holder for a brand."""

    def __init__(self, brand: str):
        self.brand = brand
        self._email: Optional[str] = None
        self._password: Optional[str] = None

    @property
    def email(self) -> str:
        if self._email is None:
            self._email = _fetch_infisical_secret(BRAND_CREDENTIALS[self.brand]["email"])
        return self._email

    @property
    def password(self) -> str:
        if self._password is None:
            self._password = _fetch_infisical_secret(BRAND_CREDENTIALS[self.brand]["password"])
        return self._password

    def as_dict(self) -> dict:
        """Return credentials as dict for browser autofill."""
        return {"email": self.email, "password": self.password}
