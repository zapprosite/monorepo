# Disaster Recovery Runbook

**Document Version:** 1.0.0
**Last Updated:** 2026-04-22
**Review Frequency:** Monthly

---

## 1. Contact Info & Escalation

### Primary Contacts

| Role | Name | Contact | Availability |
|------|------|---------|--------------|
| System Owner | Will | will@local | Always |
| Infrastructure Admin | Will | will@local | Always |

### Escalation Path

```
SEV-1 (Data Loss / Full Outage)
  └── Immediate: System Owner
        └── 15min: External support (if applicable)

SEV-2 (Partial Outage / Corruption)
  └── 30min: System Owner
        └── 1h: Document in GitHub Issues

SEV-3 (Degraded Service)
  └── Next business day: Create ticket
```

### External Resources

| Resource | URL / Contact | Notes |
|----------|--------------|-------|
| Homelab GitHub | github.com/willzappro | Issue tracking |
| Monitoring | localhost:9090 | Prometheus/Grafana |
| Backup Registry | localhost:5000 | Docker images |

---

## 2. Backup Inventory

### Overview

| Service | Backup Method | Frequency | Retention | Last Verified | Location |
|---------|---------------|-----------|-----------|---------------|----------|
| ZFS (datasets) | zfs send/recv + sanoid | Hourly snapshots | 7 daily, 4 weekly | YYYY-MM-DD | /srv/backups/zfs/ |
| PostgreSQL | pgBackRest | Every 15min WAL + daily full | 30 days | YYYY-MM-DD | /srv/backups/postgres/ |
| Redis | AOF + RDB snapshots | Every 5min | 7 days | YYYY-MM-DD | /srv/backups/redis/ |
| Docker Images | Harbor registry | On push to main | 30 days | YYYY-MM-DD | localhost:5000 |
| Qdrant | API snapshots | Daily | 7 days | YYYY-MM-DD | /srv/backups/qdrant/ |
| Config Files | git push to remote | On change | Infinite | YYYY-MM-DD | github.com/willzappro |

### ZFS Dataset Inventory

| Dataset | Mount Point | Snapshots | Remote Replica |
|---------|-------------|-----------|----------------|
| tank/data | /srv/data | hourly | yes |
| tank/docker | /var/lib/docker | daily | no |
| tank/backups | /srv/backups | daily | yes (offsite) |

### PostgreSQL Databases

| Database | Size | WAL | Point-in-time Recovery |
|----------|------|-----|------------------------|
| app_production | ~2GB | enabled | yes |
| metrics | ~500MB | enabled | yes |

---

## 3. Restore Procedures

### 3.1 ZFS Dataset

#### Pre-flight Checks

- [ ] Target system has sufficient disk space
- [ ] Network connectivity to backup location
- [ ] sudo/root access confirmed

#### Procedure

```bash
# 1. Identify the dataset to restore
zfs list -t snapshot | grep tank/data

# 2. Verify snapshot integrity
zfs diff tank/data@YYYYMMDD-HHMM

# 3. Stop services using the dataset
sudo systemctl stop <service>

# 4. Create a temporary snapshot of current (if any data exists)
sudo zfs snapshot tank/data@restore-temp

# 5. Restore from snapshot
sudo zfs rollback tank/data@YYYYMMDD-HHMM

# 6. Verify restored data
sudo zfs list tank/data
ls -la /srv/data/

# 7. Restart services
sudo systemctl start <service>
```

#### Incremental Remote Restore

```bash
# On source (has the snapshot)
zfs send -I tank/data@YYYYMMDD-0000 tank/data@YYYYMMDD-1200 | ssh target "zfs recv -F tank/data"

# Verify
ssh target "zfs list -t snapshot tank/data"
```

#### Verification

- [ ] Mount point accessible
- [ ] File count matches expected
- [ ] Checksums validated with `sha256sum`
- [ ] Services healthy

---

### 3.2 PostgreSQL

#### Pre-flight Checks

- [ ] Disk space: minimum 2x database size
- [ ] PostgreSQL service stopped (for full restore)
- [ ] WAL archive accessible

#### Point-in-Time Recovery (PITR)

```bash
# 1. Stop PostgreSQL
sudo systemctl stop postgresql

# 2. Backup current data directory
sudo -u postgres mv /var/lib/postgresql/data /var/lib/postgresql/data-broken-$(date +%Y%m%d)

# 3. Create new data directory
sudo -u postgres mkdir -p /var/lib/postgresql/data

# 4. Initialize empty database
sudo -u postgres initdb -D /var/lib/postgresql/data

# 5. Configure recovery.conf (PostgreSQL < 13) or postgresql.conf (PostgreSQL >= 13)
# Create standby.signal or recovery.signal
sudo -u postgres touch /var/lib/postgresql/data/standby.signal

# Add to postgresql.conf:
# restore_command = 'cp /srv/backups/postgres/wal/%f %p'
# recovery_target_time = 'YYYY-MM-DD HH:MM:SS UTC'

# 6. Start PostgreSQL
sudo systemctl start postgresql

# 7. Monitor recovery progress
sudo -u postgres pg_ctl status -D /var/lib/postgresql/data
tail -f /var/lib/postgresql/data/log/*.log
```

#### pgBackRest Restore

```bash
# 1. Stop PostgreSQL
sudo systemctl stop postgresql

# 2. Restore from backup
sudo pgbackrest --stanza=main --type=time --target="YYYY-MM-DD HH:MM:SS" --delta restore

# 3. Verify
sudo -u postgres pg_ctl status -D /var/lib/postgresql/data
```

#### Verification

- [ ] `pg_is_in_recovery()` returns `f`
- [ ] Database connections successful
- [ ] Application data accessible
- [ ] Replication resumed (if applicable)

---

### 3.3 Redis

#### Pre-flight Checks

- [ ] AOF file integrity
- [ ] Disk space for RDB load

#### Procedure

```bash
# 1. Verify backup exists
ls -la /srv/backups/redis/

# 2. Check Redis version compatibility (RDB format)
redis-cli INFO | grep redis_version

# 3. Stop Redis
sudo systemctl stop redis

# 4. Create backup of current state
sudo cp /var/lib/redis/dump.rdb /var/lib/redis/dump.rdb.broken-$(date +%Y%m%d)

# 5. Restore from RDB
sudo cp /srv/backups/redis/dump.rdb /var/lib/redis/dump.rdb

# 6. Restore AOF if needed
sudo cp /srv/backups/redis/appendonly.aof /var/lib/redis/appendonly.aof

# 7. Set correct permissions
sudo chown redis:redis /var/lib/redis/dump.rdb /var/lib/redis/appendonly.aof

# 8. Start Redis
sudo systemctl start redis
```

#### AOF-only Restore (No RDB)

```bash
# If only AOF backup exists, Redis will automatically rebuild RDB from AOF on first start
# Just copy the AOF file
sudo cp /srv/backups/redis/appendonly.aof /var/lib/redis/appendonly.aof
sudo systemctl start redis
```

#### Verification

- [ ] `redis-cli PING` returns `PONG`
- [ ] Key count matches expected
- [ ] `redis-cli INFO persistence` shows `aof_enabled:1`
- [ ] Application connectivity verified

---

### 3.4 Docker Containers

#### Pre-flight Checks

- [ ] Docker daemon running
- [ ] Disk space for images
- [ ] Access to image registry

#### Restore from Harbor Registry

```bash
# 1. List available images in registry
curl -s https://localhost:5000/v2/_catalog | jq .

# 2. Pull latest images
docker pull localhost:5000/<image>:<tag>

# 3. Recreate containers
docker-compose -f /srv/docker/compose/docker-compose.yml up -d

# 4. Verify all containers running
docker ps --format "table {{.Names}}\t{{.Status}}"
```

#### Restore from docker save snapshots

```bash
# 1. Load images from backup tar
docker load -i /srv/backups/docker/images-backup-YYYYMMDD.tar

# 2. Verify images loaded
docker images | grep <image-name>

# 3. Recreate containers
docker-compose -f /srv/docker/compose/docker-compose.yml up -d
```

#### Verification

- [ ] All containers running (`docker ps | grep Up`)
- [ ] Health checks passing
- [ ] Networks attached correctly
- [ ] Volumes mounted

---

### 3.5 Qdrant (Vector Database)

#### Pre-flight Checks

- [ ] Qdrant service stopped
- [ ] Snapshots directory accessible
- [ ] Disk space available

#### Procedure

```bash
# 1. List available snapshots
curl -s http://localhost:6333/collections/<collection>/snapshots | jq .

# 2. Download snapshot if on remote
# Already stored locally at /srv/backups/qdrant/

# 3. Create new collection (if needed)
curl -X PUT http://localhost:6333/collections/<new-collection> \
  -H "Content-Type: application/json" \
  -d '{
    "vectors": { "size": 1536, "distance": "Cosine" }
  }'

# 4. Restore from snapshot
curl -X PUT "http://localhost:6333/collections/<collection>/snapshots/<snapshot-name>/recover?wait=true" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "full"
  }'

# 5. Verify collection
curl -s http://localhost:6333/collections/<collection>/points/top | jq .
```

#### Alternative: Direct Filesystem Restore

```bash
# 1. Stop Qdrant
sudo systemctl stop qdrant

# 2. Backup current storage
sudo mv /srv/data/qdrant /srv/data/qdrant-broken-$(date +%Y%m%d)

# 3. Extract from backup
sudo tar -xzf /srv/backups/qdrant/qdrant-backup-YYYYMMDD.tar.gz -C /srv/data/

# 4. Start Qdrant
sudo systemctl start qdrant
```

#### Verification

- [ ] Collection exists and is accessible
- [ ] Point count matches expected
- [ ] Vector dimensions correct
- [ ] Search returns expected results

---

## 4. RTO/RPO Targets

| Service | RTO (Recovery Time Objective) | RPO (Recovery Point Objective) | Priority |
|---------|-------------------------------|--------------------------------|----------|
| ZFS (datasets) | 1 hour | 15 minutes | P1 |
| PostgreSQL | 30 minutes | 5 minutes | P1 |
| Redis | 15 minutes | 0 (AOF persistence) | P1 |
| Docker containers | 1 hour | 1 hour (image registry) | P2 |
| Qdrant | 1 hour | 1 hour (daily snapshots) | P2 |
| Monitoring | 2 hours | 24 hours | P3 |

### RTO Definition
Maximum acceptable time to restore service after a disaster begins.

### RPO Definition
Maximum acceptable data loss measured in time (e.g., data from the last 5 minutes may be lost).

---

## 5. Health Check Procedures

### Daily Health Checks

```bash
#!/bin/bash
# health-check.sh - Run daily

set -e

echo "=== Homelab Health Check - $(date) ==="

# ZFS
echo "[ZFS] Checking snapshots..."
zfs list -t snapshot -r tank | tail -5
zfs get compression tank/data

# PostgreSQL
echo "[PostgreSQL] Checking replication..."
sudo -u postgres psql -c "SELECT * FROM pg_stat_replication;" || echo "No replicas configured"
sudo pgbackrest info

# Redis
echo "[Redis] Checking memory..."
redis-cli INFO memory | grep used_memory_human
redis-cli PING

# Docker
echo "[Docker] Container status..."
docker ps --format "table {{.Names}}\t{{.Status}}"

# Qdrant
echo "[Qdrant] Collections..."
curl -s http://localhost:6333/collections | jq '.result.collections[].name'

# Backup verification
echo "[Backups] Last backup times..."
find /srv/backups -type f -mtime -1 -ls
```

### Weekly Verification

- [ ] Restore from backup to staging environment
- [ ] Test failover procedures
- [ ] Update contact information
- [ ] Review monitoring alerts (false positives)
- [ ] Verify offsite replication is working

### Monthly Procedures

1. **Backup Restoration Test**
   - Restore PostgreSQL to point-in-time on staging
   - Verify data integrity with application smoke tests

2. **Disaster Simulation**
   - Walk through DR procedures without executing
   - Identify gaps and update runbook

3. **Documentation Review**
   - Verify all paths are correct
   - Update version numbers
   - Confirm contacts are current

### Monitoring Alerts (Prometheus)

| Alert | Condition | Action |
|-------|-----------|--------|
| BackupFailed | backup_last_success < 24h | Check backup scripts, verify disk space |
| ZFSSnapshotMissing | snapshots < expected | Verify sanoid is running |
| PostgreSQLReplicationLag | replication_lag > 10s | Check network, replica health |
| RedisMemoryHigh | memory > 80% | Plan scale or cleanup |
| QdrantCollectionError | collection_errors > 0 | Check storage, restart if needed |

---

## Appendix A: Quick Reference Commands

```bash
# ZFS
zfs list -t snapshot                                  # List snapshots
zfs send tank/data@snap | ssh target zfs recv tank/data  # Replicate
sudo sanoid --cron                                    # Run snapshots

# PostgreSQL
sudo -u postgres pg_dump -Fc app_production > backup.dump  # Manual dump
sudo pgbackrest --stanza=main backup                  # Run backup
psql -c "SELECT pg_is_in_recovery();"                 # Check recovery status

# Redis
redis-cli SAVE                                        # Synchronous save
redis-cli BGREWRITEAOF                               # Rewrite AOF
redis-cli INFO persistence                            # Check AOF/RDB status

# Docker
docker ps --format "{{.Names}}:{{.Status}}"           # List container status
docker-compose -f /srv/docker/compose/docker-compose.yml logs --tail=50

# Qdrant
curl http://localhost:6333/collections | jq          # List collections
curl http://localhost:6333/cluster/health | jq       # Cluster health
```

## Appendix B: Related Documentation

- [Backup Runbook](./backup-runbook.md) — Detailed backup procedures
- [ZFS Administration](../ADMIN/ZFS.md) — ZFS management guide
- [Docker Setup](../ADMIN/DOCKER.md) — Container management
- [PostgreSQL Guide](../DATABASES/POSTGRESQL.md) — Database operations

---

**Document Owner:** Will
**Next Review:** 2026-05-22
**Change Log:** Initial version