# Backup & Restore Runbook

**Severity:** P1 | **Estimated Time:** 30-60 minutes

---

## Backup Schedule

| What | When | Retention |
|------|------|-----------|
| ZFS snapshots | Daily 02:00 | 7 days |
| Docker volumes | Weekly | 4 weeks |
| Config files | On change | Git |
| Database dumps | Daily 03:00 | 7 days |

---

## Verify Backups

```bash
# ZFS status
zfs list -t snapshot | grep daily

# Docker volumes
docker volume ls | grep backup

# Last backup time
cat /srv/backups/.last-backup
```

---

## Restore Procedures

### Redis

```bash
# 1. Stop Redis
docker stop zappro-redis

# 2. Restore
docker run --rm -v zappro-redis-data:/data -v /srv/backups/redis:/backup ubuntu bash -c "cd /data && tar -xf /backup/redis-latest.tar"

# 3. Start Redis
docker start zappro-redis

# 4. Verify
docker exec zappro-redis redis-cli -a "$REDIS_PASSWORD" PING
```

### PostgreSQL

```bash
# 1. Stop database
docker stop zappro-litellm-db

# 2. Restore
docker run --rm -v zappro-litellm-db-data:/var/lib/postgresql/data -v /srv/backups/postgres:/backup ubuntu bash -c "cd /var/lib/postgresql/data && tar -xf /backup/postgres-latest.tar"

# 3. Start database
docker start zappro-litellm-db

# 4. Verify
docker exec zappro-litellm-db pg_isready
```

### Gitea

```bash
# 1. Stop Gitea
docker stop zappro-gitea

# 2. Restore git data
tar -xzf /srv/backups/gitea-latest.tar -C /srv/gitea/

# 3. Start Gitea
docker start zappro-gitea

# 4. Verify
curl -f http://localhost:3300/health
```

---

## Emergency Restore

```bash
# If everything is lost
# 1. Recreate volumes
docker volume create zappro-redis-data
docker volume create zappro-litellm-db-data

# 2. Pull latest backups
rsync -av /srv/backups/docker-data/ /srv/docker-data/

# 3. Restart all
docker restart $(docker ps -aq)
```

---

## Test Restore

After any restore, run:

```bash
nexus-investigate.sh all 3
docker ps
nexus-alert.sh list
```

---

## Sign-Off

```bash
echo "$(date) - Backup verified" >> /srv/logs/backup.log
```
