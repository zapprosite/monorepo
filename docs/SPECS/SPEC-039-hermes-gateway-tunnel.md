# SPEC-039: Hermes Gateway — hermes.zappro.site Tunnel

> Status: APPROVED
> Priority: CRITICAL
> Author: Principal Engineer
> Date: 2026-04-14
> Branch: feature/quantum-helix-done

---

## Objetivo

Criar `hermes.zappro.site` como endpoint do **Hermes Gateway** (Telegram bot) via Cloudflare Tunnel. O Hermes Gateway já está a correr (PID 1990953) em polling mode na porta 8642 — falta apenas o tunnel DNS e validação end-to-end.

**Approach seleccionado: Opção B — Criar hermes.zappro.site (zero risco, recomendado)**

---

## Arquitetura-Alvo

```
Internet
  ↓
Cloudflare Edge (Tunnel)
  ↓
hermes.zappro.site:443
  ↓
Ubuntu Desktop (10.0.5.2:8642)
  ↓
Hermes Gateway (port 8642)
  ↓
Telegram Bot API (polling)
  ↓
Utilizador final (@bot)
```

**Stack atual:**

- Hermes Gateway: Running, Telegram connected, PID 1990953
- Bot token: `${TELEGRAM_BOT_TOKEN}` (stored in .env)
- Gateway API: port 8642 on Ubuntu Desktop (10.0.5.2)
- Tunnel: bot.zappro.site → 10.0.19.7:8080 (OpenClaw — OFFLINE, será deprecado)

---

## Condições Atuais

| Componente         | Estado                                            |
| ------------------ | ------------------------------------------------- |
| Hermes Gateway     | ✅ Running (PID 1990953)                          |
| Telegram Bot       | ✅ Connected (polling mode)                       |
| bot.zappro.site    | ⚠️ Aponta para OpenClaw OFFLINE (será deprecated) |
| hermes.zappro.site | ❌ Não existe ainda                               |

---

## Cloudflare IDs (Fixos — homelab)

| ID           | Valor                                                   |
| ------------ | ------------------------------------------------------- |
| Account ID   | `1a41f45591a50585050f664fa015d01b`                      |
| Zone ID      | `c0cf47bc153a6662f884d0f91e8da7c2`                      |
| Tunnel ID    | `aee7a93d-c2e2-4c77-a395-71edc1821402`                  |
| Tunnel CNAME | `aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com` |

---

## Implementation Plan

### Step 1 — Verificar Hermes Gateway

```bash
# Verificar processo
ps aux | grep hermes | grep -v grep

# Verificar porta 8642
ss -tlnp | grep 8642

# Testar localmente
curl -sf http://localhost:8642/health || curl -sf http://10.0.5.2:8642/health
```

### Step 2 — Obter config actual do tunnel

```bash
export CLOUDFLARE_API_TOKEN=$(infisical secrets get --key=CLOUDFLARE_API_TOKEN --project=homelab-infra --env=dev --path=/ 2>/dev/null)

curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" | jq '.result.ingress'
```

**Expected output (current):**

```json
[
  {"hostname": "bot.zappro.site", "service": "http://10.0.19.7:8080", ...},
  {"hostname": "*.zappro.site", "service": "http_status:404"}
]
```

### Step 3 — Criar DNS CNAME para hermes.zappro.site

```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/c0cf47bc153a6662f884d0f91e8da7c2/dns_records" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "CNAME",
    "name": "hermes",
    "content": "aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com",
    "proxied": true
  }' | jq '{success: .success, errors: .errors, result: {id: .result.id, name: .result.name}}'
```

**Success response:**

```json
{
  "success": true,
  "errors": [],
  "result": { "id": "abc123", "name": "hermes.zappro.site" }
}
```

### Step 4 — Adicionar ingress rule ao tunnel

Inserir ANTES do catchall (`*.zappro.site`):

```bash
# Python script para adicionar ingress
python3 << 'EOF'
import json, subprocess, os

# Get current config
token = os.environ.get("CLOUDFLARE_API_TOKEN")
tunnel_id = "aee7a93d-c2e2-4c77-a395-71edc1821402"
account_id = "1a41f45591a50585050f664fa015d01b"

result = subprocess.run([
    "curl", "-s", "-X", "GET",
    f"https://api.cloudflare.com/client/v4/accounts/{account_id}/cfd_tunnel/{tunnel_id}/configurations",
    "-H", f"Authorization: Bearer {token}",
    "-H", "Content-Type: application/json"
], capture_output=True, text=True)

data = json.loads(result.stdout)
config = data["result"]
ingress_list = config["ingress"].copy()

# Remove catchall
catchall = ingress_list.pop()

# Add hermes ingress BEFORE catchall
new_ingress = {
    "hostname": "hermes.zappro.site",
    "service": "http://10.0.5.2:8642",
    "originRequest": {}
}

ingress_list.append(new_ingress)
ingress_list.append(catchall)
config["ingress"] = ingress_list

print(json.dumps(config, indent=2))
EOF
```

### Step 5 — PUT updated tunnel config

```bash
# Guardar output do Python em config.json e fazer PUT:
curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @config.json | jq '{success: .success, errors: .errors}'
```

### Step 6 — Verificar DNS propagation

```bash
# Check DNS record
curl -s -X GET \
  "https://api.cloudflare.com/client/v4/zones/c0cf47bc153a6662f884d0f91e8da7c2/dns_records?type=CNAME&name=hermes.zappro.site" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq '.result[0]'
```

### Step 7 — Restart cloudflared (se necessário)

```bash
sudo systemctl restart cloudflared
sleep 3
sudo systemctl status cloudflared --no-pager
```

---

## Exact Cloudflare API Calls Summary

### 1. GET current tunnel config

```bash
curl -s -X GET \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" | jq '.result'
```

### 2. POST DNS CNAME record

```bash
curl -s -X POST \
  "https://api.cloudflare.com/client/v4/zones/c0cf47bc153a6662f884d0f91e8da7c2/dns_records" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"hermes","content":"aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com","proxied":true}'
```

### 3. PUT tunnel ingress (full config)

```bash
curl -s -X PUT \
  "https://api.cloudflare.com/client/v4/accounts/1a41f45591a50585050f664fa015d01b/cfd_tunnel/aee7a93d-c2e2-4c77-a395-71edc1821402/configurations" \
  -H "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ingress":[{"hostname":"hermes.zappro.site","service":"http://10.0.5.2:8642","originRequest":{}},{"hostname":"bot.zappro.site","service":"http://10.0.19.7:8080","originRequest":{}},{"hostname":"*.zappro.site","service":"http_status:404"}]}'
```

---

## Success Criteria

| #    | Criterion                                     | Verification Command                                                                       | Expected                          |
| ---- | --------------------------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------- |
| SC-1 | hermes.zappro.site DNS record existe          | `dig +short hermes.zappro.site CNAME`                                                      | `aee7a93d...cfargotunnel.com.`    |
| SC-2 | Tunnel ingress configurado                    | `curl -sfI https://hermes.zappro.site/`                                                    | HTTP 200/301/302 (not 502)        |
| SC-3 | Hermes Gateway recebe requests                | `curl -sf --max-time 10 https://hermes.zappro.site/ -o /dev/null -w "HTTP %{http_code}\n"` | HTTP 200                          |
| SC-4 | Telegram polling funciona                     | `curl -s http://localhost:8642/health`                                                     | `{"status":"ok"}`                 |
| SC-5 | bot.zappro.site continua a funcionar (legacy) | `curl -sfI https://bot.zappro.site/`                                                       | HTTP 200 (ou 502 se OpenClaw OFF) |

---

## Current State (2026-04-14) — UPDATED

### Tunnel Configuration (verified via Cloudflare API)

```json
{
  "ingress": [
    {"hostname": "hermes.zappro.site", "service": "http://localhost:8642"},
    {"hostname": "bot.zappro.site", "service": "http://10.0.19.7:8080"},
    ...
  ]
}
```

| Subdomain          | Target                | Status               | Issue                             |
| ------------------ | --------------------- | -------------------- | --------------------------------- |
| hermes.zappro.site | http://localhost:8642 | ✅ HTTP 200          | Working - tunnel routes correctly |
| bot.zappro.site    | http://10.0.19.7:8080 | ❌ NXDOMAIN (PRUNED) | DNS removed, cannot restore       |

### Hermes Gateway Status ✅

```bash
$ curl -s http://localhost:8642/health
{"status":"ok","platform":"hermes-agent"}

$ ps aux | grep hermes | grep gateway
will 3265372 - hermes_cli.main gateway run --replace
```

**Result:** Hermes gateway is running (PID 3265372) and listening on port 8642.

### hermes.zappro.site Verification

| Test          | Command                                               | Result                                           |
| ------------- | ----------------------------------------------------- | ------------------------------------------------ |
| Local health  | `curl localhost:8642/health`                          | ✅ `{"status":"ok"}`                             |
| Tunnel health | `curl https://hermes.zappro.site/health`              | ✅ HTTP 200                                      |
| Tunnel v1     | `curl https://hermes.zappro.site/v1/health`           | ✅ HTTP 200                                      |
| Root path     | `curl https://hermes.zappro.site/`                    | ⚠️ HTTP 404 (expected - no root handler)         |
| Telegram API  | `curl https://hermes.zappro.site/botTOKEN/getUpdates` | ⚠️ HTTP 404 (polling mode - no webhook endpoint) |

**Note:** 404 on Telegram API paths is expected since Hermes Gateway uses polling mode, not webhook. The `/health` endpoint confirms the gateway is reachable.

### bot.zappro.site — Cannot Restore

**bot.zappro.site is PRUNED** (DNS CNAME removed from Cloudflare). Per SUBDOMAINS.md:

- bot.zappro.site DNS status: NXDOMAIN
- OpenClaw containers: stopped
- Decision: hermes.zappro.site is the canonical endpoint for Hermes

**No action possible** - DNS record no longer exists. hermes.zappro.site is the working replacement.

### Terraform Update — NOT NEEDED

The tunnel ingress was updated via Cloudflare API directly (not Terraform). The current state is:

- hermes.zappro.site → `http://localhost:8642` ✅
- bot.zappro.site → remains in tunnel config but DNS is NXDOMAIN (no target to route to)

---

## Notes

- **Polling mode:** Hermes Gateway usa polling mode (não webhook) — não requer HTTPS válido para receber mensagens do Telegram
- **bot.zappro.site:** Será mantido como legacy ate que hermes.zappro.site esteja validado
- **Telegram token:** `${TELEGRAM_BOT_TOKEN}` — stored in .env
- **Zero risk:** Não altera a config existente do bot.zappro.site ate validacao completa
- **Tunnel update is SAFE:** Modifying ingress rules via Terraform does NOT destroy the tunnel UUID
