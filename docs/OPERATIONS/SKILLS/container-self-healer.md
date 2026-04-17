# Skill: Container Self-Healer

**Purpose:** Automatically restart Docker containers that are in Created or Exited state, with snapshot before restart and cooldown protection against restart loops
**Complexity:** Medium
**Risk:** Medium (restarts containers, creates ZFS snapshots)
**When to Use:** `codex-host "heal containers"`, scheduled health check, Telegram alert trigger

## Decision Tree

```
SCAN: docker ps -a for containers with status Created or Exited
│
├─ CONTAINER FOUND: <name> in Created/Exited state
│  │
│  ├─ 1. Check category
│  │     Critical: coolify, prometheus, grafana, qdrant, zappro-litellm, cloudflared, tailscaled
│  │     Important: n8n, infisical, gitea, postgres-*, redis-*
│  │     Standard: Hermes Agent, browsers, searxng, cadvisor, node-exporter
│  │
│  ├─ 2. Check RestartCount via docker inspect
│  │     docker inspect <name> --format '{{.RestartCount}}'
│  │
│  ├─ 3. IF RestartCount >= 3 in last hour
│  │     → SKIP restart
│  │     → Alert CRITICAL: possible restart loop
│  │     → Log and continue to next container
│  │
│  └─ 4. IF RestartCount < 3
│        → Proceed with restart (see Procedure)
│
└─ NO STOPPED CONTAINERS FOUND
     → Log INFO: all containers healthy
     → Exit
```

---

## Procedure: Restart Stopped Container

### Step 1: Identify Stopped Containers

```bash
docker ps -a | grep -E "Created|Exited"
```

### Step 2: Inspect RestartCount

```bash
docker inspect <container> --format '{{.RestartCount}}'
```

If RestartCount >= 3 in the last hour, skip this container and alert CRITICAL.

### Step 3: Create ZFS Snapshot (Before Restart)

```bash
SNAPSHOT="tank@pre-$(docker inspect --format '{{.Name}}' <container> | tr -d '/')-$(date +%Y%m%d-%H%M%S)"
sudo zfs snapshot -r "$SNAPSHOT"
```

### Step 4: Restart Container

```bash
# For Created state:
docker start <container>

# For Exited state:
docker restart <container>
```

### Step 5: Verify Health (30 second timeout)

```bash
# Wait and check status
sleep 5
docker ps | grep <container>

# If critical container, verify specific health endpoint
# Example for qdrant:
curl -s http://localhost:6333/readyz

# Example for prometheus:
curl -s http://localhost:9090/-/healthy
```

### Step 6: Alert via Telegram

```bash
# INFO: Container restarted successfully
curl -s -X POST "https://api.telegram.org/bot$HOMELAB_BOT_TOKEN/sendMessage" \
  -d "chat_id=$HOMELAB_CHAT_ID" \
  -d "text=[INFO] Container <container> restarted successfully"

# WARN: Container restarted but needs attention
curl -s -X POST "https://api.telegram.org/bot$HOMELAB_BOT_TOKEN/sendMessage" \
  -d "chat_id=$HOMELAB_CHAT_ID" \
  -d "text=[WARN] Container <container> restarted - verify manually"

# CRITICAL: Restart loop detected or restart failed
curl -s -X POST "https://api.telegram.org/bot$HOMELAB_BOT_TOKEN/sendMessage" \
  -d "chat_id=$HOMELAB_CHAT_ID" \
  -d "text=[CRITICAL] Container <container> restart loop detected or failed - manual intervention required"
```

### Step 7: Log Action

```bash
echo "$(date '+%Y-%m-%d %H:%M:%S') | <container> | <state> | RestartCount: <n> | Action: <restarted/skipped> | Snapshot: <snapshot>" \
  >> /srv/ops/ai-governance/logs/container-self-healer.log
```

---

## Container Categories

| Category | Containers | Restart Policy |
|----------|------------|----------------|
| Critical | coolify, prometheus, grafana, qdrant, zappro-litellm, cloudflared, tailscaled | Restart always, no cooldown |
| Important | n8n, infisical, gitea, postgres-*, redis-* | Restart if RestartCount < 3 |
| Standard | Hermes Agent, browsers, searxng, cadvisor, node-exporter | Restart if RestartCount < 3 |

---

## Quick Fix Reference

| State | Command |
|-------|---------|
| Created container | `docker start <name>` |
| Exited container | `docker restart <name>` |
| Check RestartCount | `docker inspect <name> --format '{{.RestartCount}}'` |
| Verify running | `docker ps \| grep <name>` |
| View logs | `docker logs <name> --tail 50` |
| Create snapshot | `sudo zfs snapshot -r "tank@pre-<name>-$(date +%Y%m%d-%H%M%S)"` |

---

## Log

All actions are logged to `/srv/ops/ai-governance/logs/container-self-healer.log`

Format: `TIMESTAMP | container_name | previous_state | RestartCount | action | snapshot_name`

---

## Alert Levels

| Level | Trigger | Action |
|-------|---------|--------|
| INFO | Container successfully restarted | Telegram info message |
| WARN | Container restarted but may need verification | Telegram warn message |
| CRITICAL | Restart loop detected (RestartCount >= 3) or restart failed | Telegram critical message, skip container |

---

## See Also

- `monitoring-diagnostic.md` — diagnose container issues
- `zfs-snapshot-and-rollback.md` — snapshot before changes
- `linux-host-change.md` — safe modification procedures
