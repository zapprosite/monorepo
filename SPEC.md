# SPEC.md — Homelab Infrastructure Refactoring

**Versão:** 1.0
**Data:** 2026-04-08
**Status:** Active
**Dependência:** SPEC-002 (Homelab Infrastructure Refactoring)

---

## 1. Objetivo

Refatorar a arquitetura de rede do homelab `will-zappro` para usar Cloudflare Tunnel (cloudflared) como systemd service + Coolify (Traefik proxy) como gateway de aplicações, seguindo docs oficiais da Cloudflare, Coolify e Terraform Provider.

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

---

## 3. Componentes

| Componente | Tecnologia | Estado |
|-----------|------------|--------|
| Tunnel | cloudflared 2026.3.0 systemd | ✅ Running |
| DNS + Access | Terraform Cloudflare Provider 4.52.7 | ✅ Applied |
| Proxy | Coolify Traefik (coolify-proxy) | ✅ Running |
| Secrets | Infisical v0.146.2 | ✅ Configured |
| Health checks | Smoke tests | ✅ Written |

---

## 4. Terraform Resources

| Resource | Propósito |
|----------|-----------|
| `cloudflare_zero_trust_tunnel_cloudflared.homelab` | Tunnel principal |
| `cloudflare_zero_trust_tunnel_cloudflared_config.homelab` | Ingress rules (dynamic block) |
| `cloudflare_record.tunnel_cname` | DNS CNAMEs (for_each = var.services) |
| `cloudflare_zero_trust_access_application.services` | Access apps (exclui bot) |
| `cloudflare_zero_trust_access_policy.owners` | Access policies (exclui bot) |
| `random_password.tunnel_secret` | Secret para tunnel (prevent_destroy) |

---

## 5. Variáveis — var.services

| Service | URL | Subdomain | http_host_header |
|---------|-----|-----------|-----------------|
| vault | http://localhost:8200 | vault | null |
| n8n | http://10.0.6.3:5678 | n8n | null |
| qdrant | http://localhost:6333 | qdrant | null |
| monitor | http://localhost:3100 | monitor | null |
| coolify | http://localhost:8000 | coolify | null |
| git | http://localhost:3300 | git | null |
| bot | http://localhost:80 | bot | openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io |
| painel | http://localhost:4003 | painel | null |
| api | http://localhost:4000 | api | null |
| llm | http://localhost:4000 | llm | null |
| chat | http://localhost:8080 | chat | openwebui-wbmqefxhd7vdn2dme3i6s9an.191.17.50.123.sslip.io |

---

## 6. Security Hardening

- [x] `lifecycle { prevent_destroy = true }` em `random_password.tunnel_secret`
- [x] `connect_timeout = 30`, `tls_timeout = 10` em `config.origin_request`
- [x] `chmod 600` nas credenciais tunnel
- [x] User `cloudflared` dedicado criado
- [x] Secrets buscan do Infisical (não hardcoded)
- [ ] Service cloudflared rodando como user `cloudflared` (PENDENTE)

---

## 7. Smoke Tests

```bash
bash /srv/monorepo/smoke-tests/smoke-chat-zappro-site.sh
```

Testa: HTTP→HTTPS (301), Access gate (302), Location header, SSL cert, login page.

---

## 8. Condições de Borde

### ✅ Sempre fazer
- Snapshot ZFS antes de qualquer change destrutivo
- `terraform plan` antes de apply
- Secrets busquem de Infisical (nunca hardcoded)

### ❌ Nunca fazer
- `terraform destroy` sem snapshot
- Expor portas sem atualizar PORTS.md + SUBDOMAINS.md

---

## 9. Métricas de Sucesso

| Métrica | Critério |
|---------|---------|
| `chat.zappro.site` | HTTP 302 → Cloudflare Access login |
| `terraform plan` | 0 mudanças pendentes |
| `cloudflared service` | active (running) |
| `coolify-proxy` | healthy, logs sem errors |
| `open-webui container` | healthy, IP 10.0.5.x estável |
| Todos os 11 subdomínios | respondem (2xx ou 3xx) |
| Metrics endpoint | `curl localhost:9090/metrics` → 200 |
