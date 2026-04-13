# INCIDENT-2026-04-09: OpenWebUI Google OAuth — Wrong Credentials + Cloudflare Access Blocking

**Date:** 2026-04-09
**Severity:** 🟡 Important
**Status:** RESOLVED
**Duration:** ~2 hours
**Author:** will + Claude Code

---

## Resumo

OpenWebUI em `chat.zappro.site` não mostrava botão Google OAuth. Após remoção do Cloudflare Access e correção de credenciais, login Google OAuth passou a funcionar.

---

## Timeline

| Hora | Evento |
|------|--------|
| ~13:30 | OpenWebUI deployed com credenciais OAuth erradas |
| ~13:40 | Cloudflare Access removido via Terraform (`chat` excluido de `access_services`) |
| ~13:50 | OAuth callback apontava para `.sslip.io` interno — ERR_CONNECTION_TIMED_OUT |
| ~14:00 | Corrigido `SERVICE_URL_OPENWEBUI_8080` para `https://chat.zappro.site:8080` |
| ~14:10 | Erro `invalid_client: The provided client secret is invalid` |
| ~14:20 | Credenciais Google OAuth corrigidas (client_id + client_secret novos) |
| ~14:25 | OAuth funcionando — utilizador confirmou |

---

## Root Cause

**3 problemas combinados:**

1. **Credenciais OAuth erradas** — `CLIENT_ID` e `CLIENT_SECRET` eram placeholders/temporários (`[GOOGLE_OAUTH_SECRET]`) em vez das credenciais reais do Google Cloud Console para `chat.zappro.site`

2. **Cloudflare Access protegia o domínio** — `chat.zappro.site` estava no filtro `access_services` do Terraform, fazendo redirect para `zappro.cloudflareaccess.com` em vez de deixar passar direto ao OpenWebUI

3. **`SERVICE_URL_OPENWEBUI_8080` apontava para SSLIP interno** — O callback URL gerado pelo OpenWebUI usava `openwebui-wbmqefxhd7vdn2dme3i6s9an.191.17.50.123.sslip.io` que não resolve externamente

---

## Fixes Aplicados

### 1. Remoção Cloudflare Access de `chat.zappro.site`

**Ficheiro:** `/srv/ops/terraform/cloudflare/access.tf`

```hcl
# ANTES
access_services = { for k, v in var.services : k => v if k != "bot" }

# DEPOIS
access_services = { for k, v in var.services : k => v if k != "bot" && k != "chat" }
```

**Apply:**
```bash
cd /srv/ops/terraform/cloudflare && terraform apply -auto-approve
```

**Resultado:** `chat.zappro.site` responde HTTP 200 direto (sem interceptação Cloudflare Access)

---

### 2. Correcção URLs internos no docker-compose.yml

**Ficheiro:** `/data/coolify/services/wbmqefxhd7vdn2dme3i6s9an/docker-compose.yml`

```yaml
# ANTES
SERVICE_URL_OPENWEBUI_8080: 'http://openwebui-wbmqefxhd7vdn2dme3i6s9an.191.17.50.123.sslip.io:8080'
COOLIFY_FQDN: openwebui-wbmqefxhd7vdn2dme3i6s9an.191.17.50.123.sslip.io
COOLIFY_URL: 'http://openwebui-wbmqefxhd7vdn2dme3i6s9an.191.17.50.123.sslip.io'

# DEPOIS
SERVICE_URL_OPENWEBUI_8080: 'https://chat.zappro.site:8080'
COOLIFY_FQDN: chat.zappro.site
COOLIFY_URL: 'https://chat.zappro.site'
```

---

### 3. Correcção credenciais Google OAuth

**Ficheiro:** `/data/coolify/services/wbmqefxhd7vdn2dme3i6s9an/.env`

```env
# ANTES (errado)
OAUTH_GOOGLE_CLIENT_ID=297107448858-324eplshrg5vv2br911l4dtm8bjh0sl1.apps.googleusercontent.com
GOOGLE_CLIENT_ID=297107448858-324eplshrg5vv2br911l4dtm8bjh0sl1.apps.googleusercontent.com
OAUTH_GOOGLE_CLIENT_SECRET=[GOOGLE_OAUTH_SECRET]
GOOGLE_CLIENT_SECRET=[GOOGLE_OAUTH_SECRET]

# DEPOIS (correcto)
OAUTH_GOOGLE_CLIENT_ID=<REDACTED - ver Infisical>
GOOGLE_CLIENT_ID=<REDACTED - ver Infisical>
OAUTH_GOOGLE_CLIENT_SECRET=<REDACTED - ver Infisical>
GOOGLE_CLIENT_SECRET=<REDACTED - ver Infisical>
```

---

### 4. Váriaveis adicionais de ambiente adicionadas

```env
ENABLE_OAUTH_SIGNUP=true
WEBUI_SECRET_KEY=ab621c4f72053c5e58ed426f11de1d7d2093c479486ea663cd136d52e08c0d0e
OPENID_PROVIDER_URL=https://accounts.google.com/.well-known/openid-configuration
GOOGLE_REDIRECT_URI=https://chat.zappro.site/oauth/google/callback
```

---

## Variaveis de Ambiente Finais (OpenWebUI)

| Variável | Valor |
|----------|-------|
| `SERVICE_URL_OPENWEBUI` | `https://chat.zappro.site` |
| `SERVICE_URL_OPENWEBUI_8080` | `https://chat.zappro.site:8080` |
| `COOLIFY_FQDN` | `chat.zappro.site` |
| `COOLIFY_URL` | `https://chat.zappro.site` |
| `WEBUI_SECRET_KEY` | `ab621c4f72053c5e58ed426f11de1d7d2093c479486ea663cd136d52e08c0d0e` |
| `ENABLE_OAUTH_SIGNUP` | `true` |
| `GOOGLE_CLIENT_ID` | `<REDACTED — ver Infisical prod>` |
| `GOOGLE_CLIENT_SECRET` | `<REDACTED — ver Infisical prod>` |
| `GOOGLE_REDIRECT_URI` | `https://chat.zappro.site/oauth/google/callback` |
| `OPENID_PROVIDER_URL` | `https://accounts.google.com/.well-known/openid-configuration` |
| `OLLAMA_BASE_URL` | `http://10.0.5.1:11434` |
| `AUDIO_STT_ENGINE` | `openai` |
| `AUDIO_STT_OPENAI_API_BASE_URL` | `http://10.0.19.8:8201/v1` |

---

## Pending: Update Infisical

⚠️ As credenciais **NÃO foram atualizadas no Infisical** (CLI não disponível nesta sessão). É necessário:

```bash
# Opção 1: Via Infisical CLI
infisical secrets set GOOGLE_CLIENT_ID=<NOVO_CLIENT_ID> --env=prod
infisical secrets set GOOGLE_CLIENT_SECRET=<NOVO_CLIENT_SECRET> --env=prod

# Opção 2: Via dashboard http://127.0.0.1:8200
```

---

## Action Items

- [ ] Atualizar Infisical com as credenciais corretas
- [ ] Revogar secret antigo `[GOOGLE_OAUTH_SECRET]` no Google Cloud Console (pode ter sido comprometido)
- [ ] Verificar se o `WEBUI_SECRET_KEY` gerado (`ab621c4f...`) está persistente ou foi gerado novo a cada reinício — se sim, gerar um fixo

---

## Referências

- SPEC-019: `/srv/monorepo/docs/SPECS/SPEC-019-openwebui-repair.md`
- Docker compose: `/data/coolify/services/wbmqefxhd7vdn2dme3i6s9an/docker-compose.yml`
- Environment: `/data/coolify/services/wbmqefxhd7vdn2dme3i6s9an/.env`
- Terraform access: `/srv/ops/terraform/cloudflare/access.tf`

---

**Actualizado:** 2026-04-09 14:30
