# deployment.md — list-web Deployment Guide

**App:** list.zappro.site
**Directory:** `/srv/monorepo/apps/list-web`
**Date:** 2026-04-12

---

## 1. Files Verification

### All Required Files Created

| File | Path | Size | Status |
|------|------|------|--------|
| index.html | `apps/list-web/index.html` | 327B | ✅ |
| styles.css | `apps/list-web/styles.css` | 10.6KB | ✅ |
| app.js | `apps/list-web/app.js` | 981B | ✅ |
| auth.js | `apps/list-web/auth.js` | 4.2KB | ✅ |
| auth-callback.html | `apps/list-web/auth-callback.html` | 2.4KB | ✅ |
| tools.js | `apps/list-web/tools.js` | 2.6KB | ✅ |
| infisical-get-secret.js | `apps/list-web/infisical-get-secret.js` | 1.8KB | ✅ |
| Dockerfile | `apps/list-web/Dockerfile` | ✅ | |
| docker-compose.yml | `apps/list-web/docker-compose.yml` | ✅ | |
| build.sh | `apps/list-web/build.sh` | ✅ | |
| DEPLOYMENT.md | `apps/list-web/DEPLOYMENT.md` | ✅ | |
| README.md | `apps/list-web/README.md` | ✅ | |

### Git Status

```bash
cd /srv/monorepo
git status apps/list-web/
# Expected: Untracked files (new app)
```

---

## 2. Conflicts Check

### Directory Structure — NO CONFLICTS

```
apps/
├── api/                    (Fastify + tRPC)
├── orchestrator/           (Orchestrator service)
├── perplexity-agent/       (Perplexity agent)
├── web/                    (React + Vite - DIFFERENT APP)
├── workers/                (Worker services)
└── list-web/               (NEW - Static HTML/JS app) ✅
```

### File Names — NO CONFLICTS

All files in `apps/list-web/` are unique and do not conflict with any existing files in the monorepo.

### Gitignore — OK

The `apps/list-web/` directory follows standard gitignore rules (node_modules, dist, .env — none apply to static files).

---

## 3. Build Nginx Image

### Option A: Docker Build (Recommended)

```bash
cd /srv/monorepo/apps/list-web

# Build image
docker build -t ghcr.io/zappro/list-web:latest .

# Or with Infisical secrets (build.sh)
INFISICAL_TOKEN=st.xxx ./build.sh
docker build -t ghcr.io/zappro/list-web:latest ./dist
```

### Option B: Direct Nginx (No Build)

```bash
# Copy files directly to nginx root
cp -r /srv/monorepo/apps/list-web/* /var/www/html/

# Or mount volume
docker run -d --name list-web \
  -v /srv/data/list-web:/usr/share/nginx/html:ro \
  -p 4080:80 \
  --restart unless-stopped \
  nginx:alpine
```

### Build Script Details (build.sh)

The `build.sh` script:
1. Fetches `GOOGLE_CLIENT_ID` from Infisical vault
2. Injects secret into index.html via `{{GOOGLE_CLIENT_ID}}` placeholder
3. Outputs to `dist/` directory
4. Creates ready-to-deploy static files

**Prerequisites:**
- `jq` installed
- `INFISICAL_TOKEN` environment variable

---

## 4. Deploy to Coolify

### Via Coolify UI

1. Navigate to `https://coolify.zappro.site`
2. Create new app → `list-web`
3. Source: Git repository or upload files
4. Build type: Static
5. Port: 4080
6. Health check: `http://localhost/` → expect 200

### Via Coolify API

```bash
# Get app UUID
curl -s https://coolify.zappro.site/api/v1/applications | jq '.data[] | select(.name=="list-web") | .uuid'

# Trigger deploy
curl -X POST "https://coolify.zappro.site/api/v1/deploy" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"app_uuid": "xxx", "branch": "main"}'
```

### Container Configuration

```yaml
# docker-compose.yml (from apps/list-web/)
services:
  list-web:
    image: ghcr.io/zappro/list-web:latest
    container_name: list-web
    restart: unless-stopped
    ports:
      - "127.0.0.1:4080:80"
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 5s
```

---

## 5. Cloudflare Tunnel Setup

### Verify Tunnel Status

```bash
sudo systemctl status cloudflared
journalctl -u cloudflared --no-pager -n 20
```

### Add Ingress Rule

Edit `/srv/ops/cloudflared/config.yml`:

```yaml
ingress:
  - hostname: list.zappro.site
    service: http://localhost:4080
```

### Apply Terraform Changes

```bash
cd /srv/ops/terraform/cloudflare
terraform plan
terraform apply
```

---

## 6. Update DNS

### Via Terraform

```bash
cd /srv/ops/terraform/cloudflare
# Add DNS A/CNAME record for list.zappro.site
terraform apply
```

### Manual Verification

```bash
# Check DNS propagation
dig list.zappro.site
nslookup list.zappro.site
```

---

## 7. Port Allocation

| Port | Usage | Status |
|------|-------|--------|
| 4080 | list-web HTTP | RECOMMENDED (in 4002-4099 free range) |

### Verify Port Free

```bash
ss -tlnp | grep :4080
# Expected: no output (port is free)
```

### Add to PORTS.md

After confirming deployment, update `docs/INFRASTRUCTURE/PORTS.md`:

```markdown
| **4080** | list-web | host | Tools list web app | list.zappro.site |
```

---

## 8. OAuth Configuration

### Google Cloud Console Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Authorized redirect URI: `https://list.zappro.site/auth/callback`
4. Copy Client ID and Client Secret

### Infisical Vault

Add secrets:

```bash
# Via Infisical CLI
infisical secrets set GOOGLE_CLIENT_ID=your_client_id
infisical secrets set GOOGLE_CLIENT_SECRET=your_client_secret
```

### Cloudflare Access Policy

Apply same policy as `chat.zappro.site`:
- Google OAuth provider
- Email domain allowlist: `@zappro.site` (or specific users)

---

## 9. Post-Deploy Verification

### Health Check

```bash
# Local
curl -sfI http://localhost:4080

# Remote
curl -sfI https://list.zappro.site
# Expected: HTTP 200
```

### OAuth Flow Test

```bash
# 1. Open browser to https://list.zappro.site
# 2. Should redirect to Google OAuth
# 3. Login with Google
# 4. Callback to /auth/callback
# 5. Redirect to main app with tools grid
```

### Console Errors Check

```javascript
// DevTools → Console
// Expected: No errors
// Warning about missing client_id is OK (filled at build time)
```

---

## 10. Rollback Procedure

```bash
# Stop container
docker stop list-web && docker rm list-web

# Remove from Coolify (if deployed there)
# Via Coolify UI or API

# Revert DNS/Terraform
cd /srv/ops/terraform/cloudflare && terraform apply

# Remove subdomain from tunnel config
# Edit /srv/ops/cloudflared/config.yml
```

---

## Acceptance Criteria

From SPEC-TOOL-LIST.md:

- [ ] `list.zappro.site` accessible
- [ ] Google OAuth login works
- [ ] Tools displayed as cards
- [ ] Visual identity matches `painel.zappro.site` (dark theme, #1a1a2e, #e94560)
- [ ] Status indicators show (UP/DOWN/DEGRADED)
- [ ] Mobile responsive (grid auto-fills)

---

## Quick Reference

```bash
# === Full Deploy Sequence ===

# 1. Build
cd /srv/monorepo/apps/list-web
docker build -t ghcr.io/zappro/list-web:latest .

# 2. Push to GHCR
docker push ghcr.io/zappro/list-web:latest

# 3. Deploy to Coolify
# (via Coolify UI or API)

# 4. Configure tunnel
# Edit /srv/ops/cloudflared/config.yml
# Add: - hostname: list.zappro.site → service: http://localhost:4080

# 5. Apply Terraform
cd /srv/ops/terraform/cloudflare && terraform apply

# 6. Verify
curl -sfI https://list.zappro.site
```