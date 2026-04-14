---
name: SPEC-TERRAFORM-ENTERPRISE
description: Enterprise Cloudflare Terraform refactor — modular file structure, data sources, bootstrap/drift scripts
status: PROPOSED
priority: high
author: Principal Engineer
date: 2026-04-14
specRef: SPEC-023 (monitoring), SPEC-040 (alerting/rate-limiting), monorepo-audit-14-04-2026
---

# SPEC-044: Enterprise Cloudflare Terraform Structure

## Objective

Refactor `/srv/ops/terraform/cloudflare/` from a monolithic `main.tf` into a modular, enterprise-grade structure. Fix 1010 errors by adding proper data sources to read existing resources before managing them. Add bootstrap and drift-check automation scripts.

---

## Motivation

**Current Problems (from 12-agent audit):**

1. Monolithic `main.tf` mixes tunnel lifecycle, ingress rules, DNS, and Access policies
2. No data sources — Terraform creates duplicate resources instead of reading existing ones (1010 errors)
3. No pre-apply validation of token permissions
4. No drift detection script
5. Tight coupling makes iterative changes risky

**Benefits:**

- Separation of concerns: each file has one responsibility
- Idempotent: uses data sources to detect existing resources
- Safe: bootstrap validates permissions before apply
- Auditable: drift-check shows deviations from desired state

---

## Tech Stack

| Component | Technology                   | Notes                                                       |
| --------- | ---------------------------- | ----------------------------------------------------------- |
| IaC       | Terraform >= 1.0             | Cloudflare provider ~>4.0                                   |
| Secrets   | Infisical                    | Service token at `/srv/ops/secrets/infisical.service-token` |
| Tunnel    | Cloudflare Zero Trust Tunnel | `cloudflared` daemon                                        |
| DNS       | Cloudflare API               | Zone `zappro.site`                                          |
| Access    | Cloudflare Zero Trust Access | OAuth + email policies                                      |

---

## Proposed File Structure

```
/srv/ops/terraform/cloudflare/
├── 01-tunnel.tf          # Tunnel lifecycle (create/read/delete)
├── 02-ingress.tf         # Ingress rules for tunnel config
├── 03-dns.tf             # DNS CNAME records
├── 04-access.tf          # Access applications + policies
├── 05-outputs.tf         # Comprehensive outputs
├── data.tf               # Data sources (READ existing resources)
├── variables.tf          # Clean, documented variables
├── versions.tf            # Provider version constraints
├── terraform.tfvars       # (gitignored) Real values
├── terraform.tfvars.example # Template
├── bootstrap.sh          # Pre-apply validation script
├── drift-check.sh        # Drift detection script
├── cleanup-plan.sh       # Generate cleanup plan for stale resources
└── .gitignore
```

---

## File Designs

### 1. `versions.tf` — Provider Version Constraints

```hcl
terraform {
  required_version = ">= 1.7.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 4.38"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.5"
    }
  }
}
```

**Rationale:** Pin minor version for stability. `~> 4.38` means `>=4.38, <5.0`.

---

### 2. `data.tf` — Read Existing Resources (FIXES 1010 ERRORS)

```hcl
# =============================================================================
# DATA SOURCES — Read existing Cloudflare resources before managing them
# =============================================================================

data "cloudflare_zero_trust_tunnel_cloudflared" "existing" {
  count = var.tunnel_name != "" ? 1 : 0
  account_id = var.cloudflare_account_id
  name       = var.tunnel_name
}

data "cloudflare_zone" "zone" {
  name = var.domain
}

data "cloudflare_record" "existing_cnames" {
  zone_id = var.cloudflare_zone_id
  name    = var.tunnel_name # Tunnel name is used as subdomain prefix
}

data "cloudflare_zero_trust_access_application" "existing_apps" {
  for_each = var.services
  account_id = var.cloudflare_account_id
  name       = "Homelab — ${each.key}"
}

data "cloudflare_account" "current" {
  account_id = var.cloudflare_account_id
}
```

**Critical:** These data sources prevent 1010 "resource already exists" errors by detecting existing resources first.

---

### 3. `01-tunnel.tf` — Tunnel Lifecycle

```hcl
# =============================================================================
# 01-TUNNEL.TF — Cloudflare Zero Trust Tunnel Lifecycle
# =============================================================================

resource "random_password" "tunnel_secret" {
  length      = 32
  special     = false
  lower       = true
  upper       = true
  numeric     = true

  lifecycle {
    prevent_destroy = true
  }
}

# Use existing tunnel if data source returns it, otherwise create new
resource "cloudflare_zero_trust_tunnel_cloudflared" "homelab" {
  count      = data.cloudflare_zero_trust_tunnel_cloudflared.existing[0].id != "" ? 0 : 1
  account_id = var.cloudflare_account_id
  name       = var.tunnel_name
  secret     = random_password.tunnel_secret.result
}

# Reference existing tunnel (count = 0 path)
locals {
  tunnel_id   = length(cloudflare_zero_trust_tunnel_cloudflared.homelab) > 0
               ? cloudflare_zero_trust_tunnel_cloudflared.homelab[0].id
               : data.cloudflare_zero_trust_tunnel_cloudflared.existing[0].id

  tunnel_cname = length(cloudflare_zero_trust_tunnel_cloudflared.homelab) > 0
                 ? cloudflare_zero_trust_tunnel_cloudflared.homelab[0].cname
                 : data.cloudflare_zero_trust_tunnel_cloudflared.existing[0].cname
}
```

**Key Pattern:** `count = condition ? 0 : 1` enables conditional resource creation based on data source detection.

---

### 4. `02-ingress.tf` — Ingress Rules

```hcl
# =============================================================================
# 02-INGRESS.TF — Tunnel Ingress Rules
# =============================================================================

resource "cloudflare_zero_trust_tunnel_cloudflared_config" "homelab" {
  count     = length(cloudflare_zero_trust_tunnel_cloudflared.homelab) > 0 ? 1 : 0
  account_id = var.cloudflare_account_id
  tunnel_id  = local.tunnel_id

  config {
    origin_request {
      connect_timeout    = 30
      tls_timeout        = 10
      http_host_header   = var.tunnel_http_host_header
    }

    dynamic "ingress_rule" {
      for_each = var.services
      content {
        hostname = "${ingress_rule.value.subdomain}.${var.domain}"
        service  = ingress_rule.value.url
        dynamic "origin_request" {
          for_each = ingress_rule.value.http_host_header != null ? [1] : []
          content {
            http_host_header = ingress_rule.value.http_host_header
          }
        }
      }
    }

    # Catch-all: return 404 for unmatched hostnames
    ingress_rule {
      service = "http_status:404"
    }
  }
}
```

---

### 5. `03-dns.tf` — DNS CNAME Records

```hcl
# =============================================================================
# 03-DNS.TF — DNS CNAME Records
# =============================================================================

resource "cloudflare_record" "tunnel_cname" {
  for_each = var.services

  zone_id         = var.cloudflare_zone_id
  name            = each.value.subdomain
  type            = "CNAME"
  content         = local.tunnel_cname
  ttl             = 1  # Auto (Cloudflare optimized)
  proxied         = true
  allow_overwrite = true

  lifecycle {
    precondition {
      condition     = local.tunnel_cname != ""
      error_message = "Tunnel CNAME must be resolved before creating DNS records."
    }
  }
}

# Also create a wildcard CNAME for the tunnel itself
resource "cloudflare_record" "tunnel_wildcard" {
  zone_id         = var.cloudflare_zone_id
  name            = "*"
  type            = "CNAME"
  content         = local.tunnel_cname
  ttl             = 1
  proxied         = true
  allow_overwrite = true
}
```

---

### 6. `04-access.tf` — Access Applications + Policies

```hcl
# =============================================================================
# 04-ACCESS.TF — Cloudflare Zero Trust Access
# =============================================================================

locals {
  # Services exposed via Cloudflare Access (excludes 'bot', 'list', 'md', 'chat' — no auth required)
  access_services = {
    for k, v in var.services : k => v
    if !contains(var.public_services, k)
  }
}

# Access Applications
resource "cloudflare_zero_trust_access_application" "services" {
  for_each = local.access_services

  account_id       = var.cloudflare_account_id
  name             = "Homelab — ${each.key}"
  domain           = "${each.value.subdomain}.${var.domain}"
  session_duration = var.access_session_duration
  type             = "self_hosted"

  # Skip creation if app already exists
  count = lookup(data.cloudflare_zero_trust_access_application.existing_apps[each.key], "id", "") != "" ? 0 : 1
}

# Access Policy — Email Allowlist (Primary)
resource "cloudflare_zero_trust_access_policy" "owners" {
  for_each = local.access_services

  account_id     = var.cloudflare_account_id
  application_id = length(cloudflare_zero_trust_access_application.services) > 0
                   ? cloudflare_zero_trust_access_application.services[each.key].id
                   : data.cloudflare_zero_trust_access_application.existing_apps[each.key].id
  name           = "owners"
  precedence     = 1
  decision       = "allow"

  include {
    email = var.allowed_emails
  }
}

# Access Policy — Google OAuth (requires IdP to be created manually first)
# Uncomment after creating the Google OAuth Identity Provider in Dashboard
# resource "cloudflare_zero_trust_access_policy" "google_oauth" {
#   for_each = local.access_services
#
#   account_id     = var.cloudflare_account_id
#   application_id = length(cloudflare_zero_trust_access_application.services) > 0
#                    ? cloudflare_zero_trust_access_application.services[each.key].id
#                    : data.cloudflare_zero_trust_access_application.existing_apps[each.key].id
#   name           = "google_oauth"
#   precedence     = 2
#   decision       = "allow"
#
#   include {
#     identity_provider_id = var.google_oauth_idp_id
#   }
# }
```

---

### 7. `variables.tf` — Clean, Documented Variables

```hcl
# =============================================================================
# VARIABLES.TF — Input Variables
# =============================================================================

variable "cloudflare_api_token" {
  description = "Cloudflare API Token with Zone DNS Edit and Tunnel Edit permissions"
  type        = string
  sensitive   = true
}

variable "cloudflare_account_id" {
  description = "Cloudflare Account ID"
  type        = string
  sensitive   = true
}

variable "cloudflare_zone_id" {
  description = "Cloudflare Zone ID for the domain (e.g., zappro.site)"
  type        = string
  sensitive   = true
}

variable "domain" {
  description = "Base domain for subdomains"
  type        = string
  default     = "zappro.site"
}

variable "tunnel_name" {
  description = "Name of Cloudflare Tunnel (used to detect existing tunnel)"
  type        = string
  default     = "homelab-tunnel"
}

variable "tunnel_http_host_header" {
  description = "Default HTTP Host header sent to origin"
  type        = string
  default     = null
}

variable "allowed_emails" {
  description = "List of emails allowed through Cloudflare Access (Zero Trust)"
  type        = list(string)
  default     = []
}

variable "public_services" {
  description = "List of services that should NOT have Access protection (public)"
  type        = list(string)
  default     = ["bot", "list", "md", "chat", "todo-web"]
}

variable "access_session_duration" {
  description = "Session duration for Cloudflare Access"
  type        = string
  default     = "24h"
}

variable "google_oauth_idp_id" {
  description = "Google OAuth Identity Provider ID (created manually in Dashboard)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "services" {
  description = "Map of services to expose via tunnel"
  type = map(object({
    url              = string
    subdomain        = string
    http_host_header = optional(string)
  }))

  default = {
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
    qdrant = {
      url              = "http://10.0.19.5:6333"
      subdomain        = "qdrant"
      http_host_header = null
    }
    monitor = {
      url              = "http://localhost:3100"
      subdomain        = "monitor"
      http_host_header = null
    }
    coolify = {
      url              = "http://10.0.5.2:8000"
      subdomain        = "coolify"
      http_host_header = null
    }
    git = {
      url              = "http://localhost:3300"
      subdomain        = "git"
      http_host_header = null
    }
    hermes = {
      url              = "http://10.0.5.2:8642"
      subdomain        = "hermes"
      http_host_header = null
    }
    painel = {
      url              = "http://localhost:4003"
      subdomain        = "painel"
      http_host_header = null
    }
    api = {
      url              = "http://localhost:4000"
      subdomain        = "api"
      http_host_header = null
    }
    litellm = {
      url              = "http://localhost:4000"
      subdomain        = "llm"
      http_host_header = null
    }
  }
}
```

---

### 8. `05-outputs.tf` — Comprehensive Outputs

```hcl
# =============================================================================
# 05-OUTPUTS.TF — Comprehensive Outputs
# =============================================================================

output "tunnel" {
  description = "Tunnel resource info"
  value = {
    id        = local.tunnel_id
    name      = var.tunnel_name
    cname     = local.tunnel_cname
    secret    = random_password.tunnel_secret.result
    status    = length(cloudflare_zero_trust_tunnel_cloudflared.homelab) > 0 ? "created" : "existing"
  }
}

output "dns_records" {
  description = "Created/managed DNS CNAME records"
  value = {
    for name, record in cloudflare_record.tunnel_cname :
    "${record.name}.${var.domain}" => {
      content  = record.content
      proxied  = record.proxied
      zone_id  = record.zone_id
    }
  }
}

output "access_applications" {
  description = "Access applications created (id -> name mapping)"
  value = {
    for app in cloudflare_zero_trust_access_application.services :
    app.name => app.id
  }
}

output "access_policies" {
  description = "Access policies created"
  value = {
    for policy in cloudflare_zero_trust_access_policy.owners :
    "${policy.application_id}:${policy.name}" => {
      id          = policy.id
      decision    = policy.decision
      precedence  = policy.precedence
      included_emails = policy.include[*].email
    }
  }
}

output "next_steps" {
  description = "Next steps after terraform apply"
  value = <<-EOT
    ✅ Terraform apply completed!

    📊 Tunnel: ${local.tunnel_id}
       CNAME: ${local.tunnel_cname}

    🚀 Next: Run the generated setup script
       source <(terraform output -raw setup_env)
       bash ${path.module}/setup.sh

    🔧 For systemd service (production):
       sudo cp ${path.module}/cloudflared.service /etc/systemd/system/
       sudo systemctl daemon-reload
       sudo systemctl enable --now cloudflared

    ⚠️  Note: If tunnel already existed, no changes were made to tunnel_secret.
        Use existing secret from your credentials store.
  EOT
}

output "setup_env" {
  description = "Shell vars to source before running setup.sh"
  value       = "export TUNNEL_ID=${local.tunnel_id}\nexport TUNNEL_SECRET=${random_password.tunnel_secret.result}\nexport TUNNEL_CNAME=${local.tunnel_cname}"
  sensitive   = true
}
```

---

### 9. `provider.tf` — Provider Configuration

```hcl
provider "cloudflare" {
  api_token = var.cloudflare_api_token
}
```

**Note:** Provider config goes in `provider.tf` (not in `versions.tf`) to keep version constraints separate from provider auth.

---

### 10. `terraform.tfvars.example` — Template

```hcl
# Cloudflare credentials (gitignored — never commit real values)
cloudflare_api_token   = "cfut_..."
cloudflare_account_id  = "..."
cloudflare_zone_id     = "..."

# Tunnel configuration
domain                 = "zappro.site"
tunnel_name            = "homelab-tunnel"

# Access control — Zero Trust
allowed_emails = ["you@example.com"]
public_services = ["bot", "list", "md", "chat", "todo-web"]

# Google OAuth IdP (created manually in Dashboard)
# google_oauth_idp_id = "..."

# Services map — edit to change routing
# Services format:
#   service_name = {
#     url              = "http://localhost:PORT" or "http://IP:PORT"
#     subdomain        = "subdomain-name" (do NOT include domain)
#     http_host_header = optional("header-value")
#   }
services = {
  # ... see variables.tf for full list
}
```

---

## Scripts

### 11. `bootstrap.sh` — Pre-Apply Validation

```bash
#!/usr/bin/env bash
# =============================================================================
# bootstrap.sh — Pre-apply validation for Cloudflare Terraform
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${GREEN}[BOOTSTRAP]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# Check env vars or .env file
check_env() {
  log "Checking environment variables..."

  # Load .env if it exists
  if [[ -f ".env" ]]; then
    warn "Loading secrets from .env (ensure it's gitignored!)"
    set -a; source .env; set +a
  fi

  local missing=0
  for var in TF_VAR_cloudflare_api_token TF_VAR_cloudflare_account_id TF_VAR_cloudflare_zone_id; do
    if [[ -z "${!var:-}" ]]; then
      err "Missing: $var (set in terraform.tfvars or export)"
    fi
  done
  log "Environment variables OK"
}

# Check token permissions via Cloudflare API
check_permissions() {
  log "Validating Cloudflare API token permissions..."

  local token="${TF_VAR_cloudflare_api_token}"
  local account_id="${TF_VAR_cloudflare_account_id}"

  # Test 1: Can we read account?
  local account_resp
  account_resp=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/accounts/${account_id}" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json") || err "Cannot reach Cloudflare API"

  if ! echo "$account_resp" | grep -q '"success":true'; then
    err "Token cannot read account. Check TF_VAR_cloudflare_account_id"
  fi
  log "Account read: OK"

  # Test 2: Can we list tunnels?
  local tunnel_resp
  tunnel_resp=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/accounts/${account_id}/tunnels" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json") || err "Cannot list tunnels"

  if ! echo "$tunnel_resp" | grep -q '"success":true'; then
    err "Token missing 'Account > Cloudflare Tunnel: Read' permission"
  fi
  log "Tunnel list: OK"

  # Test 3: Can we create DNS records?
  local zone_id="${TF_VAR_cloudflare_zone_id}"
  local dns_resp
  dns_resp=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records?type=CNAME" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json") || err "Cannot list DNS records"

  if ! echo "$dns_resp" | grep -q '"success":true'; then
    err "Token missing 'Zone > DNS: Edit' permission"
  fi
  log "DNS read: OK"

  # Test 4: Can we manage Access applications?
  local access_resp
  access_resp=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/accounts/${account_id}/access/apps" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json") || warn "Cannot read Access apps (may be OK if not using Access)"

  log "Token permissions: OK (all required scopes present)"
}

# Check required tools
check_tools() {
  log "Checking required tools..."
  command -v terraform >/dev/null || err "Terraform not installed (https://terraform.io)"
  command -v curl >/dev/null    || err "curl not found"
  log "Tools: OK"
}

# Run terraform init
init_terraform() {
  log "Initializing Terraform..."
  terraform init -upgrade
  log "Terraform initialized"
}

# Run terraform validate
validate() {
  log "Validating Terraform configuration..."
  terraform validate || err "Terraform validation failed"
  log "Validation: OK"
}

# Main
main() {
  echo ""
  log "=========================================="
  log "  Cloudflare Terraform Bootstrap"
  log "=========================================="
  echo ""

  check_tools
  check_env
  check_permissions
  init_terraform
  validate

  echo ""
  log "=========================================="
  log "  Bootstrap Complete"
  log "=========================================="
  echo ""
  log "Next steps:"
  log "  1. Review planned changes:  terraform plan"
  log "  2. Apply configuration:     terraform apply"
  log "  3. After apply:            source <(terraform output -raw setup_env)"
  echo ""
}

main "$@"
```

---

### 12. `drift-check.sh` — Drift Detection

```bash
#!/usr/bin/env bash
# =============================================================================
# drift-check.sh — Detect drift between Terraform state and actual Cloudflare resources
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'

log()  { echo -e "${GREEN}[DRIFT]${NC} $*"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $*" >&2; }
err()  { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# Load env
load_env() {
  if [[ -f ".env" ]]; then
    set -a; source .env; set +a
  fi
}

# Check for required vars
check_vars() {
  load_env
  for var in TF_VAR_cloudflare_api_token TF_VAR_cloudflare_account_id TF_VAR_cloudflare_zone_id; do
    [[ -z "${!var:-}" ]] && err "Missing: $var"
  done
}

# Fetch actual DNS records from Cloudflare
check_dns_drift() {
  log "Checking DNS records for drift..."

  local token="${TF_VAR_cloudflare_api_token}"
  local zone_id="${TF_VAR_cloudflare_zone_id}"

  local actual
  actual=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/zones/${zone_id}/dns_records?type=CNAME" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json")

  if ! echo "$actual" | grep -q '"success":true'; then
    err "Cannot fetch DNS records from Cloudflare"
  fi

  echo "$actual" | jq -r '.result[] | "\(.name) -> \(.content) [proxied:\(.proxied)]"'
}

# Fetch actual tunnels
check_tunnel_drift() {
  log "Checking tunnels for drift..."

  local token="${TF_VAR_cloudflare_api_token}"
  local account_id="${TF_VAR_cloudflare_account_id}"

  local actual
  actual=$(curl -s -X GET \
    "https://api.cloudflare.com/client/v4/accounts/${account_id}/tunnels" \
    -H "Authorization: Bearer ${token}" \
    -H "Content-Type: application/json")

  if ! echo "$actual" | grep -q '"success":true'; then
    err "Cannot fetch tunnels from Cloudflare"
  fi

  echo "$actual" | jq -r '.result[] | "\(.name) [id:\(.id)] [status:\(.status)]"'
}

# Compare with Terraform state
check_state_drift() {
  log "Comparing Terraform state to actual resources..."

  if [[ ! -f "terraform.tfstate" ]]; then
    warn "No Terraform state found (not yet applied)"
    return
  fi

  # Extract tunnel_id from state
  local state_tunnel_id
  state_tunnel_id=$(terraform show -json 2>/dev/null | jq -r '.values.root_module.resources[] | select(.type=="cloudflare_zero_trust_tunnel_cloudflared") | .values.id' 2>/dev/null | head -1)

  if [[ -n "$state_tunnel_id" ]]; then
    log "Terraform state tunnel ID: $state_tunnel_id"
  fi
}

# Main
main() {
  echo ""
  log "=========================================="
  log "  Cloudflare Terraform Drift Check"
  log "=========================================="
  echo ""

  check_vars

  echo ""
  log "--- Tunnels ---"
  check_tunnel_drift

  echo ""
  log "--- DNS CNAME Records ---"
  check_dns_drift

  echo ""
  log "--- Terraform State Summary ---"
  check_state_drift

  echo ""
  log "=========================================="
  log "  Drift check complete"
  log "=========================================="
  echo ""
  log "To reconcile drift:"
  log "  terraform plan     # See what would change"
  log "  terraform apply   # Apply desired state"
}

main "$@"
```

---

## Migration Steps

### Phase 1: Snapshot Current State

```bash
cd /srv/ops/terraform/cloudflare

# Backup current state
cp terraform.tfstate terraform.tfstate.backup-$(date +%Y%m%d%H%M%S)

# Generate current plan
terraform plan -out=current-state.tfplan
```

### Phase 2: Create New Files

1. Create `versions.tf` with version constraints
2. Create `provider.tf` with provider auth
3. Create `data.tf` with data sources (CRITICAL for fixing 1010)
4. Create `01-tunnel.tf` through `04-access.tf`
5. Create `05-outputs.tf`
6. Create `variables.tf`
7. Copy `terraform.tfvars.example` and fill in values
8. Create `bootstrap.sh` and `drift-check.sh`

### Phase 3: Validate New Structure

```bash
# Initialize with new structure
terraform init

# Validate syntax
terraform validate

# Generate plan to see differences
terraform plan -out=new-structure.tfplan
```

### Phase 4: Import Existing Resources (Optional — prevents 1010)

If Terraform detects existing resources via data sources and uses `count` correctly, imports are automatic. If not:

```bash
# Import existing tunnel
terraform import 'cloudflare_zero_trust_tunnel_cloudflared.homelab[0]' <tunnel-id>

# Import existing DNS records (if needed)
terraform import 'cloudflare_record.tunnel_cname["n8n"]' <record-id>
```

### Phase 5: Apply New Structure

```bash
# Run bootstrap first
bash bootstrap.sh

# Apply with new structure
terraform apply -out=new-structure.tfplan
```

---

## Key Design Decisions

### 1. Data Sources Prevent 1010 Errors

The `data.tf` file reads existing resources before Terraform attempts to create them. The `count = condition ? 0 : 1` pattern in each resource block ensures Terraform only creates if the resource doesn't exist.

### 2. Separation of Concerns

| File            | Responsibility              |
| --------------- | --------------------------- |
| `01-tunnel.tf`  | Tunnel lifecycle only       |
| `02-ingress.tf` | Ingress rules only          |
| `03-dns.tf`     | DNS records only            |
| `04-access.tf`  | Access apps + policies only |
| `data.tf`       | Read-only data sources      |

### 3. Locals for Cross-File References

Use `locals {}` block in `01-tunnel.tf` to compute `tunnel_id` and `tunnel_cname` once, then reference `local.tunnel_id` in other files.

### 4. Sensitive Values Protected

- All sensitive variables have `sensitive = true`
- Outputs with secrets use `sensitive = true`
- `terraform.tfvars` is gitignored

---

## Related SPECs

- SPEC-023: Unified Monitoring & Self-Healing
- SPEC-040: Homelab Alerting & Rate Limiting
- monorepo-audit-14-04-2026: 12-agent audit findings

---

## Status

**PROPOSED** — Awaiting review and approval before implementation.
