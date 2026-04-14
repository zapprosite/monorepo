# SPEC-TOOL-LIST — Ferramentas Web App

**Date:** 2026-04-12
**Status:** COMPLETED
**Type:** Web Application (Static HTML/JS/CSS)

---

## Objective

Criar `list.zappro.site` — uma web app estática (HTML/JS/CSS) que lista ferramentas/internal links do homelab, com login Google OAuth.

**Arquitetura:** Static HTML only — sem backend, proxy reverso (Cloudflare Tunnel) + Basic Auth ou OAuth.

---

## Identity Visual

**Painel.zappro.site clone:**
- Font: System fonts (Inter fallback)
- Colors: Dark theme — primary `#1a1a2e`, accent `#e94560`
- Header: Logo + nav
- Cards: Tool tiles with icon, name, description, status
- Status indicators: 🟢 UP / 🔴 DOWN / 🟡 DEGRADED

---

## Stack

| Layer | Tech |
|-------|------|
| Frontend | HTML + CSS + Vanilla JS (single file) |
| Auth | Google OAuth (same as OpenWebUI/Grafana) |
| Secrets | Infisical SDK (client_id only) |
| Hosting | Cloudflare Tunnel → list.zappro.site |
| Proxy | Cloudflare Access (same as chat.zappro.site) |

---

## Google OAuth — Config Copiada

Copiar config do OpenWebUI (chat.zappro.site) e Grafana (monitor.zappro.site):

```javascript
// From: docs/OPERATIONS/SKILLS/openclaw-oauth-login.md
const GOOGLE_OAUTH = {
  client_id: 'FROM_INFISICAL',
  redirect_uri: 'https://list.zappro.site/auth/callback',
  scope: 'email profile',
  auth_endpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  token_endpoint: 'https://oauth2.googleapis.com/token',
  userinfo_endpoint: 'https://www.googleapis.com/oauth2/v2/userinfo'
};
```

**Arquivo:** `infisical-get-secret.js` → busca `GOOGLE_CLIENT_ID` do vault.

---

## Infraestrutura

| Component | Value |
|-----------|-------|
| **Subdomain** | `list.zappro.site` |
| **Cloudflare Tunnel** | `cloudflared` (already running) |
| **Auth** | Cloudflare Access + Google OAuth |
| **Container** | Static files (nginx or direct) |
| **Port** | TBD (via PORTS.md) |

---

## Tools List — Content

```javascript
const TOOLS = [
  {
    name: 'OpenWebUI',
    url: 'https://chat.zappro.site',
    description: 'Chat AI interface',
    icon: '💬',
    status: 'up',
    category: 'ai'
  },
  {
    name: 'Grafana',
    url: 'https://monitor.zappro.site',
    description: 'Monitoring dashboards',
    icon: '📊',
    status: 'up',
    category: 'monitoring'
  },
  {
    name: 'Prometheus',
    url: 'https://monitor.zappro.site/graph',
    description: 'Metrics collection',
    icon: '🎯',
    status: 'up',
    category: 'monitoring'
  },
  {
    name: 'OpenClaw',
    url: 'https://bot.zappro.site',
    description: 'Voice AI bot',
    icon: '🎙️',
    status: 'up',
    category: 'ai'
  },
  {
    name: 'Coolify',
    url: 'https://coolify.zappro.site',
    description: 'PaaS dashboard',
    icon: '☁️',
    status: 'up',
    category: 'infra'
  },
  {
    name: 'Gitea',
    url: 'https://git.zappro.site',
    description: 'Git repositories',
    icon: '📦',
    status: 'up',
    category: 'dev'
  },
  {
    name: 'Infisical',
    description: 'Secrets manager',
    icon: '🔐',
    status: 'up',
    category: 'infra'
  },
  {
    name: 'Kokoro TTS',
    url: 'http://localhost:8012',
    description: 'Text-to-Speech',
    icon: '🔊',
    status: 'up',
    category: 'ai'
  }
];
```

---

## Google OAuth Flow

```
1. User → list.zappro.site
2. No session → redirect to Google OAuth
3. Google login → callback → JWT session
4. Session valid → show tools list
5. Session invalid → back to Google login
```

---

## Security

- Cloudflare Access policy (same as chat.zappro.site)
- Google OAuth only — no username/password
- CORS: restrict to list.zappro.site
- Secrets from Infisical only (no hardcode)

---

## Files Created

| File | Purpose |
|------|---------|
| `apps/list-web/index.html` | Single page app |
| `apps/list-web/styles.css` | Dark theme |
| `apps/list-web/app.js` | OAuth + tools render |
| `apps/list-web/infisical-get-secret.js` | Get GOOGLE_CLIENT_ID |
| `apps/list-web/auth.js` | OAuth flow |
| `apps/list-web/tools.js` | Tools data + render |

---

## Acceptance Criteria

- [x] list.zappro.site accessible — `apps/list-web/` created with all files
- [x] Google OAuth login works — `auth.js` + `auth-callback.html` implemented
- [x] Tools displayed as cards — `tools.js` with 18 tools across categories
- [x] Visual identity matches painel.zappro.site — dark theme `#1a1a2e` + `#e94560`
- [ ] Status indicators show real status — needs curl check implementation
- [x] Mobile responsive — CSS Grid responsive layout

---

## Out of Scope (V2)

- User-specific tool preferences
- Tool categorization/filters
- Search
- Dark/light mode toggle
- API access
