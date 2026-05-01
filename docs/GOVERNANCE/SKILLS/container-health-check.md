# Skill: Container Health Check

**Purpose:** Comprehensive health verification system for all critical containers in the homelab
**Complexity:** Medium
**Risk:** Read-only (health inspection only)
**When to Use:** Regular monitoring, post-deploy validation, incident triage, automated cron checks

## Overview

This skill provides a complete health verification system for the homelab container stack. It checks container status, health endpoints, resource usage, log errors, and system-level indicators (OOM kills, zombie processes).

The companion script (`container-health-check.sh`) can be run standalone or scheduled via cron.

---

## Container Registry

### Critical Containers (always must be running)

| Container | Purpose | Health Endpoint | Expected Response |
|-----------|---------|----------------|-------------------|
| `openclaw-qgtzrmi6771lt8l7x8rqx72f` | Voice AI Bot | `localhost:8080/healthz` | `200` with JSON |
| `zappro-litellm` | AI Proxy (LLM aggregation) | `localhost:4000/health` | `200` with JSON |
| `zappro-wav2vec2` | STT GPU inference | `localhost:8201/health` | `200` with JSON |
| `zappro-litellm-db` | LiteLLM PostgreSQL | Internal: `pg_isready` | N/A (DB healthcheck) |
| `browser-qgtzrmi6771lt8l7x8rqx72f` | Headless browser for OpenClaw | `tcp:9222` | TCP open |

### High Priority Containers

| Container | Purpose |
|-----------|---------|
| `open-webui-wbmqefxhd7vdn2dme3i6s9an` | Open WebUI |
| `perplexity-agent` | Perplexity AI agent |
| `grafana` | Metrics dashboards |
| `prometheus` | Metrics collection |
| `alertmanager` | Alert routing |

---

## Health Check Components

### 1. Container Status

```bash
docker ps --filter "name=<container>" --format '{{.Status}}'
```

Possible states:
- `Up X minutes (healthy)` — running and healthy
- `Up X minutes` — running, no healthcheck defined
- `Up X minutes (starting)` — healthcheck running
- `Exited X` — stopped
- (no output) — container missing

Helper function: `container_status()`

```
Returns: RUNNING | RESTARTING | STOPPED | UNKNOWN | MISSING
```

### 2. Health Endpoint Verification

For each container with a defined health endpoint, perform an HTTP or TCP check:

```bash
# HTTP endpoint
curl -sf -m 5 -o /dev/null -w "%{http_code}" http://localhost:4000/health

# TCP endpoint (browser remote debugging)
timeout 3 bash -c "echo >/dev/tcp/localhost/9222" && echo "open" || echo "closed"
```

### 3. Process Health

Check for restart loops, OOM kills, and zombie processes:

```bash
# Restart count (should be 0 or very low)
docker inspect <container> --format '{{.RestartCount}}'

# OOM kills in dmesg
grep -c "oom-killer" /var/log/dmesg

# Zombie process detection
ps -o stat= -p $(docker inspect <container> --format '{{.State.Pid}}') | grep -c "Z"
```

### 4. Resource Usage

```bash
# CPU and memory (one shot, no streaming)
docker stats <container> --no-stream --format '{{.CPUPerc}} {{.MemPerc}}'

# Thresholds
CPU_THRESHOLD=80%   # alert if above for > 5 min
MEMORY_THRESHOLD=90% # alert if above
```

### 5. Log Analysis

```bash
# Count ERROR lines in last 50 log lines
docker logs <container> --tail 50 2>&1 | grep -c -i "ERROR"

# Count WARN lines
docker logs <container> --tail 50 2>&1 | grep -c -i -E "(WARN|WARNING)"

# Grep for segfaults/panics
docker logs <container> --tail 100 2>&1 | grep -E "(segfault|panic|fatal)"
```

---

## Helper Functions Reference

### `container_status <container>`

Returns the Docker container status as a normalized string.

```bash
container_status "openclaw-qgtzrmi6771lt8l7x8rqx72f"
# Output: RUNNING | RESTARTING | STOPPED | UNKNOWN | MISSING
```

### `container_health <container>`

Returns the healthcheck status. Returns `NO_HEALTHCHECK` if the container has no healthcheck configured.

```bash
container_health "openclaw-qgtzrmi6771lt8l7x8rqx72f"
# Output: HEALTHY | UNHEALTHY | STARTING | NO_HEALTHCHECK | MISSING
```

### `container_restart_count <container>`

Returns the number of times the container has restarted since its last start.

```bash
container_restart_count "zappro-litellm"
# Output: 0 (integer)
```

### `container_logs_errors <container>`

Counts ERROR-level log lines in the last 50 lines.

```bash
container_logs_errors "zappro-litellm"
# Output: 0 (integer)
```

### `container_cpu <container>`

Returns the current CPU percentage usage.

```bash
container_cpu "zappro-wav2vec2"
# Output: 0.50 (float, percentage)
```

### `container_memory_percent <container>`

Returns the current memory percentage usage.

```bash
container_memory_percent "zappro-litellm"
# Output: 12.34 (float, percentage)
```

### `container_memory_usage <container>`

Returns the memory usage as a human-readable string.

```bash
container_memory_usage "zappro-litellm"
# Output: "1.2GiB / 4GiB"
```

### `check_dmesg_oom <container>`

Returns the count of OOM killer events related to this container.

```bash
check_dmesg_oom "zappro-wav2vec2"
# Output: 0 (integer)
```

### `is_zombie_process <container>`

Returns the count of zombie processes for the container's main process.

```bash
is_zombie_process "zappro-litellm"
# Output: 0 (integer)
```

### `check_health_endpoint <endpoint>`

Validates a health endpoint (HTTP or TCP).

```bash
check_health_endpoint "localhost:4000/health"
# Output: 200 | 000 | error

check_health_endpoint "tcp:9222"
# Output: tcp_open | tcp_closed
```

---

## Issue Detection Rules

The health check automatically flags the following issues:

| Issue | Threshold | Severity |
|-------|-----------|----------|
| `CONTAINER_MISSING` | container not found | CRITICAL |
| `CONTAINER_STOPPED` | status != running | CRITICAL |
| `CONTAINER_RESTARTING` | status == restarting | CRITICAL |
| `HEALTH_UNHEALTHY` | docker healthcheck failed | CRITICAL |
| `EXCESSIVE_RESTARTS:N` | restarts > 3 | WARNING |
| `ERRORS_IN_LOGS:N` | error count >= 1 | WARNING |
| `HIGH_CPU:N%` | cpu > 80% | WARNING |
| `HIGH_MEMORY:N%` | memory > 90% | WARNING |
| `OOM_KILLS:N` | oom kills > 0 | CRITICAL |
| `ZOMBIE_PROCESSES:N` | zombie > 0 | WARNING |
| `HEALTH_ENDPOINT_FAILED` | endpoint unreachable | WARNING |
| `HEALTH_ENDPOINT_CODE:N` | unexpected HTTP code | WARNING |

---

## Output Format

### Human-readable output (default)

```
CONTAINER HEALTH CHECK — 2026-04-08 12:00 UTC
==================================================

--- CRITICAL CONTAINERS ---

  [openclaw-qgtzrmi6771lt8l7x8rqx72f]
    Status: RUNNING
    Health: OK

  [zappro-litellm]
    Status: RUNNING
    Health: OK

  [zappro-wav2vec2]
    Status: RUNNING
    Health: OK

--- HIGH PRIORITY CONTAINERS ---

  [open-webui-wbmqefxhd7vdn2dme3i6s9an]
    Status: RUNNING
    Health: OK

==================================================
SUMMARY
  Total containers: 10
  Healthy: 10
  Unhealthy: 0
  Critical down: 0
  Overall status: HEALTHY
```

### JSON output (`--json`)

```json
{
  "timestamp": "2026-04-08T12:00:00Z",
  "containers": [
    {
      "name": "openclaw-qgtzrmi6771lt8l7x8rqx72f",
      "status": "RUNNING",
      "health": "HEALTHY",
      "restarts": 0,
      "cpu_percent": 0.50,
      "mem_percent": 1.20,
      "memory_usage": "150MiB / 4GiB",
      "error_count": 0,
      "warn_count": 0,
      "oom_kills": 0,
      "zombie_processes": 0,
      "health_endpoint": "localhost:8080/healthz",
      "health_endpoint_result": "200",
      "issues": [],
      "overall_status": "HEALTHY"
    }
  ],
  "summary": {
    "total": 10,
    "healthy": 10,
    "unhealthy": 0,
    "critical_down": 0
  },
  "overall_status": "HEALTHY",
  "alerts": []
}
```

---

## Usage

### Run once (human-readable)

```bash
./container-health-check.sh
```

### Run with JSON output (machine-readable)

```bash
./container-health-check.sh --json
```

### Run verbose (debug output)

```bash
./container-health-check.sh --verbose
```

### Cron schedule (every 5 minutes)

```cron
*/5 * * * * /srv/monorepo/docs/OPERATIONS/SKILLS/container-health-check.sh --json >> /srv/ops/logs/container-health.log 2>&1
```

### Integration with self-healing

The `self-healing.sh` script already monitors critical containers. Use `container-health-check.sh` as a more detailed diagnostic alternative when troubleshooting.

---

## Common Failures

| Container | Symptom | Likely Cause | Fix |
|-----------|---------|--------------|-----|
| `openclaw-*` | HTTP 000 | Cloudflare Tunnel down | Check cloudflared status |
| `openclaw-*` | unhealthy | internal server error | Check logs: `docker logs openclaw-qgtzrmi6771lt8l7x8rqx72f` |
| `zappro-litellm` | Connection refused | Process crash | `docker restart zappro-litellm` |
| `zappro-litellm-db` | unhealthy | PostgreSQL not ready | Wait 30s or restart |
| `zappro-wav2vec2` | HIGH_MEMORY | GPU OOM | Reduce batch size or restart |
| `browser-*` | tcp_closed | Browser crashed | `docker restart browser-qgtzrmi6771lt8l7x8rqx72f` |
| Any | EXCESSIVE_RESTARTS | restart loop | Check logs for segfault/panic |

---

## See Also

- `self-healing.sh` — Automated container restart and alerting
- `litellm-health-check.md` — Detailed LiteLLM proxy verification
- `wav2vec2-health-check.md` — Detailed wav2vec2 STT verification
- `kokoro-health-check.md` — Kokoro TTS verification
- `traefik-health-check.md` — Traefik proxy verification
- `oom-killer.md` — OOM kill detection and recovery
