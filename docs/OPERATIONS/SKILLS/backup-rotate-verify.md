# Skill: backup-rotate-verify

**Purpose:** Verify that all backups (ZFS snapshots, Coolify backups, database dumps) are present and uncorrupt, rotate old backups when storage is low, test restore procedure, and alert if backup is missing or corrupt.

**Host:** will-zappro
**Risk:** Medium (backup deletion and rotation — destructive but recoverable via ZFS snapshot)
**Approval:** Read-only verification is SAFE; rotation/deletion requires approval if pool > 85%

---

## Backup Inventory

| Type | Location | Retention |
|------|----------|-----------|
| ZFS snapshots | `tank@backup-*`, `tank@pre-*` | 7 daily, 4 weekly, 12 monthly |
| Coolify backups | `/srv/data/coolify/backups/*.tar.gz` | Last 5 |
| Gitea data | `/srv/data/gitea/` (git repos, SQLite DB) | Daily via Gitea internal |
| PostgreSQL dumps | `/srv/backups/*.sql.gz` | Last 7 daily |
| Configuration | `/srv/ops/` tar.gz | Weekly |

---

## Decision Tree

### Step 1 — Pool Capacity Check

```bash
zfs get -Hp -o value used tank
df -h /srv
```

| Threshold | Action |
|-----------|--------|
| > 75% | WARN — begin rotation planning |
| > 85% | CRITICAL — force rotation without confirmation |
| > 90% | CRITICAL — alert immediately via Telegram |

Alert channel: `@HOMELAB_LOGS_bot`

---

### Step 2 — Snapshot Inventory

```bash
zfs list -t snapshot -r tank
```

Categorize each snapshot:

- `tank@pre-*-test-*` — test snapshots
- `tank@pre-*-old-*` — legacy pre-backup snapshots
- `tank@backup-YYYYMMDD-*` — daily backups
- `tank@pre-YYYYMMDD-*` — pre-change snapshots

Retention policy:
- Keep last **7 daily** backups
- Keep last **4 weekly** backups
- Keep last **12 monthly** backups

---

### Step 3 — Backup Presence Check

For each backup type:

| Backup | Check | Threshold |
|--------|-------|-----------|
| ZFS daily | `tank@backup-YYYYMMDD-*` exists for today | Missing today → WARN |
| ZFS daily | Same for yesterday | Missing yesterday → CRITICAL |
| ZFS age | Most recent `tank@backup-*` timestamp | > 25 hours → WARN |
| Coolify | `ls -la /srv/data/coolify/backups/*.tar.gz` | Most recent > 24h → WARN |
| PostgreSQL dump | `ls -la /srv/backups/*.sql.gz` | Most recent > 25h → WARN |
| Config tar.gz | `ls -la /srv/backups/ops-config-*.tar.gz` | Weekly present? |

---

### Step 4 — Integrity Test (Restore Dry Run)

Test ZFS snapshots are valid and uncorrupt:

```bash
# Dry-run receive to verify snapshot is valid
zfs recv -n tank/test-restore < /dev/null
# Alternative: verify snapshot can be listed
zfs list -t snapshot -r tank | grep backup-YYYYMMDD
```

If `zfs recv` fails on any snapshot → snapshot is corrupt → CRITICAL

Test database dumps:

```bash
# Verify gzip is valid and contains SQL schema
zgrep -c "CREATE TABLE" /srv/backups/*.sql.gz
```

If gzip fails or no tables found → dump is corrupt → CRITICAL

---

### Step 5 — Rotation Execution

**Pre-deletion checklist:**
- [ ] Verify a newer snapshot exists before deleting any
- [ ] If pool is > 85%, deletion is authorized without further confirmation
- [ ] Log every deletion with timestamp, snapshot name, and reason

**Rotation priority (delete oldest first):**

1. `tank@pre-*-test-*` snapshots (test snapshots — most expendable)
2. `tank@pre-*-old-*` snapshots
3. Daily snapshots older than 7 days
4. Weekly snapshots older than 4 weeks
5. Monthly snapshots older than 12 months

```bash
# Example: delete test snapshots
sudo zfs destroy tank@pre-20260301-test-001

# Example: delete old pre-backup snapshots
sudo zfs destroy tank@pre-20260215-old-archive

# After deletion, verify pool space freed
zfs get -Hp -o value used tank
```

---

## Alert Levels

| Level | Trigger | Action |
|-------|---------|--------|
| **INFO** | All backups verified OK, rotation completed | Log to backup-rotate-verify.log |
| **WARN** | Backup missing (yesterday OK, day before missing), pool > 75% | Log + Telegram WARN |
| **ERROR** | Backup corrupt or pool > 80% | Log + Telegram ERROR |
| **CRITICAL** | No recent backup at all, pool > 90%, recv test failed | Log + Telegram CRITICAL + pager |

---

## Log Output

Log file: `/srv/ops/ai-governance/logs/backup-rotate-verify.log`

Format each entry as:

```
[YYYY-MM-DD HH:MM:SS] [LEVEL] <message>
  Type: <backup type>
  Detail: <snapshot name, file path, size, age>
  Action: <none | rotation started | deletion performed>
```

Example:

```
[2026-04-05 02:00:01] [INFO] Backup verification started
  Pool used: 341GB / 3.46TB (9.8%)
  Snapshots found: 23

[2026-04-05 02:00:15] [INFO] All backups verified OK
  ZFS: tank@backup-20260405-0200 present and valid
  Coolify: coolify-backup-20260404.tar.gz (18h old)
  PostgreSQL: pgdump-20260404.sql.gz present

[2026-04-05 02:01:02] [WARN] Rotation initiated — pool at 78%
  Deleted: tank@pre-20260328-test-001
  Deleted: tank@pre-20260325-old-weekly
  Remaining snapshots: 18
```

---

## Telegram Alert Format

```
[HOMELAB BACKUP] CRITICAL
Pool: tank at 91% (3.15TB / 3.46TB)
No ZFS backup found in 48 hours
Last snapshot: tank@backup-20260403-0200
Action: IMMEDIATE rotation required
```

---

## Execution Frequency

- **Automated:** Daily via cron at 02:00 local time (America/Sao_Paulo)
- **Manual:** After any service upgrade, before ZFS property changes, on demand

---

## Dependencies

- ZFS pool `tank` must be accessible
- Read access to `/srv/data/coolify/backups/`
- Read access to `/srv/backups/`
- Write access to `/srv/ops/ai-governance/logs/`
- Telegram bot `@HOMELAB_LOGS_bot` must be reachable

---

## Recovery if Rotation Deletes Wrong Snapshot

If a needed snapshot was accidentally deleted:

1. Check if another snapshot with similar content exists
2. If pool still has space, restore from offsite backup (see RECOVERY.md)
3. Alert via Telegram with snapshot name and timestamp
4. Document incident in `/srv/ops/ai-governance/logs/INCIDENTS.md`

---

**See Also:** `zfs-snapshot-and-rollback.md` (skill) | RECOVERY.md | `/srv/ops/ai-governance/CHANGE_POLICY.md`
