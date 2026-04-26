---
name: ship-with-sync
description: Ship workflow with AI context delta sync to Qdrant + Mem0
---

# Ship with Sync

## Purpose

Runs AI Context Sync as part of the `/ship` workflow to keep LLM context fresh.

## Flow

```
/ship
  │
  ├── 1. Pre-flight checks
  │     ├── Verify no hardcoded secrets
  │     └── nexus-investigate.sh quick
  │
  ├── 2. AI Context Delta Sync
  │     ├── ai-context-sync.sh --dry-run (show what will sync)
  │     ├── ai-context-sync.sh (actual delta sync)
  │     └── Update Mem0 freshness metadata
  │
  ├── 3. Git operations
  │     ├── git add [changed files]
  │     ├── git commit
  │     └── git push dual (Gitea + GitHub)
  │
  └── 4. Post-ship
        └── echo "Shipped at $(date)"
```

## Usage

```bash
# Standard ship with sync
/ship

# Ship without sync (skip context update)
/ship --no-sync

# Force full reindex before ship
/ship --full-sync
```

## What Gets Synced

Only files changed since last sync (delta):

| File Type | Indexed | Content |
|-----------|---------|---------|
| `.py` | ✅ | Classes, functions, docstrings |
| `.ts`/`.js` | ✅ | Functions, interfaces, exports |
| `.sh` | ✅ | Functions, main commands |
| `.md` | ✅ | Headers, structure |
| `.yaml`/`.json` | ✅ | Keys, structure |

**Excluded:**
- `node_modules/`
- `.git/`
- `archive/`
- Binary files

## State

```bash
# Check sync status
ai-context-sync.sh --status

# View last sync
cat ~/.local/state/ai-context-sync/last_sync.json
```

## Integration Points

| Event | Action |
|-------|--------|
| `/ship` | Trigger delta sync |
| `/ship --full-sync` | Force full reindex |
| Cron (hourly) | Auto-sync via nexus-cron |

## Alias Pattern (Qdrant)

```
monorepo-context (alias)
  └── monorepo-context_staging (actual collection)
```

Atomic swap ensures zero-downtime updates.
