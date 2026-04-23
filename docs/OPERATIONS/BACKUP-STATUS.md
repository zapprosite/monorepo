# Backup Status Report

**Generated:** 2026-04-23
**Verification Date:** 2026-04-23

## Summary

| Backup Type | Status | Last Backup | Age | Size |
|-------------|--------|-------------|-----|------|
| Redis | OK | Apr 22 22:20 | <1 day | 27.8 KB |
| Models | OK | Apr 22 22:23 | <1 day | 6.5 GB |
| Qdrant | OK | Apr 22 03:16 | <1 day | 3.3 MB |
| Gitea | OK | Apr 22 02:30 | <1 day | 74.4 MB |
| Coolify DB | OK | Apr 08 13:23 | 14 days | 6.5 MB |

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
- **Status:** RECENT (Apr 22 22:23)
- **Verdict:** OK (< 7 days, reasonable size)

### Qdrant Backup
- **Location:** `/srv/backups/qdrant/`
- **Files:**
  - `qdrant-backup-20260422-031638.tar.gz` (3.3 MB)
  - `qdrant-backup-20260422-031638.tar.gz.sha256` (checksum)
  - `qdrant-backup-20260422-031638.meta` (metadata)
- **Status:** RECENT (Apr 22 03:16)
- **Verdict:** OK (< 7 days, includes checksum validation)

### Gitea Backup
- **Location:** `/srv/backups/`
- **File:** `gitea-dump-20260422.tar.gz`
- **Size:** 74,394,148 bytes (74.4 MB)
- **Status:** RECENT (Apr 22 02:30)
- **Verdict:** OK (< 7 days, recent daily backups confirmed)
- **Retention:** 7 days (old files auto-deleted)

### Coolify Database Backup
- **Location:** `/srv/backups/`
- **File:** `coolify-db-20260408.sql.enc`
- **Size:** 6,558,288 bytes (6.5 MB)
- **Status:** OLD (Apr 08 13:23 - 14 days ago)
- **Verdict:** WARNING (> 7 days)

## Cron Jobs

All backup cron jobs are configured:

| Schedule | Task | Script |
|----------|------|--------|
| Daily 2:00 | Memory/SQLite backup | `/srv/ops/scripts/backup-memory-keeper.sh` |
| Daily 3:00 | Qdrant backup | `/srv/ops/scripts/backup-qdrant.sh` |
| Daily 2:30 | Gitea backup | Inline tar command |
| Daily 2:45 | Infisical PostgreSQL | `/srv/ops/scripts/backup-infisical.sh` |
| Daily 3:00 | Redis backup | `/srv/ops/scripts/backup-redis.sh` |
| Sun 4:00 | Models backup | `/srv/ops/scripts/backup-models.sh` |

## Issues

1. **Coolify DB backup is 14 days old** - Last backup was Apr 8. This may be expected if Coolify is not frequently modified, but should be monitored.

## Recommendations

- Monitor Coolify backup age - verify if bi-weekly is intentional
- All other backups are fresh and within retention policy