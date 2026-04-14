# Backup Runbook — will-zappro Homelab

**Host:** will-zappro
**Last Updated:** 2026-04-14 (revised)
**Review Cycle:** Monthly

---

## 1. ZFS Topology

### Pool Overview

```
Pool:     tank
Size:     3.62 TB
Used:     67.6 GB (1.8%)
Health:   ONLINE
Disk:     nvme0n1 (Crucial CT4000T700SSD3 - 3.64 TB)
Compression: lz4 (1.2x ratio)
Scrub:    Sun Apr 12 20:31:48 2026 — 0 errors
```

### Datasets

| Dataset | Mountpoint | Used | Purpose |
|---------|------------|------|---------|
| `tank` | /tank | 24K | Pool root |
| `tank/backups` | /srv/backups | 268M | Backup archives |
| `tank/coolify` | /srv/data/coolify | 194K | Coolify PaaS |
| `tank/data` | /tank/data | 170K | Data container (see below) |
| `tank/data/openclaw` | /srv/data/openclaw | 118K | OpenClaw Bot |
| `tank/data/openclaw/data` | /srv/data/openclaw/data | 24K | OpenClaw data |
| `tank/data/zappro-router` | /srv/data/zappro-router | 27K | Aurelia Router |
| `tank/docker-data` | /srv/docker-data | 24.9G | Docker images/layers |
| `tank/models` | /srv/models | 38.6G | AI models (Ollama) |
| `tank/monorepo` | /srv/monorepo | 4.60G | Application code |
| `tank/qdrant` | /srv/data/qdrant | 208M | Vector database |

> **Note:** The following datasets were listed in previous versions but do NOT exist: `tank/data/n8n`, `tank/data/n8n-postgres`, `tank/data/grafana`, `tank/data/prometheus`, `tank/data/infisical-db`, `tank/data/infisical-redis`. Services like n8n, Grafana, Prometheus, and Infisical are running as Docker containers but their data resides under `tank/docker-data` or container-named datasets, not under `tank/data/`.

---

## 2. Backup Strategy

### Data Classification

| Tier | Data | RPO | RTO | Backup Method |
|------|------|-----|-----|---------------|
| **1 - Critical** | postgres, qdrant, n8n, backups | 24h | 30min | Daily tar.gz + ZFS snapshots |
| **2 - Important** | monorepo, docker-data | Pre-change | 15min | Git + ZFS snapshots |
| **3 - Convenience** | /home, memory-keeper | Weekly | 1h | Git push / tar |

### Retention Policy

| Backup Type | Frequency | Retention | Location | Status |
|-------------|------------|-----------|----------|--------|
| ZFS Snapshots | Every 6h | 7 daily, 4 weekly, 6 monthly | tank | OK |
| PostgreSQL dumps | Daily (cron missing) | 7 versions | /srv/backups/postgres | ⚠️ No cron |
| Qdrant archives | Daily 03:00 | 7 versions | /srv/backups/qdrant | OK |
| n8n archives | Daily (cron missing) | 7 versions | /srv/backups/n8n | ⚠️ No cron |
| Gitea dumps | Daily 02:30 | 7 versions | /srv/backups | OK |
| Infisical DB dumps | Daily 02:45 | 7 versions | /srv/backups | ❌ Broken (0 bytes) |
| Cloudflared credentials | Every 6h | 30 days | /srv/backups/cloudflared | OK |
| Terraform state | Every 6h | 30 days | /srv/backups/terraform | OK |
| .env secrets | Every 6h | 30 days | /srv/backups/env-secrets | OK |
| Systemd services | Every 6h | 30 days | /srv/backups/systemd | OK |
| Obsidian vault | Every 10min | Git remote | GitHub | OK |
| Memory-keeper DB | Daily 02:00 | 7 versions | /srv/backups/memory-keeper | OK |

> **Action Required:** `backup-postgres.sh` and `backup-n8n.sh` have no cron entries. Add cron schedules. Infisical DB backup produces 0-byte files (docker exec may be failing).

---

## 3. Backup Scripts

All scripts located in `/srv/ops/scripts/`.

### ZFS Snapshot Script

**Script:** `/srv/ops/scripts/backup-zfs-snapshot.sh`
**Frequency:** Every 6 hours via systemd timer
**Datasets snapshotted:**
- tank/coolify
- tank/data/openclaw
- tank/data/zappro-router
- tank/docker-data
- tank/monorepo
- tank/models
- tank/qdrant
- tank/backups

> **Historical Note:** The following datasets were previously snapshotted but NO LONGER EXIST: `tank/data/n8n`, `tank/data/n8n-postgres`, `tank/data/grafana`, `tank/data/prometheus`, `tank/data/infisical-db`, `tank/data/infisical-redis`.

**Snapshot naming:** `tank@backup-dataset-YYYYMMDD-HHMMSS`
**Scrub:** Sundays at 00:00

### Service-Specific Scripts

| Script | Target | Method |
|--------|--------|--------|
| `backup-postgres.sh` | n8n PostgreSQL | `pg_dump` + gzip |
| `backup-qdrant.sh` | Qdrant storage | tar.gz + SHA256 checksum |
| `backup-n8n.sh` | n8n workflows | tar.gz |
| `backup-gitea.sh` | Gitea (DB + repos) | tar.gz |
| `backup-memory-keeper.sh` | SQLite context DB | direct copy |
| `backup-obsidian-vault.sh` | Obsidian vault | git push |

---

## 4. Verification Procedures

### 4.1 Verify ZFS Pool Health

```bash
# Check pool status
zpool list
zpool status tank

# Check for errors
zpool status -v tank

# Verify snapshots exist
zfs list -t snapshot -r tank | grep tank@backup | tail -20
```

### 4.2 Verify Backup Integrity

```bash
# PostgreSQL — check latest backup exists and has content
ls -lh /srv/backups/postgres/ | tail -3
zcat /srv/backups/postgres/n8n-backup-*.sql.gz | head -5

# Qdrant — verify checksum
ls /srv/backups/qdrant/
sha256sum /srv/backups/qdrant/qdrant-backup-*.tar.gz | tail -1
cat /srv/backups/qdrant/qdrant-backup-*.meta | tail -1

# n8n — verify archive
ls -lh /srv/backups/n8n/
tar -tzf /srv/backups/n8n/n8n-backup-*.tar.gz | head -5
```

### 4.3 Test Restore (Quarterly)

```bash
# Create test snapshot before test
sudo zfs snapshot -r tank@pre-restore-test-$(date +%Y%m%d-%H%M%S)

# Test Qdrant restore to temp location
mkdir -p /tmp/qdrant-test-restore
tar -xzf /srv/backups/qdrant/qdrant-backup-*.tar.gz -C /tmp/qdrant-test-restore
ls /tmp/qdrant-test-restore/qdrant/
rm -rf /tmp/qdrant-test-restore

# Test PostgreSQL restore
#gunzip < /srv/backups/postgres/n8n-backup-*.sql.gz | head -20
```

### 4.4 ZFS Scrub Verification

```bash
# Check last scrub
zpool status tank | grep scan

# Run manual scrub (Sundays only recommended)
sudo zpool scrub tank &

# Monitor scrub progress
watch -n 10 'zpool status tank | grep scan'
```

---

## 5. Restore Procedures

### 5.1 ZFS Snapshot Rollback

**When:** Need to revert entire dataset to previous state.
**Time:** < 5 minutes
**Warning:** ALL changes since snapshot will be lost.

```bash
# 1. Stop affected services
docker compose -f /srv/apps/platform/docker-compose.yml stop

# 2. List available snapshots
sudo zfs list -t snapshot -r tank | grep tank@backup

# 3. Rollback (example: tank/docker-data)
sudo zfs rollback -r tank/docker-data@backup-tank-docker-data-20260414-060000

# 4. Restart services
docker compose -f /srv/apps/platform/docker-compose.yml up -d

# 5. Verify
docker ps
docker exec qdrant curl -s http://localhost:6333/health
```

### 5.2 Restore PostgreSQL

**When:** Database corruption or data loss.
**Time:** 15-30 minutes
**RPO:** Last daily backup (up to 24h data loss)

```bash
# 1. Find latest backup
ls -lrt /srv/backups/postgres/ | tail -1

# 2. Stop n8n (keep postgres running)
docker compose -f /srv/apps/platform/docker-compose.yml stop n8n

# 3. Reset database
docker exec n8n-postgres dropdb -U n8n n8n || true
docker exec n8n-postgres createdb -U n8n n8n

# 4. Restore from backup
BACKUP_FILE=$(ls -t /srv/backups/postgres/*.sql.gz | head -1)
gunzip < "$BACKUP_FILE" | docker exec -i n8n-postgres psql -U n8n -d n8n

# 5. Verify
docker exec n8n-postgres psql -U n8n -d n8n -c "SELECT COUNT(*) FROM pg_tables;"

# 6. Restart n8n
docker compose -f /srv/apps/platform/docker-compose.yml up -d n8n
```

### 5.3 Restore Qdrant

**When:** Vector database corruption or collection loss.
**Time:** 20-40 minutes
**RPO:** Last daily backup

```bash
# 1. Stop Qdrant
docker compose -f /srv/apps/platform/docker-compose.yml stop qdrant

# 2. Find latest backup
ls -lrt /srv/backups/qdrant/ | tail -1

# 3. Verify checksum
sha256sum /srv/backups/qdrant/qdrant-backup-*.tar.gz
cat /srv/backups/qdrant/qdrant-backup-*.meta

# 4. Remove current data
sudo rm -rf /srv/data/qdrant/*

# 5. Restore from backup
BACKUP_FILE=$(ls -t /srv/backups/qdrant/*.tar.gz | head -1)
sudo tar -xzf "$BACKUP_FILE" -C /srv/data

# 6. Fix permissions
sudo chown -R nobody:nogroup /srv/data/qdrant

# 7. Restart Qdrant
docker compose -f /srv/apps/platform/docker-compose.yml up -d qdrant

# 8. Verify
sleep 5
docker exec qdrant curl -s http://localhost:6333/health
docker exec qdrant curl -s http://localhost:6333/collections
```

> **Note:** Qdrant runs inside Docker network. Use `docker exec qdrant curl localhost:6333/...` instead of `curl localhost:6333/...` from the host.

### 5.4 Restore n8n

**When:** Workflow configuration loss or corruption.
**Time:** 10-20 minutes
**RPO:** Last daily backup

```bash
# 1. Stop n8n
docker compose -f /srv/apps/platform/docker-compose.yml stop n8n

# 2. Find latest backup
ls -lrt /srv/backups/n8n/ | tail -1

# 3. Remove current data
sudo rm -rf /srv/data/n8n/*

# 4. Restore from backup
BACKUP_FILE=$(ls -t /srv/backups/n8n/*.tar.gz | head -1)
sudo tar -xzf "$BACKUP_FILE" -C /srv/data

# 5. Fix permissions
sudo chown -R 1000:1000 /srv/data/n8n

# 6. Restart n8n
docker compose -f /srv/apps/platform/docker-compose.yml up -d n8n

# 7. Verify
sleep 10
curl http://localhost:5678/api/v1/health
```

---

## 6. Emergency Contacts

### Data Recovery Priority

| Priority | Contact | Role |
|----------|---------|------|
| 1 | will (Principal Engineer) | ZFS, host recovery |
| 2 | Claude Code Agent | Automation, triage |

### External Resources

| Resource | Purpose | Access |
|----------|---------|--------|
| GitHub (will-zappro/monorepo-obsidian) | Obsidian vault backup | Remote git |
| Cloudflare Dashboard | DNS, tunnels, credentials | Web UI |
| Infisical | Secrets management | API + Web |

---

## 7. Pre-Change Checklist

Before ANY destructive operation:

- [ ] **Snapshot taken:** `sudo zfs snapshot -r tank@pre-YYYYMMDD-HHMMSS-description`
- [ ] **Backup scripts run recently:** Check `/srv/ops/backup-logs/`
- [ ] **ZFS pool healthy:** `zpool status tank` shows ONLINE
- [ ] **No scrub running:** `zpool status tank | grep scan` shows last completed
- [ ] **Recovery procedure read:** Corresponding section above reviewed

---

## 8. Monitoring & Alerts

### What to Monitor

```bash
# Check space available
df -h /srv

# Check ZFS compression ratio
zfs get compressratio tank

# Check snapshot count
sudo zfs list -t snapshot -r tank | grep tank@backup | wc -l

# Check backup file ages
find /srv/backups -type f -mtime +7 -ls
```

### Alert Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| ZFS pool usage | > 50% | > 80% |
| /srv free space | < 500GB | < 200GB |
| Backup age (postgres) | > 48h | > 72h |
| Snapshot count | > 100 | > 200 |

---

## 9. Related Documentation

- [RECOVERY.md](../GOVERNANCE/RECOVERY.md) — Step-by-step recovery procedures
- [PARTITIONS.md](../INFRASTRUCTURE/PARTITIONS.md) — Physical disk layout
- [CONTRACT.md](../GOVERNANCE/CONTRACT.md) — Non-negotiable principles
- [GUARDRAILS.md](../GOVERNANCE/GUARDRAILS.md) — Forbidden operations
- `/srv/ops/scripts/backup-*.sh` — Backup script source

---

**Next Review:** 2026-05-14
**Last Tested:** Not yet tested (quarterly target: 2026-06-14)
