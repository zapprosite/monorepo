# Infisical SDK Patterns

**Data:** 2026-04-09

## Overview

Python SDK for fetching secrets from Infisical vault. Used for:
- LITELLM_MASTER_KEY
- MINIMAX_API_KEY
- Telegram bot tokens
- Any other secrets

## Client Initialization

```python
from infisical_sdk import InfisicalSDKClient, InfisicalError

def get_client():
    """Get authenticated Infisical client."""
    token = os.environ.get("INFISICAL_TOKEN", "")
    if not token:
        token_path = "/srv/ops/secrets/infisical.service-token"
        if os.path.exists(token_path):
            token = open(token_path).read().strip()

    return InfisicalSDKClient(
        host="http://127.0.0.1:8200",
        token=token,
        cache_ttl=60  # 60 second cache
    )
```

## Fetch Single Secret

```python
def fetch_secret(secret_name: str, project_id: str = "e42657ef-98b2-4b9c-9a04-46c093bd6d37") -> Optional[str]:
    """Fetch a single secret by name."""
    client = get_client()
    try:
        secret = client.secrets.get_secret_by_name(
            secret_name=secret_name,
            project_id=project_id,
            environment_slug="dev",
            secret_path="/",
            expand_secret_references=True,
            view_secret_value=True
        )
        return secret.secret_value
    except InfisicalError:
        return None

# Usage
LITELLM_KEY = fetch_secret("LITELLM_MASTER_KEY")
MINIMAX_KEY = fetch_secret("MINIMAX_API_KEY")
```

## Fetch All Secrets

```python
def fetch_all_secrets(project_id: str = "e42657ef-98b2-4b9c-9a04-46c093bd6d37") -> Dict[str, str]:
    """Fetch all secrets from project."""
    client = get_client()
    secrets = client.secrets.list_secrets(
        project_id=project_id,
        environment_slug="dev",
        secret_path="/"
    )
    return {s.secret_key: s.secret_value for s in secrets.secrets}

# Usage
all_secrets = fetch_all_secrets()
LITELLM_KEY = all_secrets.get("LITELLM_MASTER_KEY")
TELEGRAM_TOKEN = all_secrets.get("TELEGRAM_BOT_TOKEN")
```

## Error Handling

```python
from infisical_sdk import InfisicalSDKClient, InfisicalError

def safe_fetch(secret_name: str) -> Optional[str]:
    """Fetch with proper error handling."""
    try:
        client = get_client()
        secret = client.secrets.get_secret_by_name(
            secret_name=secret_name,
            project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
            environment_slug="dev",
            secret_path="/"
        )
        return secret.secret_value
    except InfisicalError as e:
        print(f"Infisical API error for {secret_name}: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error fetching {secret_name}: {e}")
        return None
```

## Shell Integration Pattern

```bash
#!/bin/bash
# Fetch secrets and export to environment

fetch_secret() {
    python3 -c "
import sys
from infisical_sdk import InfisicalSDKClient
import os

token = os.environ.get('INFISICAL_TOKEN', '')
if not token and os.path.exists('/srv/ops/secrets/infisical.service-token'):
    token = open('/srv/ops/secrets/infisical.service-token').read().strip()

client = InfisicalSDKClient(host='http://127.0.0.1:8200', token=token)
secrets = client.secrets.list_secrets(
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == '\$1':
        print(s.secret_value, end='')
        break
" 2>/dev/null
}

export LITELLM_KEY=$(fetch_secret "LITELLM_MASTER_KEY")
export MINIMAX_API_KEY=$(fetch_secret "MINIMAX_API_KEY")
```

## Used In

- `tasks/smoke-tests/pipeline-openclaw-voice.sh` — fetch LITELLM_KEY and MINIMAX_API_KEY
- OpenClaw config — API keys via environment injection

---

**Data:** 2026-04-09
**Source:** Infisical Python SDK docs (Context7)