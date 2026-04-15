# INCIDENT-2026-04-14: coolify.zappro.site 502 Bad Gateway

**Data:** 2026-04-14 19:40
**Severity:** P2
**Tipo:** Tunnel routing / IP mismatch
**Status:** ✅ RESOLVED

---

## Resumo

`coolify.zappro.site` retornava 502 Bad Gateway via Cloudflare Tunnel.

## Sintoma

```
Cloudflare 502 Bad Gateway
Ray ID: 9ec62d2e5b6b
Error: "dial tcp 10.0.5.2:8000: connect: connection refused"
```

## Causa Raiz

cloudflared apontava para IP antigo do Coolify (`10.0.5.2:8000`) em vez de `localhost:8000`. O Coolify mudou de IP mas o tunnel nunca foi atualizado.

## Timeline

| Hora | Evento |
|------|--------|
| 19:35 | User reporta 502 em coolify.zappro.site |
| 19:40 | Análise: cloudflared log mostra `connection refused` para 10.0.5.2:8000 |
| 19:45 | Confirma: `localhost:8000` OK, `10.0.5.2:8000` FAIL |
| 19:47 | Atualiza `~/.cloudflared/config.yml` — coolify: `http://localhost:8000` |
| 19:47 | Atualiza `/srv/ops/terraform/cloudflare/variables.tf` |
| 19:48 | `sudo systemctl restart cloudflared` |
| 19:48 | `curl https://coolify.zappro.site/ping` → 200 OK |
| 19:49 | Terraform apply para sincronizar API Cloudflare |

## Fixes Aplicados

| Ficheiro | Mudança |
|----------|---------|
| `~/.cloudflared/config.yml` | `http://10.0.5.2:8000` → `http://localhost:8000` |
| `/srv/ops/terraform/cloudflare/variables.tf` | `http://10.0.5.2:8000` → `http://localhost:8000` |

## Prevenção

- [ ] Adicionar health check para IPs dos containers Coolify no tunnel config
- [ ] Verificar que cloudflared configs não usam IPs hardcoded de containers

## Lições

1. Nunca usar IPs de containers Coolify em configs de tunnel — usar sempre `localhost` quando o container está no mesmo host
2. cloudflared pode estar "healthy" (daemon running) mas com routing quebrado para serviços específicos
3. coolify.zappro.site OK não implica que tunnel routing está correto — verificar sempre `/ping`

---

**Resolvido por:** Claude Code (sessão 2026-04-14)
