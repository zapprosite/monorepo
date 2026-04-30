# ZFS Secondary Disk — Agent Access Pattern

**Date:** 2026-04-29
**Context:** 20-agent Nexus research on ZFS secondary disk without disabling LLM agentic access (vibe-kit workers + Hermes)
**Source:** ARCHITECTURE.md, ZFS-POLICY.md, NETWORK_MAP.md, vibe-kit.sh analysis

---

## Hardware Topology

```
PC PRINCIPAL (headless, Gen5, 4TB NVMe)
├── ZFS tank (4TB RAID-Z, pool: tank)
├── /srv/monorepo (tank/monorepo)
├── /srv/data (tank/data)
├── Hermes Gateway (:8642, systemd, bare metal)
├── Hermes MCP (:8092, MCPO bridge)
├── Ollama (:11434, RTX 4090)
└── vibe-kit workers (mclaude -p, local processes)

PC SECUNDARIO (Gen3, 1TB NVMe, RTX 3060 12GB)
└── Dashboard + SSH client → PC Principal
    └── Human operator terminal only
    └── NO vibe-kit workers run here
```

---

## Key Finding: Workers Are Local, Not Remote

**vibe-kit workers access /srv/monorepo as local filesystem, NOT over SSH.**

```
vibe-kit.sh (runs as 'will' user on PC Principal)
  └── spawn_worker()
        └── mclaude -p "..." (local child process, inherits user perms)
              └── reads /srv/monorepo/* directly (no SSH, no network mount)
```

PC Secundário é apenas terminal de acesso humano para PC Principal. Workers nunca executam via SSH remote.

---

## ZFS Dataset Map (Critical for Access)

| Dataset | Mount | Who Needs It | Access Pattern |
|---------|-------|--------------|----------------|
| `tank/monorepo` | `/srv/monorepo` | vibe-kit workers, mclaude | Local filesystem |
| `tank/models` | `/srv/models` | Ollama | Local filesystem |
| `tank/data/qdrant` | `/srv/data/qdrant` | Qdrant container | Docker volume |
| `tank/home/.hermes` | `/home/will/.hermes` | Hermes Gateway | Local filesystem |
| `tank/backups` | `/srv/backups` | Backup scripts | Local filesystem |

---

## Adding Secondary Disk — Constraints

### What MUST NOT Change
1. **Pool name `tank`** — hardcoded in vibe-kit.sh (`SNAPSHOT_POOL=${ZFS_POOL:-tank}`)
2. **Mountpoint `/srv/monorepo`** — hardcoded in nexus.sh, vibe-kit.sh, ALL worker prompts
3. **`/etc/zfs/zpool.cache`** — must exist for import on boot; if secondary disk changes boot order, pool may not import
4. **Dataset permissions** — workers run as `will` user; must have read/write on `tank/monorepo`

### What IS Safe to Add
- Secondary disk as **second pool** (e.g., `tank2` or `backup`)
- Second pool can hold: `/srv/backups`, archives, datasets not accessed by workers
- Can use `zfs send/receive` for snapshot-based replication from `tank` → `tank2`
- Can create separate dataset on `tank` for overflow (e.g., `tank/overflow`)

### What MUST BE PRESERVED
```
tank
├── tank/monorepo        → /srv/monorepo     (workers NEED this)
├── tank/models          → /srv/models       (Ollama NEEDS this)
├── tank/data/qdrant     → /srv/data/qdrant  (Qdrant NEEDS this)
├── tank/home/.hermes    → /home/will/.hermes (Hermes NEEDS this)
└── tank/backups         → /srv/backups      (backup only, workers don't touch)
```

---

## Pattern: Secondary Disk as Separate Pool

```
PRIMARY DISK (tank)              SECONDARY DISK (tank2 or external)
────────────────                ──────────────────────────────
tank/monorepo      ← workers     tank2/archive   ← old projects
tank/models        ← Ollama      tank2/backups   ← ZFS send/receive
tank/data/qdrant   ← Qdrant      tank2/overflow   ← overflow storage
tank/home/.hermes  ← Hermes
```

### Recommended Setup

```bash
# Create second pool on secondary disk
sudo zpool create tank2 /dev/disk/by-id/secondary-nvme-part1

# Use for backups only (no worker access needed)
sudo zfs create -o mountpoint=/srv/backups tank2/backups

# For overflow: create dataset ON tank, mount elsewhere
sudo zfs create -o mountpoint=/srv/overflow tank/overflow

# Snapshot replication (daily cron)
sudo zfs send -i tank@daily tank@daily | sudo zfs receive tank2/backups/daily
```

### What NOT To Do

```bash
# DON'T: Import secondary disk as 'tank' (name conflict)
sudo zpool import -d /dev/disk/by-id/secondary-nvme tank

# DON'T: Move /srv/monorepo to secondary disk
# (workers need local access, network mounts too slow for 15 parallel workers)

# DON'T: Change pool name from 'tank'
# vibe-kit.sh uses SNAPSHOT_POOL=${ZFS_POOL:-tank} (hardcoded fallback)
```

---

## Hermes Access (Independent of ZFS)

Hermes Gateway runs as systemd service on bare metal — it does NOT go through ZFS.

```
Hermes Gateway (:8642, systemd, running as will user)
  └── reads /home/will/.hermes/* (tank/home/.hermes)
  └── accesses Qdrant (:6333) via localhost
  └── Telegram polling — independent of ZFS datasets
```

ZFS snapshots of `tank/home/.hermes` are taken before config changes (see ZFS-POLICY.md).

---

## Ollama Access (Independent of ZFS)

Ollama serves models from `/usr/share/ollama/.ollama/models` (host path, not ZFS).

```
Ollama (:11434, bare metal systemd)
  └── Model blobs: /usr/share/ollama/.ollama/models/blobs/
  └── /srv/models → symlinked for convenience
  └── VRAM management: qwen2.5vl:3b loaded on demand
```

Secondary disk does NOT affect Ollama unless you put `/srv/models` there — which would require same mountpoint discipline.

---

## Snapshot Strategy (Workers + Hermes Protected)

Before any ZFS operation on `tank`:

```bash
# snapshot_zfs() from vibe-kit.sh
snapshot_zfs() {
    local label=$1
    if command -v zfs &>/dev/null; then
        local snap="tank@vibe-pre-$(date +%Y%m%d-%H%M%S)-${label}"
        sudo zfs snapshot "$snap" 2>/dev/null || true
    fi
}
```

Protected datasets:
- `tank@pre-<date>-hermes-config` (before Hermes config changes)
- `tank@pre-<date>-ollama-models` (before model changes)
- `tank@pre-<date>-monorepo-deploy` (before deploys)

---

## Risk Matrix

| Scenario | Risk to Agents | Mitigation |
|----------|---------------|------------|
| Secondary disk added as `tank` (name conflict) | **CRITICAL** — workers can't find monorepo | Use `tank2` or different name |
| /srv/monorepo moved to secondary disk | **CRITICAL** — slower access, potential timeout | Keep on `tank` |
| Secondary disk changes boot order | Pool import failure | Set bootfs on primary pool |
| Wrong permissions on new dataset | Workers fail to read | Ensure `will` user owns it |
| Secondary disk fills up | **HIGH** — overflow could affect ZFS | Monitor with `zfs list -o space` |

---

## Conclusion

**You can add a secondary disk without disabling agentic access** if you:

1. **Name it `tank2` (not `tank`)** — avoid pool name conflict
2. **Keep `/srv/monorepo` on `tank`** — workers need local filesystem speed (15 parallel processes)
3. **Use `tank2` for backups + archives** — not for active worker datasets
4. **Never change the pool name `tank`** — vibe-kit.sh hardcodes it
5. **Snapshot before any ZFS operation** — use `snapshot_zfs()` from vibe-kit.sh

The pattern is: **primary pool (tank) for hot data, secondary pool (tank2) for cold data**. Workers, Hermes, and Ollama all access via local paths on `tank`. The secondary disk is invisible to the agentic layer.

---

**Related Docs:**
- `/srv/ops/ai-governance/ZFS-POLICY.md` — snapshot + rollback rules
- `/srv/ops/scripts/zfs-snapshot.sh` — helper script
- `/srv/monorepo/docs/AUDITS/OLLAMA-MODELS-AUDIT-2026-04.md` — Ollama inventory