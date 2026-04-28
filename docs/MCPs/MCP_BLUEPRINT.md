# MCP Blueprint — will-zappro

**Data:** 2026-03-16
**Snapshot de instalação:** `tank@pre-20260316-mcp-setup`
**Responsável:** Claude Code (sessão 2026-03-16)

---

## Status Geral

| MCP | Status | Tipo | Token | Integração |
|-----|--------|------|-------|------------|
| `ai-context` | ✅ Conectado | stdio/npx | Não precisa | Monorepo .context/ |
| `playwright` | ✅ Conectado | stdio/npx | Não precisa | Automação web, testes E2E |
| `filesystem` | ✅ Conectado | stdio/npx | Não precisa | /srv/monorepo + /home/will |
| `context7` | ✅ Conectado | stdio/npx | Não precisa | Docs 9000+ libs em tempo real |
| `postgres` | ✅ Conectado | stdio/npx | Credencial local | Supabase PostgreSQL localhost:5433 |
| `qdrant` | ✅ Conectado | stdio/python | Credencial local | Qdrant localhost:6333 |
| `cloudflare-api` | ⚠️ Auth needed | HTTP | Bearer token | API Cloudflare completa |
| `cloudflare-observability` | ⚠️ Auth needed | HTTP | Bearer token | Logs e analytics |
| `cloudflare-radar` | ⚠️ Auth needed | HTTP | Bearer token | Insights globais |
| `n8n` | 📋 Pendente | stdio/npx | API key local | Trigger workflows n8n |
| `github` | 📋 Documentado | stdio/npx | PAT externo | Repositórios GitHub |

---

## Arquitetura de Integração

```
Claude Code
    │
    ├── ai-context ──── /srv/monorepo/.context/
    │       └── 15 agents, 9 docs, 10 skills
    │
    ├── filesystem ──── /srv/monorepo/ + /home/will/
    │       └── Leitura/escrita controlada
    │
    ├── context7 ────── Documentação em tempo real
    │       └── React 19, Next.js 15, Fastify 5, TypeScript 5+
    │
    ├── postgres ─────── Supabase PostgreSQL (localhost:5433)
    │       └── DB: postgres | User: postgres
    │
    ├── qdrant ──────── Qdrant Vector Store (localhost:6333)
    │       └── API Key autenticada | Collections: main
    │
    ├── playwright ───── Browser automation
    │       └── Testes E2E, scraping, automação web
    │
    ├── cloudflare-api ── Cloudflare API (HTTP/OAuth)
    │       └── DNS, Tunnels, Workers, R2, Zero Trust
    │
    └── [pendente] n8n ─ Workflows n8n (localhost:5678)
            └── Requer API key do painel n8n
```

---

## Instalação por MCP

### Tier 1 — Sem Token

**ai-context**
```bash
claude mcp add --scope user ai-context -- npx -y @ai-coders/context mcp
```

**playwright**
```bash
claude mcp add --scope user playwright -- npx -y @playwright/mcp@latest
```

**filesystem**
```bash
claude mcp add --scope user filesystem -- npx -y @modelcontextprotocol/server-filesystem /srv/monorepo /home/will
```

**context7**
```bash
claude mcp add --scope user context7 -- npx -y @upstash/context7-mcp@latest
```

### Tier 2 — Serviços Locais

**qdrant** (Python venv em ~/.local/venv-qdrant-mcp)
```bash
# Instalar:
python3 -m venv ~/.local/venv-qdrant-mcp
~/.local/venv-qdrant-mcp/bin/pip install mcp-server-qdrant

# Registrar:
claude mcp add --scope user qdrant \
  --env QDRANT_URL=http://localhost:6333 \
  --env QDRANT_API_KEY=${QDRANT_API_KEY} \
  --env COLLECTION_NAME=main \
  -- /home/will/.local/venv-qdrant-mcp/bin/mcp-server-qdrant
```

**postgres** (Supabase, porta 5433)
```bash
claude mcp add --scope user postgres \
  -- npx -y @modelcontextprotocol/server-postgres \
  "postgresql://postgres:PASSWORD@localhost:5433/postgres"
```
> Senha real em: ~/Desktop/rascunho-s.txt (POSTGRES_PASSWORD)

**n8n** (pendente — requer API key)
```bash
# 1. Acesse https://n8n.zappro.site → Settings → API → Generate API Key
# 2. Depois:
claude mcp add --scope user n8n \
  --env N8N_API_KEY="sua-api-key" \
  --env N8N_BASE_URL="http://localhost:5678" \
  -- npx -y @n8n/mcp-server
```

### Tier 3 — Tokens Externos

**github**
```bash
export GITHUB_TOKEN="ghp_seu_token"
claude mcp add --scope user github \
  --env GITHUB_TOKEN="${GITHUB_TOKEN}" \
  -- npx -y @modelcontextprotocol/server-github
```
> Ver MCP_TOKENS_GUIDE.md para obter o token

---

## Qual MCP Usar Para Cada Tarefa

| Tarefa | MCP Recomendado |
|--------|----------------|
| Buscar documentação de library | context7 |
| Navegar/editar código do monorepo | filesystem + ai-context |
| Query SQL no Supabase | postgres |
| Busca semântica vetorial | qdrant |
| Automação / testes de UI | playwright |
| Configurar DNS / Tunnel | cloudflare-api |
| Debug de requests Cloudflare | cloudflare-observability |
| Criar/disparar workflow automação | n8n (pendente) |
| Gerenciar issues/PRs GitHub | github (pendente) |
| Ver agentes/skills do monorepo | ai-context |

---

## Serviços Locais Disponíveis

| Serviço | URL Local | URL Pública | Status |
|---------|-----------|-------------|--------|
| n8n | localhost:5678 | https://n8n.zappro.site | ✅ Ativo |
| Qdrant | localhost:6333 | https://qdrant.zappro.site | ✅ Ativo |
| Supabase Kong | localhost:8000 | https://supabase.zappro.site | ✅ Ativo |
| Supabase Studio | localhost:54323 | https://studio.zappro.site | ✅ Ativo |
| Supabase PostgreSQL | localhost:5433 | — | ✅ Via pooler |
| CapRover | localhost:3000 | https://cap.zappro.site | ✅ Ativo |

---

## Rollback

```bash
# Remover MCP específico:
claude mcp remove <nome>

# Rollback total (ZFS):
sudo zfs rollback -r tank@pre-20260316-mcp-setup
```

---

**Atualizado em:** 2026-03-16
**Governança:** CONTRACT.md + GUARDRAILS.md + CHANGE_POLICY.md
