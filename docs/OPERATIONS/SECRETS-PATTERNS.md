# API Secrets — Regra Global

## Regra de Ouro

**NUNCA exponha valores de variáveis de ambiente que contenham segredos.**

**O único comando seguro para verificar se uma variável existe:**
```bash
test -n "${VARIAVEL:-}" && echo "definida"
```

Este padrão verifica presença SEM expor o valor.

---

## Variáveis com Valor Secreto

### Format: `sk-` (API Keys)
- `ANTHROPIC_API_KEY` — Anthropic API key (formato: `sk-cp-...`)
- `MINIMAX_API_KEY` — MiniMax API key (formato: `sk-cp-...`)
- `OPENAI_API_KEY` — OpenAI API key (formato: `sk-...`)
- `LITELLM_KEY` — LiteLLM master key (formato: `sk-zappro-...`)
- `GROQ_API_KEY` — Groq API key
- `OPENROUTER_API_KEY` — OpenRouter API key

### Format: Hash/Token (32+ hex chars)
- `QDRANT_API_KEY` — Qdrant service API key (32 hex chars)
- `MEM0_API_KEY` — Mem0 API key

### Format: `877xxxxxxxxx:xxxxxxxxx` (Telegram Bot Tokens)
- `TELEGRAM_BOT_TOKEN` — Telegram bot token
- `HERMES_GATEWAY_BOT_TOKEN` — Hermes gateway bot
- `HOMELAB_LOGS_BOT_TOKEN` — Homelab logs bot
- `EDITOR_SOCIAL_BOT_TOKEN` — Editor social bot

### Format: `cfk_` / `cfut_`
- `CF_GLOBAL_KEY` — Cloudflare Global API Key
- `CLOUDFLARE_API_TOKEN` — Cloudflare API Token

### Format: `ghp_` / `gho_` / `github_pat_`
- `GH_TOKEN` — GitHub personal access token
- `GITHUB_TOKEN` — GitHub token

### Format: `TFC-` / `tfat_`
- `TF_VAR_cloudflare_api_token` — Terraform Cloudflare token

### Others
- `COOLIFY_API_KEY` — Coolify API key
- `GITEA_TOKEN` — Gitea token
- `SESSION_SECRET` — Session signing secret
- `INTERNAL_API_SECRET` — Internal API secret

## Como Verificar sem Expor

```bash
# ✅ CERTO — verifica sem expor
test -n "${QDRANT_API_KEY:-}" && echo "definida"

# ❌ ERRADO — expõe o valor
echo $QDRANT_API_KEY
echo "Key: $QDRANT_API_KEY"
printenv | grep API_KEY
```

## Em Scripts — Padrão Seguro

```bash
# ✅ Só indica presença, não o valor
log "QDRANT_API_KEY: ${QDRANT_API_KEY:+[definida]}"

# ✅ Testar Qdrant — output só código HTTP
curl -s -o /dev/null -w "%{http_code}" \
  -H "api-key: ${QDRANT_API_KEY}" \
  "http://localhost:6333/collections"

# ❌ Nunca
cat /srv/monorepo/.env | grep QDRANT
grep "QDRANT_API_KEY" /srv/monorepo/.env
echo $QDRANT_API_KEY
```

## O que NUNCA Fazer

```bash
# ❌ Nunca
cat /srv/monorepo/.env
grep "API_KEY" /srv/monorepo/.env
echo $ANTHROPIC_API_KEY
docker logs <container> | grep API_KEY
git diff | grep sk-cp-
git log --all -p | grep QDRANT_API_KEY
```

## Padrão de Referência em Código

```python
# ✅ CERTO
api_key = os.environ.get("QDRANT_API_KEY", "")

# ❌ ERRADO
api_key = "71cae77676e2a5fd552d172caa1c3200"
```

## Ficheiros com Segredos (NUNCA commitar)

| Ficheiro | Proibido | Exceção |
|----------|----------|----------|
| `/srv/monorepo/.env` | Tudo | Nunca commit |
| `.env` em qualquer repo | Tudo | Nunca commit |
| `docker-compose.yml` inline | Secrets | Usar `${VAR}` |
| `*.md` docs | Secrets | Usar `${VAR}` |

## Exceção

Quando o utilizador pede para "rodar" ou "testar" — pode usar a variável em comandos, mas **nunca em output, logs ou mensagens**. O comando `test -n` é sempre seguro.

## Pre-commit Check

```bash
git diff --cached | grep -iE "sk-cp-|sk-zappro-|71cae776|87[0-9]{10,}:|cfk_|cfut_" && \
  echo "BLOQUEADO: secret detectado" && exit 1
```
