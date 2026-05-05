# Log Rotation

## Overview

Log rotation for homelab ops logs at `/srv/ops/logs/`.

## Configuration

**Config file:** `/etc/logrotate.d/homelab-ops`

**Policy:**
- Daily rotation
- 7-day retention
- Gzip compression
- Delay compress (keep .log.1 uncompressed for SRE tooling)
- Create new logs with `0640 will will` permissions
- Skip empty logs

**Docker logs:** Configured in `/etc/docker/daemon.json`
- Driver: `json-file`
- Max size: `10m`
- Max files: `3`

## Rotated Logs

| Log File | Size | Rotated |
|----------|------|---------|
| backup-gitea.log | - | yes |
| backup-memory-keeper.log | - | yes |
| backup-qdrant.log | - | yes |
| cleanup-sessions.log | 0 | skipped (empty) |
| docker-prune.log | - | yes |
| healing.log | - | yes |
| infra.log | - | yes |
| rca.log | - | yes |
| resource-alerts.log | - | yes |
| sre-monitor-cron.log | - | yes |
| sre-monitor.log | - | yes |
| tunnel-health.log | - | yes |

## Verification

```bash
# Check rotated files
ls -lh /srv/ops/logs/*.log.*

# Test logrotate config
sudo logrotate -f /etc/logrotate.d/homelab-ops --verbose
```

## Notes

- The `su will will` directive is required because `/srv/ops/logs/` is owned by `will:will` (non-root)
- Docker logs use json-file driver with 10m max-size and 3 max-file retention
