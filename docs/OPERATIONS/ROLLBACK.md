# Rollback Procedures

Quick reference for emergency recovery scenarios in the monorepo.

---

## 1. Deploy Failed

### Symptom
- CI/CD pipeline shows red status
- Service returns 502/503 after deploy
- Health checks failing post-deployment

### Detection Command
```bash
# Check last deployment status
gh run view --log -limit 50

# Check service health
curl -sf http://localhost:PORT/health || echo "UNHEALTHY"

# Check container status
docker ps | grep -E "Up|Restarting"

# Check logs for errors
docker logs --tail 100 SERVICE_NAME 2>&1 | grep -iE "error|fatal|exception"
```

### Fix Step by Step
```bash
# 1. Identify last stable version
gh release list --limit 5

# 2. Revert to previous tag
git checkout V_PREVIOUS_TAG

# 3. Force-push to trigger redeploy (if using GitOps)
git push --force origin DEPLOY_BRANCH

# 4. For Docker-based deploys: pull previous image
docker pull REGISTRY/IMAGE:PREVIOUS_TAG
docker stop SERVICE_NAME
docker rm SERVICE_NAME
docker run -d --name SERVICE_NAME REGISTRY/IMAGE:PREVIOUS_TAG

# 5. For docker-compose: down + up with previous version
docker-compose down
git checkout TAG && docker-compose up -d
```

### Verification
```bash
# Wait 30s then verify
sleep 30
curl -sf http://localhost:PORT/health && echo "HEALTHY"
docker ps | grep SERVICE_NAME | grep "Up"
```

### Prevention
- Always test deploy in staging first
- Keep 3 previous tags as rollback targets
- Use blue-green deploy strategy
- Set up smoke tests in CI pipeline

---

## 2. Queue Corrupted

### Symptom
- Jobs stuck in pending/running state indefinitely
- No new jobs being processed
- Worker logs show `MessageID does not exist` errors

### Detection Command
```bash
# Check queue depth
redis-cli LLEN queue:default

# Check for stuck jobs
redis-cli LRANGE queue:default 0 -1 | jq .

# Check worker status
ps aux | grep worker | grep -v grep

# Check for dead-letter queue overflow
redis-cli LLEN queue:dead
```

### Fix Step by Step
```bash
# 1. Stop workers to prevent race conditions
pkill -f "worker" || true
sleep 2

# 2. Save pending jobs to backup list
redis-cli LRANGE queue:default 0 -1 > /tmp/queue-backup.json

# 3. Clear corrupted queue
redis-cli DEL queue:default

# 4. Recreate queue from backup (filter corrupted entries)
cat /tmp/queue-backup.json | jq -r '.[] | select(.status != "corrupted")' | redis-cli -r LPUSH queue:default

# 5. Or reset completely if backup is unreliable
redis-cli DEL queue:default queue:dead queue:retry

# 6. Restart workers
./scripts/start-workers.sh &
```

### Verification
```bash
# Check queue is empty and responsive
redis-cli LLEN queue:default
redis-cli LPING

# Verify workers are consuming
watch -n 2 'redis-cli LLEN queue:default'
```

### Prevention
- Set job timeout and retry limits
- Monitor dead-letter queue size
- Use Redis persistence (AOF)
- Implement idempotent job handlers

---

## 3. Worker in Infinite Loop

### Symptom
- CPU at 100% on worker process
- Repeated log messages with same pattern
- Memory usage growing continuously
- No actual job completion

### Detection Command
```bash
# Find the runaway process
top -b -n 1 | head -20
ps aux | grep -E "worker|node" | sort -k3 -rn | head

# Check for infinite loop in logs
tail -f /var/log/worker.log | grep "loop\|iteration" | uniq -c

# Check for repeated job execution
redis-cli LRANGE queue:default 0 10 | jq '.[].attempt' 2>/dev/null
```

### Fix Step by Step
```bash
# 1. Identify PID of runaway worker
ps aux | grep worker | awk '{print $2, $11}'

# 2. Kill the worker process gracefully
kill -TERM WORKER_PID

# 3. If still running, force kill
kill -9 WORKER_PID

# 4. Clean up any zombie jobs
redis-cli --raw LRANGE queue:default 0 -1 | jq -r '.[] | select(.worker == "WORKER_PID") | .id' | while read id; do
  redis-cli ZADD queue:stalled "$(date +%s)" "$id"
done

# 5. Reset stalled jobs back to queue
redis-cli ZRANGE queue:stalled 0 -1 | xargs -I {} redis-cli ZREM queue:stalled {}
redis-cli ZRANGE queue:stalled 0 -1 | xargs -I {} redis-cli LPUSH queue:default {}

# 6. Restart worker
./scripts/start-worker.sh &
```

### Verification
```bash
# Check process is gone
ps aux | grep WORKER_PID | grep -v grep

# Check CPU is normal
top -b -n 1 | grep worker

# Check queue is processing
redis-cli LLEN queue:default
```

### Prevention
- Set max iterations per job
- Implement circuit breaker pattern
- Add heartbeat monitoring
- Use process supervisor with auto-restart limits

---

## 4. Context Directory Full

### Symptom
- `spawn EINVAL` errors in Claude logs
- Cannot create new sessions
- Disk usage at 100%

### Detection Command
```bash
# Check disk usage
df -h

# Find largest directories
du -sh /srv/monorepo/.claude/* 2>/dev/null
du -sh /tmp/* 2>/dev/null

# Check context directory size
du -sh /srv/monorepo/.claude/context/

# Check for deleted but open files
lsof +D /srv/monorepo 2>/dev/null | grep deleted
```

### Fix Step by Step
```bash
# 1. Clear temporary files first
rm -rf /tmp/*.log /tmp/claude-* 2>/dev/null

# 2. Archive old context sessions
find /srv/monorepo/.claude/context -type d -mtime +7 -exec tar -czf /srv/backups/context-$(date +%Y%m%d).tar.gz {} \; \; -exec rm -rf {} \; \;

# 3. Clear download cache
rm -rf ~/.cache/claude/* 2>/dev/null

# 4. For immediate relief: remove old session logs
find /srv/monorepo/.claude -name "*.log" -mtime +1 -delete

# 5. If /srv/data is full
zfs list -t snapshot | head -10
zfs destroy monorepo/data@OLD_SNAPSHOT

# 6. Check for large core dumps
find /srv -name "core.[0-9]*" -ls -delete

# 7. Docker cleanup if needed
docker system prune -af --volumes
```

### Verification
```bash
# Check disk space is available
df -h /srv/monorepo

# Verify new sessions can start
cd /srv/monorepo && claude-code --version

# Check context directory size is reasonable
du -sh /srv/monorepo/.claude
```

### Prevention
- Set up disk space alerts at 80%
- Auto-archive context older than 7 days
- Schedule weekly cleanup cron
- Use ZFS snapshots with expiration

---

## 5. Orphaned Lock File

### Symptom
- Cannot acquire lock for resource
- Logs show `Lock file exists` errors
- Process that held lock is dead but file remains

### Detection Command
```bash
# Find lock files
find /srv/monorepo -name "*.lock" -mmin +5 -ls 2>/dev/null

# Check which process holds the lock
lsof /srv/monorepo/.claude/locks/resource.lock 2>/dev/null

# Check lock file content (if safe)
cat /srv/monorepo/.claude/locks/resource.lock 2>/dev/null

# Check for stale PID in lock file
cat /srv/monorepo/.claude/locks/*.lock | grep -E "^[0-9]+$"
```

### Fix Step by Step
```bash
# 1. Identify the lock file and what it protects
lockfile="/srv/monorepo/.claude/locks/resource.lock"

# 2. Check if process holding lock is dead
pid=$(cat "$lockfile" 2>/dev/null)
if [ -n "$pid" ]; then
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "PID $pid is dead - safe to remove"
    rm -f "$lockfile"
  else
    echo "Process $pid is alive - investigate before removing"
    ps aux | grep "$pid" | grep -v grep
  fi
fi

# 3. Force remove if process is dead
rm -f /srv/monorepo/.claude/locks/*.lock

# 4. For specific stuck operations:
# Reset Redis locks
redis-cli DEL lock:worker:1 lock:worker:2

# Reset database locks
psql -c "SELECT * FROM pg_locks WHERE granted = false;"

# Clear file handles
lsof +D /srv/monorepo 2>/dev/null | grep deleted | awk '{print $2}' | xargs -r kill -9

# 5. Restart affected services
systemctl restart SERVICE_NAME
```

### Verification
```bash
# Check lock files are gone
find /srv/monorepo/.claude -name "*.lock" -mmin -5 -ls

# Verify services are running
systemctl status SERVICE_NAME
ps aux | grep SERVICE_NAME | grep -v grep

# Test lock acquisition works
./scripts/acquire-lock.sh && echo "LOCK OK"
```

### Prevention
- Use `flock` with timeout option
- Implement lock expiration in Redis
- Add PID tracking in lock files
- Set up monitoring for stale locks

---

## Quick Reference

| Scenario | Quick Fix |
|----------|-----------|
| Deploy failed | `git checkout PREV_TAG && git push --force` |
| Queue stuck | `redis-cli DEL queue:default` then restart workers |
| Worker loop | `kill -9 WORKER_PID` then check code |
| Disk full | `rm -rf /tmp/*` then archive old sessions |
| Lock stuck | `rm -f /srv/monorepo/.claude/locks/*.lock` |

---

## Emergency Contacts

- **Infrastructure**: Check `/srv/ops/ai-governance/NETWORK_MAP.md`
- **Secrets**: Never print values — use `test -n` pattern
- **Rollback**: Always snapshot before destructive changes