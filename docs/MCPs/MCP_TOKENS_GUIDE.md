# MCP Tokens Guide — will-zappro

**Data:** 2026-03-16
**Propósito:** Instruções para obter e configurar tokens de MCPs que requerem credenciais externas

---

## MCPs Que Ainda Precisam de Token

### 1. n8n API Key 🔴 PRÓXIMA AÇÃO

**Por quê:** O MCP `@n8n/mcp-server` precisa de API key para comunicar com o n8n local.

**Como obter:**
1. Acesse https://n8n.zappro.site (primeiro acesso: criar conta com email/senha livre)
2. Vá em: Settings → n8n API → Create an API key
3. Copie o token gerado

**Como instalar:**
```bash
# Exportar variável (adicionar ao ~/.bashrc para persistir)
export N8N_API_KEY="n8n_api_xxxxxxxxxxxxxxxx"

# Registrar MCP:
claude mcp add --scope user n8n \
  --env N8N_API_KEY="${N8N_API_KEY}" \
  --env N8N_BASE_URL="http://localhost:5678" \
  -- npx -y @n8n/mcp-server
```

**Verificar:**
```bash
claude mcp list | grep n8n
```

---

### 2. GitHub Personal Access Token 🔴 ALTA PRIORIDADE

**Por quê:** O MCP `@modelcontextprotocol/server-github` precisa de PAT para criar/editar issues, PRs, reviews.

**Como obter:**
```bash
# Opção 1 (recomendada): GitHub CLI
gh auth login
# → Selecionar: GitHub.com → HTTPS → Login with a web browser

# Opção 2: PAT clássico manual
# 1. Acessar: https://github.com/settings/tokens/new
# 2. Nome: "will-zappro-mcp"
# 3. Escopos necessários:
#    - repo (acesso completo a repositórios)
#    - read:org
#    - read:user
# 4. Copiar token gerado (começa com ghp_)
```

**Como instalar:**
```bash
# Exportar (adicionar ao ~/.bashrc para persistir):
export GITHUB_TOKEN="ghp_xxxxxxxxxxxxxxxxxx"

# Registrar MCP:
claude mcp add --scope user github \
  --env GITHUB_TOKEN="${GITHUB_TOKEN}" \
  -- npx -y @modelcontextprotocol/server-github
```

**Verificar:**
```bash
claude mcp list | grep github
```

---

## Tokens Já Configurados

### Cloudflare Bearer Token ✅
- **Token:** Salvo em ~/.claude.json (MCPs HTTP cloudflare-api, cloudflare-observability, cloudflare-radar)
- **Status:** Funcional porém precisa autenticação OAuth na primeira sessão
- **Localização:** rascunho-s.txt → API Token Cloudflare

### Qdrant API Key ✅
- **Key:** `${QDRANT_API_KEY}`
- **Status:** Configurado no MCP qdrant (env QDRANT_API_KEY)
- **Fonte:** Docker container env (QDRANT__SERVICE__API_KEY)

### Supabase PostgreSQL ✅
- **Connection:** `postgresql://postgres:PASS@localhost:5433/postgres`
- **Status:** MCP postgres conectado
- **Fonte:** rascunho-s.txt → POSTGRES_PASSWORD

### Context7 ✅
- **Token:** ctx7sk-191572ec-fa7d-4d0e-83c9-957f5c1d3bf4 (fornecido pelo usuário)
- **Status:** Context7 não requer token por padrão — instalado sem token
- **Nota:** Token disponível se necessário no futuro

---

## Política de Segurança

### ✅ FAZER

```bash
# Usar variáveis de ambiente (nunca hardcode):
export N8N_API_KEY="token_aqui"
claude mcp add --env N8N_API_KEY="${N8N_API_KEY}" ...

# Adicionar ao ~/.bashrc para persistência:
echo 'export N8N_API_KEY="token_aqui"' >> ~/.bashrc
source ~/.bashrc
```

### ❌ NUNCA FAZER

```bash
# ERRADO: Token hardcoded no comando (fica no history):
claude mcp add --env N8N_API_KEY="token_hardcoded" ...

# ERRADO: Commitar tokens em git:
git add .env && git commit -m "add tokens"

# ERRADO: Colocar tokens em arquivos públicos
echo "TOKEN=xxx" >> /srv/monorepo/README.md
```

---

## Como Verificar se MCP Está Funcionando

```bash
# Listar todos e ver status:
claude mcp list

# Status esperados:
# ✓ Connected  → MCP funcionando
# ✗ Failed     → Verificar credenciais ou servidor local
# ! Needs auth → Token OAuth necessário (MCPs HTTP)
```

---

## Adicionar Tokens ao .bashrc (Persistência)

```bash
# Editar ~/.bashrc:
nano ~/.bashrc

# Adicionar ao final:
# === MCP TOKENS ===
export N8N_API_KEY=""          # Obter em n8n.zappro.site/settings/api
export GITHUB_TOKEN=""         # Obter via gh auth login

# Aplicar:
source ~/.bashrc
```

---

**Atualizado em:** 2026-03-16
**Governança:** Nunca commitar tokens. Referência: SECRETS_POLICY.md
