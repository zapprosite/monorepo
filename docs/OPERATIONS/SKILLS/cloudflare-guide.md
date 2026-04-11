# Cloudflare Operations Guide

**Host:** will-zappro homelab
**Updated:** 2026-04-11
**Scope:** Cloudflare API v4, DNS, Tunnels, Access, Workers

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Cloudflare API v4](#2-cloudflare-api-v4)
3. [DNS Records Management](#3-dns-records-management)
4. [Cloudflare Tunnel (cloudflared)](#4-cloudflare-tunnel-cloudflared)
5. [Zero Trust Access Policies](#5-zero-trust-access-policies)
6. [Workers and Pages](#6-workers-and-pages)
7. [Terraform Integration](#7-terraform-integration)
8. [Troubleshooting](#8-troubleshooting)
9. [Reference](#9-reference)

---

## 1. Architecture Overview

### Current Topology

```
Internet
    │
    ▼
Cloudflare Edge (GRU — Brazil)
    │
    ▼
Cloudflare Zero Trust Tunnel (cloudflared daemon)
    │  Tunnel ID: aee7a93d-c2e2-4c77-a395-71edc1821402
    │  Name: will-zappro-homelab
    │
    ▼
Host: will-zappro (cloudflared on host network)
    │
    ├── :80/:443/:8080 → Traefik (coolify-proxy)
    └── localhost services (LiteLLM, Qdrant, Gitea, etc.)
```

### Active Subdomains

| Subdomain | Target | Access Policy |
|-----------|--------|---------------|
| `bot.zappro.site` | localhost:4001 | **Public** (no auth) |
| `chat.zappro.site` | localhost:8080 (Coolify) | Google OAuth |
| `coolify.zappro.site` | localhost:8000 | Google OAuth |
| `git.zappro.site` | localhost:3300 | Google OAuth |
| `llm.zappro.site` | localhost:4000 | Google OAuth |
| `api.zappro.site` | localhost:4000 | Google OAuth |
| `monitor.zappro.site` | localhost:3100 | LAN only |
| `n8n.zappro.site` | 10.0.6.3:5678 | Google OAuth |
| `painel.zappro.site` | localhost:4003 | Google OAuth |
| `qdrant.zappro.site` | localhost:6333 | Google OAuth |
| `vault.zappro.site` | localhost:8200 | Google OAuth |

### Key Files

| File | Purpose |
|------|---------|
| `/srv/ops/terraform/cloudflare/` | Terraform configuration (authoritative) |
| `~/.cloudflared/config.yml` | Local reference (may be stale) |
| `/srv/ops/ai-governance/SUBDOMAINS.md` | Subdomain registry |
| `/srv/ops/ai-governance/NETWORK_MAP.md` | Network topology |

---

## 2. Cloudflare API v4

### Authentication

Cloudflare API v4 requires a Bearer token. NEVER hardcode tokens.

```bash
# Using environment variable
export CLOUDFLARE_API_TOKEN="your_api_token_here"

# Verify token
curl -X GET "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json"
```

### Base URL

```
https://api.cloudflare.com/client/v4
```

### Common Endpoints

#### User & Account

```bash
# Get account details
curl -X GET "https://api.cloudflare.com/client/v4/accounts" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"

# Get account ID (needed for many operations)
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq '.result[] | {name, id}'
```

#### Zones (Domains)

```bash
# List all zones
curl -s -X GET "https://api.cloudflare.com/client/v4/zones" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq '.result[] | {name, id, status}'

# Get zone by name
curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=zappro.site" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq '.result[0]'
```

### Python Example

```python
#!/usr/bin/env python3
"""Cloudflare API v4 Python client"""

import os
import requests

class CloudflareAPI:
    BASE_URL = "https://api.cloudflare.com/client/v4"

    def __init__(self, api_token: str = None):
        self.token = api_token or os.environ.get("CLOUDFLARE_API_TOKEN")
        if not self.token:
            raise ValueError("CLOUDFLARE_API_TOKEN not set")
        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }

    def _request(self, method: str, endpoint: str, **kwargs):
        """Make authenticated API request"""
        url = f"{self.BASE_URL}{endpoint}"
        resp = requests.request(method, url, headers=self.headers, **kwargs)
        resp.raise_for_status()
        return resp.json()

    def get_zones(self):
        """List all zones"""
        return self._request("GET", "/zones")

    def get_zone_id(self, domain: str) -> str:
        """Get zone ID for domain"""
        result = self._request("GET", f"/zones?name={domain}")
        return result["result"][0]["id"]

    def list_dns_records(self, zone_id: str):
        """List all DNS records in zone"""
        return self._request("GET", f"/zones/{zone_id}/dns_records")

    def create_dns_record(self, zone_id: str, data: dict):
        """Create DNS record"""
        return self._request("POST", f"/zones/{zone_id}/dns_records", json=data)

    def update_dns_record(self, zone_id: str, record_id: str, data: dict):
        """Update DNS record"""
        return self._request("PUT", f"/zones/{zone_id}/dns_records/{record_id}", json=data)

    def delete_dns_record(self, zone_id: str, record_id: str):
        """Delete DNS record"""
        return self._request("DELETE", f"/zones/{zone_id}/dns_records/{record_id}")

    # === Zero Trust ===

    def list_access_applications(self, account_id: str):
        """List Zero Trust access applications"""
        return self._request("GET", f"/accounts/{account_id}/access/apps")

    def create_access_application(self, account_id: str, data: dict):
        """Create Zero Trust access application"""
        return self._request("POST", f"/accounts/{account_id}/access/apps", json=data)

    # === Tunnels ===

    def list_tunnels(self, account_id: str):
        """List Cloudflare tunnels"""
        return self._request("GET", f"/accounts/{account_id}/tunnels")

    def get_tunnel(self, account_id: str, tunnel_id: str):
        """Get tunnel details"""
        return self._request("GET", f"/accounts/{account_id}/tunnels/{tunnel_id}")


if __name__ == "__main__":
    cf = CloudflareAPI()

    # List zones
    zones = cf.get_zones()
    for zone in zones["result"]:
        print(f"{zone['name']}: {zone['id']}")
```

### curl vs Terraform

| Operation | curl | Terraform |
|-----------|------|-----------|
| DNS records | Manual | `cloudflare_record` resource |
| Tunnel config | Manual | `cloudflare_zero_trust_tunnel_cloudflared_config` |
| Access policies | Manual | `cloudflare_access_application` |
| Workers | Manual | `cloudflare_worker_script` |

**This homelab uses Terraform as authoritative** for tunnel and DNS. Do NOT edit Cloudflare resources manually — Terraform will overwrite.

---

## 3. DNS Records Management

### Via Cloudflare API

```bash
# Get zone ID
ZONE_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones?name=zappro.site" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq -r '.result[0].id')

# List all DNS records
curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq '.result[] | {name, type, content, id}'

# Create A record
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "A",
    "name": "example",
    "content": "192.168.1.1",
    "ttl": 1,
    "proxied": false
  }' | jq

# Create CNAME record (for tunnels)
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CNAME",
    "name": "bot",
    "content": "aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com",
    "ttl": 1,
    "proxied": true
  }' | jq

# Delete record
curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/RECORD_ID" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

### DNS Record Types Used

| Type | Usage | Example |
|------|-------|---------|
| CNAME | Tunnel routing | `bot.zappro.site` → `aee7a93d...cfargotunnel.com` |
| A | Direct IP | Rarely used (tunnels preferred) |
| TXT | Verification | DKIM, SPF, domain verification |

### Terraform DNS Pattern

```hcl
# variables.tf
variable "services" {
  type = map(object({
    subdomain = string
    # ... other fields
  }))
}

# main.tf
resource "cloudflare_record" "tunnel_cname" {
  for_each = var.services

  zone_id = var.cloudflare_zone_id
  name    = each.value.subdomain
  type    = "CNAME"
  content = "${var.tunnel_id}.cfargotunnel.com"
  proxied = true
}
```

---

## 4. Cloudflare Tunnel (cloudflared)

### Architecture

```
Cloudflare Edge
    │
    ▼ QUIC (port 7844) outbound from home
cloudflared daemon (host network)
    │
    ▼
localhost services
```

### How It Works

1. cloudflared creates outbound-only connections to Cloudflare Edge
2. No inbound ports required on home network
3. Traffic flows: User → Cloudflare → cloudflared QUIC → local service
4. Credentials stored in `~/.cloudflared/{tunnel-id}.json`

### cloudflared Service (systemd)

```bash
# Check status
sudo systemctl status cloudflared

# View logs
journalctl -u cloudflared --no-pager -n 50

# Restart (after Terraform changes)
sudo systemctl restart cloudflared
```

### Ingress Rules

cloudflared matches incoming requests by hostname:

```
bot.zappro.site    → http://localhost:4001
chat.zappro.site   → http://localhost:8080
vault.zappro.site  → http://localhost:8200
...
catch-all          → http_status:404
```

### Adding a New Subdomain

**Step 1: Edit Terraform variables**

```bash
cd /srv/ops/terraform/cloudflare
```

Edit `variables.tf`:

```hcl
services = {
  # ... existing entries ...
  new_service = {
    url              = "http://10.0.x.x:8080"  # or localhost:port
    subdomain        = "newservice"              # → newservice.zappro.site
    http_host_header = null                      # or "container.sslip.io" if needed
  }
}
```

**Step 2: Plan and Apply**

```bash
terraform plan -out=tfplan
terraform apply tfplan
```

**Step 3: Restart cloudflared**

```bash
sudo systemctl restart cloudflared
```

**Step 4: Verify**

```bash
curl -sfI https://newservice.zappro.site
# Expected: 2xx, 3xx, or 401 (not "Connection refused")
```

### http_host_header

Required when the backend service does virtual host routing (checks Host header):

```hcl
services = {
  openclaw = {
    url              = "http://localhost:80"
    http_host_header = "openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io"
    subdomain        = "bot"
  }
}
```

### Tunnel Credentials

```
~/.cloudflared/
├── config.yml              # Local reference (may be stale)
└── {tunnel-id}.json        # Credentials file ( sensitive)
```

**Never commit credentials to git.**

---

## 5. Zero Trust Access Policies

Cloudflare Access protects services with Google OAuth.

### How It Works

1. User visits protected subdomain (e.g., `vault.zappro.site`)
2. Cloudflare redirects to Google OAuth
3. User authenticates with permitted email
4. Cloudflare issues session token
5. Request proxied to backend

### Access Policy Structure

```
cloudflare_zero_trust_access_application
    └── cloudflare_zero_trust_access_policy
            └── include { email domain = "zappro.site" }
            └── exclude { ... }
            └── require { ... }
```

### Terraform Pattern

```hcl
# access.tf

variable "google_client_id" {}
variable "google_client_secret" {}

# Identity provider (already configured in Dashboard)
# Terraform cannot manage Identity Providers - use Dashboard

# Access Application
resource "cloudflare_access_application" "vault" {
  account_id = var.cloudflare_account_id
  name       = "Vault"
  domain     = "vault.zappro.site"
  type       = "self-hosted"

  # Google OAuth
  oidc_client_id     = var.google_client_id
  oidc_client_secret = var.google_client_secret
}

# Access Policy - Allow zappro.site emails
resource "cloudflare_access_policy" "vault_owners" {
  application_id = cloudflare_access_application.vault.id
  account_id     = var.cloudflare_account_id
  name           = "Allow zappro.site"
  decision       = "allow"

  include {
    email {
      domain = "zappro.site"
    }
  }

  # Or specific emails:
  # include {
  #   email {
  #     email = "user@zappro.site"
  #   }
  # }
}
```

### Public Access (No Auth)

`bot.zappro.site` has NO Access policy — it's public:

```hcl
# bot.zappro.site - public
services = {
  bot = {
    url              = "http://localhost:4001"
    subdomain        = "bot"
    http_host_header = "openclaw-qgtzrmi6771lt8l7x8rqx72f.191.17.50.123.sslip.io"
    access_policy    = "public"  # Custom: no Access app created
  }
}
```

### Checking Access Policy via API

```bash
# Get access applications
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/access/apps" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | \
  jq '.result[] | {name, domain}'
```

---

## 6. Workers and Pages

### Workers (Serverless)

Workers are not currently used in this homelab. To deploy a Worker:

```bash
# Login to Wrangler (Cloudflare Workers CLI)
npx wrangler login

# Create new worker
npx wrangler init my-worker

# Deploy
cd my-worker && npx wrangler deploy
```

### Wrangler Configuration

```toml
# wrangler.toml
name = "my-worker"
main = "src/index.ts"
compatibility_date = "2026-04-11"

# Environment variables
[vars]
ENV = "production"
```

### Pages (Static Sites)

Pages are not currently used in this homelab.

---

## 7. Terraform Integration

### Directory Structure

```
/srv/ops/terraform/cloudflare/
├── main.tf          # Tunnel + DNS records
├── variables.tf     # Service definitions
├── data.tf          # Data sources
├── access.tf        # Zero Trust Access
├── provider.tf      # Cloudflare provider
├── outputs.tf       # Output values
├── terraform.tfvars # Secrets (gitignored)
└── terraform.tfstate # State (local, gitignored)
```

### Provider Configuration

```hcl
# provider.tf
terraform {
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.0"
    }
  }
}

provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
```

### Vault TFvars

```bash
# terraform.tfvars (gitignored)
cloudflare_api_token    = "from_infisical"
cloudflare_account_id   = "from_infisical"
cloudflare_zone_id      = "from_infisical"
google_client_id        = "from_dashboard"
google_client_secret    = "from_dashboard"
tunnel_id              = "aee7a93d-c2e2-4c77-a395-71edc1821402"
tunnel_name             = "will-zappro-homelab"
domain                  = "zappro.site"
```

### Common Commands

```bash
cd /srv/ops/terraform/cloudflare

# Validate configuration
terraform validate

# See planned changes
terraform plan -out=tfplan

# Apply changes (updates Cloudflare API)
terraform apply tfplan

# Destroy (CAUTION - removes from Cloudflare)
terraform destroy

# Output values
terraform output

# Refresh state
terraform refresh
```

### Terraform State

State is stored locally:

```
terraform.tfstate        # Current state
terraform.tfstate.backup  # Previous state
```

**Never commit state to git.**

---

## 8. Troubleshooting

### "Connection refused" on subdomain

```bash
# 1. Check cloudflared is running
sudo systemctl status cloudflared

# 2. Check tunnel is active
curl -sfI https://bot.zappro.site

# 3. Verify DNS
dig +short bot.zappro.site

# 4. Check cloudflared logs
journalctl -u cloudflared --no-pager -n 20 | grep -i error

# 5. Restart cloudflared
sudo systemctl restart cloudflared
```

### DNS not resolving

```bash
# Flush DNS cache (macOS)
sudo dscacheutil -flushcache
sudo killall -HUP mDNSResponder

# Check DNS propagation
dig +trace bot.zappro.site
```

### Terraform drift

```bash
# See differences from actual Cloudflare state
cd /srv/ops/terraform/cloudflare
terraform plan

# If drift detected, apply to sync
terraform apply
```

### 401 Unauthorized on protected site

1. Verify Access policy exists in Cloudflare Dashboard
2. Check you're using permitted email domain
3. Clear Cloudflare cookies and retry

### cloudflared not starting

```bash
# Check credentials file
ls -la ~/.cloudflared/

# Verify credentials valid
cloudflared tunnel list

# Manual tunnel test
cloudflared tunnel run --token="${TUNNEL_TOKEN}"
```

---

## 9. Reference

### Environment Variables

```bash
# Required
export CLOUDFLARE_API_TOKEN="token_from_dashboard"

# Optional (if using Infisical)
export INFISICAL_TOKEN="service_token_from_infisical"
```

### Key URLs

| Resource | URL |
|----------|-----|
| Cloudflare Dashboard | https://dash.cloudflare.com |
| API Docs | https://developers.cloudflare.com/api/ |
| Tunnel Docs | https://developers.cloudflare.com/cloudflare-one/networks/connectors/ |
| Zero Trust Docs | https://developers.cloudflare.com/cloudflare-one/ |

### API Token Permissions

Required scopes for this homelab:

| Scope | For |
|-------|-----|
| `Zone:Read` | List zones |
| `DNS:Edit` | Manage DNS records |
| `Account:Read` | List tunnels |
| `Access:Edit` | Manage Access policies |
| `Workers:Edit` | Deploy Workers |

### Subdomain Verification

```bash
# Quick check all subdomains
for site in bot chat coolify git llm api monitor n8n painel qdrant vault; do
  code=$(curl -sf -o /dev/null -w "%{http_code}" --max-time 5 https://${site}.zappro.site)
  echo "${site}.zappro.site: $code"
done
```

Expected: 200, 301, 302, 401, or 404 (not "Connection refused")

### Related Documentation

| Document | Location |
|----------|----------|
| Network Map | `docs/INFRASTRUCTURE/NETWORK_MAP.md` |
| Subdomains | `docs/INFRASTRUCTURE/SUBDOMAINS.md` |
| Cloudflare Terraform Skill | `.claude/skills/cloudflare-terraform/SKILL.md` |
| Pinned Services | `docs/GOVERNANCE/PINNED-SERVICES.md` |

---

**Last updated:** 2026-04-11
**Maintainer:** will-zappro
