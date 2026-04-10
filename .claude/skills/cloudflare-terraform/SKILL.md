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
curl -s -o /dev/null -w "%{http_code}" https://newservice.zappro.site/
# Esperado: 200, 401, ou 404 (não " Connection refused")
```

---

## Variáveis Importantes

### `services` map — todos os subdomínios

| Subdomain | URL | http_host_header | Notas |
|-----------|-----|------------------|-------|
| `vault.zappro.site` | localhost:8200 | - | Infisical |
| `n8n.zappro.site` | 10.0.6.3:5678 | - | n8n |
| `qdrant.zappro.site` | localhost:6333 | - | Qdrant |
| `bot.zappro.site` | localhost:80 | `openclaw-qgtzrmi...sslip.io` | OpenClaw |
| `chat.zappro.site` | 10.0.5.2:8080 | `openwebui-wbmqefx...sslip.io` | OpenWebUI |
| `llm.zappro.site` | localhost:4000 | - | LiteLLM |
| `git.zappro.site` | localhost:3300 | - | Gitea |
| `coolify.zappro.site` | localhost:8000 | - | Coolify |
| `api.zappro.site` | localhost:4000 | - | API |
| `web.zappro.site` | localhost:4004 | - | Web |
| `monitor.zappro.site` | localhost:3100 | - | Grafana |
| `painel.zappro.site` | localhost:4003 | - | Painel |

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

### Access Policy existente (access.tf)

O `access.tf` já tem políticas para:
- `vault.zappro.site` — só emails @zappro.site
- `n8n.zappro.site` — proteção similar
- `qdrant.zappro.site` — proteção similar

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
- O `http_host_header` é necessário quando o serviço faz bind a um hostname específico (como OpenClaw)

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

---

## Ficheiros

- **State:** `terraform.tfstate` (local, gitignored)
- **Backup:** `terraform.tfstate.backup`
- **Tunnel credentials:** `~/.cloudflared/config.yml`

---

## Referências

- [Terraform Cloudflare Provider](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [Cloudflare Zero Trust Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Cloudflare Access Application](https://developers.cloudflare.com/cloudflare-one/identity/users/policy-engine/)
