# Context — painel.zappro.site

**Versao:** 1.0.0
**Ultima atualizacao:** 2026-04-23
**Fonte de verdade:** Codigo fonte em `/srv/monorepo/apps/painel-organism/`

---

## 1. Arquitetura do Painel

### Stack Tecnologico

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Framework | React | 18.3.1 |
| Bundler | Vite | 6.0.7 |
| CSS | TailwindCSS | 3.4.17 |
| Icons | Lucide React | 0.468.0 |
| Container | nginx (alpine) | latest |
| Runtime build | Bun | — |

### Estrutura de Diretórios

```
apps/painel-organism/
├── src/
│   ├── App.jsx          # Componente principal — todas as 7 camadas
│   ├── main.jsx         # Entry point React
│   └── index.css        # Estilos globais + neon theme
├── dist/                # Output do build Vite (copiado para container)
│   ├── index.html
│   ├── brain.svg
│   ├── brain-status.html
│   └── assets/          # JS + CSS bundleados
├── index.html           # HTML template
├── vite.config.js       # Config Vite (porta dev: 3001)
├── tailwind.config.js   # Tema neon customizado
├── postcss.config.js
└── package.json
```

### Build e Deploy

**Build local:**
```bash
cd /srv/monorepo/apps/painel-organism
bun install
bun run build        # Output em dist/
```

**Container nginx:**
- **Imagem:** `painel-organism:latest` (buildada local via Coolify)
- **Porta exposta:** `0.0.0.0:4005->80/tcp`
- **Health check:** nenhum definido (static files)
- **Mounts:** nenhum (dist/ baked into image)

**Deploy via Coolify:**
O painel é buildado pelo Coolify a partir do monorepo. O workflow:
1. Coolify detecta mudança no path `apps/painel-organism/`
2. Executa `bun run build` no contexto do monorepo
3. Copia `dist/` para o container nginx
4. Restart do container `painel-organism`

---

## 2. Estrutura de URLs

### Gitea — Formatos de URL

O painel usa Gitea em `https://git.zappro.site`. Ha 3 formatos distintos:

| Formato | URL exemplo | Uso | Auth |
|---------|------------|-----|------|
| `src/branch/HEAD` | `https://git.zappro.site/will-zappro/monorepo/src/HEAD/docs/HERMES-OPS.md` | Navegacao de codigo (syntax highlighting) | Cloudflare Access redirect |
| `raw/branch/HEAD` | `https://git.zappro.site/will-zappro/monorepo/raw/HEAD/docs/HERMES-OPS.md` | Raw file content (sem highlight) | Cloudflare Access redirect |
| `raw/HEAD` | `https://git.zappro.site/will-zappro/monorepo/raw/HEAD/docs/HERMES-OPS.md` | Raw do HEAD atual (mesmo que acima) | Cloudflare Access redirect |

**Diferenca pratica:**
- `src/` — interface web do Gitea com cores e syntax highlighting
- `raw/` — arquivo puro, ideal para download ou fetch programatico

**O painel usa `raw/HEAD`:**
```jsx
// App.jsx linha 397
href={`https://git.zappro.site/will-zappro/monorepo/raw/HEAD/${service.docs}`}
```

### Monorepo Button

```url
https://git.zappro.site/will-zappro/monorepo
```

Este link abre a raiz do repositorio monorepo no Gitea. Todos os links para o Gitea passam por Cloudflare Access — usuarios nao autenticados recebem **302 redirect** para a pagina de login da Cloudflare.

### Docs Links no Painel

Cada servico no painel tem um link para sua documentacao:

```url
https://git.zappro.site/will-zappro/monorepo/raw/HEAD/{caminho-docs}
```

Exemplos concretos (extraidos do codigo):
- `docs/HERMES-OPS.md` → `https://git.zappro.site/will-zappro/monorepo/raw/HEAD/docs/HERMES-OPS.md`
- `docs/QDRANT_COLLECTION_SCHEMA.md` → `https://git.zappro.site/will-zappro/monorepo/raw/HEAD/docs/QDRANT_COLLECTION_SCHEMA.md`
- `docs/LLM_PROVIDER_ARCHITECTURE.md` → `https://git.zappro.site/will-zappro/monorepo/raw/HEAD/docs/LLM_PROVIDER_ARCHITECTURE.md`
- `docs/POSTGRES_MCP_ARCHITECTURE.md` → `https://git.zappro.site/will-zappro/monorepo/raw/HEAD/docs/POSTGRES_MCP_ARCHITECTURE.md`
- `docs/SPECS/SPEC-115-painel-organism.md` → `https://git.zappro.site/will-zappro/monorepo/raw/HEAD/docs/SPECS/SPEC-115-painel-organism.md`

---

## 3. Camadas (7 Layers)

O painel organiza os servicos em **7 camadas**, cada uma com um icon, cor neon, e servicos associados.

### Layer 1 — MEMORY

| Key | Servico | Porta | Health URL | Docs |
|-----|---------|-------|------------|------|
| `mem0` | Mem0 | `:6333` | `http://localhost:6333/health` | `docs/HERMES-OPS.md` |
| `qdrant` | Qdrant | `:6333` | `http://localhost:6333/readyz` | `docs/QDRANT_COLLECTION_SCHEMA.md` |
| `second-brain` | Second Brain | `:6435` | `http://localhost:6435/api/v1/health` | `docs/SECOND-BRAIN.md` |
| `redis` | Redis | `:6379` | `http://localhost:6379` | `docs/REDIS_ARCHITECTURE.md` |

### Layer 2 — RAG / KNOWLEDGE

| Key | Servico | Porta | Health URL | Docs |
|-----|---------|-------|------------|------|
| `trieve` | Trieve | `:6435` | `http://localhost:6435/api/v1/health` | `docs/RAG_ARCHITECTURE.md` |
| `rag-pipeline` | RAG Pipeline | `:3001` | `http://localhost:3001/health` | `docs/RAG_ARCHITECTURE.md` |
| `embeddings` | Embeddings (Ollama) | `:11434` | `http://localhost:11434/api/tags` | `docs/LLM_PROVIDER_ARCHITECTURE.md` |

### Layer 3 — LLM / BRAIN

| Key | Servico | Porta | Health URL | URL | Docs |
|-----|---------|-------|------------|-----|------|
| `litellm` | LiteLLM Proxy | `:4000` | `http://localhost:4000/health` | `https://llm.zappro.site` | `docs/LLM_PROVIDER_ARCHITECTURE.md` |
| `ollama` | Ollama | `:11434` | `http://localhost:11434/api/tags` | — | — |
| `ai-gateway` | ai-gateway | `:4002` | `http://localhost:4002/health` | `https://llm.zappro.site` | `docs/API_GATEWAY_ARCHITECTURE.md` |
| `minimax` | MiniMax | API | — | — | — |

### Layer 4 — AGENTS

| Key | Servico | Porta | Health URL | URL | Docs |
|-----|---------|-------|------------|-----|------|
| `hermes-agency` | Hermes Agency | `:3001` | `http://localhost:3001/health` | `https://hermes-agency.zappro.site` | `docs/HERMES-OPS.md` |
| `claude-code` | Claude Code | CLI | — | — | — |
| `mclaude` | mclaude | CLI | — | — | — |
| `opencode` | OpenCode | `:4013` | — | — | — |

### Layer 5 — INTERFACE

| Key | Servico | Porta | URL | Docs |
|-----|---------|-------|-----|------|
| `telegram` | Telegram Bot | `:8642` | `https://t.me/hermes_cli` | `docs/TELEGRAM_BOT_ECOSYSTEM.md` |
| `openwebui` | OpenWebUI | `:8080` | `https://chat.zappro.site` | — |
| `grafana` | Grafana | `:3000` | `https://grafana.zappro.site` | `docs/OBSERVABILITY.md` |
| `coolify` | Coolify | `:8000` | `https://coolify.zappro.site` | — |

### Layer 6 — STORAGE

| Key | Servico | Porta | URL |
|-----|---------|-------|-----|
| `postgres` | PostgreSQL MCP | `:4017` | — |
| `gitea` | Gitea | `:3300` | `https://git.zappro.site` |
| `zfs` | ZFS Pool | ZFS | — |

### Layer 7 — INFRASTRUCTURE

| Key | Servico | Porta | URL | Docs |
|-----|---------|-------|-----|------|
| `docker` | Docker | Docker | — | `docs/DEPLOYMENT_ARCHITECTURE.md` |
| `cloudflare` | Cloudflare Tunnel | cloudflared | — | `docs/SECURITY_ARCHITECTURE.md` |
| `mcp-servers` | MCP Servers | `4011-4017` | — | `docs/SPECS/SPEC-115-painel-organism.md` |
| `monorepo` | Monorepo | `/srv/monorepo` | `https://git.zappro.site/will-zappro/monorepo` | — |

---

## 4. Status Dots — Health Checking

### Implementacao

O painel verifica a saude dos servicos automaticamente via `useServiceHealth`:

```jsx
function useServiceHealth(services) {
  const [health, setHealth] = useState({})

  useEffect(() => {
    const check = async () => {
      const results = {}
      for (const svc of services) {
        try {
          const res = await fetch(svc.healthUrl, { signal: AbortSignal.timeout(3000) })
          results[svc.key] = res.ok ? 'working' : 'partial'
        } catch {
          results[svc.key] = 'offline'
        }
      }
      setHealth(results)
    }
    check()
    const interval = setInterval(check, 30000) // a cada 30 segundos
    return () => clearInterval(interval)
  }, [])

  return health
}
```

### Status e Significado

| Status | Cor | Significado |
|--------|-----|-------------|
| `working` | Verde neon `#39ff14` | GET returned 2xx — servico respondendo |
| `partial` | Amarelo `#f59e0b` | GET returned non-2xx (ex: 401, 404) |
| `offline` | Vermelho `#ef4444` | Timeout ou rede inacessivel |

### Servicos Sem Health Check

Alguns servicos nao tem `healthUrl` definido:
- `ollama` — CLI tool, sem HTTP server
- `minimax` — API externa
- `claude-code`, `mclaude` — CLI tools
- `opencode` — sem health endpoint
- `docker`, `zfs` — host-level
- `cloudflare` — tunnel infrastructure
- `mcp-servers` — nenhum endpoint unificado

Estes servicam exibem label `CLI/Host` em vez do status dot.

### Health Endpoints por Servico

| Servico | Endpoint | Resposta Esperada |
|---------|----------|-------------------|
| Hermes Agency | `http://localhost:3001/health` | `{"status":"ok"}` |
| ai-gateway | `http://localhost:4002/health` | `{"status":"ok"}` |
| LiteLLM | `http://localhost:4000/health` | 401 (auth required — esperado) |
| Qdrant | `http://localhost:6333/readyz` | `{"status":"ok"}` |
| Redis | `http://localhost:6379` | `PONG` (Redis protocol) |
| Ollama | `http://localhost:11434/api/tags` | JSON list of models |
| Trieve | `http://localhost:6435/api/v1/health` | `{"status":"ok"}` |
| PostgreSQL MCP | `http://localhost:4017/health` | `{"status":"ok"}` |

---

## 5. Tabela de Links Validos

| Descricao | URL | Cloudflare Access |
|-----------|-----|------------------|
| Monorepo (button principal) | `https://git.zappro.site/will-zappro/monorepo` | Sim (302 redirect) |
| Docs raw (HEAD) | `https://git.zappro.site/will-zappro/monorepo/raw/HEAD/{path}` | Sim |
| Docs src (HEAD) | `https://git.zappro.site/will-zappro/monorepo/src/HEAD/{path}` | Sim |
| Hermes Agency | `https://hermes-agency.zappro.site` | Sim |
| LiteLLM / ai-gateway | `https://llm.zappro.site` | Sim |
| OpenWebUI (chat) | `https://chat.zappro.site` | Sim |
| Grafana | `https://grafana.zappro.site` | Sim |
| Coolify | `https://coolify.zappro.site` | Sim |
| Gitea (git) | `https://git.zappro.site` | Sim |
| Telegram Bot | `https://t.me/hermes_cli` | Nao (Telegram) |

---

## 6. Cloudflare Access

Todos os links para `git.zappro.site` e subdomios `*.zappro.site` passam pelo tunnel Cloudflare. Usuarios nao autenticados recebem **302 redirect** para o portal de login da Cloudflare Access.

**Tunnel ID:** `aee7a93d-c2e2-4c77-a395-71edc1821402`
**Credenciais:** `/home/will/.cloudflared/aee7a93d-c2e2-4c77-a395-71edc1821402.json`

O acesso e gerenciado pela Cloudflare Access — qualquer email autorizado pode fazer login via SSO.

---

## 7. Container e Deploy

### Container Atual

```bash
docker ps --format "{{.Names}} {{.Ports}}"
# Output: painel-organism 0.0.0.0:4005->80/tcp
```

### Build do Dist

```bash
cd /srv/monorepo/apps/painel-organism
bun install
bun run build    # Vite compila React + Tailwind → dist/
```

O `dist/` contem:
- `index.html` — entry point
- `assets/` — JS bundle + CSS bundle (hash no nome para cache busting)
- `brain.svg` — favicon
- `brain-status.html` — pagina de status

### Processo de Deploy

1. **Trigger:** Push para branch `main` do monorepo (via Gitea Actions) ou deploy manual via Coolify
2. **Build:** Coolify executa `bun run build` no contexto do monorepo
3. **Artefato:** `dist/` e copiado para o container nginx
4. **Serving:** nginx serve arquivos estaticos na porta 80 dentro do container
5. **Exposicao:** Coolify mapeia `0.0.0.0:4005->80/tcp` no host

### Nginx Configuration (implícita)

O container usa nginx padrao do Coolify para serve static files — `index.html` como default, `try_files` para SPA routing.

---

## 8. Notas de Operacao

- **Porta dev:** 3001 (configurada em `vite.config.js`, apenas local)
- **Porta prod:** 4005 (mapeada via Coolify)
- **Refresh health:** 30 segundos (interval fixo no codigo)
- **Timeout health:** 3 segundos por servico (`AbortSignal.timeout(3000)`)
- **Tailwind theme:** Cores neon customizadas (`neon-cyan: #00f5d4`, `neon-green: #39ff14`, etc.)
- **Fonts:** JetBrains Mono (mono) + Inter (sans) via Google Fonts CDN
