---
spec: SPEC-NEXUS-CLOUDFLARE-AGENTS
title: Nexus Cloudflare — 20 Agent Setup
status: active
date: 2026-04-27
author: will
---

# SPEC: Nexus Cloudflare — 20 Agent Setup

## Overview

20 agentes especializados para gerir infraestrutura Cloudflare via Terraform + API,
com fluxos completos: subdomain creation, token management, tunnel health, e auto-deploy.

**Base:** `SPEC-NEXUS-AUTO-DEPLOY` + Cloudflare API docs

## Required API Token Permissions

```
Account: Cloudflare Tunnel - Edit
Zone: DNS - Edit
Account: Access: Apps - Edit (se usar Access policies)
```

## Token Creation (via API)

```bash
# Usando .env global key
curl -X POST "https://api.cloudflare.com/client/v4/user/tokens" \
  -H "X-Auth-Email: $CF_EMAIL" \
  -H "X-Auth-Key: $CF_GLOBAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Nexus Terraform",
    "permissions": {
      "cloudflare_zero_trust": { "cloudflare_zero_trust_tunnel_cloudflared": ["edit"] },
      "zone": { "dns": ["edit"] },
      "account": { "cloudflare_zero_trust": ["edit"] }
    },
    "expires_on": "2027-04-27"
  }'
```

## Agent Matrix (20 Agents)

### deploy (5)

| Agent | Capability |
|-------|-----------|
| `subdomain-creator` | Cria subdomain via Terraform |
| `coolify-deployer` | Deploy via Coolify webhook |
| `health-checker` | Smoke test de subdomain |
| `tunnel-restarter` | Restart cloudflared + verify |
| `token-rotator` | Rotate Cloudflare API token |

### debug (3)

| Agent | Capability |
|-------|-----------|
| `tunnel-health` | Diagnostica tunnel problems |
| `dns-debugger` | DNS propagation / CNAME issues |
| `access-debugger` | Cloudflare Access policy issues |

### monitor (3)

| Agent | Capability |
|-------|-----------|
| `subdomain-monitor` | Monitor all subdomains uptime |
| `token-expiry` | Check token expiration dates |
| `tunnel-metrics` | cloudflared metrics analysis |

### infra (3)

| Agent | Capability |
|-------|-----------|
| `dns-manager` | Manage DNS records via API |
| `access-policy-manager` | Manage Access policies |
| `tunnel-manager` | Cloudflare Tunnel lifecycle |

### docs (3)

| Agent | Capability |
|-------|-----------|
| `subdomain-auditor` | Audit subdomain inventory |
| `port-validator` | Validate PORT.md vs actual |
| `network-mapper` | Map active routes |

### review (3)

| Agent | Capability |
|-------|-----------|
| `terraform-reviewer` | Review Terraform changes |
| `access-reviewer` | Review Access policy correctness |
| `security-reviewer` | Scan for exposed services |

## Rate Limits

- Cloudflare API: **1200 requests / 5 min** (free tier)
- Terraform: sem rate limit (usa API internamente)
- Nexus agents: `sleep 0.05` em loops (20 RPM por agente = 400 RPM total < 1200)

## Files

```
/srv/ops/terraform/cloudflare/
/srv/ops/scripts/
/srv/monorepo/.claude/vibe-kit/agents/deploy/
/srv/monorepo/.claude/vibe-kit/agents/debug/
/srv/monorepo/.claude/vibe-kit/agents/monitor/
/srv/monorepo/.claude/vibe-kit/agents/infra/
/srv/monorepo/.claude/vibe-kit/agents/docs/
/srv/monorepo/.claude/vibe-kit/agents/review/
```
