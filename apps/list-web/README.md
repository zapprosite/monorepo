# list-web — Zappro Tools List

Static web app listing homelab tools with Google OAuth authentication.

## Quick Start

```bash
# Copy files to web root
cp -r apps/list-web/* /srv/data/list-web/

# Or serve locally
cd apps/list-web && python3 -m http.server 4080
```

## Configuration

### Environment Variables

| Variable | Description | Source |
|----------|-------------|--------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID | Infisical vault |
| `GOOGLE_CLIENT_SECRET` | Google OAuth Client Secret | Infisical vault |

### OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `https://list.zappro.site/auth/callback`
4. Add credentials to Infisical vault:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`

### Infisical Configuration

The app uses the Infisical SDK to fetch secrets at runtime:

```javascript
const INFISICAL_CONFIG = {
  clientId: '_CLIENT_ID_',     // Replace with actual
  clientSecret: '_CLIENT_SECRET_', // Replace with actual
};
```

Update `infisical-get-secret.js` with actual Infisical credentials or use environment-specific configuration.

## Deployment

### Option 1: Docker + Nginx

```bash
# Start container
docker run -d --name list-web \
  -v /srv/data/list-web:/usr/share/nginx/html:ro \
  -p 4080:80 \
  --restart unless-stopped \
  nginx:alpine
```

### Option 2: Coolify

1. Create new app in Coolify dashboard
2. Point source to `/srv/monorepo/apps/list-web`
3. Set build type: Static
4. Set port: 4080
5. Deploy

### Option 3: Standalone Nginx

```bash
# Copy to nginx root
cp -r apps/list-web/* /var/www/html/

# Or add to nginx.conf
server {
    listen 4080;
    root /srv/data/list-web;
    index index.html;
}
```

## Domain & DNS

| Setting | Value |
|---------|-------|
| Subdomain | `list.zappro.site` |
| Port | 4080 |
| Tunnel | cloudflared |
| Access | Cloudflare Access (Google OAuth) |

### Cloudflare Tunnel Config

Add to `cloudflared/config.yml`:

```yaml
ingress:
  - hostname: list.zappro.site
    service: http://localhost:4080
```

## Project Structure

```
apps/list-web/
├── index.html              # Main SPA
├── styles.css              # Dark theme styles
├── app.js                  # Main entry point
├── auth.js                 # Google OAuth flow
├── auth-callback.html      # OAuth callback handler
├── tools.js                # Tools data + renderer
├── infisical-get-secret.js # Infisical SDK wrapper
├── DEPLOYMENT.md           # Deployment checklist
└── README.md               # This file
```

## Features

- **Dark Theme**: Matches painel.zappro.site design
- **Tool Cards**: Icon, name, description, status indicator
- **Status Badges**: UP (green), DOWN (red), DEGRADED (amber)
- **Responsive**: Mobile-first grid layout
- **OAuth**: Google login via Cloudflare Access

## Development

```bash
# Local dev server
cd apps/list-web && python3 -m http.server 4080

# Open in browser
open http://localhost:4080
```

## Troubleshooting

### "Infisical: Failed to fetch"
- Verify Infisical vault is accessible
- Verify credentials have access to secrets

### OAuth redirect not working
- Verify redirect URI in Google Cloud Console
- Check Cloudflare Access policy allows redirect

### Fonts/Assets 404
- Ensure all files copied to web root
- Check file permissions

## License

Internal homelab use only.
