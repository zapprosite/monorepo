---
spec: SPEC-NEXUS-AUTO-DEPLOY
title: Nexus Auto-Deploy — Subdomain + Terraform + Coolify Automation
status: draft
date: 2026-04-27
author: will
---

# SPEC: Nexus Auto-Deploy — Subdomain + Terraform + Coolify

## 1. Overview

Automatizar criação de subdomains e deploy via Nexus usando Gitea + Coolify + Terraform Cloudflare — sem intervenção manual.

**Fluxo desejado:**
```
PR merged → Coolify webhook → Nexus deploy-agent → Terraform → cloudflared restart → smoke test
```

## 2. Arquitetura

### 2.1 Secrets Manager

```
/srv/ops/secrets/                    # gitignored
├── cloudflare-api-token.env        # TF_VAR_cloudflare_api_token
├── cloudflare-account-id.env       # TF_VAR_cloudflare_account_id
├── cloudflare-zone-id.env          # TF_VAR_cloudflare_zone_id
├── coolify-api-key.env             # COOLIFY_API_KEY
└── gitea-token.env                 # GITEA_TOKEN (for PR creation)
```

**Permissions:** `600` — owner only (no group/other access)

### 2.2 Terraform Deploy Script

**Path:** `/srv/ops/terraform/cloudflare/deploy-subdomain.sh`

**Usage:**
```bash
deploy-subdomain.sh --app APP --subdomain SUB --port PORT [--access true|false]
```

**Steps:**
1. Validar argumentos
2. Ler secrets de `/srv/ops/secrets/`
3. Adicionar entry em `variables.tf` se não existir
4. `terraform plan` (validar sem aplicar)
5. `terraform apply -auto-approve` (aplicar)
6. `sudo systemctl restart cloudflared` (propagar)
7. Smoke test no subdomain
8. Atualizar `SUBDOMAINS.md` com nova entrada

### 2.3 Coolify Webhook Script

**Path:** `/srv/ops/scripts/coolify-deploy.sh`

**Usage:**
```bash
coolify-deploy.sh --app APP_ID --commit COMMIT_SHA --branch main
```

**Steps:**
1. Ler `COOLIFY_API_KEY` de secrets
2. POST para Coolify API webhook
3. Poll status até `completed` ou `failed`
4. Retornar exit code

### 2.4 Smoke Test Script

**Path:** `/srv/ops/scripts/smoke-subdomain.sh`

**Usage:**
```bash
smoke-subdomain.sh --subdomain SUBDOMAIN [--expect-status 200]
```

**Checks:**
- DNS resolves (CNAME → tunnel)
- HTTP response (follow redirects)
- Cloudflare Access redirect se protected
- Response time < 3s

## 3. Nexus Deploy Agents

### 3.1 subdomain-creator (deploy mode)

**Trigger:** `nexus.sh --mode deploy --agent subdomain-creator`

**Input vars:**
- `APP_NAME` — nome da app (e.g., `ai-gateway`)
- `SUBDOMAIN` — subdominio (e.g., `llm`)
- `PORT` — porta local (e.g., `4002`)
- `ACCESS_REQUIRED` — `true` se Cloudflare Access needed

**Output:**
- Entry adicionada em `variables.tf`
- PR created no Gitea com changes
- Smoke test output

### 3.2 coolify-deployer (deploy mode)

**Trigger:** `nexus.sh --mode deploy --agent coolify-deployer`

**Input vars:**
- `APP_ID` — Coolify application UUID
- `COMMIT_SHA` — git commit to deploy
- `BRANCH` — branch (default: `main`)

**Output:**
- Deploy triggered via Coolify API
- PR comment com deploy status
- Final status reported

## 4. Secrets Setup

```bash
# Criar directory
sudo mkdir -p /srv/ops/secrets
sudo chmod 700 /srv/ops/secrets

# cloudflare-api-token.env
echo "export TF_VAR_cloudflare_api_token='cfut_xxx'" | sudo tee /srv/ops/secrets/cloudflare-api-token.env
echo "export TF_VAR_cloudflare_account_id='1a41f...'" | sudo tee /srv/ops/secrets/cloudflare-account-id.env
echo "export TF_VAR_cloudflare_zone_id='c0cf47...'" | sudo tee /srv/ops/secrets/cloudflare-zone-id.env

# coolify-api-key.env
echo "export COOLIFY_API_KEY='xxx'" | sudo tee /srv/ops/secrets/coolify-api-key.env

# Permissions
sudo chmod 600 /srv/ops/secrets/*.env
```

## 5. Acceptance Criteria

- [ ] `deploy-subdomain.sh` cria subdomain sem interação manual
- [ ] `coolify-deploy.sh` faz deploy via webhook e poll
- [ ] `smoke-subdomain.sh` valida subdomain em < 5s
- [ ] Secrets em `/srv/ops/secrets/` com permissões 600
- [ ] Nexus deploy-agent consegue criar subdomain via `nexus.sh --mode deploy --agent subdomain-creator`
- [ ] SUBDOMAINS.md atualizado automaticamente após deploy
- [ ] Rate limit: 500 RPM — delays inseridos em loops de API calls

## 6. Rate Limiting

- Terraform: sem rate limit (Cloudflare API tem limites altos)
- Coolify API: 1 call/s entre deploys
- Gitea API: 500 RPM (verificar rate limit do instance)
- Nexus agents: `sleep 0.12` entre calls quando em loop

## 7. Files

```
/srv/ops/
├── secrets/                         # gitignored, 600
│   ├── cloudflare-api-token.env
│   ├── cloudflare-account-id.env
│   ├── cloudflare-zone-id.env
│   ├── coolify-api-key.env
│   └── gitea-token.env
├── terraform/cloudflare/
│   └── deploy-subdomain.sh          # novo
├── scripts/
│   ├── coolify-deploy.sh            # novo
│   └── smoke-subdomain.sh           # novo
└── docs/SPECS/
    └── SPEC-NEXUS-AUTO-DEPLOY.md   # este
```
