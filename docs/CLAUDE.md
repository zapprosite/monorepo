# Docs Structure — Enterprise Rules

## Canonical Structure

docs/
├── SPECS/ # Feature specs ONLY
├── ADRs/ # Architecture Decision Records
├── GUIDES/ # How-to guides ONLY
├── REFERENCE/ # Technical references
└── archive/ # Archived docs (never edit)

## Rules

### NEVER

- Never create docs in root /srv/monorepo/docs/
- Never mix SPECs with GUIDEs
- Never edit files in obsidian/ (it's a mirror)

### Naming

- SPEC: `SPEC-NNN-title.md`
- ADR: `ADR-NNN-title.md`
- GUIDE: `kebab-case.md`
- REFERENCE: `kebab-case.md`

### Workflow

1. New feature → /spec → creates SPEC-NNN in docs/SPECS/
2. Architecture decision → ADR in docs/ADRs/
3. How-to → GUIDE in docs/GUIDES/
4. Reference → REFERENCE in docs/REFERENCE/

## Obsidian Mirror

docs/ is source of truth. obsidian/ is READ-ONLY mirror.
Automated sync: `bash scripts/sync-obsidian-mirror.sh` (cron: _/15 _ \* \* _)
Excludes: archive/, logs/, plans/, BAU-_, .DS_Store, Thumbs.db
