# Technical References

REFERENCE/ contains stable, factual documentation: schemas, taxonomies, diagrams, and authoritative lists. Unlike SPECS/ or GUIDES/, references do not describe decisions or how-tos — they describe what exists.

## Contents

| File | Purpose |
|------|---------|
| `AI-CONTEXT.md` | AI-CONTEXT pipeline: how context is harvested, structured, and synced to memory |
| `ARCHITECTURE-MASTER.md` | Master architecture taxonomy: components, layers, data flow |
| `ARCHITECTURE-MODELS.md` | Model inventory: which models are used, where, and why |
| `CLI-SHORTCUTS.md` | Canonical CLI shortcuts for the monorepo (git, pnpm, turbo) |
| `TOOLCHAIN.md` | Toolchain reference: installed tools, versions, and aliases |
| `WORKFLOW.md` | Workflow reference: standard flows (ship, turbo, spec, etc.) |
| `TEMPLATE.md` | Doc template used to create new REFERENCE/ files |

## When to Use REFERENCE vs SPEC vs GUIDE

| Doc Type | Purpose | Example |
|----------|---------|---------|
| **SPEC** | Describe a feature before building it | `SPEC-042-voice-pipeline.md` |
| **GUIDE** | Teach how to accomplish a task | `GUIDES/docker-debug.md` |
| **REFERENCE** | Document what exists (schema, list, diagram) | `REFERENCE/TOOLCHAIN.md` |
| **ADR** | Record a decision and its rationale | `ADRs/001-turborepo-cache.md` |

Use **REFERENCE** when you need to look up facts: "what shortcuts exist?", "what models are available?", "what is the architecture hierarchy?".

Use **SPEC** when you are planning a new feature.

Use **GUIDE** when you need to teach a process.

## How to Use TEMPLATE.md

`TEMPLATE.md` is the boilerplate for new REFERENCE/ files. Copy it when creating a new reference document:

```bash
cp docs/REFERENCE/TEMPLATE.md docs/REFERENCE/<new-file>.md
```

Then fill in the sections:
- **Purpose** — one sentence describing what this reference documents
- **Structure** — how content is organized
- **Contents** — the actual reference material

Do not alter the structure of TEMPLATE.md unless you update it simultaneously to preserve consistency across REFERENCE/.

## See Also

- `docs/SPECS/` — Feature specifications
- `docs/GUIDES/` — How-to guides
- `docs/ADRs/` — Architecture decision records