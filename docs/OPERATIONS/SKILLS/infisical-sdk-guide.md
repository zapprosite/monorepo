# Infisical SDK + CLI Guide

**Data:** 2026-04-11
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

### Opção C: Viavariável de Ambiente
```bash
export INFISICAL_TOKEN="st.your-token-here"
```

---

## 3. Projetos e Environments

| Projeto ID | Environment | Descrição |
|-----------|------------|-----------|
| `e42657ef-98b2-4b9c-9a04-46c093bd6d37` | dev | homelab-zappro |
| (outro) | prod | Produção |

### Listar Secrets de um Projeto
```bash
infisical secrets list --env=dev --project-id=e42657ef-98b2-4b9c-9a04-46c093bd6d37
```

---

## 4. CLI — Comandos Essenciais

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

## 5. Python SDK v2 — Padrão Correto

### Estrutura do SDK
```
infisical-python (PyPI)
└── infisical_client (módulo)
    ├── InfisicalClient (cliente principal)
    ├── ClientSettings (configuração)
    └── schemas
        ├── GetSecretOptions
        ├── ListSecretsOptions
        └── ... (outros schemas)
```

### Buscar Secret Único
```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions
import os

def get_secret(secret_name: str) -> str:
    """Busca um secret do Infisical vault."""
    # 1. Ler token do ficheiro
    token_path = os.environ.get(
        "INFISICAL_TOKEN_PATH",
        "/srv/ops/secrets/infisical.service-token"
    )
    with open(token_path) as f:
        token = f.read().strip()

    # 2. Criar cliente
    client = InfisicalClient(settings=ClientSettings(
        access_token=token,
        site_url=os.environ.get("INFISICAL_SITE_URL", "http://127.0.0.1:8200"),
    ))

    # 3. Buscar secret
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
minimax_key = get_secret("MINIMAX_TOKEN")
coolify_key = get_secret("COOLIFY_API_KEY")
```

### Padrão com Fallback (Prioridade env var > Infisical)
```python
def get_with_fallback(secret_name: str, env_var: str) -> str:
    """Prioridade: env var > Infisical vault."""
    # Priority 1: env var (Coolify secret injection)
    env_val = os.environ.get(env_var)
    if env_val:
        return env_val

    # Priority 2: Infisical vault
    return get_secret(secret_name)

MINIMAX = get_with_fallback("MINIMAX_TOKEN", "MINIMAX_TOKEN")
```

### Listar Todos Secrets
```python
from infisical_client.schemas import ListSecretsOptions

secrets = client.listSecrets(ListSecretsOptions(
    environment="dev",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    path="/",
))
for s in secrets.secrets:
    print(f"  {s.secret_key}")
```

---

## 6. Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| `ModuleNotFoundError: No module named 'infisical_client'` | SDK não instalado | `pip install infisical-python` |
| `infisical: command not found` | CLI não instalada | `curl -fsSL https://dl.infisical.com/install.sh \| sh` |
| `Invalid token` | Token expirado ou mal formatado | Regenerar em vault.zappro.site |
| `Project not found` | Project ID errado | Verificar ID em vault.zappro.site/settings |
| `Environment not found` | Environment errado | Usar `dev` ou `prod` |
| `Secret not found` | Secret não existe | Criar via `infisical secrets set` |

---

## 7. Atualizar Secret — Exemplo Completo (Coolify API Key)

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

## 8. Em Código — Como Usar

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
# Coolify会自动从Infisical注入
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

## 9. Reference

| Resource | URL |
|----------|-----|
| Vault UI | https://vault.zappro.site |
| Docs | https://infisical.com/docs |
| SDK Python | https://github.com/Infisical/infisical-python |
| CLI Docs | https://infisical.com/docs/cli/overview |
| Project ID | `e42657ef-98b2-4b9c-9a04-46c093bd6d37` |

---

## 10. Padrão de Nomenclatura de Secrets

```
COOLIFY_API_KEY      — Coolify API token
COOLIFY_URL          — https://coolify.zappro.site ou http://localhost:8000
MINIMAX_TOKEN        — MiniMax API token (Chat Completion)
LITELLM_MASTER_KEY   — LiteLLM master key
GITEA_TOKEN          — Gitea personal access token
CLAUDE_API_KEY       — Claude API key
```
