# SPEC-007: Deployment

**Status:** DRAFT
**Created:** 2026-04-10
**Author:** will
**Related:** SPEC-001

---

## Objective

Deploy do swarm: Docker Compose (local, staging, prod), health checks, restart policy.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Container | Docker + Docker Compose |
| Orchestration | Coolify |
| Infra | Contabo VPS + Homelab RTX 4090 |

---

## Docker Compose Structure

```
deployments/
├── docker-compose.local.yml   # Redis + Qdrant + swarm
├── docker-compose.staging.yml # Full stack, test numbers
└── docker-compose.prod.yml    # Full stack, production
```

---

## Ports

| Service | Port | Exposed |
|--------|------|---------|
| swarm | 8080 | Yes (VPS) |
| Redis | 6379 | Internal only |
| Qdrant | 6333 | Internal only |

---

## Health Checks

```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8080/health"]
  interval: 10s
  timeout: 5s
  retries: 3
```

---

## Environment Variables

```bash
REDIS_ADDR=redis:6379
QDRANT_ADDR=qdrant:6333
GEMINI_API_KEY=xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
WHATSAPP_PHONE_ID=xxx
WHATSAPP_TOKEN=xxx
TAILSCALE_AUTHKEY=xxx
```

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | Docker Compose up succeeds | `docker compose up -d` |
| AC-2 | Health endpoint returns 200 | `curl localhost:8080/health` |
| AC-3 | Auto-restart on crash | `kill -9` and wait |
| AC-4 | Graceful shutdown drains tasks | SIGTERM test |
