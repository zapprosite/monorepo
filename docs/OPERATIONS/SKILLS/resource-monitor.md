# Skill: Resource Monitor (Rate Limits + Memory Cleanup)

**Purpose:** Proactive monitoring of API rate limits and system memory cleanup for cron jobs
**Complexity:** Low
**Risk:** Low (read-only monitoring + safe cleanup)
**Runs:** Every 15 minutes via cron

## When to Use

- As a cron job to keep system healthy between other agent runs
- After incidents involving rate limiting (Telegram, Cloudflare, LiteLLM)
- When GPU VRAM is high or system memory is pressured
- As a preventative maintenance skill

## What It Monitors

### API Rate Limits
- **Telegram Bot API**: Track `retry_after` responses and 429 errors
- **Cloudflare API**: Tunnel status and rate limit headers
- **LiteLLM API**: Model availability and latency spikes
- **n8n Webhook**: Failed deliveries and queue depth

### Memory Pressure
- **Host memory**: Page cache, dentry cache, tmpfs usage
- **GPU VRAM**: High utilization (>85% warn, >95% critical)
- **Docker**: Dangling images, unused volumes, stopped containers
- **ZFS**: Arc size, compression ratio, snapshot bloat
- **Coolify**: Build cache size, old image layers

### Process Health
- **OOM killer**: Check dmesg for recent OOM events
- **Throttling**: CPU throttling events (thermal/power)
- **Disk pressure**: iowait, disk queue depth

## Cleanup Actions

### Safe (Always OK)
- Remove dangling Docker images (`docker image prune -f`)
- Clean tmp directories (`/tmp/*.tmp`, `/var/tmp/*.tmp` older than 7 days)
- Clear Coolify build cache if >10GB
- Prune stopped containers (>30 days old)

### Requires Free Space Check
- Rotate old ZFS snapshots (when pool >75%)
- Clean old Coolify backups (keep last 7)
- Prune old Docker build cache

### Requires Approval
- Remove any dataset snapshots
- Delete Coolify production backups
- Clear Docker volumes

## Metrics Collected

```json
{
  "api_rate_limits": {
    "telegram": { "status": "ok", "last_429": null, "cooldown_active": false },
    "cloudflare": { "status": "ok", "tunnel_active": true },
    "litellm": { "status": "ok", "last_error": null }
  },
  "memory": {
    "host": { "used_pct": 72, "cached_pct": 45, "swap_pct": 0 },
    "gpu": { "used_pct": 67, "available_mb": 4096 },
    "docker": { "dangling_images_mb": 0, "stopped_containers": 3 }
  },
  "oom_events": {
    "count_1h": 0,
    "last_occurrence": null
  },
  "cleanup_performed": []
}
```

## Integration

This skill is designed to run as a standalone `resource_agent.sh` that executes via cron, complementing the other agents (health, gpu, llm). It does not need to integrate into other agents since it runs independently.

## Alerting

- **Rate limit approaching**: WARN when `retry_after` seen, CRITICAL when cooldown active
- **Memory pressure**: WARN at 85% GPU VRAM or 90% host memory
- **OOM detected**: CRITICAL immediately
- **Cleanup performed**: INFO (logged, no push notification)

## Skill Dependencies

- `container-self-healer` — For restart loop handling
- `oom-killer` — For OOM detection context
- ZFS snapshot/rollback skill — For snapshot management during cleanup

## Cron Entry

```cron
# Run every 15 minutes
*/15 * * * * /srv/ops/agents/scripts/resource_agent.sh >> /srv/ops/agents/logs/resource_agent.log 2>&1
```

## Exit Codes

- 0: Success, no issues
- 1: One or more warnings (logged, processed)
- 2: Critical condition (alert enqueued)
- 3: Lock could not be acquired (already running)
