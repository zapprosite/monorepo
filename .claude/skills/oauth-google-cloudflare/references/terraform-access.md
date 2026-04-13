# Terraform — Cloudflare Access Configuration

## Existing Pattern in `/srv/ops/terraform/cloudflare/access.tf`

The existing `access.tf` uses a **single resource for all services** with a `for_each`:

```hcl
locals {
  # Services exposed via Cloudflare Access (excludes 'bot', 'list', and 'md' — no auth required)
  access_services = { for k, v in var.services : k => v if k != "bot" && k != "list" && k != "md" }
}

resource "cloudflare_zero_trust_access_application" "services" {
  for_each = local.access_services

  account_id       = var.cloudflare_account_id
  name             = "Homelab — ${each.key}"
  domain           = "${each.value.subdomain}.${var.domain}"
  session_duration = "24h"
  type             = "self_hosted"
}

resource "cloudflare_zero_trust_access_policy" "owners" {
  for_each = local.access_services

  account_id     = var.cloudflare_account_id
  application_id = cloudflare_zero_trust_access_application.services[each.key].id
  name           = "owners"
  precedence     = 1
  decision       = "allow"

  include {
    email = var.allowed_emails
  }
}
```

---

## Adding a New Service

### Step 1: Add to `variables.tf`

```hcl
services = {
  # ... existing ...
  myapp = {
    url              = "http://10.0.x.x:8080"
    subdomain        = "myapp"        # → myapp.zappro.site
    http_host_header = null          # or "container-name.sslip.io"
  }
}
```

### Step 2: Apply

```bash
cd /srv/ops/terraform/cloudflare
terraform plan -out=tfplan
terraform apply tfplan
```

The new service will automatically get Access protection via the `for_each`.

---

## Email Allowlist

The current policy uses `var.allowed_emails` which is a list of permitted email domains/addresses.

To restrict to specific users:

```hcl
# In terraform.tfvars
allowed_emails = ["user@zappro.site", "admin@zappro.site"]
```

Or allow entire domain:

```hcl
# In access.tf — allow any email from domain
include {
  email {
    domain = "zappro.site"
  }
}
```

---

## Google Identity Provider (Manual Setup)

The Google IdP **cannot be created via Terraform** with the current API token permissions. It must be set up manually:

### Manual Steps:

1. Go to: https://one.dash.cloudflare.com/
2. Settings → Authentication → Add new identity provider → Google
3. Enter credentials from Google Cloud Console:
   - **Client ID**
   - **Client Secret**
4. The redirect URL is pre-filled: `https://CLOUDFLARE_TEAM_DOMAIN/cdn-cgi/access/callback`

### Terraform (commented — for reference only)

```hcl
# resource "cloudflare_zero_trust_access_identity_provider" "google_oauth" {
#   account_id = var.cloudflare_account_id
#   name       = "Google OAuth"
#   type       = "google"
#   config {
#     client_id     = var.google_client_id
#     client_secret = var.google_client_secret
#   }
# }
```

---

## Excluding Services from Access

To exclude a service from Cloudflare Access (e.g., for OAuth-native apps):

```hcl
# In access.tf
locals {
  access_services = { for k, v in var.services : k => v if k != "bot" && k != "list" && k != "md" }
}
```

Add more exclusions as needed.

---

## Session Duration

Default is `24h`. Adjust in the application resource:

```hcl
resource "cloudflare_zero_trust_access_application" "services" {
  # ...
  session_duration = "24h"  # Options: "12h", "24h", "168h", "720h"
}
```

---

## Testing Access Policy

```bash
# Test from external network (should redirect to Google)
curl -sfI https://myapp.zappro.site/

# Test from allowed email (should pass through)
curl -sfI -H "Cf-Access-Jwt-Assertion: test" https://myapp.zappro.site/
```

---

## Troubleshooting

### "Access denied" for valid users
- Check `allowed_emails` in terraform.tfvars
- Verify user email is from allowed domain

### IdP not showing in login options
- Ensure Google IdP was added in Cloudflare Zero Trust Dashboard
- Verify Client ID/Secret are correct

### JWT validation fails
- Check that `aud` (audience) claim matches your app domain
- Verify public key fetch URL is correct
