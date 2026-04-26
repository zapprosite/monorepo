"""Config for Perplexity Agent."""
import os
import subprocess

INFISICAL_PROJECT_ID = "e42657ef-98b2-4b9c-9a04-46c093bd6d37"
INFISICAL_ENV = "dev"
TOKEN_PATH = "/srv/ops/secrets/infisical.service-token"


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


def get_minimax_token() -> str:
    """Fetch MINIMAX_TOKEN from Infisical vault."""
    return _fetch_infisical_secret("MINIMAX_TOKEN")


def get_oauth_client_id(persona: str) -> str | None:
    """Fetch Google OAuth client ID - tries persona-specific first, then generic."""
    # Try persona-specific first
    key = f"GOOGLE_OAUTH_CLIENT_ID_{persona.upper()}"
    try:
        return _fetch_infisical_secret(key)
    except RuntimeError:
        pass
    # Fall back to generic Google OAuth
    try:
        return _fetch_infisical_secret("GOOGLE_CLIENT_ID")
    except RuntimeError:
        return None


def get_oauth_client_secret(persona: str) -> str | None:
    """Fetch Google OAuth client secret - tries persona-specific first, then generic."""
    # Try persona-specific first
    key = f"GOOGLE_OAUTH_CLIENT_SECRET_{persona.upper()}"
    try:
        return _fetch_infisical_secret(key)
    except RuntimeError:
        pass
    # Fall back to generic Google OAuth
    try:
        return _fetch_infisical_secret("GOOGLE_CLIENT_SECRET")
    except RuntimeError:
        return None


# Initialize tokens
MINIMAX_TOKEN = get_minimax_token()

# OAuth credentials (loaded lazily)
OAUTH_CLIENT_ID_GEMINI = None  # Lazy load
OAUTH_CLIENT_SECRET_GEMINI = None

# Paths
CHROME_PROFILE_PATH = os.environ.get(
    "CHROME_PROFILE_PATH",
    "/srv/data/perplexity-agent/chrome-profile"
)

AUTH_DIR = "/srv/data/openclaw/auth"

STREAMLIT_PORT = int(os.environ.get("STREAMLIT_PORT", "4004"))

# Paths
CHROME_PROFILE_PATH = os.environ.get(
    "CHROME_PROFILE_PATH",
    "/srv/data/perplexity-agent/chrome-profile"
)

STREAMLIT_PORT = int(os.environ.get("STREAMLIT_PORT", "4004"))
