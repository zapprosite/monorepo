---
type: spec-index
name: Active Specifications
description: Canonical index of active SPECs in the monorepo
status: filled
updated: 2026-04-27
---

# Active Specifications

This file is the source of truth for active SPECs. Older specs stay in the repo
as historical context, but implementation should start from `SPEC-001..004`.

## Canonical SPECs

| # | Title | Status | Purpose |
|---:|---|---|---|
| 001 | Homelab Control Plane | active | Monorepo as the central Ubuntu Desktop control plane |
| 002 | Hermes Agent Runtime | active | Hermes routing, skills, CLI/API adapters, execution boundaries |
| 003 | Memory RAG LLM Stack | active | Qdrant, Trieve, Mem0, Ollama, LiteLLM, AI Gateway contract |
| 004 | Autonomous Execution Pipeline | active | Specs, tasks, queue, workers, verification, ship/issue |

## Useful Historical Specs

These contain useful implementation notes but are not canonical entry points.

| Spec | Status | Replaced by | Keep for |
|---|---|---|---|
| SPEC-068 | historical | SPEC-002 | Circuit breaker behavior |
| SPEC-074 | historical | SPEC-003 | Mem0 rationale |
| SPEC-090 | historical | SPEC-004 | 3-phase pipeline idea |
| SPEC-091 | historical | SPEC-004 | Docs pruning context |
| SPEC-092 | historical | SPEC-003 | Trieve integration notes |
| SPEC-093 | historical | SPEC-001 | Homelab architecture notes |
| SPEC-106 | historical | SPEC-002 | Hermes multi-agent notes |
| SPEC-120 | implementation note | SPEC-003 | LiteLLM embeddings incident |
| SPEC-121 | implementation note | SPEC-001 | Homelab polish incident |
| SPEC-122 | implementation note | SPEC-001 | Homelab polish v2 incident |
| SPEC-130 | implementation note | SPEC-003 | Provider API base rules |
| SPEC-135 | implementation note | SPEC-004 | Vitest isolation backlog |

## Legacy Directory

`docs/SPECs/` is legacy casing. Do not add new specs there. If content is still
needed, migrate it into `docs/SPECS/` or reference it from the canonical specs.

## Rules

- New active specs use `docs/SPECS/SPEC-NNN-title.md`.
- Use the lowest useful number range. Do not continue old numbering by default.
- Markdown must never contain real secret values.
- Runtime truth beats aspirational docs.
- Placeholders are acceptable only when explicitly marked as placeholders.
- Finished incident/result specs remain historical and should not drive new work.
