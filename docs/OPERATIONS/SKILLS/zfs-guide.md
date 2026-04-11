# ZFS Guide — Complete Reference for Homelab Operations

**Host:** will-zappro
**Pool:** `tank`
**Last Updated:** 2026-04-11

---

## Overview

ZFS is the storage foundation of the homelab. All critical data lives in the `tank` pool with datasets for different purposes. ZFS provides:
- **Snapshots:** Point-in-time protection, zero-cost (copy-on-write)
- **Compression:** `zstd` across all datasets
- **Deduplication:** Enabled on `tank/backups`
- **Checksums:** Self-healing mirrored data

---

## Pool Structure

### Physical Layout

```
tank (pool)
├── tank/data/           # Application data (n8n, grafana, prometheus, etc.)
├── tank/docker-data/    # Docker volumes and containers
├── tank/backups/        # Backup destination (dedup enabled)
├── tank/monorepo/       # /srv/monorepo source code
├── tank/models/         # ML models (readonly)
└── tank/data/n8n-postgres/
├── tank/data/qdrant/
├── tank/data/grafana/
├── tank/data/prometheus/
├── tank/data/infisical-db/
├── tank/data/infisical-redis/
├── tank/data/coolify/
├── tank/data/openclaw/
└── tank/data/aurelia-router/
```

### Key Properties

| Dataset | Compression | Deduplication | Atime | Primary Use |
|---------|-------------|---------------|-------|-------------|
| tank | lz4 | off | off | System pool |
| tank/data/* | zstd | off | off | Application data |
| tank/backups | zstd | on | off | Backup destination |
| tank/docker-data | zstd | off | off | Docker storage |
| tank/monorepo | zstd | off | off | Source code |

---

## Essential Commands

### Pool Operations

```bash
# Check pool health (ALWAYS do this before any destructive operation)
zpool status tank

# Detailed status with device paths
zpool status -v tank

# Pool capacity and I/O stats
zpool list -o name,size,cap,alloc,free,health tank

# Import pool (if needed after reboot)
sudo zpool import tank

# Export pool (before shutdown)
sudo zpool export tank
```

### Dataset Operations

```bash
# List all datasets
zfs list

# List specific dataset tree
zfs list -r tank

# List all snapshots
zfs list -t snapshot

# Get dataset properties
zfs get all tank/data/n8n

# Get only interesting properties
zfs get -o property,value compression,dedup,atime,mountpoint tank/data

# Set compression
sudo zfs set compression=zstd tank/data/n8n

# Set atime (access time) off — reduces writes
sudo zfs set atime=off tank/data
```

### Space Monitoring

```bash
# Pool space
zpool list tank

# Dataset space usage
zfs list -o space tank

# Directory space (traditional)
df -h /srv
du -sh /srv/*

# Compression ratio for dataset
zfs get compressratio tank/data

# Detailed space breakdown
zfs list -o name,used,refer,comp,dedup tank/data
```

---

## Snapshot Management

### Naming Convention

| Type | Format | Example |
|------|--------|---------|
| Pre-change | `tank@pre-YYYYMMDD-HHMMSS-description` | `tank@pre-20260411-143000-docker-upgrade` |
| Backup | `tank@backup-tank-data-n8n-YYYYMMDD-HHMMSS` | `tank@backup-tank-data-n8n-20260411-120000` |
| Spec cleanup | `tank/monorepo@spec024-pre-cleanup-YYYY-MM-DD` | `tank/monorepo@spec024-pre-cleanup-2026-04-11` |

### Create Snapshot

```bash
# Simple snapshot (single dataset)
sudo zfs snapshot tank/data/n8n@pre-$(date +%Y%m%d-%H%M%S)-config-change

# Recursive snapshot (dataset + all descendants)
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-docker-upgrade

# Snapshot with description in name
SNAPSHOT="tank@pre-$(date +%Y%m%d-%H%M%S)-$(whoami)-config-change"
sudo zfs snapshot -r "$SNAPSHOT"
echo "Snapshot created: $SNAPSHOT"
```

### List Snapshots

```bash
# All snapshots
zfs list -t snapshot

# Snapshots for specific dataset
zfs list -t snapshot -r tank/data/n8n

# Snapshots matching pattern
zfs list -t snapshot | grep pre-
zfs list -t snapshot | grep backup-

# Human-readable size of snapshot's referenced data
zfs list -o name,used,refer tank -t snapshot
```

### Rollback

**WARNING:** Rollback destroys ALL changes since the snapshot was taken.

```bash
# 1. Stop services to prevent write conflicts
docker compose -f /srv/apps/platform/docker-compose.yml stop n8n

# 2. Identify snapshot
zfs list -t snapshot -r tank/data/n8n

# 3. Rollback single dataset
sudo zfs rollback tank/data/n8n@pre-20260411-143000-config-change

# 4. Rollback recursive (dataset + children)
sudo zfs rollback -r tank@pre-20260411-143000-docker-upgrade

# 5. Restart services
docker compose -f /srv/apps/platform/docker-compose.yml up -d

# 6. Verify
docker ps
curl http://localhost:5678/api/v1/health
```

### Clone Snapshot

Creates a new dataset from a snapshot (read-write).

```bash
# Clone snapshot to new dataset
sudo zfs clone tank/data/n8n@pre-20260411-143000-config-change tank/data/n8n-test-clone

# New dataset is independent — changes don't affect original
# When done testing, destroy the clone
sudo zfs destroy tank/data/n8n-test-clone
```

### Destroy Snapshot

```bash
# Destroy single snapshot
sudo zfs destroy tank/data/n8n@pre-20260411-143000-config-change

# Destroy snapshot recursively
sudo zfs destroy -r tank@pre-20260411-143000-docker-upgrade

# Destroy all snapshots matching pattern (dry run first!)
zfs list -t snapshot | grep "pre-20260401"
# Then destroy:
sudo zfs destroy -r tank@pre-20260401
```

---

## Scrub and Health Monitoring

### Run Scrub

```bash
# Start scrub (background — runs for hours on large pools)
nohup zpool scrub tank &

# Monitor scrub progress
zpool status tank | grep -i scrub

# Check scrub results
zpool status -v tank | grep -A5 "errors:"
```

### Smart Scrub Decision Tree

```
Pool Status Check: zpool status tank
         │
  ┌──────┼──────┐
  ▼      ▼      ▼
Online Degraded Faulted
  │       │       │
  ▼       ▼       ▼
Check Error Counts
  │
 ┌─┼─┬────┐
 ▼ ▼ ▼    ▼
 0 <10  >10 growing
  │   │    │     │
  ▼   ▼    ▼     ▼
 OK  WARN  WARN  CRITICAL
             └───────→ Snapshot + Alert immediately
```

### Alert Thresholds

| Level | Condition | Action |
|-------|-----------|--------|
| INFO | Scrub completed clean | Log result |
| WARN | Correctable errors < 10 | Monitor |
| WARN | Scrub took > 4 hours | Investigate disk |
| ERROR | Correctable errors > 10 | Snapshot + inspect disk |
| ERROR | Unrecoverable errors | CRITICAL — snapshot + replace disk |
| CRITICAL | Errors growing | Replace disk immediately |

### SMART Check

```bash
# Identify disks in pool
ls -la /dev/disk/by-id/
zpool status -v tank

# Check SMART for specific disk
smartctl -a /dev/disk/by-id/<disk-serial>

# Critical SMART indicators:
# Reallocated_Sector_Ct > 0       → disk failing
# Current_Pending_Sector > 0      → sectors awaiting remap
# UDMA_CRC_Error_Count increasing → cable/connector issue
# Wear_Leveling_Count < 5%        → SSD end of life
```

---

## Integration with Healing Pipeline

### Pre-Operation Checklist

Before any service modification:

```bash
# 1. Verify pool health
zpool status tank

# 2. Check space (>10% free)
df -h /srv

# 3. Document current state
docker ps > /tmp/docker-state-$(date +%Y%m%d-%H%M%S).txt

# 4. Create snapshot
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-$(whoami)-change

# 5. Verify snapshot
zfs list -t snapshot | grep "pre-$(date +%Y%m%d)"
```

### Rollback Workflow for Healing

```bash
# 1. Identify degradation
docker ps | grep -E "Exit|_Exit"
zpool status tank

# 2. Stop affected services
docker compose -f /srv/apps/platform/docker-compose.yml stop

# 3. Rollback to last known good snapshot
SNAPSHOT=$(zfs list -t snapshot -r tank -o name | grep "pre-" | tail -1)
sudo zfs rollback -r "$SNAPSHOT"

# 4. Restart services
cd /srv/apps/platform
docker compose up -d

# 5. Verify
docker ps
curl http://localhost:6333/health  # Qdrant
curl http://localhost:5678/api/v1/health  # n8n
```

### Auto-Healer Integration

The docker-autoheal service monitors container restarts. ZFS snapshots provide recovery points:

```bash
# After docker-autoheal restarts a container
# → Check if repeated restart indicates data corruption
# → If so, snapshot current state and rollback to stable snapshot

# Snapshot current state before investigation
sudo zfs snapshot -r tank@pre-investigation-$(date +%Y%m%d-%H%M%S)
```

---

## Snapshot Lifecycle (Backup Rotation)

### Retention Policy

| Type | Keep | Purpose |
|------|------|---------|
| Pre-change | Until change verified | 1-7 days |
| Backup (daily) | 7 days | Short-term recovery |
| Backup (weekly) | 4 weeks | Monthly recovery |
| Backup (monthly) | 12 months | Archive |
| Spec-related | Per SPEC timeline | Project work |

### Cleanup Old Snapshots

```bash
# List all pre-change snapshots
zfs list -t snapshot | grep "pre-"

# List backup snapshots older than 7 days
zfs list -t snapshot -o name,creat | grep backup- | awk '$2 < "2026-04-04"'

# Destroy specific old snapshot
sudo zfs destroy tank@pre-20260401-140000-docker-upgrade

# Dry run — see what would be deleted (add -n flag doesn't exist in zfs,
# so first list what you plan to delete)

# Destroy snapshots matching date range
# Example: destroy all pre- snapshots from March 2026
for snap in $(zfs list -H -o name -t snapshot | grep "pre-202603"); do
    echo "Would destroy: $snap"
    # Uncomment to actually delete:
    # sudo zfs destroy "$snap"
done
```

---

## Common Operations

### Before Docker Upgrade

```bash
# Snapshot
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-docker-upgrade

# Upgrade
docker pull qdrant/qdrant:new-version
docker compose -f /srv/apps/platform/docker-compose.yml up -d --pull always

# Verify
curl http://localhost:6333/health

# If bad: rollback
sudo zfs rollback -r tank@pre-$(date +%Y%m%d-%H%M%S)-docker-upgrade
docker compose up -d
```

### Before ZFS Property Change

```bash
# Snapshot (CRITICAL — property changes can cause issues)
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-compression-test

# Change property
sudo zfs set compression=zstd tank/data

# Monitor effect
zfs get compressratio tank/data

# Verify
zfs list tank/data

# If issues: rollback
sudo zfs rollback -r tank@pre-$(date +%Y%m%d-%H%M%S)-compression-test
```

### Before Config File Change

```bash
# Snapshot just the specific dataset
sudo zfs snapshot tank/data/grafana@pre-$(date +%Y%m%d-%H%M%S)-config-change

# Make config change
# ...

# If broken: rollback
sudo zfs rollback tank/data/grafana@pre-$(date +%Y%m%d-%H%M%S)-config-change
```

### Verify Snapshot Integrity

```bash
# List snapshots and their size
zfs list -t snapshot -o name,used,refer

# Clone to test integrity
sudo zfs clone tank/data/n8n@pre-20260411-120000 tank/data/n8n-integrity-test

# Check cloned data
ls -la /tank/data/n8n-integrity-test/

# Clean up test clone
sudo zfs destroy tank/data/n8n-integrity-test
```

---

## Monitoring Scripts

### Quick Health Check

```bash
#!/bin/bash
# zfs-health-check.sh

POOL="tank"
LOG="/srv/ops/ai-governance/logs/zfs-smart-scrub.log"

echo "$(date '+%Y-%m-%d %H:%M') | INFO | Running ZFS health check" >> "$LOG"

# Pool status
STATUS=$(zpool status -v tank | grep -E "state:|errors:")
echo "$(date '+%Y-%m-%d %H:%M') | $STATUS" >> "$LOG"

# Space check
SPACE=$(df -h /srv | tail -1 | awk '{print $5}' | tr -d '%')
if [ "$SPACE" -gt 85 ]; then
    echo "$(date '+%Y-%m-%d %H:%M') | CRITICAL | Pool at ${SPACE}% capacity" >> "$LOG"
fi

# Error counts
ERRORS=$(zpool status -v tank | grep "errors:" | awk '{print $4}' | tr -d '[:punctuation:]')
if [ -n "$ERRORS" ] && [ "$ERRORS" -gt 0 ]; then
    echo "$(date '+%Y-%m-%d %H:%M') | ERROR | Pool has uncorrectable errors: $ERRORS" >> "$LOG"
fi

echo "$(date '+%Y-%m-%d %H:%M') | INFO | Health check complete" >> "$LOG"
```

### Scrub Schedule

Recommended: Run scrub weekly (Sunday 03:00) via systemd timer.

```bash
# /srv/ops/agents/scripts/zfs-scrub.sh
#!/bin/bash
nohup zpool scrub tank &
echo "$(date '+%Y-%m-%d %H:%M') | INFO | ZFS scrub started" >> /srv/ops/ai-governance/logs/zfs-smart-scrub.log
```

---

## Datasets Reference

### tank/data

Application data. Structure:

```
tank/data/
├── n8n/                 # Workflow automation
├── n8n-postgres/        # n8n PostgreSQL database
├── qdrant/              # Vector database
├── grafana/             # Metrics dashboard
├── prometheus/          # Time series database
├── infisical-db/        # Secrets database
├── infisical-redis/     # Secrets cache
├── coolify/             # PaaS deployment
├── openclaw/            # Voice bot
├── aurelia-router/      # API gateway
└── opencode/            # Code search
```

### tank/docker-data

Docker storage (`/srv/docker-data`):
- Named volumes
- Container filesystems
- Build cache

### tank/backups

Backup destination (dedup enabled):
- `/srv/backups/postgres/*.sql.gz`
- `/srv/backups/qdrant/*.tar.gz`
- Coolify backups
- Config archives

### tank/monorepo

Source code (`/srv/monorepo`). Snapshots before structural changes:
```bash
sudo zfs snapshot -r tank/monorepo@spec024-pre-cleanup-$(date +%Y-%m-%d)
```

---

## Troubleshooting

### Pool Degraded

```bash
# Check which device failed
zpool status -v tank

# Replace failed device
sudo zpool replace tank <old-device> <new-device>

# If device temporarily unavailable
sudo zpool online tank <device>
```

### Cannot Import Pool

```bash
# Force import
sudo zpool import -f tank

# Check pool name
sudo zpool import
```

### Snapshot Creation Fails

```bash
# Check space
zpool list tank

# Check dataset exists
zfs list -r tank | grep <dataset>

# Check snapshot name syntax
# Snapshot names: dataset@name (no spaces, special chars limited)
```

### Rollback Fails

```bash
# Dataset might be busy — stop services first
docker stop $(docker ps -q)
docker compose -f /srv/apps/platform/docker-compose.yml stop

# Try again
sudo zfs rollback -r tank@pre-20260411-120000

# If still fails: use -f force (will unmount)
sudo zfs rollback -rf tank@pre-20260411-120000
```

---

## Related Documents

| Document | Purpose |
|----------|---------|
| `zfs-snapshot-and-rollback.md` | Detailed snapshot/rollback procedures |
| `monitoring-zfs-snapshot.md` | Monitoring stack snapshot guide |
| `zfs-smart-scrub.md` | Intelligent scrub with error analysis |
| `backup-rotate-verify.md` | Backup verification and rotation |
| `snapshot-safe` (skill) | Pre-destruction checklist skill |
| `container-self-healer.md` | Docker auto-heal integration |
| `HOMELAB-SURVIVAL-GUIDE.md` | Golden rules including snapshot-before-all |

---

## Quick Reference Card

```bash
# HEALTH CHECK
zpool status tank && zpool list tank && df -h /srv

# CREATE SNAPSHOT
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-description

# LIST SNAPSHOTS
zfs list -t snapshot | grep pre-

# ROLLBACK
docker compose -f /srv/apps/platform/docker-compose.yml stop
sudo zfs rollback -r tank@PREVIOUS-SNAPSHOT
docker compose up -d

# MONITOR SCRUB
zpool status tank | grep -i scrub

# SPACE
zfs list -o space tank && df -h /srv

# COMPRESSION
zfs get compressratio tank/data
```