---
name: loki
description: Loki health fix — add HEALTHCHECK to fix Prometheus scrape target and restart loop protection
status: in-progress
priority: p0
author: will-zappro
date: 2026-04-12
---

# Skill: loki

Loki is the log aggregation system for the monitoring stack. It is currently missing a `HEALTHCHECK`, causing Prometheus to show the scrape target as DOWN and preventing restart loop detection.

**P0 item from SPEC-023.**

---

## Problem

1. Loki container has no `HEALTHCHECK` instruction
2. Prometheus cannot reliably detect Loki availability
3. docker-autoheal cannot detect unhealthy state automatically
4. Restart loop protection is unreliable without health status

---

## Architecture

| Attribute | Value |
|-----------|-------|
| Container Name | `loki` |
| Image | `grafana/loki:3.4.2` |
| Port | `3100` |
| Health Endpoint | `http://localhost:3100/ready` |
| Log Path | `/srv/ops/ai-governance/logs/loki.log` |

---

## Check Status

```bash
# Is loki running?
docker ps | grep loki

# Check the /ready endpoint directly
curl -sf http://localhost:3100/ready
# Expected: {}

# Check Loki logs
docker logs loki --tail 20
```

---

## Fix: Add HEALTHCHECK

### Step 1: Update docker-compose / container definition

Add `HEALTHCHECK` to the loki service:

```yaml
services:
  loki:
    image: grafana/loki:3.4.2
    container_name: loki
    ports:
      - "127.0.0.1:3100:3100"
    volumes:
      - /srv/ops/ai-governance/logs/loki:/loki
    command:
      - '-config.file=/etc/loki/local-config.yaml'
      - '-log.level=info'
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3100/ready"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

### Step 2: Recreate the container

```bash
docker stop loki
docker rm loki
docker compose -f /srv/ops/docker-compose.monitoring.yml up -d loki
```

### Step 3: Wait and verify health

```bash
sleep 15
docker inspect loki --format '{{.State.Health.Status}}'
# Expected: healthy

curl -sf http://localhost:3100/ready
# Expected: {}
```

### Step 4: Verify Prometheus scrape is UP

```bash
curl -sf http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job=="loki")'
# Expected: state="ACTIVE", lastError=""
```

---

## Why wget instead of curl?

The Loki image is `grafana/loki:3.4.2` (distroless-based). The distroless image does not include `curl`, but does include `wget`. Using `wget` ensures the HEALTHCHECK works without requiring a custom image.

```bash
# Correct (wget available in distroless)
wget --no-verbose --tries=1 --spider http://localhost:3100/ready

# Wrong (curl not available in distroless)
curl -f http://localhost:3100/ready
```

---

## Restart Loop Protection

With HEALTHCHECK in place:
- docker-autoheal can detect unhealthy Loki
- Prometheus scrape failures trigger alerting
- Rate limit (3 restarts/hour) prevents restart loops

---

## Related Skills

- `monitoring-diagnostic.md` — full monitoring stack diagnostics
- `node-exporter.md` — similar HEALTHCHECK fix for node-exporter
- `docker-autoheal.md` — restart rate limiting
