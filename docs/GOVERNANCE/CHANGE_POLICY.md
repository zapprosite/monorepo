---
version: 1.0
author: will-zappro
date: 2026-03-16
---

# Change Policy: Safe Modification Process

**Host:** will-zappro
**Effective:** 2026-03-16

This document defines the mandatory process for any change to infrastructure or application state.

## 1. Change Classification

### MINOR CHANGES (Can proceed after approval)
- Documentation updates
- Non-breaking configuration changes
- Adding new directories/files (non-destructive)
- Backup execution
- Read-only inspections

**Process:** Check guardrails → Execute → Log

### STANDARD CHANGES (Snapshot + approval required)
- Package updates (non-major)
- Service configuration edits
- Adding new environment variables
- Network rule additions
- Firewall allow rules

**Process:** Snapshot → Preflight → Approval → Execute → Validate → Log

### STRUCTURAL CHANGES (Snapshot + approval + test required)
- ZFS pool modifications
- Docker stack changes
- Database schema changes
- Major package upgrades
- Service addition/removal

**Process:** Snapshot → Preflight → Approval → Test → Execute → Validate → Log → Review

### CRITICAL CHANGES (Snapshot + approval + human verification + rollback plan)
- Kernel updates
- Boot configuration changes
- Disk operations
- Complete service restart
- Major version upgrades

**Process:** Snapshot → Detailed plan → Approval → Dry-run → Execute → Validate → Emergency contact ready

---

## 2. Universal Change Process (All Changes)

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: CLASSIFY                                            │
│ What type of change? (see above)                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: PREFLIGHT CHECKLIST                                │
│ ✓ Have I read CONTRACT.md?                                 │
│ ✓ Have I read GUARDRAILS.md?                               │
│ ✓ Is this in APPROVAL_MATRIX.md "safe" category?           │
│ ✓ Do I understand what will change?                        │
│ ✓ Do I have a rollback plan?                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: SNAPSHOT (if standard/structural/critical)        │
│ $ sudo zfs snapshot -r tank@pre-YYYYMMDD-hhmmss-desc      │
│ Wait 5 seconds, verify snapshot created                    │
│ $ zfs list -t snapshot | grep pre-                         │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: APPROVAL (if not "minor")                          │
│ Present: What? Why? How? Rollback?                         │
│ Wait for explicit "yes, proceed"                           │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: EXECUTE                                            │
│ Run the change, observe output                             │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 6: IMMEDIATE VALIDATION                               │
│ • Services still running?                                  │
│ • No errors in logs?                                       │
│ • Expected results achieved?                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 7: LOG                                                │
│ Timestamp | Agent | Change | Outcome | Snapshot | Rollback│
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│ STEP 8: MONITOR (30 minutes)                               │
│ Services stable? Data persisting? No memory leaks?         │
└─────────────────────────────────────────────────────────────┘
                          ↓
                        DONE
```

---

## 3. Preflight Checklist (Required for all changes)

### Questions to Ask
- [ ] Am I solving the right problem?
- [ ] Is there a simpler way to do this?
- [ ] Will this change affect running services?
- [ ] Do I have a way to undo this (snapshot or rollback)?
- [ ] Have I tested this change elsewhere first?
- [ ] Is this change documented?
- [ ] Will this change require human oversight after deployment?

### Technical Checks
- [ ] Disk space available (df -h /srv)
- [ ] Services are running (docker ps)
- [ ] ZFS pool is healthy (zpool status tank)
- [ ] No ongoing backups (ps aux | grep backup)
- [ ] No recent errors (journalctl -n 50 --no-pager)

### Documentation Checks
- [ ] Change aligns with CONTRACT.md
- [ ] Change not in GUARDRAILS.md "forbidden" section
- [ ] Change in APPROVAL_MATRIX.md matches risk level
- [ ] Rollback plan documented

---

## 4. Post-Change Validation

### Immediate (Within 1 minute of change)
```bash
# All services still running?
docker compose -f /srv/apps/platform/docker-compose.yml ps

# No new errors?
docker logs qdrant | tail -20
docker logs n8n | tail -20

# Expected outcome achieved?
curl http://localhost:6333/health  # Qdrant health
curl http://localhost:5678/api/v1/health  # n8n health
```

### Short-term (Within 30 minutes of change)
```bash
# ZFS pool still healthy?
zpool status tank

# Disk space OK?
df -h /srv

# Services still consuming normal resources?
docker stats --no-stream
```

### Medium-term (Within 24 hours of change)
- Monitor logs for errors
- Check if backups run successfully
- Verify data consistency (if applicable)
- Confirm service performance is normal

---

## 5. When Things Go Wrong

### If Validation Fails

**Immediate actions:**
1. **STOP.** Do not attempt further changes.
2. **ASSESS.** What went wrong? Can you fix it quickly?
3. **LOG.** Update /srv/ops/ai-governance/INCIDENTS.md

**If you can fix it:**
```bash
# Make correction
# ... fix command ...

# Re-run validation
# ... validation command ...

# Update log with correction
```

**If you cannot fix it immediately:**
```bash
# Take snapshot of broken state (for investigation)
sudo zfs snapshot -r tank@broken-YYYYMMDD-hhmmss

# Rollback to pre-change snapshot
sudo zfs rollback -r tank@pre-YYYYMMDD-hhmmss-desc

# Verify services recovered
docker compose -f /srv/apps/platform/docker-compose.yml ps

# File incident
# See INCIDENTS.md for template
```

---

## 6. Snapshot & Rollback Examples

### Example: Update docker-compose.yml

**Step 1: Snapshot**
```bash
$ sudo zfs snapshot -r tank@pre-20260316-140000-compose-update
```

**Step 2: Approval**
"I will update docker-compose.yml to upgrade Qdrant to v1.5.0. Snapshot taken. Proceed?"

**Step 3: Execute**
```bash
$ vim /srv/apps/platform/docker-compose.yml
# Edit image: qdrant/qdrant:latest → qdrant/qdrant:v1.5.0

$ docker compose -f /srv/apps/platform/docker-compose.yml up -d --pull always
```

**Step 4: Validate**
```bash
$ docker compose -f /srv/apps/platform/docker-compose.yml ps
$ curl http://localhost:6333/health
```

**Step 5: If Failed**
```bash
$ sudo zfs rollback -r tank@pre-20260316-140000-compose-update
$ docker compose -f /srv/apps/platform/docker-compose.yml up -d
$ # Qdrant reverted to previous version, service still running
```

---

## 7. Snapshot Naming Convention

```
tank@pre-YYYYMMDD-HHMMSS-change-description
```

**Examples:**
```
tank@pre-20260316-140000-postgres-upgrade
tank@pre-20260316-141500-zfs-compression-test
tank@pre-20260316-142000-firewall-rules
tank@pre-20260316-143000-docker-stack-changes
```

**Why this format:**
- `pre-` signals "taken before change"
- Date/time sorts chronologically
- Description explains purpose
- Easy to reference in recovery

---

## 8. Change Timing Constraints

### AVOID Changing At These Times
- During backup execution (check `ps aux | grep backup`)
- During business hours if services depend on it (none currently)
- Late at night without monitoring setup
- Friday evenings without coverage

### GOOD Times to Change
- Early morning (test results by day's end)
- Mid-week (time to fix if broken)
- When alert monitoring is active
- When human can monitor for 30 minutes post-change

---

## 9. Emergency Procedures

### Service Is Down & Not Recovering

**Do NOT immediately:**
- Delete containers
- Force-delete volumes
- Wipe configuration

**Instead:**
1. Take snapshot of current (broken) state
2. Check logs for root cause
3. Attempt recovery (see RECOVERY.md)
4. If unsuccessful, rollback to pre-change snapshot
5. File incident with details

**Command:**
```bash
# Take broken-state snapshot for investigation
sudo zfs snapshot -r tank@broken-incident-YYYYMMDD-hhmmss

# Rollback to known-good
sudo zfs rollback -r tank@pre-YYYYMMDD-hhmmss-description

# Verify recovery
docker compose -f /srv/apps/platform/docker-compose.yml ps

# Investigate offline
# ... fix root cause ...
```

---

## 10. Mandatory Logging

Every change must be logged to: `/srv/ops/ai-governance/logs/CHANGE_LOG.txt`

Format:
```
YYYY-MM-DD HH:MM:SS | AGENT_NAME | CHANGE_TYPE | DESCRIPTION | SNAPSHOT | RESULT | NOTES
```

**Example:**
```
2026-03-16 14:00:00 | claude-code | package-update | pip install qdrant-client==1.4.0 | tank@pre-20260316-140000-qdrant-lib | success | No errors, services stable
2026-03-16 14:30:00 | codex | service-config | Updated cloudflare-tunnel.service | tank@pre-20260316-143000-cloudflare | failed | Will rollback, issue in systemd syntax
```

---

## 11. Approval Matrix Quick Ref

| Category | Auto-Approve | Requires Approval | Never |
|----------|--------------|-------------------|-------|
| Read-only ops | ✅ Yes | - | - |
| Backups | ✅ Yes | - | - |
| Docs update | ✅ Yes | - | - |
| Safe package install | ✅ Yes | - | - |
| Service restart | - | ✅ Yes | - |
| ZFS snapshot | - | ✅ Yes | - |
| Delete /srv | - | ✅ Yes | - |
| Destroy pool | - | - | ❌ Forbidden |
| Wipe disk | - | - | ❌ Forbidden |

(See APPROVAL_MATRIX.md for full table)

---

**Last Updated:** 2026-03-16
**Review Cycle:** Monthly or after every major incident
