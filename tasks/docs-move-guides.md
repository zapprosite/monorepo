# Docs Move: GUIDES (T05 Part 1)

**Date:** 2026-04-10
**Task:** Move GUIDE-type files to docs/GUIDES/

## Completed Moves

### From docs/specflow/ → docs/GUIDES/

| File | Status |
|------|--------|
| `CANVAS-CURSOR-LOOP.md` | Moved (untracked) |
| `CODE-REVIEW-GUIDE.md` | Moved (git rename) |
| `voice-pipeline-loop.md` | Moved (git rename) |
| `discovery.md` | Moved (git rename) |
| `PLAN-docs-reorganization-20260408.md` | Moved (git rename) |

### docs/GUIDES/ Contents (5 files)

```
GUIDES/
├── CANVAS-CURSOR-LOOP.md
├── CODE-REVIEW-GUIDE.md
├── discovery.md
├── PLAN-docs-reorganization-20260408.md
└── voice-pipeline-loop.md
```

## Remaining in docs/ root

- `CLAUDE.md` - Project config, keep
- `index.md` - Index file, keep
- `README.md` - Documentation index, keep

## Git Status

```
R  docs/specflow/CODE-REVIEW-GUIDE.md -> docs/GUIDES/CODE-REVIEW-GUIDE.md
R  docs/specflow/PLAN-docs-reorganization-20260408.md -> docs/GUIDES/PLAN-docs-reorganization-20260408.md
R  docs/specflow/discovery.md -> docs/GUIDES/discovery.md
R  docs/specflow/voice-pipeline-loop.md -> docs/GUIDES/voice-pipeline-loop.md
```

## Notes

- `CANVAS-CURSOR-LOOP.md` was untracked (not under git version control), moved directly via `mv`
- A `README.md` already existed in docs/GUIDES/ (not touched)
- Remaining docs/ root files are infrastructure (CLAUDE.md, index.md, README.md) - not GUIDES