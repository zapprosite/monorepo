# Grafana Service Account — Canonical Reference

**Data:** 2026-04-11
**Autor:** will
**Para:** Todas as LLMs — ler primeiro antes de usar Grafana API

---

## Resumo

Grafana open source auto-hospedado (`monitor.zappro.site`) usa **Service Accounts + Tokens** para autenticação API — **NÃO** usa API Keys como Grafana Cloud.

| Secret | Valor | Local |
|--------|-------|-------|
| `GRAFANA_SERVICE_ACCOUNT_TOKEN` | `glsa_YtplRI7ir06s4D45PCAS9Pm31AgxHwRkka8zuH1b9k` | Infisical vault |
| `GRAFANA_ADMIN_PASSWORD` | *(já existe)* | Infisical vault |
| `GRAFANA_URL` | `http://localhost:3000` ou `https://monitor.zappro.site` | Infisical vault |

---

## Como Autenticar — Grafana Open Source

### Método 1: Service Account Token (RECOMENDADO)

```bash
curl -H "Authorization: Bearer glsa_YtplRI7ir06s4D45PCAS9Pm31AgxHwRkka8zuH1b9k" \
  http://localhost:3000/api/dashboards
```

### Método 2: Admin Password (Basic Auth) — SÓ para criar Service Account

```bash
# Criar Service Account
curl -X POST -u admin:$GRAFANA_ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"name": "cursor-loop", "role": "Viewer"}' \
  http://localhost:3000/api/serviceaccounts

# Criar token para o Service Account
curl -X POST -u admin:$GRAFANA_ADMIN_PASSWORD \
  -H "Content-Type: application/json" \
  -d '{"name": "cursor-loop-token"}' \
  http://localhost:3000/api/serviceaccounts/1/tokens
```

**NUNCA** use Admin Password para operações normais — use Service Account Token.

---

## Como Usar em Código (Infisical SDK)

### Python — Obter Token do Vault

```python
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions

def get_grafana_token() -> str:
    """Obtém Grafana Service Account token do Infisical."""
    client = InfisicalClient(settings=ClientSettings(
        access_token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
        site_url='http://127.0.0.1:8200',
    ))
    return client.getSecret(GetSecretOptions(
        environment='dev',
        project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
        secret_name='GRAFANA_SERVICE_ACCOUNT_TOKEN',
        path='/',
    )).secret_value

# Uso
token = get_grafana_token()
import requests
response = requests.get(
    'http://localhost:3000/api/dashboards',
    headers={'Authorization': f'Bearer {token}'}
)
```

### Python — Dashboard CRUD Completo

```python
import requests
from infisical_client import InfisicalClient
from infisical_client.schemas import ClientSettings, GetSecretOptions

class GrafanaClient:
    def __init__(self):
        self.client = InfisicalClient(settings=ClientSettings(
            access_token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
            site_url='http://127.0.0.1:8200',
        ))
        self.base_url = 'http://localhost:3000/api'
        self.token = self.client.getSecret(GetSecretOptions(
            environment='dev',
            project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
            secret_name='GRAFANA_SERVICE_ACCOUNT_TOKEN',
            path='/',
        )).secret_value

    def _headers(self):
        return {'Authorization': f'Bearer {self.token}', 'Content-Type': 'application/json'}

    def list_dashboards(self):
        r = requests.get(f'{self.base_url}/search', headers=self._headers())
        r.raise_for_status()
        return r.json()

    def get_dashboard(self, uid):
        r = requests.get(f'{self.base_url}/dashboards/uid/{uid}', headers=self._headers())
        r.raise_for_status()
        return r.json()

    def create_dashboard(self, folder_uid, dashboard_json):
        payload = {
            'dashboard': dashboard_json,
            'folderUid': folder_uid,
            'overwrite': True
        }
        r = requests.post(f'{self.base_url}/dashboards/db', json=payload, headers=self._headers())
        r.raise_for_status()
        return r.json()

# Uso
grafana = GrafanaClient()
dashboards = grafana.list_dashboards()
```

### Bash — Com Env Var (export do Infisical)

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

# Listar dashboards
curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" \
  http://localhost:3000/api/search | jq .

# Listar datasources
curl -s -H "Authorization: Bearer $GRAFANA_TOKEN" \
  http://localhost:3000/api/datasources | jq .
```

---

## Padrão de Nomenclatura

| Tipo | Prefixo | Exemplo |
|------|---------|---------|
| Service Account Token | `glsa_` | `glsa_YtplRI7ir06s4D45PCAS9...` |
| API Key (legacy) | — | Não usado em open source |

---

## Anti-Padrões (NUNCA fazer)

❌ **NÃO use API Keys** — não existem em Grafana open source
```bash
# ERRADO — Isto é Grafana Cloud
curl -H "Authorization: Bearer $GRAFANA_API_KEY" ...
```

❌ **NÃO use página `/apikeys`** — é Grafana Cloud only
```bash
# ERRADO — monitor.zappro.site não tem esta página
curl https://monitor.zappro.site/apikeys
```

❌ **NÃO use Basic Auth com password em produção** — use Service Account Token
```bash
# ERRADO para produção
curl -u admin:$GRAFANA_ADMIN_PASSWORD ...
```

---

## Referência Rápida

| Operção | Endpoint | Auth |
|---------|----------|------|
| List dashboards | `GET /api/search` | Bearer token |
| Get dashboard | `GET /api/dashboards/uid/{uid}` | Bearer token |
| Create dashboard | `POST /api/dashboards/db` | Bearer token |
| List datasources | `GET /api/datasources` | Bearer token |
| List folders | `GET /api/folders` | Bearer token |
| List alerts | `GET /api/alerts` | Bearer token |
| Create Service Account | `POST /api/serviceaccounts` | Basic auth (admin) |
| Create token | `POST /api/serviceaccounts/{id}/tokens` | Basic auth (admin) |

---

## Source of Truth

- Token: **Infisical vault** (`e42657ef-98b2-4b9c-9a04-46c093bd6d37/dev/GRAFANA_SERVICE_ACCOUNT_TOKEN`)
- Docs: **Este ficheiro** (`docs/GOVERNANCE/GRAFANA-SERVICE-ACCOUNT.md`)
- Grafana UI: `https://monitor.zappro.site`
- Local: `http://localhost:3000`
