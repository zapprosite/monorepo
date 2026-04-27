# Cloudflare Setup — Homelab Zappro

**Data:** 2026-04-27
**Estado:** ✅ Operacional
**Última actualização:** 2026-04-27

---

## Arquitectura de Credenciais

### Dois tipos de credenciais Cloudflare

| Tipo | Formato | Uso | Local |
|---|---|---|---|
| **Global API Key** | `cfk_...` | Criar tokens via API (cloudflare-token-create.sh) | `/srv/monorepo/.env` |
| **API Token** | `cfut_...` | Terraform e automação | `/srv/ops/secrets/cloudflare-api-token.env` |

### Hierarquia de ficheiros

```
/srv/monorepo/.env
├── CF_GLOBAL_KEY=cfk_...          # Criar tokens (só este ficheiro)
├── CF_EMAIL=zappro.ia@gmail.com
├── CLOUDFLARE_ACCOUNT_ID=...      # Público, mas no .env
├── CLOUDFLARE_ZONE_ID=...         # Público, mas no .env
└── # CLOUDFLARE_API_TOKEN=        # NÃO — está no secrets dir

/srv/ops/secrets/                   # 600, owner=will:will
├── cloudflare-api-token.env        # Token Terraform (TF_VAR_cloudflare_api_token)
├── cloudflare-account-id.env        # Account ID (opcional, sobrepõe .env)
└── cloudflare-zone-id.env           # Zone ID (opcional, sobrepõe .env)
```

---

## Permissões do Token Terraform

O token `cfut_...` tem estas permissões (criado via dashboard Cloudflare):

```
Account: Cloudflare Tunnel    → Edit
Account: Access: Apps and Policies → Edit
Zone: Zone                    → Read
Zone: DNS                     → Edit
Recurso: zappro.site
Validade: 1 ano
```

**Porque não por API:** A API de criação de tokens (`POST /client/v4/user/tokens`) está a retornar erro `Empty or missing scopes for new subject group` neste account standard. Solução: criar manualmente pelo dashboard.

---

## Scripts

### cloudflare-env-sync.sh

**Propósito:** Carrega variáveis do `.env` e do secrets dir, exporta TF_VAR_ para Terraform.

```bash
set -a
source /srv/ops/scripts/cloudflare-env-sync.sh
set +a
```

**O que faz:**
1. Source do `.env` real
2. Source de `/srv/ops/secrets/*.env` (sobrescreve .env se existirem)
3. Exporta `TF_VAR_cloudflare_api_token`, `TF_VAR_cloudflare_account_id`, `TF_VAR_cloudflare_zone_id`
4. Unset de todas as variáveis sensíveis após exportar

**Segurança:**
- Nunca imprime valores de variáveis
- Belt-and-suspenders unset: GROQ_API_KEY, OPENAI_KEY, CF_GLOBAL_KEY, etc.

### cloudflare-token-create.sh

**Propósito:** Criar tokens API via Global Key (manual, para criar novos tokens).

```bash
bash /srv/ops/scripts/cloudflare-token-create.sh \
  --name "Nexus Deploy 2026-04-27" \
  --expires 2027-01-01
```

**Output:**
- Token guardado em `/srv/ops/secrets/cloudflare-api-token.env` (600)
- `.env` actualizado com `CLOUDFLARE_API_TOKEN=...`
- Nunca imprime o token no terminal

### plan.sh

**Propósito:** Terraform plan (read-only, nunca apply).

```bash
bash /srv/ops/terraform/cloudflare/plan.sh
```

---

## Regras de Segurança

### Para TODOS os agentes e CLIs (Claude Code, Codex, Docker, Bash, etc.)

**Regra de ouro:** Nunca imprimir, echoar, ou mostrar valores de variáveis que contenham secrets.

### Verificar se token existe — SEM EXPOR

```bash
# ✅ CERTO — verifica sem expor
test -n "${TF_VAR_cloudflare_api_token:-}" && echo "Token carregado"

# ❌ ERRADO — expõe o valor
echo $TF_VAR_cloudflare_api_token
echo "Token: $TF_VAR_cloudflare_api_token"
```

### Testar autenticação — SEM EXPOR

```bash
# ✅ CERTO — usa em comando, não em output
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer ${TF_VAR_cloudflare_api_token}" \
  "https://api.cloudflare.com/client/v4/user/tokens"

# ❌ ERRADO — loga o token
curl -H "Authorization: Bearer $TF_VAR_cloudflare_api_token" ...
```

### Padrões proibidos

```bash
# ❌ NUNCA faça isto
cat /srv/ops/secrets/cloudflare-api-token.env
grep TOKEN /srv/monorepo/.env
echo $CF_GLOBAL_KEY
printenv | grep TOKEN
docker logs <container> 2>&1 | grep TOKEN
```

### Para Docker / Containers

```dockerfile
# ✅ CERTO — passa token via build arg ou env, nunca no output
ARG TF_VAR_CLOUDFLARE_API_TOKEN
ENV TF_VAR_CLOUDFLARE_API_TOKEN=$TF_VAR_CLOUDFLARE_API_TOKEN

# ❌ ERRADO — EXPÕE o token no build output
RUN echo $TF_VAR_CLOUDFLARE_API_TOKEN
```

```bash
# ✅ Verificar que container não loga secrets
docker logs <container> 2>&1 | grep -E "cfk_|cfut_|sk-" && echo "LEAK DETECTED"
```

### Para Claude Code / Codex CLI

```bash
# ✅ Verificar vars sem expor
[[ -n "${CF_GLOBAL_KEY:-}" ]] && echo "CF_GLOBAL_KEY: definida"

# ❌ NUNCA em prompts ou output
# Prompt: "mostra o valor de $TF_VAR_cloudflare_api_token" ❌
```

### Teste rápido — o único padrão seguro

```bash
# Unico comando seguro para verificar token
test -n "${TF_VAR_cloudflare_api_token:-}" && echo "Token carregado"
```

### Ficheiros com segredos

| Ficheiro | Ler conteúdo | Exceção |
|---|---|---|
| `/srv/monorepo/.env` | ❌ Proibido | `source` em scripts |
| `/srv/ops/secrets/*.env` | ❌ Proibido | `source` via env-sync.sh |
| `terraform.tfvars` | ❌ Proibido | Não tem token |

### Padrão de validação pre-commit

```bash
# Bloquear se detectar secrets no diff
git diff | grep -iE "cfk_|cfut_|sk-[a-z0-9]{20,}" && exit 1
```

---

## Estado Actual dos Recursos

### DNS Records (15 total)

```
CNAME api.zappro.site      → aee7a93d...cfargotunnel.com  (proxied)
CNAME chat.zappro.site     → aee7a93d...cfargotunnel.com  (proxied)
CNAME coolify.zappro.site → aee7a93d...cfargotunnel.com  (proxied)
CNAME git.zappro.site      → aee7a93d...cfargotunnel.com  (proxied)
CNAME hermes.zappro.site   → aee7a93d...cfargotunnel.com  (proxied)
CNAME llm.zappro.site      → aee7a93d...cfargotunnel.com  (proxied)
CNAME pgadmin.zappro.site  → aee7a93d...cfargotunnel.com  (proxied)
CNAME qdrant.zappro.site   → aee7a93d...cfargotunnel.com  (proxied)
A     obsidian.zappro.site → 104.21.13.230                (proxied)
```

### Tunnel

```
ID:     aee7a93d-c2e2-4c77-a395-71edc1821402
Nome:   will-zappro-homelab
Status: healthy
CNAME:  aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com
```

### cloudflared (local)

```
Status:     inactive (dead) — desde 2026-04-26 13:10
Config:     /etc/cloudflared/config.yml
Ingress:    llm(:4000), api(:4000), hermes(:8642), qdrant(:6333)
```

**Nota:** Ingress local (`/etc/cloudflared/config.yml`) está DRIFT em relação ao Terraform:
- Local: `llm.zappro.site → :4000` (LiteLLM)
- Terraform: `llm.zappro.site → :4002` (ai-gateway)

---

## Problemas Conhecidos

| Problema | Severity | Estado |
|---|---|---|
| cloudflared service stopped | 🔴 CRITICAL | Parado desde 2026-04-26 |
| Ingress drift (llm porta) | 🔴 HIGH | Terraform usa :4002, local usa :4000 |
| SUBDOMAINS.md desactualizado | ⚠️ MEDIUM | Falta md, list, pgadmin |
| qdrant.zappro.site deprecated mas live | ⚠️ MEDIUM | SUBDOMAINS.md marca DEPRECATED |
| Terraform não gere cloudflared config local | ⚠️ MEDIUM | Só gere Cloudflare, não o /etc/cloudflared/config.yml |

---

## Ficheiros

```
/srv/monorepo/.env                              # .env principal
/srv/monorepo/docs/CLOUDFLARE_SETUP.md          # Esta documentação
/srv/ops/secrets/                               # Tokens (600)
/srv/ops/scripts/cloudflare-token-create.sh      # Criar tokens
/srv/ops/scripts/cloudflare-env-sync.sh         # Sync env → TF_VAR_
/srv/ops/terraform/cloudflare/                   # Terraform
├── main.tf                                     # Resources (tunnel, DNS, access)
├── variables.tf                                # Services map
├── access-hermes.tf                            # Access app + policy
├── terraform.tfvars                            # (gitignored) - sem token hardcoded
├── plan.sh                                     # Terraform plan
└── deploy-subdomain.sh                         # Deploy subdomain

/srv/monorepo/.claude/rules/
├── cloudflare-secrets-harden.md               # Regras de hardening
└── cloudflare-secrets.md                       # Regra anti-exposição

/srv/monorepo/.claude/agents/
└── cloudflare-security-rules.md                # Regras para agents
```

---

## Próximos Passos

1. **Restart cloudflared:** `sudo systemctl restart cloudflared`
2. **Terraform apply:** Corrigir ingress drift e actualizar Access policies
3. **Atualizar SUBDOMAINS.md:** Adicionar md, list, pgadmin
4. **Limpar qdrant:** Remover DNS e ingress se realmente deprecated
5. **Testar hermes.zappro.site:** smoke test após restart

---

## Links

- Dashboard: https://dash.cloudflare.com
- API Tokens: https://dash.cloudflare.com/profile/api-tokens
- Zona: https://dash.cloudflare.com/zones/c0cf47bc153a6662f884d0f91e8da7c2/dns
- Tunnel: https://dash.cloudflare.com/team-networks/tunnels
