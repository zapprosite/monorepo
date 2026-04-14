# Token Management

## Overview

Cloudflare API tokens grant programmatic access to Cloudflare resources. Proper token lifecycle management is critical for security and operational continuity.

---

## Token Types

### Personal API Key (NOT recommended for production)
- Associated with a user account
- Full account permissions unless restricted
- **Use case:** Quick local testing only

### API Token (recommended)
- Scoped to specific permissions
- Can be created for different integration needs
- Supports expiration dates
- **Use case:** Terraform, scripts, CI/CD, production workloads

---

## Creating an API Token

### Via Cloudflare Dashboard

1. Go to **dash.cloudflare.com** → **My Profile** → **API Tokens**
2. Click **Create Token**
3. Choose a template or start from scratch

### Template: "Edit zone DNS" (for tunnel DNS management)

```
Permissions:
  - Zone → DNS → Edit
  - Zone → Zone → Read
  - Account → Cloudflare Tunnel → Edit (if managing tunnels)
```

### Custom Token for Terraform (recommended minimal permissions)

```json
{
  "name": "homelab-terraform",
  "policies": [
    {
      "effect": "allow",
      "resources": {
        "com.cloudflare.api.account.@CF_ACCOUNT_ID@": {}
      },
      "permission_groups": [
        "Cloudflare Tunnel: Edit",
        "Zone: Read",
        "DNS: Edit"
      ]
    }
  ]
}
```

### Via API

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/user/tokens" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "homelab-terraform",
    "policy": {
      "effect": "allow",
      "resources": {
        "com.cloudflare.api.account.1a41f45591a50585050f664fa015d01b": {}
      },
      "permission_groups": [
        {"id": "c49a2ebc-1b84-4db8-8826-6c843d99a800", "name": "Cloudflare Tunnel", "read": true, "write": true}
      ]
    },
    "expires_on": "2027-01-01T00:00:00Z"
  }' | jq .
```

---

## Permission Scoping Guide

### Minimal permissions for tunnel management only

| Permission | Scope | Reason |
|-----------|-------|--------|
| `Cloudflare Tunnel: Edit` | Account | Manage ingress rules |
| `DNS: Edit` | Zone `zappro.site` | Create CNAME records |
| `Zone: Read` | Zone `zappro.site` | Read zone info |

### Permissions NOT needed
- `Account Settings: Read` — not required
- `Workers` — not required
- `Access: Edit` — Access policies managed by Terraform separately

### Zone-level vs Account-level permissions

- **Zone-level** (`com.cloudflare.api.zone.@ZONE_ID@`): DNS records, zone settings
- **Account-level** (`com.cloudflare.api.account.@ACCOUNT_ID@`): Tunnels, Access policies, account settings

For tunnel management, you need BOTH zone-level (DNS) and account-level (tunnel) permissions.

---

## Storing Tokens

### Infisical (canonical source)

```
Path: cloudflare/API_TOKEN
```

### Sync to .env

```bash
# After creating/updating token in Infisical, sync to .env
infisical sync --env=production
# Or use project-specific sync command
```

### Verify token in .env

```bash
source /srv/monorepo/.env
echo "${CLOUDFLARE_API_TOKEN:0:10}"  # Should print cfut_... or similar
```

---

## Token Rotation Procedure

### When to rotate
- Token is approaching expiration (`expires_on`)
- Token may have been exposed (commit to git, leak, etc.)
- After a security incident
- Every 90 days as best practice

### Step-by-step rotation

**Step 1: Create new token**

```bash
# Create via Dashboard or API
curl -s -X POST "https://api.cloudflare.com/client/v4/user/tokens" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "homelab-terraform-rotation-YYYYMMDD",
    "policy": {
      "effect": "allow",
      "resources": {
        "com.cloudflare.api.account.1a41f45591a50585050f664fa015d01b": {},
        "com.cloudflare.api.zone.c0cf47bc153a6662f884d0f91e8da7c2": {}
      },
      "permission_groups": [
        {"id": "c49a2ebc-1b84-4db8-8826-6c843d99a800", "name": "Cloudflare Tunnel", "read": true, "write": true},
        {"id": "0cc7c973-a1f9-4c4f-a0d5-ef0c18b8e1c3", "name": "DNS", "read": true, "write": true},
        {"id": "56c84081-1421-44e2-87eb-1bd61c409c74", "name": "Zone", "read": true, "write": false}
      ]
    },
    "expires_on": "2028-01-01T00:00:00Z"
  }' | jq .
```

**Step 2: Copy the new token value from the response**

The new token value (`value` field) is only shown ONCE. Save it immediately.

**Step 3: Update Infisical**

```
cloudflare/API_TOKEN → paste new token value
```

**Step 4: Sync Infisical to .env**

```bash
source /srv/monorepo/.env  # or run infisical sync
```

**Step 5: Verify new token works**

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/c0cf47bc153a6662f884d0f91e8da7c2" | jq '.success'
# Expected: true
```

**Step 6: Delete old token from Dashboard**

1. Go to dash.cloudflare.com → My Profile → API Tokens
2. Find the old token
3. Click **Revoke**

### Rollback (if new token fails)

If the new token fails after revoking the old one:
1. Recreate a new token (Step 1)
2. Update Infisical with new value (Step 3-4)
3. Verify (Step 5)
4. Proceed with confidence

---

## Token Expiry Monitoring

Set calendar reminders 30 days before token expiration. Check expiration via API:

```bash
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/user/tokens" | jq '.result[] | {name, expires_on}'
```

---

## Verifying Token Permissions

Test that the token has exactly the permissions it needs:

```bash
source /srv/monorepo/.env

# Test: Read zones (should succeed)
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones" | jq '.result[0].name'

# Test: Read tunnel (should succeed)
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel" | jq '.result[0].name'

# Test: Create DNS record (should succeed)
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/c0cf47bc153a6662f884d0f91e8da7c2/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"TXT","name":"test-token-verify","content":"ok","ttl":60}' | jq '.success'
```

---

## Troubleshooting Token Issues

### `Authorization failed` (403)

**Cause:** Token missing required permission
**Fix:** Add the missing permission in Cloudflare Dashboard

### `Token not found` (404)

**Cause:** Token was revoked or ID is wrong
**Fix:** Verify token ID in Dashboard

### `Token expired` (401)

**Cause:** Token past `expires_on` date
**Fix:** Rotate token following the procedure above

### `invalid syntax` (400)

**Cause:** Malformed token value
**Fix:** Re-copy token value (may have whitespace issues)

---

## Security Best Practices

1. **Never commit tokens to git** — .tfvars and .env are gitignored for this reason
2. **Use scoped permissions** — Don't use "Global API Key" for Terraform
3. **Set expiration dates** — Even for internal tokens
4. **Rotate after suspected exposure** — Treat any leak as compromised
5. **Use Infisical as canonical source** — Never hardcode tokens
6. **Verify token before deleting old one** — Always test new token first
