# obsidian-web — Obsidian Vault UI

**Subdomain:** `md.zappro.site` (port 4081)
**Type:** Static HTML/JS with Google OAuth + PARA method

## Propósito

Interface web para visualização do vault Obsidian com sincronização Git e OAuth.

## Tech Stack

- **Frontend:** Vanilla JS (static HTML/CSS)
- **Auth:** Google OAuth 2.0 (PKCE flow)
- **Vault:** Obsidian-style PARA folder structure
- **Deployment:** Docker + Nginx (Coolify)
- **Port:** 4081 (mapped to :80 inside container)

## Estrutura

```
apps/obsidian-web/
├── index.html
├── app.js          # OAuth + vault renderer
├── styles.css
├── vault/          # Obsidian vault (git-synced)
│   ├── Areas/
│   ├── Resources/
│   ├── Projects/
│   └── Archives/
├── Dockerfile
├── docker-compose.yml
└── DEPLOYMENT.md
```

## Variáveis de Ambiente

| Variável | Descrição |
|----------|-----------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Secret |

## OAuth Redirect

```javascript
redirect_uri: 'https://md.zappro.site/auth/callback'
```

## Anti-Patterns (NUNCA fazer)

- ❌ Hardcoded secrets em código
- ❌ Acesso sem OAuth

## Deployment

```bash
# Deploy via Coolify
# Root: apps/obsidian-web
# Port: 4081
```

## Status

✅ **OPERATIONAL** — 200 OK
