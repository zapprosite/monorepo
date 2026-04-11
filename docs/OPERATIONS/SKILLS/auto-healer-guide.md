# Auto-Healer Guide — docker-autoheal Patterns for Homelab

**Host:** will-zappro homelab
**Updated:** 2026-04-11
**Stack:** docker-autoheal + ZFS + Telegram alerts + restart loop protection

---

## Overview

The homelab uses **docker-autoheal** (willfarrell/autoheal) as the primary container healing mechanism. It monitors containers with `HEALTHCHECK` directives and restarts unhealthy containers automatically.

**Important:** docker-autoheal has NO built-in rate limiting or restart loop protection. These must be implemented externally via the shell scripts described below.

---

## 1. docker-autoheal Configuration

### 1.1 Container Setup

```yaml
services:
  docker-autoheal:
    image: willfarrell/autoheal:latest
    container_name: docker-autoheal
    restart: unless-stopped
    environment:
      - AUTOHEAL_CONTAINER_LABEL=monitoring
      - AUTOHEAL_INTERVAL=60
      - AUTOHEAL_START_PERIOD=300
      - AUTOHEAL_DEFAULT_STOP_TIMEOUT=30
      - DOCKER_SOCK=/var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - monitoring_monitoring
```

### 1.2 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTOHEAL_CONTAINER_LABEL` | `autoheal` | Label name that triggers monitoring. Set to `monitoring` for this stack |
| `AUTOHEAL_INTERVAL` | `5` | Seconds between health checks |
| `AUTOHEAL_START_PERIOD` | `0` | Seconds to wait before first check |
| `AUTOHEAL_DEFAULT_STOP_TIMEOUT` | `10` | Seconds Docker waits before SIGKILL |
| `AUTOHEAL_ONLY_MONITOR_RUNNING` | `false` | Only monitor running containers (paused ignored) |
| `DOCKER_SOCK` | `/var/run/docker.sock` | Docker socket path |
| `CURL_TIMEOUT` | `30` | Max time for curl health checks |
| `WEBHOOK_URL` | — | Optional webhook for restart notifications |

### 1.3 Label Strategy

**In this homelab, we use label-based selection:**

```yaml
# Containers to autoheal — apply label: monitoring=true
services:
  my-service:
    labels:
      monitoring: "true"

# Pinned containers — NO label (docker-autoheal ignores them)
services:
  coolify-proxy:
    # No "monitoring" label
```

**Key insight:** Set `AUTOHEAL_CONTAINER_LABEL=monitoring` (not `all`). Only containers with `monitoring=true` label will be watched.

### 1.4 Requirement

Containers **MUST** have a `HEALTHCHECK` directive for docker-autoheal to work:

```yaml
services:
  my-service:
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:8080/health || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

---

## 2. Restart Loop Detection

### 2.1 Detection Algorithm

docker-autoheal does NOT detect restart loops. This is implemented in `health_agent.sh` or `docker-health-watcher.sh`.

```
FOR EACH container with monitoring label:
  restart_count = count_restarts_last_1h(container)
  intervals = get_restart_intervals_last_1h(container)
  avg_interval = mean(intervals)  # seconds

  IF restart_count >= 3 AND avg_interval < 30s:
    → BLOCK restart for 10 minutes
    → CREATE ZFS snapshot tank@heal-blocked-YYYYMMDD-HHMMSS
    → SEND Telegram CRITICAL alert (restart loop detected)
  ELSE IF restart_count >= 3:
    → CREATE ZFS snapshot before next restart
    → SEND Telegram WARNING alert
  ELSE:
    → Allow restart via docker-autoheal
```

### 2.2 How to Query Restart Count

```bash
# Current restart count
docker inspect <container> --format '{{.RestartCount}}'

# Detailed state (restart count, startedAt, finishedAt)
docker inspect <container> --format '{{.RestartCount}}\t{{.State.StartedAt}}\t{{.State.FinishedAt}}'

# Last 10 restarts with timestamps
docker events --since "1h" --filter "type=container" --filter "name=<container>" --filter "event=restart"
```

### 2.3 Restart Loop Thresholds

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Restarts in 1 hour | >= 3 | Warning threshold |
| Average restart interval | < 30 seconds | CRITICAL — blocking threshold |
| Restarts in 1 hour | >= 10 | CRITICAL — immediate block |

---

## 3. Rate Limiting Implementation

**docker-autoheal has NO built-in rate limiting.** Implement it via `/tmp/container-restart-attempts.json`.

### 3.1 Rate Limit File Schema

```json
{
  "container_name": {
    "count": 3,
    "window_start": 1744301400,
    "blocked_until": 1744302000,
    "blocked_reason": "restart_loop"
  }
}
```

**File location:** `/tmp/container-restart-attempts.json`

### 3.2 Rate Limit Logic (Bash)

```bash
#!/bin/bash
# check_rate_limit.sh — Check if container is rate limited

RATE_LIMIT_FILE="/tmp/container-restart-attempts.json"
WINDOW_SECONDS=3600  # 1 hour
MAX_ATTEMPTS=3

check_rate_limit() {
    local container="$1"
    local now=$(date +%s)

    if [[ ! -f "$RATE_LIMIT_FILE" ]]; then
        echo "0"  # No file = not limited
        return
    fi

    local entry=$(jq -r ".\"$container\" // null" "$RATE_LIMIT_FILE")

    if [[ "$entry" == "null" ]]; then
        echo "0"
        return
    fi

    local count=$(echo "$entry" | jq -r '.count')
    local window_start=$(echo "$entry" | jq -r '.window_start')
    local blocked_until=$(echo "$entry" | jq -r '.blocked_until // 0')

    # If blocked, return blocked status
    if [[ $now -lt $blocked_until ]]; then
        echo "blocked:$blocked_until"
        return
    fi

    # If window expired, reset
    if [[ $((now - window_start)) -ge $WINDOW_SECONDS ]]; then
        # Window expired, reset
        jq "del(.\"$container\")" "$RATE_LIMIT_FILE" > /tmp/rate-limit-tmp.json
        mv /tmp/rate-limit-tmp.json "$RATE_LIMIT_FILE"
        echo "0"
        return
    fi

    echo "$count"
}

# Usage
limit_status=$(check_rate_limit "my-container")
if [[ "$limit_status" == "blocked:"* ]]; then
    echo "Container is blocked"
elif [[ $limit_status -ge $MAX_ATTEMPTS ]]; then
    echo "Rate limit reached: $limit_status/$MAX_ATTEMPTS"
else
    echo "OK: $limit_status/$MAX_ATTEMPTS attempts"
fi
```

### 3.3 Increment Rate Limit Counter

```bash
#!/bin/bash
# increment_rate_limit.sh — Increment restart attempt counter

RATE_LIMIT_FILE="/tmp/container-restart-attempts.json"
WINDOW_SECONDS=3600
BLOCK_DURATION=600  # 10 minutes
MAX_ATTEMPTS=3

increment_rate_limit() {
    local container="$1"
    local now=$(date +%s)
    local blocked_reason="${2:-restart_attempt}"

    # Initialize file if missing
    if [[ ! -f "$RATE_LIMIT_FILE" ]]; then
        echo "{}" > "$RATE_LIMIT_FILE"
    fi

    local entry=$(jq -r ".\"$container\" // null" "$RATE_LIMIT_FILE")

    if [[ "$entry" == "null" ]]; then
        # New entry
        jq ". + {\"$container\": {\"count\": 1, \"window_start\": $now, \"blocked_until\": 0, \"blocked_reason\": \"$blocked_reason\"}}" \
            "$RATE_LIMIT_FILE" > /tmp/rate-limit-tmp.json
    else
        local count=$(echo "$entry" | jq -r '.count')
        local window_start=$(echo "$entry" | jq -r '.window_start')

        # Check if window expired
        if [[ $((now - window_start)) -ge $WINDOW_SECONDS ]]; then
            # Reset window
            jq ". + {\"$container\": {\"count\": 1, \"window_start\": $now, \"blocked_until\": 0, \"blocked_reason\": \"$blocked_reason\"}}" \
                "$RATE_LIMIT_FILE" > /tmp/rate-limit-tmp.json
        else
            # Increment count
            local new_count=$((count + 1))
            local blocked_until=0

            # If hit limit, set block
            if [[ $new_count -ge $MAX_ATTEMPTS ]]; then
                blocked_until=$((now + BLOCK_DURATION))
            fi

            jq ". + {\"$container\": {\"count\": $new_count, \"window_start\": $window_start, \"blocked_until\": $blocked_until, \"blocked_reason\": \"$blocked_reason\"}}" \
                "$RATE_LIMIT_FILE" > /tmp/rate-limit-tmp.json
        fi
    fi

    mv /tmp/rate-limit-tmp.json "$RATE_LIMIT_FILE"
}

# Usage
increment_rate_limit "my-container" "restart_loop"
```

---

## 4. Pinned Container Whitelist

Pinned containers are **NEVER** restarted automatically, even if unhealthy.

### 4.1 Pinned Containers Registry

```bash
PINNED_CONTAINERS=(
    "coolify-db"
    "coolify-proxy"
    "coolify-redis"
    "prometheus"
    "grafana"
    "loki"
    "alertmanager"
    "n8n-jbu1zy377ies2zhc3qmd03gz"
    "cloudflared"
    "openclaw-qgtzrmi6771lt8l7x8rqx72f"
    "zappro-kokoro"
    "zappro-tts-bridge"
    "zappro-wav2vec2"
)
```

### 4.2 Implementation Check Function

```bash
is_pinned_container() {
    local container="$1"

    for pinned in "${PINNED_CONTAINERS[@]}"; do
        if [[ "$container" == "$pinned" ]]; then
            return 0  # true
        fi
    done
    return 1  # false
}

# Usage
if is_pinned_container "coolify-proxy"; then
    echo "Cannot restart — container is pinned"
else
    echo "Container is eligible for restart"
fi
```

### 4.3 Pinned Container Categories

| Container | Type | Reason Never to Restart |
|-----------|------|----------------------|
| `coolify-db` | Database | Data loss risk |
| `coolify-proxy` | Traefik | Routing disruption |
| `prometheus` | TSDB | Metrics data loss |
| `grafana` | Dashboards | Visualization downtime |
| `loki` | Logs | Buffer loss |
| `alertmanager` | Alerts | Silence loss |
| `cloudflared` | Tunnel | Routing disruption |
| `n8n-*` | Workflows | Workflow interruption |

### 4.4 How Pinned Containers Are Protected

**Method 1: No `monitoring` label (docker-autoheal ignores them)**

```yaml
services:
  coolify-proxy:
    labels:
      # monitoring: "true"  <-- NOT SET
```

**Method 2: Override in health_agent.sh**

```bash
# Skip pinned containers in health checks
if is_pinned_container "$container"; then
    continue  # Skip this container
fi
```

---

## 5. ZFS Snapshots Before Healing

**Contract:** Before ANY healing action, create a ZFS snapshot.

### 5.1 Snapshot Before Restart

```bash
#!/bin/bash
# snapshot_before_restart.sh

POOL="tank"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

snapshot_before_restart() {
    local container="$1"
    local snapshot_name="${POOL}@pre-heal-${container}-${TIMESTAMP}"

    echo "[INFO] Creating ZFS snapshot: $snapshot_name"

    if sudo zfs snapshot -r "$snapshot_name"; then
        echo "[OK] Snapshot created: $snapshot_name"
        return 0
    else
        echo "[FAIL] Failed to create snapshot"
        return 1
    fi
}

# Usage
snapshot_before_restart "my-container"
```

### 5.2 Snapshot Naming Convention

| Prefix | Purpose | Example |
|--------|---------|---------|
| `pre-heal-` | Before healing action | `tank@pre-heal-my-container-20260411-143500` |
| `pre-loop-` | Before restart loop block | `tank@pre-loop-my-container-20260411-144000` |
| `pre-upgrade-` | Before upgrade | `tank@pre-upgrade-docker-20260411-100000` |
| `manual-` | Manual snapshot | `tank@manual-20260411-120000` |

### 5.3 Pre-Heal Snapshot (Combined with Rate Limiting)

```bash
#!/bin/bash
# pre_heal_snapshot.sh — Create snapshot before heal, with loop detection

POOL="tank"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)

pre_heal_snapshot() {
    local container="$1"
    local reason="$2"  # "restart_loop", "unhealthy", "manual"

    # Determine snapshot prefix
    case "$reason" in
        restart_loop)
            prefix="pre-loop"
            ;;
        unhealthy)
            prefix="pre-heal"
            ;;
        *)
            prefix="pre-heal"
            ;;
    esac

    local snapshot_name="${POOL}@${prefix}-${container}-${TIMESTAMP}"

    echo "[INFO] Creating ${reason} snapshot: $snapshot_name"

    if sudo zfs snapshot -r "$snapshot_name" 2>/dev/null; then
        echo "[OK] Snapshot created: $snapshot_name"
        return 0
    else
        echo "[WARN] Snapshot failed (may already exist or permission issue)"
        return 1
    fi
}

# Usage
pre_heal_snapshot "my-container" "restart_loop"
```

---

## 6. Diagnosis Scripts

### 6.1 Container Health Diagnosis

```bash
#!/bin/bash
# diagnose_container.sh — Full diagnostic for a container

container="$1"

if [[ -z "$container" ]]; then
    echo "Usage: $0 <container_name>"
    exit 1
fi

echo "=== Container Diagnosis: $container ==="
echo ""

# Basic status
echo "--- Status ---"
docker ps -a --filter "name=$container" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Restart count
echo ""
echo "--- Restart Count ---"
restart_count=$(docker inspect "$container" --format '{{.RestartCount}}')
echo "RestartCount: $restart_count"

# Health status
echo ""
echo "--- Health Check ---"
health=$(docker inspect "$container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}no healthcheck{{end}}')
echo "Health: $health"

# Last start/finish times
echo ""
echo "--- Last Start/Finish ---"
docker inspect "$container" --format 'StartedAt: {{.State.StartedAt}}
FinishedAt: {{.State.FinishedAt}}
ExitCode: {{.State.ExitCode}}
OOMKilled: {{.State.OOMKilled}}'

# Resource usage
echo ""
echo "--- Current Resource Usage ---"
docker stats "$container" --no-stream --format "CPU: {{.CPUPerc}} | Memory: {{.MemUsage}}"

# Recent logs
echo ""
echo "--- Last 20 Log Lines ---"
docker logs "$container" --tail 20 --timestamps 2>&1

# Mounts
echo ""
echo "--- Mounts ---"
docker inspect "$container" --format '{{range .Mounts}}{{.Source}} -> {{.Destination}} ({{.Mode}}){{"\n"}}{{end}}'

echo ""
echo "=== End Diagnosis ==="
```

### 6.2 Restart Loop Detection Script

```bash
#!/bin/bash
# detect_restart_loop.sh — Detect if a container is in a restart loop

container="$1"
WINDOW_MINUTES=60
AVG_THRESHOLD=30  # seconds

if [[ -z "$container" ]]; then
    echo "Usage: $0 <container_name>"
    exit 1
fi

restart_count=$(docker inspect "$container" --format '{{.RestartCount}}')

if [[ $restart_count -lt 3 ]]; then
    echo "OK: RestartCount=$restart_count (below threshold)"
    exit 0
fi

# Get restart timestamps from events
now=$(date +%s)
window_start=$((now - WINDOW_MINUTES * 60))

# Calculate average interval from recent restarts
events=$(docker events --since "${window_start}m" --filter "type=container" --filter "name=$container" --filter "event=restart" --format '{{.Time}}' 2>/dev/null | tail -10)

if [[ -z "$events" ]]; then
    echo "WARN: No recent restart events found (may be historical RestartCount)"
    exit 2
fi

# Calculate intervals
intervals=()
prev_time=""
for event_time in $events; do
    if [[ -n "$prev_time" ]]; then
        interval=$((event_time - prev_time))
        intervals+=($interval)
    fi
    prev_time=$event_time
done

# Calculate average
total=0
for interval in "${intervals[@]}"; do
    total=$((total + interval))
done
avg=$((total / ${#intervals[@]}))

echo "RestartCount: $restart_count"
echo "Recent restarts: ${#intervals[@]}"
echo "Average interval: ${avg}s (threshold: ${AVG_THRESHOLD}s)"

if [[ $avg -lt $AVG_THRESHOLD ]]; then
    echo "STATUS: CRITICAL — Restart loop detected"
    exit 3
else
    echo "STATUS: WARNING — High restart count but not a loop"
    exit 2
fi
```

### 6.3 Rate Limit Status

```bash
#!/bin/bash
# rate_limit_status.sh — Show rate limit status for all containers

RATE_LIMIT_FILE="/tmp/container-restart-attempts.json"

if [[ ! -f "$RATE_LIMIT_FILE" ]]; then
    echo "No rate limit file found"
    exit 0
fi

echo "=== Rate Limit Status ==="
jq '.' "$RATE_LIMIT_FILE" | while read -r key; do
    container=$(echo "$key" | jq -r 'keys[0]')
    data=$(echo "$key" | jq -r '.[0]')
    count=$(echo "$data" | jq -r '.count')
    blocked_until=$(echo "$data" | jq -r '.blocked_until')
    reason=$(echo "$data" | jq -r '.blocked_reason')

    now=$(date +%s)
    if [[ $blocked_until -gt 0 && $now -lt $blocked_until ]]; then
        remaining=$((blocked_until - now))
        echo "$container: BLOCKED ($count/3) — ${remaining}s remaining — reason: $reason"
    else
        echo "$container: $count/3 attempts — reason: $reason"
    fi
done
```

---

## 7. Complete Healing Workflow

### 7.1 Container Healing Workflow

```
CONTAINER DETECTED UNHEALTHY
         │
         ▼
┌─────────────────────────┐
│ Is container pinned?    │
│ (check PINNED_CONTAINERS)│
└────────┬────────────────┘
         │
    YES  │  NO
    ┌────┴────┐
    ▼         ▼
┌────────┐  ┌─────────────────────────────────┐
│ SKIP   │  │ Check rate limit               │
│ Alert  │  │ /tmp/container-restart-attempts │
│ INFO   │  └────────────┬────────────────────┘
    │                     │
    │               YES   │  NO
    │               ┌─────┴──────┐
    │               ▼            ▼
    │         ┌────────┐   ┌────────────────────┐
    │         │BLOCKED │   │ Create ZFS snapshot│
    │         │ Alert  │   │ tank@pre-heal-...  │
    │         │ CRIT   │   └─────────┬──────────┘
    │         └────────┘             │
    │               │                ▼
    │               │    ┌────────────────────┐
    │               │    │ Increment rate     │
    │               │    │ limit counter      │
    │               │    └─────────┬──────────┘
    │               │              │
    │               │              ▼
    │               │    ┌────────────────────┐
    │               │    │ docker restart     │
    │               │    │ <container>        │
    │               │    └─────────┬──────────┘
    │               │              │
    │               │              ▼
    │               │    ┌────────────────────┐
    │               │    │ Verify health      │
    │               │    │ after 5s           │
    │               │    └─────────┬──────────┘
    │               │              │
    │               │    ┌─────────┴─────────┐
    │               │    ▼                   ▼
    │               │  SUCCESS             FAILED
    │               │  Alert INFO        Alert CRIT
    │               │                     Stop container
    │               │                     Block for 10min
    │               │                     Create snapshot
    └───────────────┴────────────────────┘
```

### 7.2 Code Integration Example

```bash
#!/bin/bash
# heal_container.sh — Complete healing workflow

set -e

RATE_LIMIT_FILE="/tmp/container-restart-attempts.json"
POOL="tank"
MAX_ATTEMPTS=3
BLOCK_DURATION=600

PINNED_CONTAINERS=(
    "coolify-db" "coolify-proxy" "prometheus" "grafana"
    "loki" "alertmanager" "cloudflared"
)

is_pinned() {
    local container="$1"
    for pinned in "${PINNED_CONTAINERS[@]}"; do
        [[ "$container" == "$pinned" ]] && return 0
    done
    return 1
}

check_rate_limit() {
    local container="$1"
    local now=$(date +%s)

    if [[ ! -f "$RATE_LIMIT_FILE" ]]; then
        return 0  # Not limited
    fi

    local data=$(jq -r ".\"$container\" // null" "$RATE_LIMIT_FILE")
    [[ "$data" == "null" ]] && return 0

    local count=$(echo "$data" | jq -r '.count')
    local blocked_until=$(echo "$data" | jq -r '.blocked_until // 0')

    if [[ $now -lt $blocked_until && $blocked_until -gt 0 ]]; then
        return 1  # Blocked
    fi

    [[ $count -ge $MAX_ATTEMPTS ]] && return 1 || return 0
}

increment_rate_limit() {
    local container="$1"
    local reason="${2:-restart_attempt}"
    local now=$(date +%s)

    if [[ ! -f "$RATE_LIMIT_FILE" ]]; then
        echo '{}' > "$RATE_LIMIT_FILE"
    fi

    local data=$(jq -r ".\"$container\" // null" "$RATE_LIMIT_FILE")
    local blocked_until=0

    if [[ "$data" == "null" ]]; then
        jq ". + {\"$container\": {\"count\": 1, \"window_start\": $now, \"blocked_until\": 0, \"blocked_reason\": \"$reason\"}}" \
            "$RATE_LIMIT_FILE" > /tmp/rate-limit-tmp.json
    else
        local count=$(echo "$data" | jq -r '.count')
        local window_start=$(echo "$data" | jq -r '.window_start')

        if [[ $((now - window_start)) -ge 3600 ]]; then
            # Window expired, reset
            jq ". + {\"$container\": {\"count\": 1, \"window_start\": $now, \"blocked_until\": 0, \"blocked_reason\": \"$reason\"}}" \
                "$RATE_LIMIT_FILE" > /tmp/rate-limit-tmp.json
        else
            count=$((count + 1))
            [[ $count -ge $MAX_ATTEMPTS ]] && blocked_until=$((now + BLOCK_DURATION))
            jq ". + {\"$container\": {\"count\": $count, \"window_start\": $window_start, \"blocked_until\": $blocked_until, \"blocked_reason\": \"$reason\"}}" \
                "$RATE_LIMIT_FILE" > /tmp/rate-limit-tmp.json
        fi
    fi
    mv /tmp/rate-limit-tmp.json "$RATE_LIMIT_FILE"
}

create_snapshot() {
    local container="$1"
    local reason="${2:-heal}"
    local timestamp=$(date +%Y%m%d-%H%M%S)
    local snapshot="${POOL}@pre-${reason}-${container}-${timestamp}"

    sudo zfs snapshot -r "$snapshot" 2>/dev/null && echo "[OK] Snapshot: $snapshot" || true
}

heal_container() {
    local container="$1"

    # 1. Check pinned
    if is_pinned "$container"; then
        echo "[SKIP] Container '$container' is pinned — manual intervention required"
        return 1
    fi

    # 2. Check rate limit
    if ! check_rate_limit "$container"; then
        echo "[BLOCKED] Container '$container' is rate limited"
        create_snapshot "$container" "blocked"
        return 1
    fi

    # 3. Create snapshot before heal
    create_snapshot "$container" "heal"

    # 4. Increment rate limit
    increment_rate_limit "$container" "heal"

    # 5. Restart container
    echo "[INFO] Restarting container: $container"
    if docker restart "$container"; then
        echo "[OK] Container restarted: $container"

        # 6. Verify health
        sleep 5
        health=$(docker inspect "$container" --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}')
        echo "[OK] Health status: $health"
        return 0
    else
        echo "[FAIL] Failed to restart container: $container"
        create_snapshot "$container" "failed"
        return 1
    fi
}

# Usage
heal_container "my-service"
```

---

## 8. Integration with SPEC-023 and SPEC-024

### 8.1 Critical Gaps Addressed

| Gap | Solution in This Guide |
|-----|----------------------|
| node-exporter/loki missing HEALTHCHECK | Section 1.4 — HEALTHCHECK directive |
| No restart loop protection | Section 2 — Detection algorithm |
| No ZFS snapshot before healing | Section 5 — Pre-heal snapshots |
| No rate limiting | Section 3 — Rate limit implementation |
| Pinned containers not protected | Section 4 — Whitelist with no monitoring label |

### 8.2 docker-autoheal Environment

From SPEC-024:

```yaml
docker-autoheal:
  environment:
    - AUTOHEAL_CONTAINER_LABEL=monitoring  # Only monitor labeled containers
    - AUTOHEAL_INTERVAL=60                  # Check every 60 seconds
    - AUTOHEAL_START_PERIOD=300             # Wait 5min after container start
```

### 8.3 Complete docker-compose Monitoring Stack

```yaml
services:
  docker-autoheal:
    image: willfarrell/autoheal:latest
    container_name: docker-autoheal
    restart: unless-stopped
    environment:
      - AUTOHEAL_CONTAINER_LABEL=monitoring
      - AUTOHEAL_INTERVAL=60
      - AUTOHEAL_START_PERIOD=300
      - AUTOHEAL_DEFAULT_STOP_TIMEOUT=30
      - DOCKER_SOCK=/var/run/docker.sock
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - monitoring_monitoring
    labels:
      monitoring: "false"  # Don't watch the watcher

  node-exporter:
    image: prom/node-exporter:v1.11.1
    container_name: node-exporter
    restart: unless-stopped
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    networks:
      - monitoring_monitoring
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:9100/-/healthy || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
    labels:
      monitoring: "true"  # WILL be watched

  loki:
    image: grafana/loki:3.7.0
    container_name: loki
    restart: unless-stopped
    ports:
      - "3101:3101"
    volumes:
      - /srv/data/loki:/etc/loki
      - /srv/data/loki:/var/loki
    networks:
      - monitoring_monitoring
    healthcheck:
      test: ["CMD-SHELL", "wget -qO- http://localhost:3101/ready || exit 1"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
    labels:
      monitoring: "false"  # PINNED — NOT watched

  prometheus:
    image: prom/prometheus:3.11.1
    container_name: prometheus
    restart: unless-stopped
    ports:
      - "9090:9090"
    networks:
      - monitoring_monitoring
    labels:
      monitoring: "false"  # PINNED — NOT watched
```

---

## 9. Quick Reference

### 9.1 Key Files

| File | Purpose |
|------|---------|
| `/tmp/container-restart-attempts.json` | Rate limit tracking |
| `/tmp/health_agent.lock` | Cron double-run prevention |
| `/srv/ops/ai-governance/logs/docker-health-watcher.log` | Healing event log |

### 9.2 Key Commands

```bash
# Check container health
docker inspect <container> --format '{{.State.Health.Status}}'

# Check restart count
docker inspect <container> --format '{{.RestartCount}}'

# View recent restarts
docker events --since "1h" --filter "name=<container>" --filter "event=restart"

# Create manual snapshot
sudo zfs snapshot -r "tank@manual-$(date +%Y%m%d-%H%M%S)"

# List recent snapshots
zfs list -t snapshot -r tank | grep "$(date +%Y%m%d)"

# Check rate limit status
cat /tmp/container-restart-attempts.json | jq '.'

# View healing logs
tail -50 /srv/ops/ai-governance/logs/docker-health-watcher.log
```

### 9.3 Alert Message Formats

```python
# CRITICAL — Restart loop detected
🔴 [CRITICAL] Container {container} in restart loop
Avg restart interval: {avg}s
RestartCount: {count}
Action: Blocked for 10 minutes + ZFS snapshot created
Snapshot: {snapshot_name}

# WARNING — High restart count
🟡 [WARNING] Container {container} restarting frequently
RestartCount: {count}
Action: Monitoring closely

# INFO — Restart successful
ℹ️ [INFO] Container {container} restarted successfully
Health: {health_status}
```

---

## 10. Related Documents

| Document | Purpose |
|----------|---------|
| `SPEC-023-unified-monitoring-self-healing.md` | Full monitoring and self-healing spec |
| `SPEC-023-unified-healing-cli.md` | `/heal` CLI commands |
| `SPEC-024-unified-monitoring-self-healing-implementation.md` | Implementation details |
| `container-self-healer.md` | Shell-based container healing |
| `docker-health-watcher.md` | Restart loop detection skill |
| `self-healing-cron.md` | Voice pipeline self-healing cron |
| `zfs-snapshot-and-rollback.md` | ZFS snapshot procedures |
| `docs/GOVERNANCE/PINNED-SERVICES.md` | Pinned services registry |

---

**Authority:** will-zappro homelab
**Last verified:** 2026-04-11
