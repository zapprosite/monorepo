---
name: new-subdomain
description: Create new subdomain in Cloudflare tunnel via API (fast path) for zappro.site homelab
type: skill
---

# new-subdomain Skill

## Trigger
`/new-subdomain <name> <service-url>` or when user says "create subdomain X pointing to Y"

## When to Use
- Creating new subdomain quickly (no terraform apply wait)
- MVP deployments, quick tests
- When you need the subdomain live in < 60 seconds

## vs Terraform Flow
| | new-subdomain (API) | cloudflare-terraform |
|-|--------------------|--------------------|
| Speed | ~30s | ~2-5min |
| State sync | Manual (update variables.tf after) | Automatic |
| Use for | MVP / quick | Production |

## Prerequisites

1. **Check subdomain available** — Read `/srv/ops/ai-governance/SUBDOMAINS.md`
2. **Check port available** — Read `/srv/ops/ai-governance/PORTS.md` + verify with `ss -tlnp | grep :PORT`
3. **Cloudflare credentials** — Source from `.env` at project root:
   - `CLOUDFLARE_API_TOKEN`
   - `CF_ZONE_ID`
   - `CF_TUNNEL_ID`
   - `CF_ACCOUNT_ID`

## Key Values (homelab zappro.site)

| Key | Value |
|-----|-------|
| Zone ID | `${CF_ZONE_ID}` (Infisical: `cloudflare/ZONE_ID`) |
| Tunnel ID | `${CF_TUNNEL_ID}` (Infisical: `cloudflare/TUNNEL_ID`) |
| Account ID | `${CF_ACCOUNT_ID}` (Infisical: `cloudflare/ACCOUNT_ID`) |
| Tunnel CNAME | `${CF_TUNNEL_ID}.cfargotunnel.com` |

## Process (7 steps)

### Step 1: Check existing DNS records

```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" | jq '.result[] | select(.type == "CNAME") | {name, content}'
```

Verify subdomain NOT already in use.

### Step 2: Create CNAME DNS record

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CNAME",
    "name": "<subdomain>",
    "content": "${CF_TUNNEL_ID}.cfargotunnel.com",
    "proxied": true
  }' | jq '{success: .success, record: .result}'
```

### Step 3: Get current tunnel config

```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" | jq '.result'
```

### Step 4: Build new ingress config

Add new ingress rule **before** the catch-all (`*.zappro.site`):

```json
{
  "hostname": "<subdomain>.zappro.site",
  "service": "<service-url>"
}
```

Example new ingress (insert before catch-all):
```json
[
  {"hostname": "newapp.zappro.site", "service": "http://10.0.5.10:8080"},
  {"hostname": "*.zappro.site", "service": "http_status:404"}
]
```

### Step 5: PUT updated tunnel config

```bash
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "ingress": [
      {"hostname": "<subdomain>.zappro.site", "service": "<service-url>"},
      {"hostname": "*.zappro.site", "service": "http_status:404"}
    ]
  }' | jq '{success: .success}'
```

### Step 6: Verify

```bash
curl -sfI --max-time 10 https://<subdomain>.zappro.site/
# Expected: 200, 301, 302, or 404 (not "Connection refused")
```

### Step 7: State sync (manual after API fast path)

After subdomain is live, sync state:

1. **Update variables.tf** — Add entry to `services` map in `/srv/ops/terraform/cloudflare/variables.tf`
2. **Run terraform** — `cd /srv/ops/terraform/cloudflare && terraform plan && terraform apply`
3. **Update SUBDOMAINS.md** — Add entry to `/srv/ops/ai-governance/SUBDOMAINS.md`
4. **Update PORTS.md** — If new port, add to `/srv/ops/ai-governance/PORTS.md`
5. **Update NETWORK_MAP.md** — Add service to network map

## Example Usage

```
/new-subdomain myapp http://10.0.5.10:8080
```

Creates `myapp.zappro.site` pointing to `http://10.0.5.10:8080`.

## Error Handling

| Error | Cause | Fix |
|-------|-------|-----|
| `dns_record exists` | Subdomain already taken | Choose different name or remove existing |
| `tunnel not found` | Wrong tunnel ID | Verify tunnel ID in Cloudflare dashboard |
| `origin not reachable` | Service URL wrong | Check service is running and reachable from cloudflared host |
| `cf与服务` | Auth failure | Refresh CLOUDFLARE_API_TOKEN from Infisical |

## Forbidden Actions

- DO NOT use this for production-grade changes (use cloudflare-terraform skill instead)
- DO NOT delete existing ingress rules
- DO NOT modify tunnel name or type
- DO NOT add Cloudflare Access policies via this skill (use terraform)

## State Sync Checklist

After using this fast path, ALWAYS sync to Terraform:

- [ ] Add to `variables.tf` `services` map
- [ ] Run `terraform apply`
- [ ] Update SUBDOMAINS.md
- [ ] Update PORTS.md (if new port)
- [ ] Update NETWORK_MAP.md

## References

- Full API flow: `references/api-flow.md`
- Cloudflare Terraform skill: `.claude/skills/cloudflare-terraform/SKILL.md`
- Subdomains governance: `/srv/ops/ai-governance/SUBDOMAINS.md`
