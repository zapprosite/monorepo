"""Config for Perplexity Agent."""
import os
import subprocess


def get_minimax_token() -> str:
    """Fetch MINIMAX_TOKEN from Infisical vault."""
    token_path = "/srv/ops/secrets/infisical.service-token"
    script = """
from infisical_sdk import InfisicalSDKClient
import os
token = os.environ.get('INFISICAL_TOKEN') or open('{token_path}').read().strip()
client = InfisicalSDKClient(host='http://127.0.0.1:8200', token=token)
secrets = client.secrets.list_secrets(
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == 'MINIMAX_TOKEN':
        print(s.secret_value)
        break
""".format(token_path=token_path)

    result = subprocess.run(
        ["/usr/bin/python3", "-c", script],
        capture_output=True,
        text=True,
        timeout=10,
    )
    if result.returncode != 0:
        raise RuntimeError(f"Failed to fetch MINIMAX_TOKEN: {result.stderr}")
    return result.stdout.strip()


MINIMAX_TOKEN = get_minimax_token()

CHROME_PROFILE_PATH = os.environ.get(
    "CHROME_PROFILE_PATH",
    "/srv/data/perplexity-agent/chrome-profile"
)

STREAMLIT_PORT = int(os.environ.get("STREAMLIT_PORT", "4004"))
