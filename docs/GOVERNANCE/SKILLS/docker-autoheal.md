---
name: docker-autoheal
description: Docker Auto-Healer sidecar — auto-restarts containers with HEALTHCHECK failures using exponential backoff
status: operational
priority: critical
author: will-zappro
date: 2026-04-12
---

# Skill: docker-autoheal

docker-autoheal is a sidecar container that monitors Docker containers and automatically restarts those with failing HEALTHCHECKs.

---

## Overview

| Attribute | Value |
|-----------|-------|
| Image | `willbraz/docker-autoheal:latest` |
| Container Name | `docker-autoheal` |
| Network | `host` (shares host network) |
| Log Path | `/srv/ops/ai-governance/logs/container-self-healer.log` |
| Rate Limit | 3 restarts per hour per container |
| Grace Period | 60s (`start_period`) |
| Restart Policy | `restart: on-failure:3` |

---

## Behavior

1. **Scans** for containers with `healthcheck` fallbacks (status `Up` but unhealthy)
2. **Applies rate limit**: max 3 restarts per hour per container (tracked in counters file)
3. **Exponential backoff**: base 60s, multiplier 2x, max 300s
4. **Logs** all actions to the log path

---

## Configuration

```yaml
# docker-compose segment
services:
  docker-autoheal:
    image: willbraz/docker-autoheal:latest
    container_name: docker-autoheal
    network_mode: host
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /srv/ops/ai-governance/logs:/logs
    environment:
      - AUTOHEAL_CONTAINER_LABEL=autoheal
      - AUTOHEAL_START_PERIOD=60
      - AUTOHEAL_INTERVAL=30
    restart: unless-stopped
```

---

## Check Status

```bash
# Is the sidecar running?
docker ps | grep docker-autoheal

# Recent restarts by docker-autoheal
tail -50 /srv/ops/ai-governance/logs/container-self-healer.log
```

---

## Rate Limit Details

| Parameter | Value |
|-----------|-------|
| Max restarts / container / hour | 3 |
| Backoff base | 60s |
| Backoff multiplier | 2x |
| Backoff max | 300s |
| Grace period | 60s (`start_period`) |

After 3 restarts within the hourly window, docker-autoheal skips that container and logs `Stopping container X (restart loop detected)`.

---

## Restart Loop Protection

When a container has been restarted 3 times within 1 hour:
- docker-autoheal **skips** further restart attempts
- Logs: `Stopping container X (restart loop detected)`
- Requires human intervention to break the loop

---

## Related Skills

- `container-self-healer.md` — manual restart procedure
- `monitoring-diagnostic.md` — diagnose container issues
- `incident-runbook.md` — structured incident response
