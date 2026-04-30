# Nexus Error Playbook

> Autonomous agent pipeline error reference. All commands tested on the homelab at `zappro.site`.

## 1. Error Categories

| Category | Definition | Auto-retry? | Example |
|----------|------------|--------------|---------|
| **Transient** | Network blip, temporary timeout, resource contention | Yes (exponential backoff) | Rate limit hit, brief network loss |
| **Permanent** | Bad config, corrupted state, impossible constraint | No (requires human fix) | Corrupted queue JSON, orphaned lock |

**Rule of thumb:** Transient errors get retried with backoff. Permanent errors stop the loop and alert.

---

## 2. Decision Tree

```
[X error occurs]
  │
  ├─ Is it transient? (timeout, rate limit, resource temp)
  │   ├─ YES → exponential backoff → retry
  │   │         └─ Still fails after 3 retries? → escalate to permanent
  │   └─ NO → STOP, apply scenario fix below
  │
  └─ Is it permanent? (corruption, orphan, config)
      ├─ Identify error type (see scenarios below)
      ├─ Apply fix procedure
      └─ Verify + restart loop
```

---

## 3. Error Scenarios

### 3.1 Worker Crashed Mid-Task

**Symptom**
- Task sits in `running` status forever
- Worker process missing from `ps aux | grep nexus`
- `nexus-auto.log` shows no heartbeat for >5 min

**Diagnosis Command**
```bash
# Check running tasks in queue
jq '.tasks[] | select(.status == "running")' /srv/monorepo/.claude/vibe-kit/queue.json

# Find orphaned workers
ps aux | grep -E "nexus|worker" | grep -v grep

# Check logs for crash traceback
tail -100 /srv/monorepo/logs/nexus-auto.log | grep -iE "error|crash|traceback|killed"
```

**Fix Procedure**
```bash
# 1. Reset the crashed task back to pending
TASK_ID="<task-id-from-queue>"
jq '.tasks[] | to_entries | .[] | select(.value.id == "'$TASK_ID'") | .key' /srv/monorepo/.claude/vibe-kit/queue.json | \
  while read idx; do
    jq '.tasks['$idx'].status = "pending" | .tasks['$idx'].worker = null | .tasks['$idx'].started_at = null' \
      /srv/monorepo/.claude/vibe-kit/queue.json > /tmp/queue.tmp && \
      mv /tmp/queue.tmp /srv/monorepo/.claude/vibe-kit/queue.json
  done

# 2. Kill any zombie worker processes
pkill -f "nexus-auto" || true
pkill -f "vibe-kit" || true

# 3. Restart the loop
cd /srv/monorepo && bash scripts/nexus-auto.sh loop &
```

**Prevention**
- Set `WORKER_TIMEOUT=300` (5 min max per task)
- Add heartbeat logging every 30s to `nexus-auto.sh`
- Monitor with `nexus-monitor-15k.sh` for stale tasks

---

### 3.2 Queue Corrupted

**Symptom**
- `jq` fails on `queue.json` with parse error
- Tasks array is missing or invalid
- `nexus-auto.sh` exits with "cannot parse queue" error

**Diagnosis Command**
```bash
# Validate JSON
jq empty /srv/monorepo/.claude/vibe-kit/queue.json 2>&1 && echo "JSON valid" || echo "JSON corrupted"

# Check file size (empty = corrupted)
ls -la /srv/monorepo/.claude/vibe-kit/queue.json

# View raw content for anomalies
cat /srv/monorepo/.claude/vibe-kit/queue.json | head -c 500
```

**Fix Procedure**
```bash
# 1. Backup corrupted file
cp /srv/monorepo/.claude/vibe-kit/queue.json /srv/monorepo/.claude/vibe-kit/queue.json.bak.$(date +%s)

# 2. Rebuild from backup or create fresh empty queue
if [ -s /srv/monorepo/.claude/vibe-kit/queue.json.bak.* ]; then
  # Try to recover using jq on backup
  BACKUP=$(ls -t /srv/monorepo/.claude/vibe-kit/queue.json.bak.* | head -1)
  jq 'walk(if type == "object" then with_entries(select(.value != null)) else . end)' \
    "$BACKUP" > /srv/monorepo/.claude/vibe-kit/queue.json 2>/dev/null || \
    echo '{"tasks":[],"created_at":"'$(date -I)'","version":1}' > /srv/monorepo/.claude/vibe-kit/queue.json
else
  echo '{"tasks":[],"created_at":"'$(date -I)'","version":1}' > /srv/monorepo/.claude/vibe-kit/queue.json
fi

# 3. Verify
jq empty /srv/monorepo/.claude/vibe-kit/queue.json && echo "Queue restored"

# 4. Restart loop
cd /srv/monorepo && bash scripts/nexus-auto.sh loop &
```

**Prevention**
- Backup queue before every modification: `cp $QUEUE $QUEUE.bak.$(date +%s)`
- Add `jq empty` validation to the start of `nexus-auto.sh`
- Run `nexus-auto.sh` with `set -euo pipefail`

---

### 3.3 Lock File Orphaned

**Symptom**
- Lock file exists but no holder process running
- Next run says "already running" but it is not
- `nexus-auto.log` shows "cannot acquire lock"

**Diagnosis Command**
```bash
# Find all lock files
find /srv/monorepo -name "*.lock" -ls 2>/dev/null

# Check which process holds the lock
LOCK_FILE="/srv/monorepo/.claude/vibe-kit/queue.lock"
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE")
  echo "Lock claims PID: $LOCK_PID"
  ps -p "$LOCK_PID" -o pid,comm,state --no-headers 2>/dev/null || echo "PID $LOCK_PID not found (orphaned)"
fi

# Force-check if lock is valid
ps aux | grep -E "nexus-auto|$(cat $LOCK_FILE 2>/dev/null)" | grep -v grep
```

**Fix Procedure**
```bash
# 1. Identify orphaned lock
LOCK_DIR="/srv/monorepo/.claude/vibe-kit"
LOCK_FILE="$LOCK_DIR/queue.lock"

if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE")
  
  # Verify PID is actually dead
  if ! ps -p "$LOCK_PID" > /dev/null 2>&1; then
    echo "Lock file is orphaned (PID $LOCK_PID is dead)"
    rm -f "$LOCK_FILE"
    echo "Removed orphaned lock"
  else
    echo "Process $LOCK_PID is alive — lock is valid, cannot remove"
    exit 1
  fi
fi

# 2. Restart if needed
cd /srv/monorepo && nohup bash scripts/nexus-auto.sh loop > /dev/null 2>&1 &
```

**Prevention**
- Use `flock` for atomic lock acquisition instead of PID files
- Always verify PID exists before considering a lock orphaned
- Add lock refresh heartbeat every 60s in long-running tasks

---

### 3.4 Context Directory Full

**Symptom**
- `write` or `Read` operations fail with "No space left on device"
- `df -h` shows `/srv/monorepo` at 100%
- Claude Code sessions fail to start

**Diagnosis Command**
```bash
# Check disk usage at mount points
df -h /srv /srv/monorepo /srv/data

# Find largest directories
du -sh /srv/monorepo/* 2>/dev/null | sort -rh | head -20

# Check context directories
du -sh /srv/monorepo/.claude/ 2>/dev/null
du -sh /srv/monorepo/.claude/vibe-kit/* 2>/dev/null

# Inodes full?
df -i /srv
```

**Fix Procedure**
```bash
# 1. Identify space hogs
TARGET_DIR="/srv/monorepo/.claude"
du -sh "$TARGET_DIR"/* 2>/dev/null | sort -rh | head -10

# 2. Clean old logs (keep last 7 days)
find /srv/monorepo/logs -name "*.log" -mtime +7 -delete 2>/dev/null
echo "Cleaned logs older than 7 days"

# 3. Clean temp files
rm -rf /tmp/nexus-*.tmp /tmp/queue.tmp 2>/dev/null || true

# 4. Archive large log files
LOG_DIR="/srv/monorepo/logs"
find "$LOG_DIR" -name "*.log" -size +100M -exec gzip {} + 2>/dev/null || true

# 5. Verify freed space
df -h /srv/monorepo

# 6. If still full — escalate to ZFS snapshot cleanup
# Run: bash /srv/ops/scripts/clean-old-snapshots.sh --dry-run
```

**Prevention**
- Set up `nexus-monitor-15k.sh` to alert at 80% disk usage
- Add log rotation: `logrotate -f /srv/monorepo/config/logrotate.conf`
- Archive vibe-kit artifacts to cold storage weekly

---

### 3.5 Rate Limit Exceeded

**Symptom**
- HTTP 429 from upstream API (OpenRouter, Requesty, etc.)
- `nexus-rate-limiter.sh` reports global limit reached
- `nexus-auto.log` shows "rate limit exceeded, backing off"

**Diagnosis Command**
```bash
# Check rate limiter state
cat /srv/monorepo/.claude/vibe-kit/rate-limit-state.json 2>/dev/null || \
  echo "No rate limit state file"

# Check upstream API status page
curl -s "https://status.openrouter.ai/api/v1/status" 2>/dev/null | jq -r '.status' || \
  echo "OpenRouter status unavailable"

# Count recent requests in logs
grep -c "rate limit" /srv/monorepo/logs/nexus-auto.log 2>/dev/null

# Check rate limiter script
bash /srv/monorepo/scripts/nexus-rate-limiter.sh status 2>/dev/null || \
  echo "Rate limiter script not found"
```

**Fix Procedure**
```bash
# 1. Stop the loop immediately
pkill -f "nexus-auto" || true

# 2. Wait for rate limit window to reset (typically 60s for RPM limits)
echo "Waiting for rate limit window to reset..."
sleep 60

# 3. Check if rate limiter is ready
bash /srv/monorepo/scripts/nexus-rate-limiter.sh acquire 2>/dev/null && \
  echo "Rate limit cleared, restarting loop" || \
  echo "Rate limit still active, waiting more..."
sleep 30

# 4. Restart loop with lower concurrency
cd /srv/monorepo && \
  MAX_WORKERS=2 bash scripts/nexus-auto.sh loop &
```

**Prevention**
- Always use `nexus-rate-limiter.sh acquire` before API calls
- Set `MAX_WORKERS=2` during peak upstream traffic hours
- Monitor upstream status before starting large batches
- Use `nexus-rate-limiter.sh` with exponential backoff on 429

---

### 3.6 Hermes Agent Down

**Symptom**
- `curl -s https://hermes.zappro.site/health` returns non-200
- `nexus-hermes-stats.sh` shows agent not responding
- Agent loops fail to deliver results

**Diagnosis Command**
```bash
# Layer 1: HTTP check (multiple endpoints)
curl -s -w "\n%{http_code}" https://hermes.zappro.site/ --connect-timeout 5 --max-time 10
curl -s -w "\n%{http_code}" https://hermes.zappro.site/health --connect-timeout 5 --max-time 10
curl -s -w "\n%{http_code}" https://hermes.zappro.site/v1/health --connect-timeout 5 --max-time 10

# Layer 2: Port verification
sudo ss -tlnp 2>/dev/null | grep ":8642"

# Layer 3: Process verification
PID=$(sudo ss -tlnp 2>/dev/null | grep ":8642" | sed -n 's/.*pid=\([0-9]*\).*/\1/p')
ps -p "$PID" -o comm,args --no-headers 2>/dev/null || echo "Process $PID not found"

# Layer 4: Container status (if applicable)
docker ps --filter "name=hermes" 2>/dev/null || echo "Docker not available"
```

**Fix Procedure**
```bash
# 1. Check process and restart if needed
PID=$(sudo ss -tlnp 2>/dev/null | grep ":8642" | sed -n 's/.*pid=\([0-9]*\).*/\1/p')

if [ -z "$PID" ]; then
  echo "Hermes not listening on 8642 — attempting restart"
  # Use the deployment script if available
  bash /srv/monorepo/scripts/nexus-deploy.sh hermes 2>/dev/null || \
    systemctl restart hermes 2>/dev/null || \
    (cd /srv/monorepo && ./run-hermes.sh &)
fi

# 2. Wait for startup
sleep 10

# 3. Verify
curl -s -f https://hermes.zappro.site/health --connect-timeout 10 --max-time 15 && \
  echo "Hermes OK" || echo "Hermes still failing after restart"

# 4. If Docker-based
docker restart hermes 2>/dev/null && sleep 5 && \
  docker ps --filter "name=hermes" --format "{{.Status}}"
```

**Prevention**
- Add Hermes to `nexus-monitor-15k.sh` with 1-min check interval
- Set up auto-restart via systemd: `systemctl enable hermes`
- Use Cloudflare health check with 30s interval on `/health`

---

### 3.7 mclaude Command Not Found

**Symptom**
- `mclaude: command not found` in logs or terminal
- Nexus tries to run `mclaude -p` but fails
- The `multi-claude` package is not in PATH

**Diagnosis Command**
```bash
# Check if mclaude is installed
which mclaude 2>/dev/null || echo "mclaude not in PATH"
bunx mclaude --version 2>/dev/null || echo "mclaude not available via bunx"

# Check global install location
ls -la ~/.bun/bin/mclaude 2>/dev/null || echo "Not in ~/.bun/bin"
ls -la /usr/local/bin/mclaude 2>/dev/null || echo "Not in /usr/local/bin"

# Check if multi-claude package is installed
bun pm ls | grep "multi-claude" 2>/dev/null || echo "Package not installed"
```

**Fix Procedure**
```bash
# 1. Re-link the package (if installed via bun)
cd /srv/monorepo  # or wherever multi-claude source is
bun link 2>/dev/null

# 2. Or install globally
bun install -g @leogomide/multi-claude 2>/dev/null

# 3. Verify
which mclaude && mclaude --version

# 4. If still failing, use bunx explicitly in scripts
# Replace: mclaude -p
# With:   bunx mclaude -p
```

**Prevention**
- Pin `multi-claude` version in `package.json` dependencies
- Always use `bun link` after cloning the monorepo on a new machine
- Add version check to `nexus-auto.sh` startup: `bunx mclaude --version || exit 1`

---

### 3.8 Disk Space Full

**Symptom**
- `df -h` shows 100% on the relevant mount
- Writes fail with "No space left on device"
- Docker containers stop, databases may crash

**Diagnosis Command**
```bash
# Check all mounts
df -h

# Largest space consumers in monorepo
du -sh /srv/monorepo/* 2>/dev/null | sort -rh | head -15

# Check Docker disk usage
docker system df 2>/dev/null

# Check ZFS pools (if applicable)
sudo zfs list 2>/dev/null
sudo zpool list 2>/dev/null

# Check for large log files
find /srv/monorepo/logs -name "*.log" -exec ls -lh {} \; 2>/dev/null | sort -k5 -rh | head -10
```

**Fix Procedure**
```bash
# 1. Docker cleanup (if full)
docker system prune -af --volumes 2>/dev/null || true
docker image prune -af 2>/dev/null || true

# 2. Clean rotated logs
find /srv/monorepo/logs -name "*.log.*" -mtime +3 -delete 2>/dev/null || true
find /srv/monorepo/logs -name "*.log" -size +500M -exec gzip {} + 2>/dev/null || true

# 3. Clean temp directory
rm -rf /tmp/*.tmp /tmp/nexus-* /tmp/queue-* 2>/dev/null || true

# 4. Clean old backups (keep last 3)
find /srv/backups -name "*.tar.zst" -mtime +30 -delete 2>/dev/null || true

# 5. ZFS cleanup (if ZFS pool)
# First check pool health
sudo zpool status 2>/dev/null
# List snapshots
sudo zfs list -t snapshot 2>/dev/null | head -20
# Dry-run cleanup
sudo /srv/ops/scripts/clean-old-snapshots.sh --dry-run 2>/dev/null

# 6. Verify
df -h /srv
```

**Prevention**
- Add `df -h /srv` to `nexus-monitor-15k.sh` alerts at 85%
- Set up logrotate for all `*.log` files in `/srv/monorepo/logs`
- Schedule weekly Docker prune: `cron.d/nexus-docker-cleanup`
- Monitor ZFS pool capacity monthly with `nexus-sre.sh`

---

### 3.9 Memory Exhausted

**Symptom**
- `free -h` shows near-zero available memory
- OOM killer in `dmesg | grep -i oom`
- Processes crash and restart repeatedly

**Diagnosis Command**
```bash
# Memory summary
free -h

# Top memory consumers
ps aux --sort=-%mem | head -20

# Per-process memory
smem -r 2>/dev/null || ps aux --sort=-%mem | awk '{print $6,$11}' | head -10

# Check for memory leak suspects (growing process RSS)
watch -n 5 'ps aux --sort=-%mem | head -10'

# OOM events
dmesg | grep -i "out of memory" | tail -10
dmesg | grep -i "oom" | tail -10

# Container memory (if applicable)
docker stats --no-stream 2>/dev/null
```

**Fix Procedure**
```bash
# 1. Identify top memory consumers
echo "=== Top 10 memory consumers ==="
ps aux --sort=-%mem | head -11

# 2. Kill non-critical runaway processes
# DO NOT kill: sshd, dockerd, systemd, nexus-critical processes
pkill -9 -f "chrome|chromium|flash" 2>/dev/null || true

# 3. Restart bloated services (Hermes, LLM proxy, etc.)
# Only restart if they are the culprits
for svc in hermes llm gym; do
  PID=$(sudo ss -tlnp 2>/dev/null | grep -E ":($(jq -r '.services[$svc].port // 8642' /srv/monorepo/config/services.json 2>/dev/null))" | sed -n 's/.*pid=\([0-9]*\).*/\1/p')
  [ -n "$PID" ] && ps -p "$PID" -o %mem,%cpu,comm --no-headers | awk '{if($1>80) print "Restarting " $3 " (PID '$PID') due to high memory: " $1 "%"}'
done

# 4. Force garbage collection if Python processes
for py in $(ps aux | grep python | grep -v grep | awk '{print $2}'); do
  kill -USR1 "$py" 2>/dev/null || true
done

# 5. Emergency: drop caches (only if absolutely necessary)
sync && echo 3 | sudo tee /proc/sys/vm/drop_caches 2>/dev/null

# 6. Verify
free -h
```

**Prevention**
- Set memory limits in Docker: `--memory=2g --memory-swap=2g`
- Monitor with `nexus-monitor-15k.sh` alerting at 80% memory usage
- Add `ulimit -v` to worker startup scripts
- Profile memory leaks with `memory_profiler` weekly

---

## 4. Quick Reference Commands

| Action | Command |
|--------|---------|
| Check all nexus logs | `tail -f /srv/monorepo/logs/nexus-*.log` |
| Full service health check | `bash /srv/monorepo/scripts/nexus-investigate.sh all 3` |
| Queue status | `jq '.tasks \| group_by(.status) \| map({status: .[0].status, count: length})' /srv/monorepo/.claude/vibe-kit/queue.json` |
| Reset crashed task | `jq '.tasks[\(idx)].status = "pending" \| .tasks[\(idx)].worker = null' /srv/monorepo/.claude/vibe-kit/queue.json > /tmp/q.tmp && mv /tmp/q.tmp /srv/monorepo/.claude/vibe-kit/queue.json` |
| Restart nexus loop | `cd /srv/monorepo && nohup bash scripts/nexus-auto.sh loop &` |
| Check lock orphans | `for f in $(find /srv/monorepo -name "*.lock"); do PID=$(cat $f); ps -p $PID > /dev/null 2>&1 \|\| echo "Orphaned: $f (PID $PID)"; done` |
| Rate limit status | `bash /srv/monorepo/scripts/nexus-rate-limiter.sh status` |
| Disk space alert | `df -h /srv/monorepo \| awk 'NR==2 && int($5) > 85 {exit 1}'` |
| Memory alert | `free -m \| awk 'NR==2 && $7 < 500 {exit 1}'` (warns if <500MB available) |

---

## 5. Escalation Path

```
Step 1: Transient? → Retry with backoff (nexus-rate-limiter.sh handles)
Step 2: Still failing? → Run diagnosis commands above
Step 3: Identified cause → Apply fix procedure
Step 4: Fix applied → Restart loop, verify logs clean
Step 5: Unresolved → Page on-call (see NETWORK_MAP.md)
```

> Last updated: 2026-04-30
