# OAuth Integration — Cloudflare Access + Google OAuth

## Overview

Cloudflare Access permite proteger servicos com Google OAuth via Cloudflare Zero Trust, sem que o app implemente OAuth diretamente. O trafego passa pelo tunnel da Cloudflare e e autenticado antes de chegar ao servicio.

## Two Patterns

### Pattern A: OAuth Native (app implementa Google OAuth)
O app gerencia o OAuth flow completo:
- Login com Google no browser
- Callback para o app
- Token exchange no backend do app

**Exemplos:** `bot.zappro.site`, `list.zappro.site`, `md.zappro.site`

### Pattern B: Cloudflare Access (Zero Trust)
Cloudflare intercepta o trafego e apresenta um login Google antes de reencaminhar para o servicio.

**Exemplos:** `chat.zappro.site`, `api.zappro.site`, `vault.zappro.site`

---

## Configurar Cloudflare Access (via Terraform)

### Ficheiro: access.tf

```hcl
variable "cloudflare_account_id" {
  type = string
}

variable "cloudflare_zone_id" {
  type = string
}

# Lista de servicos protegidos (exclui OAuth native)
variable "access_services" {
  type = map(object({
    url              = string
    subdomain        = string
    http_host_header = optional(string)
  }))
}

locals {
  protected_services = {
    for k, v in var.access_services : k => v if k != "bot" && k != "list" && k != "md"
  }
}
```

### Criar Access Application

```hcl
resource "cloudflare_access_application" "this" {
  for_each = local.protected_services

  account_id = var.cloudflare_account_id
  name       = each.value.subdomain
  domain     = "${each.value.subdomain}.zappro.site"

  # Allow only zappro.site Google domain
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

### Access Service Cname (para subdomain ja existente no tunnel)

```hcl
resource "cloudflare_access_service_cname" "this" {
  for_each = local.protected_services

  account_id = var.cloudflare_account_id
  name       = each.value.subdomain
  domain     = "${each.value.subdomain}.zappro.site"
  target     = "${each.value.subdomain}.zappro.site"
  port       = 443
}
```

---

## O que o Utilizador Deve Configurar Manualmente

### Google Cloud Console (Google Cloud Platform)

**1. Criar ou usar projeto OAuth existente**

Projeto: `obsidian-web` (mesmo projeto das credenciais Infisical)

**2. Adicionar authorized redirect URI:**

```
https://auth.google.com/callback
```

Se a app usa Cloudflare Access, o redirect URI real e gerido pela Cloudflare — mas o Google Cloud Console precisa de um redirect URI valido.

**3. Verificar que o dominio e verificado no Google Cloud Console**

```
zappro.site
```

**4. Obtain OAuth credentials (se ainda nao existirem):**

- `GOOGLE_CLIENT_ID`: Google Cloud Console → APIs & Services → Credentials
- `GOOGLE_CLIENT_SECRET`: Mesmo local

### Cloudflare Zero Trust Dashboard (dash.cloudflare.com)

**1. Criar Access Application**

```
Name:     chat.zappro.site
Subdomain: chat.zappro.site
Session duration: 24 hours
Identity provider: Google
```

**2. Criar Policy**

```
Policy name: Allow zappro.site
Decision:    Allow
Include:     Email → Domain equals zappro.site
```

**3. Anotar os dois callbacks para mostrar ao utilizador**

```
Callback URL 1 (Google):   https://auth.google.com/callback
Callback URL 2 (Cloudflare): https://dash.cloudflare.com/{account_id}/access/authentication/...
```

---

## Terraform Snippets

### access-vars.tf

```hcl
variable "google_client_id" {
  type      = string
  sensitive = true
}

variable "google_client_secret" {
  type      = string
  sensitive = true
}

variable "cloudflare_account_id" {
  type = string
}
```

### access-outputs.tf

```hcl
output "access_app_ids" {
  value = {
    for app in cloudflare_access_application.this : app.domain => app.id
  }
  description = "Map of subdomain to Access Application ID"
}
```

### access-policy.tf (exemplo completo)

```hcl
resource "cloudflare_access_application" "chat" {
  account_id = var.cloudflare_account_id
  name       = "chat"
  domain     = "chat.zappro.site"

  policy {
    name  = "Allow zappro.site"
    decision = "allow"

    include {
      email {
        domain = "zappro.site"
      }
    }

    exclude {
      email {
        domain = "contractor.zappro.site"
      }
    }
  }
}

resource "cloudflare_access_policy" "chat_allow_zappro" {
  account_id = var.cloudflare_account_id
  name       = "Allow zappro.site"
  application_id = cloudflare_access_application.chat.id

  include {
    email {
      domain = "zappro.site"
    }
  }
}
```

---

## Exceptions — OAuth Native (sem Cloudflare Access)

Apps OAuth native DEVEM ser excluidos da Access policy:

```hcl
# access.tf
locals {
  oauth_native_services = ["bot", "list", "md"]
  protected_services = {
    for k, v in var.access_services : k => v if !contains(local.oauth_native_services, k)
  }
}
```

O Terraform aplica Access apenas a `protected_services`. Os restantes usams OAuth nativo directamente.

---

## Print to User — Two Callbacks

After configuring Cloudflare Access, print these two callbacks clearly:

```
CLOUDFLARE ACCESS CONFIGURADO

Google OAuth Callback (Google Cloud Console):
https://auth.google.com/callback

Cloudflare Access Callback (Cloudflare Dashboard):
https://dash.cloudflare.com/<your-account-id>/access/authentication/<app-id>/callback

Agora podes aceder via:
https://chat.zappro.site/
```

---

## Troubleshooting

### "Access denied" mesmo com email @zappro.site
1. Verificar que o email domain esta configurado em Cloudflare Access → Settings → Identity providers
2. Confirmar que o Google Workspace domain e `zappro.site` (nao gmail.com)

### "Invalid request" no OAuth flow
- O redirect_uri no Google Cloud Console deve corresponder ao callback da Cloudflare
- Verificar que o app domain match o subdomain do tunnel

### Terraform sobrepoe configuracao Access manual
- Terraform reverte configuracoes manuais — usar sempre Terraform para Access
- Nao editar Access apps no Dashboard se estiver gerido por Terraform

---

## References

- [Cloudflare Access Application](https://developers.cloudflare.com/cloudflare-one/identity/users/policy-engine/)
- [Google OAuth 2.0 Redirect URIs](https://developers.google.com/identity/protocols/oauth2#exchange-code)
- [Cloudflare Access with Google OAuth](https://developers.cloudflare.com/cloudflare-one/identity/idp-integration/google/)
