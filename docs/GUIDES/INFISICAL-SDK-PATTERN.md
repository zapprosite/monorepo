# INFISICAL-SDK-PATTERN — Practical Implementation Guide

**For:** Python, JavaScript/TypeScript, Bash scripts
**Spec:** SPEC-029-INFISICAL-SDK-MANDATORY.md
**Updated:** 2026-04-12

---

## Quick Start

### Python

```bash
# Install
pip install infisical-python
# or
uv add infisical-python
```

```python
# 1. Setup — usa variáveis de ambiente auto-discovery
# INFISICAL_CLIENT_ID + INFISICAL_CLIENT_SECRET
# ou token via INFISICAL_TOKEN

from infisical import InfisicalClient

client = InfisicalClient()

# 2. Get single secret
api_key = client.get_secret("MY_SERVICE_API_KEY")
print(api_key.secret_value)  # access .secret_value

# 3. Get all secrets (batch)
all_secrets = client.get_all_secrets()
for secret in all_secrets:
    print(f"{secret.secret_name} = {secret.secret_value}")

# 4. With fallback (cuidado — pode mascarar errors)
value = client.get_secret("OPTIONAL_KEY", raise_if_missing=False)
```

### JavaScript/TypeScript

```bash
npm install infisical-node
# or
yarn add infisical-node
```

```typescript
import { InfisicalClient } from 'infisical-node';

const client = new InfisicalClient();

const { secret } = await client.getSecret({
  secretName: 'MY_SERVICE_API_KEY',
  projectId: 'your-project-id',  // optional if using default workspace
});

console.log(secret.secretValue);
```

### Bash

```bash
# Install CLI
npm install -g infisical-cli
# ou
brew install infisical-cli

# Login
infisical login

# Inject secrets into environment
source <(infisical secrets --env=production --format=env)
```

```bash
#!/bin/bash
# 例外: Bash scripts usam ficheiro .env temporário
# APPROVED_BY: will-zappro 2026-04-12
# EXPIRES: 2026-05-01
eval "$(infisical secrets --format=env --env=production)"

# Agora as variaveis estao disponiveis
curl -H "Authorization: Bearer $MY_SERVICE_API_KEY" https://api.example.com
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INFISICAL_TOKEN` | Yes* | Personal token (for local dev) |
| `INFISICAL_CLIENT_ID` | Yes* | Service account client ID |
| `INFISICAL_CLIENT_SECRET` | Yes* | Service account secret |
| `INFISICAL_WORKSPACE_ID` | Recommended | Target workspace |
| `INFISICAL_ENVIRONMENT` | No | `production` / `staging` (default: `development`) |

*Either `INFISICAL_TOKEN` OR (`INFISICAL_CLIENT_ID` + `INFISICAL_CLIENT_SECRET`)

---

## Common Patterns

### Pattern 1: Module-Level Client (Recommended)

```python
# client.py
from infisical import InfisicalClient
from functools import lru_cache

@lru_cache(maxsize=1)
def get_infisical_client() -> InfisicalClient:
    """Single client instance, cached."""
    return InfisicalClient()

# config.py
from client import get_infisical_client

def get_api_key() -> str:
    """Get API key from vault."""
    client = get_infisical_client()
    return client.get_secret("SERVICE_API_KEY").secret_value

# main.py
from config import get_api_key
api_key = get_api_key()  # reads at runtime, not at import
```

### Pattern 2: Lazy Loading (For Fast Startup)

```python
import os
from infisical import InfisicalClient

def get_secret(name: str) -> str:
    """Lazy load secret on first access."""
    client = InfisicalClient()
    return client.get_secret(name).secret_value

# Usage
API_KEY = os.getenv("INFISICAL_API_KEY")  # reference only, no hardcode
```

### Pattern 3: Secrets as Dict (For Multiple Secrets)

```python
from infisical import InfisicalClient

def load_all_secrets() -> dict[str, str]:
    """Load all secrets for service."""
    client = InfisicalClient()
    secrets = client.get_all_secrets()
    return {s.secret_name: s.secret_value for s in secrets}

secrets = load_all_secrets()
# secrets = {"API_KEY": "...", "DB_PASSWORD": "...", ...}
```

---

## Error Handling

### Missing Secret

```python
from infisical import InfisicalClient, InfisicalSecretNotFoundError

client = InfisicalClient()

try:
    secret = client.get_secret("CRITICAL_SERVICE_KEY")
except InfisicalSecretNotFoundError:
    raise RuntimeError("CRITICAL_SERVICE_KEY missing from vault — cannot start") from None

# ✅ GOOD — explicit error, not silent fallback
```

### Connection Error

```python
import os

# Fallback para desenvolvimento local (opcional, mas cuidado)
def get_secret(name: str, fallback: str | None = None) -> str:
    try:
        client = InfisicalClient()
        return client.get_secret(name).secret_value
    except Exception as e:
        if fallback is not None:
            return fallback
        raise RuntimeError(f"Cannot get {name} from vault: {e}") from None
```

---

## Testing

### Mock Approach

```python
from unittest.mock import patch

@patch('infisical.InfisicalClient')
def test_with_mock(mock_client):
    mock_instance = mock_client.return_value
    mock_secret = MagicMock()
    mock_secret.secret_value = "test-token-123"
    mock_instance.get_secret.return_value = mock_secret

    from config import get_api_key
    assert get_api_key() == "test-token-123"
```

### Environment Variable for Tests

```python
# conftest.py
import os

os.environ["INFISICAL_TOKEN"] = "test-token-for-ci"

# No tests devem usar tokens reais
```

---

## Rotação de Secrets

### Processo

1. **Criar** novo secret no Infisical vault
2. **Atualizar** código para usar novo nome/versão
3. **Testar** em staging
4. **Deploy** para produção
5. **Revogar** secret antigo

```bash
# Via CLI
infisical secrets create --name="NEW_API_KEY" --value="new-value"
infisical secrets delete --name="OLD_API_KEY"
```

### Naming Convention

```
{ SERVICE }_{ SECRET_TYPE }
ex:
GITHUB_TOKEN
COOLIFY_API_KEY
TELEGRAM_BOT_TOKEN
OPENROUTER_API_KEY
```

---

## Anti-Patterns

```python
# ❌ BAD — hardcoded
API_KEY = "${GITHUB_TOKEN}"

# ❌ BAD — env var sem guarantee vault-backed
API_KEY = os.getenv("GITHUB_TOKEN")

# ❌ BAD — fallback para string vazia (mascara errors)
API_KEY = os.getenv("API_KEY", "")

# ❌ BAD — Lê secret em module load (bloqueia startup)
API_KEY = InfisicalClient().get_secret("API_KEY").secret_value  # bloqueia aqui

# ❌ BAD — Plain text file
with open("secrets.env") as f:
    API_KEY = f.read()

# ✅ GOOD — lazy load, em runtime
def get_api_key():
    return InfisicalClient().get_secret("API_KEY").secret_value

# ✅ GOOD — inject via dependency
def fetch_data(api_key: str = Depends(get_api_key)):
    return api_key
```

---

## Workflow

```
1. Novo secret necessário
   ↓
2. Adicionar ao Infisical vault (não em código!)
   infisical secrets create --name="NEW_KEY" --value="..."
   ↓
3. Código usa InfisicalClient.get_secret("NEW_KEY")
   ↓
4. Code review verifica pattern
   ↓
5. Deploy
   ↓
6. Monitoring — alertas se secret missing
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Login CLI | `infisical login` |
| List secrets | `infisical secrets` |
| Get one secret | `infisical secrets --name=KEY` |
| Create secret | `infisical secrets create --name=KEY --value=VAL` |
| Delete secret | `infisical secrets delete --name=KEY` |
| Inject as env | `source <(infisical secrets --format=env)` |

---

**Authority:** will-zappro
**Spec:** SPEC-029-INFISICAL-SDK-MANDATORY.md
