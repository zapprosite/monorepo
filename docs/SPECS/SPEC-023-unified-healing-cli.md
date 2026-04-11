# Unified Healing System — CLI Commands

**Version:** 1.0 | **Date:** 2026-04-10
**Scope:** `/heal` commands for homelab container health, restart management, and alerting

---

## Overview

The unified healing system provides CLI commands to monitor, restart, and alert on homelab containers. It extends the existing `self-healing.sh` cron job with interactive manual commands.

### Command Family

| Command | Purpose |
|---------|---------|
| `/heal status` | Show all containers with health and restart stats |
| `/heal restart <container>` | Manually restart a container (if not pinned) |
| `/heal unblock <container>` | Clear restart loop protection for a container |
| `/heal logs <container>` | Tail logs of a specific container |
| `/heal snapshot` | Manually trigger a ZFS snapshot |
| `/heal alert test` | Send a test Telegram alert |
| `/heal dashboard` | Open Grafana dashboard URL |

---

## Global Flags

| Flag | Description |
|------|-------------|
| `--json` | Output in JSON format |
| `--quiet`, `-q` | Suppress informational messages |
| `--dry-run` | Preview action without executing |

---

## 1. `/heal status`

### Purpose
Show all containers with health status, restart count, and blocked state.

### Arguments
None.

### Output Format

```
╔══════════════════════════════════════════════════════════════════════╗
║  HEAL STATUS — 2026-04-10 14:35:00                                  ║
╠══════════════════════╦════════╦══════════╦═══════════╦═══════════════╣
║ CONTAINER            ║ STATUS ║ HEALTH   ║ RESTARTS  ║ FLAGS        ║
╠══════════════════════╬════════╬══════════╬═══════════╬═══════════════╣
║ openclaw-...72f      ║ Up     ║ healthy  ║ 2         ║ [PINNED]      ║
║ zappro-litellm       ║ Up     ║ healthy  ║ 0         ║               ║
║ zappro-wav2vec2      ║ Up     ║ healthy  ║ 1         ║               ║
║ coolify-proxy        ║ Up     ║ healthy  ║ 0         ║ [PINNED]      ║
║ zappro-litellm-db    ║ Exited ║ —        ║ 3         ║ [BLOCKED]     ║
╚══════════════════════╩════════╩══════════╩═══════════╩═══════════════╝

Summary: 4 Up | 1 Exited | 0 Blocked
```

### Flags

| Flag | Description |
|------|-------------|
| `--all`, `-a` | Include non-critical containers (default: critical only) |
| `--filter <status>` | Filter by status (running, exited, created) |
| `--json` | Output as JSON |

### Error Handling

- If Docker daemon not accessible: `ERROR: Cannot connect to Docker daemon`
- If container does not exist: `ERROR: Container 'xyz' not found`
- Rate limit file missing: treated as count=0

### Implementation

```bash
# Pseudocode logic
for container in $(docker ps -a --format '{{.Names}}'); do
    status=$(docker inspect --format '{{.State.Status}}' $container)
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' $container)
    restart_count=$(docker inspect --format '{{.RestartCount}}' $container)
    rate_count=$(jq -r ".$container.count // 0" /tmp/container-restart-attempts.json)
    is_pinned=$(is_pinned_container $container)

    if [[ $rate_count -ge 3 ]]; then
        flags="[BLOCKED]"
    elif [[ $is_pinned == "true" ]]; then
        flags="[PINNED]"
    fi

    print_row "$container" "$status" "$health" "$restart_count" "$flags"
done
```

---

## 2. `/heal restart <container>`

### Purpose
Manually restart a container. Fails if container is pinned or in rate-limited state.

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<container>` | Yes | Container name or ID |

### Output Format

**Success:**
```
[OK] Restarting container 'zappro-wav2vec2'...
[OK] Container 'zappro-wav2vec2' restarted successfully
[OK] Health check passed after 5s
```

**Failure — Pinned:**
```
[FAIL] Container 'coolify-proxy' is PINNED
[FAIL] Pinned containers cannot be restarted manually
[INFO] See: /srv/monorepo/docs/GOVERNANCE/PINNED-SERVICES.md
```

**Failure — Blocked:**
```
[FAIL] Container 'zappro-litellm-db' is BLOCKED (rate limit: 3/3 restarts in last hour)
[FAIL] Use '/heal unblock zappro-litellm-db' to clear the block
```

**Failure — Not Found:**
```
[FAIL] Container 'nonexistent' not found
[INFO] Run '/heal status' to see available containers
```

### Confirmation Prompt

For non-critical containers, prompt before restart:

```
Restart container 'zappro-wav2vec2'? [y/N]: _
```

For critical containers (coolify, litellm-db, etc.), prompt with warning:

```
[WARNING] 'coolify-proxy' is a critical container
Restarting may affect routing for all services
Continue? [y/N]: _
```

### Flags

| Flag | Description |
|------|-------------|
| `--force`, `-f` | Skip confirmation prompt |
| `--dry-run` | Show what would happen without restarting |
| `--snapshot` | Create ZFS snapshot before restart (default: true) |

### Error Handling

- Container not found: exit 1, error message
- Container already running but unhealthy: restart anyway
- Rate limit reached: exit 1, suggest `/heal unblock`
- Container is pinned: exit 1, show PINNED-SERVICES.md reference

### Implementation Notes

1. Check if pinned: look up in PINNED-SERVICES.md registry
2. Check rate limit: read `/tmp/container-restart-attempts.json`
3. Create ZFS snapshot before restart (unless `--snapshot=false`)
4. Execute `docker restart <container>`
5. Wait 5 seconds, verify health
6. Update rate limit file on success

---

## 3. `/heal unblock <container>`

### Purpose
Clear the restart loop protection for a container, resetting its rate limit counter.

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<container>` | Yes | Container name or ID |

### Output Format

**Success:**
```
[OK] Cleared rate limit for 'zappro-litellm-db'
[OK] Counter reset to 0 (window: 1 hour)
[INFO] Container can be restarted again
```

**Failure — Not Found:**
```
[FAIL] Container 'xyz' not found
```

**Failure — Not Blocked:**
```
[OK] Container 'zappro-wav2vec2' is not blocked
[INFO] Current rate limit: 1/3 (no action needed)
```

### Confirmation Prompt

```
Unblock container 'zappro-litellm-db'? This will allow restart attempts again.
Current state: BLOCKED (3/3 restarts used)
[y/N]: _
```

### Error Handling

- Container not in rate limit file: treat as count=0, no action needed
- Invalid JSON in rate limit file: rebuild from scratch, warn user

### Implementation

```bash
# Remove container entry from rate limit file
jq "del(.\"$container\")" /tmp/container-restart-attempts.json > /tmp/rate-limit-tmp.json
mv /tmp/rate-limit-tmp.json /tmp/container-restart-attempts.json
```

---

## 4. `/heal logs <container>`

### Purpose
Tail logs of a specific container in real-time.

### Arguments

| Argument | Required | Description |
|----------|----------|-------------|
| `<container>` | Yes | Container name or ID |

### Output Format

```
--- Tailing logs: zappro-wav2vec2 (Ctrl+C to stop) ---
2026-04-10T14:35:01.123Z INFO  Listening on port 8201
2026-04-10T14:35:02.456Z INFO  Model loaded: jonatasgrosman/wav2vec2-large-xlsr-53-portuguese
2026-04-10T14:36:10.789Z DEBUG Handling transcription request
...
```

### Flags

| Flag | Default | Description |
|------|---------|-------------|
| `--lines`, `-n` | 50 | Number of historical lines to show first |
| `--follow`, `-f` | true | Follow log output (use `--no-follow` to disable) |
| `--timestamps`, `-t` | false | Include timestamps |
| `--since <duration>` | | Show logs from duration (e.g., `1h`, `30m`, `1d`) |

### Error Handling

- Container not found: `ERROR: No such container: xyz`
- Container not running: `WARN: Container 'xyz' is not running (state: exited)`
- Docker log fetch fails: show error and suggest `docker logs` directly

### Implementation

```bash
# With --follow (default)
docker logs -f --tail ${lines:-50} --timestamps "$container"

# Without --follow
docker logs --tail ${lines:-50} --timestamps "$container"
```

---

## 5. `/heal snapshot`

### Purpose
Manually trigger a ZFS snapshot of the `tank` pool.

### Output Format

**Success:**
```
[OK] Creating ZFS snapshot: tank@manual-20260410-143500
[OK] Snapshot created successfully
[OK] Snapshot: tank@manual-20260410-143500
```

**Failure — No Permission:**
```
[FAIL] Cannot create ZFS snapshot
[FAIL] Error: permission denied
[INFO] Run: sudo zfs snapshot -r tank@manual-...
```

**Failure — Pool Not Found:**
```
[FAIL] ZFS pool 'tank' not found
[INFO] Available pools: $(zfs list -t snapshot -o name | cut -d@ -f1 | sort -u)
```

### Confirmation Prompt

```
Create ZFS snapshot of 'tank' pool?
Snapshot name: tank@manual-20260410-143500
[y/N]: _
```

### Flags

| Flag | Description |
|------|-------------|
| `--pool` | Pool name (default: `tank`) |
| `--name` | Custom snapshot name (default: auto-generated) |
| `--dry-run` | Preview snapshot name without creating |
| `--recursive`, `-r` | Recursive snapshot of all datasets (default: true) |

### Error Handling

- `zfs` command not found: `ERROR: ZFS not installed`
- Pool does not exist: `ERROR: Pool 'xyz' not found`
- Snapshot name conflicts: append timestamp

---

## 6. `/heal alert test`

### Purpose
Send a test Telegram alert to verify notification pipeline.

### Output Format

**Success:**
```
[OK] Sending test alert to Telegram...
[OK] Alert sent successfully
[INFO] Message: [TEST] Heal system test — 2026-04-10 14:35:00
[INFO] Chat ID: $HOMELAB_CHAT_ID
```

**Failure — No Token:**
```
[FAIL] Telegram bot token not configured
[FAIL] HOMELAB_BOT_TOKEN environment variable not set
[INFO] Set with: export HOMELAB_BOT_TOKEN=your_token
```

**Failure — API Error:**
```
[FAIL] Telegram API error: Invalid bot token
[FAIL] HTTP 401: Unauthorized
```

### Flags

| Flag | Description |
|------|-------------|
| `--message`, `-m` | Custom message (default: auto-generated test) |
| `--chat-id` | Override default chat ID |

---

## 7. `/heal dashboard`

### Purpose
Print the Grafana dashboard URL for monitoring.

### Output Format

```
Dashboard: https://monitor.zappro.site
[INFO] Open in browser? Run: open https://monitor.zappro.site
[INFO] Or use: /heal dashboard --open
```

### Flags

| Flag | Description |
|------|-------------|
| `--open`, `-o` | Open URL in default browser |
| `--host` | Show internal host URL (bypasses Cloudflare Access) |

### Error Handling

- If `open` command not available: just print URL

### Output (--host flag)

```
Internal: http://localhost:3100
[INFO] Use internal URL when on VPN/home network
```

---

## Shared Error Codes

| Code | Meaning |
|------|---------|
| `E_DOCKER_NOT_RUNNING` | Docker daemon not accessible |
| `E_CONTAINER_NOT_FOUND` | Container name does not exist |
| `E_CONTAINER_PINNED` | Container is pinned, cannot restart |
| `E_RATE_LIMITED` | Container is blocked due to restart loop |
| `E_SNAPSHOT_FAILED` | ZFS snapshot creation failed |
| `E_ALERT_FAILED` | Telegram alert delivery failed |

---

## Pinned Services Registry

Containers that CANNOT be restarted via `/heal restart`:

| Container | Reason |
|-----------|--------|
| `openclaw-qgtzrmi6771lt8l7x8rqx72f` | OpenClaw voice gateway |
| `coolify-proxy` | Traefik reverse proxy |
| `zappro-kokoro` | Kokoro TTS service |
| `zappro-tts-bridge` | TTS voice filter |
| `zappro-wav2vec2` | wav2vec2 STT service |
| `cloudflared` | Cloudflare Tunnel |

---

## Rate Limit Behavior

- File: `/tmp/container-restart-attempts.json`
- Max attempts: 3 per container per hour
- After 3 attempts: container marked `[BLOCKED]`
- Auto-reset: after 1 hour window expires
- Manual reset: `/heal unblock <container>`

---

## Implementation Checklist

- [ ] `heal status` — enumerate all containers, show health, restart count, flags
- [ ] `heal restart` — check pinned, check rate limit, confirm, snapshot, restart, verify
- [ ] `heal unblock` — remove entry from rate limit file
- [ ] `heal logs` — wrap `docker logs` with follow and filters
- [ ] `heal snapshot` — ZFS snapshot with confirmation
- [ ] `heal alert test` — Telegram API call with error handling
- [ ] `heal dashboard` — print/open Grafana URL
- [ ] Shared: error handling, exit codes, JSON output, dry-run mode

---

## Related Documents

- `/srv/monorepo/docs/OPERATIONS/SKILLS/self-healing.sh` — auto-healing cron
- `/srv/monorepo/docs/OPERATIONS/SKILLS/container-self-healer.md` — container healing skill
- `/srv/monorepo/docs/GOVERNANCE/PINNED-SERVICES.md` — pinned services registry
- `/srv/monorepo/docs/OPERATIONS/SKILLS/monitoring-diagnostic.md` — Grafana diagnostics