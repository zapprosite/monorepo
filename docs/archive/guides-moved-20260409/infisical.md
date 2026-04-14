# Manual de Manutenção — Infisical Self-Hosted

**Host:** will-zappro | **Data:** 2026-04-04
**Versão:** v0.146.2 (infisical/infisical:latest-postgres)
**Projeto:** zappro-p-tc-k | **Environment:** dev (production com problema de folder root)

---

## 🔑 Credenciais

### Service Token (para automação / SDK)
```
INFISICAL_HOST_URL=http://127.0.0.1:8200
INFISICAL_TOKEN=st.799590ae-d36f-4e64-b940-aea0fb85cad8.6e0c269870bb4b5e004e3ed6ab3a1fe1.c9872f2b30bc650e7b27c851df04b0ad
INFISICAL_PROJECT_ID=e42657ef-98b2-4b9c-9a04-46c093bd6d37
INFISICAL_ENV_SLUG=dev
```

### Secrets da Instância (NUNCA COMMITAR)
```
ENCRYPTION_KEY=c15b893801bdea7803d16b782da6629c
AUTH_SECRET=HDY/uoI9iBEDxN2lvyApu7eNY3jrye2DQo+v0ZJ/EKw=
JWT_AUTH_SECRET=ivqWfplD62/+FuaPUJ71Jvdujp/v+Hf2zRHQaNfsNvPUO/w9pCvQpKrKGJgGbqMz459VvghkVVoYLzL6z8yP5w==
DB_CONNECTION_URI=postgresql://infisical:d30038411740b8d08b49ae932a99a4df@infisical-db:5432/infisical
REDIS_URL=redis://:infisical-redis-2026-secure@infisical-redis:6379
```

### Machine Identity (criada manualmente no dashboard)
```
Identity ID: ef7b89f9-ef4a-4cae-878e-342f7d24c9cc
Client ID (Universal Auth): 799590ae-d36f-4e64-b940-aea0fb85cad8
```
⚠️ O Client Secret foi criado e usado — se perder, recriar no dashboard.

---

## 📁 Arquivos no Host

| Arquivo | Conteúdo | Permissão |
|---|---|---|
| `/srv/ops/secrets/infisical.service-token` | Service Token (st.799590ae...) | 600 |
| `/srv/ops/secrets/infisical-vault.env` | Variáveis de ambiente do vault | 600 |
| `/srv/ops/secrets/infisical.runtime.env` | 7 chaves da instância | 600 |
| `/srv/ops/secrets/infisical.runtime.raw` | Todas env vars do container | 600 |
| `/srv/ops/secrets/infisical.compose.env` | Backup .env da stack | 600 |
| `/srv/ops/secrets/infisical-audit-*.log` | Auditoria completa | 600 |
| `/srv/ops/scripts/infisical-openclaw.sh` | Wrapper Python para Docker Compose | 700 |
| `/srv/ops/scripts/infisical-compose-run.sh` | Wrapper genérico | 700 |
| `/srv/ops/stacks/infisical/docker-compose.yml` | Stack Compose | — |
| `/srv/ops/secrets/infisical-one-shot-report-*.md` | Relatório da configuração | 600 |

---

## 🐳 Container Stack

```bash
# Status
docker ps --filter "name=infisical"

# Containers
infisical         infisical/infisical:latest-postgres  (porta 8200->8080)
infisical-db      postgres:16-alpine                   (porta 5432)
infisical-redis   redis:7-alpine                      (porta 6379)

# Health check
curl -s http://127.0.0.1:8200/api/status | python3 -m json.tool
# Resposta esperada: {"message": "Ok", "emailConfigured": true, ...}
```

---

## 🔧 SDK Python (infisicalsdk)

### Instalação / Atualização
```bash
pip install --break-system-packages "infisicalsdk>=0.1.3,<1.0.17"
# Versão testada: 0.1.3 (funciona com v0.146)
# ⚠️ 1.0.16+ usa endpoints /api/v2 que não existem nesta versão
```

### Uso Básico
```python
from infisical_sdk import InfisicalSDKClient

client = InfisicalSDKClient(
    host="http://127.0.0.1:8200",
    token="st.799590ae-d36f-4e64-b940-aea0fb85cad8.6e0c269870bb4b5e004e3ed6ab3a1fe1.c9872f2b30bc650e7b27c851df04b0ad"
)

# Listar secrets
secrets = client.secrets.list_secrets(
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/"
)
for s in secrets.secrets:
    print(f"{s.secret_key} = {s.secret_value}")

# Criar secret
client.secrets.create_secret_by_name(
    secret_name="NOVA_CHAVE",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/",
    secret_value="valor"
)

# Atualizar secret
client.secrets.update_secret_by_name(
    current_secret_name="NOVA_CHAVE",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/",
    secret_value="novo_valor"
)
```

---

## 🌐 Acesso ao Vault

### Local (via túnel cloudflared)
```bash
# Testar

# O vault usa Cloudflare Access — exige login via browser
```

### Via Tailscale (mesma rede VPN)
```bash
curl -s http://100.124.78.36:8200/api/status
```

---

## 🔄 Health Check Rápido

```bash
# 1. Container no ar?
docker ps --filter "name=infisical"

# 2. API respondendo?
curl -s http://127.0.0.1:8200/api/status | python3 -m json.tool

# 3. Vault via túnel?

# 4. Token ainda válido?
python3 -c "
from infisical_sdk import InfisicalSDKClient
c = InfisicalSDKClient(host='http://127.0.0.1:8200', token='st.799590ae-d36f-4e64-b940-aea0fb85cad8.6e0c269870bb4b5e004e3ed6ab3a1fe1.c9872f2b30bc650e7b27c851df04b0ad')
s = c.secrets.list_secrets(project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37', environment_slug='dev', secret_path='/')
print(f'Secrets no vault: {len(s.secrets)}')
"

# 5. Túnel cloudflared?
journalctl -u cloudflared --no-pager -n 5 | grep -E "healthy|ERR|WRN"
```

---

## 🚨 Troubleshooting

### "Folder with path '/' not found" em production
O root folder `/` não existe no environment `production`.
**Solução:** Usar `dev` (funciona) OU criar a pasta via dashboard:
2. Criar folder `/`

### "Token has invalid signature" (403)
O token foi emitido para uma identity antiga. Gerar novo:
1. Dashboard → Organization Settings → Access Control → Identities → will
2. Universal Auth → Create Client Secret
3. Pegar novo token via SDK

### Túnel cloudflared fora
```bash
sudo systemctl restart cloudflared
sleep 5
```

### Container parado
```bash
cd /srv/ops/stacks/infisical
docker compose up -d
docker ps --filter "name=infisical"
```

### Service Token expirado/revogado
Recriar identity:
2. Criar nova identity → Universal Auth → Create Client Secret
3. Gerar service token e atualizar `/srv/ops/secrets/infisical.service-token`

---

## 🔐 Segurança

### ✅ Já Aplicado
- Service Token salvo em `/srv/ops/secrets/` (chmod 600)
- Secrets da instância nunca commitados
- cloudflared tunnel com HTTPS

### ⚠️ Manter Vigilância
- NUNCA commitar arquivos de `/srv/ops/secrets/`
- NUNCA colocar Service Token em código fonte
- Se token vazar: revogar imediatamente no dashboard da identity
- Renovar tokens periodicamente (good practice)

---

## 📊 Secrets no Vault

**113 secrets** organizados por serviço (após dedupe e cleanup):
- Cloudflare (API token, zone ID, account ID)
- Telegram bots (6 tokens)
- LLM APIs (OpenRouter, Groq, Google, HuggingFace, MiniMax, Tavily)
- LiteLLM (master key, virtual key, postgres)
- Qdrant (API key)
- Supabase (postgres password, JWT, anon key, service role)
- N8N (db password, webhook URL)
- Redis, PostgreSQL, Ollama, TTS
- Aurelia runtime (A2A, PORTEIRO, JARVIS)
- E mais 70+ secrets de configuração

---

## 🔄 Snapshots ZFS (antes de mudanças)

```bash
# Snapshot antes de qualquer mudança na stack
sudo zfs snapshot -r "tank@pre-infisical-$(date +%Y%m%d-%H%M%S)"

# Listar
zfs list -t snapshot | grep infisical

# Rollback (se algo quebrar)
sudo zfs rollback -r tank@pre-infisical-DATA
```

---

## 📝 Comandos Úteis

```bash
# Ver stack
cat /srv/ops/stacks/infisical/docker-compose.yml

# Ver logs
docker logs infisical --tail 50

# Reiniciar stack
cd /srv/ops/stacks/infisical && docker compose restart

# Ver uso de recursos
docker stats infisical infisical-db infisical-redis --no-stream
```

---

## 📌 Notas

- **Versão:** v0.146.2 (subir para latest? testar antes com snapshot)
- **Storage:**Dados em `/srv/data/infisical-db` (ZFS)
- **Backup:** snapshots ZFS em `tank`
- **Token TTL:** Service Token não expira (criado sem TTL)
- **Python SDK:** 0.1.3 (v1.0+ incompatível com esta versão do servidor)

## 🔑 Credenciais de Produção (diferentes do back-up-k.md)

| Secret | Valor Real (container) | Observação |
|--------|------------------------|------------|
| REDIS_PASSWORD | coolify-redis-password-2026 | Coolify/Redis (não "Fifine156458*") |
| POSTGRES_PASSWORD | coolify-db-password-2026 | Coolify-DB (não "400621ead...") |
| APP_KEY | base64:jRrMu3906d/... | Coolify |
| ROOT_USER_PASSWORD | [COOLIFY_ROOT_PASSWORD] | Coolify root |
| AUTH_PASSWORD | EwoP7rwDQtprWUWq49Aqr2SzpLNgBsMR | OpenClaw auth |
| OPENCLAW_GATEWAY_TOKEN | ojjpAPOp8Yg3a88ApeLagIAAetXOPa1We26kg1eIW1ry6MnZPR | OpenClaw gateway |
| GF_SECURITY_ADMIN_PASSWORD | [GRAFANA_ADMIN_PASSWORD] | Grafana admin |

---

## Referências Cruzadas

| Documento | Seção | Conteúdo |
|-----------|-------|----------|
| `guide-cli-gitea-coolify.md` | 5.1 Secrets | Boas práticas GitOps + Secrets |
| `guide-manutencao-continua.md` | 12. Secrets | Health check, sincronização |
| `guide-security-hardening.md` | Monitoramento | Verificações de segurança |

**Secrets relacionadas ao Coolify (consulte esta tabela para debugging):**

| Secret | Infisical Path | Valor Real | Container/Service |
|--------|---------------|------------|------------------|
| `APP_KEY` | coolify/app_key | `base64:jRrMu3906d/...` | coolify |
| `DB_PASSWORD` | coolify/db_password | `coolify-db-password-2026` | coolify-db |
| `REDIS_PASSWORD` | coolify/redis_password | `coolify-redis-password-2026` | coolify-redis |
| `ROOT_USER_PASSWORD` | coolify/root_password | `[COOLIFY_ROOT_PASSWORD]` | Coolify admin |
| `JWT_AUTH_SECRET` | openclaw/jwt_auth | (Infisical) | OpenClaw |
| `OPENCLAW_GATEWAY_TOKEN` | openclaw/gateway_token | (Infisical) | OpenClaw |
| `GF_SECURITY_ADMIN_PASSWORD` | grafana/admin_password | (Infisical) | Grafana |

---

*Manual gerado em 2026-04-04 — Atualizado com audit de containers*
