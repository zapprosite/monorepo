# Physical Partitions & Allocation Map

**Host:** homelab (Ubuntu 24.04 LTS)
**Last Updated:** 2026-03-16

This document is the authoritative map of where data lives and why.

## 1. Physical Disks

### nvme1n1: System Disk (Kingston SNV3S1000G - 931.5 GB)

**Purpose:** Operating system, boot, user profiles
**NEVER alter this disk at raw level.**

```
nvme1n1 (931.5 GB total)
├── nvme1n1p1  (1 GB)     → /boot/efi      [FAT32, EFI boot]
├── nvme1n1p2  (274 GB)   → /               [ext4, OS root]
└── nvme1n1p3  (651 GB)   → /home           [ext4, user home]
```

**Capacity Usage:**

- `/`: 30 GB / 274 GB (12% - mostly OS, temp, logs)
- `/home`: ~100 GB / 651 GB (15% - user files, caches)

**Backup:** System disk is NOT backed up. It can be rebuilt from Ubuntu 24.04 LTS.
**Recovery:** System reinstall keeps /srv intact (mounted separately).

---

### nvme0n1: Data Disk (Crucial CT4000T700SSD3 - 3.64 TB)

**Purpose:** All persistent application data
**CRITICAL: ZFS pool "tank" lives entirely on this disk.**
**NEVER alter this disk at raw level.**

```
nvme0n1 (3.64 TB total)
└── ZFS pool "tank" (3.64 TB raw capacity)
    ├── compression: lz4 (enabled)
    ├── atime: off (performance optimized)
    └── [datasets below]
```

**NEVER:**

- Run `wipefs` on this disk
- Run `dd` on this disk
- Create filesystems on this disk outside ZFS
- Partition this disk manually
- Export/destroy the pool

**Recovery:** ZFS pool is backed up via snapshots. Can mount from external drive in emergency.

---

## 2. ZFS Pool Structure

### Pool "tank" (3.64 TB)

**Properties:**

- `compression=lz4` (fast, good ratio)
- `atime=off` (reduces disk writes)
- `recordsize=128KB` (good for mixed workload)

```
tank/                                    (root of pool)
├── docker-data/      → /srv/docker-data
│   └── Purpose: Docker container images, layers, configs
│   └── Size: ~2 GB (grows with new images)
│   └── Backing: Docker daemon (auto-managed)
│   └── Policy: Snapshots before major upgrades
│
├── postgres/         → /srv/data/postgres
│   └── Purpose: n8n PostgreSQL database
│   └── Size: ~500 MB (depends on workflow history)
│   └── Backing: /srv/backups/postgres/*.sql.gz
│   └── Policy: Daily backups, 7-day rotation
│   └── Restore: RECOVERY.md → restore-postgres procedure
│
├── qdrant/           → /srv/data/qdrant
│   └── Purpose: Qdrant vector database
│   └── Size: ~1 GB (depends on embeddings)
│   └── Backing: /srv/backups/qdrant/*.tar.gz (snapshots of storage/)
│   └── Policy: Daily backups, 7-day rotation
│   └── Restore: RECOVERY.md → restore-qdrant procedure
│
├── n8n/              → /srv/data/n8n
│   └── Purpose: n8n workflow configs, secrets, execution logs
│   └── Size: ~200 MB (depends on workflow volume)
│   └── Backing: /srv/backups/n8n/*.tar.gz
│   └── Policy: Daily backups, 7-day rotation
│   └── Restore: RECOVERY.md → restore-n8n procedure
│
├── monorepo/         → /srv/monorepo
│   └── Purpose: Application code (pnpm workspace)
│   └── Size: ~500 MB (code + node_modules)
│   └── Backing: Git + ZFS snapshots
│   └── Policy: Commit before major changes, snapshot before structural changes
│   └── Restore: Git reset + ZFS rollback
│
├── backups/          → /srv/backups
│   └── Purpose: Backup archives
│   ├── postgres/    (PostgreSQL dumps, *.sql.gz)
│   ├── qdrant/      (Qdrant storage snapshots, *.tar.gz)
│   └── n8n/         (n8n data snapshots, *.tar.gz)
│   └── Size: ~5 GB (7-day rotation keeps old backups)
│   └── Policy: Read-only append; cleanup by rotation script
│   └── NEVER delete manually: Use /srv/ops/scripts/backup-*.sh
│
├── models/           → /srv/models
│   └── Purpose: AI models, embeddings (for future use)
│   └── Size: ~0 GB (reserved for growth)
│   └── Policy: Can store large model files here
│   └── Backup: By backup scripts if needed
│
├── caprover/         → /srv/data/caprover
│   └── Purpose: CapRover platform data
│   └── Size: ~25 KB (mínimo)
│   └── Policy: Gerenciado pelo stack CapRover
│   └── Restore: Pode ser resetado sem perda de dados
│
├── supabase/         → /tank/supabase
│   └── Purpose: Dados gerais do Supabase (configurações, etc.)
│   └── Size: ~24 KB (recente)
│   └── Policy: Gerenciado pelo stack Supabase
│   └── Restore: Via stack Supabase
│
└── supabase-db/      → /tank/supabase-db
    └── Purpose: Banco de dados PostgreSQL do Supabase
    └── Size: ~24 KB (recente, crescerá com uso)
    └── Policy: Backup junto com dados do Supabase
    └── Restore: Via stack Supabase ou pg_dump
```

**Total Capacity Used:** ~5,63 GB (de 3,64 TB disponíveis — < 1%)
**Compression Ratio:** ~1.2x (lz4 is light, targets 20-30% for JSON data)

---

## 3. Mountpoint Allocation

| Mountpoint           | Device/Dataset    | Size    | Purpose             | Can Delete? | Backup?              |
| -------------------- | ----------------- | ------- | ------------------- | ----------- | -------------------- |
| `/boot/efi`          | nvme1n1p1         | 1 GB    | EFI boot            | NO          | NO                   |
| `/`                  | nvme1n1p2         | 274 GB  | OS root             | NO          | NO                   |
| `/home`              | nvme1n1p3         | 651 GB  | User home           | NO          | NO                   |
| `/srv`               | (symlink to /srv) | -       | Persistence root    | NO          | YES (ZFS)            |
| `/srv/docker-data`   | tank/docker-data  | ~2 GB   | Docker              | NO          | YES (snapshots)      |
| `/srv/data/postgres` | tank/postgres     | ~500 MB | n8n DB              | NO          | YES (backups)        |
| `/srv/data/qdrant`   | tank/qdrant       | ~1 GB   | Vector DB           | NO          | YES (backups)        |
| `/srv/data/n8n`      | tank/n8n          | ~200 MB | Workflows           | NO          | YES (backups)        |
| `/srv/monorepo`      | tank/monorepo     | ~500 MB | App code            | NO          | YES (Git + ZFS)      |
| `/srv/backups`       | tank/backups      | ~5 GB   | Archives            | NO          | YES (external)       |
| `/srv/models`        | tank/models       | ~0 GB   | Reserved            | NO          | YES (future)         |
| `/tank/supabase`     | tank/supabase     | ~24 KB  | Supabase configs    | NO          | YES (Supabase stack) |
| `/tank/supabase-db`  | tank/supabase-db  | ~24 KB  | Supabase PostgreSQL | NO          | YES (pg_dump)        |

---

## 4. Data Classification

### TIER 1 (Critical - Must have backups)

- `/srv/data/postgres` (n8n workflows are business logic)
- `/srv/data/qdrant` (trained embeddings are expensive to recreate)
- `/srv/data/n8n` (workflow configs are irreplaceable)
- `/srv/backups` (the backups themselves)

**Backup Policy:** Daily, 7-day rotation, tested restore

### TIER 2 (Important - Should have snapshots)

- `/srv/monorepo` (application code)
- `/srv/docker-data` (Docker configuration, cached images)

**Backup Policy:** Pre-change snapshots, Git commits

### TIER 3 (Convenience - Optional snapshots)

- `/home` (user files, caches)

**Backup Policy:** User discretion

### TIER 4 (Ephemeral - No backup needed)

- `/tmp`, `/var/tmp`
- `/var/log` (logs rotate automatically)

**Backup Policy:** None

---

## 5. Never Mix These

### ❌ System + Application Data

**Bad:** Storing n8n config in `/home/user/n8n.db`
**Good:** Storing n8n config in `/srv/data/n8n`

**Why:** System disk can be rebuilt; application data cannot.

### ❌ Docker Volumes + System

**Bad:** Docker data-root at default `/var/lib/docker` (on `/`)
**Good:** Docker data-root at `/srv/docker-data` (on ZFS)

**Why:** Enables snapshots, backups, and relocation.

### ❌ Live Data + Backups in Same Mount

**Bad:** Backups in `/srv/data/backups/` (same mount as source)
**Good:** Backups in `/srv/backups/` (separate dataset)

**Why:** If mount corrupts, don't lose both source and backup.

### ❌ Credentials + Code

**Bad:** Secrets in `/srv/monorepo/config.js`
**Good:** Secrets in `/root/.env` (external)

**Why:** Prevents accidental exposure in Git.

---

## 6. Disk Failure Scenarios

### Scenario A: nvme1n1 (System Disk) Fails

**Impact:** OS unusable, but all data in /srv survives
**Recovery:**

1. Replace disk
2. Install fresh Ubuntu 24.04 LTS
3. Mount nvme0n1 at `/srv` from external or recovery mode
4. Reboot → system recognizes /srv, services start

**RTO:** ~30 min (fresh OS install)
**RPO:** 0 (all data in ZFS)

### Scenario B: nvme0n1 (Data Disk) Fails

**Impact:** All persistent data lost, services cannot start
**Recovery:**

1. Replace disk
2. From backup (external): `zpool import -d /path/to/backup tank`
3. Or restore from /srv/backups archives

**RTO:** ~2 hours (restore from backup)
**RPO:** 24 hours (last daily backup)

### Scenario C: ZFS Pool Corruption

**Impact:** Data unreadable
**Recovery:**

1. If pool still importable: `sudo zpool import tank`
2. If not: restore from backup external drive
3. Or rollback to last clean snapshot: `sudo zfs rollback tank@snapshot-name`

**RTO:** Minutes (if snapshot available)
**RPO:** Hours (age of last snapshot)

---

## 7. Allocation Policy

### Can Live in /srv/data

- PostgreSQL databases
- Vector stores (Qdrant, Weaviate, etc.)
- Workflow configs (n8n, Make, Zapier-like)
- Persistent caches that are expensive to rebuild

### CANNOT Live in /srv/data

- Source code (must be in /srv/monorepo + Git)
- Temporary files (use /tmp)
- OS system files (use /)
- User home files (use /home)

### Can Live in /srv/docker-data

- Docker images (pulled)
- Container layers (built)
- Docker configs
- Volumes marked persistent

### CANNOT Live in /srv/docker-data

- User home (never)
- Application config (use /srv/monorepo or /srv/data)
- Secrets (manage externally)

---

## 8. Symlink & Mount Verification

Commands to verify current state:

```bash
# Verify ZFS pool is active
zpool list tank

# List all datasets and mountpoints
zfs list -r tank

# Verify mountpoints exist
ls -la /srv/docker-data /srv/data /srv/backups /srv/monorepo

# Verify permissions
stat /srv/data/postgres
stat /srv/backups

# Verify disk mapping
lsblk -o NAME,SIZE,MOUNTPOINT | grep -E "nvme|/srv"
df -h /srv/*
```

---

## 9. Capacity Planning

### Current Usage

- System disk: ~30% used (system is ~50 GB, leaving 240 GB)
- Data disk: ~0.2% used (3.64 TB, only ~5 GB in use)

### Growth Headroom

- PostgreSQL: Can grow to 1 TB before concern
- Qdrant: Can grow to 500 GB (embeddings scale linearly)
- Docker: Can grow to 100 GB (many images)
- Backups: Auto-rotate, capped at 7 days

### Action Items

- When `/srv/data` reaches 50%, review and archive old data
- When `/srv/docker-data` reaches 50 GB, prune old images
- Monitor postgres size: `SELECT pg_database_size('n8n');`

---

**Last Updated:** 2026-03-16
**Next Review:** When storage exceeds 10% of tank capacity
