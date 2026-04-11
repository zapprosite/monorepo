# Monorepo Ecosystem Audit
**Date:** 2026-04-11
**Host:** will-zappro homelab
**Monorepo Path:** `/srv/monorepo`
**Branch:** `feature/quantum-dispatch-ax7k2`

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Apps](#2-apps)
3. [Packages](#3-packages)
4. [Build & Tooling](#4-build--tooling)
5. [CI/CD](#5-cicd)
6. [Docker](#6-docker)
7. [Terraform / Infrastructure](#7-terraform--infrastructure)
8. [Skills System](#8-skills-system)
9. [Docs Structure](#9-docs-structure)
10. [Agent System](#10-agent-system)
11. [Cursor Loop Agents](#11-cursor-loop-agents)
12. [Memory System](#12-memory-system)
13. [MCP Tools](#13-mcp-tools)
14. [Cron Jobs](#14-cron-jobs)
15. [Governance](#15-governance)
16. [Cross-Cutting Relationships](#16-cross-cutting-relationships)
17. [Gaps & Issues](#17-gaps--issues)

---

## 1. Executive Summary

The monorepo (`/srv/monorepo`) is a **homelab orchestration platform** combining:
- A **Node.js/TypeScript monorepo** (pnpm workspaces + Turbo) for application code
- A **voice AI pipeline** (OpenClaw Bot, wav2vec2 STT, Kokoro TTS, CEO MIX agents)
- A **Cursor AI-like autonomous loop** (self-healing CI/CD with Gitea Actions)
- An **enterprise-grade governance** framework (Infisical secrets, ZFS snapshots, approval gates)

**Stack:** Fastify + tRPC + OrchidORM + PostgreSQL + React 19 + MUI + Biome + Turbo + pnpm

**Dual remotes:**
- `origin` → `git@github.com:zapprosite/monorepo.git` (GitHub mirror)
- `gitea` → `ssh://git@127.0.0.1:2222/will-zappro/monorepo.git` (Gitea primary)

**Key files:**
- `AGENTS.md` — Central command center (507 lines)
- `SPEC.md` — Perplexity-like browser agent spec
- `CLAUDE.md` — Quick-start rules
- `turbo.json` — Build pipeline definition
- `biome.json` — Lint/format config
- `tasks/pipeline.json` — 139 pending tasks across 10 phases

---

## 2. Apps

### 2.1 `apps/api` — Fastify Backend API

**What it is:** REST + tRPC API server using Fastify 5, OrchidORM, PostgreSQL 15.

**Stack:** `fastify@^5.6.1` + `orchid-orm@^1.57.6` + `tRPC 11` + `pg@^8.16.3`

**Key dependencies:**
- `@fastify/swagger` + `@fastify/swagger-ui` for OpenAPI docs at `/api/documentation`
- `@fastify/session` + `@fastify/cookie` for session management
- `@fastify/rate-limit` for rate limiting
- `@fastify/helmet` for security headers
- `@fastify/oauth2` for OAuth flows

**Depends on:** `packages/zod-schemas`, `packages/trpc`
**Used by:** `apps/web` (frontend), Gitea Actions (CI), Docker (production)

**Files:**
- `Dockerfile` — Multi-stage Alpine build with turbo prune, non-root user, HEALTHCHECK
- `server.ts` — Main entry point

**Status:** Active development. API docs at `:3000/api/documentation`.

---

### 2.2 `apps/orchestrator` — Universal Orchestration System

**What it is:** Node.js agent orchestrator with human gates, agent pool, MCP adapters, webhook integration.

**Stack:** TypeScript + tRPC 11 + YAML + Zod 4

**Purpose:** Coordinates the Cursor Loop autonomous agent system. Reads `pipeline-state.json` and manages task execution flow.

**Depends on:** `packages/zod-schemas`
**Used by:** Cursor Loop agents, Gitea Actions

---

### 2.3 `apps/perplexity-agent` — Perplexity-like Browser Agent

**What it is:** Streamlit + browser-use + Playwright agent using GPT-4o-mini via OpenRouter for web search and authenticated browsing.

**Stack:** Python 3.11+ (uv) + Streamlit + browser-use + Playwright + LangChain + OpenRouter

**Purpose:** Autonomous web research agent with persistent Chrome profile sessions.

**Key features:**
- Chrome profile persistence at `/srv/data/perplexity-agent/chrome-profile/`
- OpenRouter GPT-4o-mini for cost efficiency ($0.15/1M prompt)
- OAuth login persistence for Google, YouTube, etc.
- Streamlit UI at port 4004

**Depends on:** OpenRouter API key (Infisical), Chrome profile directory
**Used by:** OpenClaw via CDP (Chrome DevTools Protocol)

**Files:**
- `Dockerfile` — Coolify deployment
- `docker-compose.yml` — Local dev/test
- `app.py` — Streamlit UI
- `agent/browser_agent.py` — browser-use Agent wrapper

**Status:** Deployed on Coolify, subdomain `web.zappro.site` via Terraform.

---

### 2.4 `apps/workers` — (directory exists, no package.json found)

**Status:** Empty/incomplete directory.

---

### 2.5 `apps/web.archive` — Archived Web App

**What it is:** Previously the React frontend, now archived per SPEC-024.

**Status:** Archived. `apps/web` is no longer in the apps directory.

---

## 3. Packages

### 3.1 `packages/db` — Database ORM

**What it is:** Drizzle ORM + postgres.js. Shared database access layer.

**Exports:** `.` (main index)

**Depends on:** `postgres@^3.4.0`, `drizzle-orm@^3.0.0`, `dotenv`
**Used by:** `apps/api`

---

### 3.2 `packages/trpc` — tRPC Routers

**What it is:** Shared tRPC routers and client for type-safe API calls between apps.

**Exports:** `./*` (wildcard)

**Peer dependencies:** `@trpc/server@^10.45.0`, `@trpc/client@^10.45.0`, `zod@^4.1.12`
**Used by:** `apps/api`, `apps/web`

---

### 3.3 `packages/zod-schemas` — Shared Zod Schemas

**What it is:** Common Zod validation schemas used everywhere in the monorepo.

**Exports:** `./*` (wildcard)

**Peer dependency:** `zod@^4.1.12`
**Used by:** All apps (`apps/api`, `apps/orchestrator`)

---

### 3.4 `packages/ui` — Material UI Components

**What it is:** Shared React + MUI component library for the frontend.

**Package name:** `@repo/ui-mui`

**Exports:** `components/*`, `data-display/*`, `feedback/*`, `form/*`, `icons/*`, `layout/*`, `mrt/*`, `navigation/*`, `rhf-form/*`, `theme/*`

**Peer dependencies:** `@mui/material@^7.3.4`, `react@^19.2.0`, `@hookform/resolvers@^5.2.2`, `material-react-table@3.2.1`

**Used by:** `apps/web` (archived)

---

### 3.5 `packages/env` — Environment Validation

**What it is:** Zod schema validation for environment variables.

**Exports:** `.` (main index)

**Depends on:** `zod@^3.23.0`, `dotenv@^16.4.0`

---

### 3.6 `packages/config` — TypeScript Configurations

**What it is:** Shared TypeScript configuration packages.

---

### 3.7 `packages/email` — React Email Templates

**What it is:** Email template library using React Email + Resend.

**Exports:** `./*`, `./templates/*`

**Depends on:** `resend@^4.1.2`
**Peer dependencies:** `react-email@^3.0.7`, `@react-email/components@^0.0.19`

---

## 4. Build & Tooling

### 4.1 Turbo Pipeline (`turbo.json`)

```json
{
  "pipeline": {
    "build":    { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "test":     { "dependsOn": ["build"],  "outputs": ["coverage/**"] },
    "lint":     { "outputs": [] },
    "typecheck": { "dependsOn": ["build"], "outputs": [] },
    "dev":      { "cache": false, "persistent": true },
    "db:migrate": { "cache": false },
    "db:seed":  { "cache": false }
  }
}
```

**Commands:**
- `pnpm build` → `turbo run build`
- `pnpm test` → `turbo run test`
- `pnpm lint` → `biome ci .`
- `pnpm dev` → `turbo run dev --parallel`

**Issue:** Some workflows use `yarn` (deprecated), others use `pnpm`. README says `yarn install` but project uses pnpm.

---

### 4.2 Biome (`biome.json`)

Linter and formatter replacing ESLint + Prettier.

```bash
biome ci .              # CI check
biome format --write .  # Format
biome lint --write .    # Fix linting
```

---

### 4.3 pnpm Workspaces (`pnpm-workspace.yaml`)

Defines monorepo workspace structure for `apps/` and `packages/`.

**Note:** Yarn workspaces referenced in some docs but deprecated — project converted to pnpm.

---

## 5. CI/CD

### 5.1 GitHub Actions (`.github/workflows/`)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push to any branch + PR to main | lint → build → test |
| `code-review.yml` | PR opened/sync/reopened + review submitted | 5-gate review: lint+test → security → AI review → human approval → merge |
| `daily-report.yml` | Schedule | Daily status report |
| `deploy-main.yml` | Merge to main | Deploy to production |
| `deploy-on-green.yml` | Dispatch | Manual deploy trigger |
| `deploy-perplexity-agent.yml` | Push | Deploy perplexity-agent |
| `rollback.yml` | Dispatch | Rollback deployment |

---

### 5.2 Gitea Actions (`.gitea/workflows/`)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci-feature.yml` | Push to non-main branch | Lightweight CI: type check → lint → build → test |
| `ci.yml` | Push + PR | Full CI with Postgres service |
| `code-review.yml` | PR | 5-gate review (same as GitHub) |
| `daily-report.yml` | Schedule | Daily report |
| `deploy-main.yml` | Merge main | Production deploy |
| `deploy-on-green.yml` | Dispatch | Manual deploy |
| `deploy-perplexity-agent.yml` | Push | Deploy perplexity-agent |
| `failure-report.yml` | On failure | Failure notification |
| `rollback.yml` | Dispatch | Rollback |
| `voice-proxy-deploy.yml` | Push | Deploy voice proxy (wav2vec2-deepgram-proxy) |

**Issue:** Both `.github/workflows/` and `.gitea/workflows/` exist with similar files. Gitea is primary (local), GitHub is mirror.

---

### 5.3 Code Review Pipeline (5 Gates)

```
Gate 1: Automated Checks
├── TypeScript check (tsc --noEmit)
├── Biome lint
├── Turbo build
└── Vitest tests

Gate 2: Security Scan (Trivy)
├── Vulnerability scan (fs)
└── Config audit

Gate 3: AI Review (Claude Code CLI)
├── claude -p --print with PR context
└── Post comment to PR via Gitea API

Gate 4: Human Approval
└── Gitea environment protection (code-review env)

Gate 5: Merge Signal
└── No-op (actual merge via Gitea UI)
```

---

### 5.4 Gitea Runner (`docker-compose.gitea-runner.yml`)

```yaml
Image: gitea/act_runner:nightly-dind
- Privileged: true (security concern)
- Ephemeral: true (1)
- Labels: ubuntu-latest
- Registration token via env var
```

**Issues:**
- `privileged: true` is a security risk
- Runner token rotation pending (P000-T04 blocked)
- HEALTHCHECK implemented (wget healthz)

---

## 6. Docker

### 6.1 `docker-compose.yml` (Root)

Development database only:
```yaml
postgres:15-alpine on port 5432
```

### 6.2 `docker-compose.gitea-runner.yml`

Gitea Actions runner (see 5.4 above).

### 6.3 Dockerfiles

| File | Purpose | Notes |
|------|---------|-------|
| `apps/api/Dockerfile` | Production API container | Multi-stage Alpine, turbo prune, non-root user, HEALTHCHECK |
| `apps/perplexity-agent/Dockerfile` | Perplexity agent | Python/uv, Streamlit, browser-use |
| `docs/OPERATIONS/SKILLS/Dockerfile.openclaw-mcp-wrapper` | OpenClaw MCP wrapper | Port 3457, Python 3.11-slim |
| `docs/OPERATIONS/SKILLS/Dockerfile.openwebui-bridge-agent` | Bridge agent | Port 3456, Python 3.11-slim |

### 6.4 Docker Networking

- Bridge stack: `openwebui-bridge-agent` (3456) → `openclaw-mcp-wrapper` (3457)
- Internal networks: `qgtzrmi`, `wbmqefx` (per SPEC-020)

---

## 7. Terraform / Infrastructure

**Finding:** NO Terraform files exist within `/srv/monorepo/`.

Terraform for the homelab is managed elsewhere (`/srv/ops/` or Cloudflare Terraform state).

Infrastructure managed via:
- **Coolify** — Container orchestration (primary)
- **Cloudflare** — DNS, tunnels, access policies
- **Infisical** — Secrets management (vault.zappro.site:8200)

---

## 8. Skills System

### 8.1 Local Skills (`.claude/skills/`) — 34 skills

**Categories:**

| Category | Skills |
|----------|--------|
| Code Quality | `bug-investigation`, `code-review`, `refactoring`, `test-generation` |
| Documentation | `documentation`, `context-prune`, `repo-scan` |
| Security | `security`, `security-audit`, `secrets-audit` |
| Deployment | `deploy-validate`, `coolify-access`, `gitea-access`, `cloudflare-terraform` |
| Spec-Driven | `spec-driven-development`, `pipeline-gen`, `smoke-test-gen`, `feature-breakdown` |
| Research | `researcher`, `browser-dev`, `mcp-health` |
| Operations | `self-healing`, `snapshot-safe`, `human-gates`, `cost-reducer` |
| Audio/AI | `n8n` (n8n workflows) |
| Meta | `create-skill`, `skill-inventory`, `audit-workflow`, `spec-024-cleanup` |

**References:** Each skill has a `SKILL.md` + optional `references/` subdirectory.

---

### 8.2 Antigravity Kit (`.agent/skills/`) — 15 skills

| Skill | Purpose |
|-------|---------|
| `api-patterns/` | REST, tRPC, auth, response patterns |
| `architecture` | System architecture |
| `behavioral-modes` | Agent behavior modes |
| `clean-code` | Code quality |
| `database-design` | DB design patterns |
| `frontend-design` | UI/UX patterns |
| `nextjs-react-expert` | Next.js/React expertise |
| `nodejs-best-practices` | Node.js patterns |
| `port-governance` | Port management |

**Integration:** `.claude/rules/search.md` mandates searching `.agent/` for workflow guidance when `.claude/` results are inconclusive.

---

### 8.3 Skill Invocation Patterns

- **Slash commands:** `/bug`, `/review`, `/test`, `/spec`, `/pg`, `/se`, `/hg`, `/img`, etc.
- **Auto-invocation:** `.claude/CLAUDE.md` specifies auto-invoke for: `bug-investigation` (bugs), `test-generation` (tests), `code-review` (reviews), `refactoring` (code smells)
- **Pipeline hooks:** Skills triggered by scheduled_tasks.json cron jobs

---

## 9. Docs Structure

### 9.1 Directory Layout

```
docs/
├── SPECS/          # Feature specifications (29 SPECs)
├── ADRs/           # Architecture Decision Records
├── GUIDES/         # How-to guides
├── REFERENCE/      # Technical references
├── GOVERNANCE/     # Governance documents
├── OPERATIONS/     # Operations guides + SKILLS/
├── MCPs/           # MCP integration docs
├── TEMPLATES/      # Document templates
├── INCIDENTS/      # Incident reports
└── archive/        # Archived docs (read-only mirror)
```

**Obsidian mirror:** `obsidian/` is a **read-only mirror** of `docs/` (sync via rsync).

---

### 9.2 SPECS (`docs/SPECS/`)

**Total:** 29 SPECs across statuses: PROTEGIDO (3), DONE (3), IMPLEMENTING (6), APPROVED (1), REVIEW (2), DRAFT (14)

**Key SPECs:**

| SPEC | Title | Status |
|------|-------|--------|
| SPEC-001 | Workflow Performatico | Draft |
| SPEC-004 | Kokoro TTS Kit | PROTEGIDO |
| SPEC-005 | wav2vec2 STT Kit | PROTEGIDO |
| SPEC-009 | OpenClaw Persona + Audio Stack | PROTEGIDO |
| SPEC-013 | Unified Claude Agent Monorepo | Draft |
| SPEC-014 | Cursor AI CI/CD Pattern | Draft |
| SPEC-015 | Gitea Actions Enterprise | Draft |
| SPEC-018 | wav2vec2 Deepgram Proxy | DONE |
| SPEC-019 | OpenWebUI Repair | DONE |
| SPEC-020 | OpenWebUI ↔ OpenClaw Bridge | Draft |
| SPEC-021 | Claude Code Cursor Loop | Draft |
| SPEC-022 | Cursor-Loop CLI Solutions | Draft |
| SPEC-023 | Unified Monitoring + Self-Healing | Draft |
| SPEC-100 | Unified Claude/Agent Pipeline | Implementing |
| SPEC-CURSOR-LOOP | Autonomous Cursor Loop | Implementing |

**PROTEGIDO specs** (never alter without explicit approval):
- SPEC-004: Kokoro TTS Kit
- SPEC-005: wav2vec2 STT Kit
- SPEC-009: OpenClaw Persona + Audio Stack

---

### 9.3 GOVERNANCE Docs (`docs/GOVERNANCE/`)

| Document | Purpose |
|----------|---------|
| `CONTRACT.md` | Non-negotiable principles |
| `GUARDRAILS.md` | Forbidden/requires approval |
| `APPROVAL_MATRIX.md` | Decision table (SAFE/APPROVAL/FORBIDDEN) |
| `IMMUTABLE-SERVICES.md` | Pinned container list |
| `CHANGE_POLICY.md` | Safe modification process |
| `SECRETS_POLICY.md` | Secrets handling |
| `RECOVERY.md` | Disaster recovery |
| `INCIDENTS.md` | Incident tracking |

---

## 10. Agent System

### 10.1 AGENTS.md — Central Command Center

**What it is:** 507-line YAML defining the entire agent orchestration system.

**Key sections:**
- Tool Stack (Turbo, Biome, pnpm, Docker)
- Apps & Packages table
- Slash Commands (11 commands)
- Skills (34 local skills)
- Scripts (health-check, deploy, backup, restore, mirror-push)
- Smoke Tests (E2E tests)
- Gitea Actions (5 workflows)
- Antigravity Kit (.agent/)
- Spec-Driven Development flow
- CI/CD Loop (Cursor AI Pattern)
- Turbo Pipeline
- Secrets (Infisical)
- Gitea + GitHub Remotes
- Cron Jobs (8 jobs)
- Encoding guidance (PT-BR docs, EN code)

---

### 10.2 Slash Commands (`.claude/commands/`)

| Command | Purpose |
|---------|---------|
| `/pg` | SPEC → pipeline.json |
| `/plan` | SPEC → tasks |
| `/rr` | Code review report |
| `/se` | Secrets audit |
| `/sec` | Security scan |
| `/feature` | Git feature workflow |
| `/ship` | Pre-launch checklist |
| `/turbo` | Git turbo workflow |
| `/code-review` | 5-axis review |
| `/scaffold` | New module template |
| `/img` | Ollama Qwen2.5-VL image analysis |

---

### 10.3 Agent Specialists (`.claude/agents/`)

| Agent | Purpose |
|-------|---------|
| `architect-specialist.md` | Architecture decisions |
| `backend-specialist.md` | Backend development |
| `frontend-specialist.md` | Frontend/UI development |
| `database-specialist.md` | Database design |
| `devops-specialist.md` | DevOps/infrastructure |
| `security-auditor.md` | Security review |
| `test-writer.md` | Test generation |
| `refactoring-specialist.md` | Code refactoring |
| `performance-optimizer.md` | Performance tuning |
| `planner.md` | Task planning |
| `researcher.md` | Web research |
| `documentation-writer.md` | Documentation |
| `bug-fixer.md` | Bug investigation |
| `feature-developer.md` | Feature implementation |
| `implementer.md` | General implementation |
| `reviewer.md` | Code review |
| `orchestrator.md` | Task orchestration |
| `mcp-operator.md` | MCP tool management |
| `mobile-specialist.md` | Mobile development |
| `debugger.md` | Debugging |
| `code-reviewer.md` | Code quality review |

---

## 11. Cursor Loop Agents

### 11.1 Overview

The Cursor Loop is an **autonomous CI/CD loop** inspired by Cursor AI's development pattern. It runs continuously via cron, coordinating 10 specialized agents.

**Loop Flow:**
```
[1] Leader: Infisical Check
    │
    ▼
[2] Gitea CI: run tests
    │
    ├── PASS ──────────────────────────────────────────→ [4]
    │
    └── FAIL
         │
         ▼
    [3] 5 Research + Refactor agents
         │
         └── Loop back to [2]
              │
              ▼
         [4] Ship + Sync
              │
              ▼
         [5] Mirror: merge main → new random branch
```

---

### 11.2 Cursor Loop Agents

| Agent | Model | Responsibilities |
|-------|-------|------------------|
| `cursor-loop-leader.md` | cm | Infisical check, env validation, agent coordination, state management |
| `cursor-loop-ship.md` | cm | Git add, semantic commit, push --force-with-lease, PR creation |
| `cursor-loop-mirror.md` | cm | Merge to main, push to both remotes, create random branch |
| `cursor-loop-refactor.md` | cm | Apply fixes from research, preserve coverage, emit Bootstrap Effect |
| `cursor-loop-research.md` | cm | Root cause analysis, Tavily research, Context7 docs |
| `cursor-loop-debug.md` | — | Debug issues |
| `cursor-loop-giteaai.md` | — | Gitea AI integration |
| `cursor-loop-sync.md` | — | Sync operations |
| `cursor-loop-spec.md` | — | SPEC management |
| `cursor-loop-review.md` | — | Review handling |

---

### 11.3 Pipeline State Machine

```
tasks/pipeline-state.json states:
├── IDLE → normal flow
├── RUNNING → check if stuck
├── TEST_FAILED → cursor-loop-debug
├── READY_TO_SHIP → cursor-loop-ship
├── BLOCKED_HUMAN_REQUIRED → STOP, scripts/unblock.sh
└── BLOCKED → human-gates skill
```

---

### 11.4 Cursor Loop Logs (`.cursor-loop/logs/`)

```
refactor-20260410-024227.log
research-20260410-024114.md
research-20260410-030054.md
research-20260410-030110.md
research-20260410-030513.md
```

---

## 12. Memory System

### 12.1 Memory Files (`~/.claude/projects/-srv-monorepo/memory/`)

| File | Purpose |
|------|---------|
| `MEMORY.md` | Main index of all memory files |
| `ai-context.md` | AI-CONTEXT → memory pipeline |
| `architecture.md` | System architecture |
| `development-workflow.md` | Development workflow |
| `docs-index.md` | Documentation index |
| `glossary.md` | Term glossary |
| `project-overview.md` | Project overview |
| `workflow.md` | Main workflow |
| `homelab-estado.md` | Homelab diagnostics |
| `voice-pipeline-desktop-10-04-2026.md` | Voice pipeline desktop |
| `voice-pipeline-08-04-2026.md` | Voice pipeline server |
| `openclaw-agents-kit.md` | OpenClaw agents kit |
| `monorepo-audit-09-04-2026.md` | Monorepo audit |
| `voice-proxy-wav2vec2-deepgram.md` | wav2vec2 proxy reference |
| `continuar-10-04-2026.md` | Bridge status |
| `SPEC-023-unified-monitoring-self-healing.md` | Monitoring spec |
| `SPEC-023-unified-healing-cli.md` | Healing CLI spec |
| `tools-read-false-negative.md` | Tooling issues |

### 12.2 Memory Sync

**Last sync:** 2026-04-11T00:12

**Sync mechanism:**
- `.context/docs/` contains AI-CONTEXT synced documentation
- Cron job `614f0574` runs every 30 min to sync docs → memory
- After each commit, `sync.sh` script updates MEMORY.md index

---

## 13. MCP Tools

### 13.1 Configured MCPs

| MCP | Status | Purpose |
|-----|--------|---------|
| `context7-mcp` | ✅ Active | Fetch library documentation (Context7) |
| `tavily-mcp` | ⚠️ Planned | Web research (not yet installed per P024-CLI-T06) |
| `github-mcp` | ⚠️ CLI-based | GitHub API via `gh` CLI |
| `openwebui-mcp` | ✅ Configured | OpenWebUI tools |
| `ai-context-sync` | ✅ Script | Sync docs → memory |
| `taskmaster-ai` | ⚠️ Planned | Task management |

### 13.2 Context7 Integration

**Rule:** Always fetch current docs via Context7 when user asks about libraries/frameworks/APIs — even well-known ones.

**Process:**
1. `resolve-library-id` with library name + question
2. `query-docs` with selected library ID + full question
3. Answer using fetched docs

---

## 14. Cron Jobs

### 14.1 Scheduled Tasks (`/.claude/scheduled_tasks.json`)

| Job ID | Cron | Purpose |
|--------|------|---------|
| `614f0574` | `*/30 * * * *` | Sync docs → memory |
| `modo-dormir-daily` | `0 3 * * *` | SPEC scan → pipeline.json |
| `code-review-daily` | `0 4 * * *` | Code review commits → REVIEW-*.md |
| `test-coverage-daily` | `0 5 * * *` | Test coverage analysis |
| `secrets-audit-daily` | `0 6 * * *` | Secrets scan |
| `mcp-health-daily` | `0 8 * * *` | MCP server health |
| `8812f46c` | `*/5 * * * *` | Auto-healer (Coolify) |
| `4cb53930` | `3 */15 * * *` | Resource monitor (disk, memory, CPU, ZFS) |

### 14.2 Auto-Healer (Job `8812f46c`)

**Interval:** Every 5 minutes

**Purpose:**
- Check Coolify services status via coolify-access
- Monitor for failed containers
- Attempt auto-restart if possible
- Log actions taken

**Status:** Operational (docker-autoheal UP 10h)

---

## 15. Governance

### 15.1 External Governance (`/srv/ops/ai-governance/`)

**NOT accessible from monorepo** — governed separately.

**Contents:**
- `CONTRACT.md` — Non-negotiable principles
- `GUARDRAILS.md` — Forbidden/approval requirements
- `PARTITIONS.md` — Physical reality (disks, ZFS, mountpoints)
- `CHANGE_POLICY.md` — Safe modification process
- `NETWORK_MAP.md` — Network topology, GPU, services
- `PORTS.md` — Active/reserved/free ports
- `SUBDOMAINS.md` — Active subdomains + Cloudflare Tunnel
- `APPROVAL_MATRIX.md` — SAFE/APPROVAL/FORBIDDEN table

**Key rules:**
- Port 3000 → Open WebUI (reserved)
- Port 4000 → LiteLLM production
- Port 4001 → OpenClaw Bot (reserved)
- Port 8000 → Coolify PaaS
- Port 8080 → aurelia-api
- Free Dev Ports: 4002–4099, 5173

---

### 15.2 Internal Governance (`/srv/monorepo/docs/GOVERNANCE/`)

Mirror of external governance with additions:
- `IMMUTABLE-SERVICES.md` — coolify-db, prometheus, grafana, loki, alertmanager, n8n, cloudflared, coolify-proxy
- `PINNED-SERVICES.md` — Pinned container whitelist
- `ANTI-FRAGILITY.md` — Anti-fragility patterns
- `DATABASE_GOVERNANCE.md` — Database policies
- `OPENCLAW_DEBUG.md` — OpenClaw debugging

---

### 15.3 OpenClaw Audio Governance (`.claude/rules/openclaw-audio-governance.md`)

**Immutable rules:**
- STT: Only wav2vec2 at port 8201
- STT Proxy: Only wav2vec2-proxy at port 8203
- TTS: Only via TTS Bridge at port 8013 → Kokoro at 8880
- TTS Voices: Only `pm_santa` (default) and `pf_dora` (fallback)
- LLM Primary: MiniMax M2.7 DIRECT (not via LiteLLM)
- Vision: Only `litellm/qwen2.5-vl`
- Identity: Name=Zappro, Emoji=🎙️

---

## 16. Cross-Cutting Relationships

### 16.1 Secrets Flow

```
Infisical Vault (vault.zappro.site:8200)
    │
    ├── Project ID: e42657ef-98b2-4b9c-9a04-46c093bd6d37
    │
    ├── apps/perplexity-agent/ → OPENROUTER_API_KEY
    ├── apps/api/ → DB credentials, session secrets
    ├── OpenClaw Bot → API keys, tokens
    └── Coolify → COOLIFY_API_KEY, GITEA_TOKEN
```

### 16.2 Voice Pipeline Chain

```
User Audio → wav2vec2 (:8201) → OpenClaw → LLM (MiniMax M2.7)
                                                      │
                                                      ▼
User ← Kokoro (:8880) ← TTS Bridge (:8013) ← Response
```

### 16.3 CI/CD → Deployment Flow

```
Push → Gitea CI (ci-feature.yml)
         │
         ├── lint → build → test
         │
         ▼
PR → code-review.yml
         │
         ├── Gate 1: Automated checks
         ├── Gate 2: Security (Trivy)
         ├── Gate 3: AI Review (Claude Code)
         ├── Gate 4: Human Approval
         └── Gate 5: Merge signal
                   │
                   ▼
         Merge → deploy-main.yml
                   │
                   ▼
         Coolify API deploy
                   │
                   ▼
         Smoke tests E2E
```

### 16.4 Cursor Loop → Pipeline State

```
tasks/pipeline.json (139 tasks, 10 phases)
         │
         ▼
cursor-loop-leader reads pipeline-state.json
         │
         ├── IDLE → next task
         ├── TEST_FAILED → cursor-loop-research → cursor-loop-refactor
         ├── READY_TO_SHIP → cursor-loop-ship
         ├── BLOCKED_HUMAN_REQUIRED → STOP, scripts/unblock.sh
         └── BLOCKED → human-gates skill
```

---

## 17. Gaps & Issues

### 17.1 Critical Gaps

| Gap | Impact | Related Tasks |
|-----|--------|---------------|
| `privileged: true` on Gitea runner | Security risk | P000-T07 |
| Coolify API unauthenticated | Cannot auto-deploy | Auto-healer job |
| node-exporter no HEALTHCHECK | Monitoring gap | P023-T01, P024-T01 |
| loki no HEALTHCHECK | Monitoring gap | P023-T02, P024-T02 |
| cadvisor scrape timeout misconfigured | Monitoring data loss | P023-T05, P024-T10 |
| Restart loop protection not implemented | Crash loop risk | P023-T03, P024-T04 |
| Tavily MCP not installed | Research agent limited | P024-CLI-T06 |

### 17.2 Medium Priority

| Issue | Impact |
|-------|--------|
| GitHub Actions and Gitea Actions duplicated | Maintenance burden |
| `apps/web` archived but referenced in docs | Confusion |
| `apps/workers` empty | Unclear purpose |
| yarn vs pnpm inconsistency | Doc confusion (README says yarn) |
| No Terraform in monorepo | Infrastructure not versioned |

### 17.3 Task Pipeline Summary

- **Total tasks:** 139
- **Pending:** 104
- **Critical path:** 28 tasks
- **Phase 10 (SPEC-024):** 35 tasks — largest phase

### 17.4 What's Working Well

- Spec-driven development workflow is well-established (29 SPECs)
- 5-gate code review pipeline is comprehensive
- Cursor Loop architecture is sophisticated (10-agent coordination)
- Voice pipeline (OpenClaw + wav2vec2 + Kokoro) is production-grade
- Governance framework is thorough (APPROVAL_MATRIX, GUARDRAILS, CONTRACT)
- Memory sync automation keeps documentation fresh
- Infisical secrets management centralizes credentials

---

## Appendix A: File Counts

| Category | Count |
|----------|-------|
| SPECs | 29 |
| Skills (.claude/skills) | 34 |
| Skills (.agent/skills) | 15 |
| Cursor Loop Agents | 13 |
| Slash Commands | 11 |
| Scheduled Cron Jobs | 8 |
| GitHub/Gitea Workflows | 14 |
| Apps | 4 |
| Packages | 7 |
| Pipeline Phases | 10 |

---

## Appendix B: Port Map

| Port | Service | Status |
|------|---------|--------|
| 3000 | API (apps/api) | Reserved |
| 4000 | LiteLLM production | Reserved |
| 4001 | OpenClaw Bot | Reserved |
| 4004 | perplexity-agent (Streamlit) | Active |
| 5432 | PostgreSQL | Active |
| 5173 | Vite frontend | Free for dev |
| 8000 | Coolify PaaS | Reserved |
| 8080 | aurelia-api | Reserved |
| 8201 | wav2vec2 STT | Active |
| 8203 | wav2vec2-proxy | Active |
| 8880 | Kokoro TTS | Active |
| 8013 | TTS Bridge | Active |

---

*Document generated: 2026-04-11*
*Last commit: e160b6c — feat(SPEC-001): bootstrap with Infisical vault resolution + Phase 1 tasks*
