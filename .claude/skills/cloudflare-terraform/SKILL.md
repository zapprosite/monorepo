---
name: cloudflare-terraform
description: Terraform + Cloudflare Zero Trust Tunnel management for homelab — add subdomains, manage DNS, configure tunnel ingress rules.
---

# Cloudflare Terraform Skill

## Arquitectura

```
Terraform files: /srv/ops/terraform/cloudflare/
├── main.tf          # Cloudflare Tunnel + DNS records
├── variables.tf     # Service definitions (services map)
├── data.tf          # Data sources
├── access.tf        # Cloudflare Access policies
├── provider.tf      # Cloudflare provider
├── outputs.tf       # Output values
├── terraform.tfvars # Secret values (gitignored)
└── terraform.tfstate # State (local, gitignored)
```

---

## Fluxo: Adicionar Novo Subdomain

### Passo 1: Editar `variables.tf`

Adicionar entrada ao map `services`:

```hcl
services = {
  # ... existente ...
  new_service = {
    url              = "http://10.0.x.x:8080"
    subdomain        = "newservice"        # → newservice.zappro.site
    http_host_header = null               # ou "container-name.sslip.io"
  }
}
```

### Passo 2: Plan

```bash
cd /srv/ops/terraform/cloudflare
terraform plan -out=tfplan
```

### Passo 3: Apply

```bash
terraform apply tfplan
```

### Passo 4: Verificar

```bash
curl -sfI https://newservice.zappro.site/
# Esperado: 200, 301, 302 (não "Connection refused")
```

### Passo 5: Smoke Test OAuth (se aplicável)

Se o serviço usa Google OAuth native (MVP pattern sem Cloudflare Access):

```bash
# Teste de callback OAuth
curl -sfI https://newservice.zappro.site/auth/callback
# Deve retornar HTTP 200

# Verificar que Cloudflare Access NÃO bloqueia (excluir do access.tf)
# O access.tf exclui: bot, list, md (OAuth native, sem Access)
```

---

## Padrão OAuth: MVP vs Cloudflare Access

### MVP Pattern (OAuth Native — sem Cloudflare Access)

Apps como `list-web`, `md.zappro.site` usam **Google OAuth direto** sem proteção Cloudflare:

```hcl
# access.tf — exclude da Cloudflare Access
access_services = { for k, v in var.services : k => v if k != "bot" && k != "list" && k != "md" }
```

O app serve o OAuth flow completo (login Google → callback → token exchange).

### Cloudflare Access Pattern (protegido)

Serviços como `vault.zappro.site` usam Cloudflare Access + Google OAuth.

---

## OAuth Client Configuration (CRÍTICO)

### Para apps com Google OAuth client-side

Quando o app faz token exchange no browser (não via backend), o `client_secret` **DEVE** ser incluído no POST body:

```javascript
// Token exchange POST body — OBRIGATÓRIO
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=GOOGLE_CLIENT_ID
&client_secret=GOOGLE_CLIENT_SECRET    ← SEMPRE PRESENTE
&code=AUTH_CODE
&code_verifier=PKCE_VERIFIER
&redirect_uri=https://subdomain.zappro.site/auth/callback
```

**Sem `client_secret` → `invalid_client` ou `client_secret is missing`**

### Google OAuth Credentials (homelab)

```
GOOGLE_CLIENT_ID=→ Infisical: GOOGLE_CLIENT_ID (project: obsidian-web)
GOOGLE_CLIENT_SECRET=→ Infisical: GOOGLE_CLIENT_SECRET (project: obsidian-web)
```

**NÃO usar credenciais legacy:**
- `297107448858-324eplshrg5vv2br911l4dtm8bjh0sl1.apps.googleusercontent.com` → LEGACY, não usar

### Env vars no docker-compose.yml

```yaml
services:
  app-name:
    environment:
      GOOGLE_CLIENT_ID: "${GOOGLE_CLIENT_ID}"  # Infisical: obsidian-web/GOOGLE_CLIENT_ID
      GOOGLE_CLIENT_SECRET: "${GOOGLE_CLIENT_SECRET}"  # Infisical: obsidian-web/GOOGLE_CLIENT_SECRET
```

---

## Variáveis Importantes

### `services` map — todos os subdomínios

| Subdomain | URL | http_host_header | Acesso | Notas |
|-----------|-----|------------------|--------|-------|
| `api.zappro.site` | 10.0.1.1:4000 | - | Cloudflare Access | LiteLLM |
| `bot.zappro.site` | localhost:4001 | openclaw-qgtzrmi... | **OAuth native** | sem Access |
| `chat.zappro.site` | 10.0.5.2:8080 | openwebui-wbmqefx... | Cloudflare Access | OpenWebUI |
| `coolify.zappro.site` | localhost:8000 | - | Cloudflare Access | Coolify |
| `git.zappro.site` | localhost:3300 | - | Cloudflare Access | Gitea |
| `llm.zappro.site` | 10.0.1.1:4000 | - | Cloudflare Access | LiteLLM |
| `list.zappro.site` | localhost:4080 | - | **OAuth native** | sem Access |
| `md.zappro.site` | localhost:4081 | - | **OAuth native** | sem Access |
| `monitor.zappro.site` | localhost:3100 | - | LAN only | Grafana |
| `n8n.zappro.site` | 10.0.6.2:5678 | - | Cloudflare Access | n8n |
| `painel.zappro.site` | localhost:4003 | - | Cloudflare Access | Painel |
| `qdrant.zappro.site` | 10.0.19.5:6333 | - | Cloudflare Access | Qdrant |
| `vault.zappro.site` | localhost:8200 | - | Cloudflare Access | Infisical |

### `tunnel_name`
- Default: `will-zappro-homelab`
- NÃO mudar — é o nome do tunnel existente

### `domain`
- Default: `zappro.site`

---

## Comandos Terraform

```bash
cd /srv/ops/terraform/cloudflare

# Validar configuração
terraform validate

# Ver alterações planejadas
terraform plan -out=tfplan

# Aplicar alterações
terraform apply tfplan

# Destruir (CUIDADO!)
terraform destroy

# Refresh do state
terraform refresh

# Output values
terraform output
```

---

## Adicionar Cloudflare Access (proteger com OAuth)

### Exemplo: Proteger `api.zappro.site` com Google OAuth

Em `access.tf` ou novo ficheiro:

```hcl
resource "cloudflare_access_application" "api" {
  account_id = var.cloudflare_account_id
  name       = "API"
  domain     = "api.zappro.site"
  policy {
    name  = "Allow zappro.site"
    decision = "allow"
    include {
      email {
        domain = "zappro.site"
      }
    }
  }
}
```

### OAuth Native apps (MVP) — NÃO adiciona a Access

Apps que usam OAuth nativo (Google login direto no app) DEVEM ser **excluídos** do Cloudflare Access:

```hcl
# access.tf —Exclude OAuth-native apps
access_services = { for k, v in var.services : k => v if k != "bot" && k != "list" && k != "md" }
```

**Quando adicionar novo subdomain OAuth-native:**
1. Adicionar em `variables.tf` normalmente
2. NÃO adicionar em access.tf (já exclui via filter)
3. O app implementa OAuth flow completo

---

## Secrets em Terraform

### Variáveis sensíveis (NUNCA commitar)

| Variável | Onde definir |
|----------|-------------|
| `cloudflare_api_token` | `terraform.tfvars` ou env `TF_VAR_cloudflare_api_token` |
| `cloudflare_account_id` | `terraform.tfvars` ou env |
| `cloudflare_zone_id` | `terraform.tfvars` ou env |
| `google_client_id` | `terraform.tfvars` |
| `google_client_secret` | `terraform.tfvars` |

### Obter valores do Infisical

```python
from infisical_sdk import InfisicalSDKClient
client = InfisicalSDKClient(
    host='http://127.0.0.1:8200',
    token=open('/srv/ops/secrets/infisical.service-token').read().strip()
)
secrets = client.secrets.list_secrets(
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == 'CLOUDFLARE_API_TOKEN':
        print(s.secret_value)
```

---

## Troubleshooting

### "Connection refused" no subdomain
- Cloudflare Tunnel pode estar a apontar para IP errado
- Verificar `http_host_header` em `variables.tf`
- O `http_host_header` é necessário quando o serviço faz bind a um hostname específico

### "invalid_client" OAuth error
1. Verificar que `client_secret` está no token exchange POST body
2. Verificar que `client_id` e `client_secret` são os corretos (não legacy)
3. Verificar redirect_uri em Google Cloud Console

### "client_secret is missing"
- O token exchange POST body **não inclui** `client_secret`
- Adicionar `client_secret` ao body → Infisical: obsidian-web/GOOGLE_CLIENT_SECRET

### Terraform state desactualizado
```bash
terraform refresh
terraform plan  # ver diferenças
```

### Tunnel não aparece no Cloudflare Dashboard
- O tunnel é gerido pelo Terraform
- NÃO editar manualmente no dashboard — Terraform vai sobrepor

### DNS records não existem
```bash
# Ver Cloudflare API
curl -X GET "https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

---

## Integration com Cursor-Loop

O cursor-loop pode usar Cloudflare para:
1. Adicionar subdomain para novo serviço
2. Actualizar DNS
3. Configurar Access policy

**Não fazer automaticamente:**
- Criar novos tunnels
- Mudar `tunnel_name`
- Remover serviços existentes

**Permitido automaticamente:**
- Adicionar novo subdomain a serviço existente
- Actualizar `http_host_header`
- Excluir novo subdomain da Access (se OAuth-native)

---

## Ficheiros

- **State:** `terraform.tfstate` (local, gitignored)
- **Backup:** `terraform.tfstate.backup`
- **Tunnel credentials:** `~/.cloudflared/config.yml`



## Quick API Flow (no Terraform)

Para casos em que `terraform apply` é lento ou indisponivel, usar a Cloudflare API diretamente.

### IDs Fixos (homelab)

```
Account ID:  1a41f45591a50585050f664fa015d01b
Zone ID:     c0cf47bc153a6662f884d0f91e8da7c2
Tunnel ID:   aee7a93d-c2e2-4c77-a395-71edc1821402
Tunnel CNAME: aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com
Zone:        zappro.site
```

### Variaveis de Ambiente

```bash
export CF_API_TOKEN="your-cloudflare-api-token"    # Infisical: cloudflare/API_TOKEN
export CF_ACCOUNT_ID="1a41f45591a50585050f664fa015d01b"
export CF_ZONE_ID="c0cf47bc153a6662f884d0f91e8da7c2"
export CF_TUNNEL_ID="aee7a93d-c2e2-4c77-a395-71edc1821402"
```

### Fluxo: Adicionar subdomain (exemplo: grafana → localhost:3100)

**Passo 1: GET config atual do tunnel**

```bash
curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" | jq .
```

**Passo 2: Parse e adicionar ingress (Python)**

```python
import json
import sys

data = json.load(sys.stdin)
config = data["result"]

ingress_list = config["ingress"].copy()

# NOVO: adicionar antes do catchall (ultimo)
new_ingress = {
    "hostname": "grafana.zappro.site",
    "service": "http://localhost:3100",
    "originRequest": {
        "httpHostHeader": "grafana.zappro.site"
    }
}

# Inserir antes do catchall (remove ultimo, adiciona novo, readiciona catchall)
catchall = ingress_list.pop()
ingress_list.append(new_ingress)
ingress_list.append(catchall)

config["ingress"] = ingress_list
print(json.dumps(config, indent=2))
```

**Passo 3: PUT config atualizada**

```bash
# Guardar output do python em config.json e fazer PUT
curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @config.json | jq .
```

**Passo 4: Criar DNS CNAME record**

```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CNAME",
    "name": "grafana",
    "content": "aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com",
    "proxied": true
  }' | jq .
```

**Passo 5: Verificar**

```bash
curl -sfI https://grafana.zappro.site/
# Esperado: 200, 301, 302
```

### Script one-shot completo

```bash
#!/bin/bash
# Usage: ./cf-quick-add.sh <subdomain> <target_host> <target_port> [http_host_header]
set -e

SUBDOMAIN="$1"
TARGET_HOST="$2"
TARGET_PORT="$3"
HTTP_HOST_HEADER="${4:-$SUBDOMAIN.zappro.site}"

export CF_API_TOKEN="${CLOUDFLARE_API_TOKEN}"
export CF_ACCOUNT_ID="1a41f45591a50585050f664fa015d01b"
export CF_ZONE_ID="c0cf47bc153a6662f884d0f91e8da7c2"
export CF_TUNNEL_ID="aee7a93d-c2e2-4c77-a395-71edc1821402"

# 1. GET current config
CONFIG=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json")

# 2. Parse and patch with Python
MODIFIED_CONFIG=$(echo "$CONFIG" | python3 -c "
import json, sys
data = json.load(sys.stdin)
config = data['result']
ingress_list = config['ingress'].copy()
catchall = ingress_list.pop()
ingress_list.append({
    'hostname': '${SUBDOMAIN}.zappro.site',
    'service': 'http://${TARGET_HOST}:${TARGET_PORT}',
    'originRequest': {'httpHostHeader': '${HTTP_HOST_HEADER}'}
})
ingress_list.append(catchall)
config['ingress'] = ingress_list
print(json.dumps(config, indent=2))
")

# 3. PUT updated config
curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$MODIFIED_CONFIG" | jq '.success'

# 4. Create DNS CNAME
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CF_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"CNAME\",
    \"name\": \"${SUBDOMAIN}",
    \"content\": \"aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com\",
    \"proxied\": true
  }" | jq '.success'

echo "Done: https://${SUBDOMAIN}.zappro.site/"
```

**Uso:**
```bash
# grafana.zappro.site → localhost:3100
./cf-quick-add.sh grafana localhost 3100

# chat.zappro.site → 10.0.5.2:8080
./cf-quick-add.sh chat 10.0.5.2 8080
```

### Remover subdomain

```bash
#GET config → remover entrada do ingress → PUT → DELETE DNS
```

### Referencias

- [quick-api-flow.md](./references/quick-api-flow.md) — Comandos curl exatos + script Python
- [oauth-integration.md](./references/oauth-integration.md) — Cloudflare Access + Google OAuth

---

## Referências

- [Terraform Cloudflare Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [Cloudflare Zero Trust Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Cloudflare Access Application](https://developers.cloudflare.com/cloudflare-one/identity/users/policy-engine/)
- [Google OAuth Token Exchange](https://developers.google.com/identity/protocols/oauth2#exchange-code)
- INCIDENT-2026-04-13-md-zappro-site-oauth.md — Debug OAuth client_secret missing