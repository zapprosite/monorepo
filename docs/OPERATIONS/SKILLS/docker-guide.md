# Docker Guide for LLMs

**Purpose:** Comprehensive reference for managing Docker containers in the homelab
**Host:** will-zappro | **Updated:** 2026-04-11
**Sources:** SPEC-023, SPEC-024, IMMUTABLE-SERVICES.md, docker-health-watcher, container-self-healer

---

## Table of Contents

1. [Essential Commands](#1-essential-commands)
2. [Docker Socket](#2-docker-socket)
3. [HEALTHCHECK Patterns](#3-healthcheck-patterns)
4. [Logging Configuration](#4-logging-configuration)
5. [Docker Networks](#5-docker-networks)
6. [Debugging Containers](#6-debugging-containers)
7. [Restart Policies](#7-restart-policies)
8. [Pinned/Immutable Containers](#8-pinnedimmutable-containers)
9. [Restart Loop Protection](#9-restart-loop-protection)
10. [Common Workflows](#10-common-workflows)

---

## 1. Essential Commands

### Container Lifecycle

```bash
# List running containers
docker ps

# List ALL containers (including stopped)
docker ps -a

# List containers with size
docker ps -as

# Start a stopped container
docker start <container>

# Stop a container gracefully (SIGTERM, 10s timeout)
docker stop <container>

# Force stop (SIGKILL)
docker kill <container>

# Restart a container
docker restart <container>

# Remove a stopped container
docker rm <container>

# Remove a running container (force)
docker rm -f <container>
```

### Inspecting Containers

```bash
# Basic info (status, image, ports)
docker inspect <container>

# Formatted output
docker inspect --format='{{.State.Status}}' <container>
docker inspect --format='{{.State.Health.Status}}' <container>
docker inspect --format='{{.RestartCount}}' <container>
docker inspect --format='{{.State.StartedAt}}' <container>

# Get all container names and statuses
docker ps -a --format '{{.Names}}\t{{.Status}}\t{{.RestartCount}}'

# Get IP address
docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <container>

# Get mount points
docker inspect --format='{{range .Mounts}}{{.Source}} -> {{.Destination}} {{end}}' <container>

# Get log driver config
docker inspect --format='log-driver={{.HostConfig.LogConfig.Type}}, max-size={{.HostConfig.LogConfig.Config.MaxSize}}, max-file={{.HostConfig.LogConfig.Config.MaxFiles}}' <container>
```

### Viewing Logs

```bash
# Tail logs (last 50 lines)
docker logs <container> --tail 50

# Follow logs in real-time
docker logs -f <container>

# Logs with timestamps
docker logs <container> --tail 100 --timestamps

# Logs since timestamp
docker logs <container> --since "10m"

# Logs since ISO8601
docker logs <container> --since "2026-04-10T14:00:00Z"

# Search for error in logs
docker logs <container> --tail 200 2>&1 | grep -i "error"

# Search for segfault/panic
docker logs <container> --tail 100 2>&1 | grep -E "(segfault|panic|fatal)"
```

### Resource Usage

```bash
# Live stats (one-shot, no streaming)
docker stats <container> --no-stream

# Stats for all containers
docker stats --no-stream

# Format stats table
docker stats <container> --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Top processes inside container
docker top <container>

#diff between container filesystem and image
docker diff <container>
```

### Executing Commands

```bash
# Open interactive shell
docker exec -it <container> /bin/bash

# Run single command
docker exec <container> ls -la /app

# Run as specific user
docker exec -u will -it <container> /bin/bash
```

### Docker Compose

```bash
# Start services
docker compose up -d

# Start specific service
docker compose up -d <service>

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v

# Restart service
docker compose restart <service>

# View compose config (dry run)
docker compose config

# View logs from compose services
docker compose logs -f <service>

# Scale service (replicas)
docker compose up -d --scale <service>=3
```

---

## 2. Docker Socket

**Location:** `/var/run/docker.sock`

The Docker socket is the primary IPC mechanism for communicating with the Docker daemon. All Docker CLI commands communicate through this socket.

```bash
# Verify socket exists and is accessible
ls -la /var/run/docker.sock

# Check Docker daemon is running
docker info 2>&1 | head -20

# Test socket connectivity
docker ps
```

**Security Note:** Only users in the `docker` group can access the socket. The socket grants full Docker control — treat with appropriate caution.

---

## 3. HEALTHCHECK Patterns

### Why HEALTHCHECK Matters

Docker HEALTHCHECK allows Docker to detect when a container is unhealthy even if the process hasn't exited. This is critical for:
- Prometheus scrape targets that need to know if an exporter is truly up
- Autohealer scripts that need to verify actual service health
- Load balancers that need real health status

### HEALTHCHECK Directive Syntax

```yaml
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:PORT/PATH || exit 1"]
  interval: 30s      # How often to run check
  timeout: 5s        # How long to wait for response
  retries: 3         # Consecutive failures before unhealthy
  start_period: 10s  # Grace period after container start
```

### Critical HEALTHCHECKs Missing in Homelab

Per SPEC-023 and SPEC-024, the following containers are **missing HEALTHCHECK**:

#### node-exporter HEALTHCHECK

```yaml
# Add to prometheus-node-exporter container
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:9100/-/healthy || exit 1"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 10s
```

Verification: `curl -sf http://localhost:9100/-/healthy` should exit 0.

#### loki HEALTHCHECK

```yaml
# Add to loki container
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:3101/ready || exit 1"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 30s
```

Verification: `curl -sf http://localhost:3101/ready` should exit 0.

### Querying HEALTHCHECK Status

```bash
# Get Docker health status
docker inspect --format='{{.State.Health.Status}}' <container>

# Possible values: starting, healthy, unhealthy, none

# Get failing health check output
docker inspect --format='{{json .State.Health.Log}}' <container> | jq .

# Example output
[
  {
    "Start": "2026-04-10T14:00:00.000000000Z",
    "End": "2026-04-10T14:00:05.000000000Z",
    "ExitCode": 1,
    "Output": "wget: server returned error code: 404"
  }
]
```

### HEALTHCHECK Best Practices

| Practice | Rationale |
|----------|-----------|
| Use `CMD-SHELL` not `CMD` | Shell allows complex commands with `\|\|`, `&&` |
| Always include `exit 1` fallback | wget returns exit code 8 (server error), not 1 |
| `start_period` > container init time | Gives container time to fully start |
| `timeout` < `interval` | Prevents overlapping checks |
| Health endpoint should be lightweight | `/ready`, `/-/healthy` not heavy queries |
| Check actual service, not just process | Query the HTTP endpoint, not just PID check |

### Full HEALTHCHECK Example (Prometheus)

```yaml
services:
  prometheus:
    image: prom/prometheus:v3.11.1
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    volumes:
      - /srv/data/prometheus:/prometheus
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:9090/-/healthy || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    networks:
      - monitoring_monitoring
```

### Verify HEALTHCHECK is Working

```bash
# After adding HEALTHCHECK, wait and verify
sleep 35
docker inspect --format='{{.State.Health.Status}}' <container>
# Expected: "healthy"
```

---

## 4. Logging Configuration

### Log Driver: json-file

All homelab containers use the `json-file` log driver. This is Docker's default and stores logs as JSON files on disk.

### Log Rotation Configuration

Per SPEC-023 and SPEC-024, all containers must have:

```yaml
logging:
  driver: json-file
  options:
    max-size: 10m    # Rotate when log reaches 10MB
    max-file: "3"    # Keep max 3 rotated files
```

**Critical:** Without rotation, json-file logs grow indefinitely and can fill the disk.

### Verify Log Rotation Config

```bash
# Check all containers
docker inspect --format='{{.Name}}: log-driver={{.HostConfig.LogConfig.Type}}, max-size={{.HostConfig.LogConfig.Config.MaxSize}}, max-file={{.HostConfig.LogConfig.Config.MaxFiles}}' $(docker ps -a --format '{{.Names}}')

# Expected output:
# loki: log-driver=json-file, max-size=10m, max-file=3
# node-exporter: log-driver=json-file, max-size=10m, max-file=3
```

### Log Location

```bash
# Find log file location
docker inspect --format='{{.LogPath}}' <container>

# Usually: /var/lib/docker/containers/<container-id>/<container-id>-json.log
```

### Configuring in docker-compose.yml

```yaml
services:
  myservice:
    image: myimage:latest
    logging:
      driver: json-file
      options:
        max-size: 10m
        max-file: "3"
```

### Viewing Rotated Logs

```bash
# Docker automatically handles rotation, view via:
docker logs <container> --tail 1000

# Or read the log file directly (container must be stopped):
cat /var/lib/docker/containers/<id>/<id>-json.log | jq .log
```

### Log Levels in Application Code

For application logging, use structured formats:

```
2026-04-10T14:00:00.000Z INFO  [service] Starting on port 8080
2026-04-10T14:00:01.000Z ERROR [service] Connection refused to database
```

**Do not use:** Debug-level noise in production containers.

---

## 5. Docker Networks

### Homelab Network Architecture

The homelab uses the following networks (per SPEC-023):

| Network | Subnet | Purpose |
|---------|--------|---------|
| `monitoring_monitoring` | 10.0.16.x | Prometheus, Grafana, exporters |
| `bridge` | 10.0.5.x | OpenWebUI, OpenClaw bridge |
| Default (bridge) | 172.17.x.x | Other services |

### Network Commands

```bash
# List all networks
docker network ls

# Inspect network
docker network inspect <network>

# Create network
docker network create --subnet 10.0.20.0/24 my-network

# Connect container to network
docker network connect my-network <container>

# Disconnect container from network
docker network disconnect my-network <container>

# Run container in specific network
docker run --network my-network myimage
```

### Network Modes

| Mode | Description | Use Case |
|------|-------------|----------|
| `bridge` | Default Docker bridge | Standalone containers |
| `host` | Share host network namespace | Performance-critical services |
| `none` | No network | Isolated containers |
| `container:<name>` | Share another container's network | Linked services |

### Compose Network Definition

```yaml
networks:
  monitoring_monitoring:
    driver: bridge
    ipam:
      config:
        - subnet: 10.0.16.0/24

services:
  prometheus:
    networks:
      - monitoring_monitoring
    ports:
      - "9090:9090"
```

### DNS and Service Discovery

Docker's embedded DNS resolves container names to IP addresses within the same network.

```bash
# From prometheus container, resolve loki by name
docker exec prometheus ping loki

# Get container's IP
docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <container>
```

### Verifying Network Connectivity

```bash
# Check if DNS resolves
docker exec <container> nslookup loki

# Check if port is reachable
docker exec <container> curl -sf http://loki:3101/ready

# View network aliases
docker inspect --format='{{range .NetworkSettings.Networks}}{{.Aliases}}{{end}}' <container>
```

---

## 6. Debugging Containers

### Quick Diagnostic Flow

```bash
# 1. Is container running?
docker ps | grep <container>

# 2. What's the status?
docker inspect --format='{{.State.Status}}' <container>

# 3. What's the health?
docker inspect --format='{{.State.Health.Status}}' <container>

# 4. How many restarts?
docker inspect --format='{{.RestartCount}}' <container>

# 5. What are the recent logs?
docker logs <container> --tail 100 --timestamps

# 6. Is it OOM killed?
docker inspect --format='OOMKilled: {{.State.OOMKilled}}' <container>

# 7. What's the exit code?
docker inspect --format='ExitCode: {{.State.ExitCode}}' <container>

# 8. What resources?
docker stats <container> --no-stream
```

### Common Issues and Solutions

#### Container in Exited State

```bash
# Find exited containers
docker ps -a | grep Exited

# Inspect why it exited
docker inspect <container> --format '{{.State.ExitCode}}'
docker logs <container> --tail 50

# Restart
docker start <container>
```

#### Container in Created State (Never Started)

```bash
# Usually indicates the entrypoint failed
docker start <container>
docker logs <container> --tail 100

# Common fix: check volumes, environment variables
docker inspect <container> | jq '.Config.Env'
docker inspect <container> | jq '.Config.Volumes'
```

#### Restart Loop Detection

```bash
# Check restart count and timestamps
for c in $(docker ps -a --format '{{.Names}}'); do
  count=$(docker inspect --format '{{.RestartCount}}' "$c")
  if [[ "$count" -gt 3 ]]; then
    echo "HIGH RESTART: $c (count=$count)"
    docker inspect --format='Last start: {{.State.StartedAt}}' "$c"
    docker logs "$c" --tail 20 --timestamps
  fi
done
```

#### High Memory / OOM Kills

```bash
# Check dmesg for OOM killer
dmesg | grep -i "killed process"
dmesg | grep -i "oom"

# Check journalctl
journalctl -k | grep -i "oom"

# Memory limit on container
docker inspect --format='Memory: {{.HostConfig.Memory}}' <container>

# If 0, no limit set. If positive, limit is in bytes.
```

#### Network Connectivity Issues

```bash
# Check container's IP and network
docker inspect --format='{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}' <container>

# Test from inside container
docker exec <container> ping google.com

# Check DNS resolution
docker exec <container> nslookup google.com

# Check exposed ports
docker port <container>

# Test endpoint from host
curl -sf http://localhost:PORT/PATH
```

#### Disk Space Issues

```bash
# Docker disk usage
docker system df

# Detailed breakdown
docker system df -v

# Prune unused data
docker system prune -a

# Remove stopped containers
docker container prune

# Remove dangling images
docker image prune

# Full cleanup (careful!)
docker system prune -a --volumes
```

### Full Diagnostic Script

From `docker-health-watcher.md`:

```bash
# Exit code
docker inspect <container> --format '{{.State.ExitCode}}'

# OOM killed
docker inspect <container> --format '{{.State.OOMKilled}}'

# Last logs
docker logs <container> --tail 50

# Resource usage
docker stats <container> --no-stream

# Health check status
docker inspect <container> --format 'Health: {{.State.Health.Status}}'

# Mounts (disk issues)
docker inspect <container> --format '{{range .Mounts}}{{.Source}} -> {{.Destination}} ({{.Mode}}) {{end}}'

# Restart timestamps
docker inspect <container> --format '{{.State.StartedAt}} {{.State.FinishedAt}}'
```

### Debugging with docker events

```bash
# Watch all container events in real-time
docker events --filter "type=container"

# Filter by specific container
docker events --filter "type=container" --filter "name=<container>"

# Filter by event type
docker events --filter "type=container" --filter "event=restart"

# Events since specific time
docker events --since "2026-04-10T14:00:00"
```

---

## 7. Restart Policies

### Policy Types

| Policy | Behavior | Use Case |
|--------|----------|----------|
| `no` | Never restart | Debug, one-off tasks |
| `always` | Always restart | Services that should always run |
| `unless-stopped` | Restart unless manually stopped | **Most services** |
| `on-failure` | Restart on non-zero exit | Batch jobs |

### Homelab Standard: `unless-stopped`

Per SPEC-023, the standard restart policy for homelab services is `unless-stopped`:

```yaml
services:
  myservice:
    restart: unless-stopped
```

This means:
- Container restarts automatically after Docker daemon restart
- Container does NOT restart if you manually `docker stop`
- Container DOES restart if the container itself crashes

### Configuring Restart Policy

```bash
# On docker run
docker run --restart unless-stopped myimage

# In compose
services:
  myservice:
    restart: unless-stopped

# Change on existing container
docker update --restart unless-stopped <container>
```

### Verify Restart Policy

```bash
docker inspect --format='RestartPolicy: Name={{.HostConfig.RestartPolicy.Name}}' <container>
```

---

## 8. Pinned/Immutable Containers

### What Makes a Container Immutable

Per `IMMUTABLE-SERVICES.md`:

1. **Image pinned to digest SHA256** — never `:latest` or mutable tags
2. **Configuration version-controlled**
3. **No manual restarts without approval**
4. **No config changes without snapshot + approval**

### Pinned Container Registry (Homelab)

The following containers are **PINNED** and should never be auto-restarted:

```bash
PINNED_CONTAINERS=(
  "coolify-db"          # Database - restart manual only
  "coolify-proxy"       # Traefik - restart breaks all routing
  "coolify-redis"       # Redis - state critical
  "prometheus"          # TSDB - restart loses data
  "grafana"             # Dashboards - restart causes visual downtime
  "loki"                # Logs - restart loses buffer
  "alertmanager"        # Alerts - restart loses silence windows
  "n8n-jbu1zy377ies2zhc3qmd03gz"  # n8n - workflows critical
  "cloudflared"         # Tunnel - restart breaks routing
  "openclaw-qgtzrmi6771lt8l7x8rqx72f"  # Voice bot
  "zappro-kokoro"       # TTS
  "zappro-tts-bridge"   # TTS bridge
  "zappro-wav2vec2"     # STT GPU inference
)
```

### Verification Before Restart

Always verify container is not pinned before restarting:

```bash
is_pinned() {
  local container=$1
  local pinned=("coolify-db" "coolify-proxy" "coolify-redis" "prometheus" "grafana" "loki" "alertmanager" "n8n-jbu1zy377ies2zhc3qmd03gz" "cloudflared")
  for p in "${pinned[@]}"; do
    [[ "$container" == "$p" ]] && return 0
  done
  return 1
}

if is_pinned "$container"; then
  echo "ERROR: $container is PINNED - cannot restart"
  exit 1
fi
```

### Image Pinning to Digest

**FORBIDDEN:**
```yaml
image: prom/prometheus:latest
image: prom/prometheus:v2.54.0
```

**CORRECT:**
```yaml
image: prom/prometheus@sha256:a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd
```

To get digest:
```bash
docker pull prom/prometheus:v3.11.1
docker inspect prom/prometheus:v3.11.1 --format '{{index .RepoDigests 0}}'
# Output: prom/prometheus@sha256:a1b2c3d4e5f678...
```

---

## 9. Restart Loop Protection

### Detection Criteria

Per SPEC-024, a container is in restart loop when:

| Condition | Threshold | Severity |
|-----------|-----------|----------|
| RestartCount >= 3 within 1 hour | `docker inspect --format '{{.RestartCount}}'` | CRITICAL |
| Average restart interval < 30 seconds | Calculate from StartedAt/FinishedAt | CRITICAL |
| RestartCount > 10 since last start | | CRITICAL |

### Algorithm

```
For each container:
  restart_count = count_restarts_last_1h(container)
  intervals = get_restart_intervals_last_1h(container)
  avg_interval = mean(intervals)

  if restart_count >= 3 AND avg_interval < 30s:
    → BLOCK restart for 10 minutes
    → CREATE ZFS snapshot tank@heal-blocked-YYYYMMDD-HHMMSS
    → SEND Telegram CRITICAL alert
    → LOG to /srv/ops/ai-governance/logs/docker-health-watcher.log
  else if restart_count >= 3:
    → CREATE ZFS snapshot before next restart
    → SEND Telegram WARNING alert
```

### Rate Limit Tracking

State file: `/srv/ops/agents/state/docker-blocked.json`

```json
{
  "container_name": {
    "blocked_at": "2026-04-10T14:00:00Z",
    "reason": "restart_loop",
    "cooldown_until": "2026-04-10T14:10:00Z"
  }
}
```

### Cooldown Procedure

After 10-minute block:
1. Check if `current_time > cooldown_until`
2. If yes: remove from blocked list, attempt restart
3. Monitor for 2 minutes
4. If it loops again (RestartCount increments): leave stopped, require manual intervention

### Flock for Cron Scripts

Prevent double-run of health scripts:

```bash
#!/bin/bash
exec 200>/tmp/health_agent.lock
flock -n 200 || exit 0

# ... script body ...

flock -u 200
```

Cron entry:
```cron
* * * * * flock /tmp/health_agent.lock -n /srv/monorepo/docs/OPERATIONS/SKILLS/health_agent.sh || true
```

---

## 10. Common Workflows

### Workflow: Inspect a Misbehaving Container

```bash
# Step 1: Quick status
docker ps | grep <container>

# Step 2: Deep inspect
docker inspect <container>

# Step 3: Check logs
docker logs <container> --tail 100 --timestamps

# Step 4: Check restart history
docker inspect --format='RestartCount={{.RestartCount}} StartedAt={{.State.StartedAt}}' <container>

# Step 5: Check resources
docker stats <container> --no-stream

# Step 6: Check for OOM
docker inspect --format='OOMKilled={{.State.OOMKilled}} ExitCode={{.State.ExitCode}}' <container>

# Step 7: Enter and investigate
docker exec -it <container> /bin/bash
```

### Workflow: Add HEALTHCHECK to a Container

```bash
# 1. Edit docker-compose.yml
# Add under service:
healthcheck:
  test: ["CMD-SHELL", "wget -qO- http://localhost:PORT/PATH || exit 1"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 10s

# 2. Recreate container
docker compose up -d <service> --force-recreate

# 3. Verify
sleep 35
docker inspect --format='{{.State.Health.Status}}' <container>

# 4. Check in Prometheus
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.instance == "<service>")'
```

### Workflow: ZFS Snapshot Before Container Changes

```bash
# 1. Create snapshot
SNAPSHOT="tank@pre-$(docker inspect --format '{{.Name}}' <container> | tr -d '/')-$(date +%Y%m%d-%H%M%S)"
sudo zfs snapshot -r "$SNAPSHOT"

# 2. Verify
zfs list -t snapshot | grep "$(basename $SNAPSHOT)"

# 3. Make changes...

# 4. If something breaks, rollback:
sudo zfs rollback -r "$SNAPSHOT"
docker compose restart <service>
```

### Workflow: Safe Container Restart

```bash
# 1. Check if pinned
is_pinned <container> && echo "PINNED - abort" && exit 1

# 2. Check restart count
rc=$(docker inspect --format '{{.RestartCount}}' <container>)
[[ "$rc" -gt 3 ]] && echo "WARNING: RestartCount=$rc - investigate first"

# 3. Create snapshot
sudo zfs snapshot -r "tank@pre-<container>-$(date +%Y%m%d-%H%M%S)"

# 4. Restart
docker restart <container>

# 5. Verify
sleep 5
docker ps | grep <container>
curl -sf http://localhost:PORT/health
```

### Workflow: Verify All Containers Have Log Rotation

```bash
for c in $(docker ps --format '{{.Names}}'); do
  max_size=$(docker inspect --format '{{.HostConfig.LogConfig.Config.MaxSize}}' "$c")
  max_file=$(docker inspect --format '{{.HostConfig.LogConfig.Config.MaxFiles}}' "$c")
  if [[ "$max_size" != "10m" || "$max_file" != "3" ]]; then
    echo "MISSING ROTATION: $c (max-size=$max_size, max-file=$max_file)"
  fi
done
```

### Workflow: Full System Health Check

```bash
#!/bin/bash
echo "=== Docker System Health ==="
echo ""

echo "--- Running Containers ---"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "--- Containers with Healthchecks ---"
for c in $(docker ps --format '{{.Names}}'); do
  h=$(docker inspect --format '{{.State.Health.Status}}' "$c" 2>/dev/null || echo "none")
  [[ "$h" != "none" ]] && echo "  $c: $h"
done

echo ""
echo "--- High Restart Count ---"
for c in $(docker ps -a --format '{{.Names}}'); do
  rc=$(docker inspect --format '{{.RestartCount}}' "$c")
  [[ "$rc" -gt 3 ]] && echo "  $c: $rc restarts"
done

echo ""
echo "--- Log Config ---"
docker inspect --format='{{.Name}}: max-size={{.HostConfig.LogConfig.Config.MaxSize}}, max-file={{.HostConfig.LogConfig.Config.MaxFiles}}' $(docker ps -a --format '{{.Names}}') 2>/dev/null | grep -v "10m|3" || echo "  All OK"

echo ""
echo "--- Disk Usage ---"
docker system df

echo ""
echo "=== Complete ==="
```

---

## Quick Reference Card

| Need | Command |
|------|---------|
| List containers | `docker ps -a` |
| Start container | `docker start <c>` |
| Stop container | `docker stop <c>` |
| Restart container | `docker restart <c>` |
| View logs | `docker logs <c> --tail 100 -f` |
| Inspect container | `docker inspect <c>` |
| Check health | `docker inspect --format '{{.State.Health.Status}}' <c>` |
| Check restarts | `docker inspect --format '{{.RestartCount}}' <c>` |
| Resource usage | `docker stats <c> --no-stream` |
| Execute shell | `docker exec -it <c> /bin/bash` |
| Get IP | `docker inspect --format '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' <c>` |
| Log rotation | `docker inspect --format 'max-size={{.HostConfig.LogConfig.Config.MaxSize}}' <c>` |
| Compose up | `docker compose up -d` |
| Compose down | `docker compose down` |
| Compose logs | `docker compose logs -f <service>` |
| Prune system | `docker system prune -a` |

---

## Related Documents

- `SPEC-023-unified-monitoring-self-healing.md` — Monitoring stack spec
- `SPEC-024-unified-monitoring-self-healing-implementation.md` — Implementation details
- `IMMUTABLE-SERVICES.md` — Governance rules for pinned services
- `docker-health-watcher.md` — Restart loop detection skill
- `container-self-healer.md` — Container restart skill
- `container-health-check.md` — Health verification system

---

**Authority:** will-zappro
**Last Updated:** 2026-04-11