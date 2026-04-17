---
name: subdomains-registry
description: >
  Registry automático de subdomínios Cloudflare.
  Sincronizado de /srv/ops/terraform/cloudflare/ em 2026-04-15.
type: governance
synced: 2026-04-15
---

# Subdomains Registry

**Última sincronização:** 2026-04-15
**Total de records DNS:** 12 subdomínios ativos + 7 PRUNED

## Tabela de Subdomínios ATIVOS

| Subdomínio                                           | Porta | Estado                    | Descrição                                                                            |
| ---------------------------------------------------- | ----- | ------------------------- | ------------------------------------------------------------------------------------ |
| [api.zappro.site](https://api.zappro.site)           | 4000  | ✅ ATIVO                  | LiteLLM proxy (Cloudflare Access) — :4000                                            |
| [chat.zappro.site](https://chat.zappro.site)         | 8080  | ✅ ATIVO                  | Open WebUI (LLM chat UI) — :8080 (Coolify)                                           |
| [coolify.zappro.site](https://coolify.zappro.site)   | 8000  | ✅ ATIVO                  | Coolify PaaS panel — :8000                                                           |
| [git.zappro.site](https://git.zappro.site)           | 3300  | ✅ ATIVO                  | Gitea Git Server — :3300                                                             |
| [hermes.zappro.site](https://hermes.zappro.site)     | 8642  | ✅ ATIVO                  | Hermes Gateway (agent brain, Telegram) — :8642                                         |
| [list.zappro.site](https://list.zappro.site)         | 4080  | ✅ ATIVO                  | Tools list (OAuth native) — :4080                                                    |
| [llm.zappro.site](https://llm.zappro.site)           | 4002  | ✅ ATIVO (T400 DONE)      | ai-gateway OpenAI-compat (TTS/STT/vision) — :4002 via CLOUDFLARE_API_TOKEN Terraform |
| [md.zappro.site](https://md.zappro.site)             | 4081  | ✅ ATIVO                  | Obsidian vault UI (OAuth native) — :4081                                             |
| [telegram.zappro.site](https://telegram.zappro.site) | 8642  | ✅ ATIVO (DNS propagando) | Hermes Gateway (Telegram polling) — :8642                                            |
| [monitor.zappro.site](https://monitor.zappro.site)   | 3100  | ✅ ATIVO                  | Grafana dashboard — :3100                                                            |
| [painel.zappro.site](https://painel.zappro.site)     | 4003  | ✅ ATIVO                  | Claude Code Panel (nginx:alpine) — :4003                                             |
| [qdrant.zappro.site](https://qdrant.zappro.site)     | 6333  | ✅ ATIVO                  | Qdrant vector DB — :6333                                                             |
| [todo.zappro.site](https://todo.zappro.site)         | 4082  | ✅ ATIVO                  | Todo app (OAuth native) — :4082                                                      |

## Terraform Source

`/srv/ops/terraform/cloudflare/main.tf` (state: serial 140+)

## Subdomínios PRUNED (DNS removido — não usar)

| Subdomínio               | Origem                | Notas                                                            |
| ------------------------ | --------------------- | ---------------------------------------------------------------- |
| `aurelia.zappro.site`    | aurelia-api :8080     | DNS removido — NXDOMAIN                                          |
| `bot.zappro.site`        | Hermes Agent legacy       | DNS removido — 530 error — container não existe                  |
| `grafana.zappro.site`    | Grafana :3100         | DNS removido — NXDOMAIN — usar monitor.zappro.site               |
| `n8n.zappro.site`        | n8n container         | DNS removido 2026-04-14 — container não existe, porta 5678 livre |
| `prometheus.zappro.site` | Prometheus :9090      | DNS removido — NXDOMAIN — container existe mas não exposto       |
| `supabase.zappro.site`   | Supabase Postgres     | DNS removido — NXDOMAIN — serviço discontinued                   |
| `vault.zappro.site`      | Infisical Vault :8200 | DNS removido 2026-04-14 — container não existe, porta 8200 livre |
| `web.zappro.site`        | nginx-ratelimit :4004 | DNS removido — NXDOMAIN — túnel órfão                            |

## T400 — llm.zappro.site reroute to :4002 (ai-gateway) — ✅ DONE

**SPEC-050 (2026-04-15):** `llm.zappro.site` rerouted from `:4000` (LiteLLM) to `:4002` (ai-gateway, OpenAI-compatible facade per SPEC-047/048).

**Status:** ✅ COMPLETED — 2026-04-15 13:56 -03

**Steps executed:**

1. ✅ Updated `/srv/ops/terraform/cloudflare/variables.tf` — `litellm` key renamed to `hermes`, URL changed to `:4002`; existing `hermes` key renamed to `telegram` (porta :8642)
2. ✅ `cd /srv/ops/terraform/cloudflare && terraform apply` — Cloudflare API token from `.env`
3. ✅ `sudo systemctl restart cloudflared` — nova config de ingress propagada
4. ✅ Verify: `curl -sfI https://llm.zappro.site/` → `HTTP/2 401` (ai-gateway auth required)

**Nota:** Variavel Terraform `hermes` (subdomain `hermes`) → `:4002` (ai-gateway); variavel `telegram` (subdomain `telegram`) → `:8642` (Hermes Telegram); variavel `llm` (subdomain `llm`) → `:4002` (ai-gateway) — ambos hermes e llm apontam para o mesmo ai-gateway (redundancia).

---

## Mudanças 2026-04-14 (SPEC-043 Prune)

- **n8n.zappro.site**: PRUNED — DNS CNAME removido da Cloudflare (ghost — container não existe)
- **vault.zappro.site**: PRUNED — DNS CNAME removido da Cloudflare (ghost — container não existe)
- **bot.zappro.site**: PRUNED (já) — DNS removido, sem container
- **supabase.zappro.site**: PRUNED (já) — DNS removido, serviço discontinued
- **hermes.zappro.site**: ATIVO ✅ — Hermes Gateway em localhost:8642, /health → 200

## Comandos Úteis

```bash
# Verificar status do tunnel
sudo systemctl status cloudflared
journalctl -u cloudflared --no-pager -n 20

# Verificar drift Terraform
cd /srv/ops/terraform/cloudflare && terraform plan

# Testar subdomínio
curl -sfI https://hermes.zappro.site/health
```
