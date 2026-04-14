# Terraform Structure

## Overview

Cloudflare infrastructure is managed as code using Terraform. State is stored locally (gitignored) and the Terraform files live in `/srv/ops/terraform/cloudflare/`.

---

## File Organization

```
/srv/ops/terraform/cloudflare/
├── main.tf           # Cloudflare Tunnel + DNS records
├── variables.tf      # Service definitions (services map)
├── data.tf           # Data sources (zone info)
├── access.tf         # Cloudflare Access policies
├── provider.tf       # Cloudflare provider configuration
├── outputs.tf        # Output values (DNS IDs, tunnel info)
├── terraform.tfvars  # Secret values (gitignored — NOT committed)
├── terraform.tfstate # State file (gitignored — local only)
└── terraform.lock.hcl  # Provider lock file
```

### File Purposes

| File | Purpose |
|------|---------|
| `main.tf` | Tunnel resource, DNS CNAME records, ingress configuration |
| `variables.tf` | `services` map — single source of truth for all subdomains |
| `data.tf` | Lookup zone and account data |
| `access.tf` | Cloudflare Access application + policy resources |
| `provider.tf` | Cloudflare provider + required providers |
| `outputs.tf` | Useful output values (subdomain → record ID mappings) |
| `terraform.tfvars` | Sensitive values: API token, zone ID, account ID |

---

## How to Add a New Subdomain/Service

### Step 1: Edit `variables.tf`

Add an entry to the `services` map:

```hcl
services = {
  # ... existing entries ...
  new_service = {
    url              = "http://10.0.x.x:8080"
    subdomain        = "newservice"        # → newservice.zappro.site
    http_host_header = null               # or "container-name.sslip.io"
  }
}
```

### Step 2: Source credentials

```bash
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env
```

### Step 3: Plan

```bash
terraform plan -out=tfplan
# Review the output carefully — it shows exactly what will be created
```

### Step 4: Apply

```bash
terraform apply tfplan
```

### Step 5: Verify

```bash
curl -sfI https://newservice.zappro.site/
# Expected: 200, 301, 302 (NOT "Connection refused")
```

### Step 6: Sync governance docs

After subdomain is live, update:
- `/srv/ops/ai-governance/SUBDOMAINS.md` — add subdomain entry
- `/srv/ops/ai-governance/PORTS.md` — add port if new
- `/srv/ops/ai-governance/NETWORK_MAP.md` — add service

---

## How to Remove a Subdomain/Service

### Step 1: Edit `variables.tf`

Remove the entry from the `services` map (or comment it out).

### Step 2: Plan

```bash
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env
terraform plan -out=tfplan
# Verify the plan shows: -1 DNS record, tunnel ingress change
```

### Step 3: Apply

```bash
terraform apply tfplan
```

### Step 4: Verify removal

```bash
curl -sfI https://old-service.zappro.site/
# Expected: "Connection refused" or 404
```

### Step 5: Sync governance docs

Remove from:
- `/srv/ops/ai-governance/SUBDOMAINS.md`
- `/srv/ops/ai-governance/PORTS.md` (if port now free)
- `/srv/ops/ai-governance/NETWORK_MAP.md`

---

## How to Import Existing Resources

Use `terraform import` to bring resources created outside Terraform into state management.

### Import a DNS record

```bash
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env

# Get the DNS record ID from Cloudflare API
RECORD_ID=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/c0cf47bc153a6662f884d0f91e8da7c2/dns_records?type=CNAME&name=existing" | \
  jq -r '.result[0].id')

# Import to Terraform state
terraform import 'cloudflare_record.this["existing"]' "c0cf47bc153a6662f884d0f91e8da7c2/${RECORD_ID}"
```

### Import tunnel configuration

```bash
terraform import 'cloudflare_tunnel.this' "aee7a93d-c2e2-4c77-a395-71edc1821402"
```

### Import Access application

```bash
# Get the app ID from Cloudflare API
APP_ID=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/access/apps" | \
  jq -r '.result[] | select(.name == "chat") | .id')

terraform import 'cloudflare_access_application.chat' "1a41f45591a50585050f664fa015d01b/${APP_ID}"
```

### After import

1. Run `terraform plan` — there should be NO diff after import
2. If there IS diff, the imported resource may have drifted from config
3. Either update the resource in Cloudflare to match config, or update config to match reality

---

## Terraform Workflow

### Standard workflow

```bash
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env

# 1. Validate syntax
terraform validate

# 2. Plan (creates diff)
terraform plan -out=tfplan

# 3. Review plan output (always do this before applying)

# 4. Apply
terraform apply tfplan

# 5. Verify
curl -sfI https://service.zappro.site/
```

### State management

- **Local state only** — `terraform.tfstate` stays on the host
- **No remote backend** — For homelab scale, local state is sufficient
- **State is gitignored** — Never commit state
- **State backup** — `terraform.tfstate.backup` is created on each apply

### State refresh (rarely needed)

```bash
terraform refresh  # Syncs state with actual Cloudflare resources
terraform plan     # Then check for drift
```

---

## Variables Reference

### `services` map (in `variables.tf`)

```hcl
variable "services" {
  type = map(object({
    url              = string
    subdomain        = string
    http_host_header = optional(string)
  }))
  default = {
    # example entry
    chat = {
      url              = "http://10.0.5.2:8080"
      subdomain        = "chat"
      http_host_header = "chat.zappro.site"
    }
  }
}
```

### When `http_host_header` is needed

Set `http_host_header` when the target service does virtual host routing (uses the Host header to route requests):

- Grafana at `localhost:3100` → needs `http_host_header = "grafana.zappro.site"`
- Services behind nginx reverse proxy → likely needs it
- Services that bind to a specific hostname → needs it

### When `http_host_header` can be `null`

Set `http_host_header = null` when:
- Service routes purely by path or port
- Service doesn't care about Host header

---

## Outputs Reference

After `terraform apply`, useful output values:

```bash
terraform output
```

Example outputs:
```
tunnel_id = "aee7a93d-c2e2-4c77-a395-71edc1821402"
tunnel_cname = "aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com"
dns_record_ids = {
  "chat" = "abc123def456"
  "vault" = "ghi789jkl012"
}
```

---

## Common Errors

### "Resource already exists"

```bash
# Import the existing resource first
terraform import 'cloudflare_record.this["subdomain"]' "ZONE_ID/RECORD_ID"
```

### "Resource not found"

The resource may have been deleted outside Terraform. Run `terraform plan` to see what's missing.

### "Drift detected"

See `references/drift-detection.md` for fix procedure.

---

## Terraform Apply Speed

- `terraform plan`: ~10-30 seconds
- `terraform apply`: ~30-90 seconds (Cloudflare API rate limiting)
- For fast MVP deployments: use API-based `new-subdomain` skill (30 seconds) then sync to Terraform
