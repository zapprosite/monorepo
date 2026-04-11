# Infisical SDK + CLI Guide

**Data:** 2026-04-11
**Atualizado:** 2026-04-11 — Adicionado SDK v1 (legacy), CRUD completo, service token vs user token, troubleshooting expandido
**Objetivo:** Ensinar qualquer LLM a usar Infisical para gerenciar secrets — SDK Python e CLI

---

## Quick Reference

### CLI — Buscar Secret
```bash
infisical secrets get NOME_DO_SECRET --env=dev --plain
```

### CLI — Criar/Atualizar Secret
```bash
infisical secrets set NOME_DO_SECRET --value="valor" --env=dev
```

### CLI — Login
```bash
infisical login --method=universal-auth
```

### Python SDK v2 — Buscar Secret
```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions

with open("/srv/ops/secrets/infisical.service-token") as f:
    token = f.read().strip()

client = InfisicalClient(settings=ClientSettings(
    access_token=token,
    site_url="http://127.0.0.1:8200",
))

secret = client.getSecret(GetSecretOptions(
    environment="dev",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    secret_name="MINIMAX_TOKEN",
    path="/",
))
print(secret.secret_value)
```

### Python SDK v2 — Listar Todos Secrets
```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, ListSecretsOptions

client = InfisicalClient(settings=ClientSettings(
    access_token=token,
    site_url="http://127.0.0.1:8200",
))

secrets = client.listSecrets(ListSecretsOptions(
    environment="dev",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    path="/",
))
for s in secrets.secrets:
    print(f"{s.secret_key}={s.secret_value}")
```

---

## 1. Instalar SDK

### Python
```bash
pip install infisical-python
```

### CLI
```bash
# Linux/Mac
curl -fsSL https://dl.infisical.com/install.sh | sh

# ou via npm
npm install -g @infisical/infisical-cli
```

### Verificar Instalação
```bash
infisical --version
```

---

## 2. Autenticação

### Opção A: Service Token (local/host)
```bash
# O token está gravado em:
cat /srv/ops/secrets/infisical.service-token
```

### Opção B: Login Interativo
```bash
infisical login --method=universal-auth
# Escolher: Email/Password ou Google OAuth
```

### Opção C: Via Variável de Ambiente
```bash
export INFISICAL_TOKEN="st.your-token-here"
```

---

## 3. SDK Versions — Two Patterns

O Infisical Python SDK tem duas versões com APIs diferentes:

| Aspecto | SDK v1 (Legacy) | SDK v2 (Atual) |
|---------|-----------------|----------------|
| Package | `infisical_sdk` | `infisical_client` |
| Client Class | `InfisicalSDKClient` | `InfisicalClient` |
| Init Param | `host=`, `token=` | `settings=ClientSettings(...)` |
| Secret Methods | `client.secrets.list_secrets()` | `client.listSecrets(...)` |
| Secret Schema | Atributos diretos | `GetSecretOptions`, `ListSecretsOptions` |
| Status | Funcional mas antigo | Recomendado |

### SDK v1 — Legacy (infisical_sdk)

Usado em `apps/perplexity-agent/config.py`:
```python
from infisical_sdk import InfisicalSDKClient

# Com service token
client = InfisicalSDKClient(
    host="http://127.0.0.1:8200",
    token="st.your-service-token"
)

# Listar secrets
secrets = client.secrets.list_secrets(
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/"
)
for s in secrets.secrets:
    print(f"{s.secret_key}={s.secret_value}")

# Buscar secret único
secret = client.secrets.get_secret_by_name(
    secret_name="MINIMAX_TOKEN",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/"
)
print(secret.secret_value)
```

### SDK v2 — Atual (infisical_client)

Usado em `apps/perplexity-agent/agent/browser_agent.py`:
```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions

client = InfisicalClient(settings=ClientSettings(
    access_token="st.your-service-token",
    site_url="http://127.0.0.1:8200",
))

secret = client.getSecret(GetSecretOptions(
    environment="dev",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    secret_name="MINIMAX_TOKEN",
    path="/",
))
```

---

## 4. Service Token vs User Token

### Service Token (recomendado para automação)
- Prefixo: `st.`
- Criado em: Vault UI → Project → Settings → Service Tokens
- Escopo:限定 a um projeto específico
- Validade:Até 1 ano (configurável)
- Uso: Ideal para scripts, CI/CD, containers

```python
# Service Token com SDK v2
client = InfisicalClient(settings=ClientSettings(
    access_token="st.xxx...",
    site_url="http://127.0.0.1:8200",
))
```

### Universal Auth (user-based)
- Credenciais: `client_id` + `client_secret`
- Criado em: Vault UI → Settings → Universal Auth
- Escopo: Puede ser global ou por projeto
- Validade: Token expira (precisa refresh)
- Uso: Aplicações que precisam de auth user-based

```python
from infisical_sdk import InfisicalSDKClient

client = InfisicalSDKClient(host="https://app.infisical.com")

# Login com Universal Auth
response = client.auth.universal_auth.login(
    client_id="your-client-id",
    client_secret="your-client-secret"
)
print(f"Token expira em: {response.expires_in} segundos")

# O token é automaticamente configurado no client
# Agora pode fazer operações
secrets = client.secrets.list_secrets(...)
```

---

## 5. CRUD — Create, Read, Update, Delete

### 5.1 Create Secret

**SDK v2:**
```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, CreateSecretOptions

client = InfisicalClient(settings=ClientSettings(
    access_token="st.your-token",
    site_url="http://127.0.0.1:8200",
))

# Criar secret
new_secret = client.createSecret(CreateSecretOptions(
    environment="dev",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    secret_name="NEW_SECRET_KEY",
    secret_value="secret_value_here",
    path="/",
    secret_comment="Created via SDK",
))
print(f"Criado: {new_secret.secret_key}")
```

**SDK v1 (legacy):**
```python
from infisical_sdk import InfisicalSDKClient

client = InfisicalSDKClient(
    host="http://127.0.0.1:8200",
    token="st.your-token"
)

new_secret = client.secrets.create_secret_by_name(
    secret_name="NEW_SECRET_KEY",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/",
    secret_value="secret_value_here",
    secret_comment="Created via SDK v1",
)
```

### 5.2 Read Secret

```python
# SDK v2
secret = client.getSecret(GetSecretOptions(
    environment="dev",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    secret_name="MINIMAX_TOKEN",
    path="/",
))
print(secret.secret_value)

# SDK v1
secret = client.secrets.get_secret_by_name(
    secret_name="MINIMAX_TOKEN",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/",
)
print(secret.secret_value)
```

### 5.3 Update Secret

**SDK v2:**
```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, UpdateSecretOptions

client = InfisicalClient(settings=ClientSettings(
    access_token="st.your-token",
    site_url="http://127.0.0.1:8200",
))

updated = client.updateSecret(UpdateSecretOptions(
    environment="dev",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    secret_name="MINIMAX_TOKEN",
    path="/",
    secret_value="novo_valor_aqui",
    secret_comment="Rotated via SDK",
))
print(f"Atualizado: {updated.secret_key} v{updated.version}")
```

**SDK v1 (legacy):**
```python
updated = client.secrets.update_secret_by_name(
    current_secret_name="MINIMAX_TOKEN",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/",
    secret_value="novo_valor_aqui",
    secret_comment="Rotated via SDK",
)
print(f"Atualizado: {updated.secret_key}")
```

### 5.4 Delete Secret

**SDK v2:**
```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, DeleteSecretOptions

client = InfisicalClient(settings=ClientSettings(
    access_token="st.your-token",
    site_url="http://127.0.0.1:8200",
))

deleted = client.deleteSecret(DeleteSecretOptions(
    environment="dev",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    secret_name="OLD_SECRET_KEY",
    path="/",
))
print(f"Deletado: {deleted.secret_key}")
```

**SDK v1 (legacy):**
```python
deleted = client.secrets.delete_secret_by_name(
    secret_name="OLD_SECRET_KEY",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/",
)
print(f"Deletado: {deleted.secret_key}")
```

### 5.5 Update com Error Handling Completo

```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, UpdateSecretOptions
from infisical_client.errors import InfisicalError
import os

def rotate_secret(secret_name: str, new_value: str) -> dict:
    """Rotaciona um secret com error handling completo.

    Returns:
        dict com 'success', 'secret_key', 'version'
    Raises:
        RuntimeError: se não conseguir rotacionar
    """
    token_path = os.environ.get(
        "INFISICAL_TOKEN_PATH",
        "/srv/ops/secrets/infisical.service-token"
    )
    site_url = os.environ.get("INFISICAL_SITE_URL", "http://127.0.0.1:8200")
    project_id = os.environ.get("INFISICAL_PROJECT_ID", "e42657ef-98b2-4b9c-9a04-46c093bd6d37")
    environment = os.environ.get("INFISICAL_ENV", "dev")

    # Ler token
    try:
        with open(token_path) as f:
            token = f.read().strip()
    except FileNotFoundError:
        raise RuntimeError(f"Token file not found: {token_path}")
    except PermissionError:
        raise RuntimeError(f"Permission denied: {token_path}")

    if not token:
        raise RuntimeError("Token file is empty")

    # Criar client
    client = InfisicalClient(settings=ClientSettings(
        access_token=token,
        site_url=site_url,
    ))

    # Atualizar secret
    try:
        updated = client.updateSecret(UpdateSecretOptions(
            environment=environment,
            project_id=project_id,
            secret_name=secret_name,
            path="/",
            secret_value=new_value,
        ))
        return {
            "success": True,
            "secret_key": updated.secret_key,
            "version": updated.version,
        }
    except InfisicalError as e:
        error_msg = str(e).lower()
        if "not found" in error_msg or "secret does not exist" in error_msg:
            raise RuntimeError(f"Secret '{secret_name}' not found in vault")
        elif "unauthorized" in error_msg or "invalid token" in error_msg:
            raise RuntimeError("Invalid or expired service token")
        elif "forbidden" in error_msg or "permission denied" in error_msg:
            raise RuntimeError(f"No permission to update '{secret_name}'")
        else:
            raise RuntimeError(f"Infisical error updating secret: {e}")
    except Exception as e:
        raise RuntimeError(f"Unexpected error: {e}")

# Uso
try:
    result = rotate_secret("COOLIFY_API_KEY", "7|newTokenHere...")
    print(f"Success: {result['secret_key']} v{result['version']}")
except RuntimeError as e:
    print(f"Failed: {e}")
```

---

## 6. Batch Operations

O SDK Python **não possui métodos batch dedicados** para criar/atualizar múltiplos secrets de uma vez. O padrão é iterar:

### Batch Update (loop)

```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, UpdateSecretOptions

client = InfisicalClient(settings=ClientSettings(
    access_token="st.your-token",
    site_url="http://127.0.0.1:8200",
))

secrets_to_update = [
    ("SECRET_A", "value_a"),
    ("SECRET_B", "value_b"),
    ("SECRET_C", "value_c"),
]

results = []
for secret_name, secret_value in secrets_to_update:
    try:
        updated = client.updateSecret(UpdateSecretOptions(
            environment="dev",
            project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
            secret_name=secret_name,
            path="/",
            secret_value=secret_value,
        ))
        results.append({"name": secret_name, "status": "ok", "version": updated.version})
    except Exception as e:
        results.append({"name": secret_name, "status": "error", "error": str(e)})

for r in results:
    print(f"{r['name']}: {r['status']}")
```

### Batch Create (loop + skip duplicates)

```python
secrets_to_create = [
    ("NEW_SECRET_1", "value_1"),
    ("NEW_SECRET_2", "value_2"),
]

for secret_name, secret_value in secrets_to_create:
    try:
        client.createSecret(CreateSecretOptions(
            environment="dev",
            project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
            secret_name=secret_name,
            secret_value=secret_value,
            path="/",
        ))
        print(f"Created: {secret_name}")
    except InfisicalError as e:
        if "already exists" in str(e).lower():
            print(f"Skipped (exists): {secret_name}")
        else:
            raise
```

---

## 7. Padrão com Fallback (Prioridade env var > Infisical)

```python
import os

def get_with_fallback(secret_name: str, env_var: str = None) -> str:
    """Prioridade: env var > Infisical vault.

    Útil para:
    - Coolify secret injection (env var优先级最高)
    - Desenvolvimento local (usa vault)
    """
    # Priority 1: env var (Coolify/host injection)
    if env_var:
        env_val = os.environ.get(env_var)
        if env_val:
            return env_val

    # Priority 2: Infisical vault
    from infisical_client import InfisicalClient
    from infisical_client.schemas import ClientSettings, GetSecretOptions

    token_path = os.environ.get(
        "INFISICAL_TOKEN_PATH",
        "/srv/ops/secrets/infisical.service-token"
    )
    with open(token_path) as f:
        token = f.read().strip()

    client = InfisicalClient(settings=ClientSettings(
        access_token=token,
        site_url=os.environ.get("INFISICAL_SITE_URL", "http://127.0.0.1:8200"),
    ))

    secret = client.getSecret(GetSecretOptions(
        environment=os.environ.get("INFISICAL_ENV", "dev"),
        project_id=os.environ.get(
            "INFISICAL_PROJECT_ID",
            "e42657ef-98b2-4b9c-9a04-46c093bd6d37"
        ),
        secret_name=secret_name,
        path="/",
    ))
    return secret.secret_value

# Uso
MINIMAX = get_with_fallback("MINIMAX_TOKEN", "MINIMAX_TOKEN")
```

---

## 8. Projetos e Environments

| Projeto ID | Environment | Descrição |
|-----------|------------|-----------|
| `e42657ef-98b2-4b9c-9a04-46c093bd6d37` | dev | homelab-zappro |
| (outro) | prod | Produção |

### Listar Secrets de um Projeto
```bash
infisical secrets list --env=dev --project-id=e42657ef-98b2-4b9c-9a04-46c093bd6d37
```

---

## 9. CLI — Comandos Essenciais

### Buscar um secret
```bash
infisical secrets get MINIMAX_TOKEN --env=dev --plain
```

### Listar todos secrets
```bash
infisical secrets list --env=dev
```

### Criar ou atualizar secret
```bash
infisical secrets set COOLIFY_API_KEY --value="7|2Lqe2UXliI2jBckqIttjmPjmpf9yBVISDNNu0C4s38a54332" --env=dev
```

### Deletar secret
```bash
infisical secrets delete NOME_DO_SECRET --env=dev
```

### Importar de .env
```bash
infisical secrets set --env=dev < .env
```

---

## 10. Erros Comuns — Troubleshooting

| Erro | Causa | Solução |
|------|-------|---------|
| `ModuleNotFoundError: No module named 'infisical_client'` | SDK não instalado | `pip install infisical-python` |
| `ModuleNotFoundError: No module named 'infisical_sdk'` | SDK legacy não instalado | `pip install infisical-sdk` |
| `infisical: command not found` | CLI não instalada | `curl -fsSL https://dl.infisical.com/install.sh \| sh` |
| `Invalid token` | Token expirado ou mal formatado | Regenerar em vault.zappro.site |
| `Project not found` | Project ID errado | Verificar ID em vault.zappro.site/settings |
| `Environment not found` | Environment errado | Usar `dev` ou `prod` |
| `Secret not found` | Secret não existe | Criar via `infisical secrets set` |
| `UnauthorizedError` | Token inválido ou expirado | Regenerar service token |
| `ForbiddenError` | Sem permissão no projeto | Verificar scopes do token |
| `Secret already exists` | Tentativa de criar secret duplicado | Usar update em vez de create |
| `Connection refused` | Infisical server offline | Verificar se vault está rodando |
| `HTTP 400` | Parâmetros inválidos | Verificar project_id, environment_slug |

### Error Handling Genérico

```python
from infisical_sdk import InfisicalSDKClient, InfisicalError

client = InfisicalSDKClient(
    host="http://127.0.0.1:8200",
    token="st.your-token"
)

try:
    secret = client.secrets.get_secret_by_name(...)
except InfisicalError as e:
    error_code = getattr(e, 'code', None)
    error_msg = str(e)

    if error_code == 404 or "not found" in error_msg.lower():
        print("Secret não existe")
    elif error_code == 401 or "unauthorized" in error_msg.lower():
        print("Token inválido")
    elif error_code == 403 or "forbidden" in error_msg.lower():
        print("Sem permissão")
    else:
        print(f"Erro Infisical: {e}")
except Exception as e:
    print(f"Erro inesperado: {e}")
```

---

## 11. Atualizar Secret — Exemplo Completo (Coolify API Key)

### Passo 1: Criar API Token no Coolify
1. Acessar https://coolify.zappro.site/security/api-tokens
2. Clicar "+ Add"
3. Nome: `claude-code`
4. Clicar "Create"
5. **COPIAR o token gerado** (formato `7|xxx...`)

### Passo 2: Atualizar no Infisical via CLI
```bash
infisical secrets set COOLIFY_API_KEY \
  --value="7|2Lqe2UXliI2jBckqIttjmPjmpf9yBVISDNNu0C4s38a54332" \
  --env=dev
```

### Passo 3: Verificar
```bash
infisical secrets get COOLIFY_API_KEY --env=dev --plain
```

### Passo 4: Testar Auth no Coolify
```bash
curl -s http://localhost:8000/api/v1/applications \
  -H "Authorization: Bearer 7|2Lqe2UXliI2jBckqIttjmPjmpf9yBVISDNNu0C4s38a54332"
```
**Esperado:** JSON com lista de aplicações (não `{"message":"Unauthenticated."}`)

---

## 12. Em Código — Como Usar

### Em Docker Compose
```yaml
services:
  my-app:
    environment:
      - COOLIFY_API_KEY=${COOLIFY_API_KEY}  # Injetado via Infisical
```

### Em Coolify (secret injection)
```
# No campo de environment do Coolify:
COOLIFY_API_KEY={{ COOLIFY_API_KEY }}
# Coolify automaticamente injeta do Infisical
```

### Em Python (com fallback)
```python
import os
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions

def init_coolify_client():
    """Inicializa cliente Coolify com token do Infisical."""
    # Tentar ler do env primeiro (Coolify secret injection)
    api_key = os.environ.get("COOLIFY_API_KEY")
    if not api_key:
        # Fallback: Infisical vault
        with open("/srv/ops/secrets/infisical.service-token") as f:
            token = f.read().strip()
        vault = InfisicalClient(settings=ClientSettings(
            access_token=token,
            site_url="http://127.0.0.1:8200",
        ))
        api_key = vault.getSecret(GetSecretOptions(
            environment="dev",
            project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
            secret_name="COOLIFY_API_KEY",
            path="/",
        )).secret_value
    return api_key
```

---

## 13. Reference

| Resource | URL |
|----------|-----|
| Vault UI | https://vault.zappro.site |
| Docs | https://infisical.com/docs |
| SDK Python | https://github.com/Infisical/infisical-python |
| CLI Docs | https://infisical.com/docs/cli/overview |
| Project ID | `e42657ef-98b2-4b9c-9a04-46c093bd6d37` |

---

## 14. Padrão de Nomenclatura de Secrets

```
COOLIFY_API_KEY      — Coolify API token
COOLIFY_URL          — https://coolify.zappro.site ou http://localhost:8000
MINIMAX_TOKEN        — MiniMax API token (Chat Completion)
LITELLM_MASTER_KEY   — LiteLLM master key
GITEA_TOKEN          — Gitea personal access token
CLAUDE_API_KEY       — Claude API key
GOOGLE_CLIENT_ID     — Google OAuth client ID
GOOGLE_CLIENT_SECRET — Google OAuth client secret
```
