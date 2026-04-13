---
name: oauth-google-cloudflare
description: Implement Google OAuth via Cloudflare Access Zero Trust (V2 — Production protection). All auth handled at the edge, app receives CF JWT header.
---

# OAuth Google Cloudflare Access Skill

## Architecture

```
User → Cloudflare Edge → CF Access (Zero Trust) → Google OAuth → CF JWT Cookie → App
```

**Key points:**
- Cloudflare Access sits IN FRONT of the tunnel — user never reaches the app without authenticating first
- App gets CF JWT in `Cf-Access-Jwt-Assertion` header — can verify or trust
- No OAuth code needed in app (just optional JWT validation)
- Works for any app type (static, API, reverse proxy)

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLOUDFLARE EDGE                                │
│  ┌──────────┐    ┌──────────────────┐    ┌───────────────┐                  │
│  │  User    │───▶│  CF Access      │───▶│  Google OAuth │                  │
│  │  Request │    │  Zero Trust     │    │  (IdP)        │                  │
│  └──────────┘    └──────────────────┘    └───────────────┘                  │
│                          │                                                 │
│                          ▼                                                 │
│                   ┌──────────────┐                                         │
│                   │ CF JWT Cookie│                                         │
│                   └──────────────┘                                         │
└─────────────────────────────────────────────────────────────────────────────┘
                          │
                          ▼
                 ┌─────────────────────┐
                 │ Cf-Access-Jwt-      │
                 │ Assertion header    │
                 └─────────────────────┘
                          │
                          ▼
                 ┌─────────────────────┐
                 │  Your App           │
                 │  (no auth code)     │
                 └─────────────────────┘
```

---

## Step 0: FIRST PRINT TWO URIs FOR USER

```
╔══════════════════════════════════════════════════════════════╗
║     ⚠️  ACTION REQUIRED — Two Steps Required                ║
╠══════════════════════════════════════════════════════════════╣
║  STEP 1: Google Cloud Console                                ║
║  → https://console.cloud.google.com/apis/credentials        ║
║  Add Authorized Redirect URI:                                ║
║    https://CLOUDFLARE_TEAM_DOMAIN/cdn-cgi/access/callback   ║
║    (your team domain: check dash.cloudflare.com/ZT > Settings)║
║                                                              ║
║  STEP 2: Cloudflare Zero Trust Dashboard                     ║
║  → https://one.dash.cloudflare.com/                         ║
║  Settings > Authentication > Add Google as Identity Provider ║
║  Use these values:                                           ║
║    Client ID: [from /srv/monorepo/.env GOOGLE_CLIENT_ID]     ║
║    Client Secret: [from /srv/monorepo/.env GOOGLE_CLIENT_SECRET]║
╚══════════════════════════════════════════════════════════════╝
```

---

## Step 1: Configure Google OAuth Credentials

### 1.1 Get credentials from Infisical

```bash
# Using Infisical SDK to get credentials
python3 << 'EOF'
from infisical_sdk import InfisicalSDKClient
client = InfisicalSDKClient(
    host='http://127.0.0.1:8200',
    token=open('/srv/ops/secrets/infisical.service-token').read().strip()
)
secrets = client.secrets.list_secrets(
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key in ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET']:
        print(f"{s.secret_key}={s.secret_value}")
EOF
```

### 1.2 Register in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. Select or create OAuth 2.0 Client ID (Web Application)
3. Add **Authorized Redirect URI**:
   ```
   https://CLOUDFLARE_TEAM_DOMAIN/cdn-cgi/access/callback
   ```
   - Find `CLOUDFLARE_TEAM_DOMAIN` in Zero Trust Dashboard → Settings → General
   - Example: `https://zappro.cloudflareaccess.com/cdn-cgi/access/callback`

### 1.3 Add Google as IdP in Cloudflare Zero Trust

1. Go to: https://one.dash.cloudflare.com/
2. Settings → Authentication → Add new identity provider → Google
3. Enter:
   - **Client ID**: from Google Cloud Console
   - **Client Secret**: from Google Cloud Console

---

## Step 2: Terraform Configuration

### 2.1 Add to `variables.tf`

Add new service to the `services` map:

```hcl
services = {
  # ... existing services ...
  myapp = {
    url              = "http://10.0.x.x:8080"
    subdomain        = "myapp"        # → myapp.zappro.site
    http_host_header = null
  }
}
```

### 2.2 Update `access.tf`

```hcl
# The access_services filter already excludes bot, list, md
# Any new service added to variables.tf will automatically get Access protection
locals {
  access_services = { for k, v in var.services : k => v if k != "bot" && k != "list" && k != "md" }
}
```

### 2.3 Terraform commands

```bash
cd /srv/ops/terraform/cloudflare
terraform plan -out=tfplan
terraform apply tfplan
```

---

## Step 3: Verify Protection

### 3.1 Test unauthenticated access (should redirect to Google)

```bash
curl -sfI https://myapp.zappro.site/
# Should return: 302 to Google OAuth (or CF Access page)
```

### 3.2 Test from browser

1. Open: `https://myapp.zappro.site/`
2. Should be redirected to Google OAuth login
3. After login, should reach your app
4. Check DevTools → Network → Request Headers
   - Should see: `Cf-Access-Jwt-Assertion: eyJ...`

---

## App Side — Receiving Authenticated Requests

The app receives requests with the `Cf-Access-Jwt-Assertion` header.

### Option A: Trust the header (simplest)

If your app is behind Cloudflare Access, you can **trust** the header — Cloudflare already validated the user.

```nginx
# Nginx — pass the header to app, or use it for logging
location / {
    proxy_pass http://10.0.x.x:8080;
    proxy_set_header Cf-Access-Jwt-Assertion $http_cf_access_jwt_assertion;
    proxy_set_header Cf-Access-User-Email $http_cf_access_user_email;
}
```

### Option B: Validate JWT in app (optional but recommended for sensitive apps)

```javascript
// Node.js — validate CF Access JWT
import jwt from 'jsonwebtoken';

function getUserFromCFHeader(req) {
    const token = req.headers['cf-access-jwt-assertion'];
    if (!token) return null;

    try {
        // CF Access public keys are available at:
        // https://CLOUDFLARE_TEAM_DOMAIN/cdn-cgi/access/certs/public_key
        const cert = await fetch('https://zappro.cloudflareaccess.com/cdn-cgi/access/certs/public_key');
        const { keys } = await cert.json();

        const decoded = jwt.verify(token, keys[0].pubkey, {
            algorithms: ['RS256'],
            audience: 'myapp.zappro.site'  // match your domain
        });

        return {
            email: decoded.email,
            sub: decoded.sub,
            name: decoded.name
        };
    } catch (err) {
        console.error('Invalid CF JWT:', err.message);
        return null;
    }
}
```

---

## Benefits vs Direct OAuth (MVP Pattern)

| Aspect | Direct OAuth (MVP) | Cloudflare Access |
|--------|-------------------|-------------------|
| Auth code in app | Full OAuth flow | **None** |
| User login | App handles callback | **Cloudflare handles** |
| Token refresh | App manages | **Automatic** |
| Multiple IdPs | Complex | **Easy (add in dashboard)** |
| Email allowlist | App code | **Terraform version-controlled** |
| Works for | Web apps | **Any app type** |
| Bot protection | None | **Built-in CAPTCHA** |

---

## When To Use

**Use Cloudflare Access for:**
- Production apps
- Team-only dashboards (Gitea, Grafana, n8n, Coolify)
- APIs that shouldn't be public
- Any app where you want centralized auth control

**Use Direct OAuth (MVP) for:**
- Apps where you need programmatic token access
- Custom OAuth logic in the app itself
- Services excluded in `access_services` filter

---

## Files

```
/srv/ops/terraform/cloudflare/
├── variables.tf    # Service definitions
├── access.tf       # Cloudflare Access policies
└── terraform.tfvars  # Secrets (gitignored)
```

---

## References

- [Cloudflare Zero Trust Access](https://developers.cloudflare.com/cloudflare-one/identity/)
- [Cloudflare Access Application](https://developers.cloudflare.com/cloudflare-one/identity/users/policy-engine/)
- [JWT Validation](https://developers.cloudflare.com/cloudflare-one/identity/authorization/)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
