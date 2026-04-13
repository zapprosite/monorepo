# Quick API Flow (no Terraform)

## Overview

Criar subdomains diretamente via Cloudflare API, sem Terraform. Usar quando `terraform apply` é lento ou indisponivel.

## IDs Fixos (homelab)

| Variavel | Valor |
|----------|-------|
| `CF_ACCOUNT_ID` | `1a41f45591a50585050f664fa015d01b` |
| `CF_ZONE_ID` | `c0cf47bc153a6662f884d0f91e8da7c2` |
| `CF_TUNNEL_ID` | `aee7a93d-c2e2-4c77-a395-71edc1821402` |
| Tunnel CNAME | `aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com` |

## Env Setup

```bash
export CLOUDFLARE_API_TOKEN="your-token"  # Infisical: cloudflare/API_TOKEN
export CF_ACCOUNT_ID="1a41f45591a50585050f664fa015d01b"
export CF_ZONE_ID="c0cf47bc153a6662f884d0f91e8da7c2"
export CF_TUNNEL_ID="aee7a93d-c2e2-4c77-a395-71edc1821402"
```

---

## 1. GET Tunnel Config

```bash
curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" | jq .
```

**Resposta (truncada):**

```json
{
  "result": {
    "ingress": [
      {
        "hostname": "chat.zappro.site",
        "service": "http://10.0.5.2:8080",
        "originRequest": { "httpHostHeader": "chat.zappro.site" }
      },
      {
        "hostname": "vault.zappro.site",
        "service": "http://localhost:8200",
        "originRequest": {}
      },
      {
        "hostname": "*.cfargotunnel.com",
        "service": "http://localhost:3000",
        "originRequest": {}
      },
      {
        "hostname": "*.zappro.site",
        "service": "http://localhost:3000",
        "originRequest": {}
      }
    ]
  }
}
```

O ultimo entry (`*.zappro.site`) e o **catchall** — nao remover.

---

## 2. Python: Parse e Modificar Ingress

```python
#!/usr/bin/env python3
"""Parse Cloudflare tunnel config, add a new ingress, output to stdout."""
import json
import sys

def add_ingress(config: dict, hostname: str, service: str, http_host_header: str = None) -> dict:
    """
    Add a new ingress entry before the catchall.
    config: parsed JSON from GET /configurations
    hostname: e.g. 'grafana.zappro.site'
    service: e.g. 'http://localhost:3100'
    http_host_header: optional override for Host header
    """
    ingress_list = config["ingress"].copy()

    # Find and remove the catchall (last entry matching *.zappro.site or *.cfargotunnel.com)
    catchall = None
    for i in range(len(ingress_list) - 1, -1, -1):
        h = ingress_list[i].get("hostname", "")
        if h.startswith("*.") and ("zappro.site" in h or "cfargotunnel.com" in h):
            catchall = ingress_list.pop(i)
            break

    if catchall is None:
        raise ValueError("No catchall entry found in ingress list")

    # Build new entry
    new_entry = {
        "hostname": hostname,
        "service": service,
        "originRequest": {}
    }
    if http_host_header:
        new_entry["originRequest"]["httpHostHeader"] = http_host_header

    ingress_list.append(new_entry)
    ingress_list.append(catchall)

    config["ingress"] = ingress_list
    return config


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Add ingress to Cloudflare tunnel config")
    parser.add_argument("--hostname", required=True, help="e.g. grafana.zappro.site")
    parser.add_argument("--service", required=True, help="e.g. http://localhost:3100")
    parser.add_argument("--http-host-header", help="optional httpHostHeader override")
    args = parser.parse_args()

    config = json.load(sys.stdin)
    modified = add_ingress(
        config,
        hostname=args.hostname,
        service=args.service,
        http_host_header=args.http_host_header
    )
    print(json.dumps(modified, indent=2))
```

**Uso:**

```bash
# Guardar GET response, pipe through python, guardar output
curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  | python3 add_ingress.py \
      --hostname "grafana.zappro.site" \
      --service "http://localhost:3100" \
      --http-host-header "grafana.zappro.site" \
  > config_updated.json
```

---

## 3. PUT Tunnel Config

```bash
curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @config_updated.json | jq '.success, .errors'
```

**Sucesso:** `{"success": true, "errors": []}`

---

## 4. POST DNS CNAME Record

```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"CNAME\",
    \"name\": \"grafana\",
    \"content\": \"aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com\",
    \"proxied\": true
  }" | jq '.result.id, .success'
```

---

## 5. Verificar

```bash
curl -sfI https://grafana.zappro.site/
# 200/301/302 = OK
# Connection refused = tunnel ainda nao propagou (esperar 30-60s)
```

---

## Complete Example: grafana.zappro.site

```bash
#!/bin/bash
set -e
SUBDOMAIN="grafana"
TARGET_HOST="localhost"
TARGET_PORT="3100"
HTTP_HOST_HEADER="grafana.zappro.site"

export CLOUDFLARE_API_TOKEN="${CLOUDFLARE_API_TOKEN}"
export CF_ACCOUNT_ID="1a41f45591a50585050f664fa015d01b"
export CF_ZONE_ID="c0cf47bc153a6662f884d0f91e8da7c2"
export CF_TUNNEL_ID="aee7a93d-c2e2-4c77-a395-71edc1821402"

echo "==> Fetching current tunnel config..."
CONFIG=$(curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json")

echo "==> Patching ingress..."
MODIFIED_CONFIG=$(echo "$CONFIG" | python3 /srv/ops/scripts/add_ingress.py \
  --hostname "${SUBDOMAIN}.zappro.site" \
  --service "http://${TARGET_HOST}:${TARGET_PORT}" \
  --http-host-header "${HTTP_HOST_HEADER}")

echo "==> Updating tunnel config..."
RESULT=$(curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/cfd_tunnel/${CF_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "$MODIFIED_CONFIG")
echo "$RESULT" | jq '.success'

echo "==> Creating DNS CNAME..."
DNS_RESULT=$(curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{
    \"type\": \"CNAME\",
    \"name\": \"${SUBDOMAIN}\",
    \"content\": \"aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com\",
    \"proxied\": true
  }")
echo "$DNS_RESULT" | jq '.result.id, .success'

echo "==> Done: https://${SUBDOMAIN}.zappro.site/"
```

---

## Remove a Subdomain

```bash
# 1. GET current config
CONFIG=$(curl -s -X GET ...)

# 2. Python: filter out the target hostname
MODIFIED=$(echo "$CONFIG" | python3 -c "
import json, sys
data = json.load(sys.stdin)
config = data['result']
config['ingress'] = [i for i in config['ingress'] if i.get('hostname') != 'grafana.zappro.site']
print(json.dumps(config, indent=2))
")

# 3. PUT updated config
curl -s -X PUT ... -d "$MODIFIED"

# 4. DELETE DNS record
DNS_ID=$(curl -s -X GET "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records?type=CNAME&name=grafana" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq -r '.result[0].id')

curl -s -X DELETE \
  "https://api.cloudflare.com/client/v4/zones/${CF_ZONE_ID}/dns_records/${DNS_ID}" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq '.success'
```

---

## API Reference Summary

| Operacao | Method | Endpoint |
|----------|--------|----------|
| List tunnels | GET | `/client/v4/accounts/{account_id}/cfd_tunnel` |
| Get tunnel config | GET | `/client/v4/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations` |
| Update tunnel config | PUT | `/client/v4/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations` |
| List DNS records | GET | `/client/v4/zones/{zone_id}/dns_records` |
| Create DNS record | POST | `/client/v4/zones/{zone_id}/dns_records` |
| Delete DNS record | DELETE | `/client/v4/zones/{zone_id}/dns_records/{record_id}` |

## Notes

- Tunnel config propagation: ~30-60s
- DNS propagation: ~60s-5min (Cloudflare propaga rapidamente para proxied records)
- Nao precisa de terraform refresh apos API directa
- Terraform na proxima run vai detectar as mudancas e pedir confirmacao — deixar `terraform apply` corrigir o state se necessario
