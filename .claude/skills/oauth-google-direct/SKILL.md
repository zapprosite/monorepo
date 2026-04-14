---
name: oauth-google-direct
description: Implement Google OAuth 2.0 directly in a static web app (no Cloudflare Access — MVP fast path)
trigger: /oauth-google
---

# Skill: oauth-google-direct

Implement Google OAuth 2.0 Authorization Code Flow with PKCE in a static HTML/JS app deployed behind Cloudflare Tunnel. No Cloudflare Access — pure app-level OAuth for MVP speed.

## Prerequisites

- Subdomain registered in `/srv/ops/ai-governance/SUBDOMAINS.md`
- Port allocated in `/srv/ops/ai-governance/PORTS.md`
- Google Cloud Console project with OAuth 2.0 Client ID configured
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` stored in Infisical

## Flow Summary

```
User → https://app.zappro.site → nginx static → JS OAuth → Google → /auth/callback → app
```

## Step 0: FIRST PRINT OAUTH URI FOR USER

This MUST happen BEFORE any code is written. Print this block and wait for confirmation:

```
╔══════════════════════════════════════════════════════════════╗
║          ⚠️  ACTION REQUIRED — Configure Google OAuth       ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Go to: https://console.cloud.google.com/apis/credentials   ║
║                                                              ║
║  Add Authorized Redirect URI:                                ║
║    https://APP_SUBDOMAIN.zappro.site/auth/callback          ║
║                                                              ║
║  Add Authorized JavaScript Origin:                          ║
║    https://APP_SUBDOMAIN.zappro.site                        ║
║                                                              ║
║  Press ENTER when done...                                    ║
╚══════════════════════════════════════════════════════════════╝
```

## Step 1: Create Project Structure

```
app-name/
├── index.html            # Main app with OAuth check
├── auth-callback.html    # OAuth callback handler
├── build.sh              # Substitutes {{GOOGLE_CLIENT_ID}} from env
├── nginx.conf            # nginx config with /auth/callback route
├── Dockerfile            # nginx:alpine, non-root user
└── docker-compose.yml   # Compose with healthcheck
```

## Step 2: OAuth Implementation Pattern

### Authorization Code Flow with PKCE

**Why PKCE instead of Implicit Flow?**
- Implicit Flow is deprecated (OAuth 2.0 Security Best Current Practice)
- PKCE provides equivalent protection against authorization code interception
- Required for mobile/native apps, recommended for all SPAs

### index.html — Auth Check & Redirect

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>My App</title>
  <script src="app.js" defer></script>
</head>
<body>
  <div id="app">
    <p>Loading...</p>
  </div>
</body>
</html>
```

### app.js — Main OAuth Logic

```javascript
const GOOGLE_CLIENT_ID = '{{GOOGLE_CLIENT_ID}}';
const REDIRECT_URI = window.location.origin + '/auth/callback';

const SCOPES = [
  'openid',
  'email',
  'profile'
].join(' ');

function generateRandomString(length) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

async function sha256(plain) {
  const encoder = new TextEncoder();
  const data = encoder.encode(plain);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)));
}

async function generatePKCE() {
  const verifier = generateRandomString(64);
  const challenge = await sha256(verifier);
  sessionStorage.setItem('pkce_verifier', verifier);
  return { verifier, challenge };
}

async function initiateOAuth() {
  const { verifier, challenge } = await generatePKCE();
  const state = generateRandomString(16);
  sessionStorage.setItem('oauth_state', state);

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256'
  });

  window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
}

function checkAuth() {
  const token = sessionStorage.getItem('access_token');
  if (token) {
    renderApp();
  } else {
    initiateOAuth();
  }
}

function renderApp() {
  document.getElementById('app').innerHTML = `
    <h1>Welcome!</h1>
    <p>You are authenticated.</p>
    <button onclick="logout()">Logout</button>
  `;
}

function logout() {
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('id_token');
  sessionStorage.removeItem('pkce_verifier');
  sessionStorage.removeItem('oauth_state');
  window.location.reload();
}

document.addEventListener('DOMContentLoaded', checkAuth);
```

### auth-callback.html — Code Exchange

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Authenticating...</title>
</head>
<body>
  <p>Completing authentication...</p>
  <script src="callback.js" defer></script>
</body>
</html>
```

### callback.js — Token Exchange

```javascript
const GOOGLE_CLIENT_ID = '{{GOOGLE_CLIENT_ID}}';
const REDIRECT_URI = window.location.origin + '/auth/callback';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';

async function exchangeCodeForToken(code) {
  const verifier = sessionStorage.getItem('pkce_verifier');
  const state = sessionStorage.getItem('oauth_state');

  // Validate state
  const urlParams = new URLSearchParams(window.location.search);
  const returnedState = urlParams.get('state');
  if (state !== returnedState) {
    throw new Error('State mismatch — possible CSRF attack');
  }

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: '{{GOOGLE_CLIENT_SECRET}}',  // Required for token exchange
    code,
    grant_type: 'authorization_code',
    code_verifier: verifier,
    redirect_uri: REDIRECT_URI
  });

  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error_description || error.error);
  }

  return response.json();
}

async function handleCallback() {
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('code');
  const error = urlParams.get('error');

  if (error) {
    document.body.innerHTML = `<p>Auth error: ${error}</p>`;
    return;
  }

  if (!code) {
    document.body.innerHTML = '<p>No authorization code received.</p>';
    return;
  }

  try {
    const tokens = await exchangeCodeForToken(code);
    sessionStorage.setItem('access_token', tokens.access_token);
    sessionStorage.setItem('id_token', tokens.id_token);
    sessionStorage.setItem('token_type', tokens.token_type);

    // Clean up PKCE artifacts
    sessionStorage.removeItem('pkce_verifier');
    sessionStorage.removeItem('oauth_state');

    // Redirect to main app
    window.location.href = window.location.origin + '/';
  } catch (err) {
    document.body.innerHTML = `<p>Token exchange failed: ${err.message}</p>`;
  }
}

document.addEventListener('DOMContentLoaded', handleCallback);
```

## Step 3: build.sh

```bash
#!/bin/bash
set -e

# Ensure GOOGLE_CLIENT_ID is set
if [ -z "$GOOGLE_CLIENT_ID" ]; then
  echo "ERROR: GOOGLE_CLIENT_ID not set"
  exit 1
fi

# Substitute placeholders
sed "s/{{GOOGLE_CLIENT_ID}}/${GOOGLE_CLIENT_ID}/g" index.html > dist/index.html
sed -e "s/{{GOOGLE_CLIENT_ID}}/${GOOGLE_CLIENT_ID}/g" \
    -e "s/{{GOOGLE_CLIENT_SECRET}}/${GOOGLE_CLIENT_SECRET}/g" \
    auth-callback.html > dist/auth-callback.html

cp nginx.conf dist/nginx.conf
cp docker-compose.yml dist/docker-compose.yml

echo "Build complete. GOOGLE_CLIENT_ID injected."
```

## Step 4: nginx.conf

```nginx
server {
    listen 80;
    server_name app.zappro.site;
    root /usr/share/nginx/html;
    index index.html;

    # Serve static files
    location / {
        try_files $uri $uri/ =404;
    }

    # OAuth callback route
    location /auth/callback {
        alias /usr/share/nginx/html/auth-callback.html;
        default_type text/html;
    }

    # Healthcheck endpoint
    location /health {
        access_log off;
        return 200 "healthy\n";
        add_header Content-Type text/plain;
    }
}
```

## Step 5: Dockerfile

```dockerfile
FROM nginx:alpine

# Create non-root user
RUN addgroup -g 101 -S appgroup && \
    adduser -u 101 -S appuser -G appgroup

COPY --chown=appuser:appgroup dist/ /usr/share/nginx/html/

RUN chown -R appuser:appgroup /usr/share/nginx/html/ && \
    chmod -R 755 /usr/share/nginx/html/

USER appuser

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
```

## Step 6: docker-compose.yml

```yaml
services:
  app:
    build: .
    restart: unless-stopped
    ports:
      - "127.0.0.1:${PORT:-8080}:80"
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

## Step 7: Deploy Checklist

```
[ ] GOOGLE_CLIENT_ID added to Infisical (project: app-name)
[ ] GOOGLE_CLIENT_SECRET added to Infisical
[ ] Subdomain registered in SUBDOMAINS.md
[ ] Port allocated in PORTS.md
[ ] Terraform applied: subdomain → container IP
[ ] Container deployed and healthy
[ ] Smoke test: curl -sfI https://app.zappro.site → 200
[ ] Smoke test: curl -sfI https://app.zappro.site/auth/callback → 200
[ ] OAuth login tested end-to-end
```

## When To Use vs Cloudflare Access

| | Direct OAuth | Cloudflare Access |
|---|---|---|
| Speed | Fast — no Access policy setup | Slower — requires Access configuration |
| For | MVP, test apps, internal tools | Production apps needing Zero Trust |
| Auth control | App-level only | Network-level + App-level |
| User management | Google only | Google + team members via CF Access |
| Compliance | Basic | Enhanced (audit logs, device posture) |

## Security Notes

- **sessionStorage, not localStorage** — Tokens cleared on tab close
- **PKCE required** — Prevents authorization code interception
- **client_secret in token exchange** — Required; stored server-side if possible
- **State parameter** — Prevents CSRF attacks
- **HTTPS only** — All production deployments must use TLS

## References

- `references/html-template.md` — Full HTML/JS implementation templates
- `references/oauth-flow-diagram.md` — Visual flow explanation

## Related Skills

- `list-web-from-zero-to-deploy` — Full stack pattern with nginx + Docker + Terraform tunnel
- `cloudflare-terraform` — Add subdomains and DNS management
