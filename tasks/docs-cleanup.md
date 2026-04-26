# T07: Docs Cleanup — Completed

**Date:** 2026-04-10
**Status:** Done

## Actions Taken

### 1. Moved SPEC files to docs/SPECS/
- Moved 37 SPEC-*.md files from `docs/specflow/` to `docs/SPECS/`
- Files include: SPEC-001 through SPEC-022, SPEC-100, and meta files (SPEC-INDEX.md, SPEC-README.md, SPEC-TEMPLATE.md, etc.)

### 2. Moved PLAN to docs/GUIDES/
- `docs/plans/PLAN-voice-pipeline-desktop-20260410.md` → `docs/GUIDES/voice-pipeline-desktop.md`
- Renamed to follow kebab-case naming convention

### 3. Removed empty directories
- `docs/context/` — Removed (had only README.md, now deleted)
- `docs/plans/` — Removed (empty after PLAN file moved)

### 4. Preserved valid directories
- `docs/archive/` — Kept as-is (contains dated migration archives)
- `docs/ADRs/` — Kept (contains ADR template)
- `docs/specflow/` — Kept (contains reviews/ and non-SPEC files like ARCHITECTURE-MASTER.md, tasks.md)

## Final Structure

```
docs/
├── ADRs/              # Architecture Decision Records (template only)
├── GUIDES/            # How-to guides (10 files)
├── INCIDENTS/         # Incident reports
├── INFRASTRUCTURE/    # Infrastructure docs
├── MCPs/              # MCP documentation
├── OPERATIONS/        # Operations & skills
├── REFERENCE/         # Technical references
├── SPECS/             # Feature specifications (39 files)
├── TEMPLATES/         # Document templates
├── archive/           # Archived docs (preserved)
├── specflow/          # Specflow docs (reviews/, ARCHITECTURE-MASTER.md, tasks.md)
└── README.md
```

## Verification

```bash
find docs -type d | sort
```

All directories are non-empty and properly structured per docs/CLAUDE.md governance rules.

## Note

The `docs/specflow/` directory still contains:
- `reviews/` — Code reviews (REVIEW-*.md)
- `ARCHITECTURE-MASTER.md` — Architecture documentation
- `tasks.md` — Task tracking

These are valid specflow artifacts and should remain.
