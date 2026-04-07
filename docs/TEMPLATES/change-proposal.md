# Change Proposal Template

**Change ID:** [AUTO-YYYYMMDD-NNNNN]
**Status:** Proposed / Approved / In Progress / Completed

## What
[Describe the change clearly]

## Why
[Justify the change - problem being solved]

## Impact
- **Services Affected:** Qdrant / n8n / PostgreSQL / Other
- **Downtime Expected:** [Yes/No - HH:MM duration]
- **Data Risk:** None / Low / Medium / High [explain]
- **Rollback Difficulty:** Easy / Medium / Hard [explain]

## Plan

### Preflight (Before Change)
```bash
# Snapshot
sudo zfs snapshot -r tank@pre-YYYYMMDD-hhmmss-change-name

# Verification
docker ps
df -h /srv
```

### Change Procedure
```bash
[Exact commands to execute]
```

### Postflight (After Change)
```bash
# Validation
docker ps
curl http://localhost:6333/health
```

## Rollback Plan
[Describe how to undo this change if it fails]

```bash
# Rollback commands
sudo zfs rollback -r tank@pre-YYYYMMDD-hhmmss-change-name
docker compose -f /srv/apps/platform/docker-compose.yml up -d
```

## Approval Required
- [ ] Snapshots taken
- [ ] Procedure tested (in dry-run or staging)
- [ ] Rollback verified
- [ ] Stakeholders notified

## Execution
- **Proposed by:** [Name]
- **Approved by:** [Name]
- **Executed by:** [Name]
- **Date/Time:** YYYY-MM-DD HH:MM UTC

## Post-Execution
- [ ] Change succeeded
- [ ] Validation passed
- [ ] Snapshot kept for reference
- [ ] Incident filed (if any issues)

---

**Completion Date:** YYYY-MM-DD
**Lessons Learned:** [Any insights from this change]
