# Operational Runbooks

## Overview

Step-by-step procedures for common Cloudflare Tunnel operations. Execute these runbooks exactly as written — each step is necessary.

---

## Runbook: Add a New Service

**When:** You need to expose a new internal service via subdomain.

**Time:** ~2-5 minutes (Terraform) or ~30 seconds (API fast path)

### Pre-checks

1. Read `/srv/ops/ai-governance/SUBDOMAINS.md` — verify subdomain is available
2. Read `/srv/ops/ai-governance/PORTS.md` — verify port is available
3. `ss -tlnp | grep :PORT` — verify nothing is using the port on the host
4. `source /srv/monorepo/.env` — load credentials

### Option A: Terraform (production, recommended)

**Step 1:** Edit `variables.tf`

Add entry to `services` map in `/srv/ops/terraform/cloudflare/variables.tf`:

```hcl
services = {
  # ... existing entries ...
  myservice = {
    url              = "http://10.0.x.x:8080"
    subdomain        = "myservice"
    http_host_header = null  # or "myservice.zappro.site" if virtual host
  }
}
```

**Step 2:** Plan

```bash
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env
terraform validate
terraform plan -out=tfplan
# Review output: should show +1 DNS record, +1 ingress rule
```

**Step 3:** Apply

```bash
terraform apply tfplan
```

**Step 4:** Verify

```bash
curl -sfI --max-time 10 https://myservice.zappro.site/ | head -1
# Expected: HTTP/2 200 or 301 or 302
# NOT: "Failed to connect" or 1010
```

**Step 5:** Sync governance

```
SUBDOMAINS.md  → add myservice.zappro.site → http://10.0.x.x:8080
PORTS.md       → add :8080 if new
NETWORK_MAP.md → add service entry
```

### Option B: API Fast Path (MVP / quick test)

**Step 1:** Create DNS CNAME

```bash
source /srv/monorepo/.env
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"myservice","content":"'"${CLOUDFLARE_TUNNEL_ID}"'.cfargotunnel.com","proxied":true}' | jq '{success: .success, id: .result.id}'
```

**Step 2:** Update tunnel ingress

```bash
# Get current ingress config
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${CLOUDFLARE_TUNNEL_ID}/configurations" > /tmp/tunnel_config.json

# Add new ingress via Python
python3 -c "
import json, sys
data = json.load(open('/tmp/tunnel_config.json'))
ingress = data['result']['ingress']
# Remove catchall
catchall = ingress.pop()
# Add new entry
ingress.append({'hostname': 'myservice.zappro.site', 'service': 'http://10.0.x.x:8080', 'originRequest': {}})
ingress.append(catchall)
data['result']['ingress'] = ingress
print(json.dumps(data['result'], indent=2))
" > /tmp/tunnel_config_updated.json

# PUT updated config
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${CLOUDFLARE_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d @/tmp/tunnel_config_updated.json | jq '.success'
```

**Step 3:** Verify

```bash
sleep 5
curl -sfI --max-time 10 https://myservice.zappro.site/ | head -1
```

**Step 4:** Sync to Terraform (within 24 hours)

```bash
cd /srv/ops/terraform/cloudflare
# Edit variables.tf to add the new service
terraform apply  # brings Terraform in sync with API changes
```

---

## Runbook: Remove a Service

**When:** You need to take a subdomain offline.

**Time:** ~2 minutes

### Step 1: Plan

```bash
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env

# Remove the entry from variables.tf services map
# Then plan to see what will be destroyed
terraform plan -out=tfplan
# Expected: -1 DNS record, tunnel ingress rule removed
```

### Step 2: Apply

```bash
terraform apply tfplan
```

### Step 3: Verify removal

```bash
curl -sfI --max-time 10 https://myservice.zappro.site/ | head -1
# Expected: "Failed to connect" (service unreachable) or 404
```

### Step 4: Sync governance docs

Remove from:
- `/srv/ops/ai-governance/SUBDOMAINS.md`
- `/srv/ops/ai-governance/PORTS.md` (if port is now free)
- `/srv/ops/ai-governance/NETWORK_MAP.md`

---

## Runbook: Restart the Tunnel Daemon

**When:** Tunnel is unresponsive, showing degraded health, or daemon logs show errors.

**Time:** ~1 minute

### Step 1: Check current daemon status

```bash
systemctl status cloudflared
cloudflared --version
```

### Step 2: Check recent logs (before restarting)

```bash
journalctl -u cloudflared -n 100 --no-pager > /tmp/cloudflared-logs-before.txt
tail -20 /tmp/cloudflared-logs-before.txt
```

### Step 3: Restart daemon

```bash
sudo systemctl restart cloudflared
```

### Step 4: Wait and verify

```bash
sleep 5
systemctl status cloudflared
# Should show: "active (running)"

# Check tunnel health
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402" | \
  jq '.result.status'
# Should show: "healthy"
```

### Step 5: Verify all subdomains respond

```bash
for sub in chat vault list bot; do
  echo -n "$sub.zappro.site: "
  curl -sfI --max-time 5 https://$sub.zappro.site/ | head -1 || echo "FAIL"
done
```

### Step 6: Check logs after restart

```bash
journalctl -u cloudflared -n 30 --no-pager
# Look for: "connected to Cloudflare edge", "route updated", "health check OK"
```

---

## Runbook: Check Tunnel Health

**When:** Routine health check or investigating issues.

**Time:** ~30 seconds

### Automated health check

```bash
#!/bin/bash
source /srv/monorepo/.env

echo "=== Tunnel Status ==="
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402" | \
  jq '{name: .result.name, status: .result.status, version: .result.version}'

echo ""
echo "=== Daemon Status ==="
systemctl is-active cloudflared

echo ""
echo "=== Ingress Rules ==="
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402/configurations" | \
  jq '.result.ingress | length'

echo ""
echo "=== Sample Subdomain Checks ==="
for sub in chat vault list bot hermes; do
  result=$(curl -sfI --max-time 5 https://$sub.zappro.site/ 2>&1 | head -1)
  if echo "$result" | grep -q "HTTP"; then
    echo "  $sub.zappro.site: OK ($(echo $result | awk '{print $2}'))"
  else
    echo "  $sub.zappro.site: FAIL"
  fi
done
```

---

## Runbook: Token Rotation

**When:** Token is expiring, may have been exposed, or routine rotation.

**Time:** ~10 minutes

### Step 1: Create new token (Dashboard or API)

**Dashboard:**
1. Go to dash.cloudflare.com → My Profile → API Tokens
2. Click **Create Token** → **Create Custom Token**
3. Set permissions as per `references/token-management.md`
4. Set expiration date
5. Copy the new token value (shown only once)

**API:**
```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/user/tokens" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "homelab-terraform-YYYYMMDD",
    "policy": {
      "effect": "allow",
      "resources": {
        "com.cloudflare.api.account.1a41f45591a50585050f664fa015d01b": {},
        "com.cloudflare.api.zone.c0cf47bc153a6662f884d0f91e8da7c2": {}
      },
      "permission_groups": [
        {"id": "c49a2ebc-1b84-4db8-8826-6c843d99a800", "name": "Cloudflare Tunnel", "read": true, "write": true},
        {"id": "0cc7c973-a1f9-4c4f-a0d5-ef0c18b8e1c3", "name": "DNS", "read": true, "write": true}
      ]
    },
    "expires_on": "2028-01-01T00:00:00Z"
  }' | jq .
```

### Step 2: Update .env

Update `CLOUDFLARE_API_TOKEN` in `/srv/monorepo/.env` with the new token value.

### Step 3: Verify new token works

```bash
source /srv/monorepo/.env
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/c0cf47bc153a6662f884d0f91e8da7c2" | jq '.success'
# Expected: true

curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402" | jq '.result.status'
# Expected: healthy
```

### Step 5: Delete old token

**Dashboard:**
1. Go to dash.cloudflare.com → My Profile → API Tokens
2. Find the old token
3. Click **Revoke**

**API:**
```bash
# Get old token ID
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/user/tokens" | jq '.result[] | {name, id, expires_on}'

# Delete old token
curl -s -X DELETE "https://api.cloudflare.com/client/v4/user/tokens/OLD_TOKEN_ID" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq '.success'
```

---

## Runbook: Fix 502 Error on a Subdomain

**When:** A subdomain returns 502 Bad Gateway.

**Time:** ~5 minutes

### Step 1: Check if it's a single subdomain or all

```bash
for sub in chat vault list bot; do
  echo -n "$sub: "
  curl -sfI --max-time 3 https://$sub.zappro.site/ | head -1 || echo "FAIL"
done
```

### Step 2: If single subdomain: check ingress + service

```bash
# Get ingress rule
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  ".../configurations" | jq '.result.ingress[] | select(.hostname | contains("PROBLEMATIC"))'

# Check if service is reachable from cloudflared host
curl -sfI http://ORIGINAL_IP:PORT/ --max-time 5 | head -1
```

### Step 3: Check if service restarted on different port

```bash
# Check if the service is still running
systemctl status <service-name>
docker ps | grep <service>

# Check actual port listening
ss -tlnp | grep SERVICE_PORT
```

### Step 4: Fix

If service URL changed, update `variables.tf` and apply:

```bash
cd /srv/ops/terraform/cloudflare
# Edit variables.tf with correct URL
terraform apply
```

If service is down, restart it:

```bash
systemctl restart <service-name>
# or
docker restart <container-name>
```

### Step 5: Verify

```bash
curl -sfI --max-time 10 https://PROBLEMATIC.zappro.site/ | head -1
```

---

## Runbook: Fix 1010 Error (Bad SSL)

**When:** A subdomain returns Error 1010: Bad SSL client certificate.

**Time:** ~5 minutes

### Step 1: Identify the origin server's certificate

```bash
echo | openssl s_client -connect ORIGIN_IP:PORT -servername SUBDOMAIN.zappro.site 2>/dev/null | \
  openssl x509 -noout -subject -issuer
```

### Step 2: Verify http_host_header is set correctly

Check `variables.tf` for the subdomain:

```hcl
services = {
  problematic = {
    url              = "http://ORIGIN_IP:PORT"
    subdomain        = "problematic"
    http_host_header = "problematic.zappro.site"  # Must match the vhost on origin
  }
}
```

### Step 3: If using Cloudflare Origin CA cert

Cloudflare Origin CA certs only work when traffic is proxied through Cloudflare. Ensure:
- `proxied: true` on the DNS CNAME
- `http_host_header` matches what the certificate is issued for

### Step 4: Apply fix

```bash
cd /srv/ops/terraform/cloudflare
terraform apply
```

### Step 5: Verify

```bash
curl -sfI https://PROBLEMATIC.zappro.site/ | head -1
# Should return 200/301/302, not 1010
```

---

## Runbook: Fix Drift After API Fast Path

**When:** You've used the API fast path (`new-subdomain` skill) and need to sync to Terraform.

**Time:** ~2 minutes

### Step 1: Get current tunnel configuration

```bash
source /srv/monorepo/.env
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${CLOUDFLARE_TUNNEL_ID}/configurations" | \
  jq '.result.ingress'
```

### Step 2: Add the new subdomain to variables.tf

```bash
cd /srv/ops/terraform/cloudflare
# Edit variables.tf and add the new service to the services map
```

### Step 3: Plan

```bash
terraform plan -out=tfplan
# Should show minimal changes (the new service)
```

### Step 4: Apply

```bash
terraform apply tfplan
```

### Step 5: Verify no drift

```bash
terraform plan
# Should show: "No changes. Your infrastructure matches the configuration."
```
