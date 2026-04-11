# API Tokens & Service Accounts — Canonical Reference

**Data:** 2026-04-11
**Autor:** will
**Para:** Todas as LLMs — ler primeiro antes de usar qualquer API

---

## Resumo: Tokens Disponíveis no Vault

| Secret | Valor/Formato | Uso | Status |
|--------|--------------|-----|--------|
| `GITEA_TOKEN` | `tok_...` | Gitea API (PAT) | ✅ CRIADO |
| `GRAFANA_SERVICE_ACCOUNT_TOKEN` | `glsa_...` | Grafana API | ✅ CRIADO |
| `COOLIFY_API_KEY` | `7\|...` | Coolify API | ✅ JÁ EXISTIA |
| `INFINISICAL_TOKEN` | `st....` | Infisical vault | ✅ JÁ EXISTIA |
| `TELEGRAM_BOT_TOKEN` | `bot...` | Telegram notifications | ✅ JÁ EXISTIA |
| `GITHUB_TOKEN` | — | GitHub API | ✅ JÁ EXISTIA |

---

## GITEA_TOKEN — Gitea API

**Formato:** `tok_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

**Scopes necessários:** `repo`, `workflow`, `read:user`

### Python (Infisical SDK)

```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions

client = InfisicalClient(settings=ClientSettings(
    access_token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    site_url='http://127.0.0.1:8200',
))

token = client.getSecret(GetSecretOptions(
    environment='dev',
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    secret_name='GITEA_TOKEN',
    path='/',
)).secret_value

import requests
response = requests.get(
    'https://git.zappro.site/api/v1/user',
    headers={'Authorization': f'token {token}'}
)
```

### Bash

```bash
export GITEA_TOKEN="$(python3 -c "
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions
c = InfisicalClient(settings=ClientSettings(
    access_token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    site_url='http://127.0.0.1:8200',
))
print(c.getSecret(GetSecretOptions(
    environment='dev',
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    secret_name='GITEA_TOKEN',
    path='/',
)).secret_value)
")"
```

---

## GRAFANA_SERVICE_ACCOUNT_TOKEN — Grafana API

**Formato:** `glsa_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

> **IMPORTANTE:** Grafana open source NÃO usa API Keys. Usa Service Accounts + Tokens.
> NUNCA use `/apikeys` — isso é Grafana Cloud only.

### Python (Infisical SDK)

```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions

client = InfisicalClient(settings=ClientSettings(
    access_token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    site_url='http://127.0.0.1:8200',
))

token = client.getSecret(GetSecretOptions(
    environment='dev',
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    secret_name='GRAFANA_SERVICE_ACCOUNT_TOKEN',
    path='/',
)).secret_value

import requests
response = requests.get(
    'http://localhost:3000/api/dashboards',
    headers={'Authorization': f'Bearer {token}'}
)
```

### Bash

```bash
export GRAFANA_TOKEN="$(python3 -c "
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions
c = InfisicalClient(settings=ClientSettings(
    access_token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    site_url='http://127.0.0.1:8200',
))
print(c.getSecret(GetSecretOptions(
    environment='dev',
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    secret_name='GRAFANA_SERVICE_ACCOUNT_TOKEN',
    path='/',
)).secret_value)
")"
```

---

## COOLIFY_API_KEY — Coolify API

**Formato:** `7|xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`

### Python (Infisical SDK)

```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions

client = InfisicalClient(settings=ClientSettings(
    access_token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    site_url='http://127.0.0.1:8200',
))

api_key = client.getSecret(GetSecretOptions(
    environment='dev',
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    secret_name='COOLIFY_API_KEY',
    path='/',
)).secret_value

import requests
response = requests.get(
    'http://localhost:8000/api/v1/applications',
    headers={'Authorization': f'Bearer {api_key}'}
)
```

---

## Anti-Padrões (NUNCA fazer)

### Grafana
❌ `Authorization: Bearer $GRAFANA_API_KEY` — API Keys não existem em open source
❌ `curl https://monitor.zappro.site/apikeys` — página não existe

### Gitea
❌ `Authorization: Bearer $GITEA_RUNNER_REGISTRATION_TOKEN` — runner token não serve para API

### Coolify
❌ IP fora AllowList — adicionar IP em https://cloud.zappro.site/settings/allowlist

---

## Padrão de Nomenclatura

| Serviço | Secret | Formato |
|---------|--------|---------|
| Gitea | `GITEA_TOKEN` | `tok_...` |
| Grafana | `GRAFANA_SERVICE_ACCOUNT_TOKEN` | `glsa_...` |
| Coolify | `COOLIFY_API_KEY` | `7\|...` |
| Infisical | `st....` (service token) | ficheiro local |

---

## Source of Truth

**Vault:** Infisical at `http://127.0.0.1:8200`
**Project ID:** `e42657ef-98b2-4b9c-9a04-46c093bd6d37`
**Environment:** `dev`
**Secret path:** `/`
**Token file:** `/srv/ops/secrets/infisical.service-token`

**Governance docs:**
- `docs/GOVERNANCE/API-TOKENS.md` (este ficheiro)
- `docs/GOVERNANCE/GRAFANA-SERVICE-ACCOUNT.md` (detailed Grafana)
