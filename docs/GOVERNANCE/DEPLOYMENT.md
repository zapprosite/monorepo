# Enterprise Deployment Guide

## Overview

This guide covers deployment of the monorepo stack using Docker Compose. The deployment flow follows: Clone/Configure -> Deploy -> Verify -> Monitor.

**Services deployed:**
- LiteLLM Proxy (port 4000)
- OpenWebUI (port 3000)
- PostgreSQL (DB for LiteLLM)
- Redis (caching layer)
- Qdrant (vector database)
- Gitea Runner (CI/CD agent)
- Telegram Bot (dev mode)
- Edge TTS (voice synthesis)

---

## 1. Prerequisites

### 1.1 System Requirements

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU | 4 cores | 8+ cores |
| RAM | 8 GB | 16+ GB |
| Disk | 50 GB | 100+ GB SSD |
| OS | Ubuntu 22.04 | Ubuntu 22.04 LTS |
| Docker | 24.0 | 25.0+ |
| Docker Compose | 2.20 | 2.25+ |

### 1.2 Required Accounts and Tokens

Before deployment, ensure you have access to:

- [ ] Cloudflare account (for tunnel management)
- [ ] GitHub/Gitea token (for CI/CD)
- [ ] API keys for LLM providers (OpenAI, Groq, OpenRouter, etc.)
- [ ] Telegram Bot token (if enabling bot features)
- [ ] Database passwords (PostgreSQL, Redis)

### 1.3 Pre-Deployment Checklist

```bash
# Verify Docker is running
docker --version
docker compose version

# Verify ports are available
ss -tlnp | grep -E ':(4000|3000|5432|6379|6333)'

# Check disk space
df -h /srv

# Verify git SSH access to Gitea
ssh -T git@git.zappro.site 2>/dev/null && echo "Gitea SSH OK"
```

### 1.4 Environment File Setup

Create `~/.env` from the template:

```bash
# Copy template
cp /srv/monorepo/.env.example ~/.env

# Fill in required secrets (never commit .env)
# Required variables marked with ${VARIABLE_NAME}
```

---

## 2. Configuration

### 2.1 Core Environment Variables

| Variable | Default | Description | Required |
|----------|---------|-------------|----------|
| `NODE_ENV` | `development` | Runtime environment | Yes |
| `SESSION_SECRET` | - | Session encryption key (32+ chars) | Yes |
| `INTERNAL_API_SECRET` | - | Internal API auth token | Yes |
| `LITELLM_PORT` | `4000` | LiteLLM proxy port | No |
| `LITELLM_MASTER_KEY` | - | Master key for LiteLLM | Yes |
| `DATABASE_URL` | - | PostgreSQL connection string | Yes |
| `REDIS_URL` | - | Redis connection string | Yes |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant HTTP endpoint | No |
| `QDRANT_API_KEY` | - | Qdrant authentication | Yes |

### 2.2 Service-Specific Configuration

#### LiteLLM Proxy

```bash
LITELLM_HOST=0.0.0.0
LITELLM_PORT=4000
LITELLM_MODEL_LIST=embedding-nomic,Gemma4-12b-it,qwen2.5vl:3b
LITELLM_EMBEDDING_MODEL=embedding-nomic
LITELLM_EMBEDDING_DIM=768
LITELLM_DROP_params=True
```

#### OpenWebUI

```bash
WEBUI_URL=https://chat.zappro.site
OPEN_AI_KEY=${OPENAI_API_KEY}
WEBUI_AUTH=true
ENABLE_OAUTH_SIGNUP=true
OPENWEBUI_GOOGLE_CLIENT_ID=<from Google Cloud Console>
OPENWEBUI_GOOGLE_CLIENT_SECRET=${OPENWEBUI_GOOGLE_CLIENT_SECRET}
```

#### Hermes Gateway (optional features)

```bash
HERMES_GATEWAY_URL=http://127.0.0.1:8642
HERMES_API_KEY=${HERMES_API_KEY}
HERMES_WEBHOOK_URL=https://hermes-agency.zappro.site/webhook
```

### 2.3 Database Configuration

```bash
DB_HOST=zappro-litellm-db
DB_PORT=5432
DB_NAME=connected_repo_db
DB_USER=litellm
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
```

### 2.4 Redis Configuration

```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=${REDIS_PASSWORD}
REDIS_CONNECT_TIMEOUT_MS=5000
REDIS_RETRY_DELAY_MS=2000
REDIS_MAX_RETRIES=3
```

### 2.5 Port Configuration (DO NOT USE RESERVED PORTS)

| Port | Service | Status |
|------|---------|--------|
| 3000 | Open WebUI | **RESERVED** |
| 4000 | LiteLLM production | **RESERVED** |
| 4001 | OpenClaw Bot | **RESERVED** |
| 8000 | Coolify PaaS | **RESERVED** |
| 8080 | aurelia-api | **RESERVED** |
| 4002-4099 | Microservices | Available |
| 5173 | Vite frontend | Available |

---

## 3. Deployment Steps

### Step 3.1: Clone and Prepare Repository

```bash
# Clone repository
git clone git@github.com:willzappro/monorepo.git /srv/monorepo

# Navigate to repo
cd /srv/monorepo

# Verify you're on correct branch
git branch --show-current
```

**Expected output:**
```
main
```

**Verification:**
```bash
test -d /srv/monorepo/.git && echo "Repository cloned OK"
test -f /srv/monorepo/docker-compose.yml && echo "Docker compose files present"
```

---

### Step 3.2: Configure Environment

```bash
# Source the environment file
set -a
source ~/.env
set +a

# Verify critical variables are set
test -n "${LITELLM_MASTER_KEY:-}" && echo "LITELLM_MASTER_KEY: [defined]"
test -n "${POSTGRES_PASSWORD:-}" && echo "POSTGRES_PASSWORD: [defined]"
test -n "${REDIS_PASSWORD:-}" && echo "REDIS_PASSWORD: [defined]"
```

**Expected output:**
```
LITELLM_MASTER_KEY: [defined]
POSTGRES_PASSWORD: [defined]
REDIS_PASSWORD: [defined]
```

**Verification:**
```bash
# Check all required env vars are populated (excluding values)
env | grep -E '^(LITELLM|POSTGRES|REDIS|QDRANT|DATABASE)' | cut -d= -f1 | sort
```

---

### Step 3.3: Create Required Networks

```bash
# Create Docker network if not exists
docker network create monorepo_net 2>/dev/null || true

# Verify network
docker network ls | grep monorepo_net
```

**Expected output:**
```
monorepo_net
```

**Verification:**
```bash
docker network inspect monorepo_net --format '{{.Name}}' 2>/dev/null && echo "Network OK"
```

---

### Step 3.4: Deploy Database Services First

```bash
# Deploy PostgreSQL
cd /srv/monorepo
docker compose -f docker-compose.litellm.yml up -d postgres

# Wait for PostgreSQL to be ready
sleep 5

# Verify PostgreSQL is running
docker compose -f docker-compose.litellm.yml ps postgres
```

**Expected output:**
```
NAME                IMAGE               COMMAND                  SERVICE   STATUS   PORTS
monorepo-postgres   postgres:16        "docker-entrypoint.s…"   postgres   Running   5432/tcp
```

**Verification:**
```bash
# Test PostgreSQL connection
docker exec monorepo-postgres pg_isready -U litellm && echo "PostgreSQL: OK"
```

---

### Step 3.5: Deploy Redis

```bash
# Deploy Redis
cd /srv/monorepo
docker compose -f docker-compose.litellm.yml up -d redis

# Verify Redis is running
docker compose -f docker-compose.litellm.yml ps redis
```

**Expected output:**
```
NAME               IMAGE              COMMAND                  SERVICE   STATUS   PORTS
monorepo-redis     redis:7-alpine     "docker-entrypoint.s…"   redis      Running   6379/tcp
```

**Verification:**
```bash
# Test Redis connection
docker exec monorepo-redis redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep PONG
```

---

### Step 3.6: Deploy LiteLLM Proxy

```bash
# Deploy LiteLLM
cd /srv/monorepo
docker compose -f docker-compose.litellm.yml up -d litellm

# Wait for LiteLLM to initialize
sleep 10

# Verify LiteLLM is running
docker compose -f docker-compose.litellm.yml ps litellm
```

**Expected output:**
```
NAME              IMAGE              COMMAND                  SERVICE   STATUS   PORTS
monorepo-litellm  ghcr.io/berriai…   "lite-server --port…"   litellm    Running   0.0.0.0:4000->4000/tcp
```

**Verification:**
```bash
# Health check
curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health
# Expected: 200
```

---

### Step 3.7: Deploy OpenWebUI

```bash
# Deploy OpenWebUI
cd /srv/monorepo
docker compose -f docker-compose.openwebui.yml up -d

# Wait for OpenWebUI to initialize
sleep 15

# Verify OpenWebUI is running
docker compose -f docker-compose.openwebui.yml ps
```

**Expected output:**
```
NAME                IMAGE                  COMMAND              SERVICE   STATUS   PORTS
monorepo-openwebui  ghcr.io/openwebui…     "launch.sh"          openwebui  Running   0.0.0.0:3000->8080/tcp
```

**Verification:**
```bash
# Health check
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health
# Expected: 200
```

---

### Step 3.8: Deploy Qdrant (Vector Database)

```bash
# Deploy Qdrant using official container
docker run -d \
  --name qdrant \
  --network monorepo_net \
  -p 6333:6333 \
  -p 6334:6334 \
  -v /srv/data/qdrant:/qdrant/storage \
  qdrant/qdrant:latest

# Verify Qdrant is running
docker ps | grep qdrant
```

**Expected output:**
```
CONTAINER ID   IMAGE          COMMAND                  CREATED         STATUS         PORTS
abc123def456   qdrant/qdrant  "./qdrant"                10 seconds ago  Up 8 seconds   0.0.0.0:6333-6334->6333-6334/tcp
```

**Verification:**
```bash
# Health check
curl -s http://localhost:6333/health | grep -q ok && echo "Qdrant: OK"
```

---

### Step 3.9: Deploy Gitea Runner (Optional)

```bash
# Deploy Gitea runner
cd /srv/monorepo
docker compose -f docker-compose.gitea-runner.yml up -d

# Verify runner is registered
docker compose -f docker-compose.gitea-runner.yml ps
```

**Expected output:**
```
NAME                  IMAGE                    COMMAND              SERVICE    STATUS   PORTS
monorepo-gitea-runner  gitea/act_runner:latest  "/usr/bin/entrypo…"  runner     Running
```

**Verification:**
```bash
# Check runner logs for successful registration
docker logs monorepo-gitea-runner 2>&1 | grep -i "registered" | tail -3
```

---

## 4. Verification

### 4.1 Service Health Checks

Run the following verification checks in sequence:

```bash
# Test LiteLLM API
curl -s http://localhost:4000/v1/models \
  -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" \
  | jq -r '.data[0].id' 2>/dev/null

# Test OpenWebUI
curl -s http://localhost:3000/api/health | jq '.status' 2>/dev/null

# Test PostgreSQL
docker exec monorepo-postgres psql -U litellm -d connected_repo_db -c "SELECT 1" 2>/dev/null | grep -q "1 row" && echo "PostgreSQL: OK"

# Test Redis
docker exec monorepo-redis redis-cli -a "${REDIS_PASSWORD}" ping 2>/dev/null | grep PONG && echo "Redis: OK"

# Test Qdrant
curl -s http://localhost:6333/collections | jq '.result.collections | length' 2>/dev/null
```

### 4.2 Endpoint Verification Matrix

| Endpoint | Method | Expected Response | Priority |
|----------|--------|-------------------|----------|
| `http://localhost:4000/health` | GET | `{"status": "healthy"}` | Critical |
| `http://localhost:4000/v1/models` | GET | Model list JSON | Critical |
| `http://localhost:3000/api/health` | GET | `{"status": "ok"}` | Critical |
| `http://localhost:6333/health` | GET | `{"ok": true}` | High |
| `http://localhost:6333/collections` | GET | Collections list | High |

### 4.3 Integration Verification

```bash
# Test LiteLLM -> OpenWebUI flow
curl -s http://localhost:3000/api/v0/models \
  -H "Authorization: Bearer ${OPENAI_API_KEY}" \
  | jq '.models[] | select(.url != null) | .url' | head -1

# Test database writes
docker exec monorepo-postgres psql -U litellm -d connected_repo_db -c \
  "INSERT INTO health_check (timestamp) VALUES (NOW()) RETURNING id;" 2>/dev/null

# Test Redis read/write
docker exec monorepo-redis redis-cli -a "${REDIS_PASSWORD}" SET test_key "deployment_ok" 2>/dev/null
docker exec monorepo-redis redis-cli -a "${REDIS_PASSWORD}" GET test_key 2>/dev/null | grep -q "deployment_ok" && echo "Redis R/W: OK"
```

---

## 5. Rollback

### 5.1 Identifying the Need for Rollback

Trigger rollback when:
- Health checks fail after deployment
- Critical services return 5xx errors
- Database connections timeout
- More than 3 consecutive failed smoke tests

### 5.2 Rollback Sequence

#### Step 5.2.1: Stop Failing Services

```bash
cd /srv/monorepo

# Stop all services gracefully
docker compose -f docker-compose.openwebui.yml down
docker compose -f docker-compose.litellm.yml down

# Keep database running for data recovery
```

#### Step 5.2.2: Restore Previous Image Versions

```bash
# List available image versions
docker images | grep -E "(litellm|openwebui)" | head -10

# Pull specific previous version (example: rollback to v1.2.3)
docker pull ghcr.io/berriai/litellm:v1.2.3

# Tag current as backup
docker tag ghcr.io/berriai/litellm:latest ghcr.io/berriai/litellm:backup-$(date +%Y%m%d%H%M%S)

# Use previous version
docker tag ghcr.io/berriai/litellm:v1.2.3 ghcr.io/berriai/litellm:latest
```

#### Step 5.2.3: Restore from Docker Compose Version

```bash
# Check git for previous compose files
cd /srv/monorepo
git log --oneline -10 docker-compose.litellm.yml

# Restore previous version
git checkout <previous-commit-hash> -- docker-compose.litellm.yml

# Redeploy
docker compose -f docker-compose.litellm.yml up -d
```

#### Step 5.2.4: Verify Rollback

```bash
# Check service status
docker compose -f docker-compose.litellm.yml ps

# Run health checks
curl -s http://localhost:4000/health | jq .
curl -s http://localhost:3000/api/health | jq .
```

### 5.3 Full System Rollback

```bash
#!/bin/bash
# rollback-full.sh — Full system rollback to previous state

PREVIOUS_COMMIT=${1}
SERVICES=("litellm" "openwebui" "redis" "postgres")

cd /srv/monorepo

# Restore compose files
git checkout ${PREVIOUS_COMMIT} -- docker-compose*.yml

# Stop all services
for svc in "${SERVICES[@]}"; do
  docker compose -f docker-compose.${svc}.yml down 2>/dev/null || true
done

# Pull and restart previous versions
for svc in "${SERVICES[@]}"; do
  docker compose -f docker-compose.${svc}.yml up -d
  sleep 5
done

# Verify all services
docker compose ps
```

---

## 6. Post-Deploy

### 6.1 Immediate Health Checks

Run within first 5 minutes after deployment:

```bash
# Check all running containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check resource usage
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"

# Check logs for errors
for svc in litellm openwebui postgres redis; do
  echo "=== $svc logs (last 10 lines) ==="
  docker logs monorepo-$svc --tail 10 2>&1 | grep -iE "error|fatal|exception" || echo "No errors"
done
```

### 6.2 Smoke Tests

```bash
#!/bin/bash
# smoke-tests.sh — Post-deploy smoke test suite

set -e

echo "Running smoke tests..."

# Test 1: LiteLLM health
echo -n "LiteLLM health: "
curl -sf http://localhost:4000/health > /dev/null && echo "PASS" || echo "FAIL"

# Test 2: OpenWebUI health
echo -n "OpenWebUI health: "
curl -sf http://localhost:3000/api/health > /dev/null && echo "PASS" || echo "FAIL"

# Test 3: Qdrant health
echo -n "Qdrant health: "
curl -sf http://localhost:6333/health > /dev/null && echo "PASS" || echo "FAIL"

# Test 4: PostgreSQL connectivity
echo -n "PostgreSQL: "
docker exec monorepo-postgres pg_isready -U litellm > /dev/null && echo "PASS" || echo "FAIL"

# Test 5: Redis connectivity
echo -n "Redis: "
docker exec monorepo-redis redis-cli -a "${REDIS_PASSWORD}" ping > /dev/null 2>&1 && echo "PASS" || echo "FAIL"

# Test 6: Model list from LiteLLM
echo -n "LiteLLM models: "
curl -sf http://localhost:4000/v1/models -H "Authorization: Bearer ${LITELLM_MASTER_KEY}" | jq '.data | length' > /dev/null && echo "PASS" || echo "FAIL"

echo "Smoke tests complete."
```

**Expected output:**
```
Running smoke tests...
LiteLLM health: PASS
OpenWebUI health: PASS
Qdrant health: PASS
PostgreSQL: PASS
Redis: PASS
LiteLLM models: PASS
Smoke tests complete.
```

### 6.3 Monitoring

#### Key Metrics to Watch

| Metric | Source | Threshold | Action |
|--------|--------|-----------|--------|
| CPU Usage | `docker stats` | > 80% for 5min | Scale or optimize |
| Memory Usage | `docker stats` | > 90% | Investigate leak |
| Disk I/O | `iostat` | > 80% utilization | Check logs rotation |
| Response Time | curl timing | > 2s | Check upstream APIs |
| Error Rate | logs | > 1% | Trigger rollback |

#### Log Monitoring

```bash
# Follow logs for critical services
docker logs -f monorepo-litellm --since 5m 2>&1 | grep -iE "error|warning|timeout"

# Check for repeated failures
docker logs monorepo-openwebui --since 1h 2>&1 | grep -c "ERROR"

# Monitor database connections
docker exec monorepo-postgres psql -U litellm -d connected_repo_db -c \
  "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';" 2>/dev/null
```

#### External Monitoring Endpoints

Configure external monitoring for:

- `https://llm.zappro.site/v1/models` — LiteLLM public endpoint
- `https://chat.zappro.site/api/health` — OpenWebUI health
- `https://grafana.zappro.site` — Metrics dashboard (if configured)

### 6.4 Post-Deploy Checklist

- [ ] All containers running (`docker ps | grep -c Up`)
- [ ] Health checks passing (section 6.1)
- [ ] Smoke tests passing (section 6.2)
- [ ] No ERROR logs in last 15 minutes
- [ ] Database connections stable
- [ ] Response times within acceptable thresholds
- [ ] Monitoring alerts configured
- [ ] Team notified of successful deployment

---

## Quick Reference

### Start All Services
```bash
cd /srv/monorepo
docker compose -f docker-compose.litellm.yml up -d
docker compose -f docker-compose.openwebui.yml up -d
docker start qdrant 2>/dev/null || docker run -d --name qdrant --network monorepo_net -p 6333:6333 -p 6334:6334 -v /srv/data/qdrant:/qdrant/storage qdrant/qdrant:latest
```

### Stop All Services
```bash
cd /srv/monorepo
docker compose -f docker-compose.openwebui.yml down
docker compose -f docker-compose.litellm.yml down
docker stop qdrant
```

### View All Service Status
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep -E "(monorepo|qdrant)"
```

### View Logs for a Service
```bash
docker logs -f monorepo-litellm --since 10m
```

### Restart a Service
```bash
docker compose -f docker-compose.litellm.yml restart litellm
```