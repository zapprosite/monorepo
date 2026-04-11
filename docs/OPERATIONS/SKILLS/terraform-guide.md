# Terraform Guide — Homelab Infrastructure as Code

**Date:** 2026-04-11
**Host:** will-zappro
**Location:** `/srv/ops/terraform/cloudflare/`

> **IMPORTANT:** Terraform operations require approval for infrastructure changes. See [GUARDRAILS.md](/srv/ops/ai-governance/GUARDRAILS.md) before making changes.

---

## Quick Reference

### Essential Commands
```bash
cd /srv/ops/terraform/cloudflare

# Validate configuration
terraform validate

# Plan changes (SAFETY: always plan before apply)
terraform plan -out=tfplan

# Apply changes (requires approval)
terraform apply tfplan

# Show current state
terraform show
terraform state list

# Get outputs
terraform output
terraform output -raw setup_env > /tmp/tf_env && source /tmp/tf_env
```

### State Management
- **State file:** `/srv/ops/terraform/cloudflare/terraform.tfstate`
- **State backups:** `/srv/backups/terraform/` (daily snapshots)
- **Provider:** Local backend (no remote state)

---

## 1. Architecture

### Directory Structure
```
/srv/ops/terraform/cloudflare/
├── main.tf              # Tunnel + DNS + ingress rules
├── variables.tf         # Service definitions (services map)
├── data.tf              # Data sources
├── access.tf            # Cloudflare Access policies
├── provider.tf          # Cloudflare provider config
├── outputs.tf           # Output values (tunnel_id, cname, etc)
├── terraform.tfvars     # Secrets (gitignored)
├── terraform.tfstate    # State (gitignored)
└── .terraform/          # Provider plugins (gitignored)
```

### Providers Used
| Provider | Version | Purpose |
|----------|---------|---------|
| cloudflare/cloudflare | ~> 4.0 | DNS, Tunnels, Access |
| hashicorp/local | ~> 2.0 | Local files (setup scripts) |
| hashicorp/random | ~> 3.8 | Tunnel secret generation |

### Resources Managed
- **Cloudflare Zero Trust Tunnels** — Authoritative tunnel configuration
- **DNS CNAME Records** — Subdomain routing
- **Cloudflare Access Applications** — OAuth protection per service
- **Cloudflare Access Policies** — Email-based access rules

---

## 2. Services Map (variables.tf)

The `services` map defines all subdomains and their targets:

```hcl
services = {
  vault = {
    url              = "http://localhost:8200"
    subdomain        = "vault"
    http_host_header = null
  }
  n8n = {
    url              = "http://10.0.6.3:5678"
    subdomain        = "n8n"
    http_host_header = null
  }
  # ... more services
}
```

### Current Services Table
| Subdomain | URL | http_host_header | Access |
|-----------|-----|------------------|--------|
| `vault.zappro.site` | localhost:8200 | — | Email restricted |
| `n8n.zappro.site` | 10.0.6.3:5678 | — | Email restricted |
| `qdrant.zappro.site` | localhost:6333 | — | Email restricted |
| `monitor.zappro.site` | localhost:3100 | — | LAN only |
| `coolify.zappro.site` | localhost:8000 | — | Email restricted |
| `git.zappro.site` | localhost:3300 | — | Email restricted |
| `bot.zappro.site` | localhost:4001 | openclaw-*.sslip.io | **Public (no auth)** |
| `painel.zappro.site` | localhost:4003 | — | Email restricted |
| `api.zappro.site` | localhost:4000 | — | Email restricted |
| `llm.zappro.site` | localhost:4000 | — | Email restricted |
| `chat.zappro.site` | 10.0.5.3:8080 | openwebui-*.sslip.io | Email restricted |
| `web.zappro.site` | localhost:4004 | — | Email restricted |
| `supabase.zappro.site` | localhost:54321 | — | Email restricted |

### Key Variables
| Variable | Default | Description |
|----------|---------|-------------|
| `domain` | `zappro.site` | Base domain |
| `tunnel_name` | `will-zappro-homelab` | Tunnel identifier |
| `allowed_emails` | `[]` | Emails allowed via Access |
| `cloudflare_api_token` | (set in tfvars) | Cloudflare API token |
| `cloudflare_account_id` | (set in tfvars) | Cloudflare Account ID |
| `cloudflare_zone_id` | (set in tfvars) | Zone ID for zappro.site |

---

## 3. terraform.tfvars Pattern

### Never Commit These Values
```hcl
# terraform.tfvars (gitignored)
cloudflare_api_token   = "your_api_token_here"
cloudflare_account_id  = "your_account_id_here"
cloudflare_zone_id      = "c0cf47bc153a6662f884d0f91e8da7c2"
domain                 = "zappro.site"
tunnel_name            = "will-zappro-homelab"
allowed_emails         = ["zappro.ia@gmail.com"]
google_client_id       = ""  # For Access OAuth (manual setup)
google_client_secret    = ""  # For Access OAuth (manual setup)
```

### Getting Values

**Cloudflare API Token:**
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Create token with: Zone → DNS → Edit, Account → Cloudflare Tunnel → Edit
3. Copy token to `terraform.tfvars`

**Cloudflare Account ID:**
- Found in Cloudflare Dashboard URL: `https://dash.cloudflare.com/{ACCOUNT_ID}/...`
- Or via API: `curl -s -H "Authorization: Bearer $TOKEN" https://api.cloudflare.com/client/v4/accounts`

**Zone ID for zappro.site:**
- `c0cf47bc153a6662f884d0f91e8da7c2` (current)

---

## 4. Common Operations

### 4.1 Add a New Subdomain

**Step 1: Edit variables.tf**
```hcl
services = {
  # ... existing services ...
  new_service = {
    url              = "http://10.0.x.x:8080"
    subdomain        = "newservice"        # → newservice.zappro.site
    http_host_header = null               # or "container-name.sslip.io"
  }
}
```

**Step 2: Plan**
```bash
cd /srv/ops/terraform/cloudflare
terraform plan -out=tfplan
```

**Step 3: Review the plan output**

**Step 4: Apply (requires approval)**
```bash
terraform apply tfplan
```

**Step 5: Verify**
```bash
curl -s -o /dev/null -w "%{http_code}" https://newservice.zappro.site/
# Expected: 200, 401, or 404 (not "Connection refused")
```

### 4.2 Change Service URL/Port

Same process as adding a subdomain — edit `variables.tf` and run plan/apply.

**Important:** The tunnel configuration is authoritative. After `terraform apply`, the cloudflared daemon will pick up changes on next restart.

### 4.3 Remove a Subdomain

Remove the service from `services` map in `variables.tf`, then plan/apply.

### 4.4 Update Access Policy

Edit `access.tf` or `allowed_emails` in `variables.tf`:

```hcl
# Add email to allowed list
allowed_emails = ["zappro.ia@gmail.com", "another@example.com"]
```

---

## 5. State Operations

### 5.1 List All Resources in State
```bash
cd /srv/ops/terraform/cloudflare
terraform state list
```

**Output example:**
```
cloudflare_record.tunnel_cname["bot"]
cloudflare_record.tunnel_cname["chat"]
cloudflare_zero_trust_tunnel_cloudflared.homelab
cloudflare_zero_trust_access_application.services["api"]
```

### 5.2 Show Specific Resource
```bash
terraform state show cloudflare_zero_trust_tunnel_cloudflared.homelab
```

### 5.3 Import Existing Resource
```bash
# Import a DNS record
terraform import cloudflare_record.tunnel_cname["name"] \
  zone_id/record_id

# Import a tunnel
terraform import cloudflare_zero_trust_tunnel_cloudflared.homelab \
  account_id/tunnel_id
```

### 5.4 Refresh State (Sync with Remote)
```bash
terraform refresh
terraform plan  # Verify sync
```

---

## 6. Safety Patterns

### Always Use Plan First
```bash
# WRONG: terraform apply (bypasses review)
# RIGHT:
terraform plan -out=tfplan
# Review tfplan output
terraform apply tfplan
```

### Backup Before Apply
```bash
# State is backed up daily to /srv/backups/terraform/
# Manual backup before significant changes:
cp terraform.tfstate terraform.tfstate.backup-$(date +%Y%m%d%H%M%S)
```

### Use -target for Selective Operations
```bash
# Only affect specific resource
terraform plan -target=cloudflare_record.tunnel_cname["n8n"]

# Apply to specific resource
terraform apply -target=cloudflare_record.tunnel_cname["n8n"]
```

### Destroy Pattern (DANGER)
```bash
# Plan destruction first
terraform plan -destroy -out=destroy.tfplan

# Review destruction plan carefully
# Only apply if correct
terraform apply destroy.tfplan
```

---

## 7. Docker and ZFS Resources

### Current State
**This homelab does NOT use Terraform for Docker or ZFS management.**

| Resource | Managed By | Location |
|----------|------------|----------|
| Docker containers | Coolify + docker-compose | `/srv/` |
| ZFS pools/datasets | `zfs` CLI + shell scripts | `/srv/ops/` |
| Docker networks | Coolify | Cloudflare Tunnel only |

### Docker Management
- **Primary:** Coolify UI/CLI at https://coolify.zappro.site
- **Containers:** Managed via Coolify API
- **No Terraform Docker provider** currently configured

### ZFS Management
- **Pool:** `tank` (3.5TB free)
- **CLI:** Direct `zfs` commands
- **Snapshots:** See `zfs-snapshot-and-rollback.md` and `zfs-smart-scrub.md`
- **No Terraform ZFS provider** currently configured

### Adding Docker/ZFS to Terraform (Future)
If you need to add Terraform management for Docker or ZFS:

**Docker:** Add provider
```hcl
terraform {
  required_providers {
    docker = {
      source  = "kreuzwerker/docker"
      version = "~> 3.0"
    }
  }
}
```

**ZFS:** Requires custom provider or external script execution via `local-exec`.

---

## 8. Cloudflare Access (OAuth)

### How Access Works
1. User visits protected subdomain (e.g., `n8n.zappro.site`)
2. Cloudflare redirects to login page
3. User authenticates with Google OAuth
4. Access policy checks email against `allowed_emails`

### Important Limitation
**Google OAuth Identity Provider CANNOT be created via Terraform** with current API token permissions.

Manual setup required:
1. Go to Cloudflare Zero Trust Dashboard → Settings → Authentication → Add provider → Google
2. Configure with credentials from password manager
3. Redirect URL: `https://zappro.cloudflareaccess.com/cdn-cgi/access/callback`

### Manual Resources (Cannot be Terraform-managed)
- `cloudflare_zero_trust_access_identity_provider.google_oauth`
- `cloudflare_zero_trust_access_policy.google_owners` (depends on IdP)

These are commented out in `access.tf` with setup instructions.

---

## 9. Tunnel Lifecycle

### Tunnel is Authoritative
The Cloudflare API (via Terraform) is the **source of truth** for tunnel configuration.

**Flow:**
```
Terraform apply → Cloudflare API updated → cloudflared daemon syncs on restart
```

**NOT this flow:**
```
Edit ~/.cloudflared/config.yml → Daemon running with old config (drift!)
```

### Restart cloudflared After Changes
```bash
# If running as systemd service
sudo systemctl restart cloudflared

# If running manually
# Stop and restart the cloudflared process
```

### Verify Tunnel Status
```bash
# Check tunnel in Cloudflare Dashboard
# Or via API:
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/team tunnels"
```

---

## 10. Troubleshooting

### "Connection refused" on subdomain
1. Service may be offline: `curl http://localhost:PORT`
2. Wrong IP in `services` map (check Docker network IPs)
3. Missing `http_host_header` for services with hostname-based routing

### Terraform state drift
```bash
# Refresh state from Cloudflare
terraform refresh

# Verify with plan
terraform plan
```

### Tunnel offline after reboot
```bash
# Check cloudflared service
sudo systemctl status cloudflared

# Start if stopped
sudo systemctl start cloudflared

# View logs
sudo journalctl -u cloudflared -f
```

### DNS not resolving
1. Wait for propagation (up to 5 minutes)
2. Check Cloudflare Dashboard for record status
3. Verify CNAME points to tunnel CNAME

### Permission denied on apply
API token may lack required permissions:
- Zone → DNS → Edit
- Account → Cloudflare Tunnel → Edit

---

## 11. Reference

### Key Files
| File | Purpose |
|------|---------|
| `/srv/ops/terraform/cloudflare/main.tf` | Tunnel + DNS resources |
| `/srv/ops/terraform/cloudflare/variables.tf` | Service definitions |
| `/srv/ops/terraform/cloudflare/access.tf` | Access policies |
| `/srv/ops/terraform/cloudflare/outputs.tf` | Tunnel outputs |
| `/srv/ops/terraform/cloudflare/terraform.tfstate` | State file |
| `/srv/backups/terraform/` | Daily state backups |
| `~/.cloudflared/config.yml` | Local daemon config (reference only) |

### Related Documentation
| Document | Purpose |
|----------|---------|
| `/srv/monorepo/docs/INFRASTRUCTURE/NETWORK_MAP.md` | Network topology |
| `/srv/ops/ai-governance/PORTS.md` | Port registry |
| `/srv/ops/ai-governance/SUBDOMAINS.md` | Subdomain registry |
| `/srv/monorepo/docs/GOVERNANCE/GUARDRAILS.md` | Operations governance |
| `/srv/monorepo/docs/OPERATIONS/SKILLS/zfs-snapshot-and-rollback.md` | ZFS snapshots |
| `/srv/monorepo/docs/OPERATIONS/SKILLS/cloudflare-terraform/SKILL.md` | Cloudflare Terraform skill |

### External References
- [Terraform Cloudflare Provider Docs](https://registry.terraform.io/providers/cloudflare/cloudflare/latest/docs)
- [Cloudflare Zero Trust Tunnels](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/)
- [Cloudflare Access Policies](https://developers.cloudflare.com/cloudflare-one/identity/users/policy-engine/)

---

**Last updated:** 2026-04-11
**Maintained by:** will
