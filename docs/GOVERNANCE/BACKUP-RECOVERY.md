# Backup and Recovery — Operations Manual

**Scope:** System-wide backup strategy for homelab at `zappro.site`
**Last Updated:** 2026-04-30

---

## 1. What to Backup

### Critical Assets

| Asset | Path | Description | Priority |
|-------|------|-------------|----------|
| `queue.json` | `/srv/monorepo/` | Autonomous pipeline state queue | P0 |
| `context/` | `/srv/monorepo/.context/` | Harness state, workflows, sessions | P0 |
| SQLite DB | `/srv/monorepo/memory-keeper/memory.db` | Agent memory and task history | P0 |
| Gitea data | `/srv/data/gitea/` | Repos, issues, CI configs | P1 |
| Qdrant collections | `/srv/data/qdrant/` | Vector memory, embeddings | P1 |
| Redis RDB | `/srv/backups/redis/` | Cache, session state | P1 |
| Docker volumes | `/srv/docker-data/` | PostgreSQL, config data | P1 |
| Models | `/srv/models/` or `/srv/backups/models/` | Downloaded LLM weights | P2 |
| `.env` | `/srv/monorepo/.env` | Secrets — **excluded from git**, backed up via file copy | P0 |
| Ops configs | `/srv/ops/` | Scripts, governance, CI configs | P1 |

### Assets Excluded from Backup

- `node_modules/`, `vendor/`, `.cache/` — rebuildable
- `*.log` files — rotate instead
- `.env` — backed up as a file copy, not in git

### Backup Inventory Script

```bash
# List all assets and their last backup time
ls -la /srv/backups/redis/
ls -la /srv/backups/qdrant/
ls -la /srv/backups/
```

---

## 2. Backup Schedule

### Retention Policy

| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| Redis | Daily at 00:00 | 7 days | `/srv/backups/redis/` |
| Qdrant | Daily at 03:00 | 7 days | `/srv/backups/qdrant/` |
| Gitea | Daily at 02:30 | 7 days | `/srv/backups/` |
| Memory / SQLite | Daily at 02:00 | 7 days | `/srv/backups/` |
| PostgreSQL | Daily at 02:45 | 7 days | `/srv/backups/` |
| Models | Weekly (Sunday 04:00) | 2 weeks | `/srv/backups/models/` |
| Coolify DB | Bi-weekly | 4 weeks | `/srv/backups/` |

### Active Cron Jobs

```cron
# Redis
0 0 * * * bash /srv/ops/scripts/backup-redis.sh >> /srv/ops/logs/backup-redis.log 2>&1

# Memory/SQLite
0 2 * * * bash /srv/ops/scripts/backup-memory-keeper.sh >> /srv/ops/logs/backup-memory.log 2>&1

# Gitea
30 2 * * * tar -czf /srv/backups/gitea-dump-$(date +\%Y\%m\%d_\%H\%M\%S).tar.gz -C /srv/data/gitea .

# PostgreSQL
45 2 * * * bash /srv/ops/scripts/backup-.sh >> /srv/ops/logs/backup-postgres.log 2>&1

# Qdrant
0 3 * * * bash /srv/ops/scripts/backup-qdrant.sh >> /srv/ops/logs/backup-qdrant.log 2>&1

# Models (Sunday)
0 4 * * 0 bash /srv/ops/scripts/backup-models.sh >> /srv/ops/logs/backup-models.log 2>&1
```

### Offsite / Cold Storage

- **Frequency:** Weekly (after models backup on Sunday)
- **Target:** External disk at `/srv/backups/cold/` — verify monthly that the disk is mounted and readable

---

## 3. Backup Verification

### Verification Checklist

After each backup job runs, check:

1. **File exists** — backup file was created
2. **Size > 0** — file is not empty
3. **Checksum matches** — SHA256 hash in `.sha256` sidecar file matches on restore
4. **Timestamp recent** — file is from the expected run window

### Automated Verification Scripts

```bash
# Redis
bash /srv/ops/scripts/verify-redis-backup.sh /srv/backups/redis/redis-backup.rdb.gz

# Qdrant (checksum)
sha256sum /srv/backups/qdrant/qdrant-backup-*.tar.gz
cat /srv/backups/qdrant/qdrant-backup-*.sha256  # compare values

# Gitea (size check)
ls -lh /srv/backups/gitea-dump-*.tar.gz
```

### Pre-Restore Checklist

Before restoring anything:

```bash
# Confirm the backup file is within retention window (≤ 7 days)
find /srv/backups/redis/ -name "*.rdb.gz" -mtime -7 -ls

# Confirm checksum before touching production
sha256sum /srv/backups/redis/redis-backup.rdb.gz
```

### Monitoring

- **Backup Status Report:** generated weekly at `/srv/monorepo/docs/OPERATIONS/BACKUP-STATUS.md`
- **Log directory:** `/srv/ops/logs/backup-*.log`
- **Alert:** If any backup is older than 7 days, investigate immediately

---

## 4. Recovery Procedure

### Redis

```bash
# 1. Stop Redis
sudo systemctl stop redis

# 2. Identify the latest backup
latest=$(ls -t /srv/backups/redis/*.rdb.gz | head -1)

# 3. Verify checksum
sha256sum "$latest"

# 4. Decompress and restore
gunzip -k "$latest"  # keep original
mv /var/lib/redis/dump.rdb /var/lib/redis/dump.rdb.bak
gunzip -c "$latest" > /var/lib/redis/dump.rdb

# 5. Start Redis
sudo systemctl start redis

# 6. Verify
redis-cli ping
```

### Qdrant

```bash
# 1. Stop Qdrant container
docker stop qdrant

# 2. Identify the latest backup
latest=$(ls -t /srv/backups/qdrant/qdrant-backup-*.tar.gz | head -1)

# 3. Extract to restore dir
mkdir -p /srv/backups/qdrant/restore/
tar -xzf "$latest" -C /srv/backups/qdrant/restore/

# 4. Copy collection files to Qdrant data dir
cp -r /srv/backups/qdrant/restore/* /srv/data/qdrant/

# 5. Start Qdrant
docker start qdrant

# 6. Verify
curl -s http://localhost:6333/collections | jq '.result.collections'
```

### Gitea

```bash
# 1. Stop Gitea
docker stop gitea

# 2. Identify the latest dump
latest=$(ls -t /srv/backups/gitea-dump-*.tar.gz | head -1)

# 3. Extract (will overwrite /srv/data/gitea/)
tar -xzf "$latest" -C /srv/data/gitea/

# 4. Start Gitea
docker start gitea

# 5. Verify
docker exec gitea gitea admin user list
```

### Memory / SQLite (memory-keeper)

```bash
# 1. Identify the latest backup
latest=$(ls -t /srv/backups/memory-keeper-*.db.gz | head -1)

# 2. Decompress
gunzip -c "$latest" > /tmp/memory-restore.db

# 3. Verify with sqlite3
sqlite3 /tmp/memory-restore.db "SELECT COUNT(*) FROM memories;"

# 4. Replace production DB
cp /srv/monorepo/memory-keeper/memory.db /srv/monorepo/memory-keeper/memory.db.bak
cp /tmp/memory-restore.db /srv/monorepo/memory-keeper/memory.db
```

### PostgreSQL

```bash
# 1. Identify the latest SQL dump
latest=$(ls -t /srv/backups/*.sql.gz | head -1)

# 2. Decompress
gunzip -c "$latest" > /tmp/restore.sql

# 3. Restore (database must exist)
psql -U postgres -d monorepo < /tmp/restore.sql

# Or via MCP:
# Use mcp__claude_ai_postgres__query to connect and restore
```

---

## 5. Disaster Recovery

### Scenario: Machine Lost / Total Failure

**Assumption:** The host is dead, data disks are intact, backups exist at `/srv/backups/`.

#### Phase 1 — Assess

```bash
# What disks survived?
lsblk
mount

# What backups exist?
ls -lh /srv/backups/
ls -lh /srv/backups/redis/
ls -lh /srv/backups/qdrant/
ls -lh /srv/backups/models/

# Check last backup dates
tail -5 /srv/ops/logs/backup-redis.log
tail -5 /srv/ops/logs/backup-qdrant.log
```

#### Phase 2 — Rebuild Host

```bash
# 1. Reinstall Ubuntu / Debian base
# 2. Mount data disks to /srv/data, /srv/backups

# 3. Restore ops tooling
apt update && apt install -y git curl jq docker.io redis-server postgresql

# 4. Restore monorepo
git clone https://github.com/zappro/monorepo.git /srv/monorepo

# 5. Restore ops scripts
cp -r /srv/backups/ops-etc/ /srv/ops/
```

#### Phase 3 — Restore Services

**Redis:**
```bash
sudo systemctl start redis
gunzip -c /srv/backups/redis/redis-latest.rdb.gz > /var/lib/redis/dump.rdb
sudo systemctl restart redis
redis-cli ping
```

**Qdrant:**
```bash
docker run -d --name qdrant \
  -v /srv/data/qdrant:/qdrant/storage \
  -p 6333:6333 -p 6334:6334 \
  qdrant/qdrant
# Then restore collections from backup
```

**Gitea:**
```bash
docker run -d --name gitea \
  -v /srv/data/gitea:/data \
  -p 3000:3000 -p 2222:2222 \
  gitea/gitea:latest
tar -xzf /srv/backups/gitea-dump-latest.tar.gz -C /srv/data/gitea/
docker restart gitea
```

**PostgreSQL:**
```bash
sudo systemctl start postgresql
gunzip -c /srv/backups/postgres-latest.sql.gz | psql -U postgres -d monorepo
```

**Memory-keeper:**
```bash
gunzip -c /srv/backups/memory-keeper-latest.db.gz > /srv/monorepo/memory-keeper/memory.db
```

#### Phase 4 — Verify

```bash
# Redis
redis-cli ping  # expect: PONG

# Qdrant
curl -s http://localhost:6333/ | jq '.result.ok'

# Gitea
curl -s http://localhost:3000/ | grep -o "Gitea"

# PostgreSQL
psql -U postgres -d monorepo -c "SELECT 1;"

# Memory-keeper
sqlite3 /srv/monorepo/memory-keeper/memory.db "SELECT COUNT(*) FROM memories;"
```

#### Phase 5 — Rebuild Models (if cold storage was used)

```bash
# If models were on external disk, reconnect and restore
tar -xzf /srv/backups/models/models-latest.tar.gz -C /srv/models/
```

---

### Recovery Time Estimates

| Service | RTO (Recover Time Objective) | RPO (Recovery Point Objective) |
|---------|------------------------------|--------------------------------|
| Redis | 15 min | < 24 hours |
| Qdrant | 30 min | < 24 hours |
| Gitea | 30 min | < 24 hours |
| PostgreSQL | 30 min | < 24 hours |
| Memory-keeper | 15 min | < 24 hours |
| Models (6.5 GB) | 2 hours | < 1 week |

---

### Emergency Contacts

| Role | Contact |
|------|---------|
| Cloudflare (DNS) | `CF_GLOBAL_KEY` in `.env` — use for zone changes |
| Gitea | Local instance at `http://localhost:3000` |
| Coolify | Local at `http://localhost:8000` |

---

## Appendix — Quick Reference

```bash
# Verify all backups exist and are recent (≤ 7 days)
find /srv/backups/ -type f \( -name "*.rdb.gz" -o -name "*.tar.gz" -o -name "*.sql.gz" \) -mtime -7 | sort

# Check backup logs for errors
grep -i error /srv/ops/logs/backup-*.log

# Disk space check before backup
df -h /srv/backups/
```