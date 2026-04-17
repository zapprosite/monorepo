# list-web — Tool List App

**Subdomain:** `list.zappro.site` (port 4080)
**Type:** Static HTML/JS with Google OAuth

## Propósito

Interface web que lista todas as ferramentas internas do homelab com status de uptime. Autenticação via Google OAuth.

## Tech Stack

- **Frontend:** Vanilla JS (static HTML/CSS)
- **Auth:** Google OAuth 2.0 (PKCE flow)
- **Deployment:** Docker + Nginx (Coolify)
- **Port:** 4080 (mapped to :80 inside container)

## Estrutura

```
apps/list-web/
├── index.html          # Main HTML
├── app.js              # OAuth flow + tool grid
├── tools.js            # Tool definitions with INTERNAL_URLS
├── styles.css          # Dark theme (#1a1a2e primary)
├── Dockerfile          # Nginx-based
├── docker-compose.yml   # Coolify-ready
└── DEPLOYMENT.md      # Deployment notes
```

## Variáveis de Ambiente

| Variável | Descrição | Default |
|----------|-----------|---------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | (obrigatório) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret | (obrigatório) |
| `GOOGLE_REDIRECT_URI` | OAuth callback | `https://list.zappro.site/auth/callback` |

## Anti-Patterns (NUNCA fazer)

- ❌ Hardcoded Docker IPs (10.0.x.x) em URLs — use subdomínios públicos
- ❌ `localhost` URLs em produção — o app corre no browser, não no servidor
- ❌ `http://` para serviços externos — usar sempre `https://`

## URL Fallbacks

Os fallbacks em `tools.js` devem usar subdomínios públicos:

```javascript
// ✅ CORRETO
litellm: 'https://api.zappro.site'
hermesGateway: 'https://hermes.zappro.site'
prometheus: 'https://monitor.zappro.site'

// ❌ ERRADO (Docker IPs internos)
litellm: 'http://10.0.19.7:4000'
hermesGateway: 'http://10.0.2.4:8642'
```

## Serviços Listados

| Ferramenta | URL | Estado |
|------------|-----|--------|
| Hermes Gateway | hermes.zappro.site | ATIVO |
| LiteLLM Proxy | api.zappro.site | ATIVO |
| Grafana | monitor.zappro.site | ATIVO |
| Coolify | coolify.zappro.site | ATIVO |
| Gitea | git.zappro.site | ATIVO |
| Qdrant | qdrant.zappro.site | ATIVO |

**Removidos:** n8n (pruned), OpenWebUI (chat.zappro.site down)

## Secrets

- `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` via Coolify env vars
- Sem access tokens longos — sessionStorage apenas

## Deployment

```bash
# Build local
docker build -t list-web .

# Deploy via Coolify
# Repo: https://github.com/zapprosite/monorepo
# Root: apps/list-web
# Port: 4080
```

## Troubleshooting

```bash
# Ver logs
docker logs list-web

# Testar localmente
curl -sfI https://list.zappro.site/
```
