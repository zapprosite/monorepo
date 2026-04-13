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

### 4. TERRAFORM
1. Ler `/srv/ops/terraform/cloudflare/variables.tf` (bloco var.services)
2. Adicionar entrada em var.services:
   ```hcl
   app_name = {
     url              = "http://10.0.X.X:PORT"   # IP DO CONTAINER, nao localhost
     subdomain        = "app-name"
     http_host_header = null
   }
   ```
3. `cd /srv/ops/terraform/cloudflare && terraform apply`
4. Verificar DNS criado

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
// app.js ou auth-callback.html
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=GOOGLE_CLIENT_ID        → Infisical: obsidian-web/GOOLE_CLIENT_ID
&client_secret=GOOGLE_CLIENT_SECRET → Infisical: obsidian-web/GOOGLE_CLIENT_SECRET
&code=AUTH_CODE
&code_verifier=PKCE_VERIFIER
&redirect_uri=https://subdomain.zappro.site/auth/callback
```

**Sem `client_secret` → `invalid_client` ou `client_secret is missing`**

### Credentials (homelab — via Infisical)

```
GOOGLE_CLIENT_ID=→ Infisical: GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET=→ Infisical: GOOGLE_CLIENT_SECRET
```

**NUNCA hardcodar. Usar Infisical SDK.**

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

### Infisical SDK
NUNCA hardcodar OAuth client_id. Usar Infisical SDK:
```typescript
import { InfisicalClient } from '@infisical/sdk';
const client = new InfisicalClient({ clientId: process.env.INFISICAL_CLIENT_ID });
const secret = await client.getSecret('GOOGLE_CLIENT_ID');
```

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
vault.zappro.site → Cloudflare Access (@zappro.site) → OAuth Google
```

### Como configurar OAuth-only (MVP)
1. Em `access.tf`, adicionar novo subdomain à exclusão:
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
- `references/file-structure.md` — Templates de todos os arquivos
- `references/oauth-flow.md` — Passos Google OAuth setup (inclui token exchange)
- `references/tunnel-setup.md` — Como adicionar subdomain no Terraform
- `references/container-deploy.md` — Docker build e deploy
- `references/smoke-test.md` — Checklist de verificacao
- `references/troubleshooting.md` — Erros comuns e solucoes

## Incidentes Conhecidos

- **INCIDENT-2026-04-13**: `client_secret is missing` — OAuth broken até adicionar secret ao POST body. Ver `docs/INFRASTRUCTURE/INCIDENTS/INCIDENT-2026-04-13-md-zappro-site-oauth.md`