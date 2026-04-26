# SPECs Index

**Last Updated:** 2026-04-25

---

## Active SPECs

| SPEC | Title | Status | Owner | Priority |
|------|-------|--------|-------|----------|
| [SPEC-001](SPEC-001-homelab-control-plane.md) | Homelab Control Plane | Active | Platform | P1 |
| [SPEC-003](SPEC-003-memory-rag-llm-stack.md) | Memory RAG LLM Stack | Active | AI Team | P1 |
| [SPEC-004](SPEC-004-autonomous-execution-pipeline.md) | Autonomous Execution Pipeline | Active | Platform | P2 |
| [SPEC-068](SPEC-068-langgraph-circuit-breaker.md) | LangGraph Circuit Breaker | Active | AI Team | P2 |
| [SPEC-090](SPEC-090-orchestrator-v3-redesign.md) | Orchestrator v3 Redesign | Active | Platform | P1 |
| [SPEC-091](SPEC-091-docs-prune-holistic-cleanup.md) | Docs Prune Holistic Cleanup | Active | Docs | P3 |
| [SPEC-092](SPEC-092-trieve-rag-integration.md) | Trieve RAG Integration | Active | AI Team | P2 |
| [SPEC-093](SPEC-093-homelab-intelligence-architecture.md) | Homelab Intelligence Architecture | Active | Architecture | P1 |
| [SPEC-106](SPEC-106-hermes-multi-agent-architecture-standard.md) | Hermes Multi-Agent Architecture | Active | AI Team | P1 |
| [SPEC-115](SPEC-115-painel-organism.md) | Painel Organism | Active | Frontend | P2 |
| [SPEC-120](SPEC-120-litellm-embeddings-hang.md) | LiteLLM Embeddings Hang | Active | AI Team | P1 |
| [SPEC-130](SPEC-130-MULTI-PROVIDER-API.md) | Multi-Provider API | Active | API Team | P1 |
| [SPEC-135](SPEC-135-VITEST-FIXES.md) | Vitest Fixes | Active | QA | P3 |
| [SPEC-200](SPEC-200-hermes-ecosystem-architecture.md) | Hermes Ecosystem Architecture | Active | AI Team | P1 |
| [SPEC-202](SPEC-202-hermes-second-brain-systemd.md) | Hermes Second Brain systemd | Active | DevOps | P2 |
| [SPEC-203](SPEC-203-litellm-diagnostic.md) | LiteLLM Diagnostic | Active | DevOps | P2 |

---

## Completed SPECs

| SPEC | Title | Completed |
|------|-------|-----------|
| [SPEC-121](SPEC-121-homelab-polish.md) | Homelab Polish | 2026-04-25 |
| [SPEC-122](SPEC-122-homelab-polish-v2.md) | Homelab Polish v2 | 2026-04-25 |

---

## Nexus Framework SPECs

| SPEC | Title | Status |
|------|-------|--------|
| [SPEC-CONTEXT-AUTO](SPEC-CONTEXT-AUTO.md) | Context Auto | Active |
| [SPEC-FINAL](SPEC-FINAL.md) | Final | Active |
| [SPEC-NEXUS-CONTEXT-MASTER](SPEC-NEXUS-CONTEXT-MASTER.md) | Nexus Context Master | Active |
| [SPEC-NEXUS-TIERS](SPEC-NEXUS-TIERS.md) | Nexus Tiers | Active |

---

## Quick Reference

```bash
# List all SPECs
ls docs/SPECS/SPEC-*.md

# Find SPEC by keyword
grep -l "keyword" docs/SPECS/SPEC-*.md
```

---

## Creating New SPEC

Use template:
```markdown
---
name: SPEC-NNN
description: <short description>
status: draft
owner: <team>
created: YYYY-MM-DD
---

# SPEC-NNN — <TITLE>

## Problem
<The problem being solved>

## Solution
<The proposed solution>

## Acceptance Criteria
1. When <condition>, then <result>
```

---

## Stats

- **Active:** 21
- **Completed:** 2
- **Total:** 23
