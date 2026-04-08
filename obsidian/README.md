# Obsidian Vault — Passive Mirror

**Status:** PASSIVE MIRROR — Do NOT edit directly

This vault is a **passive mirror** of `/srv/monorepo/docs/`.

## Purpose

Provides Obsidian-compatible view of documentation for users who prefer
the Obsidian UI. The canonical source of truth is `docs/`.

## Sync Method

This is a **one-way passive mirror**. There is NO active sync.

- Obsidian CLI is NOT used
- All changes must be made in `docs/` first
- This mirror is manually updated or accessed read-only

## How to Sync (Manual)

```bash
rsync -av --delete /srv/monorepo/docs/ /srv/monorepo/obsidian/
```

## Rule

**DO NOT edit files directly in this vault.**
**All changes belong in `docs/`.**
