---
name: cloudflare-tunnel-enterprise
description: Enterprise-grade Cloudflare Tunnel management for homelab — token lifecycle, Terraform IaC, drift detection, and operational runbooks. Replaces cloudflare-terraform skill.
---

# Cloudflare Tunnel Enterprise Skill

## Overview

This skill provides comprehensive, actionable procedures for managing Cloudflare Tunnels in the homelab environment (zappro.site). It covers the full lifecycle: token creation, Terraform-based infrastructure-as-code, drift detection, troubleshooting, and operational runbooks.

**Use this skill when you need to:**

- Add or remove a subdomain/service
- Manage Cloudflare API tokens (create, rotate)
- Detect or fix drift between Terraform state and Cloudflare
- Troubleshoot 1010/502 errors or tunnel daemon issues
- Run operational procedures (health checks, daemon restart)

**Prerequisite:** Source credentials from `.env` before any API/Terraform operation:

```bash
source /srv/monorepo/.env
# Loads: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_ZONE_ID, CLOUDFLARE_TUNNEL_ID
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CLOUDFLARE TUNNEL FLOW                             │
└─────────────────────────────────────────────────────────────────────────────┘

  GitHub/Gitea              Terraform                    Cloudflare API
  ─────────────            ───────────                   ───────────────

  ┌──────────┐             ┌───────────┐                 ┌──────────────────┐
  │  Commit  │────────────▶│ terraform │────────────────▶│  Cloudflare      │
  │  .tf     │             │   plan    │                 │  Zone (DNS)      │
  └──────────┘             └───────────┘                 │  zappro.site     │
                               │                          └──────────────────┘
                               │                                 │
                               ▼                                 ▼
                        ┌───────────┐                   ┌──────────────────┐
                        │ terraform │                   │  Cloudflare      │
                        │  apply    │───────────────────│  Tunnel (cloud-  │
                        └───────────┘                   │  flared daemon) │
                                                         └──────────────────┘
                                                                │
                                                                ▼
                                                        ┌──────────────────┐
                                                        │  Ingress Rules   │
                                                        │  (routing per    │
                                                        │   hostname)      │
                                                        └──────────────────┘
                                                                │
                         LAN Services                          │
                         (10.0.x.x) ◀──────────────────────────┘
                         localhost

┌─────────────────────────────────────────────────────────────────────────────┐
│                              DNS RESOLUTION                                  │
└─────────────────────────────────────────────────────────────────────────────┘

  User browser
       │
       │ https://chat.zappro.site/
       ▼
  Cloudflare DNS (c0cf47bc153a6662f884d0f91e8da7c2)
       │ CNAME → aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com
       ▼
  Cloudflare Edge ───────────────────────────┐
       │                                     │
       ▼                                     ▼
  Tunnel Ingress                      Catchall (*.zappro.site)
  chat.zappro.site                    │
  ────────────────                    │
  │ http://10.0.5.2:8080              │ http_status:404
  │ (httpHostHeader: chat.zappro.site)│
  ▼                                     │
  cloudflared daemon ◀─────────────────┘
  (host: will-zappro-homelab)
```

### Key Identifiers (homelab zappro.site)

| Resource     | Value                                                   |
| ------------ | ------------------------------------------------------- |
| Zone ID      | `c0cf47bc153a6662f884d0f91e8da7c2`                      |
| Account ID   | `1a41f45591a50585050f664fa015d01b`                      |
| Tunnel ID    | `aee7a93d-c2e2-4c77-a395-71edc1821402`                  |
| Tunnel Name  | `will-zappro-homelab`                                   |
| Tunnel CNAME | `aee7a93d-c2e2-4c77-a395-71edc1821402.cfargotunnel.com` |
| Domain       | `zappro.site`                                           |

---

## Reference Files

| File                                | Topic                                   |
| ----------------------------------- | --------------------------------------- |
| `references/token-management.md`    | Token creation, scoping, rotation       |
| `references/terraform-structure.md` | File layout, add/remove service, import |
| `references/drift-detection.md`     | Detect and fix state divergence         |
| `references/troubleshooting.md`     | 1010/502 errors, daemon issues, expiry  |
| `references/runbooks.md`            | Step-by-step operational procedures     |

---

## Quick Reference

### Add Subdomain (API fast path, ~30s)

```bash
source /srv/monorepo/.env

# 1. Create DNS CNAME
curl -s -X POST "https://api.cloudflare.com/client/v4/zones/${CLOUDFLARE_ZONE_ID}/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"SUBDOMAIN","content":"'"${CLOUDFLARE_TUNNEL_ID}"'.cfargotunnel.com","proxied":true}' | jq .success

# 2. Update tunnel ingress
curl -s -X PUT "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${CLOUDFLARE_TUNNEL_ID}/configurations" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ingress":[{"hostname":"SUBDOMAIN.zappro.site","service":"http://TARGET:PORT"},{"hostname":"*.zappro.site","service":"http_status:404"}]}' | jq .success

# 3. Verify
curl -sfI --max-time 10 https://SUBDOMAIN.zappro.site/ | head -1
```

### Add Subdomain (Terraform, production)

```bash
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env
# 1. Edit variables.tf → add to services map
# 2. terraform plan -out=tfplan
# 3. terraform apply tfplan
# 4. Verify + sync to SUBDOMAINS.md
```

### Token Rotation

```bash
# 1. Create new token in Cloudflare Dashboard
# 2. Update .env directly with new values
# 3. Verify: curl -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" ...
# 4. Delete old token from Dashboard
```

### Drift Detection

```bash
cd /srv/ops/terraform/cloudflare
source /srv/monorepo/.env
terraform plan  # any non-empty diff = drift
```

### Tunnel Health

```bash
# Daemon status
systemctl status cloudflared  # or: cloudflared --version

# Daemon logs
journalctl -u cloudflared -n 50 --no-pager

# Tunnel health (Cloudflare API)
curl -s -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/cfd_tunnel/${CLOUDFLARE_TUNNEL_ID}" | jq '.result.status'
```

---

## Current Services Map

| Subdomain | Target URL     | http_host_header     | Access            | Notes        |
| --------- | -------------- | -------------------- | ----------------- | ------------ |
| `api`     | 10.0.1.1:4000  | -                    | Cloudflare Access | LiteLLM      |
| `chat`    | 10.0.5.2:8080  | openwebui-wbmqefx... | Cloudflare Access | OpenWebUI    |
| `coolify` | localhost:8000 | -                    | Cloudflare Access | Coolify      |
| `git`     | localhost:3300 | -                    | Cloudflare Access | Gitea        |
| `hermes`  | localhost:8642 | -                    | Cloudflare Access | Hermes agent |
| `llm`     | 10.0.1.1:4000  | -                    | Cloudflare Access | LiteLLM      |
| `list`    | localhost:4080 | -                    | OAuth native      | no Access    |
| `md`      | localhost:4081 | -                    | OAuth native      | no Access    |
| `monitor` | localhost:3100 | -                    | LAN only          | Grafana      |
| ``     | 10.0.6.2:5678  | -                    | Cloudflare Access |           |
| `painel`  | localhost:4003 | -                    | Cloudflare Access | Painel       |
| `qdrant`  | 10.0.19.5:6333 | -                    | Cloudflare Access | Qdrant       |
| `vault`   | localhost:8200 | -                    | Cloudflare Access | Vault        |

---

## Forbidden Actions

- **Never** delete the tunnel itself (`will-zappro-homelab`)
- **Never** use ports 3000, 4000, 4001, 8000, 8080 for new services
- **Never** expose a port publicly without updating SUBDOMAINS.md + PORTS.md
- **Never** modify tunnel ingress manually in Dashboard (Terraform will overwrite)
- **Never** commit `.tfvars` or raw token values to git
