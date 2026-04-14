---
name: subdomains-registry
description: >
  Registry automático de subdomínios Cloudflare.
  Sincronizado de /srv/ops/terraform/cloudflare/ em 2026-04-13.
type: governance
synced: 2026-04-13
---

# Subdomains Registry

**Última sincronização:** 2026-04-13
**Total de records:** 16 (prometheus.zappro.site adicionado com IP)

## Tabela de Subdomínios

| Subdomínio | Porta | Estado | Descrição |
|------------|-------|--------|-----------|
| [api.zappro.site](https://api.zappro.site) | 4000 | ✅ ATIVO | LiteLLM proxy (Cloudflare Access) — :4000 |
| [bot.zappro.site](https://bot.zappro.site) | 80 | ✅ ATIVO | OpenClaw Bot (publico, sem Access) — cloudflared → :80 → Traefik → OpenClaw |
| [coolify.zappro.site](https://coolify.zappro.site) | 8000 | ✅ ATIVO | Coolify PaaS panel — :8000 — container IP 10.0.0.5 |
| [git.zappro.site](https://git.zappro.site) | 3300 | ✅ ATIVO | Gitea Git Server — :3300 |
| [llm.zappro.site](https://llm.zappro.site) | 4000 | ✅ ATIVO | LiteLLM proxy (Cloudflare Access) — :4000 |
| [list.zappro.site](https://list.zappro.site) | 4080 | ✅ ATIVO | List service (publico, OAuth native) — :4080 |
| [md.zappro.site](https://md.zappro.site) | 4081 | ✅ ATIVO | Obsidian vault UI (publico, OAuth native) — :4081 |
| [grafana.zappro.site](https://grafana.zappro.site) | 3100 | ✅ ATIVO | Grafana dashboard — alias de monitor.zappro.site — container IP 10.0.16.7 |
| [monitor.zappro.site](https://monitor.zappro.site) | 3100 | ✅ ATIVO | Grafana dashboard (LAN only) — :3100 |
| [painel.zappro.site](https://painel.zappro.site) | 4003 | ✅ ATIVO | Claude Code Panel (nginx:alpine) — :4003 |
| [prometheus.zappro.site](https://prometheus.zappro.site) | 9090 | ✅ ATIVO | Prometheus metrics scraper (Cloudflare Access) — :9090 — container IP 10.0.16.3 |
| [qdrant.zappro.site](https://qdrant.zappro.site) | 6333 | ✅ ATIVO | Qdrant vector DB — tunnel fix aplicado (302 CF Access, não DOWN) — container IP 10.0.19.5 |
| [supabase.zappro.site](https://supabase.zappro.site) | 5433 | ✅ ATIVO | Supabase Postgres (health proxy on 5433) — container IP 10.0.0.4:5432 |
| [chat.zappro.site](https://chat.zappro.site) | 8080 | ✅ ATIVO | Open WebUI (LLM chat UI) — :8080 (Coolify) — **IP corrigido: 10.0.19.3** |

## Terraform Source

`/srv/ops/terraform/cloudflare/main.tf` (state: serial 137)

## Ghost Tunnels (não usar — orphan entries)

| Subdomínio | Origem | Ação |
|------------|--------|------|
| `web.zappro.site` | nginx-ratelimit → :4004 | Túnel órfão — nginx-ratelimit não exposto na LAN — remover do cloudflared |

## Mudanças Recentes
- **2026-04-13**: grafana.zappro.site ADICIONADO — alias Grafana dashboard (Cloudflare Access) :3100, container IP 10.0.16.7
- **2026-04-13**: prometheus.zappro.site ADICIONADO — Prometheus metrics scraper (Cloudflare Access) :9090
- **2026-04-12**: supabase.zappro.site ATIVADO — Supabase Postgres via HTTP health proxy (:5433 → container :5432) — container IP 10.0.0.4, coolify network
- **2026-04-12**: list.zappro.site ATIVADO — tools list HTML/JS, Google OAuth direto (sem Cloudflare Access), porta 4080
- **2026-04-07**: chat.zappro.site ATIVADO — Open WebUI via Coolify :8080, Google OAuth
- **2026-04-05**: SUBDOMAINS.md corrigido — aurelia e chat REMOVIDOS do registry (TF + cloudflared), painel ATIVO
- **2026-04-05**: bot.zappro.site FIX (port mapping 4001→8080 adicionado ao compose)
- **2026-04-05**: api.zappro.site e llm.zappro.site adicionados ao Terraform (antes só existiam no config.yml local)
- **2026-04-05**: Google OAuth credentials REMOVIDOS de access.tf (segurança)
- **2026-04-05**: terraform.tfstate Permissions → 600 (antes 664)
- **2026-04-05**: NETWORK_MAP.md reescrito com arquitetura completa

## Comandos Úteis

```bash
# Verificar status do tunnel
sudo systemctl status cloudflared
journalctl -u cloudflared --no-pager -n 20

# Verificar drift Terraform
cd /srv/ops/terraform/cloudflare && terraform plan

# Testar subdomínio
curl -sfI https://bot.zappro.site
```

## Mudanças 2026-04-05 (Segundo Cycle)

- **aurelia.zappro.site**: REMOVIDO do Terraform e cloudflared config (deprecated)
- **chat.zappro.site**: REMOVIDO do cloudflared config (nunca deployado, sem Terraform)
- **painel.zappro.site**: ATIVADO ✅ — nginx:alpine em :4003, servindo `/srv/painel/index.html`
  - Container: `painel` em `/srv/data/painel/docker-compose.yml`
  - Storage: `/srv/painel/index.html` (copiado de ~/Downloads)
  - Cloudflare Access: aplicado (exceção: bot é public)
