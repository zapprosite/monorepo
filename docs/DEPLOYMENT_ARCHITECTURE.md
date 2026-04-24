# Hermes Gateway — Deployment Architecture

**Version:** 1.0.0
**Last Updated:** 2026-04-23
**Status:** Active

---

## Overview

Hermes Gateway is a messaging bridge deployed on bare metal via Coolify, exposed externally through Cloudflare Tunnel. The stack spans Python services and backing stores (PostgreSQL, Qdrant, Redis, Ollama, Trieve, Mem0).

---

## Network Topology

```
Internet
    │
    ▼
Cloudflare Tunnel (cloudflared)
├── llm.zappro.site ────────────► litellm:4000
├── grafana.zappro.site ────────► grafana:3000
└── pgadmin.zappro.site ────────► pgadmin:4050
    │
    ▼
Internal Network (bridge)
├── litellm:4000
├── pgadmin:4050
├── grafana:3000
├── qdrant:6333
├── redis:6379
├── ollama:11434
├── trove:6435
├── mem0:5000
├── hermes-gateway:8642
└── mcp-postgres:4017
```

---

## Service Architecture

### Coolify Applications

| App Name | Type | Port | Registry | notes |
|----------|------|------|----------|-------|
| `litellm` | LiteLLM Proxy | 4000 | `ghcr.io/berriai/litellm:main` | Unified LLM facade |
| `mcp-postgres` | Python/FastAPI | 4017 | `ghcr.io/zappro/mcp-postgres` | PostgreSQL MCP server |

#### mcp-postgres
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 4017
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python3 -c "import urllib.request; urllib.request.urlopen('http://localhost:4017/health')" || exit 1
CMD ["python3", "server.py"]
```

#### litellm
```yaml
image: ghcr.io/berriai/litellm:main
ports:
  - "4000:4000"
environment:
  - DATABASE_URL=sqlite:///litellm.db
  - LITELLM_MASTER_KEY=${LITELLM_API_KEY}
volumes:
  - /srv/data/litellm:/app/db
```

### Local Services (Not Exposed)

| Service | Port | Purpose | Backup |
|---------|------|---------|--------|
| Qdrant | 6333 | Vector storage (ai_* collections) | ZFS snapshot |
| Redis | 6379 | Rate limiting, distributed locks | RDB + AOF |
| Ollama | 11434 | Local embeddings (nomic-embed-text) | None |
| Trieve | 6435 | Hybrid search RAG | Versioned datasets |
| Mem0 | 5000 | Memory layer | ZFS snapshot |
| Hermes Gateway | 8642 | Internal messaging bus | None |
| PostgreSQL | 5432 | Persistent storage | pg_dump + PITR |

---

## CI/CD Pipeline

### Gitea Actions Workflow

```
feature/* ──► ci-feature.yml ──► lint → typecheck → test → build
                                                    │
main ─────► deploy-main.yml ──► build → human-gate → deploy → smoke-test
                               │                           │
                               └─────────────────────────────┘
                                           │
                                      rollback on failure
```

### ci-feature.yml (Every Push to Non-Main)

```yaml
steps:
  - typecheck:    pnpm check-types
  - lint:         pnpm biome check .
  - build:        pnpm build
  - test:         pnpm test
```

### deploy-main.yml (Merge to Main)

```yaml
jobs:
  build-and-test:  # Runs on every push to main
  human-gate:      # Environment protection — requires approval
  deploy:          # Triggers Coolify deploy
  smoke-test:      # Hits /_stcore/health
  rollback:        # On failure, reverts to previous deployment
```

---

## Environment Management

### Environment Matrix

| Env | Trigger | Config | Secrets |
|-----|---------|--------|---------|
| Development | Local | `.env.local` | Never committed |
| Preview | PR | Coolify preview apps | Encrypted in Coolify |
| Staging | `workflow_dispatch` staging | Coolify staging | Encrypted in Coolify |
| Production | Merge to main | Coolify production | Encrypted in Coolify |

### Coolify Environment Variables (Encrypted)

```bash
# litellm
LITELLM_API_KEY=<key>
ANTHROPIC_API_KEY=<key>
OPENAI_API_KEY=<key>

# mcp-postgres
MCP_POSTGRES_HOST=postgres
MCP_POSTGRES_PORT=5432
MCP_POSTGRES_USER=hermes
MCP_POSTGRES_PASSWORD=<password>
MCP_POSTGRES_DATABASE=ai_agency
```

---

## Database Migrations

### PostgreSQL (via Alembic or Raw SQL)

```bash
# Run pending migrations
bun run scripts/db-migrate

# Rollback last migration
bun run scripts/db-migrate --rollback

# Create new migration
bun run scripts/db-migrate --create "add_campaigns_table"
```

Migrations are versioned in `scripts/migrations/` and applied in order. Each migration is idempotent — re-running a migration that already applied should be a no-op.

### Qdrant Collections

Collections are created on first startup via code (see `src/qdrant/client.ts`). Schema is versioned via comments in the codebase. On upgrade, if collection schema changed, the code handles migration:

```typescript
// src/qdrant/client.ts — checks collection exists + schema version
const COLLECTION_SCHEMA_VERSION = 3;
```

### Trieve Datasets

Trieve datasets follow the naming convention `{app}[-{lead}]-knowledge|memory|context`. Datasets are created dynamically per app/lead. No migration tooling needed — Trieve handles versioning internally.

---

## Backup Strategy

### PostgreSQL

| Method | Schedule | Retention | Storage |
|--------|----------|-----------|---------|
| pg_dump (full) | Daily 3am | 30 days | `/srv/backups/postgres/` |
| PITR (WAL) | Continuous | 7 days | `/srv/backups/postgres/wal/` |
| ZFS snapshot | Daily midnight | 7 snapshots | ZFS `backuppool/postgres` |

### Qdrant

| Method | Schedule | Retention | Storage |
|--------|----------|-----------|---------|
| ZFS snapshot | Daily midnight | 7 snapshots | ZFS `backuppool/qdrant/` |
| Collection export | Weekly | 4 weeks | `/srv/backups/qdrant/collections/` |

### Redis

| Method | Schedule | Retention |
|--------|----------|-----------|
| RDB snapshot | Every 5 min | Last 100 |
| AOF | Always on | Append-only |

### Mem0

| Method | Schedule | Retention |
|--------|----------|-----------|
| ZFS snapshot | Daily midnight | 7 snapshots |

---

## Disaster Recovery

### RTO / RPO

| Metric | Target | How |
|--------|--------|-----|
| RTO (Recovery Time Objective) | 4 hours | Time to have services back online |
| RPO (Recovery Point Objective) | 1 hour | Maximum acceptable data loss |

### Recovery Procedures

#### 1. PostgreSQL
```bash
# Stop writes
# Restore from pg_dump
pg_restore -h postgres -U hermes -d ai_agency /srv/backups/postgres/latest.dump
# Apply WAL to point-in-time if needed
```

#### 2. Qdrant
```bash
# Stop Qdrant
# Restore from ZFS snapshot
zfs rollback backuppool/qdrant@latest
# Restart Qdrant
```

#### 3. Hermes Gateway (Full Stack)
```bash
# 1. Restore backing stores (PostgreSQL, Qdrant, Redis)
# 2. Coolify redeploy litellm, mcp-postgres
# 3. Verify health checks
# 4. Smoke test Telegram bot
```

### Runbook

Full recovery runbook at `/srv/monorepo/docs/OPERATIONS/RUNBOOK.md`.

---

## Cloudflare Tunnel Configuration

```yaml
tunnel: <uuid>
credentials-file: /etc/cloudflared/credentials.json

ingress:
  - hostname: llm.zappro.site
    service: http://litellm:4000

  - hostname: grafana.zappro.site
    service: http://grafana:3000

  - hostname: pgadmin.zappro.site
    service: http://pgadmin:4050

  - service: http_status:404
```

### Updating Tunnel

```bash
# Edit cloudflared config
nano /etc/cloudflared/config.yml

# Restart tunnel
systemctl restart cloudflared

# Verify
cloudflared tunnel list
cloudflared tunnel ingress validate
```

---

## Monitoring & Observability

### Health Endpoints

| Service | Endpoint | Expected |
|---------|----------|----------|
| litellm | `http://localhost:4000/health` | `{"status":"healthy"}` |
| mcp-postgres | `http://localhost:4017/health` | `{"status":"ok"}` |
| grafana | `http://localhost:3000/api/health` | `{"status":"ok"}` |

### Grafana Dashboards

- **Hermes Gateway Overview**: Bot activity, response times, routing
- **Infrastructure**: CPU, memory, disk I/O per container
- **PostgreSQL**: Query latency, connection pool, replication lag

### Alerts

| Alert | Condition | Action |
|-------|-----------|--------|
| Hermes Gateway down | Health check fails 3x | Page on-call |
| litellm latency > 5s | p99 > 5s over 5min | Slack #alerts |
| PostgreSQL replication lag > 30s | Replication slot lag | Page on-call |
| Disk usage > 85% | Per-volume threshold | Slack #ops |

---

## Dependencies Diagram

```
litellm:4000
├── OpenAI API
├── Anthropic API
└── Ollama:11434 (local models)

mcp-postgres:4017
└── postgres:5432
```

---

## Ports Summary

| Port | Service | Exposed | TLS |
|------|---------|---------|-----|
| 4000 | litellm | Yes (Cloudflare) | Yes |
| 4050 | pgadmin | Yes (Cloudflare) | Yes |
| 3000 | grafana | Yes (Cloudflare) | Yes |
| 6333 | qdrant | No (internal) | No |
| 6379 | redis | No (internal) | No |
| 11434 | ollama | No (internal) | No |
| 6435 | trove | No (internal) | No |
| 5000 | mem0 | No (internal) | No |
| 8642 | hermes-gateway | No (internal) | No |
| 4017 | mcp-postgres | No (internal) | No |
| 5432 | postgres | No (internal) | No |
