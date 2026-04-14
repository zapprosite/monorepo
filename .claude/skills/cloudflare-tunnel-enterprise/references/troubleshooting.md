# Troubleshooting

## Overview

Common error patterns when working with Cloudflare Tunnels, their causes, and fix procedures.

---

## Error 1010: Bad SSL / Authentication Error

### Error Message

```
SSL handshake failed
Error 1010: Bad SSL client certificate
```

### Cause

Cloudflare cannot verify the origin server's SSL certificate, OR the `http_host_header` is incorrect and the origin server is presenting the wrong certificate.

### Diagnosis

```bash
# Test SSL certificate of the origin directly
openssl s_client -connect 10.0.5.2:8080 -servername chat.zappro.site

# Check what certificate the origin presents
curl -kv https://10.0.5.2:8080 --header "Host: chat.zappro.site" 2>&1 | grep -E "subject|issuer|SSL"

# Test via Cloudflare
curl -vI https://chat.zappro.site/ 2>&1 | grep -E "SSL|error|1010"
```

### Fixes

**Fix 1: Verify `http_host_header`**

If the service uses virtual hosting, the `http_host_header` in the ingress rule MUST match what the service expects:

```hcl
# variables.tf
services = {
  chat = {
    url              = "http://10.0.5.2:8080"
    subdomain        = "chat"
    http_host_header = "chat.zappro.site"  # MUST match virtual host
  }
}
```

**Fix 2: Ensure origin SSL certificate is valid**

```bash
# If using self-signed cert, configure cloudflared to skip TLS verification
# (NOT recommended for production)

# Better: Get a valid cert for the subdomain
# Cloudflare Origin CA certificates work well for internal services
```

**Fix 3: Check if service is presenting the correct certificate**

Some services bind to a specific hostname and present different certs. Use the `http_host_header` to ensure the right virtual host is selected on the origin.

---

## Error 502: Bad Gateway

### Error Message

```
502 Bad Gateway
The web server reported a bad gateway error.
```

### Cause

Cloudflare can reach the `hostname` DNS but cannot connect to the `service` URL. The most common reasons:

1. **Service is down** — the target process isn't running
2. **Wrong IP/port** — the target URL is incorrect
3. **Firewall blocking cloudflared** — cloudflared host can't reach target
4. **Service binding to localhost** — service only listens on `127.0.0.1` instead of `0.0.0.0`
5. **Wrong protocol** — service URL uses `https` instead of `http` (or vice versa)

### Diagnosis

```bash
# 1. Check if the service is running
curl -sfI http://10.0.5.2:8080/  # direct to origin
curl -sfI http://localhost:8080/  # on the cloudflared host

# 2. Check cloudflared logs
journalctl -u cloudflared -n 100 --no-pager | grep -E "error|failed|502"

# 3. Verify the tunnel ingress config
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402/configurations" | \
  jq '.result.ingress'

# 4. Check if ingress hostname matches the DNS record
```

### Fixes

**Fix 1: Service is down**

```bash
# Restart the service
systemctl restart <service-name>
# or
docker restart <container-name>
```

**Fix 2: Wrong IP/port**

Update `variables.tf` with correct URL, then `terraform apply`:

```hcl
services = {
  chat = {
    url              = "http://CORRECT_IP:CORRECT_PORT"  # fix this
    subdomain        = "chat"
    http_host_header = "chat.zappro.site"
  }
}
```

**Fix 3: Service binding to localhost only**

If the service only listens on `127.0.0.1`, cloudflared on the same host can't reach it. Options:

1. Change service to bind to `0.0.0.0`
2. Use the loopback address from cloudflared's perspective
3. Use SSH tunnel for remote origins

**Fix 4: Protocol mismatch**

If the service uses HTTPS internally, the `service` URL must use `https://`:

```hcl
services = {
  secure_service = {
    url              = "https://10.0.5.2:8443"  # note https://
    subdomain        = "secure"
    http_host_header = "secure.zappro.site"
  }
}
```

---

## Service Not Responding (Connection Refused)

### Symptoms

```bash
curl: (7) Failed to connect to chat.zappro.site port 443: Connection refused
```

### Causes

1. **DNS not propagated** — CNAME record not yet active
2. **Tunnel daemon down** — cloudflared not running
3. **Ingress rule missing** — subdomain not in tunnel config
4. **Tunnel unhealthy** — tunnel marked as unhealthy in Cloudflare

### Diagnosis

```bash
# 1. Check DNS first
dig +short chat.zappro.site CNAME
# Should return: aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com

# 2. Check tunnel status
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402" | \
  jq '.result.status'
# Status values: healthy, degraded, unhealthy

# 3. Check daemon
systemctl status cloudflared
cloudflared --version

# 4. Check ingress exists
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402/configurations" | \
  jq '.result.ingress[] | select(.hostname | contains("chat"))'
```

### Fixes

**DNS not found:**

```bash
# Create DNS CNAME via API
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/c0cf47bc153a6662f884d0f91e8da7c2/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"chat","content":"aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com","proxied":true}' | jq .success
```

**Daemon down:**

```bash
systemctl restart cloudflared
systemctl status cloudflared
journalctl -u cloudflared -n 20 --no-pager
```

**Ingress missing:** See runbooks for add-subdomain procedure.

---

## Token Expiry Issues

### Symptoms

```json
{"success": false, "errors": [{"code": 10000, "message": "Authorization failed"}]}
```

### Diagnosis

```bash
# Test token validity
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones" | jq '.success'
# true = valid, false = invalid/expired

# Check token expiration
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/user/tokens" | jq '.result[] | {name, expires_on}'
```

### Fix

Follow the Token Rotation procedure in `references/token-management.md`.

---

## Cloudflared Daemon Issues

### Daemon won't start

```bash
# Check logs
journalctl -u cloudflared -n 50 --no-pager

# Common errors:
# - "token expired" → re-authenticate tunnel
# - "bind: address already in use" → another process on same port
# - "permission denied" → permission issue with config file
```

### Re-authenticate tunnel (if token was rotated)

```bash
# If cloudflared was connected with old credentials, re-authenticate:
cloudflared service uninstall
cloudflared service install /etc/cloudflared/config.yml
systemctl restart cloudflared
```

### Tunnel shows as "degraded" or "unhealthy"

```bash
# Check tunnel health via API
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402" | \
  jq '.result'

# Common causes:
# - Origin server unreachable from cloudflared host
# - Firewall rules changed
# - Service restarted on different port

# Restart daemon first (often fixes transient issues)
systemctl restart cloudflared
```

---

## Cloudflare Access Issues

### "Access denied" for valid @zappro.site email

```bash
# Verify Access policy exists
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/access/apps" | \
  jq '.result[] | select(.domain | contains("zappro")) | {name, domain}'
```

**Fix:** Verify email domain is configured in Cloudflare Access Identity providers (Google Workspace).

### OAuth native app asks for login

If an OAuth-native app (bot, list, md) is suddenly requiring Cloudflare Access login:
- The `access.tf` may have accidentally included it
- Check the exclusion filter in `access.tf`:

```hcl
# access.tf — OAuth native apps must be EXCLUDED from Access
access_services = { for k, v in var.services : k => v if k != "bot" && k != "list" && k != "md" }
```

---

## Debugging Checklist

When something isn't working, systematically check:

```
1. DNS Resolution
   dig +short SUBDOMAIN.zappro.site CNAME
   → Should return: TUNNEL_ID.cfargotunnel.com

2. Cloudflare Proxy Status
   curl -sfI https://SUBDOMAIN.zappro.site/
   → If "Connection refused": tunnel/daemon issue
   → If 1010: SSL/hostname issue
   → If 502: service unreachable

3. Tunnel Status
   curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     "https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/cfd_tunnel/TUNNEL_ID" | \
     jq '.result.status'

4. Ingress Rule
   curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
     ".../configurations" | jq '.result.ingress[] | select(.hostname | contains("SUBDOMAIN"))'

5. Service on Origin
   curl -sfI http://ORIGIN_IP:PORT/
   → If fails: service is down or wrong address

6. Daemon Logs
   journalctl -u cloudflared -n 50 --no-pager
```

---

## Emergency Rollback

If a Terraform change causes an outage and needs immediate rollback:

```bash
# 1. Restore previous state
cd /srv/ops/terraform/cloudflare
terraform state pull > tfstate-backup-$(date +%Y%m%d%H%M%S).json

# 2. Revert to previous .tf files (git)
git checkout HEAD~1 -- .

# 3. Apply previous version
terraform apply

# 4. Verify fix
curl -sfI https://AFFECTED_SUBDOMAIN.zappro.site/
```

For immediate DNS-level rollback (if Terraform change propagated incorrectly):

```bash
# Delete the problematic DNS record
RECORD_ID=$(curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records?type=CNAME&name=PROBLEMATIC" | \
  jq -r '.result[0].id')

curl -s -X DELETE \
  "https://api.cloudflare.com/client/v4/zones/ZONE_ID/dns_records/$RECORD_ID" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq .success
```
