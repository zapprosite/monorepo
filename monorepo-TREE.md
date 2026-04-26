---
type: tree
name: monorepo-TREE
description: Machine-readable monorepo structure for hermes-second-brain
generated: 2026-04-25
status: filled
---

# Monorepo Tree

**Generated:** 2026-04-25
**Purpose:** Clean CORE structure after SPEC-091 prune

## CORE Directories

```
/
├── apps/                          # PRODUCTION SERVICES
│   ├── ai-gateway/                # OpenAI-compatible facade (Hermes)
│   ├── api/                       # Fastify + tRPC backend
│   └── monitoring/                # SRE monitoring dashboard
├── archive/
│   ├── clients/                   # Archived client projects
│   │   ├── CRM-REFRIMIX/
│   │   ├── fit-v3/
│   │   ├── list-web/
│   │   ├── obsidian-web/
│   │   ├── painel-organism/
│   │   ├── web/
│   │   └── zappro-web/
│   └── [legacy research, logs, tasks]
├── docs/
│   ├── SPECS/             # Active specs (SPEC-001 to SPEC-204)
│   ├── SPECS-dead/        # Dead/pruned specs
│   │   └── SPEC-074-hermes-second-brain-mem0.md
│   ├── ADRs/              # Architecture decision records
│   ├── adr/               # ADR drafts
│   ├── GUIDES/            # How-to guides
│   ├── OPERATIONS/        # Operations docs
│   ├── OPS/               # Ops docs
│   ├── INFRASTRUCTURE/     # Infrastructure docs
│   ├── GOVERNANCE/        # Governance docs
│   ├── topology/          # Network topology docs
│   └── *.md               # Architecture docs (ARCHITECTURE, CICD, DEPLOYMENT, FAULT_TOLERANCE, etc.)
├── mcps/
│   ├── mcp-memory/        # Memory MCP
│   └── mcp-postgres/      # Postgres MCP
├── runner/
│   ├── config.yaml
│   └── data/
├── scripts/
│   ├── backup.sh
│   ├── bootstrap-check.sh
│   ├── daily-health-check.sh
│   ├── health-check.sh
│   ├── migrate-hermes-schema.ts
│   ├── rag-ingest.ts
│   ├── redis-stats.ts
│   ├── setup-telegram-webhook.ts
│   ├── sync-second-brain.sh
│   ├── test-llm-providers.ts
│   ├── vibe.sh
│   ├── prune-docs.sh
│   ├── prune-subdomain.sh
│   └── vibe/              # Vibe scripts
├── smoke-tests/
│   ├── conftest.py
│   ├── smoke-env-vars.sh
│   ├── smoke-hermes-ready.sh
│   ├── smoke-hermes-telegram.sh
│   ├── smoke-litellm-minimax.py
│   ├── smoke-mcp-memory.py
│   ├── smoke-mem0.sh
│   ├── smoke-multimodal-stack.sh
│   ├── smoke-orchestrator-v3.sh
│   ├── smoke-postgres-mcp.sh
│   ├── smoke_qdrant_redis.py
│   ├── smoke_trieve_rag.py
│   ├── smoke-trieve-rag.sh
│   ├── smoke-trieve.sh
│   └── fixtures/
├── packages/
│   ├── config/            # Shared config
│   ├── ui/                # UI components
│   └── zod-schemas/       # Zod schemas
├── .claude/
│   ├── agents/
│   ├── brain-refactor/
│   ├── commands/
│   ├── decisions/
│   ├── hooks/
│   ├── MISSIONS.md
│   ├── pipeline.json
│   ├── rules/
│   ├── scheduled_tasks.json
│   ├── settings.local.json
│   ├── skills/
│   ├── tasks/
│   └── vibe-kit/
├── .context/
│   ├── agents/
│   ├── cache/
│   ├── docs/
│   ├── harness/
│   ├── skills/
│   └── workflow/
├── hermes/              # symlink → ~/.hermes
├── grafana/
│   └── dashboards/
├── docker/
│   └── nginx-rate-limit/
└── test-results/
    ├── smoke-Hermes-Agency-E2E-hermes-health-check/
    └── smoke-LiteLLM-Smoke-E2E-embeddings-endpoint-accepts-POST/
```

## Core Systems (3 Pillars)

| System | Location | Purpose |
|--------|----------|---------|
| Nexus | `.claude/vibe-kit/` | 49-agent framework (7×7 modes) |
| Hermes | `apps/ai-gateway/` | OpenAI-compatible facade |
| Flow-Next | `.claude/flow-next/` | Plan-first workflow engine |

> **Note:** `hermes/` at repo root is a symlink to `~/.hermes`

### 4. Flow-Next (Workflow Engine)
- Location: `.claude/flow-next/`
- Purpose: Plan-first workflow, 16 agent-native skills
- Integration: Claude Code plugin
- Key features: Re-anchoring, cross-model review, zero external deps

## Key Scripts

| Script | Purpose |
|--------|---------|
| `/flow-next:plan` | Create task queue from SPEC |
| `/flow-next:work` | Execute with workers |

## Stack Diagram

```
┌─────────────────────────────────────────┐
│           Flow-Next (Workflow)          │  ← workflow layer above Nexus
├─────────────────────────────────────────┤
│           Nexus (49 Agents)             │
├─────────────────────────────────────────┤
│  Hermes Agency  │  AI Gateway  │  Apps  │
├─────────────────────────────────────────┤
│        Infra (Docker/nginx)            │
└─────────────────────────────────────────┘
```

## Key Docs

| Doc | Purpose |
|-----|---------|
| `ARCHITECTURE.md` | System architecture |
| `CICD.md` | CI/CD pipeline |
| `DEPLOYMENT_ARCHITECTURE.md` | Deployment setup |
| `FAULT_TOLERANCE.md` | Fault tolerance patterns |
| `HOMELAB-OPS.md` | Homelab operations |
| `NEXUS_GUIDE.md` | Nexus 49-agent framework |
| `OPS_RUNBOOK.md` | Operations runbook |
| `RAG_ARCHITECTURE.md` | RAG system |
| `SECURITY_ARCHITECTUREURE.md` | Security |
| `SPEC-204.md` | Nexus SPEC |
| `SPEC-091.md` | Docs prune spec |

## Active SPECs (selected)

| SPEC | Title | Status |
|------|-------|--------|
| 001 | Homelab Control Plane | active |
| 003 | Memory RAG LLM Stack | active |
| 068 | Langgraph Circuit Breaker | active |
| 090 | Orchestrator v3 Redesign | active |
| 091 | Docs Prune Holistic Cleanup | active |
| 093 | Homelab Intelligence Architecture | active |
| 106 | Hermes Multi-Agent Architecture | active |
| 115 | Painel Organism | active |
| 204 | Nexus Framework | active |

## Smoke Tests

```bash
# Run all smoke tests
bash smoke-tests/smoke-env-vars.sh

# Individual
bash smoke-tests/smoke-hermes-ready.sh
bash smoke-tests/smoke-hermes-telegram.sh
bash smoke-tests/smoke-mem0.sh
```

## Archive

Items moved to `docs/SPECS-dead/`:
- `SPEC-074-hermes-second-brain-mem0.md`
