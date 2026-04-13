# Deployment Checklist — list-web

**App:** list.zappro.site
**Date:** 2026-04-12
**Status:** READY FOR DEPLOY

---

## 1. Files Verification

### Required Files (SPEC-TOOL-LIST.md)

| File | Path | Status |
|------|------|--------|
| index.html | `apps/list-web/index.html` | ✅ |
| styles.css | `apps/list-web/styles.css` | ✅ |
| app.js | `apps/list-web/app.js` | ✅ |
| auth.js | `apps/list-web/auth.js` | ✅ |
| auth-callback.html | `apps/list-web/auth-callback.html` | ✅ |
| tools.js | `apps/list-web/tools.js` | ✅ |
| infisical-get-secret.js | `apps/list-web/infisical-get-secret.js` | ✅ |

### Git Status

```bash
cd /srv/monorepo
git status apps/list-web/
```

Expected: Untracked files (new app)

---

## 2. Conflicts Check

### Directory Structure
- `apps/list-web/` does NOT conflict with existing directories
- `apps/web/` is a React app (different purpose)
- `apps/api/`, `apps/orchestrator/`, `apps/perplexity-agent/`, `apps/workers/` are separate

### Gitignore Patterns
```gitignore
# apps/web/ uses standard gitignore (node_modules, dist, etc.)
# apps/list-web/ follows same pattern
# No conflicts detected
```

### File Name Conflicts
| File | Conflict with apps/web/? |
|------|---------------------------|
| index.html | No (different directory) |
| styles.css | No |
| app.js | No |
| auth.js | No |
| auth-callback.html | No |
| tools.js | No |
| infisical-get-secret.js | No |

---

## 3. Pre-Deploy Checklist

### DNS & Subdomain (SUBDOMAINS.md)
- [ ] Verify `list.zappro.site` is available in SUBDOMAINS.md
- [ ] Add to Cloudflare Tunnel config if not exists
- [ ] Update DNS via Terraform

### Port Allocation (PORTS.md)
- [ ] Choose port (suggest: 4080 or similar in 4002-4099 range)
- [ ] Verify port is free: `ss -tlnp | grep :PORT`
- [ ] Document in PORTS.md

### OAuth Configuration
- [ ] Create Google OAuth App in console.cloud.google.com
- [ ] Add `https://list.zappro.site/auth/callback` to redirect URIs
- [ ] Store `GOOGLE_CLIENT_ID` in Infisical vault
- [ ] Store `GOOGLE_CLIENT_SECRET` in Infisical vault

### Cloudflare Access
- [ ] Apply same Access policy as chat.zappro.site
- [ ] Or use public access if no auth required

---

## 4. Build & Deploy

### Option A: Static Nginx (Recommended)

```bash
# 1. Create nginx config
cat > /srv/data/list-web/nginx.conf << 'EOF'
server {
    listen 4080;
    server_name list.zappro.site;
    root /srv/data/list-web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # OAuth callback - no caching
    location /auth/callback {
        add_header Cache-Control "no-store";
    }
}
EOF

# 2. Create docker-compose
cat > /srv/data/list-web/docker-compose.yml << 'EOF'
services:
  nginx:
    image: nginx:alpine
    container_name: list-web
    volumes:
      - /srv/data/list-web:/usr/share/nginx/html:ro
      - ./nginx.conf:/etc/nginx/conf.d/default.conf:ro
    ports:
      - "4080:4080"
    restart: unless-stopped
EOF

# 3. Copy files
cp -r /srv/monorepo/apps/list-web/* /srv/data/list-web/

# 4. Start
cd /srv/data/list-web && docker-compose up -d
```

### Option B: Coolify Deploy

```bash
# Via Coolify UI or API
# 1. Create new app in Coolify
# 2. Point to /srv/monorepo/apps/list-web
# 3. Set port: 4080
# 4. Enable static build
```

---

## 5. Cloudflare Tunnel Setup

### Check Existing Tunnel

```bash
# Verify cloudflared is running
sudo systemctl status cloudflared

# Check tunnel config
cat /srv/ops/cloudflared/config.yml
```

### Add Route for list-web

```bash
# Example ingress rule to add:
# - hostname: list.zappro.site
#   service: http://localhost:4080
```

### Apply Terraform

```bash
cd /srv/ops/terraform/cloudflare
terraform plan
terraform apply
```

---

## 6. DNS Update

```bash
# Update DNS record
# Point list.zappro.site to cloudflared tunnel
```

---

## 7. Post-Deploy Verification

### Health Check

```bash
# Test endpoint
curl -sfI https://list.zappro.site

# Expected: HTTP 200
```

### OAuth Test

```bash
# 1. Navigate to https://list.zappro.site
# 2. Should redirect to Google OAuth (if auth enabled)
# 3. Login and callback
# 4. Tools grid displayed
```

### Console Errors

```javascript
// Open DevTools → Console
// Expected: No errors
```

---

## 8. Rollback Procedure

```bash
# Stop container
cd /srv/data/list-web && docker-compose down

# Remove files
rm -rf /srv/data/list-web

# Remove DNS/Cloudflare entries
cd /srv/ops/terraform/cloudflare && terraform apply

# Remove subdomain from tunnel config
```

---

## Acceptance Criteria (from SPEC-TOOL-LIST.md)

- [ ] list.zappro.site accessible
- [ ] Google OAuth login works
- [ ] Tools displayed as cards
- [ ] Visual identity matches painel.zappro.site
- [ ] Status indicators show real status
- [ ] Mobile responsive

---

## Quick Deploy Commands

```bash
# One-liner deploy (after config)
mkdir -p /srv/data/list-web && \
cp /srv/monorepo/apps/list-web/* /srv/data/list-web/ && \
cd /srv/data/list-web && \
docker run -d --name list-web \
  -v $(pwd):/usr/share/nginx/html:ro \
  -p 4080:80 \
  --restart unless-stopped \
  nginx:alpine
```