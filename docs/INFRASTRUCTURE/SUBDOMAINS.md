---
name: subdomains-registry
description: >
  Registry automático de subdomínios Cloudflare.
  Sincronizado de /srv/ops/terraform/cloudflare/ em 2026-04-05.
type: governance
synced: 2026-04-12
---

# Subdomains Registry

**Última sincronização:** 2026-04-12
**Total de records:** 13 (chat.zappro.site ATIVO)

## Tabela de Subdomínios

| Subdomínio | Porta | Estado | Descrição |
|------------|-------|--------|-----------|
| [api.zappro.site](https://api.zappro.site) | 4000 | ✅ ATIVO | LiteLLM proxy (Cloudflare Access) — :4000 |
| [bot.zappro.site](https://bot.zappro.site) | 80 | ✅ ATIVO | OpenClaw Bot (publico, sem Access) — cloudflared → :80 → Traefik → OpenClaw |
| [coolify.zappro.site](https://coolify.zappro.site) | 8000 | ✅ ATIVO | Coolify PaaS panel — :8000 |
| [git.zappro.site](https://git.zappro.site) | 3300 | ✅ ATIVO | Gitea Git Server — :3300 |
| [llm.zappro.site](https://llm.zappro.site) | 4000 | ✅ ATIVO | LiteLLM proxy (Cloudflare Access) — :4000 |
| [list.zappro.site](https://list.zappro.site) | 4080 | ✅ ATIVO | List service — :4080 |
| [monitor.zappro.site](https://monitor.zappro.site) | 3100 | ✅ ATIVO | Grafana dashboard (LAN only) — :3100 |
| [n8n.zappro.site](https://n8n.zappro.site) | 5678 | ⚠️ DOWN | n8n workflow — tunnel IP errado (10.0.6.3→correto 10.0.6.2) |
| [painel.zappro.site](https://painel.zappro.site) | 4003 | ✅ ATIVO | Claude Code Panel (nginx:alpine) — :4003 |
| [qdrant.zappro.site](https://qdrant.zappro.site) | 6333 | ⚠️ DOWN | Qdrant vector DB — tunnel错配置 (localhost:6333 inacessível, corrigir para IP do container) |
| [vault.zappro.site](https://vault.zappro.site) | 8200 | ✅ ATIVO | Infisical Secret Manager — :8200 |
| [chat.zappro.site](https://chat.zappro.site) | 8080 | ✅ ATIVO | Open WebUI (LLM chat UI) — :8080 (Coolify) — **IP corrigido: 10.0.5.3** |

## Terraform Source

`/srv/ops/terraform/cloudflare/main.tf` (state: serial 137)

## Ghost Tunnels (não usar — orphan entries)

| Subdomínio | Origem | Ação |
|------------|--------|------|
| `supabase.zappro.site` | Supabase removido, tunnel ativa | Remover do cloudflared config |
| `web.zappro.site` | nginx-ratelimit:4004, não documentado | Documentar ou remover do tunnel |

## Mudanças Recentes
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
