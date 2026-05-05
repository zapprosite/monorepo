# Deployment Runbook

**Severity:** P2 | **Estimated Time:** 15-30 minutes

---

## Pre-Deployment

```bash
# 1. Health check
nexus-investigate.sh all 3

# 2. Snapshot (if ZFS)
zfs snapshot tank/data@pre-deploy-$(date +%Y%m%d)

# 3. Context check
nexus-context-window-manager.sh status
```

---

## Deployment Methods

### Via Nexus SRE

```bash
# Full deploy with governance
nexus-sre.sh deploy /srv/myapp

# Quick deploy
nexus-governance.sh quick-deploy /srv/myapp myapp 4011
```

### Via Coolify

```bash
# Through Coolify UI
# https://coolify.zappro.site
```

### Manual Docker

```bash
# 1. Pull latest
docker pull <image>

# 2. Stop old
docker stop <service>

# 3. Start new
docker run -d --name <service> --restart unless-stopped <image>

# 4. Verify
nexus-investigate.sh <service> 3
```

---

## Post-Deployment

```bash
# 1. Health check
nexus-investigate.sh all 3

# 2. Check logs
docker logs <service> --tail 50

# 3. Create alert (if rollback needed)
nexus-alert.sh alert warn "Deployed" "<service> updated"
```

---

## Rollback

```bash
# 1. Identify last good version
docker images | grep <service>

# 2. Stop current
docker stop <service>

# 3. Run previous version
docker run -d --name <service> --restart unless-stopped <image>:<previous-tag>

# 4. Verify
nexus-investigate.sh <service> 3
```

---

## Emergency Rollback

```bash
# If deployed code is broken
# 1. Restore from ZFS snapshot
zfs rollback tank/data@pre-deploy-YYYYMMDD

# 2. Restart affected services
docker restart $(docker ps -q)
```

---

## Sign-Off

```bash
# Log deployment
echo "$(date) - Deployed <service>" >> /srv/logs/deploy.log
```
