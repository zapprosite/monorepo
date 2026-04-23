# Cloudflared Redundancy Status

**Date:** 2026-04-22
**Tunnel:** will-zappro-homelab (`aee7a93d-c2e2-4c77-a395-71edc1821402`)

## Service Status

| Service | Status | Uptime | PID | Restart Counter |
|---------|--------|--------|-----|-----------------|
| cloudflared@primary | active (running) | 1min 58s | 1492283 | 10 |
| cloudflared@secondary | active (running) | 1min 58s | 1492284 | 3 |

## Process Status

Both cloudflared processes are running as user `will`:
- Primary: PID 1492283 (active)
- Secondary: PID 1492284 (hot standby)

## Health Monitoring

**Cron job:** `/etc/cron.d/cloudflared-healthcheck`
```
*/5 * * * * root /usr/local/bin/cloudflared-healthcheck.sh
```

**Health check behavior:**
- Runs every 5 minutes
- Restarts services if both primary and secondary are down
- Verifies tunnel connectivity via `curl https://painel.zappro.site`

## Tunnel Connectivity

**Test:** `curl -s -I https://painel.zappro.site`
**Result:** HTTP/2 200 - Tunnel is operational

## Protected Subdomains

| Subdomain | Service | Local Endpoint |
|-----------|---------|----------------|
| painel.zappro.site | Claude Code Panel | localhost:4003 |
| chat.zappro.site | OpenWebUI | 10.0.5.3:8080 |
| hermes.zappro.site | Hermes Agent Gateway | localhost:8642 |
| api.zappro.site | LiteLLM API | localhost:4000 |
| llm.zappro.site | LiteLLM Proxy | localhost:4000 |
| pgadmin.zappro.site | pgAdmin | localhost:4050 |
| coolify.zappro.site | Coolify PaaS | localhost:8000 |
| git.zappro.site | Gitea Git Server | localhost:3300 |
| qdrant.zappro.site | Qdrant Vector DB | 10.0.19.5:6333 |

## Architecture

Dual systemd services (`cloudflared@primary` and `cloudflared@secondary`) provide hot standby redundancy. Cloudflare handles QUIC connection failover automatically at the edge.

## Documentation

Failover procedure documented in: `/srv/ops/systemd/CLOUDFLARED_FAILOVER.md`

## Status: OPERATIONAL

Both tunnel instances are active and healthy. Health check cron is configured for automatic failover.