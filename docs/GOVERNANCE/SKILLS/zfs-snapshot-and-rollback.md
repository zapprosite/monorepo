# Skill: ZFS Snapshot & Rollback

**Purpose:** Safe snapshot creation and rollback recovery
**Complexity:** Medium
**Risk:** Medium (rollback loses recent changes)

## When to Use

- Before structural infrastructure changes
- Before Docker/service modifications
- Before ZFS property changes
- Before package upgrades that might break services

## Preflight Checklist

- [ ] Verify services are running: `docker ps`
- [ ] Verify disk space: `df -h /srv` (>10% free)
- [ ] Verify ZFS pool healthy: `zpool status tank`
- [ ] Know what change will happen (document it)
- [ ] Have rollback plan if change fails

## Procedure: Create Snapshot

```bash
# 1. Choose descriptive name
# Format: tank@pre-YYYYMMDD-hhmmss-description

# 2. Create snapshot
SNAPSHOT="tank@pre-$(date +%Y%m%d-%H%M%S)-docker-upgrade"
sudo zfs snapshot -r "$SNAPSHOT"

# 3. Verify created
zfs list -t snapshot | grep pre-

# 4. Document in change log
echo "$(date '+%Y-%m-%d %H:%M') | Snapshot created: $SNAPSHOT" 
```

## Procedure: Rollback

**WARNING:** Rollback destroys all changes since snapshot.

```bash
# 1. Identify snapshot name
zfs list -t snapshot

# 2. Stop services to prevent conflicts
docker compose -f /srv/apps/platform/docker-compose.yml stop

# 3. Rollback (careful!)
SNAPSHOT="tank@pre-20260316-140000-docker-upgrade"
sudo zfs rollback -r "$SNAPSHOT"

# 4. Restart services
docker compose -f /srv/apps/platform/docker-compose.yml up -d

# 5. Verify health
docker ps
curl http://localhost:6333/health
curl http://localhost:5678/api/v1/health
```

## Validation

After snapshot/rollback:
```bash
# All datasets rolled back
zfs list tank

# Services running
docker ps

# Data accessible
df -h /srv
ls -la /srv/data/
```

## Rollback Conditions

Rollback if:
- Change broke services
- Data became inaccessible
- Unexpected behavior
- Validation tests fail

Do NOT rollback if:
- Change succeeded (just delete snapshot)
- You're not sure what changed (investigate first)

## Cleanup

After successful change:
```bash
# Remove old snapshots (keep pre-change ones for reference)
# Keep only the most recent successful changes
zfs list -t snapshot
# Can delete old test/failed snapshots
sudo zfs destroy tank@failed-20260316-130000
```

## Risk Assessment

**High Risk if:**
- Multiple structural changes pending
- Database actively being modified
- No recent backup available

**Low Risk if:**
- Simple service restart
- Documentation change
- Backed up with /srv/ops/scripts/backup-*.sh

## Examples

### Example 1: Before Docker Upgrade
```bash
# Snapshot
sudo zfs snapshot -r "tank@pre-$(date +%Y%m%d-%H%M%S)-docker-upgrade"

# Upgrade Docker
docker pull qdrant/qdrant:new-version
docker compose -f /srv/apps/platform/docker-compose.yml up -d --pull always

# Verify
curl http://localhost:6333/health

# If good: keep snapshot for reference
# If bad: rollback using procedure above
```

### Example 2: Before ZFS Property Change
```bash
# Snapshot (critical!)
sudo zfs snapshot -r "tank@pre-$(date +%Y%m%d-%H%M%S)-compression-test"

# Change property
sudo zfs set compression=zstd tank

# Monitor
zfs get compressratio tank

# If issues: rollback
sudo zfs rollback -r "tank@pre-TIMESTAMP-compression-test"
```

## Emergencies

If rollback itself fails:
1. Stop services immediately
2. Check ZFS status: `zpool status tank`
3. Try importing pool: `sudo zpool import tank`
4. If pool corrupted: restore from external backup (RECOVERY.md)

---

**See Also:** RECOVERY.md for disaster scenarios
