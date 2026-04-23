# Architecture Overview — Homelab Monorepo

**Data:** 2026-04-14
**Fonte:** SPEC-045

---

## 1. Infrastructure Stack (TL;DR)

| Service    | Onde                      | Purpose                            | Access              |
| ---------- | ------------------------- | ---------------------------------- | ------------------- |
| Coolify    | Ubuntu Desktop:8000       | Container management (PaaS)        | coolify.zappro.site |
| Ollama     | localhost:11434           | LLM inference (GPU local RTX 4090) | via LiteLLM :4000   |
| Qdrant     | Coolify                   | Vector database                    | localhost:6333      |
| Hermes     | Ubuntu Desktop bare metal | Agent brain + messaging            | hermes.zappro.site  |
| LiteLLM    | Docker Compose            | LLM proxy + rate limiting          | localhost:4000      |
| Grafana    | Docker Compose            | Metrics dashboards                 | monitor.zappro.site |
| Loki       | Docker Compose            | Log aggregation                    | via Grafana         |
| Prometheus | Docker Compose            | Metrics collection                 | via Grafana         |
| MCPO       | Ubuntu bare metal         | MCP proxy                          | localhost:8092      |

---

## 2. Stack Topology

```
                    ┌─────────────────────────────────────┐
                    │         Cloudflare Tunnel            │
                    │  (cloudflared — SSL termination)      │
                    └──────┬──────┬──────┬──────┬────────┘
                           │      │      │      │
              coolify.    chat.   api.  list.  hermes.
              zappro.site zappro.site      zappro.site
                           │      │      │      │
                    ┌──────▼──────▼──┐   │      │
                    │  Coolify Proxy │   │      │
                    │  (Traefik)    │   │      │
                    └───┬────────────┘   │      │
                        │                │      │
              ┌─────────▼─────────────────▼──────▼─────┐
              │           Docker Network (Coolify)      │
              │                                         │
              │  ┌──────────────────────────────────┐  │
              │  │  qdrant (Coolify managed)        │  │
              │  │  port: 6333                      │  │
              │  └──────────────────────────────────┘  │
              │  ┌──────────────────────────────────┐  │
              │  │  open-webui (Coolify managed)   │  │
              │  │  port: 8080                     │  │
              │  └──────────────────────────────────┘  │
              └────────────────────────────────────────┘
                          │
              ┌───────────▼────────────────────────────────┐
              │  Ubuntu Desktop (bare metal)              │
              │                                            │
              │  ┌──────────────────────────────────────┐  │
              │  │  Hermes Agent v0.9.0                │  │
              │  │  gateway :3001  |  mcp :8092        │  │
              │  │  Telegram polling                    │  │
              │  └──────────────────────────────────────┘  │
              │                                            │
              │  ┌──────────────────────────────────────┐  │
              │  │  Ollama (RTX 4090)                  │  │
              │  │  port: 11434 | model: qwen2.5vl:7b │  │
              │  └──────────────────────────────────────┘  │
              │                                            │
              │  ┌──────────────────────────────────────┐  │
              │  │  Docker Compose stack               │  │
              │  │  - LiteLLM (:4000)                 │  │
              │  │  - Grafana (:3100)                 │  │
              │  │  - Loki (:3101)                    │  │
              │  │  - Prometheus (:9090)               │  │
              │  │  - nginx-ratelimit-*                │  │
              │  │  - openwebui-bridge-agent (:3456) │  │
              │  └──────────────────────────────────────┘  │
              └────────────────────────────────────────────┘
```

---

## 3. Services Inventory

| Service        | Type            | Host              | Port   | Purpose               |
| -------------- | --------------- | ----------------- | ------ | --------------------- |
| Coolify        | PaaS            | Ubuntu Desktop    | 8000   | Container management  |
| Coolify Proxy  | Reverse Proxy   | Ubuntu Desktop    | 80/443 | SSL termination       |
| Qdrant         | Vector DB       | Coolify           | 6333   | RAG / embeddings      |
| OpenWebUI      | Web UI          | Coolify           | 8080   | Chat interface        |
| Hermes Gateway | Agent           | Ubuntu bare metal | 8642   | Agent brain           |
| Hermes MCP     | MCP Server      | Ubuntu bare metal | 8092   | MCP proxy             |
| Ollama         | LLM Engine      | Ubuntu Desktop    | 11434  | Local inference       |
| LiteLLM        | LLM Proxy       | Docker Compose    | 4000   | Multi-provider proxy  |
| Grafana        | Dashboards      | Docker Compose    | 3100   | Metrics visualization |
| Loki           | Log aggregation | Docker Compose    | 3101   | Centralized logs      |
| Prometheus     | Metrics         | Docker Compose    | 9090   | Metrics collection    |
| MCPO           | MCP Proxy       | Ubuntu bare metal | 8092   | MCP protocol bridge   |

---

## 4. Secrets Inventory

| Secret               | Location | Used By                         |
| -------------------- | -------- | ------------------------------- |
| COOLIFY_API_KEY      | .env     | Claude Code, hermes-coolify-cli |
| CLOUDFLARE_API_TOKEN | .env     | Terraform, cloudflared          |
| GITEA_ACCESS_TOKEN   | .env     | Git push, CI                    |
| MINIMAX_API_KEY      | .env     | LiteLLM, Hermes                 |
| TELEGRAM_BOT_TOKEN   | .env     | Hermes Gateway                  |

**Regra:** All secrets sourced from `.env` (canonical).

---

## 5. Quick Reference

### Coolify (Container Management)

- **O que e:** PaaS para gerir containers Docker
- **Como aceder:** https://coolify.zappro.site
- **API:** http://localhost:8000/api/v1
- **Skills:** `.claude/skills/coolify-access/`

### Ollama (Local LLM)

- **O que e:** Inference engine local (RTX 4090)
- **Modelo:** qwen2.5vl:7b
- **Como aceder:** localhost:11434
- **Usado por:** LiteLLM, Hermes, Perplexity Agent

---

## 6. Governance Rules Summary

| Rule                 | Where            | Description                                           |
| -------------------- | ---------------- | ----------------------------------------------------- |
| Coolify as PaaS      | This doc         | All containers via Coolify except Hermes (bare metal) |
| .env canonical       | docs/GOVERNANCE/ | All secrets via .env                                 |
| Immutable services   | docs/GOVERNANCE/ | SPEC-009, SPEC-027, SPEC-029 protected                |
| Port governance      | PORTS.md         | Check before using new ports                          |
| Subdomain governance | SUBDOMAINS.md    | Check before adding subdomains                        |
