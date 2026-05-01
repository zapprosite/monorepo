# Skill: OOM Killer

**Purpose:** Detect Docker containers in OOM (Out of Memory) state, kill and restart them with ZFS snapshot before restart, and alert before memory exhaustion becomes fatal
**Complexity:** Medium
**Risk:** Medium (container restart, ZFS snapshot)
**When to Use:** `codex-host "oomkiller"`, memory alert triggered, slow/unresponsive services, `dmesg` shows OOM activity

## Detection Methods

### 1. Check for OOMKilled Flag
```bash
docker ps -a --format "{{.Names}}\t{{.Status}}" | grep -i oom
```

### 2. Docker Stats (Memory Usage)
```bash
docker stats --no-stream --format "{{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

### 3. Host-Level OOM Events
```bash
dmesg | grep -iE "out of memory|oom|killed process" | tail -20
```

### 4. GPU OOM Detection
```bash
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader
nvidia-smi | grep -i "out of memory\|oom"
```

### 5. Host Memory Pressure
```bash
free -h
cat /proc/meminfo | grep -E "MemAvailable|MemFree|MemTotal"
```

---

## Decision Tree

```
MEMORY EMERGENCY DETECTED
│
├─ 1. OOMKilled Container Found
│     │
│     ├─ a. Identify container: docker ps -a | grep OOMKilled
│     ├─ b. Create ZFS snapshot: tank@pre-oom-<container>-<timestamp>
│     ├─ c. Remove container: docker rm <container>
│     ├─ d. Recreate container (docker run or compose up)
│     └─ e. Alert CRITICAL to @HOMELAB_LOGS_bot
│
├─ 2. Container Memory > 90% (consecutive 3+ checks)
│     │
│     ├─ a. Alert WARN to @HOMELAB_LOGS_bot (memory pressure)
│     ├─ b. Monitor for 2 more cycles
│     ├─ c. If reaches 95% → FORCE RESTART
│     │     ├─ ZFS snapshot: tank@pre-oom-<container>-<timestamp>
│     │     ├─ docker rm <container>
│     │     ├─ docker run <container>
│     │     └─ Alert CRITICAL
│     └─ d. If stabilizes < 85% → log and continue monitoring
│
├─ 3. Container Memory > 80% (warning threshold)
│     │
│     ├─ a. Log warning to /srv/ops/ai-governance/logs/oom-killer.log
│     ├─ b. Alert WARN to @HOMELAB_LOGS_bot
│     └─ c. Recheck in 60 seconds
│
├─ 4. Host Memory > 90% Used
│     │
│     ├─ a. Identify top memory consumer: docker stats --no-stream
│     ├─ b. Alert CRITICAL to @HOMELAB_LOGS_bot
│     ├─ c. Suggest scale-down or restart of heaviest container
│     └─ d. If critical (>95%): begin emergency restart procedure
│
└─ 5. GPU OOM Detected
      │
      ├─ a. Check nvidia-smi for OOM errors
      ├─ b. Identify GPU model consuming memory
      ├─ c. Restart affected container (snapshot first)
      └─ d. Alert CRITICAL to @HOMELAB_LOGS_bot
```

---

## Memory Thresholds

| Level | Container | Host | Action |
|-------|-----------|------|--------|
| WARN | 80% | 80% | Log + alert, recheck in 60s |
| CRITICAL | 90% | 90% | Alert immediately, prepare restart |
| EMERGENCY | 95%+ | 95%+ | Force restart with snapshot |

---

## Container Memory Limits (Approximate)

| Container | Typical RAM | Notes |
|-----------|-------------|-------|
| Grafana | ~500MiB | Low usage normally |
| Prometheus | ~2GiB | Can spike during queries |
| Ollama | ~16GiB | GPU offload, RAM varies with models |
| n8n | ~1GiB | Workflow complexity dependent |
| cadvisor | ~200MiB | Lightweight |
| qdrant | ~4GiB | Vector DB, disk-based |
| OpenClaw | ~500MiB | Telegram bot |
| Gitea | ~1GiB | Git operations |

> Note: Detect limits dynamically with `docker stats --no-stream` showing actual usage vs limit

---

## A. OOMKilled Container Recovery

**This is an emergency procedure.**

```bash
# 1. Identify the OOMKilled container
docker ps -a | grep OOMKilled

# 2. Get container details (image, volumes, ports)
docker inspect <container> --format '{{json .Config}}' | jq

# 3. Create ZFS snapshot BEFORE any action
SNAPSHOT="tank@pre-oom-$(date +%Y%m%d-%H%M%S)-<container>"
sudo zfs snapshot -r "$SNAPSHOT"

# 4. Remove the dead container
docker rm <container>

# 5. Recreate (use original run command or compose)
docker run -d [restart flags] [volumes] [ports] <image>

# 6. Verify it started
docker ps | grep <container>

# 7. Alert
# Send CRITICAL to @HOMELAB_LOGS_bot via Telegram
```

---

## B. Memory Pressure Warning (80-90%)

```bash
# 1. Check all containers
docker stats --no-stream --format "{{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"

# 2. Log to file
echo "$(date '+%Y-%m-%d %H:%M') | Memory pressure: <container> at <X>%" \
  >> /srv/ops/ai-governance/logs/oom-killer.log

# 3. Alert WARN to bot if 80%+
# 4. Recheck in 60 seconds
# 5. If 90%+, escalate to CRITICAL path
```

---

## C. Host-Level OOM

```bash
# 1. Check dmesg for OOM killer activity
sudo dmesg | grep -iE "oom|killed process" | tail -10

# 2. Check available memory
free -h

# 3. Identify heaviest container
docker stats --no-stream --no-trunc --format "{{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}" \
  | sort -k3 -t$'\t' -rn | head -5

# 4. Alert CRITICAL with recommendations
# 5. If >95% host memory: emergency restart of heaviest container
```

---

## D. GPU OOM Recovery

```bash
# 1. Check GPU memory status
nvidia-smi --query-gpu=memory.used,memory.free,memory.total --format=csv

# 2. Find container using GPU
docker ps | grep -E "ollama|kokoro"  # common GPU containers

# 3. Check if any container shows GPU OOM
docker ps -a | grep OOMKilled

# 4. Restart affected container with snapshot
SNAPSHOT="tank@pre-gpu-oom-$(date +%Y%m%d-%H%M%S)"
sudo zfs snapshot -r "$SNAPSHOT"
docker restart <container>

# 5. Verify GPU memory freed
nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader

# 6. Alert CRITICAL to bot
```

---

## E. Preventative Monitoring

Run periodic checks to catch memory issues before OOM:

```bash
# Quick health check (incorporate into health-check skill)
docker stats --no-stream --format "{{.Name}}\t{{.MemPerc}}" \
  | awk -F'\t' '$2 > 80 {print "WARN: " $1 " at " $2}'

# Full diagnostic
free -h && docker stats --no-stream --format "table {{.Name}}\t{{.MemUsage}}\t{{.MemPerc}}"
```

---

## Alert Format

**WARN:**
```
[OOM-KILLER] Memory Warning
Container: <name>
Usage: <X>% of limit
Host Memory: <X>% used
Time: <timestamp>
Action: Monitoring
```

**CRITICAL:**
```
[OOM-KILLER] OOM EMERGENCY
Container: <name>
Status: OOMKilled / <X>% of limit
Action: Restarted with ZFS snapshot
Snapshot: tank@pre-oom-<container>-<timestamp>
Time: <timestamp>
```

---

## Log

All events logged to `/srv/ops/ai-governance/logs/oom-killer.log`

Format: `TIMESTAMP | LEVEL | CONTAINER | MEMORY_USAGE | ACTION_TAKEN`

---

## Quick Fix Reference

| Condition | Command |
|-----------|---------|
| Check OOMKilled | `docker ps -a \| grep OOMKilled` |
| Full stats | `docker stats --no-stream` |
| Host memory | `free -h` |
| Host OOM events | `sudo dmesg \| grep -i oom \| tail -10` |
| GPU memory | `nvidia-smi --query-gpu=memory.used,memory.free --format=csv,noheader` |
| Snapshot + restart | `sudo zfs snapshot -r tank@pre-oom-<container>-$(date +%Y%m%d-%H%M%S) && docker restart <container>` |

---

## See Also

- `monitoring-diagnostic.md` — general monitoring issues
- `zfs-snapshot-and-rollback.md` — snapshot procedures
- `docker-platform-ops.md` — container management
- Health check skill — periodic memory verification
