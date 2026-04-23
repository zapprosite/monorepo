---
type: spec-index
name: Active Specifications
description: Canonical index of active SPECs in the monorepo
status: filled
generated: 2026-04-20
supersedes: SPEC-INDEX.md (legacy)
---

# Active Specifications

**Updated:** 2026-04-23

## Draft SPECs

| # | Title | Status | Notes |
|---|-------|--------|-------|
| 091 | Canonical Docs Template + Holistic Prune | DONE | This spec — defining template + cleanup |
| 092 | Trieve RAG Integration | draft | Qdrant-native RAG pipeline — pending William approval |

## Active SPECs

| # | Title | Status | Supersedes | Notes |
|---|-------|--------|------------|-------|
| 068 | Circuit Breaker (MEM0 wins) | codified | SPEC-073 | Implemented in `packages/circuit-breaker/` |
| 074 | Hermes Second Brain | active | — | Second-brain sync via `scripts/sync-second-brain.sh` |
| 090 | Orchestrator v3 | active | SPEC-070 | 14-agent enterprise orchestrator |
| 092 | Trieve RAG Integration | draft | — | Pending William approval |
| 115 | Painel Organism (MCP) | implemented | — | 6 MCP servers (4011-4016) operational |

## Archived SPECs

Archived SPECs are in `docs/archive/SPECS-dead/`. See `docs/archive/SPECS-dead/README.md` for inventory.

## Canonical Docs Structure

```
docs/
├── SPECS/          # Feature specs — SPEC-NNN-title.md
├── ADRs/           # Architecture Decision Records
├── GUIDES/         # How-to guides
├── REFERENCE/      # Technical references
├── OPS/RUNBOOKS/   # Operational runbooks (ORCHESTRATOR-FAILURE.md only)
└── archive/        # Archived docs — READ-ONLY
```

## Adding New SPECs

1. Create `docs/SPECS/SPEC-NNN-title.md` with frontmatter `status: draft`
2. Use template from SPEC-091 section "Canonical Docs Template"
3. After implementation: update frontmatter to `status: active`
4. After superseded: move to `docs/archive/SPECS-dead/` with `status: archived`
5. Update this file to reflect the new state

## Rules

- **Never** create docs in `docs/` root — always in a subdirectory
- **Never** mix SPECs with GUIDEs
- `docs/archive/` is READ-ONLY after move
- All SPECs must have frontmatter with `status: filled|empty|draft|archived`
