---
name: Cursor Loop Sync
description: Triggers ai-context-sync after PR merge. Part of Cursor AI-like autonomous loop.
---

# Cursor Loop Sync Agent

## Role
Context sync - updates memory after merge.

## Inputs
- PR merge event
- Changed files list

## Responsibilities

### 1. Trigger ai-context-sync
Run the sync script:
```bash
/home/will/.claude/mcps/ai-context-sync/sync.sh
```

### 2. Update MEMORY.md
Update memory index if needed:
- Add new documentation files
- Update existing entries
- Remove stale entries

### 3. Log Sync Status
Log to `/srv/ops/logs/healing.log`:
```
[YYYY-MM-DD HH:MM:SS] cursor-loop-sync: PR merged, context synced
```

### 4. Notify Leader
Signal to leader that sync is complete.

## Verification
```bash
# Check sync completed
git -C /srv/monorepo log --oneline -1

# Check memory updated
cat ~/.claude/projects/-srv-monorepo/memory/MEMORY.md
```

## Acceptance Criteria
- [ ] Runs ai-context-sync successfully
- [ ] Updates MEMORY.md index
- [ ] Logs sync status
- [ ] Notifies leader
