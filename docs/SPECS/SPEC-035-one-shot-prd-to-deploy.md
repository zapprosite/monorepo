---
id: SPEC-035
title: One-Shot PRD-to-Deploy Pipeline
status: PENDING
priority: high
author: will-zappro
date: 2026-04-13
specRef: SPEC-026, SPEC-034, SPEC-032
---

# SPEC-035: One-Shot PRD-to-Deploy Pipeline

> **Objetivo:** Pipeline automatizado que transforma um PRD em texto em aplicacao live em producao com subdomain + OAuth, com minimo input humano.

---

## Objective

Criar um pipeline automatizado end-to-end que permite ao usuario descrever uma aplicacao web em linguagem natural e, apos uma configuracao inicial de OAuth via Google Console, ter a aplicacao live em producao sem intervencao manual adicional.

**Problema resuelto:** O workflow atual de deploy de uma nova web app exige 15+ passos manuais entre Claude Code, Google Console, Terraform, e Docker. Este pipeline reduz a 2 inputs humanos: (1) o PRD e (2) confirmacao de OAuth setup.

**Beneficio:** De "quero um dashboard mostrando X com Google login" a `https://dashboard.zappro.site` em menos de 15 minutos.

---

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Orchestrator | Claude Code CLI | `/prd-to-deploy` skill |
| Infrastructure | Terraform + Cloudflare Tunnel | Subdomain creation |
| Runtime | Docker + Coolify | Container deployment |
| OAuth | Google OAuth 2.0 | Native (MVP) ou Cloudflare Access (v2) |
| Secrets | Infisical SDK | Zero hardcoded secrets |
| Documentation | ai-context-sync | Auto-update docs |

---

## The Pipeline Flow

```
Human: /prd-to-deploy "I want a dashboard showing X with Google login"

┌──────────────────────────────────────────────────────────────────────────────┐
│ STEP 0: PRINT OAUTH URIS (antes de qualquer outra coisa!)                     │
│         →IMPRIME as URIs no console PARA O USER ver                         │
│         →USER configura Google Console PRIMEIRO                             │
├──────────────────────────────────────────────────────────────────────────────┤
│ STEP 1: Parse PRD                                                             │
│         → Extract: app name, subdomain, features, auth requirements          │
├──────────────────────────────────────────────────────────────────────────────┤
│ STEP 2: Generate /spec                                                       │
│         → Cria SPEC-NNN-nome.md em docs/SPECS/                              │
│         → Definece estrutura de arquivos (HTML, nginx, Dockerfile, etc)      │
├──────────────────────────────────────────────────────────────────────────────┤
│ STEP 3: Create subdomain                                                     │
│         → Cloudflare API via terraform-cloudflare skill                     │
│         → Adiciona entrada em var.services                                  │
│         → terraform apply                                                   │
├──────────────────────────────────────────────────────────────────────────────┤
│ STEP 4: ⏸️ HUMAN GATE #1                                                      │
│         → "Add these URIs to Google Console. Press ENTER when done."        │
│         → O pipeline PAUSA aqui ate user confirmar                          │
│         → URIsprinted em Step 0 devem ser adicionadas ao OAuth Client       │
├──────────────────────────────────────────────────────────────────────────────┤
│ STEP 5: Generate all files                                                   │
│         → index.html (HTML principal com OAuth JS)                          │
│         → auth-callback.html (OAuth callback handler)                      │
│         → nginx.conf (reverse proxy + OAuth routes)                         │
│         → Dockerfile (nginx:alpine, non-root user)                          │
│         → docker-compose.yml (healthcheck, port mapping)                    │
│         → build.sh (optional build script)                                  │
├──────────────────────────────────────────────────────────────────────────────┤
│ STEP 6: Deploy                                                               │
│         → docker compose build                                              │
│         → docker compose up -d                                              │
│         → Verificar container health                                         │
├──────────────────────────────────────────────────────────────────────────────┤
│ STEP 7: Smoke test                                                           │
│         → curl -sfI https://SUBDOMAIN.zappro.site (HTTP 200/302)            │
│         → OAuth flow verification                                           │
│         → Container health status                                            │
├──────────────────────────────────────────────────────────────────────────────┤
│ STEP 8: Update docs                                                          │
│         → SUBDOMAINS.md (novo subdomain)                                     │
│         → PORTS.md (nova porta)                                             │
│         → AGENTS.md (nova skill se aplicavel)                               │
├──────────────────────────────────────────────────────────────────────────────┤
│ STEP 9: Commit + push                                                        │
│         → git add + commit                                                   │
│         → mirror-sync.sh (Gitea + GitHub)                                   │
│         → Nova branch feature/xxx-yyy                                       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## OAuth Strategy

### Mode 1: Direct OAuth (MVP) — RECOMENDADO

Apps MVP usam Google OAuth nativo diretamente no browser. Sem Cloudflare Access.

**Fluxo:**
```
User → https://dashboard.zappro.site
     → App redirect para Google OAuth
     → Google valida credenciais
     → Callback para /auth/callback
     → Token exchange no browser (client_secret NO POST body)
     → Sessao estabelecida
```

**URIs para Google Console:**
- **Redirect URI:** `https://dashboard.zappro.site/auth/callback`
- **JavaScript Origin:** `https://dashboard.zappro.site`

**OAuth Token Exchange (CRÍTICO):**
```javascript
// auth-callback.html
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=GOOGLE_CLIENT_ID
&client_secret=GOOGLE_CLIENT_SECRET  // ← OBRIGATORIO no POST body
&code=AUTH_CODE
&code_verifier=PKCE_VERIFIER
&redirect_uri=https://dashboard.zappro.site/auth/callback
```

**Sem `client_secret` → `invalid_client` ou `client_secret is missing`**

### Mode 2: CF Access (v2) — Para apps maduros

Apps que precisam de protecao extra usam Cloudflare Access + OAuth Google.

**Fluxo:**
```
     → Cloudflare Access intercepta
     → OAuth Google via Cloudflare
     → App recebe headers X-Forwarded-*
     → Sessao estabelecida
```

**Configuracao:**
1. Em `access.tf`, adicionar subdomain à excecao de protection:
   ```hcl
   access_services = { for k, v in var.services : k => v if k != "bot" && k != "vault" }
   ```
2. `terraform apply`
3. Cloudflare Access gerencia OAuth

---

## Skills Required

| Skill | Trigger | Purpose |
|-------|---------|---------|
| `prd-to-deploy` | `/prd-to-deploy <description>` | **Orchestrator principal** — coordena todo o pipeline |
| `new-subdomain` | `/new-subdomain` | Create subdomain via Terraform + Cloudflare API |
| `oauth-google-direct` | `/oauth-google-direct` | Setup OAuth Google native (MVP) |
| `oauth-google-cloudflare` | `/oauth-google-cloudflare` | Setup OAuth via Cloudflare Access (v2) |
| `spec` | `/spec` | Spec generation — cria SPEC doc a partir do PRD |
| `list-web-from-zero-to-deploy` | `/new-list-web` | Create static web app zero→deploy (referencia) |

---

## Scripts Required

### `scripts/prd-to-deploy-oneshot.sh`

Script principal que orchestra o pipeline.

```bash
#!/bin/bash
# prd-to-deploy-oneshot.sh
# Usage: bash scripts/prd-to-deploy-oneshot.sh "I want a dashboard showing X"

set -euo pipefail

PRD_DESCRIPTION="$1"
APP_NAME="$(echo "$PRD_DESCRIPTION" | slugify)"  # extract name from description
SUBDOMAIN="$(echo "$APP_NAME" | lowercase)"

# STEP 0: Print OAuth URIs PRIMEIRO
echo "=========================================="
echo "STEP 0: OAUTH SETUP - CONFIGURE GOOGLE CONSOLE FIRST"
echo "=========================================="
echo ""
echo "Add these URIs to your Google Cloud Console OAuth Client:"
echo ""
echo "  Redirect URI: https://${SUBDOMAIN}.zappro.site/auth/callback"
echo "  JavaScript Origin: https://${SUBDOMAIN}.zappro.site"
echo ""
echo "=========================================="
echo "HUMAN GATE #1: Configure Google Console, then press ENTER"
echo "=========================================="
read -r confirm

# Continue com Steps 1-9...
```

### `scripts/create-subdomain.sh`

Cria subdomain via Terraform.

```bash
#!/bin/bash
# create-subdomain.sh
# Usage: bash scripts/create-subdomain.sh <subdomain> <container_ip> <port>

SUBDOMAIN="$1"
CONTAINER_IP="$2"
PORT="$3"

# Adiciona entrada em var.services do Terraform
cd /srv/ops/terraform/cloudflare

# Valida subdomain nao existe
if grep -q "\"$SUBDOMAIN\"" variables.tf; then
    echo "ERROR: Subdomain $SUBDOMAIN already exists in variables.tf"
    exit 1
fi

# Adiciona novo servico (patch pattern)
cat >> variables.tf << EOF
  $SUBDOMAIN = {
    url              = "http://${CONTAINER_IP}:${PORT}"
    subdomain        = "$SUBDOMAIN"
    http_host_header = null
  }
EOF

terraform apply -auto-approve

echo "Subdomain $SUBDOMAIN created successfully"
```

### `scripts/setup-oauth.sh`

Guarda credenciais OAuth no Infisical.

```bash
#!/bin/bash
# setup-oauth.sh
# Usage: bash scripts/setup-oauth.sh <app_name> <client_id> <client_secret>

APP_NAME="$1"
CLIENT_ID="$2"
CLIENT_SECRET="$3"

INFISICAL_TOKEN="$(cat /srv/ops/secrets/infisical.service-token)"

# Upsert secret via Infisical SDK (Python)
python3 - << EOF
from infisical_sdk import InfisicalSDKClient
client = InfisicalSDKClient(
    token="$INFISICAL_TOKEN",
    host='http://127.0.0.1:8200'
)
project_id = 'e42657ef-98b2-4b9c-9a04-46c093bd6d37'

# GOOGLE_CLIENT_ID
client.secrets.create_secret(
    project_id=project_id,
    environment_slug='prod',
    secret_path="/$APP_NAME",
    secret_key='GOOGLE_CLIENT_ID',
    secret_value="$CLIENT_ID"
)

# GOOGLE_CLIENT_SECRET
client.secrets.create_secret(
    project_id=project_id,
    environment_slug='prod',
    secret_path="/$APP_NAME",
    secret_key='GOOGLE_CLIENT_SECRET',
    secret_value="$CLIENT_SECRET"
)
print("OAuth credentials stored in Infisical")
EOF
```

---

## Human Gates

O pipelinetem exatamente **2 gates humanos** obrigatorios:

| Gate | Quando | Prompt | User Action |
|------|--------|--------|-------------|
| **Gate 1** | Apos Step 0 | "Add these URIs to Google Console. Press ENTER when done." | Configurar OAuth no Google Cloud Console |
| **Gate 2** | Apos Step 7 (opcional) | "Deployment ready. Approve final deploy? [Y/n]" | Aprovar ou cancelar deploy |

**Regra:** Nunca prosegi sem Gate 1 confirmado. Gate 2 opcional depending on deploy strategy.

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | PRD → live URL em < 15 minutos | Timer do primeiro ao ultimo passo |
| AC-2 | OAuth URI impressa ANTES de qualquer codigo escrito | Log do pipeline mostra Step 0 primeiro |
| AC-3 | User inputs apenas: PRD description + ENTER (apos OAuth config) | Zero commands alem do trigger |
| AC-4 | Subdomain criado automaticamente | `curl -sfI https://SUB.zappro.site` retorna 200/302 |
| AC-5 | Smoke test passa antes de declarar sucesso | `curl -sfI https://SUB.zappro.site` + container health OK |
| AC-6 | Docs atualizados automaticamente | SUBDOMAINS.md, PORTS.md, AGENTS.md verificados pos-deploy |
| AC-7 | Zero hardcoded secrets | Secrets via Infisical SDK apenas |

---

## Files Affected

| File | Change |
|------|--------|
| `docs/SPECS/SPEC-NNN-nome.md` | Created by pipeline |
| `apps/<app-name>/` | Created by pipeline (HTML, nginx, Dockerfile, docker-compose) |
| `/srv/ops/terraform/cloudflare/variables.tf` | Subdomain entry added |
| `docs/GOVERNANCE/SUBDOMAINS.md` | Updated with new subdomain |
| `docs/GOVERNANCE/PORTS.md` | Updated with new port |
| `AGENTS.md` | Updated if new skill created |
| `.claude/skills/prd-to-deploy/SKILL.md` | Created |

---

## Reference Skills

| Skill | File | Relevance |
|-------|------|-----------|
| `list-web-from-zero-to-deploy` | `.claude/skills/list-web-from-zero-to-deploy/SKILL.md` | Template para estrutura de arquivos e OAuth |
| `cloudflare-terraform` | `.claude/skills/cloudflare-terraform/SKILL.md` | Subdomain creation via Terraform |
| `spec` | `.claude/skills/spec/SKILL.md` | Spec generation |
| `oauth-google-direct` | `.claude/skills/oauth-google-direct/SKILL.md` | OAuth setup (MVP) |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-13 | Pipeline imprimie URIs antes de qualquer codigo | User precisa configurar Google Console primeiro — passo async que nao pode ser automatizado |
| 2026-04-13 | Gate 1 obrigatorio, Gate 2 opcional | OAuth configuracao critica para seguranca; deploy final pode ser auto-aprovado |
| 2026-04-13 | Mode 1 (Direct OAuth) como default | Simplicidade — Cloudflare Access e overhead desnecessario para apps MVP |
| 2026-04-13 | client_secret OBRIGATORIO no token exchange | INCIDENT-2026-04-13 provou que sem secret o OAuth falha silenciosamente |

---

## Non-Goals

- Este pipeline nao cobre backend apps com tRPC/Fastify (SPEC-XXX para isso)
- Nao substitui o workflow `/spec` completo para features complexas
- Nao inclui CI/CD automation via Gitea Actions (deploy direto via Coolify)

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Terraform + Cloudflare provider | READY | ja configurado em `/srv/ops/terraform/cloudflare/` |
| Infisical SDK | READY | ja em uso no monorepo |
| Docker + Coolify | READY | ja configurado |
| Google OAuth 2.0 | READY | reque apenas configuracao manual no Console |
| `list-web-from-zero-to-deploy` skill | READY | template para estrutura |

---

## Open Questions

| # | Question | Impact | Priority |
|---|----------|--------|----------|
| OQ-1 | Como lidar com multi-tenant OAuth (varios apps com o mesmo Google Client)? | Medium | Med |
| OQ-2 | Devemos suportar OAuth via GitHub alem de Google? | Low | Low |

---

## Checklist

- [ ] Pipeline skill `/prd-to-deploy` criado
- [ ] Scripts `prd-to-deploy-oneshot.sh`, `create-subdomain.sh`, `setup-oauth.sh` criados
- [ ] Skill `oauth-google-direct` documentado
- [ ] Teste com app dummy "hello-world" → deploy bem-sucedido
- [ ] Smoke test automated no pipeline
- [ ] Documentation atualizada (SUBDOMAINS.md, PORTS.md, AGENTS.md)
- [ ] Zero hardcoded secrets verificado

---

## Example Invocation

```bash
# Trigger o pipeline
/prd-to-deploy "I want a links dashboard with my favorite tools and Google login"

# Output esperado:
# STEP 0: OAuth Setup
# Add https://links.zappro.site/auth/callback to Google Console
# Press ENTER when done...

# [User vai ao Google Console, configura, volta, pressiona ENTER]

# Pipeline continua automaticamente...
# STEP 1: Parsing PRD...
# STEP 2: Generating SPEC...
# STEP 3: Creating subdomain...
# STEP 4: Human gate confirmed
# STEP 5: Generating files...
# STEP 6: Deploying...
# STEP 7: Smoke test...
# SUCCESS: https://links.zappro.site is live!
```
