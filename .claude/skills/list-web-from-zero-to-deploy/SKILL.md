---
name: list-web-from-zero-to-deploy
description: Create a tools list web app from zero to deploy (OAuth, nginx, Docker, Terraform tunnel)
trigger: /new-list-web
---

# Skill: list-web-from-zero-to-deploy

Cria uma aplicacao web estatica com OAuth Google a partir do zero ate deploy em produção.

## Quando Usar

- Criar uma nova web app estatica com login OAuth Google
- Deploy de uma pagina de links/heroes para o homelab
- Substituir apps com OAuth simples (sem backend complexo)

## Processo

```
SPEC → FILES → OAUTH → TERRAFORM → DEPLOY → SMOKE TEST → DOCS
```

### 1. SPEC
Criar `docs/SPECS/SPEC-NNN-nome.md` com:
- Descricao do app (ferramentas, herois, etc)
- Lista de ferramentas/links
- Fluxo OAuth (Google)
- Subdomain destino

### 2. FILES
Criar estrutura no diretorio apps/ ou no destino:
```
app-name/
├── index.html          # HTML principal com OAuth
├── auth-callback.html  # Callback OAuth handler
├── nginx.conf          # Config nginx com rota /auth/callback
├── Dockerfile          # Build nginx:alpine com usuario nao-root
├── docker-compose.yml  # Compose com healthcheck
└── build.sh            # Script de build opcional
```

### 3. OAUTH
1. Google Cloud Console → APIs e servicos → Credenciais
2. Criar OAuth 2.0 Client ID
3. Adicionar redirect URI: `https://SUBDOMAIN.zappro.site/auth/callback`
4. Guardar client_id e client_secret no Infisical (nao hardcodar)

### 4. SUBDOMAIN (API Fast Path)

Para deploy rapido, usar a API direta (30s) ao inves de Terraform:

1. Verificar subdomain disponivel em `/srv/ops/ai-governance/SUBDOMAINS.md`
2. Verificar porta disponivel em `/srv/ops/ai-governance/PORTS.md` + `ss -tlnp | grep :PORT`
3. Obter CLOUDFLARE_API_TOKEN do Infisical (project: homelab-infra)
4. Criar CNAME DNS record via API:
   ```bash
   curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "type": "CNAME",
       "name": "<subdomain>",
       "content": "${CF_TUNNEL_ID}.cfargotunnel.com",
       "proxied": true
     }'
   ```
5. Obter tunnel config e adicionar ingress rule (antes do catch-all):
   ```bash
   # GET current config
   curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.result'

   # PUT updated config com novo ingress
   curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "ingress": [
         {"hostname": "<subdomain>.zappro.site", "service": "http://10.0.X.X:PORT"},
         {"hostname": "*.zappro.site", "service": "http_status:404"}
       ]
     }'
   ```
6. Verificar: `curl -sfI https://<subdomain>.zappro.site`

**Apos API fast path, sync para Terraform** (manter estado):
- Adicionar em `/srv/ops/terraform/cloudflare/variables.tf`
- `cd /srv/ops/terraform/cloudflare && terraform apply`
- Atualizar SUBDOMAINS.md e PORTS.md

### 5. DEPLOY
1. Build: `docker compose build`
2. Up: `docker compose up -d`
3. Verificar healthcheck OK
4. Verificar porta exposta (127.0.0.1:PORT:80)

### 6. SMOKE TEST
```bash
# HTTP 200 check
curl -sfI https://SUBDOMAIN.zappro.site

# OAuth flow check
curl -sfI https://SUBDOMAIN.zappro.site/auth/callback

# Container health
docker inspect --format='{{.State.Health.Status}}' CONTAINER_NAME
```

### 7. DOCS
- Atualizar SUBDOMAINS.md com novo subdomain
- Atualizar PORTS.md com nova porta
- Atualizar AGENTS.md se aplicavel
- Documentar credenciais Infisical

## OAuth Token Exchange (CRÍTICO)

O erro mais comum em OAuth client-side apps é `client_secret is missing`.

### Token Exchange POST Body — OBRIGATÓRIO

Quando o app faz exchange de authorization code por tokens no browser:

```javascript
// auth-callback.html (via env.js injection)
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=window.__ENV__.GOOGLE_CLIENT_ID
&client_secret=window.__ENV__.GOOGLE_CLIENT_SECRET
&code=AUTH_CODE
&code_verifier=PKCE_VERIFIER
&redirect_uri=https://subdomain.zappro.site/auth/callback
```

**Sem `client_secret` → `invalid_client` ou `client_secret is missing`**

### PKCE Implementation (OBRIGATÓRIO)

Web apps DEVEM usar PKCE para authorization code exchange:

```javascript
// Gerar PKCE verifier e challenge
function generateRandomString(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function generatePKCE() {
  const verifier = generateRandomString(64);
  const challenge = await sha256(verifier);
  sessionStorage.setItem('pkce_verifier', verifier);
  return { verifier, challenge };
}
```

### env.js Injection Pattern (OBRIGATÓRIO)

O container DEVE injetar credenciais via env.js, NAO sed placeholders:

```javascript
// window.__ENV__?.GOOGLE_CLIENT_ID
// window.__ENV__?.GOOGLE_CLIENT_SECRET
```

O env.js e criado pelo entrypoint do container a partir de secrets Infisical.

### Credentials (homelab — via .env)

**Padrao: .env como fonte canonica de secrets.**
Secrets sao syncados do Infisical para .env via sync script.

```
GOOGLE_CLIENT_ID=→ .env (synced from Infisical)
GOOGLE_CLIENT_SECRET=→ .env (synced from Infisical)
```

**NUNCA hardcodar. Ler de .env via process.env (web apps) ou window.__ENV__ (env.js injection).**

## Regras Importantes

### IPs de Container (NAO localhost)
Para servicos externos acessados via tunnel, SEMPRE usar IP do container Docker:
```
# ERRADO
url = "http://localhost:4080"

# CORRETO
url = "http://10.0.5.3:4080"
```

O tunnel do Cloudflare conecta ao IP do container, nao ao localhost do host.

### Atualizar Documentacao
Antes de fazer commit, verificar:
- [ ] SUBDOMAINS.md actualizado com novo subdomain
- [ ] PORTS.md actualizado com nova porta
- [ ] AGENTS.md actualizado se necessario

### Secrets Pattern
NUNCA hardcodar OAuth client_id. Usar .env como fonte canonica:
```typescript
// Web apps: via env.js injection
const clientId = window.__ENV__?.GOOGLE_CLIENT_ID;

// Node/Fastify: via process.env
const clientId = process.env.GOOGLE_CLIENT_ID;
```

**Padrao: secrets syncados do Infisical para .env via sync script. Ler de .env, nunca do Infisical diretamente.**

## Tunnel Checklist (OBRIGATORIO antes de commit)
- [ ] curl -sfI https://NOVO.zappro.site → 200 ou 302
- [ ] Ingress rule em variables.tf → IP de container (nao localhost)
- [ ] SUBDOMAINS.md actualizado
- [ ] PORTS.md actualizado
- [ ] AGENTS.md actualizado
- [ ] Smoke test passou
- [ ] OAuth login testado e funciona (não só HTTP 200)

## Cloudflare Access vs OAuth Nativo

### MVP Pattern (RECOMENDADO para apps初)
Apps MVP usam apenas Google OAuth nativo do app — SEM Cloudflare Access:

```
md.zappro.site → OAuth Google nativo do app → sem proteção Cloudflare
```

### v2 Pattern (para apps maduros)
Apps que precisam de proteção extra usam Cloudflare Access + OAuth:

```
```

### Como configurar OAuth-only (MVP)
1. Adicionar subdomain via API (new-subdomain skill) ou via Terraform:
   ```hcl
   access_services = { for k, v in var.services : k => v if k != "bot" && k != "list" && k != "md" && k != "NOVO" }
   ```
2. `terraform apply`
3. App usa Google OAuth diretamente (sem Cloudflare)

## Stack de Referencia
- nginx:alpine (stateless, healthcheck built-in)
- docker-compose com healthcheck
- Cloudflare Zero Trust Tunnel (ingress only)
- Google OAuth 2.0 nativo (SEM Cloudflare Access para MVP)
- Infisical SDK para secrets
- **client_secret SEMPRE no token exchange POST body**

## References
- `references/file-structure.md` — Templates de todos os arquivos (com env.js pattern)
- `references/oauth-flow.md` — Passos Google OAuth setup (PKCE + token exchange)
- `references/tunnel-setup.md` — Como adicionar subdomain no Terraform
- `references/container-deploy.md` — Docker build e deploy
- `references/smoke-test.md` — Checklist de verificacao
- `references/troubleshooting.md` — Erros comuns e solucoes
- `new-subdomain` skill — Fast path API para subdomain (30s)
- `oauth-google-direct` skill — Implementacao completa OAuth com PKCE

## Incidentes Conhecidos

- **INCIDENT-2026-04-13**: `client_secret is missing` — OAuth broken até adicionar secret ao POST body. Ver `docs/INFRASTRUCTURE/INCIDENTS/INCIDENT-2026-04-13-md-zappro-site-oauth.md`
