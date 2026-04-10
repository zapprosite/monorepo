# Obsidian Vault — Passive Mirror

**Status:** PASSIVE MIRROR — Do NOT edit directly

This vault is a **read-only mirror** of `/srv/monorepo/docs/`.

## Directory Structure

```
obsidian/
├── SPECS/      # Mirrors docs/specflow/ (SPEC-*.md, ARCHITECTURE-*.md)
├── ADRs/       # Mirrors docs/plans/ (architecture decision records)
├── GUIDES/     # Mirrors docs/context/
└── REFERENCE/  # Index and overview docs
```

## Purpose

Provides Obsidian-compatible view of documentation for users who prefer
the Obsidian UI. The canonical source of truth is `docs/`.

## Rule

**DO NOT edit files directly in this vault.**
**All changes belong in `docs/` — this vault syncs from there.**

## How to Sync

Run T08 or manually:
```bash
rsync -av --delete docs/specflow/ obsidian/SPECS/
rsync -av --delete docs/plans/ obsidian/ADRs/
rsync -av --delete docs/context/ obsidian/GUIDES/
rsync -av --delete docs/README.md docs/index.md obsidian/REFERENCE/
```