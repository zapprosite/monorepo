# Services Health Summary

**Generated:** 2026-04-23T13:12:00Z (UTC)
**Last Verified:** 2026-04-23
**Owner:** SRE / Platform Engineering

---

## Overview

- **Total Containers Running:** 31+
- **Healthy Containers:** 30
- **Unhealthy Containers:** 1 (historical — resolved)
- **SRE Health Score:** 9/10

---

## Docker Containers Status

| Container | Status | Uptime | Health |
|-----------|--------|--------|--------|
| zappro-ai-gateway | UP | 10h | (healthy) — **previously UNHEALTHY, now resolved** |
| zappro-litellm | UP | 9h | — |
| zappro-litellm-db | UP | 9h | (healthy) |
| qdrant | UP | 11h | (healthy) |
| qdrant-c95x9bgnhpedt0zp7dfsims7 | UP | 3h | (healthy) |
| mcp-qdrant | UP | 2 days | — |
| mcp-ollama-mcp-ollama-1 | UP | 12h | — |
| zappro-redis | UP | 10h | (healthy) |
| coolify-redis | UP | 2 days | (healthy) |
| redis-opencode | UP | 21h | (healthy) |
| prometheus | UP | — | (healthy) |
| node-exporter | UP | — | (healthy) |
| mcp-memory | UP | — | — |
| mcp-coolify-mcp-coolify-1 | UP | — | — |
| mcp-system-mcp-system-1 | UP | — | — |
| mcp-cron-mcp-cron-1 | UP | — | — |
| mcp-monorepo | UP | — | — |
| zappro-gitea | UP | — | — |
| gitea-runner | UP | — | (healthy) |
| coolify-sentinel | UP | — | (healthy) |
| coolify-proxy | UP | — | (healthy) |
| coolify-realtime | UP | — | (healthy) |
| openwebui | UP | — | (healthy) |
| obsidian-web | UP | — | (healthy) |
| static-web | UP | — | (healthy) |
| perplexity-agent | UP | — | (healthy) |
| edge-tts-server | UP | — | — |
| qwen2-vl7b | UP | — | — |
| zappro- | UP | — | — |
| painel-organism | UP | — | — |

### Historical Issues (Resolved)

- **zappro-ai-gateway** — Previously UNHEALTHY (container restart resolved)

---

## Key Service Health Endpoints

| Service | Port | Health Endpoint | Status |
|---------|------|-----------------|--------|
| ai-gateway | 4002 | `http://localhost:4002/health` | OK |
| LiteLLM | 4000 | `http://localhost:4000/health` | 401 (auth expected) |
| Qdrant | 6333 | `http://localhost:6333/readyz` | all shards ready |
| Qdrant Dashboard | 6334 | `http://localhost:6334/dashboard` | localhost only |
| Redis (zappro) | 6379 | `redis-cli PING` → PONG | OK |
| Ollama | 11434 | `http://localhost:11434/api/tags` | OK |
| Trieve | 6435 | `http://localhost:6435/api/v1/health` | — |
| PostgreSQL MCP | 4017 | `http://localhost:4017/health` | OK |
| Grafana | 3000 | `http://localhost:3000/api/health` | — |
| Coolify | 8000 | `http://localhost:8000/api/health` | OK |

---

## MCP Servers (Ports 4011-4017)

| Port | Service | Status |
|------|---------|--------|
| 4011 | mcp-qdrant | UP |
| 4012 | mcp-coolify | UP |
| 4013 | mcp-ollama | UP |
| 4014 | mcp-system | UP |
| 4015 | mcp-cron | UP |
| 4016 | mcp-memory | UP |
| 4017 | mcp-postgres | UP |

---

## ZFS Pool Status

| Pool | Size | Used | Available | Use% | Mount |
|------|------|------|-----------|------|-------|
| tank | 3.5T | 128K | 3.5T | 1% | /tank |

**Datasets:**
- `tank/data` — General data
- `tank/monorepo` — `/srv/monorepo` (1.7G used)
- `tank/qdrant` — Vector DB storage (1.2M used)
- `tank/models` — LLM model cache (6.5G used)
- `tank/backups` — Backup destination (8.4G used)
- `tank/docker-data` — Docker volumes (13G used)

---

## Open Issues


### Low — LiteLLM Auth Errors (Informational)
- **Issue:** LiteLLM logs show `No api key passed in` errors
- **Impact:** Expected behavior for authenticated proxy
- **Action:** No action required unless unauthorized access suspected

---

## Quick Health Check

```bash
# All services
for port in 3001 4002 6333 4017 11434 6435; do
  echo -n "Port $port: "
  curl -sf -m 3 http://localhost:$port/health 2>/dev/null && echo "OK" || echo "FAIL"
done

# Docker containers
docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "(UNHEALTHY|Exit)"

# ZFS pool
sudo zpool status tank

# Redis
redis-cli PING
```

---

## Monitoring

- **Grafana:** https://grafana.zappro.site (via Cloudflare tunnel)
- **Dashboards:** Homelab AI Overview, LiteLLM Metrics, Qdrant Collections
- **Alerts:** Configured via Grafana alerting (circuit breaker, error rate, latency, disk)

---

*Last updated: 2026-04-23*
