---
name: SUBDOMAIN-OAUTH-CREATION
description: Criar subdomains zappro.site com OAuth (Direct ou Cloudflare Access) — step-by-step para agentes Claude Code em deploys automatizados.
type: guide
author: Principal Engineer
date: 2026-04-13
prerequisites:
  - Infisical SDK configurado (credenciais via vault, nunca hardcoded)
  - Cloudflare API token disponivel no vault como CLOUDFLARE_API_TOKEN
  - Cloudflare Account ID disponivel no vault como CLOUDFLARE_ACCOUNT_ID
  - Tunnel existente: aee7a93d-c2e2-4c77-a395-71edc1821402 (homelab-tunnel)
  - Docker/Coolify para deploy do servico
tags:
  - cloudflare
  - oauth
  - subdomain
  - terraform
  - homelab
---

# Subdomain + OAuth Creation Guide

**Data:** 2026-04-13
**Est. Time:** 15-30 minutes (Method 1) | 30-60 minutes (Method 2)

---

## Overview

This guide covers the complete process for adding a new subdomain to `zappro.site` with OAuth authentication. Two methods are provided:

| Method                               | Use Case                              | Complexity | Speed              |
| ------------------------------------ | ------------------------------------- | ---------- | ------------------ |
| **Method 1: OAuth Direct (MVP)**     | Prototyping / quick test / single dev | Low        | Fast (5-15 min)    |
| **Method 2: Cloudflare Access (V2)** | Production / enterprise / team        | High       | Slower (30-60 min) |

**Quick Decision Table:**

| Situation                             | Method               |
| ------------------------------------- | -------------------- |
| Prototyping / MVP / quick test        | Method 1 (Direct)    |
| Production / enterprise / team        | Method 2 (CF Access) |
| Need fine-grained user access control | Method 2             |
| Single dev / personal tool            | Method 1             |

---

## Prerequisites

Before starting, ensure you have:

- [ ] **Infisical SDK** — Service token at `/srv/ops/secrets/infisical.service-token`
- [ ] **Cloudflare API Token** — Secret name: `CLOUDFLARE_API_TOKEN` (Infisical vault)
- [ ] **Cloudflare Account ID** — Secret name: `CLOUDFLARE_ACCOUNT_ID` (Infisical vault)
- [ ] **Tunnel ID:** `aee7a93d-c2e2-4c77-a395-71edc1821402` (homelab-tunnel)
- [ ] **Domain:** `zappro.site`
- [ ] **Terraform config:** `/srv/ops/terraform/cloudflare/variables.tf`

### Required Services

| Service         | Port               | Required |
| --------------- | ------------------ | -------- |
| Infisical Vault | :8200              | Yes      |
| Cloudflare API  | api.cloudflare.com | Yes      |
| Target app      | (your app)         | Yes      |

---

## Method 1: OAuth Direct (MVP — Quick Test, No Cloudflare Access)

Use this method for rapid prototyping. Google OAuth 2.0 is handled natively in the static app JS. **No Terraform changes required.**

### Step 1: Generate OAuth Redirect URI

Before creating the subdomain, print the OAuth URI for the user to configure in Google Cloud Console:

```bash
# Subdomain name to be used
SUBDOMAIN="yourapp"

# Print the Redirect URI (user must add this to Google Cloud Console)
echo "=== OAUTH REDIRECT URI ==="
echo "Please add this Redirect URI to your Google Cloud Console OAuth app:"
echo "https://${SUBDOMAIN}.zappro.site/auth/callback"
echo "========================="
```

**Expected output:**

```
=== OAUTH REDIRECT URI ===
Please add this Redirect URI to your Google Cloud Console OAuth app:
https://yourapp.zappro.site/auth/callback
=========================
```

### Step 2: Wait for User Confirmation

**CRITICAL:** Wait for the user to confirm they've added the Redirect URI to their Google Cloud Console before proceeding.

The agent should output a clear confirmation prompt and **pause until the user confirms**.

### Step 3: Create Subdomain via Cloudflare API

Fetch credentials from Infisical and create the DNS record directly via Cloudflare API:

```bash
#!/bin/bash
# create-subdomain.sh — Create subdomain via Cloudflare API (MVP method)

set -e

SUBDOMAIN="${1:-}"
TARGET_URL="${2:-http://localhost:8080}"
HTTP_HOST_HEADER="${3:-}"

if [ -z "$SUBDOMAIN" ] || [ -z "$TARGET_URL" ]; then
  echo "Usage: create-subdomain.sh <subdomain> <target_url> [http_host_header]"
  exit 1
fi

# Fetch secrets from Infisical
python3 - << 'EOF'
from infisical_sdk import InfisicalSDKClient
import os

client = InfisicalSDKClient(
    token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    host='http://127.0.0.1:8200'
)
secrets = client.secrets.list_secrets(
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == 'CLOUDFLARE_API_TOKEN':
        print(s.secret_value)
EOF

CLOUDFLARE_TOKEN=$(python3 - << 'EOF'
from infisical_sdk import InfisicalSDKClient
client = InfisicalSDKClient(
    token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    host='http://127.0.0.1:8200'
)
secrets = client.secrets.list_secrets(
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == 'CLOUDFLARE_API_TOKEN':
        print(s.secret_value)
EOF
)

CLOUDFLARE_ACCOUNT_ID=$(python3 - << 'EOF'
from infisical_sdk import InfisicalSDKClient
client = InfisicalSDKClient(
    token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    host='http://127.0.0.1:8200'
)
secrets = client.secrets.list_secrets(
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == 'CLOUDFLARE_ACCOUNT_ID':
        print(s.secret_value)
EOF
)

ZONE_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/json" | python3 -c "import sys,json; [print(z['id']) for z in json.load(sys.stdin)['result'] if z['name']=='zappro.site']")

TUNNEL_ID="aee7a93d-c2e2-4c77-a395-71edc1821402"

# Create DNS record (CNAME to tunnel)
RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"CNAME\",
    \"name\": \"$SUBDOMAIN\",
    \"content\": \"$TUNNEL_ID.cfargotunnel.com\",
    \"proxy\": true
  }")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "DNS record created: ${SUBDOMAIN}.zappro.site"
else
  echo "Error creating DNS record:"
  echo "$RESPONSE"
  exit 1
fi
```

### Step 4: Deploy the App

Deploy your app to Docker/Coolify. The app must implement the OAuth flow:

```javascript
// OAuth callback handler (example for static JS app)
// POST body MUST include client_secret for token exchange

POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=YOUR_GOOGLE_CLIENT_ID
&client_secret=YOUR_GOOGLE_CLIENT_SECRET    // ← REQUIRED
&code=AUTH_CODE
&code_verifier=PKCE_VERIFIER
&redirect_uri=https://SUBDOMAIN.zappro.site/auth/callback
```

**Env vars required in docker-compose:**

```yaml
services:
  your-app:
    environment:
      GOOGLE_CLIENT_ID: '${GOOGLE_CLIENT_ID}' # Infisical: project/GOOGLE_CLIENT_ID
      GOOGLE_CLIENT_SECRET: '${GOOGLE_CLIENT_SECRET}' # Infisical: project/GOOGLE_CLIENT_SECRET
      SERVICE_URL: 'https://yourapp.zappro.site'
```

### Step 5: Test

```bash
# Test subdomain DNS resolution
curl -sfI https://yourapp.zappro.site/

# Test OAuth callback endpoint
curl -sfI https://yourapp.zappro.site/auth/callback

# Expected: HTTP 200 (not "Connection refused" or 521)
```

---

## Method 2: OAuth via Cloudflare Access (V2 — Production Protected)

Use this method for production services requiring enterprise authentication. Cloudflare Zero Trust handles auth **before** the app loads.

### Step 1: Add Subdomain to Terraform

Edit `/srv/ops/terraform/cloudflare/variables.tf` to add the new service:

```hcl
services = {
  # ... existing services ...
  yourapp = {
    url              = "http://10.0.x.x:8080"   # Replace with actual target IP:port
    subdomain        = "yourapp"                 # → yourapp.zappro.site
    http_host_header = null                      # or "container-name.sslip.io"
  }
}
```

### Step 2: Plan Terraform

```bash
cd /srv/ops/terraform/cloudflare
terraform plan -out=tfplan
```

**Review the output** — verify it shows:

- `cloudflare_dns_record.yourapp` creation
- `cloudflare_tunnel_route.yourapp` creation (if using tunnel ingress)
- No destructive changes to existing records

### Step 3: Apply Terraform

```bash
terraform apply tfplan
```

### Step 4: Verify DNS + Tunnel Ingress

```bash
# Check DNS record exists
curl -sfI https://yourapp.zappro.site/

# Expected: HTTP 200/301/302 (not "Connection refused" or 521)
```

### Step 5: Configure Cloudflare Access Application

Create or update `/srv/ops/terraform/cloudflare/access.tf`:

```hcl
resource "cloudflare_access_application" "yourapp" {
  account_id = var.cloudflare_account_id
  name       = "YourApp"
  domain     = "yourapp.zappro.site"
  policy {
    name       = "Allow zappro.site"
    decision   = "allow"
    include {
      email {
        domain = "zappro.site"
      }
    }
  }
}
```

Then apply:

```bash
cd /srv/ops/terraform/cloudflare
terraform apply tfplan
```

### Step 6: Configure Google OAuth via Cloudflare Access Identity Provider

In Cloudflare Zero Trust Dashboard (or via Terraform):

1. **Settings → Identity Providers → Add Google**
2. Enter OAuth Client ID and Secret from Infisical:
   - `GOOGLE_CLIENT_ID` → Infisical: `CLOUDFLARE_GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET` → Infisical: `CLOUDFLARE_GOOGLE_CLIENT_SECRET`

3. **Enable Google as the identity provider for the Access application**

### Step 7: Deploy the App (No OAuth Code in App)

Since Cloudflare Access handles authentication, the app itself does **not** need OAuth code:

```yaml
# docker-compose.yml — NO OAuth env vars needed
services:
  your-app:
    environment:
      # No GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET needed
      SERVICE_URL: 'https://yourapp.zappro.site'
```

The app receives authenticated requests via headers (e.g., `Cf-Access-Jwt-Assertion`).

### Step 8: Test

```bash
# Test subdomain (should redirect to Google login if not authenticated)
curl -sfI https://yourapp.zappro.site/

# Test with access token (if you have one)
curl -sfI https://yourapp.zappro.site/ \
  -H "Cf-Access-Jwt-Assertion: YOUR_TOKEN"
```

---

## Quick Reference: create-subdomain.sh

Reference script for Method 1 (MVP):

```bash
#!/bin/bash
# scripts/create-subdomain.sh
# Usage: create-subdomain.sh <subdomain> <target_url> [http_host_header]

set -e

SUBDOMAIN="${1:-}"
TARGET_URL="${2:-http://localhost:8080}"
HTTP_HOST_HEADER="${3:-}"

# Fetch secrets via Infisical SDK
CLOUDFLARE_TOKEN=$(python3 - << 'EOF'
from infisical_sdk import InfisicalSDKClient
client = InfisicalSDKClient(
    token=open('/srv/ops/secrets/infisical.service-token').read().strip(),
    host='http://127.0.0.1:8200'
)
secrets = client.secrets.list_secrets(
    project_id='e42657ef-98b2-4b9c-9a04-46c093bd6d37',
    environment_slug='dev',
    secret_path='/'
)
for s in secrets.secrets:
    if s.secret_key == 'CLOUDFLARE_API_TOKEN':
        print(s.secret_value)
EOF
)

ZONE_ID=$(curl -s "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/json" | python3 -c \
  "import sys,json; [print(z['id']) for z in json.load(sys.stdin)['result'] if z['name']=='zappro.site']")

TUNNEL_ID="aee7a93d-c2e2-4c77-a395-71edc1821402"

# Create DNS CNAME to tunnel
RESPONSE=$(curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"CNAME\",
    \"name\": \"$SUBDOMAIN\",
    \"content\": \"$TUNNEL_ID.cfargotunnel.com\",
    \"proxy\": true
  }")

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "Created: ${SUBDOMAIN}.zappro.site"
else
  echo "Error: $RESPONSE"
  exit 1
fi
```

---

## Quick Reference: setup-oauth.sh (Reference Only)

This script is for **reference** — OAuth setup is app-specific and should be implemented in the app code.

```bash
#!/bin/bash
# scripts/setup-oauth.sh
# Reference: Configure OAuth for MVP apps (Method 1)

set -e

SUBDOMAIN="${1:-}"

echo "=== OAUTH SETUP FOR ${SUBDOMAIN}.zappro.site ==="
echo ""
echo "1. Go to Google Cloud Console: https://console.cloud.google.com/apis/credentials"
echo "2. Edit your OAuth 2.0 Client ID"
echo "3. Add to Authorized Redirect URIs:"
echo "   https://${SUBDOMAIN}.zappro.site/auth/callback"
echo ""
echo "IMPORTANT: The token exchange POST body must include client_secret:"
echo "   grant_type=authorization_code"
echo "   &client_id=YOUR_CLIENT_ID"
echo "   &client_secret=YOUR_CLIENT_SECRET  <- REQUIRED"
echo "   &code=AUTH_CODE"
echo "   &redirect_uri=https://${SUBDOMAIN}.zappro.site/auth/callback"
echo ""
echo "Env vars needed in app:"
echo "  GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}"
echo "  GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}"
```

---

## Common Issues

### Issue 1: "Connection refused" on subdomain

**Symptoms:**

- `curl -sfI https://SUBDOMAIN.zappro.site/` returns connection refused
- DNS resolves but tunnel not routing

**Diagnosis:**

```bash
# Check if DNS proxy is on
curl -sfI https://SUBDOMAIN.zappro.site/ --connect-timeout 5

# Check tunnel ingress rules
curl -s "https://api.cloudflare.com/client/v4/tunnels/$TUNNEL_ID" \
  -H "Authorization: Bearer $CLOUDFLARE_TOKEN" | jq
```

**Resolution:**

- Method 1: Re-run `create-subdomain.sh` to verify DNS record
- Method 2: Run `terraform apply` to ensure ingress rule exists

---

### Issue 2: "invalid_client" OAuth error

**Symptoms:**

- Google OAuth returns `invalid_client`
- Token exchange fails

**Diagnosis:**

```bash
# Check if client_secret is in token exchange POST body
# Must include client_secret in the POST body (not headers)
```

**Resolution:**

```javascript
// Correct token exchange
POST https://oauth2.googleapis.com/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&client_id=GOOGLE_CLIENT_ID
&client_secret=GOOGLE_CLIENT_SECRET    // ← MUST BE IN BODY
&code=AUTH_CODE
&redirect_uri=https://SUBDOMAIN.zappro.site/auth/callback
```

---

### Issue 3: Terraform state drift

**Symptoms:**

- `terraform plan` shows changes to existing resources
- Subdomain exists in Cloudflare but not in terraform state

**Diagnosis:**

```bash
cd /srv/ops/terraform/cloudflare
terraform refresh
terraform plan
```

**Resolution:**

```bash
# Import existing resource into state
terraform import cloudflare_dns_record.yourapp ZONE_ID/RECORD_ID
```

---

## Related Documentation

- [Cloudflare Terraform Skill](../../.claude/skills/cloudflare-terraform/SKILL.md) — Full Terraform + Cloudflare reference
- [INFISICAL-SDK-PATTERN](./INFISICAL-SDK-PATTERN.md) — How to use Infisical SDK
- [SUBDOMAINS.md](../../docs/GOVERNANCE/SUBDOMAINS.md) — Subdomain registry
- [PORTS.md](../../docs/GOVERNANCE/PORTS.md) — Active ports registry
- [AGENTS.md](../../AGENTS.md) — Monorepo rules and agent system

---

## Changelog

### v1.0 (2026-04-13)

- Initial version with Method 1 (OAuth Direct) and Method 2 (Cloudflare Access)
- Added `create-subdomain.sh` and `setup-oauth.sh` reference scripts
- Quick decision table for method selection
