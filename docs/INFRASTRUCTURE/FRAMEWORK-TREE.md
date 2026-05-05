# Framework & Tooling Tree — 2026-05-02

> Complete tree view of all frameworks, tools, and technologies in the homelab

---

## /srv/monorepo — MAIN PROJECT

```
monorepo/
├── .context/                    MCP dotcontext (harness, skills, plans)
│   ├── docs/                    documentation
│   │   ├── README.md
│   │   ├── architecture.md
│   │   ├── data-flow.md
│   │   ├── development-workflow.md
│   │   ├── glossary.md
│   │   ├── project-overview.md
│   │   ├── security.md
│   │   ├── testing-strategy.md
│   │   └── tooling.md
│   ├── skills/                  10 active skills
│   │   ├── api-design/
│   │   ├── bug-investigation/
│   │   ├── code-review/
│   │   ├── commit-message/
│   │   ├── debug/
│   │   ├── documentation/
│   │   ├── feature-breakdown/
│   │   ├── pr-review/
│   │   ├── refactoring/
│   │   ├── security-audit/
│   │   ├── sincronizar-tudo/
│   │   ├── test-generation/
│   │   └── ui-ux-pro-max/
│   ├── plans/                   implementation plans
│   └── harness/                 PREVC + sensors
│       ├── sessions/            session history (JSON)
│       ├── traces/              event traces (JSONL)
│       ├── artifacts/           captured outputs
│       ├── workflows/
│       │   └── prevc.json      PREVC state machine
│       └── sensors.json         10 quality sensors
│
├── .claude/
│   ├── vibe-kit/                Nexus PREVC framework
│   │   ├── nexus.sh             entry point
│   │   ├── vibe-kit.sh          15x parallel loop
│   │   └── agents/              49 agents (7 modes × 7)
│   ├── commands/                slash commands (img.md, etc)
│   ├── skills/                 monorepo skills
│   └── rules/                   CLAUDE.md, anti-hardcoded, etc
│
├── .gitea/workflows/            Gitea Actions CI
├── .github/workflows/           GitHub Actions CI
│
├── apps/
│   ├── api/                    Fastify + tRPC backend
│   ├── web/                    React frontend
│   ├── ai-gateway/             OpenAI-compatible facade
│   ├── monitoring/             SRE dashboard
│   └── (CRM, painel, etc)
│
├── packages/
│   ├── ui/                     React component library
│   └── zod-schemas/           validation schemas
│
├── docs/
│   ├── SPECS/                  SPEC-200 to SPEC-206+
│   ├── SPECs-dead/             archived specs
│   ├── ADRs/                   architecture decisions
│   ├── GUIDES/                 how-to guides
│   ├── REFERENCE/              technical references
│   ├── GOVERNANCE/             governance docs
│   └── INFRASTRUCTURE/          THIS FILE
│
└── scripts/
    ├── nexus-legacy-detector.sh
    ├── nexus-code-scanner.sh
    ├── nexus-alert.sh
    └── hvac-rag/
```

---

## /srv/monorepo/services — MEMORY LAYER

```
hce/
├── libs/memory/
│   ├── manager.py              Mem0 Memory client
│   └── config.py               Mem0 config
├── services/
│   ├── qdrant/                 Qdrant client
│   └── ollama/                 Ollama client
├── skills/
│   ├── librarian/              memory librarian
│   └── memory-archivist/        memory archivist
├── apps/
│   └── ai-context-sync/        context → memory sync
├── pipeline.json               health check pipeline (11 stages)
├── SOUL.md                     memory architecture
├── SPEC-POLYMER-*.md          SPECs
└── docs/
    └── HARNESS-AUDIT-*.md
```

---

## /srv/ops — OPERATIONS & IAAC

```
ops/
├── scripts/
│   ├── backup-postgres.sh
│   ├── backup-qdrant.sh
│   ├── snapshot-zfs.sh
│   ├── refactor-model-names.sh  NEW
│   └── infra/
├── terraform/cloudflare/       Cloudflare IaC
├── ai-governance/
│   ├── CONTRACT.md             non-negotiable principles
│   ├── GUARDRAILS.md          prohibitions & approvals
│   ├── PARTITIONS.md           disk/ZFS map
│   ├── CHANGE_POLICY.md       safe change process
│   ├── APPROVAL_MATRIX.md     quick reference
│   ├── PORTS.md               port governance
│   ├── SUBDOMAINS.md           subdomain governance
│   ├── NETWORK_MAP.md          network topology
│   ├── SERVICE_MAP.md          service dependencies
│   ├── mcps/                  MCP server docs
│   └── logs/                  audit logs
├── docker/                     Docker configs
├── grafana/                    Grafana dashboards
├── hardware/                   hardware inventory
├── network/                     network configs
├── metrics/                     metrics configs
├── gitea/                       Gitea configs
├── docs/                        ops documentation
└── backups/                    ZFS/backup snapshots
```

---

## CONTAINER SERVICES

```
/srv/docker-data/
├── coolify/                    Coolify PaaS (:8000)
├── qdrant/                     Vector DB (:6333)
├── openwebui/                  Web UI (:8080)
├── redis/                      Cache
└── (postgres, prometheus, etc)

/srv/apps/platform/
└── docker-compose.yml         n8n (:5678), PostgreSQL, Kong

/srv/monorepo/
├── docker-compose.litellm.yml  LiteLLM (:4000)
└── docker-compose.gitea.yml    Gitea
```

---

## MCP SERVERS (active)

```
mcp__dotcontext__*              PREVC harness, workflow, context, agent, skill
mcp__filesystem__*              file read/write/list
mcp__claude_ai_Gmail__*        email (draft, send, search, labels)
mcp__claude_ai_Google_Calendar__*  calendar (create, list, suggest)
mcp__claude_ai_Hugging_Face__*  HF Hub (papers, models, spaces)
mcp__plugin_context7_context7__* docs retrieval (resolve, query)
mcp__dotcontext__context7__*    Context7 MCP
mcp__claude_ai_Google_Drive__*  Drive (search, read, create)
mcp__dotcontext__harness__*     session, task, handoff, sensor
mcp__claude_ai_Gmail__create_draft
mcp__claude_ai_Hugging_Face__hf_hub_query
(cloudflare MCPs — DNS, observability)
```

---

## LLM MODELS

### Ollama (:11434)

| Model | Size | Purpose |
|-------|------|---------|
| `qwen2.5-coder:14b-q6k` | 14B | **Code Generation** (Phase E) |
| `qwen2.5vl:3b` | 3B | Vision STT (image analysis) |
| `nomic-embed-text:latest` | — | Embeddings (vector search) |

### External Providers

| Model | Provider | Purpose |
|-------|----------|---------|
| hermes-brain | OpenRouter API | LLM primário |
| llama3-portuguese-tomcat-8b | Ollama | PT-BR filter |
| Groq models | via LiteLLM | Fast inference |
| GPT-4o | via LiteLLM | Fallback |

---

## CI/CD PIPELINES

```
.gitea/workflows/              Gitea Actions
├── ci.yml                      main CI (lint, typecheck, test)
├── test.yml                    integration tests
└── sync-second-brain.yml      memory sync (disabled)

.github/workflows/               GitHub Actions
├── ci.yml                      main CI
└── (other workflows)
```

---

## KEY FILES

| File | Purpose |
|------|---------|
| `SPEC-204.md` | Nexus Unified Agent Harness Framework |
| `SPEC-206.md` | dotcontext MCP Audit |
| `SOUL.md` | Hermes Second Brain architecture |
| `HARNESS-AUDIT-2026-05-02.md` | Harness audit report |
| `pipeline.json` | Second brain health pipeline |
| `sensors.json` | Quality sensors (10 gates) |
| `prevc.json` | PREVC workflow state |
