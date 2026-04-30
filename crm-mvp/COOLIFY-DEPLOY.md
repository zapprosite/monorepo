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

---

## Lições Aprendidas para Futuras LLMs (READ THIS FIRST)

> ⚠️ **Se você é uma LLM tentando fazer deploy no Coolify, leia esta seção ANTES de tentar qualquer coisa.**

### A Coolify API está bloqueada por IP AllowList

A instância Coolify local (`coolify.zappro.site`) roda atrás de um nginx que intercepta todas as requisições à API. **NENHUM token (Bearer, API Key, x-api-key, query param) funciona se o IP de origem não estiver na Coolify AllowList.**

**Prova:**
```bash
source /srv/monorepo/.env
curl -s http://localhost:8000/api/v1/services \
  -H "Authorization: Bearer $COOLIFY_API_KEY" \
  -H "Content-Type: application/json"
# → {"message":"Unauthenticated."}
```

Isso acontece INDEPENDENTE do token usado:
- `COOLIFY_API_KEY`
- `COOLIFY_ACCESS_TOKEN`
- `COOLIFY_APP_KEY`

### O que funciona

1. **Dashboard web** (https://coolify.zappro.site) — requer login manual
2. **CLI local do Coolify** (se disponível)
3. **Adicionar IP na AllowList** (via dashboard) → depois a API funciona

### O que NÃO funciona (não perca tempo)

- ❌ Tentar tokens diferentes (`Bearer`, `x-api-key`, query param)
- ❌ Tentar endpoints diferentes (`/api/v1/services`, `/api/v1/health`, etc.)
- ❌ Tentar `localhost:8000` vs `https://coolify.zappro.site`

### Script auto-deploy.sh existe mas falha na API

O script `/srv/monorepo/scripts/auto-deploy.sh` já tem toda a lógica correta:
- Cria subdomain via Cloudflare API ✅
- Trigger deploy via Coolify API ✅ (falha no auth)
- Health check ✅

**Mas ele falha no step 2** porque a Coolify API retorna `Unauthenticated`.

### Como corrigir (para humanos ou LLMs com acesso ao dashboard)

**Opção A: Adicionar IP na AllowList (rápido, 2 min)**
```bash
# 1. Obter IP público
curl -s https://api.ipify.org
# 2. Acesse https://coolify.zappro.site/settings/allowlist
# 3. Adicione o IP
# 4. A API passa a funcionar imediatamente
```

**Opção B: Usar o dashboard manualmente (confiável)**
Siga os passos em "Passos manuais no Coolify" abaixo.

---

## Passos manuais no Coolify (Opção recomendada)

1. Acesse: https://coolify.zappro.site
2. Faça login com as credenciais armazenadas em Infisical (`coolify-root-user-password`)
3. Crie um novo **Project** (ou use um existente)
4. Dentro do project, clique **Add New** → **Docker Compose**
5. Configure:
   - **Name:** `crm-mvp`
   - **Repository:** `git@github.com:zapprosite/monorepo.git`
   - **Branch:** `master`
   - **Base Directory:** `./crm-mvp`
   - **Docker Compose:** `docker-compose.coolify.yml`
6. Configure **Environment Variables** no painel do Coolify:
   - `DB_PASSWORD` → gere uma senha forte (ex: `openssl rand -hex 32`)
   - `JWT_SECRET` → gere um secret (ex: `openssl rand -hex 64`)
7. Clique **Deploy**

### Após o deploy

O Coolify gera automaticamente:
- **Webhook URL** para auto-deploy (ex: `https://coolify.zappro.site/api/v1/deploy?uuid=...`)
- **URL pública** (mapeie para `crm.zappro.site` no Cloudflare Tunnel)

Para auto-deploy, configure o webhook no Gitea:
- Vá em: `https://git.zappro.site/will-zappro/monorepo/settings/hooks`
- Adicione um webhook tipo **Gitea**
- Target URL: `https://coolify.zappro.site/api/v1/deploy?uuid=<SERVICE_UUID>&force=false`
- Secret: (deixe em branco)
- Trigger: **Push events**

---

## Verificação pós-deploy

```bash
curl -sfI https://crm.zappro.site/
# Esperado: HTTP/2 200 ou redirect para /auth/login
```

---

## Segurança

- **Classificação:** INTERNAL — requer Cloudflare Access
- **Postgres:** NÃO exposto na host (rede interna Docker apenas)
- **Redis:** NÃO exposto na host
- **API:** Exposto apenas via nginx proxy (/trpc) na porta 3080
- **Coolify AllowList:** Adicione apenas IPs confiáveis

---

## Rollback

```bash
cd /srv/monorepo/crm-mvp
docker compose -f docker-compose.coolify.yml down
# Ou pelo dashboard Coolify: Stop → Delete
```

---

## Referências

- Skill: `cloudflare-tunnel-enterprise` (subdomain + tunnel)
- Skill: `coolify-access` (API — mas lembre-se da AllowList!)
- Skill: `gitea-cli` (webhooks via API)
- Script: `/srv/monorepo/scripts/auto-deploy.sh` (orchestra subdomain + deploy)
- Docs: `/srv/monorepo/ops/ai-governance/SUBDOMAINS.md`
- Docs: `/srv/monorepo/ops/ai-governance/PORTS.md`
