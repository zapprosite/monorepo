# Tunnel Setup — list-web-from-zero-to-deploy

Como adicionar subdomain ao Terraform para deploy via Cloudflare Tunnel.

## Variaveis TF (variables.tf)

Formato do bloco `services` em `/srv/ops/terraform/cloudflare/variables.tf`:

```hcl
variable "services" {
  description = "Map of services to expose via tunnel"
  type = map(object({
    url              = string
    subdomain        = string
    http_host_header = optional(string)
  }))
  default = {
    # ... existente ...

    app_name = {
      url              = "http://10.0.X.X:PORT"   # IP DO CONTAINER
      subdomain        = "app-name"                # → app-name.zappro.site
      http_host_header = null                       # ou "host.sslip.io"
    }
  }
}
```

### Formato de url

```
http://10.0.X.X:PORT
```

**NAO usar localhost**. O tunnel conecta ao IP do container Docker, nao ao host.

Para descobrir o IP do container:
```bash
docker inspect -f '{{range.NetworkSettings.Networks}}{{.IPAddress}}{{end}}' CONTAINER_NAME
```

Exemplo para list-web (porta 4080):
```hcl
list = {
  url              = "http://10.0.5.3:4080"   # IP do container list-web
  subdomain        = "list"
  http_host_header = null
}
```

### http_host_header

O `http_host_header` e necessario quando o servico faz bind a um hostname especifico.

Exemplo — Hermes-Agent (OpenClaw successor) precisa de http_host_header quando o servico responde a um hostname diferente:
```hcl
hermes = {
  url              = "http://10.0.X.X:8080"   # IP do container Hermes
  subdomain        = "bot"
  http_host_header = "bot.zappro.site"
}
```

**Nota:** O Hermes-Agent substituiu o OpenClaw. O `http_host_header` e necessario apenas quando o servico faz bind a um hostname especifico diferente do subdomain.

Para apps nginx normais, usar `null`.

## Steps

### 1. Editar variables.tf

```bash
nano /srv/ops/terraform/cloudflare/variables.tf
```

Adicionar novo servico ao bloco `services`.

### 2. Plan

```bash
cd /srv/ops/terraform/cloudflare
terraform plan -out=tfplan
```

Verificar saida — deve mostrar novo recurso DNS.

### 3. Apply

```bash
terraform apply tfplan
```

### 4. Verificar

```bash
# Testar subdomain
curl -sfI https://app-name.zappro.site

# Esperado: 200, 301, 302, ou 401
# NAO ESPERADO: "Connection refused"
```

### 5. Documentacao

Apos terraform apply, atualizar:
- SUBDOMAINS.md — novo subdomain
- PORTS.md — nova porta

## Exemplo Completo: Adicionar "tools" subdomain

```hcl
# Em variables.tf, no bloco services:
tools = {
  url              = "http://10.0.5.10:4080"
  subdomain        = "tools"
  http_host_header = null
}
```

```bash
cd /srv/ops/terraform/cloudflare
terraform plan -out=tfplan
terraform apply tfplan

# Verificar
curl -sfI https://tools.zappro.site
```

## Formato de Services (referencia completa)

```hcl
services = {
  nome = {
    url              = "http://10.0.X.X:PORT"
    subdomain        = "subdomain-name"
    http_host_header = optional_string_ou_null
  }
}
```

| Campo | Tipo | Descricao |
|-------|------|-----------|
| url | string | URL do container (IP + porta) |
| subdomain | string | Nome do subdomain (sem .zappro.site) |
| http_host_header | string ou null | Host header se necessario |

## Troubleshooting

### "Connection refused" mesmo depois de apply
- Verificar IP do container (docker inspect)
- Verificar que container esta rodando
- Verificar porta exposta no compose (127.0.0.1:PORT:80)

### Tunnel nao aparece no Cloudflare Dashboard
- Terraform gerencia o tunnel — nao editar manualmente
- Runs `terraform refresh` para sync state

### DNS records nao existem
```bash
# Ver Cloudflare API diretamente
curl -X GET "https://api.cloudflare.com/client/v4/zones/{zone_id}/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```
