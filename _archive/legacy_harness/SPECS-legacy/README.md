# SPECS Legacy — Migration Record

This directory tracks the migration of specs out of the active index and into historical/implementation-note status, per the governance rules established in `docs/SPECS/ACTIVE.md`.

## Why This Exists

Before 2026-04-27, `INDEX.md` listed 22 specs as "Active". The reality was different — only SPEC-001 through SPEC-004 were canonical and actively driving implementation. The rest were:

- **Historical** — replaced by canonical specs
- **Implementation notes** — incident results not driving new work
- **Framework specs** — nexus/vibe-kit specs with their own conventions

## Migration (2026-04-27)

| Original # | Title | New Status | Canonical Successor | Reason |
|-----------|-------|------------|-------------------|--------|
| SPEC-068 | LangGraph Circuit Breaker | historical | SPEC-002 | Circuit breaker behavior absorbed into Hermes Agent Runtime |
| SPEC-074 | LangGraph Persistence | historical | SPEC-003 | Persistence rationale absorbed into Memory RAG stack |
| SPEC-090 | Orchestrator v3 Redesign | historical | SPEC-004 | 3-phase pipeline idea absorbed into Autonomous Pipeline |
| SPEC-091 | Docs Prune Holistic Cleanup | historical | SPEC-004 | Docs pruning context in pipeline spec |
| SPEC-092 | Trieve RAG Integration | historical | SPEC-003 | Trieve notes absorbed into Memory RAG stack |
| SPEC-093 | Homelab Intelligence Architecture | historical | SPEC-001 | Architecture notes absorbed into Homelab Control Plane |
| SPEC-106 | Hermes Multi-Agent Architecture | historical | SPEC-002 | Multi-agent notes absorbed into Hermes runtime |
| SPEC-115 | Painel Organism | historical | — | Frontend patterns, not platform-level |
| SPEC-120 | LiteLLM Embeddings Hang | impl. note | SPEC-003 | Incident result — LiteLLM embeddings |
| SPEC-121 | Homelab Polish | impl. note | SPEC-001 | Incident result — homelab polish |
| SPEC-122 | Homelab Polish v2 | impl. note | SPEC-001 | Incident result — homelab polish v2 |
| SPEC-002-homelab-monitor-agent.md | HomeLab Monitor Agent | misnamed | SPEC-002 | Misplaced — content is monitor agent, not Hermes Agent Runtime. Canonical SPEC-002 is SPEC-002-hermes-agent-runtime.md |
| SPEC-002-homelab-network-refactor.md | Cloudflare + Coolify Refactor | misnamed | SPEC-001 | Misplaced — content is network refactor, not Hermes Agent Runtime. Canonical SPEC-002 is SPEC-002-hermes-agent-runtime.md |
| SPEC-130 | Multi-Provider API | impl. note | SPEC-003 | Provider API rules in Memory RAG stack |
| SPEC-135 | Vitest Fixes | impl. note | SPEC-004 | Vitest isolation backlog in pipeline spec |

## Archive vs Legacy

- **`archive/`** — deprecated spec files physically moved here (not actively referenced)
- **`_legacy/`** — this directory, contains the migration record

## Naming Convention After Migration

New specs follow a domain namespace:

```
docs/SPECS/
  products/
    <domain>/
      SPEC-<DOMAIN>-NNN.md   # e.g. SPEC-HVAC-001.md
```

Canonical platform specs remain at `docs/SPECS/SPEC-001-title.md` through `SPEC-004-title.md`.

Framework specs (Nexus, vibe-kit) use `docs/SPEC-NNN.md` (root, no description suffix).
