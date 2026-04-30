# CRM MVP — Coolify Deploy Guide

## Status: Subdomínio criado, aguardando configuração no Coolify

### O que já foi feito

1. ✅ **Subdomínio criado:** `crm.zappro.site` → `http://localhost:3080`
2. ✅ **Tunnel ingress atualizado:** Cloudflare tunnel aponta para localhost:3080
3. ✅ **Dockerfiles ajustados:** API porta 4088, Web porta 3080
4. ✅ **docker-compose.coolify.yml criado** otimizado para Coolify
5. ✅ **nginx.conf atualizado** com proxy para /trpc → API
6. ✅ **Docs atualizados:** SUBDOMAINS.md + PORTS.md
7. ✅ **Segurança:** Porta Postgres 5432 removida da host

### Passos manuais no Coolify

1. Acesse: https://coolify.zappro.site
2. Crie um novo **Service** → **Docker Compose**
3. Configure:
   - **Name:** `crm-mvp`
   - **Repository:** `git@github.com:zapprosite/monorepo.git` (ou Gitea)
   - **Branch:** `master` (ou a branch do CRM MVP)
   - **Docker Compose:** `./crm-mvp/docker-compose.coolify.yml`
   - **Base Directory:** `./crm-mvp`
4. Configure **Environment Variables** no Coolify:
   - `DB_PASSWORD` → gerar senha forte
   - `JWT_SECRET` → gerar secret forte
5. Habilite **Auto-deploy** (webhook no Gitea)
6. Deploy

### Webhook Gitea (para auto-deploy)

No repositório Gitea, vá em:
- Settings → Webhooks → Add Webhook → Gitea
- Target URL: `{coolify_webhook_url}` (fornecido pelo Coolify após criar o service)
- Secret: (deixe em branco ou use o secret do Coolify)
- Trigger: Push events

### Verificação pós-deploy

```bash
curl -sfI https://crm.zappro.site/
# Esperado: HTTP/2 200 ou redirect para /auth/login
```

### Segurança

- **Classificação:** INTERNAL — requer Cloudflare Access
- **Postgres:** NÃO exposto na host (rede interna Docker apenas)
- **Redis:** NÃO exposto na host
- **API:** Exposto apenas via nginx proxy (/trpc) na porta 3080

### Rollback

```bash
cd /srv/monorepo/crm-mvp
docker compose -f docker-compose.coolify.yml down
# Ou pelo dashboard Coolify: Stop → Delete
```
