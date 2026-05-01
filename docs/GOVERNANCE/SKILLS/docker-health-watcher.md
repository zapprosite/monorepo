# Skill: docker-health-watcher

**Purpose:** Detect containers in restart loops, block further restart attempts after threshold, snapshot state, alert with actionable diagnostic, and optionally force-stop the looping container to prevent resource exhaustion.

**Host:** will-zappro
**Complexity:** Medium
**Risk:** Medium (stops containers and creates ZFS snapshots)

---

## When to Use

- Scheduled health checks (run via cron or agent loop)
- After receiving Telegram alert about container issues
- Before performing system changes that might trigger crashes
- During low-traffic periods to minimize impact

---

## Preflight Checklist

- [ ] Docker daemon is reachable: `docker ps`
- [ ] ZFS pool is healthy: `zpool status tank`
- [ ] Telegram bot token available in environment
- [ ] Skill log path is writable
- [ ] Protected containers list is current

---

## Detection Logic

### Step 1: Scan All Containers

```bash
docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.RestartCount}}"
```

Collect name, status string, and restart count for every container.

### Step 2: Enrich with Restart Timestamps

For each container with `RestartCount > 0`, run:

```bash
docker inspect <container> --format '{{.RestartCount}}{{"\t"}}{{.State.StartedAt}}{{"\t"}}{{.State.FinishedAt}}'
```

This returns three tab-separated values:
- Current restart count
- Last start timestamp (ISO 8601)
- Last finish timestamp (ISO 8601)

### Step 3: Classify Restart Behavior

Calculate time between restarts using `StartedAt - FinishedAt`.

| Condition | Classification |
|-----------|---------------|
| RestartCount > 10 since last start | LOOPING (critical) |
| RestartCount > 3 within 10 minutes | LOOPING (critical) |
| Average time between restarts < 30 seconds | LOOPING (critical) |
| Average time between restarts < 5 minutes | UNSTABLE (warn) |
| Average time between restarts > 5 minutes | NORMAL (no action) |

### Step 4: Get Last 5 Restart Timestamps

```bash
docker inspect <container> --format '{{range .State.RestartingReason}}{{.}} {{end}}'
docker inspect <container> --format '{{range .Mounts}}{{.Source}}:{{.Destination}} {{end}}'
docker logs <container> --tail=50 --since "10m"
```

If logs are insufficient, check restart history via:

```bash
docker events --since "20m" --filter "type=container" --filter "name=<container>" --filter "event=restart"
```

---

## Decision Tree

```
Scan containers
    │
    ├─ RestartCount == 0 ──→ skip
    │
    ├─ RestartCount > 3 within 10min ──→ goto LOOPING
    │
    ├─ Avg restart interval < 30s ──→ goto LOOPING
    │
    ├─ Avg restart interval 30s–5min ──→ goto UNSTABLE
    │
    └─ Avg restart interval > 5min ──→ log, skip
```

---

## LOOPING Response (Critical)

### Conditions

- RestartCount > 3 within 10 minutes
- OR average restart interval < 30 seconds
- OR RestartCount > 10 since last start

### Protected Container Override

If the container is **protected**, do NOT stop it. Instead:
1. Alert with WARN level: "Protected container <X> is looping but will not be auto-stopped"
2. Log the state
3. Skip cooldown logic
4. Exit

**Protected containers (never auto-stop):**
- cloudflared
- tailscaled
- prometheus
- grafana
- coolify-db
- postgres-*

### Step 1: Snapshot

```bash
SNAPSHOT="tank@pre-loop-<container>-$(date +%Y%m%d-%H%M%S)"
sudo zfs snapshot -r "$SNAPSHOT"
echo "$(date '+%Y-%m-%d %H:%M:%S') | SNAPSHOT | $SNAPSHOT" >> /srv/ops/ai-governance/logs/docker-health-watcher.log
```

### Step 2: Stop Container

```bash
docker stop <container>
```

Uses SIGTERM (default 10s timeout), not SIGKILL. This allows graceful shutdown.

### Step 3: Block Restart

Add entry to blocked list at `/srv/ops/agents/state/docker-blocked.json`:

```json
{
  "<container>": {
    "blocked_at": "<ISO8601>",
    "reason": "restart_loop",
    "cooldown_until": "<ISO8601+10min>"
  }
}
```

### Step 4: Alert

Send to Telegram bot @HOMELAB_LOGS_bot:

```
CRITICAL | Container <X> in restart loop | Stopped for 10min cooldown
Avg restart interval: <N>s
Last exit code: <code>
Snapshot: <snapshot-name>
Manual inspection required.
```

### Step 5: Diagnostics to Capture

```bash
# Exit code
docker inspect <container> --format '{{.State.ExitCode}}'

# OOM killed
docker inspect <container> --format '{{.State.OOMKilled}}'

# Last logs
docker logs <container> --tail=50

# Resource usage
docker stats <container> --no-stream
```

Log all diagnostics to `/srv/ops/ai-governance/logs/docker-health-watcher.log`.

---

## UNSTABLE Response (Warning)

### Conditions

- Average restart interval between 30 seconds and 5 minutes
- RestartCount between 4 and 10

### Action

1. Log warning to `/srv/ops/ai-governance/logs/docker-health-watcher.log`
2. Alert via Telegram (WARN level, not CRITICAL)
3. Do NOT stop the container
4. Do NOT create snapshot (unless one already exists from a previous LOOPING event)

### Alert Message

```
WARN | Container <X> restarting frequently
Avg restart interval: <N>s
RestartCount: <N>
Monitor closely.
```

---

## Cooldown and Retry

### After 10 Minute Cooldown

Check if cooldown has elapsed:

```bash
cat /srv/ops/agents/state/docker-blocked.json | jq '.["<container>"].cooldown_until'
```

If current time > cooldown_until:

1. Remove from blocked list
2. Attempt restart:

```bash
docker start <container>
```

3. Monitor for 2 minutes
4. If it loops again (RestartCount increments within 2 minutes):

```
CRITICAL | Container <X> looped again after cooldown restart | Left stopped
Full logs required for diagnosis.
```

- Leave container stopped
- Do not retry again
- Require manual intervention

---

## Logging

All events go to `/srv/ops/ai-governance/logs/docker-health-watcher.log`.

Format:

```
TIMESTAMP | LEVEL | CONTAINER | ACTION | DETAILS
```

Examples:

```
2026-04-05 02:30:00 | INFO  | all       | scan_start | Scanning 14 containers
2026-04-05 02:30:01 | WARN  | nginx     | unstable  | RestartCount=5, avg=45s
2026-04-05 02:30:02 | CRIT  | api       | looping   | RestartCount=12, avg=8s, stopped
2026-04-05 02:30:02 | INFO  | api       | snapshot  | tank@pre-loop-api-20260405-023002
2026-04-05 02:30:03 | INFO  | api       | blocked   | cooldown_until=2026-04-05T02:40:03Z
2026-04-05 02:40:03 | INFO  | api       | unblock   | Cooldown elapsed, attempting restart
2026-04-05 02:42:03 | CRIT  | api       | reloop    | Looped again after restart, left stopped
```

---

## Full Diagnostic Commands

When manually investigating a crashing container, run:

```bash
# Full restart history
docker inspect <container> --format '{{json .RestartCount}}'

# Last 100 log lines with timestamps
docker logs <container> --tail 100 --timestamps

# OOM status
docker inspect <container> --format 'OOMKilled: {{.State.OOMKilled}}'

# Exit code
docker inspect <container> --format 'ExitCode: {{.State.ExitCode}}'

# Resource limits
docker inspect <container> --format 'Memory: {{.HostConfig.Memory}} | CPUs: {{.HostConfig.NanoCpus}}'

# Current resource usage
docker stats <container> --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}"

# Health check status
docker inspect <container> --format 'Health: {{.State.Health.Status}}'

# Mounts (disk issues)
docker inspect <container> --format '{{range .Mounts}}{{.Source}} -> {{.Destination}} ({{.Mode}}) {{end}}'
```

---

## Skill Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Scan complete, no issues found |
| 1 | LOOPING detected and container stopped |
| 2 | UNSTABLE detected (warning logged) |
| 3 | Re-loop detected after cooldown retry |
| 10 | Docker not reachable |
| 11 | ZFS snapshot failed |
| 12 | Protected container in loop (alert only) |

---

## Validation Checklist

After running the skill:

- [ ] All containers with RestartCount > 0 were evaluated
- [ ] LOOPING containers were correctly identified
- [ ] Protected containers were not stopped
- [ ] ZFS snapshot was created before stopping
- [ ] Blocked list was updated with correct cooldown timestamp
- [ ] Telegram alert was sent
- [ ] Diagnostics were logged
- [ ] Log file has complete timestamped entries

---

## Examples

### Example 1: Normal Scan

```
2026-04-05 03:00:00 | INFO  | all       | scan_start | Scanning 14 containers
2026-04-05 03:00:01 | INFO  | all       | scan_complete | No issues found
```

### Example 2: Unstable Container

```
2026-04-05 03:00:00 | INFO  | all       | scan_start | Scanning 14 containers
2026-04-05 03:00:02 | WARN  | redis     | unstable  | RestartCount=4, avg=90s
2026-04-05 03:00:02 | INFO  | redis     | alert_sent | WARN sent to Telegram
```

### Example 3: Looping Container Stopped

```
2026-04-05 03:00:00 | INFO  | all       | scan_start | Scanning 14 containers
2026-04-05 03:00:02 | CRIT  | api       | looping   | RestartCount=15, avg=5s
2026-04-05 03:00:02 | INFO  | api       | snapshot  | tank@pre-loop-api-20260405-030002
2026-04-05 03:00:03 | INFO  | api       | stopped   | docker stop api
2026-04-05 03:00:03 | INFO  | api       | blocked   | cooldown_until=2026-04-05T03:10:03Z
2026-04-05 03:00:03 | CRIT  | api       | alert_sent | CRITICAL sent to Telegram
```

### Example 4: Re-loop After Cooldown

```
2026-04-05 03:10:03 | INFO  | api       | unblock   | Cooldown elapsed, attempting restart
2026-04-05 03:12:03 | CRIT  | api       | reloop    | RestartCount=3 within 2min, left stopped
2026-04-05 03:12:03 | CRIT  | api       | alert_sent | CRITICAL sent to Telegram
```

---

## Related Skills

- `zfs-snapshot-and-rollback` — Rollback after problematic changes
- `container-self-healer` — Attempt recovery of crashed containers
- `monitoring-health-check` — Broader system health validation

---

**Versão da Skill:** 1.0
**Última Atualização:** 2026-04-05
**Mantenedor:** Framework de Governança will-zappro
