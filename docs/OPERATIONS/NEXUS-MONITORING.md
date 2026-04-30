# Nexus Monitoring — Enterprise Operations Guide

## Overview

Nexus is an autonomous multi-agent pipeline system that spawns worker agents to execute tasks in parallel. This document defines the complete monitoring stack: metrics, logging, health checks, dashboards, alerts, and runbooks.

**Audience:** Platform engineers, SREs, and ops teams running Nexus in production.

---

## 1. Metrics to Track

### 1.1 Queue Depth

| Attribute | Value |
|-----------|-------|
| **Name** | `nexus.queue.depth` |
| **How to measure** | Count pending items in the task queue (e.g., `scripts/nexus.sh queue --count` or API endpoint `/api/queue/stats`) |
| **Warning threshold** | > 50 items queued |
| **Critical threshold** | > 150 items queued |
| **Action** | Scale workers or investigate upstream spike |

### 1.2 Worker Count

| Attribute | Value |
|-----------|-------|
| **Name** | `nexus.workers.active` |
| **How to measure** | Count of `nexus-worker-*` processes or threads currently running |
| **Warning threshold** | < 2 workers available (high load) |
| **Critical threshold** | 0 workers active with tasks pending |
| **Action** | Restart worker pool; check for forkbomb or deadlock |

### 1.3 Success Rate

| Attribute | Value |
|-----------|-------|
| **Name** | `nexus.tasks.success_rate` |
| **How to measure** | `(completed_success / total_completed) * 100` over a sliding 5-minute window |
| **Warning threshold** | < 95% |
| **Critical threshold** | < 85% |
| **Action** | Correlate with error logs; isolate failing task type |

### 1.4 Task Latency (P50 / P95 / P99)

| Attribute | Value |
|-----------|-------|
| **Name** | `nexus.tasks.latency` |
| **How to measure** | Timestamp delta from task dispatch to completion. Compute P50, P95, P99 using `scripts/metrics-latency.sh` or Prometheus histogram |
| **Warning threshold** | P95 > 60s |
| **Critical threshold** | P95 > 300s |
| **Action** | Identify bottleneck worker or task type; check I/O or API timeout |

### 1.5 Error Rate

| Attribute | Value |
|-----------|-------|
| **Name** | `nexus.errors.rate` |
| **How to measure** | Count of non-zero exit codes from worker agents in the last 5 minutes |
| **Warning threshold** | > 1% of tasks failing |
| **Critical threshold** | > 5% of tasks failing |
| **Action** | Sample failed task IDs; correlate with error log entries |

---

## 2. Logging Strategy

### 2.1 Structured Log Format

Every log entry MUST be a single-line JSON object with these fields:

```json
{"ts":"2026-04-30T10:15:30Z","level":"INFO","component":"nexus-runner","msg":"Task started","task_id":"t-7f3a","worker_id":"w-2","elapsed_ms":0}
```

| Field | Type | Description |
|-------|------|-------------|
| `ts` | ISO 8601 | UTC timestamp |
| `level` | string | `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL` |
| `component` | string | Subsystem: `nexus-runner`, `nexus-worker`, `nexus-queue`, `nexus-health` |
| `msg` | string | Human-readable description |
| `task_id` | string | Task identifier (omit if N/A) |
| `worker_id` | string | Worker identifier (omit if N/A) |
| `elapsed_ms` | number | Time since task start in ms (optional) |

### 2.2 Log Levels

| Level | When to use |
|-------|-------------|
| `DEBUG` | Per-step tracing inside a task (verbose, never in production stats) |
| `INFO` | Task started, completed, worker spawned/died |
| `WARN` | Retries triggered, degraded performance, non-fatal API errors |
| `ERROR` | Task failed with exit code != 0, worker crash |
| `FATAL` | Queue unreachable, master process exit, disk full |

### 2.3 Log Rotation

| Setting | Value |
|---------|-------|
| **Max file size** | 100 MB per log file |
| **Max retention** | 7 days (72 files max) |
| **Rotation schedule** | Daily at 00:00 UTC + size-based |
| **Compression** | `.gz` after rotation |
| **Path** | `/srv/monorepo/logs/nexus/` |

Rotation is handled by `logrotate` via cron at `/etc/logrotate.d/nexus`.

### 2.4 Logshipper

Ship logs to your log aggregator using `vector` or `fluent-bit`:

```toml
# /etc/vector/vector.toml (example)
[sources.nexus_logs]
type = "file"
include = ["/srv/monorepo/logs/nexus/*.log"]

[sinks.nexus_elasticsearch]
type = "elasticsearch"
inputs = ["nexus_logs"]
```

---

## 3. Health Checks

### 3.1 Startup Health Check

Run immediately after `nexus.sh` or the master process starts.

**Script:** `scripts/health-check-startup.sh`

```bash
# Checks:
#  1. Queue directory exists and is writable
#  2. Worker binary/script present
#  3. Config file valid (schema validation)
#  4. No stale PID file from previous run
#  5. Required env vars set (NEXUS_WORKDIR, NEXUS_QUEUE_DIR)

exit 0 on all pass, exit 1 on any failure
```

### 3.2 Periodic Health Check

Run every 60 seconds via cron or a watchdog process.

**Script:** `scripts/health-check-periodic.sh`

```bash
# Checks:
#  1. Master process still running (PID file valid)
#  2. At least 1 worker process alive
#  3. Queue not full (> 5% capacity remaining)
#  4. Disk space > 10% on logs volume
#  5. No recent FATAL logs (last 5 min)
```

### 3.3 Pre-Command Health Check

Run before spawning each worker.

```bash
#  1. Verify worker script is executable
#  2. Check parent process still alive
#  3. Confirm task queue not locked (flock)
#  4. Memory usage below 80% threshold
```

Exit code 0 → proceed. Exit code != 0 → retry up to 3 times, then fail task.

---

## 4. Dashboards

### 4.1 Real-Time Overview (Grafana)

Panel layout for the primary dashboard:

```
+---------------------------+---------------------------+
|  Queue Depth (gauge)      |  Active Workers (gauge)   |
|  [###=======] 12/200     |  [#####] 5/20             |
+---------------------------+---------------------------+
|  Success Rate % (time series, 5m window)            |
|  98.2% ████████████████                          |
+---------------------------+---------------------------+
|  Task Latency P95 (time series)                    |
|  45s ▁▁▁▂▃▅▆▇█▇▆▅▃▂▁▁                           |
+---------------------------+---------------------------+
|  Error Rate (time series, last 30 min)            |
|  0.3% █                                           |
+---------------------------+---------------------------+
|  Workers by Status (pie chart)                    |
|  Running: 5 | Idle: 2 | Recovering: 1             |
+---------------------------+---------------------------+
```

### 4.2 Panels to Include

| Panel | Type | Query / Source |
|-------|------|----------------|
| Queue depth | Gauge | `nexus.queue.depth` from Prometheus |
| Active workers | Gauge | `nexus.workers.active` |
| Success rate | Time series | `rate(nexus_tasks_success_total[5m]) / rate(nexus_tasks_total[5m])` |
| P95 latency | Time series | `histogram_quantile(0.95, rate(nexus_task_duration_seconds_bucket[5m]))` |
| Error rate | Time series | `rate(nexus_errors_total[5m]) / rate(nexus_tasks_total[5m])` |
| Worker uptime | Time series | `up{job="nexus-worker"}` |
| Log volume by level | Time series | Count from Elasticsearch / Loki |

### 4.3 Refresh Rate

- Overview panel: **10 seconds**
- Latency/error trends: **30 seconds**
- Worker status: **15 seconds**

---

## 5. Alerts

### 5.1 Alert Definitions

| Alert name | Metric | Condition | Severity | Cooldown |
|------------|--------|-----------|----------|----------|
| `NexusQueueBacklog` | queue depth | > 150 for 5 min | warning | 5 min |
| `NexusQueueCritical` | queue depth | > 300 for 2 min | critical | 1 min |
| `NexusWorkerDrought` | active workers | = 0 with pending tasks for 2 min | critical | 1 min |
| `NexusLowSuccessRate` | success rate | < 90% for 5 min | warning | 5 min |
| `NexusCriticalFailure` | success rate | < 80% for 3 min | critical | 1 min |
| `NexusHighLatency` | P95 latency | > 300s for 5 min | warning | 5 min |
| `NexusDiskPressure` | disk used % | > 85% for 10 min | warning | 5 min |
| `NexusNoWorkers` | active workers | = 0 for 60s | critical | 1 min |
| `NexusFatalLogs` | fatal log count | >= 1 FATAL in last 2 min | critical | 0 min |

### 5.2 Escalation Path

```
Alert fires
    │
    ├── PagerDuty (critical)
    │       └── On-call engineer responds within 5 min
    │
    └── Slack #ops-alerts (all severities)
            └── Engineer acknowledges → updates incident channel
```

### 5.3 Notification Channels

| Channel | Used for |
|---------|----------|
| `pagerduty` | All critical alerts |
| `slack-ops-alerts` | All severities (summary message) |
| `slack-nexus-errors` | ERROR/FATAL only (detailed log samples) |
| `email-ops` | Warning-only daily digest |

---

## 6. Runbooks

### 6.1 Queue Backlog (`NexusQueueBacklog` / `NexusQueueCritical`)

**Symptoms:** Queue depth above threshold.

**Diagnosis:**
```bash
# Check what's in the queue
scripts/nexus.sh queue --list --limit 20

# Check worker throughput
scripts/metrics-latency.sh --window 5m

# Check for stuck workers
ps aux | grep nexus-worker | grep -v grep
```

**Resolution:**
1. If workers are running but slow → check API latency (model provider timeout?)
2. If workers are exhausted → scale `NEXUS_MAX_WORKERS` env var and restart
3. If queue is stale → clear dead tasks: `scripts/nexus.sh queue --prune --older-than 30m`

---

### 6.2 Worker Drought (`NexusWorkerDrought` / `NexusNoWorkers`)

**Symptoms:** No active workers, tasks queuing.

**Diagnosis:**
```bash
# Check master process
ps aux | grep nexus.sh | grep -v grep

# Check for worker crashes in logs
tail -100 /srv/monorepo/logs/nexus/nexus-runner.log | grep -i "worker.*exit\|signal\|killed"

# Check system resources
free -h
df -h /srv/monorepo
```

**Resolution:**
1. If master is dead → restart pipeline: `cd /srv/monorepo && nexus.sh start`
2. If workers OOMKilled → increase worker memory limit or reduce concurrency
3. If workers fork-bombing → kill all: `pkill -f nexus-worker` then restart

---

### 6.3 Low Success Rate (`NexusLowSuccessRate` / `NexusCriticalFailure`)

**Symptoms:** Error rate above threshold.

**Diagnosis:**
```bash
# List failed tasks from last window
scripts/nexus.sh tasks --status failed --since 5m --json

# Check error distribution
grep '"level":"ERROR"' /srv/monorepo/logs/nexus/nexus-worker.log \
  | jq '.msg' | sort | uniq -c | sort -rn | head -20

# Check if specific model/provider is failing
grep '"component":"nexus-worker"' /srv/monorepo/logs/nexus/nexus-worker.log \
  | jq -r '.extra.provider // "unknown"' | sort | uniq -c
```

**Resolution:**
1. If clustered on one provider → disable provider in config, route to fallback
2. If random distribution → check for infra issues (network, disk I/O)
3. If caused by specific task type → isolate and tag for human review

---

### 6.4 High Latency (`NexusHighLatency`)

**Symptoms:** P95 task duration above threshold.

**Diagnosis:**
```bash
# Identify slow task type
scripts/nexus.sh tasks --slow --threshold 60s --since 15m

# Check model provider latency directly
curl -s -w "%{time_total}" https://api.openrouter.com/v1/models \
  -H "Authorization: Bearer ${OPENROUTER_API_KEY}" | tail -1

# Check disk latency on queue volume
iostat -x 1 5 | grep sd
```

**Resolution:**
1. If provider-side → implement exponential backoff retry; check circuit breaker
2. If I/O-bound → move queue to faster storage (SSD-backed volume)
3. If worker resource-starved → reduce `VIBE_PARALLEL` or increase `NEXUS_WORKER_TIMEOUT`

---

### 6.5 Fatal Logs Detected (`NexusFatalLogs`)

**Symptoms:** FATAL log entry written.

**Diagnosis:**
```bash
# Get the FATAL entry
grep '"level":"FATAL"' /srv/monorepo/logs/nexus/nexus-runner.log | tail -5 | jq .

# Check system-level errors
dmesg | tail -20
journalctl -p err --since "10 minutes ago" | tail -20
```

**Resolution:**
1. If queue disk full → clear old logs immediately; ensure rotation is running
2. If master crashed → capture core dump, restart, file bug
3. If permission error → fix ownership: `chown -R nexus:nexus /srv/monorepo/logs/nexus`

---

### 6.6 Disk Pressure (`NexusDiskPressure`)

**Symptoms:** Disk usage above 85%.

**Resolution:**
```bash
# Identify largest consumers
du -sh /srv/monorepo/logs/nexus/*/  | sort -rh | head -10

# Trigger immediate log rotation
logrotate -f /etc/logrotate.d/nexus

# Prune old task artifacts
find /srv/monorepo/.nexus/tasks -type f -mtime +3 -delete

# Verify rotation freed space
df -h /srv/monorepo
```

---

### 6.7 Disk Full Emergency (`NexusFatalLogs` + disk 100%)

**Symptoms:** Queue writes failing, master cannot start.

**Emergency:**
```bash
# 1. Kill logrotate immediately to prevent further writes
pkill logrotate

# 2. Identify largest files
find /srv/monorepo/logs -type f -exec ls -lh {} \; | sort -rh | head -20

# 3. Truncate (NOT delete) the largest logs to free space immediately
> /srv/monorepo/logs/nexus/nexus-runner.log

# 4. Restart services
systemctl restart nexus.service
```

> **Warning:** Truncating is a last resort. Logs are evidence for post-mortems. Restore from backup if possible.

---

## Appendix: Quick Reference

| Check | Command |
|-------|---------|
| Queue depth | `scripts/nexus.sh queue --count` |
| Worker status | `ps aux \| grep nexus-worker \| grep -v grep` |
| Recent errors | `tail -100 /srv/monorepo/logs/nexus/nexus-runner.log \| grep ERROR` |
| Success rate | `scripts/metrics-latency.sh --success-rate` |
| Health check | `bash scripts/health-check-periodic.sh` |
| Restart pipeline | `cd /srv/monorepo && nexus.sh start` |

---

*Document version: 1.0.0 — 2026-04-30*