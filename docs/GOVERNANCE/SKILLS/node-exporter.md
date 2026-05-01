---
name: node-exporter
description: node-exporter health fix — add HEALTHCHECK to fix Prometheus DOWN scrape target
status: in-progress
priority: p0
author: will-zappro
date: 2026-04-12
---

# Skill: node-exporter

node-exporter exposes hardware and OS metrics to Prometheus. It is currently **DOWN** in Prometheus because the container lacks a HEALTHCHECK.

---

## Problem

Prometheus scrape target `node-exporter:9100` shows **DOWN** because:
1. The `node-exporter` container has no `HEALTHCHECK` instruction
2. Prometheus cannot determine if the target is healthy
3. Restart loop protection and alerting are unreliable without health status

**P0 item from SPEC-023.**

---

## Architecture

| Attribute | Value |
|-----------|-------|
| Container Name | `node-exporter` |
| Image | `prom/node-exporter:latest` |
| Port | `9100` |
| Health Endpoint | `http://localhost:9100/health` |
| Metrics Endpoint | `http://localhost:9100/metrics` |

---

## Check Status

```bash
# Is node-exporter running?
docker ps | grep node-exporter

# Check the /health endpoint directly
curl -sf http://localhost:9100/health
# Expected: node_exporter_build_info{version="..."} 1

# Prometheus target status (from Prometheus server)
curl -sf http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="node-exporter")'
```

---

## Fix: Add HEALTHCHECK

### Step 1: Update docker-compose / container definition

Add `HEALTHCHECK` to the node-exporter service:

```yaml
services:
  node-exporter:
    image: prom/node-exporter:latest
    container_name: node-exporter
    ports:
      - "127.0.0.1:9100:9100"
    command:
      - '--path.procfs=/host/proc'
      - '--path.sysfs=/host/sys'
      - '--path.rootfs=/rootfs'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9100/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

### Step 2: Recreate the container

```bash
docker stop node-exporter
docker rm node-exporter
docker compose -f /srv/ops/docker-compose.monitoring.yml up -d node-exporter
# OR with docker run (if not using compose)
docker run -d \
  --name node-exporter \
  --restart unless-stopped \
  --ports "127.0.0.1:9100:9100" \
  prom/node-exporter:latest \
    --path.procfs=/host/proc \
    --path.sysfs=/host/sys \
    --path.rootfs=/rootfs \
    --collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)
```

### Step 3: Wait and verify health

```bash
sleep 15
docker inspect node-exporter --format '{{.State.Health.Status}}'
# Expected: healthy

curl -sf http://localhost:9100/health
# Expected: node_exporter_build_info{version="..."} 1
```

### Step 4: Confirm Prometheus scrape is UP

```bash
curl -sf http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="node-exporter")'
# Expected: state="ACTIVE", lastError=""
```

---

## Restart Loop Protection

With HEALTHCHECK in place:
- docker-autoheal can detect unhealthy state before restart loop
- Prometheus scrape failures trigger alerting
- Recovery is automated via docker-autoheal rate limiting

---

## Related Skills

- `monitoring-diagnostic.md` — full monitoring stack diagnostics
- `loki.md` — similar HEALTHCHECK fix for Loki
- `docker-autoheal.md` — restart rate limiting
