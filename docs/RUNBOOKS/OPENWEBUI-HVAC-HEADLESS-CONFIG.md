# OpenWebUI — HVAC Headless Config Runbook

## Contexto

Open WebUI com o modelo `hvac-manual-strict` exposto pelo HVAC RAG Pipe em `http://localhost:4017/v1`.

**Problema:** Ao abrir http://localhost:3456, o seletor mostra "Nenhum modelo disponível".

**Solução:** Configuração headless sem usar o dashboard "Gerenciar Conexões".

---

## Arquitetura

```
Browser → OpenWebUI (:3456) → HVAC RAG Pipe (:4017) → Qdrant (privado)
```

- **Open WebUI:** `docker-compose.openwebui.yml`, `network_mode: host`
- **HVAC Pipe:** `http://localhost:4017/v1` (mesmo host, rede host)
- **Qdrant:** `localhost:6333` (NÃO exposto, accessed only by pipe internally)

---

## URLs e Endpoints

| Serviço | URL | Notes |
|---------|-----|-------|
| Open WebUI | http://localhost:3456 | Google OAuth / admin |
| HVAC RAG Pipe | http://localhost:4017 | `/v1/models`, `/v1/chat/completions` |
| Pipe Health | http://localhost:4017/health | `{"status":"ok","service":"hvac-rag-pipe"}` |
| Pipe Models | http://localhost:4017/v1/models | Retorna `hvac-manual-strict` |

---

## Environment Variables (em `/srv/monorepo/.env`)

```bash
# ==========================================
# OpenWebUI — HVAC RAG Pipe (hvac-manual-strict)
# ==========================================
OPENAI_API_BASE_URL=http://localhost:4017/v1
OPENAI_API_KEY=sk-hvac-local
DEFAULT_MODELS=hvac-manual-strict
DEFAULT_PINNED_MODELS=hvac-manual-strict
TASK_MODEL_EXTERNAL=hvac-manual-strict
ENABLE_OLLAMA_API=false
ENABLE_LOGIN_FORM=true
WEBUI_ADMIN_EMAIL=admin@zappro.local
WEBUI_ADMIN_PASSWORD=${OPENWEBUI_ADMIN_PASSWORD}   # set externally
WEBUI_ADMIN_NAME=Admin
```

**Notas:**
- `OPENAI_API_BASE_URL` — URL base do HVAC Pipe (mesmo host, então `localhost`)
- `OPENAI_API_KEY` — placeholder, o pipe não valida key para `/v1/models`
- `WEBUI_ADMIN_PASSWORD` — definido via variável de ambiente `OPENWEBUI_ADMIN_PASSWORD`, não em .env

---

## Validações

```bash
# 1. Health do pipe
curl -sf http://localhost:4017/health

# 2. Model list do pipe
curl -sf http://localhost:4017/v1/models | jq '.'

# 3. Frontend OpenWebUI
curl -sf http://localhost:3456 | head -c 200

# 4. Container healthy
docker ps | grep openwebui

# 5. Model na API (requer auth)
#    Faça login em http://localhost:3456 primeiro
TOKEN=$(curl -s -X POST http://localhost:3456/api/v1/auths/signin \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@zappro.local","password":"'${OPENWEBUI_ADMIN_PASSWORD}'"}' \
  | jq -r '.token')
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3456/api/v1/models \
  | jq '.data[] | select(.id == "hvac-manual-strict")'
```

---

## Troubleshooting — "Nenhum modelo disponível"

### Causa 1: Pipe não responde
```bash
curl -sf http://localhost:4017/v1/models
# Se FAIL → verificar se HVAC RAG Pipe está rodando
docker ps | grep hvac
```

### Causa 2: OpenWebUI não carregou env vars
```bash
# Verificar se vars estão no container
docker exec openwebui env | grep -E "OPENAI_API|DEFAULT_MODEL"

# Se vazio → restart do container
cd /srv/monorepo
docker compose -f docker-compose.openwebui.yml down
docker compose -f docker-compose.openwebui.yml up -d
```

### Causa 3: Modelo não inserido no DB
```bash
# Verificar modelos no DB
docker exec openwebui python3 -c "
import sqlite3
conn = sqlite3.connect('/app/backend/data/webui.db')
cur = conn.cursor()
cur.execute('SELECT id, name FROM model')
for row in cur.fetchall(): print(row)
"

# Se vazio → rodar script de config
bash scripts/openwebui/configure-hvac-provider.sh
```

### Causa 4: Access grant missing (model invisível para users)
```bash
# Verificar access grants
docker exec openwebui python3 -c "
import sqlite3
conn = sqlite3.connect('/app/backend/data/webui.db')
cur = conn.cursor()
cur.execute('SELECT * FROM access_grant WHERE resource_id=\"hvac-manual-strict\"')
for row in cur.fetchall(): print(row)
"

# Deve mostrar wildcard '*' para principal_id
```

### Causa 5: Container sem network host
```bash
# Verificar network mode
docker inspect openwebui | jq '.[0].HostConfig.NetworkMode'

# Se não for "host" → alterar compose
```

---

## Rollback

### Opção 1: Restaurar .env
```bash
cp /srv/monorepo/.env.backup-YYYYMMDDHHMMSS /srv/monorepo/.env
cd /srv/monorepo
docker compose -f docker-compose.openwebui.yml down
docker compose -f docker-compose.openwebui.yml up -d
```

### Opção 2: Remover vars do .env manualmente
```bash
# Remover linhas adicionadas
grep -v "OPENAI_API_BASE_URL.*4017" /srv/monorepo/.env
grep -v "OPENAI_API_KEY=sk-hvac" /srv/monorepo/.env
grep -v "DEFAULT_MODELS=hvac" /srv/monorepo/.env
# ... etc
```

### Opção 3: Restart simples (preserva DB)
```bash
cd /srv/monorepo
docker compose -f docker-compose.openwebui.yml restart openwebui
```

---

## Script Idempotente

```bash
# Configuração completa (idempotente — pode rodar múltiplas vezes)
bash scripts/openwebui/configure-hvac-provider.sh

# Dry-run (não aplica mudanças)
bash scripts/openwebui/configure-hvac-provider.sh --dry-run
```

O script:
1. Valida pipe health e model list
2. Adiciona envs faltantes ao .env (não sobrescreve existentes)
3. Restart controlado do OpenWebUI
4. Cria admin user via WEBUI_ADMIN_*
5. Insere modelo no DB se não existir
6. Adiciona wildcard access grant (`user:*`) para todos os usuários
7. Verifica configuração final

---

## Notas Importantes

- **Qdrant permanece privado** — nunca exposto diretamente ao OpenWebUI
- **PDFs não são reingeridos** — o pipe usa o RAG já configurado
- **Sem Terraform/Cloudflare** — configuração puramente local/env
- **Sem reindex Qdrant** — a coleção existente é usada
- **Dados persistem em** `/app/backend/data/webui.db` (dentro do container — sem volume explícito)
- **Atenção:** `docker compose down` SEM volume mount explícito NO docker-compose.openwebui.yml apaga o DB! Adicionar volume se necessário:

```yaml
# Em docker-compose.openwebui.yml, adicionar em volumes do openwebui:
volumes:
  - openwebui-data:/app/backend/data

# E no final do compose:
volumes:
  openwebui-data:
```

---

## Acesso Admin

Se `WEBUI_ADMIN_PASSWORD` estiver definido:
- Email: `admin@zappro.local`
- Senha: valor de `OPENWEBUI_ADMIN_PASSWORD`

Se não estiver definido:
- Login via Google OAuth (única opção se `WEBUI_AUTH=true` e OAuth configurado)

---

## Fluxo de Auth

1. Usuário visita http://localhost:3456
2. Se não logado → redirect para Google OAuth login
3. Após login, sessão criada na tabela `user` do DB
4. Frontend polling `/api/v1/models` → retorna lista com `hvac-manual-strict`
5. Modelo aparece no selector
6. Seleção → chat usa `OPENAI_API_BASE_URL` (`http://localhost:4017/v1`)
