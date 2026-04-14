# Cloudflare Tunnel API Flow — new-subdomain

Exact curl commands for creating a subdomain via Cloudflare API (fast path).

## Prerequisites

```bash
# Source credentials from .env
export $(grep -v '^#' /srv/monorepo/.env | xargs) 2>/dev/null

# Verify required variables
echo "CLOUDFLARE_API_TOKEN: ${CLOUDFLARE_API_TOKEN:0:10}..."
echo "CF_ZONE_ID: $CF_ZONE_ID"
```

## Constants

| Variable | Value |
|----------|-------|
| ZONE_ID | `${CF_ZONE_ID}` (Infisical: `cloudflare/ZONE_ID`) |
| TUNNEL_ID | `${CF_TUNNEL_ID}` (Infisical: `cloudflare/TUNNEL_ID`) |
| ACCOUNT_ID | `${CF_ACCOUNT_ID}` (Infisical: `cloudflare/ACCOUNT_ID`) |
| BASE_DOMAIN | `zappro.site` |
| TUNNEL_CNAME | `${CF_TUNNEL_ID}.cfargotunnel.com` |

---

## Step 1 — List existing CNAME records

```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=CNAME" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" | jq '.result[] | select(.type == "CNAME") | {name, content, proxied}'
```

**Expected output (no conflict):**
```json
{
  "name": "bot.zappro.site",
  "content": "${CF_TUNNEL_ID}.cfargotunnel.com",
  "proxied": true
}
```

---

## Step 2 — Create DNS CNAME record

```bash
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"CNAME\",
    \"name\": \"${SUBDOMAIN}\",
    \"content\": \"${TUNNEL_CNAME}\",
    \"proxied\": true
  }" | jq '{success: .success, errors: .errors, result: .result}'
```

**Replace `${SUBDOMAIN}` with the subdomain name (e.g., `myapp`).**

**Success response:**
```json
{
  "success": true,
  "errors": [],
  "result": {
    "id": "abc123",
    "name": "myapp.zappro.site",
    "type": "CNAME",
    "content": "${CF_TUNNEL_ID}.cfargotunnel.com",
    "proxied": true
  }
}
```

---

## Step 3 — Get current tunnel configuration

```bash
curl -s -X GET "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq '.result'
```

**Success response:**
```json
{
  "ingress": [
    {"hostname": "*.zappro.site", "service": "http_status:404"}
  ]
}
```

---

## Step 4 — Build and PUT new ingress config

Insert new ingress rule **BEFORE** the catch-all (`*.zappro.site`).

```bash
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"ingress\": [
      {\"hostname\": \"${SUBDOMAIN}.zappro.site\", \"service\": \"${SERVICE_URL}\"},
      {\"hostname\": \"*.zappro.site\", \"service\": \"http_status:404\"}
    ]
  }" | jq '{success: .success, errors: .errors}'
```

**Replace:**
- `${SUBDOMAIN}` — e.g., `myapp`
- `${SERVICE_URL}` — e.g., `http://10.0.5.10:8080`

**Success response:**
```json
{
  "success": true,
  "errors": []
}
```

---

## Step 5 — Verify DNS propagation

```bash
# Check DNS record exists
curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=CNAME&name=${SUBDOMAIN}.zappro.site" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq '.result[0]'
```

---

## Step 6 — Verify tunnel ingress

```bash
# Should return HTTP (not "Connection refused")
curl -sfI --max-time 10 "https://${SUBDOMAIN}.zappro.site/" | head -3

# Or full check
curl -sf --max-time 10 "https://${SUBDOMAIN}.zappro.site/" -o /dev/null -w "HTTP %{http_code}\n"
```

**Expected:** `HTTP 200`, `HTTP 301`, `HTTP 302`, or `HTTP 404` — NOT `Connection refused`

---

## Complete Example

Creating `demo.zappro.site` → `http://10.0.5.50:3000`:

```bash
SUBDOMAIN=demo
SERVICE_URL=http://10.0.5.50:3000
ZONE_ID=${CF_ZONE_ID}
TUNNEL_ID=${CF_TUNNEL_ID}
ACCOUNT_ID=${CF_ACCOUNT_ID}
TUNNEL_CNAME=${CF_TUNNEL_ID}.cfargotunnel.com

# 1. Create DNS
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"type\": \"CNAME\", \"name\": \"${SUBDOMAIN}\", \"content\": \"${TUNNEL_CNAME}\", \"proxied\": true}" | jq .success

# 2. Update tunnel
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"ingress\": [{\"hostname\": \"${SUBDOMAIN}.zappro.site\", \"service\": \"${SERVICE_URL}\"}, {\"hostname\": \"*.zappro.site\", \"service\": \"http_status:404\"}]}" | jq .success

# 3. Verify
curl -sfI --max-time 10 "https://${SUBDOMAIN}.zappro.site/" | head -1
```

---

## Rollback

To remove a subdomain added via API:

```bash
# 1. Delete DNS record
RECORD_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=CNAME&name=${SUBDOMAIN}.zappro.site" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq -r '.result[0].id')

curl -s -X DELETE "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records/${RECORD_ID}" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq .success

# 2. Remove from tunnel (restore original ingress — use cfd_tunnel/configurations endpoint)
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/cfd_tunnel/${TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ingress": [{"hostname": "*.zappro.site", "service": "http_status:404"}]}' | jq .success
```
