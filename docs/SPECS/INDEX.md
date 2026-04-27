# SPECs Index

**Last Updated:** 2026-04-27
**Source of Truth:** [ACTIVE.md](ACTIVE.md) — canonical specs are SPEC-001 through SPEC-004 only.

---

## Active Canonical SPECs

| SPEC | Title | Status | Owner | Priority |
|------|-------|--------|-------|----------|
| [SPEC-001](SPEC-001-homelab-control-plane.md) | Homelab Control Plane | Active | Platform | P1 |
| [SPEC-002](SPEC-002-hermes-agent-runtime.md) | Hermes Agent Runtime | Active | AI Team | P1 |
| [SPEC-003](SPEC-003-memory-rag-llm-stack.md) | Memory RAG LLM Stack | Active | AI Team | P1 |
| [SPEC-004](SPEC-004-autonomous-execution-pipeline.md) | Autonomous Execution Pipeline | Active | Platform | P2 |

---

## Historical SPECs

Superseded by canonical specs. Kept for implementation context.

| Spec | Was | Replaced By | Keep For |
|------|-----|------------|----------|
| [SPEC-068](SPEC-068-langgraph-circuit-breaker.md) | LangGraph Circuit Breaker | SPEC-002 | Circuit breaker behavior |
| [SPEC-090](SPEC-090-orchestrator-v3-redesign.md) | Orchestrator v3 Redesign | SPEC-004 | 3-phase pipeline idea |
| [SPEC-091](SPEC-091-docs-prune-holistic-cleanup.md) | Docs Prune Holistic Cleanup | SPEC-004 | Docs pruning context |
| [SPEC-092](SPEC-092-trieve-rag-integration.md) | Trieve RAG Integration | SPEC-003 | Trieve integration notes |
| [SPEC-093](SPEC-093-homelab-intelligence-architecture.md) | Homelab Intelligence Architecture | SPEC-001 | Homelab architecture notes |
| [SPEC-106](SPEC-106-hermes-multi-agent-architecture-standard.md) | Hermes Multi-Agent Architecture | SPEC-002 | Hermes multi-agent notes |
| [SPEC-115](SPEC-115-painel-organism.md) | Painel Organism | — | Frontend patterns |
| `SPEC-002-homelab-monitor-agent.md` | HomeLab Monitor Agent | SPEC-002 | Misnamed — content is monitor agent, not Hermes runtime |
| `SPEC-002-homelab-network-refactor.md` | Cloudflare Tunnel + Coolify Refactor | SPEC-001 | Misnamed — content is network refactor, not Hermes runtime |

> **Note:** SPEC-074 was listed in ACTIVE.md but the file does not exist. Removed from index.
> **Note:** `SPEC-002-homelab-monitor-agent.md` and `SPEC-002-homelab-network-refactor.md` are misnamed — their content does not match SPEC-002 "Hermes Agent Runtime". The canonical SPEC-002 file is `SPEC-002-hermes-agent-runtime.md`. The misnamed files are reclassified as historical below.

---

## Implementation Notes

Incident results and working notes. Do not drive new implementation.

| Spec | Was | Replaced By | Keep For |
|------|-----|------------|----------|
| [SPEC-120](SPEC-120-litellm-embeddings-hang.md) | LiteLLM Embeddings Hang | SPEC-003 | LiteLLM embeddings incident |
| [SPEC-121](SPEC-121-homelab-polish.md) | Homelab Polish | SPEC-001 | Homelab polish incident |
| [SPEC-122](SPEC-122-homelab-polish-v2.md) | Homelab Polish v2 | SPEC-001 | Homelab polish v2 incident |
| [SPEC-130](SPEC-130-MULTI-PROVIDER-API.md) | Multi-Provider API | SPEC-003 | Provider API base rules |
| [SPEC-135](SPEC-135-VITEST-FIXES.md) | Vitest Fixes | SPEC-004 | Vitest isolation backlog |

---

## Completed SPECs

| SPEC | Title | Completed |
|------|-------|-----------|
| [SPEC-121](SPEC-121-homelab-polish.md) | Homelab Polish | 2026-04-25 |
| [SPEC-122](SPEC-122-homelab-polish-v2.md) | Homelab Polish v2 | 2026-04-25 |

---

## Domain/Product SPECs

New specs for product and domain work use the `products/<domain>/` namespace.

Format: `products/<domain>/SPEC-<DOMAIN>-NNN.md`

Current domains:

| Domain | Spec | Title | Status |
|--------|------|-------|--------|
| Memory | [SPEC-MEM-001](SPEC-MEM-001-nexus-shared-memory-contract.md) | Nexus Shared Memory Contract | draft |
| HVAC | [SPEC-HVAC-001](products/HVAC/SPEC-HVAC-001-rag-ingestion.md) | HVAC RAG Ingestion | draft |
| HVAC | [SPEC-HVAC-002](products/HVAC/SPEC-HVAC-002-openwebui-faq.md) | HVAC FAQ Open WebUI | draft |
| HVAC | [SPEC-HVAC-003](products/HVAC/SPEC-HVAC-003-evaluation-suite.md) | HVAC Evaluation Suite | draft |

---

## Framework SPECs

Nexus and vibe-kit framework specifications.

| SPEC | Title | Status |
|------|-------|--------|
| [SPEC-204](SPEC-204.md) | Nexus: Unified Agent Harness Framework | Active |

> **Note:** SPEC-CONTEXT-AUTO, SPEC-FINAL, SPEC-NEXUS-CONTEXT-MASTER, SPEC-NEXUS-TIERS are listed in older INDEX.md but the files do not exist. Removed.

---

## Legacy Directory

`docs/SPECS/archive/` contains deprecated specs not migrated to the current structure.
See [_legacy/README.md](_legacy/README.md) for the full migration record.

---

## Quick Reference

```bash
# List canonical (active) specs only
ls docs/SPECS/SPEC-00{1,2,3,4}*.md

# Find SPEC by keyword
grep -l "keyword" docs/SPECS/SPEC-*.md
```

---

## Creating New SPECs

### Canonical specs (SPEC-001..SPEC-004)
Follow existing naming: `docs/SPECS/SPEC-NNN-title.md`
Only platform-level specs belong here.

### Domain/Product specs
Use `docs/SPECS/products/<domain>/SPEC-<DOMAIN>-NNN-title.md`

Example:
```bash
docs/SPECS/products/HVAC/SPEC-HVAC-001-rag-ingestion.md
```

### Framework specs
Nexus/vibe-kit framework specs live at `docs/SPEC-204.md` (root, no `-description` suffix).

---

## Stats

- **Active Canonical:** 4 (SPEC-001..004)
- **Historical:** 7 (SPEC-074 file missing, removed)
- **Implementation Notes:** 5
- **Completed:** 2
- **Domain/Product:** 4 (Memory + HVAC, draft)
- **Framework:** 1 (SPEC-204 only; 4 listed specs missing, removed)
- **Total:** 23
