---
version: 1.0
author: will-zappro
date: 2026-04-12
---

# Duplicate Services Rule

**Version:** 1.0 | **Date:** 2026-04-12
**Purpose:** Prevent port conflicts and uncontrolled service restarts
**Audience:** Any LLM or automated system before deploying new services

---

## Rule: No Duplicate Services

Port conflicts are BLOCKED by governance. Before adding a new service, you MUST:

1. Check `ss -tlnp | grep :PORT` to verify the port is free
2. Verify no existing container uses the same port
3. Consult this document for reserved ports
4. New services must use ports **4002–4099** for development

**This rule supersedes any "just deploy it and see" approach.**

---

## Auto-Heal Whitelist

The docker-autoheal container (`willfarrell/autoheal`) monitors containers with label `autoheal=true`. The following services have their restart policy configured accordingly.

### Services That CAN Restart Automatically

| Service | Container | Auto-Restart | Reason |
|---------|-----------|--------------|--------|
| OpenWebUI | `openwebui` | YES | User-facing, non-critical |
| OpenClaw Bot | `openclaw-qgtzrmi6771lt8l7x8rqx72f` | YES | Voice pipeline, self-healing capable |
| wav2vec2 STT | `zappro-wav2vec2` | YES | Local STT, stateless |
| Kokoro TTS | `zappro-kokoro` | YES | TTS, stateless |
| LiteLLM Proxy | `zappro-litellm` | YES | GPU routing, stateless |
| TTS Bridge | `zappro-tts-bridge` | YES | Voice filter, stateless |
| Redis | `zappro-redis` | YES | Cache, persistent volume |
| Gitea | `gitea` | YES | Git server, persistent volume |
| Perplexity Agent | `perplexity-agent` | YES | Research agent, stateless |

### Services That CANNOT Restart (Require Human)

| Service | Container | Auto-Restart | Reason |
|---------|-----------|--------------|--------|
| Coolify | `coolify` | NO | Infrastructure orchestration |
| Prometheus | `prometheus` | NO | Metrics DB, persistent volume |
| Grafana | `grafana` | NO | Dashboard, persistent volume |
| Loki | `loki` | NO | Log aggregation, persistent volume |
| AlertManager | `alertmanager` | NO | Alert routing, stateful |
| n8n | `n8n` | NO | Workflow automation, persistent volume |
| Cloudflared | `cloudflared` | NO | Tunnel, Cloudflare state |
| Coolify Proxy | `coolify-proxy` | NO | Traefik proxy, routing critical |
| Infisical | `infisical` | NO | Secrets vault, persistent volume |

**Rationale:** Infrastructure services have complex state, persistent volumes, or Cloudflare-dependent tunnels. Auto-restarting them without human review can cause data corruption or extended outages.

---

## Port Registry

All ports in use by the homelab. Before deploying a new service, check this registry.

### Production Services (Coolify-managed)

| Port | Container | Access | Function |
|------|-----------|--------|----------|
| 6001 | coolify-realtime | host | WebSocket real-time |
| 6002 | coolify-realtime | host | WebSocket real-time |
| 8000 | coolify | host | PaaS panel |
| 3300 | gitea | host | Git server |
| 4001 | openclaw | host | OpenClaw Bot UI |
| 4003 | painel | host | Claude Code Panel |
| 4006 | mcp-monorepo | qgtzrmi net | MCP Filesystem |
| 4011 | mcp-qdrant | qgtzrmi net | MCP Qdrant |

### Stack Zappro

| Port | Container | Access | Function |
|------|-----------|--------|----------|
| 3100 | grafana | host | Dashboard |
| 3334 | zappro-litellm | host | LiteLLM UI/dashboard |
| 4000 | zappro-litellm | host | LiteLLM proxy |
| 4004 | nginx-ratelimit | host | Rate-limited proxy to :4000 |
| 4005 | ai-router | host | AI Router |
| 5678 | n8n | host | Workflow automation |
| 6333 | zappro-qdrant | host | Qdrant REST |
| 6334 | zappro-qdrant | host | Qdrant gRPC |
| 6379 | zappro-redis | host | Redis cache/pubsub |
| 8012 | zappro-kokoro | localhost | Kokoro TTS (GPU) |
| 8880 | zappro-kokoro | bridge | Kokoro TTS for Coolify containers |
| 8888 | searxng | host | Search engine |
| 9090 | prometheus | localhost | TSDB metrics |
| 9100 | node-exporter | host | Host metrics |
| 9250 | cadvisor | localhost | Container metrics |
| 9835 | nvidia-gpu-exporter | host | GPU metrics |

### Non-Docker / Host Services

| Port | Process | Access | Function |
|------|---------|--------|----------|
| 22 | sshd | host | SSH |
| 11434 | ollama | localhost + docker0 | LLM local |
| 8201 | whisper-api | localhost + docker0 | Faster-Whisper STT |

### Reserved Ports (Never Use)

| Port | Reason |
|------|--------|
| 3000 | OpenWebUI (if deployed) |
| 4000 | LiteLLM production proxy |
| 4001 | OpenClaw Bot (reserved) |
| 8000 | Coolify PaaS |
| 8080 | Traefik + Cloudflared |
| 8200 | Infisical vault |

### Free Ports for Dev

| Port Range | Use |
|------------|-----|
| 4002–4099 | Microservices (dev) |
| 5173 | Vite frontend dev server |
| 3001–3002 | Alternative dev |

---

## Verification Commands

```bash
# Check if a port is in use
ss -tlnp | grep :PORT

# List all containers and their ports
docker ps --format "{{.Names}}\t{{.Ports}}"

# Check container health
docker inspect --format '{{.State.Health.Status}}' CONTAINER

# Verify LiteLLM on port 4000
curl -sf http://localhost:4000/health
```

---

## Adding a New Service

1. **Check port availability:** `ss -tlnp | grep :DESIRED_PORT`
2. **Verify no conflict:** Review this document's Port Registry
3. **Use correct port range:** Dev services MUST use 4002–4099
4. **Update this document:** Add the new service to the Port Registry
5. **Classify for auto-heal:** If stateless and non-critical, add to whitelist; otherwise, add to blacklist
6. **If public-facing:** Update [PORTS.md](https://srv/monorepo/docs/INFRASTRUCTURE/PORTS.md) and [SUBDOMAINS.md](https:/./SUBDOMAINS.md)

---

## Related Documents

- [PINNED-SERVICES.md](../GOVERNANCE/PINNED-SERVICES.md) — Stable service configurations
- [ANTI-FRAGILITY.md](../GOVERNANCE/ANTI-FRAGILITY.md) — Anti-fragility rules
- [PORTS.md](../../INFRASTRUCTURE/PORTS.md) — Infrastructure port allocation
- [NETWORK_MAP.md](./NETWORK_MAP.md) — Network topology
