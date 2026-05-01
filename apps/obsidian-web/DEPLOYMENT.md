# Obsidian Web Deployment

## Deployment Steps

### 1. Build container (in /srv/monorepo/apps/obsidian-web)

```bash
./build.sh
```

### 2. Add to Coolify

- App name: obsidian-web
- Image: obsidian-web:local
- Port: 4081
- Domain: md.zappro.site

### 3. Add to Terraform

- Add `md` entry to variables.tf (done by terraform agent)
- Run `cd /srv/ops/terraform/cloudflare && terraform plan && terraform apply`

### 4. Verify

```bash
curl -sfI https://md.zappro.site
```

## Files

- index.html - Main UI
- app.js - File browser logic
- styles.css - Styling
- markdown.js - Markdown renderer
- auth-callback.html - OAuth callback
- nginx.conf - Nginx config
- Dockerfile - Container build

## OAuth

Uses same Google OAuth as list-web (GOOGLE_CLIENT_ID from .env).
Session key: obsidian_vault_session