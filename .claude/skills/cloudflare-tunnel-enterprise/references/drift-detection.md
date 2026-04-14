# Drift Detection

## Overview

Drift occurs when the actual state of Cloudflare resources diverges from what Terraform believes exists. This can happen when:
- Someone modifies resources via Cloudflare Dashboard (not Terraform)
- API-based changes (fast path) aren't synced to Terraform
- External tools modify DNS records or tunnel configuration

---

## Detecting Drift

### Method 1: Terraform Plan (primary)

```bash
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env
terraform plan
```

**Any non-empty diff = drift.** Terraform will show:
- `+` additions (resources in Cloudflare but not in Terraform)
- `-` deletions (resources in Terraform but not in Cloudflare)
- `~` modifications (resource properties differ)

### Method 2: Cloudflare API Audit (verify actual state)

Get the actual tunnel ingress configuration:

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402/configurations" | \
  jq '.result.ingress'
```

Get actual DNS records:

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/c0cf47bc153a6662f884d0f91e8da7c2/dns_records?type=CNAME" | \
  jq '.result[] | {name: .name, content: .content, proxied: .proxied}'
```

Compare these outputs against `variables.tf` and `terraform.tfstate`.

---

## Types of Drift

### 1. Ingress Rule Drift

**Symptom:** New subdomain works via API but `terraform plan` shows it as an addition.

**Cause:** Subdomain added via API fast path, not yet in Terraform.

**Fix:** Add the subdomain to `variables.tf` services map, then `terraform apply`.

### 2. DNS Record Drift

**Symptom:** DNS record exists in Cloudflare but not in Terraform state.

**Cause:** Record created via Dashboard or API without Terraform.

**Fix:** Either import the record or delete and recreate via Terraform.

### 3. Tunnel Config Drift

**Symptom:** `terraform plan` shows tunnel ingress rules are different.

**Cause:** Manual edits to tunnel config in Cloudflare Dashboard.

**Fix:**
```bash
# Option A: Import current Cloudflare state into Terraform
# (if Cloudflare state is correct, Terraform config is wrong)
# Update variables.tf to match actual Cloudflare state, then apply

# Option B: Overwrite Cloudflare to match Terraform
# (if Terraform state is correct, Cloudflare was manually changed)
terraform apply  # Terraform will correct Cloudflare
```

### 4. Access Policy Drift

**Symptom:** Access application exists in Cloudflare but Terraform shows it shouldn't exist.

**Cause:** Manual creation in Dashboard or Terraform not managing that app.

**Fix:** Add to Terraform config or explicitly exclude from management.

---

## Fixing Drift

### Scenario: API fast path used, need to sync to Terraform

**This is the most common drift scenario.**

```bash
# 1. Get current tunnel config
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402/configurations" | \
  jq '.result.ingress'
```

**2. Identify the new ingress entries** that were added via API.

**3. Update `variables.tf`** to include the new service(s):

```hcl
services = {
  # ... existing ...
  new_service = {
    url              = "http://10.0.x.x:8080"
    subdomain        = "newservice"
    http_host_header = null
  }
}
```

**4. Plan and apply:**

```bash
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env
terraform plan -out=tfplan
# Verify plan shows minimal changes (should be in sync now)
terraform apply tfplan
```

### Scenario: Cloudflare was manually modified, Terraform is source of truth

```bash
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env
terraform apply
# Terraform will overwrite Cloudflare to match .tf files
```

### Scenario: Unknown drift, need to investigate

```bash
# 1. Refresh Terraform state
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env
terraform refresh

# 2. Compare state with current Cloudflare reality
terraform plan  # shows the diff

# 3. If diff is unexpected:
#    - Check git log: git log --oneline -10 (who changed what)
#    - Check with team if changes were intentional
```

---

## Preventing Drift

### Rule: Single source of truth

| Method | When to use | Becomes source of truth? |
|--------|-------------|--------------------------|
| Terraform | Production changes | Always (after apply) |
| API fast path | MVP / quick tests | Only after Terraform sync |
| Dashboard | NEVER for tunnel/dns | Never |

### After using API fast path

Always sync to Terraform within 24 hours:
1. Add to `variables.tf`
2. Run `terraform apply`
3. Verify with `terraform plan` (should show 0 diff)

### State refresh before planning

```bash
# Always do this before terraform plan if you suspect drift
terraform refresh
terraform plan
```

---

## Drift Detection as Part of Monitoring

### Automated drift check (add to cron or health check)

```bash
#!/bin/bash
# drift-check.sh — Run regularly to detect drift
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env

# Refresh state from Cloudflare
terraform refresh

# Get plan output (exit code 0 = no drift, non-zero = drift exists)
PLAN_OUTPUT=$(terraform plan -out=/dev/null 2>&1)
DRIFT_COUNT=$(echo "$PLAN_OUTPUT" | grep -c "^[~+-]" || true)

if [ "$DRIFT_COUNT" -gt 0 ]; then
  echo "DRIFT DETECTED: $DRIFT_COUNT changes"
  echo "$PLAN_OUTPUT"
  # Send alert (to email, Slack, etc.)
fi
```

---

## Common Drift Scenarios and Fixes

| Scenario | Cause | Fix |
|----------|-------|-----|
| New subdomain added via API | `new-subdomain` skill used without Terraform sync | Add to `variables.tf` + `terraform apply` |
| DNS record deleted manually | Someone deleted via Dashboard | `terraform apply` recreates it |
| Tunnel ingress modified | Manual Dashboard edit | `terraform apply` restores correct config |
| Access policy missing | Created via Dashboard | Import to Terraform or delete and recreate via TF |
| Terraform shows stale resources | Resources deleted outside TF | `terraform apply` removes them from state |

---

## Terraform Show Command

Useful for inspecting current Terraform state:

```bash
# Show current state of a resource
terraform show

# Show state of specific resource
terraform state list | grep dns
terraform state show cloudflare_record.this["chat"]

# Show all resources in state
terraform state list
```
