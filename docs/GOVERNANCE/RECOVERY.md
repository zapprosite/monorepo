# Recovery Procedures

**Host:** will-zappro
**Last Updated:** 2026-03-16

Step-by-step procedures to recover from various failures.

## SCENARIO 1: ZFS Snapshot Rollback

**When to use:** Any change broke something and you have a snapshot.
**Time:** < 5 minutes
**Data loss:** Everything after snapshot is lost

### Procedure

```bash
# 1. Stop services to prevent conflicts
docker compose -f /srv/apps/platform/docker-compose.yml stop

# 2. Verify snapshot exists
sudo zfs list -t snapshot

# 3. Identify the snapshot name
# Example: tank@pre-20260316-140000-docker-upgrade

# 4. Rollback (WARNING: destructive, loses all changes since snapshot)
sudo zfs rollback -r tank@pre-20260316-140000-docker-upgrade

# 5. Restart services
docker compose -f /srv/apps/platform/docker-compose.yml up -d

# 6. Verify health
docker compose -f /srv/apps/platform/docker-compose.yml ps
curl http://localhost:6333/health
```

---

## SCENARIO 2: PostgreSQL Database Corruption

**When to use:** n8n won't start, database errors, queries failing.
**Time:** 15-30 minutes
**Data loss:** Minimal if recent backup available

### Procedure

```bash
# 1. Check status
docker compose -f /srv/apps/platform/docker-compose.yml ps n8n-postgres

# 2. Check logs for error details
docker logs n8n-postgres | tail -100

# 3. Try restart first (may fix transient issues)
docker compose -f /srv/apps/platform/docker-compose.yml restart n8n-postgres
sleep 10
docker exec n8n-postgres pg_isready -U n8n

# 4. If still broken, restore from backup
# Find latest backup
ls -lrt /srv/backups/postgres/ | tail -1

# 5. Extract and restore
BACKUP_FILE="/srv/backups/postgres/n8n-backup-20260316-120000.sql.gz"

# Stop n8n (but not postgres, we need it to restore)
docker compose -f /srv/apps/platform/docker-compose.yml stop n8n

# Reset database
docker exec n8n-postgres dropdb -U n8n n8n || true
docker exec n8n-postgres createdb -U n8n n8n

# Restore from backup
gunzip < "$BACKUP_FILE" | docker exec -i n8n-postgres psql -U n8n -d n8n

# 6. Verify restore worked
docker exec n8n-postgres psql -U n8n -d n8n -c "SELECT COUNT(*) FROM pg_tables;"

# 7. Restart n8n
docker compose -f /srv/apps/platform/docker-compose.yml up -d n8n

# 8. Verify
curl http://localhost:5678/api/v1/health
```

---

## SCENARIO 3: Qdrant Data Loss

**When to use:** Qdrant container deleted, storage corrupted, or collections lost.
**Time:** 20-40 minutes
**Data loss:** Lost since last backup

### Procedure

```bash
# 1. Check Qdrant status
curl http://localhost:6333/health

# 2. If healthy, verify collections
curl http://localhost:6333/collections

# 3. If unhealthy, check logs
docker logs qdrant | tail -100

# 4. Try restart
docker compose -f /srv/apps/platform/docker-compose.yml restart qdrant
sleep 10
curl http://localhost:6333/health

# 5. If storage is corrupted, restore from backup
docker compose -f /srv/apps/platform/docker-compose.yml stop qdrant

# Find latest backup
ls -lrt /srv/backups/qdrant/ | tail -1

# Remove current data
sudo rm -rf /srv/data/qdrant/*

# Restore from backup
BACKUP_FILE="/srv/backups/qdrant/qdrant-backup-20260316-120000.tar.gz"
sudo tar -xzf "$BACKUP_FILE" -C /srv/data

# Fix permissions
sudo chown -R nobody:nogroup /srv/data/qdrant

# 6. Restart Qdrant
docker compose -f /srv/apps/platform/docker-compose.yml up -d qdrant

# 7. Verify
sleep 5
curl http://localhost:6333/health
curl http://localhost:6333/collections
```

---

## SCENARIO 4: n8n Configuration Loss

**When to use:** n8n won't start, config corrupted, or secrets missing.
**Time:** 10-20 minutes
**Data loss:** Workflows lost since backup

### Procedure

```bash
# 1. Check n8n status
curl http://localhost:5678/api/v1/health

# 2. Check logs
docker logs n8n | tail -100

# 3. Try restart
docker compose -f /srv/apps/platform/docker-compose.yml restart n8n
sleep 10

# 4. If still broken, restore from backup
docker compose -f /srv/apps/platform/docker-compose.yml stop n8n

# Find latest backup
ls -lrt /srv/backups/n8n/ | tail -1

# Remove current data (CAREFUL!)
sudo rm -rf /srv/data/n8n/*

# Restore from backup
BACKUP_FILE="/srv/backups/n8n/n8n-backup-20260316-120000.tar.gz"
sudo tar -xzf "$BACKUP_FILE" -C /srv/data

# Fix permissions (n8n runs as UID 1000)
sudo chown -R 1000:1000 /srv/data/n8n

# 5. Restart n8n
docker compose -f /srv/apps/platform/docker-compose.yml up -d n8n

# 6. Verify
sleep 10
curl http://localhost:5678/api/v1/health
```

---

## SCENARIO 5: Docker Engine Failure

**When to use:** Docker daemon won't start or containers won't run.
**Time:** 5-15 minutes
**Data loss:** None (data persists in ZFS)

### Procedure

```bash
# 1. Check Docker service
systemctl status docker

# 2. Check logs
journalctl -u docker -n 100

# 3. Try restart Docker service
sudo systemctl restart docker
sleep 5
docker ps

# 4. If still broken, check disk space
df -h /srv/docker-data
du -sh /srv/docker-data

# 5. If full, cleanup dangling images
docker image prune -a -f

# 6. If corrupted, check Docker data directory
ls -la /srv/docker-data/

# 7. If very broken, restart with cleanup
sudo systemctl stop docker
sudo rm -rf /srv/docker-data/containerd  # Remove corrupted state
sudo systemctl start docker
sleep 10

# 8. Restart containers
docker compose -f /srv/apps/platform/docker-compose.yml up -d

# 9. Verify
docker ps
docker compose -f /srv/apps/platform/docker-compose.yml ps
```

---

## SCENARIO 6: ZFS Pool Import (After Disk Replacement)

**When to use:** nvme0n1 was replaced and you have external ZFS backup.
**Time:** 30-60 minutes
**Data loss:** None if backup available

### Prerequisites
- External drive with ZFS pool backup
- nvme0n1 installed and visible to system

### Procedure

```bash
# 1. Check current state
zpool list
zfs list 2>/dev/null || echo "No pool imported"

# 2. Mount external drive
lsblk  # Find external drive device (e.g., /dev/sdb)
mount /dev/sdb1 /mnt/external

# 3. Check if backup pool visible
zpool import -d /mnt/external

# 4. Import pool from backup
sudo zpool import -d /mnt/external tank

# 5. Verify import
zpool status tank
zfs list tank

# 6. Restart Docker (will recognize new mountpoints)
sudo systemctl restart docker

# 7. Start services
docker compose -f /srv/apps/platform/docker-compose.yml up -d

# 8. Verify health
docker ps
curl http://localhost:6333/health
curl http://localhost:5678/api/v1/health
```

---

## SCENARIO 7: Host OS Reinstall (Ubuntu Corrupted)

**When to use:** System disk corrupted, OS unbootable, security breach.
**Time:** 1-2 hours (includes clean Ubuntu install + recovery)
**Data loss:** None (all in /srv on nvme0n1)

### Prerequisites
- Ubuntu 24.04 LTS installation media
- nvme0n1 still healthy with all /srv data

### Procedure

```bash
# 1. Boot from Ubuntu installation media

# 2. Select "Try Ubuntu" (don't install yet)

# 3. Open terminal and mount /srv
sudo mkdir -p /mnt/recovery
# Identify nvme0n1 (usually /dev/nvme0n1, check lsblk)
sudo zpool import -R /mnt/recovery tank

# 4. Verify /srv is accessible
ls /mnt/recovery/tank/

# 5. Install fresh Ubuntu to nvme1n1
# (Run installer from menu)

# 6. After fresh install, boot into new system

# 7. Mount /srv from nvme0n1
sudo zpool import tank
sudo zfs mount -r tank

# 8. Verify all data intact
ls /srv/
ls /srv/data/

# 9. Reinstall Docker
sudo apt update && sudo apt install -y docker.io docker-compose

# 10. Update Docker data-root to /srv/docker-data (already mounted)
sudo tee /etc/docker/daemon.json > /dev/null <<EOF
{
  "storage-driver": "overlay2",
  "data-root": "/srv/docker-data"
}
EOF
sudo systemctl restart docker

# 11. Start services
cd /srv/apps/platform
docker compose up -d

# 12. Verify
docker ps
curl http://localhost:6333/health
```

---

## SCENARIO 8: Partial Service Recovery (Single Service)

**When to use:** One service broken, others OK.
**Time:** 5-10 minutes
**Data loss:** Minimal

### Example: Recover only Qdrant

```bash
# 1. Stop just Qdrant
docker compose -f /srv/apps/platform/docker-compose.yml stop qdrant

# 2. Restore from snapshot or backup
# Snapshot method:
sudo zfs rollback tank/qdrant@pre-20260316-140000

# 3. Or backup method:
sudo rm -rf /srv/data/qdrant/*
sudo tar -xzf /srv/backups/qdrant/latest-backup.tar.gz -C /srv/data

# 4. Restart single service
docker compose -f /srv/apps/platform/docker-compose.yml up -d qdrant

# 5. Verify
curl http://localhost:6333/health
```

---

## SCENARIO 9: Out-of-Disk Space

**When to use:** /srv is full, services won't start.
**Time:** 10-30 minutes
**Solution:** Clean up old data/backups

### Procedure

```bash
# 1. Check disk usage
df -h /srv
du -sh /srv/*

# 2. Find large files
find /srv -type f -size +100M -exec du -h {} \;

# 3. Clean old backups (safely)
ls -lrt /srv/backups/*/
# Remove OLD backups (keep 7 most recent):
ls -t /srv/backups/postgres/*.sql.gz | tail -n +8 | xargs rm -v

# 4. Clean Docker images
docker image prune -a -f

# 5. Check again
df -h /srv
zfs get compressratio tank  # Check if compression is working
```

---

## SCENARIO 10: Service Won't Start (Generic)

**When to use:** Any service won't start.
**Diagnostic Tree:**

```
Service won't start?
├─ Check logs: docker logs servicename
├─ Is postgres running? (needed by n8n)
│  └─ If no: docker compose up -d n8n-postgres first
├─ Is disk full? df -h /srv
│  └─ If yes: Clean backups, images
├─ Is port already in use? netstat -tlnp | grep PORT
│  └─ If yes: Kill conflicting process or change port
├─ Is health check failing?
│  └─ Check service config in docker-compose.yml
├─ Is volume missing?
│  └─ Restore from ZFS snapshot or backup
└─ If nothing works: Rollback to pre-change snapshot
   sudo zfs rollback -r tank@pre-TIMESTAMP
```

---

**Last Updated:** 2026-03-16
**Test Recovery Quarterly:** Pick a procedure and test on snapshot
