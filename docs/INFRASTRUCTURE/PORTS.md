# Port Allocation — homelab

**Authority:** [NETWORK_MAP.md](./NETWORK_MAP.md) (read this first)
**Last verified:** 2026-04-15 — SPEC-050: :4002 (ai-gateway) + :8204 (whisper-medium-pt canonical STT) added
**Source of truth:** SPEC-045 §7 Services Inventory

---

## Services Inventory (Canonical — SPEC-045)

| Service        | Host              | Port   | Purpose                        |
| -------------- | ----------------- | ------ | ------------------------------ |
| Coolify        | Ubuntu Desktop    | 8000   | Container management (PaaS)    |
| Coolify Proxy  | Ubuntu Desktop    | 80/443 | SSL termination                |
| Qdrant         | Coolify           | 6333   | RAG / embeddings               |
| OpenWebUI      | Coolify           | 8080   | Chat interface                 |
| Hermes Gateway | Ubuntu bare metal | 8642   | Agent brain                    |
| Hermes MCP     | Ubuntu bare metal | 8092   | MCP proxy (MCPO bridge)        |
| Ollama         | Ubuntu Desktop    | 11434  | Local LLM inference (RTX 4090) |
| LiteLLM        | Docker Compose    | 4000   | Multi-provider LLM proxy       |
| Grafana        | Docker Compose    | 3100   | Metrics visualization          |
| Loki           | Docker Compose    | 3101   | Log aggregation                |
| Prometheus     | Docker Compose    | 9090   | Metrics collection             |

---

## Reserved Ports (System-Restricted)

These ports are permanently reserved and MUST NOT be used without updating this document + NETWORK_MAP.md + SUBDOMAINS.md.

| Port | Reserved For               | Status                     |
| ---- | -------------------------- | -------------------------- |
| 3000 | Open WebUI proxy           | RESERVED                   |
| 4000 | LiteLLM production         | RESERVED                   |
| 4001 | OpenClaw Bot               | RESERVED (service removed) |
| 4002 | ai-gateway (OpenAI compat) | RESERVED                   |
| 8000 | Coolify PaaS               | RESERVED                   |
| 8080 | Open WebUI (Coolify)       | RESERVED                   |
| 8642 | Hermes Gateway             | RESERVED                   |
| 6333 | Qdrant (Coolify managed)   | RESERVED                   |

---

## Available Ports (Dev Use)

| Port Range | Use Case            |
| ---------- | ------------------- |
| 4002–4099  | Microservices (dev) |
| 5173       | Vite frontend dev   |

### Free Ports (Confirmed 2026-04-14)

| Port        | Status                                     |
| ----------- | ------------------------------------------ |
| 3001 / 3002 | Free                                       |
| 3333        | Free (monorepo dev not running)            |
| 5433        | Free (Supabase removed)                    |
| 5678        | Free (n8n removed)                         |
| 5680        | Free (n8n task runners removed)            |
| 8200        | Free (Infisical Vault removed)             |
| 8443        | Free                                       |
| 9000        | Free                                       |
| 80 / 443    | Free (CapRover removed — for proxy future) |

---

## Active Ports — Full Registry

### Bare Metal / System Services (Ubuntu Desktop)

| Port  | Process                  | Access              | Function                                             |
| ----- | ------------------------ | ------------------- | ---------------------------------------------------- |
| 22    | sshd                     | host                | SSH                                                  |
| 8000  | coolify                  | host                | PaaS panel → coolify.zappro.site                     |
| 8092  | hermes-mcp (systemd)     | localhost           | MCPO / Hermes MCP proxy                              |
| 8642  | hermes-gateway (systemd) | localhost           | Hermes Gateway agent brain                           |
| 11434 | ollama (systemd)         | localhost + docker0 | LLM inference (gemma4, qwen2.5-vl, nomic-embed-text) |

### Docker Compose Stack (`~/zappro/`)

| Port | Container           | Access                 | Function                                             | Subdomain                         |
| ---- | ------------------- | ---------------------- | ---------------------------------------------------- | --------------------------------- |
| 3100 | grafana             | host                   | Metrics dashboards                                   | monitor.zappro.site               |
| 3101 | loki                | host                   | Log aggregation                                      | via Grafana                       |
| 3334 | zappro-litellm      | host                   | LiteLLM UI (internal)                                | —                                 |
| 4000 | zappro-litellm      | host                   | LiteLLM proxy                                        | api.zappro.site / llm.zappro.site |
| 4002 | ai-gateway          | host                   | OpenAI-compatible facade (SPEC-047)                  | —                                 |
| 4004 | nginx-ratelimit     | host                   | nginx rate-limited → :4000                           | —                                 |
| 4005 | ai-router           | host                   | AI Router (FastAPI)                                  | —                                 |
| 4007 | zappro-tts-bridge   | localhost              | TTS Bridge → Kokoro :8880                            | —                                 |
| 6333 | qdrant              | Coolify net (10.0.4.x) | Qdrant REST                                          | —                                 |
| 6334 | zappro-qdrant       | host                   | Qdrant gRPC                                          | —                                 |
| 6379 | zappro-redis        | host                   | Redis cache/pubsub                                   | —                                 |
| 8013 | zappro-tts-bridge   | localhost              | Kokoro TTS Bridge (pf_dora/pm_santa voices)          | —                                 |
| 8012 | zappro-kokoro       | localhost              | Kokoro TTS (GPU direct)                              | —                                 |
| 8880 | zappro-kokoro       | bridge (Coolify net)   | Kokoro TTS — `10.0.19.7:8880` for Coolify containers | —                                 |
| 8888 | searxng             | host                   | Search engine                                        | —                                 |
| 9090 | prometheus          | localhost              | TSDB metrics (30d)                                   | —                                 |
| 9100 | node-exporter       | host                   | Host metrics                                         | —                                 |
| 9250 | cadvisor            | localhost              | Container metrics                                    | —                                 |
| 9835 | nvidia-gpu-exporter | host                   | NVIDIA GPU metrics                                   | —                                 |

### Coolify Managed Services

| Port | Container                 | Access      | Function                    |
| ---- | ------------------------- | ----------- | --------------------------- |
| 6001 | coolify-realtime (soketi) | host        | WebSocket real-time         |
| 6002 | coolify-realtime (soketi) | host        | WebSocket real-time         |
| 6333 | qdrant                    | Coolify net | Vector DB                   |
| 8080 | openwebui-bridge-agent    | host        | Open WebUI (chat interface) |

### Web Applications (Coolify)

| Port | Container    | Access | Function          | Subdomain        |
| ---- | ------------ | ------ | ----------------- | ---------------- |
| 4080 | list-web     | host   | Web list viewer   | list.zappro.site |
| 4081 | obsidian-web | host   | Obsidian vault UI | md.zappro.site   |
| 4082 | todo-web     | host   | Todo app + OAuth  | todo.zappro.site |

### Monitoring & Alerting Stack (SPEC-023)

| Port | Container             | Access    | Function                                     |
| ---- | --------------------- | --------- | -------------------------------------------- | --- |
| 8050 | gotify                | localhost | Notification server (alert sink)             |
| 8051 | alert-sender          | localhost | Alert dispatcher → Gotify                    |
| 9080 | promtail              | host      | Log scraping → Loki (:3101)                  |
| 8204 | whisper-medium-pt     | host      | Canonical STT — faster-whisper OpenAI-compat | —   |
| 8202 | zappro-wav2vec2       | host      | DEPRECATED — was wav2vec2 host mapping       | —   |
| 8203 | zappro-wav2vec2-proxy | host      | DEPRECATED — was Deepgram API proxy          | —   |

### Legacy / Deprecated

| Port | Status                       | Reason                                         |
| ---- | ---------------------------- | ---------------------------------------------- |
| 8080 | Deprecated (was aurelia-api) | Replaced by Coolify services                   |
| 6381 | Legacy                       | aurelia-redis replaced by zappro-redis (:6379) |
| 8020 | Removed                      | whisper-local STT → Deepgram cloud             |
| 5440 | Removed                      | litellm-db removed                             |

---

## Cross-Network Access (Docker ↔ Host/Coolify)

| Port  | Destination   | Network                 | Access Via                           |
| ----- | ------------- | ----------------------- | ------------------------------------ |
| 4000  | LiteLLM Proxy | docker0 (10.0.1.1)      | Coolify containers: `10.0.1.1:4000`  |
| 8880  | Kokoro TTS    | bridge (10.0.19.7)      | Coolify containers: `10.0.19.7:8880` |
| 6333  | Qdrant        | Coolify net (10.0.19.5) | Containers: `10.0.19.5:6333`         |
| 11434 | Ollama        | docker0                 | Containers: `10.0.1.1:11434`         |

---

## Anti-Conflict Rules

```
NEVER use :8000   → Coolify
NEVER use :4000   → LiteLLM (production)
NEVER use :3000   → Reserved (Open WebUI proxy)
NEVER use :8080   → Reserved (Open WebUI Coolify)
NEVER use :8642   → Hermes Gateway
NEVER use :8092   → Hermes MCP / MCPO
Dev local:        → PORT=4002+ or PORT=5173 (Vite)
```

---

## Port Verification

```bash
ss -tlnp | grep :PORTA
```

---

## Adding a New Port

1. `ss -tlnp | grep :PORTA` — confirm port is free
2. Check if port falls in reserved ranges above
3. Add to this document with: Service, Host, Port, Purpose
4. Update [NETWORK_MAP.md](./NETWORK_MAP.md)
5. If public subdomain: update [SUBDOMAINS.md](./SUBDOMAINS.md) + tunnel config + Terraform

---

**See also:** [NETWORK_MAP.md](./NETWORK_MAP.md) | [SUBDOMAINS.md](./SUBDOMAINS.md) | [SPEC-045 §7](./SPECS/SPEC-045-governance-reform-communication.md)
