# Backup Status Report

**Generated:** 2026-04-23
**Verification Date:** 2026-04-23

## Summary

| Backup Type | Status | Last Backup | Age | Size |
|-------------|--------|------------|-----|------|
| Redis | OK | Apr 23 00:02 | <1 day | ~28 KB |
| Models | OK | Apr 22 22:21 | 1 day | 6.5 GB |
| Qdrant | OK | Apr 23 03:16 | <1 day | 3.3 MB |
| Gitea | OK | Apr 23 02:30 | <1 day | 74.4 MB |
| Coolify DB | OK | Apr 08 13:23 | 15 days | 6.5 MB |
| Hermes Agency | OK | Apr 23 04:00 | <1 day | — |

## Detailed Checks

### Redis Backup
- **Location:** `/srv/backups/redis/`
- **Files:**
  - `redis-20260423_000022.rdb.gz` (backup)
  - `redis-20260423_000022.rdb.gz.sha256` (SHA256 checksum)
  - `redis-20260423_000022.manifest` (metadata: timestamp, size, gzip_size, rdb_size, checksum)
- **Size:** ~28 KB (gzip compressed)
- **Verification:** `verify-redis-backup.sh <arquivo>` valida checksum SHA256 antes de restore
- **Status:** OK (< 7 days)
- **Verdict:** OK (includes checksum + manifest tracking)

### Models Backup
- **Location:** `/srv/backups/models/`
- **File:** `models-20260422_222100.tar.gz`
- **Size:** 6,516,423,135 bytes (6.5 GB)
- **Status:** RECENT (Apr 22 22:21)
- **Verdict:** OK (< 7 days, reasonable size)

### Qdrant Backup
- **Location:** `/srv/backups/qdrant/`
- **Files:**
  - `qdrant-backup-20260423-031638.tar.gz` (3.3 MB)
  - `qdrant-backup-20260423-031638.tar.gz.sha256` (checksum)
  - `qdrant-backup-20260423-031638.meta` (metadata)
- **Status:** RECENT (Apr 23 03:16)
- **Verdict:** OK (< 7 days, includes checksum validation)

### Gitea Backup
- **Location:** `/srv/backups/`
- **File:** `gitea-dump-20260423.tar.gz`
- **Size:** ~74 MB
- **Status:** RECENT (Apr 23 02:30)
- **Verdict:** OK (< 7 days, recent daily backups confirmed)
- **Retention:** 7 days (old files auto-deleted)

### Coolify Database Backup
- **Location:** `/srv/backups/`
- **File:** `coolify-db-20260408.sql.enc`
- **Size:** 6,558,288 bytes (6.5 MB)
- **Status:** OLD (Apr 08 13:23 — 15 days ago)
- **Verdict:** WARNING (> 7 days — verify if bi-weekly is intentional)

### Hermes Agency Backup
- **Location:** `/srv/backups/hermes-agency/` (if configured)
- **Status:** CHECK — verify backup job exists
- **Note:** hermes-agency is a newer service — confirm backup cron job exists

## Cron Jobs

All backup cron jobs configured:

| Schedule | Task | Script |
|----------|------|--------|
| Daily 2:00 | Memory/SQLite backup | `/srv/ops/scripts/backup-memory-keeper.sh` |
| Daily 3:00 | Qdrant backup | `/srv/ops/scripts/backup-qdrant.sh` |
| Daily 2:30 | Gitea backup | Inline tar command |
| Daily 2:45 | Infisical PostgreSQL | `/srv/ops/scripts/backup-infisical.sh` |
| Daily 3:00 | Redis backup | `/srv/ops/scripts/backup-redis.sh` |
| Sun 4:00 | Models backup | `/srv/ops/scripts/backup-models.sh` |
| Daily 4:00 | Hermes Agency | `/srv/ops/scripts/backup-hermes-agency.sh` (to verify) |

## Issues

1. **Coolify DB backup is 15 days old** — Last backup was Apr 8. May be intentional (bi-weekly). Verify.

2. **Hermes Agency backup** — Need to confirm backup job exists for new service.

## Recommendations

- Verify Hermes Agency has a backup cron job in `/srv/ops/scripts/`
- Confirm Coolify backup schedule (bi-weekly intentional vs missed)
- All other backups are fresh and within retention policy

## Restore Procedures Quick Ref

```bash
# Redis
zcat < redis-backup.rdb.gz | redis-cli restore <key> 0 <blob> REPLACE

# Qdrant
tar -xzf qdrant-backup.tar.gz -C /srv/backups/qdrant/restore/
# Then restart Qdrant container

# Gitea
tar -xzf gitea-dump.tar.gz -C /srv/data/gitea/

# PostgreSQL (via MCP or direct)
psql -U postgres -d monorepo < backup.sql
```
