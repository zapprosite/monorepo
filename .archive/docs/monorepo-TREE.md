---
type: tree
name: monorepo-TREE
description: Machine-readable monorepo structure after SPEC-300 prune
generated: 2026-05-04
status: filled
---

# Monorepo Tree

**Generated:** 2026-05-04
**Purpose:** CORE structure after SPEC-300 aggressive prune

## CORE Directories

```
/
├── apps/                          # PRODUCTION SERVICES (3 only)
│   ├── ai-gateway/                # Voice Gateway :4002 (TTS + STT)
│   ├── api/                       # CRM backend (Fastify + tRPC)
│   └── web/                       # Frontend (React + MUI)
├── archive/                       # Dead projects (not versioned)
│   └── CRM-REFRIMIX/
├── config/
│   ├── litellm/                   # LiteLLM config.yaml
│   └── monitoring/                # Grafana + Prometheus configs
├── docs/
│   ├── SPECS/                     # Active specs
│   ├── SPECS-dead/                # Pruned specs
│   ├── ADRs/                      # Architecture decisions
│   ├── GUIDES/                    # How-to guides
│   ├── OPERATIONS/                # Runbooks
│   ├── INFRASTRUCTURE/            # Architecture, ports, services
│   └── GOVERNANCE/                # Rules, contracts
├── packages/
│   ├── config/                    # Shared config
│   ├── ui/                        # UI components
│   └── zod-schemas/               # Zod schemas
├── scripts/
│   ├── hvac-rag/                  # RAG pipeline
│   ├── nexus-*.sh                 # SRE automation
│   └── sre-check.sh               # Health check unificado
├── services/
│   └── orchestrator/              # Hermes JSON-RPC
├── smoke-tests/                   # E2E smoke tests
├── .claude/                       # Agent skills + commands
└── AGENTS.md                      # Source of truth
```

## 3 Pillars (Post-Prune)

| Pillar | Location | Purpose |
|--------|----------|---------|
| **LiteLLM** | `config/litellm/` | Gateway único LLM :4018/v1 |
| **Voice Gateway** | `apps/ai-gateway/` | TTS + STT :4002 |
| **Hermes Orchestrator** | `services/orchestrator/` | Agent orchestration + memory |

## Stack

| Layer | Tech |
|-------|------|
| Frontend | React 19 + MUI + tRPC |
| Backend | Fastify + OrchidORM + tRPC |
| AI Gateway | LiteLLM proxy :4018/v1 |
| Voice | Edge-tts :8012 + Groq STT |
| Vector DB | Qdrant :6333 |
| PaaS | Coolify :8000 |
| Git | Gitea :3300 |

## Key Docs

| Doc | Purpose |
|-----|---------|
| `AGENTS.md` | Source of truth for agents |
| `docs/INFRASTRUCTURE/ARCHITECTURE.md` | System architecture |
| `docs/INFRASTRUCTURE/PORTS.md` | Port allocations |
| `docs/INFRASTRUCTURE/SERVICE_MAP.md` | Service inventory |

## Active SPECs (selected)

| SPEC | Title | Status |
|------|-------|--------|
| 001 | Homelab Control Plane | active |
| 003 | Memory RAG LLM Stack | active |
| 068 | Langgraph Circuit Breaker | active |
| 090 | Orchestrator v3 Redesign | active |
| 093 | Homelab Intelligence Architecture | active |
| 106 | Hermes Multi-Agent Architecture | active |
| 204 | Nexus Framework | active |
| 300 | Monorepo Prune Total | active |

## Smoke Tests

```bash
bash smoke-tests/smoke-env-vars.sh
bash smoke-tests/smoke-hermes-ready.sh
bash smoke-tests/smoke-litellm-openrouter.py
```

## Archive

Items in `docs/SPECS-dead/`:
- `SPEC-006-playwright-e2e.md`
- `SPEC-115-painel-organism.md`
