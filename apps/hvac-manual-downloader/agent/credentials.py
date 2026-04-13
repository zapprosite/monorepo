"""Credential management using Infisical SDK."""
import os
import subprocess
from typing import Optional

INFISICAL_PROJECT_ID = "e42657ef-98b2-4b9c-9a04-46c093bd6d37"
INFISICAL_ENV = "dev"
TOKEN_PATH = "/srv/ops/secrets/infisical.service-token"

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
    """Fetch a secret from Infisical vault."""
    script = f"""
from infisical_sdk import InfisicalSDKClient
import os
token = os.environ.get('INFISICAL_TOKEN') or open('{TOKEN_PATH}').read().strip()
client = InfisicalSDKClient(host='http://127.0.0.1:8200', token=token)
secrets = client.secrets.list_secrets(
    project_id='{INFISICAL_PROJECT_ID}',
    environment_slug='{INFISICAL_ENV}',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == '{secret_key}':
        print(s.secret_value)
        break
"""
    result = subprocess.run(
        ["python3", "-c", script],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Failed to fetch {secret_key}: {result.stderr}")
    return result.stdout.strip()


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
