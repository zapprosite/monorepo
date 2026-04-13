---
name: SPEC-036-todo-web
description: OAuth Todo Web App at todo.zappro.site
status: COMPLETED
priority: high
author: will-zappro
date: 2026-04-13
completed: 2026-04-13
---

# SPEC-036: todo.zappro.site — OAuth Todo Web App

> ⚠️ **Subdomain Governance:** Before exposing any subdomain, check PORTS.md + SUBDOMAINS.md and update via Cloudflare API.

---

## Objective

Create a simple todo web application at `todo.zappro.site` with Google OAuth login and basic todo management (add/complete/delete). The app is a single static HTML+JS application running in an nginx:alpine container, with OAuth session and todos stored in localStorage.

---

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Frontend | Vanilla HTML/JS | Single `index.html`, no build step |
| OAuth | Google OAuth 2.0 + PKCE | Direct, no Cloudflare Access |
| Backend | None | Stateless, all data in localStorage |
| Container | nginx:alpine | Docker container |
| Tunnel | Cloudflare Zero Trust (api-fast-path) | Subdomain: `todo.zappro.site` |

---

## Project Structure

```
/srv/monorepo/apps/todo-web/
├── index.html          # Main todo app (after auth)
├── auth-callback.html  # OAuth callback handler
├── nginx.conf          # nginx configuration
├── Dockerfile          # Container build
└── docker-compose.yml # Docker Compose for local dev
```

---

## OAuth Flow

1. User visits `https://todo.zappro.site` → no `user` in localStorage → redirect to Google OAuth consent screen
2. Google authenticates user → redirects to `/auth/callback?code=...`
3. `auth-callback.html` exchanges code for tokens (PKCE), stores `{email, name, picture}` in localStorage → redirects to `index.html`
4. `index.html` reads user from localStorage → shows todo list
5. Todo operations (add/complete/delete) read/write to `todos[]` in localStorage
6. Logout clears localStorage → redirects to Google logout

---

## Subdomain

| Field | Value |
|-------|-------|
| Name | `todo.zappro.site` |
| Container IP | `10.0.17.2` |
| Port | `4082` |
| Service URL | `http://10.0.17.2:4082` |
| Tunnel | Cloudflare Zero Trust `api-fast-path` |
| DNS | CNAME created via Cloudflare API |
| Ingress | Added via `/cfd_tunnel/{id}/configurations` |
| Status | **OPERATIONAL** |

---

## Files to Create

### apps/todo-web/index.html

Main todo application. Features:
- Header: user avatar, name, logout button
- Todo input: text field + "Add" button
- Todo list: checkbox + text + delete button
- States: loading, empty, populated
- Responsive vanilla CSS

### apps/todo-web/auth-callback.html

OAuth callback page. Logic:
- Parse `code` from URL query string
- Exchange code for tokens via Google OAuth token endpoint
- Store user info in localStorage
- Redirect to `index.html`

### apps/todo-web/nginx.conf

nginx config for nginx:alpine:
- Listen on port 80
- Serve static files from `/usr/share/nginx/html`
- Location for `/auth/callback` → serve `auth-callback.html`
- Default location → serve `index.html`

### apps/todo-web/Dockerfile

```dockerfile
FROM nginx:alpine
COPY index.html auth-callback.html nginx.conf /usr/share/nginx/html/
```

### apps/todo-web/docker-compose.yml

```yaml
services:
  todo-web:
    build: .
    container_name: todo-web
    ports:
      - "4082:80"
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-qO-", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
```

---

## Environment Variables (env.js injection)

Before container start, inject via `env.js`:

```javascript
window.GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID";
window.OAUTH_REDIRECT_URI = "https://todo.zappro.site/auth/callback.html";
```

---

## Acceptance Criteria

| # | Criterion | Verification | Status |
|---|-----------|--------------|--------|
| AC-1 | OAuth redirect URI printed before any code | Emit URI in console log during dev | ✅ Completed |
| AC-2 | Google OAuth login works end-to-end | Login with Google account, redirect back, user displayed | ✅ Completed |
| AC-3 | Todo add/complete/delete works | Add item → check checkbox → delete item | ✅ Completed |
| AC-4 | Subdomain created via Cloudflare API | CNAME created via Cloudflare API | ✅ Completed |
| AC-5 | Container running at `https://todo.zappro.site` | `todo-web` container UP on port 4082, IP 10.0.17.2 | ✅ Completed |
| AC-6 | Smoke test passes | `curl -sfI https://todo.zappro.site` returns HTTP 200 | ✅ Completed |
| AC-7 | Tunnel ingress configured | Added via `/cfd_tunnel/{id}/configurations` | ✅ Completed |

---

## Non-Goals

- This spec does NOT cover backend persistence (no database)
- This spec does NOT cover user-specific todo storage across devices
- This spec does NOT cover todo sharing or collaboration
- This spec does NOT cover Cloudflare Access (uses direct Google OAuth)

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Google OAuth 2.0 App | REQUIRED | Must be created in Google Cloud Console |
| Cloudflare Zero Trust Tunnel | REQUIRED | `api-fast-path` tunnel setup |
| Port 4082 | TO BE VERIFIED | Check PORTS.md before binding |
| Docker | READY | Host has Docker available |

---

## Open Questions

| # | Question | Impact | Priority |
|---|----------|--------|----------|
| OQ-1 | Google OAuth Client ID — who creates the app in Google Cloud Console? | High | Critical |
| OQ-2 | Container IP range — does Docker network `10.0.5.0/24` already exist? | Med | High |
| OQ-3 | `env.js` injection — via entrypoint script or baked at build time? | Low | Medium |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-13 | Use vanilla HTML/JS instead of React | Simplicity, no build step, single static file |
| 2026-04-13 | Store todos in localStorage | Stateless app, no backend required |
| 2026-04-13 | Use Google OAuth 2.0 + PKCE directly | OAuth-native approach, no Cloudflare Access dependency |

---

## Implementation Summary (2026-04-13)

| Component | Status | Details |
|-----------|--------|---------|
| **Subdomain** | ✅ Operational | `todo.zappro.site` |
| **OAuth** | ✅ Working | Google OAuth 2.0 + PKCE |
| **Container** | ✅ Running | `todo-web` on port 4082, IP 10.0.17.2 |
| **Tunnel** | ✅ Configured | Cloudflare Zero Trust ingress |
| **DNS** | ✅ Created | CNAME via Cloudflare API |
| **Ingress** | ✅ Added | Via `/cfd_tunnel/{id}/configurations` |
| **Smoke Test** | ✅ Passed | HTTP 200 verified |

---

## Checklist

- [x] SPEC written and reviewed
- [x] Google OAuth Client ID obtained
- [x] Port 4082 verified available
- [x] Cloudflare subdomain created (CNAME via Cloudflare API)
- [x] Container deployed and accessible (`todo-web` on 10.0.17.2:4082)
- [x] Smoke test passed (HTTP 200 verified)
- [x] Tunnel ingress configured (`/cfd_tunnel/{id}/configurations`)
