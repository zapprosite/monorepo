# SPEC-002: Homelab Infrastructure Refactoring — Cloudflare Tunnel + Coolify

**Versão:** 1.0
**Data:** 2026-04-08
**Status:** Draft
**Autor:** Claude Code (auto-orchestration)

---

## 1. Objetivo

Refatorar a arquitetura de rede do homelab `will-zappro` para usar Cloudflare Tunnel (cloudflared) como systemd service + Coolify (Traefik proxy) como gateway de aplicações, seguindo docs oficiais da Cloudflare, Coolify e Terraform Provider.

**Referências:**
- [Cloudflare Tunnel Docs](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/)
- [Cloudflared Ingress Rules](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/do-more-with-tunnels/local-management/ingress/)
- [Terraform cloudflare_zero_trust_tunnel_cloudflared_config](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs/resources/zero_trust_tunnel_cloudflared_config)
- [Coolify Docs](https://coolify.io/docs)
- [Coolify Cloudflare Tunnels](https://coolify.io/docs/integrations/cloudflare-tunnels/)
- [Open WebUI Service](https://coolify.io/docs/services/open-webui)

---

## 2. Arquitetura-Alvo

```
[Cloudflare Edge]
      │
      ▼
Cloudflare Tunnel (cloudflared daemon — systemd service)
      │  credentials: ~/.cloudflared/{tunnel-uuid}.json
      │  config:      /etc/cloudflared/config.yml
      │
      ▼
  Host:8000 (Coolify Traefik Proxy — coolify-proxy container)
      │
      ├── /  → coolify.zappro.site     (Coolify panel)
      ├── /   → open-webui (:8080)     (Open WebUI — 10.0.5.2:8080)
      ├── /   → n8n (:5678)            (n8n automation)
      └── /   → grafana (:3100)        (Monitoring)
```

### Rede Docker — Coolify (isolated network: coolify-ur0tcppyr7cdaifbnzumxtis)

| Container | IP | Porta | Notas |
|-----------|-----|-------|-------|
| `coolify-proxy` | 10.0.5.3 | 80,443,8080 | Traefik — expõe para host |
| `open-webui-*` | 10.0.5.2 | 8080 | Open WebUI (one-click deploy) |
| `n8n` | 10.0.6.3 | 5678 | n8n (Docker net coolify) |
| `qdrant` | localhost | 6333 | Qdrant (host) |

### cloudflared como Systemd Service (NÃO Docker)

**Recomendação oficial Cloudflare:**
- `cloudflared tunnel run` via systemd (não Docker)
- Auto-restart com `Restart=always`
- Credentials file em `/etc/cloudflared/` ou `~/.cloudflared/`
- Token via env var `CLOUDFLARED_TUNNEL_TOKEN` (preferível a credentials file)

### Ingress Rules — Ordem de Prioridade

```
1. n8n.zappro.site       → http://10.0.6.3:5678        (Docker net coolify)
2. qdrant.zappro.site    → http://localhost:6333      (host)
3. monitor.zappro.site   → http://localhost:3100      (host)
4. coolify.zappro.site   → http://localhost:8000      (host)
5. git.zappro.site       → http://localhost:3300      (host)
6. painel.zappro.site   → http://localhost:4003      (host)
7. vault.zappro.site     → http://localhost:8200      (host)
8. api.zappro.site      → http://localhost:4000      (host)
9. llm.zappro.site      → http://localhost:4000      (host)
10. bot.zappro.site     → http://localhost:80          (host)
11. chat.zappro.site    → http://localhost:8080
                           origin_request.http_host_header = "openwebui-*.sslip.io"
12. catch-all           → http_status:404
```

### Versões Pinned (estáveis)

| Componente | Versão Pinned | Fonte |
|-----------|------------|-------|
| cloudflared | última release (verificar `cloudflared --version`) | Cloudflare Package Repo |
| Ubuntu | 22.04.4 LTS Desktop | Canonical |
| Coolify | beta (última) | coolify.io/install.sh |
| Docker | 25.x (Ubuntu repo) | docker.com |
| Terraform | 1.6+ | terraform.io |
| Cloudflare Terraform Provider | 4.x (latest) | terraform.io |

---

## 3. Fluxo de Dados

```
Usuário → https://chat.zappro.site
          │
          ▼
    Cloudflare Edge (CDN)
          │
          ▼
    cloudflared tunnel (TCP TLS → Cloudflare)
          │  [saída-only connections — firewall permite só outbound]
          ▼
    coolify-proxy (:8080) — Traefik
          │  [roteamento por Host header]
          ▼
    open-webui container (:10.0.5.2:8080)
          │  [http_host_header: openwebui-*.sslip.io]
          ▼
    Open WebUI responde
```

---

## 4. Terraform — Estrutura-alvo

### Provider
```hcl
terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}
```

### Resources

| Resource | Propósito |
|----------|-----------|
| `cloudflare_zero_trust_tunnel_cloudflared.homelab` | Tunnel principal |
| `cloudflare_zero_trust_tunnel_cloudflared_config.homelab` | Ingress rules (dynamic block) |
| `cloudflare_record.tunnel_cname` | DNS CNAMEs (for_each = var.services) |
| `cloudflare_zero_trust_access_application.services` | Access apps (exclui bot) |
| `cloudflare_zero_trust_access_policy.owners` | Access policies (exclui bot) |
| `random_password.tunnel_secret` | Secret para tunnel |

### Variáveis — var.services

```hcl
variable "services" {
  type = map(object({
    url              = string
    subdomain        = string
    http_host_header = optional(string)  # null = sem override
  }))
}
```

### Ingress Rules Dinâmicas (main.tf)

```hcl
config {
  dynamic "ingress_rule" {
    for_each = var.services
    content {
      hostname = "${ingress_rule.value.subdomain}.${var.domain}"
      service  = ingress_rule.value.url
      dynamic "origin_request" {
        for_each = ingress_rule.value.http_host_header != null ? [1] : []
        content {
          http_host_header = ingress_rule.value.http_host_header
        }
      }
    }
  }
  ingress_rule { service = "http_status:404" }
}
```

### Security Hardening

```hcl
# 1. Lifecycle — prevent_destroy
resource "random_password" "tunnel_secret" {
  lifecycle { prevent_destroy = true }
}

# 2. connectTimeout + tlsTimeout (origin_request global)
config {
  connect_timeout = "30s"
  tls_timeout    = "10s"
  ...
}

# 3. Credentials file permissions (post-apply script)
# chmod 600 ~/.cloudflared/*.json
# chown cloudflared:cloudflared ~/.cloudflared/
```

---

## 5. cloudflared Systemd Service

### Unit File (`/etc/systemd/system/cloudflared.service`)

```ini
[Unit]
Description=Cloudflare Tunnel
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=cloudflared
Group=cloudflared
Environment="TUNNEL_TOKEN=${TUNNEL_TOKEN}"
ExecStart=/usr/local/bin/cloudflared tunnel --config /etc/cloudflared/config.yml run ${TUNNEL_NAME}
Restart=always
RestartSec=5s
StandardOutput=journal
StandardError=journal
SyslogIdentifier=cloudflared

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadOnlyPaths=/etc/cloudflared
PrivateTmp=true

[Install]
WantedBy=multi-user.target
```

### Config File (`/etc/cloudflared/config.yml`)

```yaml
tunnel: ${TUNNEL_UUID}
credentials-file: /etc/cloudflared/${TUNNEL_UUID}.json

# Global origin settings
connectTimeout: 30s
tlsTimeout: 10s

ingress:
  - hostname: chat.zappro.site
    service: http://localhost:8080
    originRequest:
      httpHostHeader: openwebui-wbmqefxhd7vdn2dme3i6s9an.191.17.50.123.sslip.io
  - hostname: bot.zappro.site
    service: http://localhost:80
    originRequest:
      httpHostHeader: openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io
  - service: http_status:404

# Metrics ( Prometheus)
metrics: 0.0.0.0:9090
loglevel: info
```

---

## 6. Coolify — Configuração de Rede

### Rede Docker do Coolify

- **Nome rede:** `coolify-ur0tcppyr7cdaifbnzumxtis` (Coolify-managed)
- **Subnet:** 10.0.5.0/24, 10.0.6.0/24, 10.0.7.0/24, 10.0.19.0/24
- **DNS interno:** `host.docker.internal` → host gateway

### Open WebUI Health Check

Coolify usa a **primeira porta exposta** como health check. Open WebUI expõe `:8080`.

```
health check: GET http://localhost:8080/
- Container: UP se retorna 200
- coolify-proxy: routing ativo
- Container: UNHEALTHY → Traefik para de rotear
```

### coolify-proxy (Traefik) — Logs

```bash
docker logs coolify-proxy --tail 50 -f
# Procura: router, open-webui, error, warning
```

### Reinicialização (se container mudar IP)

```bash
# Se open-webui reiniciar (IP muda), restart coolify-proxy
docker restart coolify-proxy
# Traefik recarrega rotas e encontra novo IP
```

---

## 7. Smoke Tests

```bash
# Teste por subdomain
for site in chat bot api llm painel vault n8n coolify git qdrant monitor; do
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 https://${site}.zappro.site)
  echo "${site}.zappro.site: $code"
done
```

Testes должны пройти 11/11 subdomínios.

---

## 8. Limpeza Pós-Refatoração (SPEC-002-CLEANUP.md)

Ver `SPEC-002-CLEANUP.md` — checklist completo de 10 categorias de ghost artifacts.

### Fases

| Phase | Prioridade | Itens |
|-------|-----------|-------|
| 1 | ALTA | Docker ghosts, containers parados |
| 2 | ALTA | Logs legados (Docker, systemd, Coolify) |
| 3 | ALTA | Cloudflare DNS (aurelia, chat — deprecated) |
| 4 | MÉDIA | Terraform state drift (old resources) |
| 5 | MÉDIA | Cron jobs orphans (backup-supabase, etc.) |
| 6 | BAIXA | Filesystem (.env files, dirs órfãos) |

### Checkpoints

```bash
# Antes de limpar — ZFS snapshot
sudo zfs snapshot -r tank@pre-refactor-$(date +%Y%m%d)

# Após limpar
docker ps --format "{{.Names}}"          # só ativos
terraform plan                          # 0 drift
cloudflared tunnel list                 # só tunnel atual
```

---

## 9. Condições de Borde

### ✅ Sempre fazer
- Snapshot ZFS antes de qualquer change destrutivo
- `terraform plan` antes de apply
- Verificar health checks do Coolify após restart de container
- Commit atômico por mudança

### ⚠️ Perguntar antes
- Remover qualquer DNS record da Cloudflare
- Deletar Cloudflare Zero Trust Access applications
- Destruir ZFS datasets
- Modificar `var.services` no Terraform (afeta produção)

### ❌ Nunca fazer
- `terraform destroy` sem snapshot
- `docker system prune -a` sem verificar volumes
- Deletar credenciais do tunnel sem criar replacement primeiro
- Expor portas sem atualizar PORTS.md + SUBDOMAINS.md

---

## 10. Métricas de Sucesso

| Métrica | Critério |
|---------|---------|
| `chat.zappro.site` | HTTP 302 → Cloudflare Access login |
| `terraform plan` | 0 mudanças pendentes |
| `cloudflared service` | active (running) |
| `coolify-proxy` | healthy, logs sem errors |
| `open-webui container` | healthy, IP 10.0.5.x estável |
| Todos os 11 subdomínios | respondem (2xx ou 3xx) |
| Metrics endpoint | `curl localhost:9090/metrics` → 200 |
