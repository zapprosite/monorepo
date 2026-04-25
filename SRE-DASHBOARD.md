# SRE Dashboard — Homelab Operations

**Last Updated:** 2026-04-25
**Environment:** Production Homelab (zappro.site)

---

## 1. System Overview

| Subsystem | Status | Version | Endpoint | Purpose |
|-----------|--------|---------|----------|---------|
| **Nexus** | Operational | SPEC-204 | — | 7x7 agent harness (49 specialized agents) |
| **Hermes Gateway** | Operational | v0.9.0 | hermes.zappro.site:3001 | Agent brain + Telegram polling |
| **Hermes MCP** | Operational | — | localhost:8092 | MCP protocol bridge |
| **Mem0/Qdrant** | Operational | — | localhost:6333 | Vector memory (768-dim nomic-embed-text) |
| **LiteLLM** | Operational | — | localhost:4000 | LLM proxy + rate limiting |
| **Qdrant** | Operational | — | localhost:6333 | RAG / embeddings storage |
| **Coolify** | Operational | — | coolify.zappro.site:8000 | Container PaaS management |
| **Ollama** | Operational | — | localhost:11434 | Local LLM inference (RTX 4090) |

---

## 2. Core Directory Structure

```
/srv/monorepo/
├── apps/
│   ├── api/                    # Fastify + tRPC backend
│   └── ai-gateway/              # OpenAI-compatible facade (SPEC-047)
├── packages/
│   └── circuit-breaker/         # Circuit breaker impl (SPEC-068)
├── docs/                        # Canonical documentation
│   ├── SPECS/                   # Feature specifications
│   ├── ADRs/                    # Architecture Decision Records
│   ├── GUIDES/                  # Operational how-to guides
│   └── OPS/                     # Operations runbooks
├── scripts/                     # Operational automation
│   ├── sync-second-brain.sh    # Sync to hermes-second-brain
│   ├── generate-tree.sh        # Generate monorepo-TREE.md
│   └── prune-docs.sh           # Prune dead SPECs
├── tasks/                       # TaskMaster pipeline
├── smoke-tests/                # Smoke test suite
├── mcps/                        # MCP server configurations
├── grafana/                     # Grafana dashboard configs
└── .claude/                    # Claude Code config + skills
```

---

## 3. Nexus 7x7 Agents Table

### 3.1 Mode: debug

| Agent | Specialty |
|-------|-----------|
| `log-diagnostic` | Log parsing, error patterns, burst detection |
| `stack-trace` | Exception analysis, crash investigation |
| `perf-profiler` | CPU/memory/IO bottlenecks, leak detection |
| `network-tracer` | DNS/HTTP/TLS timeouts, connectivity issues |
| `security-scanner` | CVE scanning, secrets exposure, injection |
| `sre-monitor` | Alert triage, SLO/SLA breach analysis |
| `incident-response` | P1 incident escalation, outage response |

### 3.2 Mode: test

| Agent | Specialty |
|-------|-----------|
| `unit-tester` | Functions, pure logic, edge cases |
| `integration-tester` | APIs, DB queries, integrations |
| `e2e-tester` | Complete user flows, Playwright/Cypress |
| `coverage-analyzer` | Coverage gaps, threshold analysis |
| `boundary-tester` | Min/max/empty/null values |
| `flaky-detector` | Intermittent tests, timing issues |
| `property-tester` | fast-check, algebraic invariants |

### 3.3 Mode: backend

| Agent | Specialty |
|-------|-----------|
| `api-developer` | REST/GraphQL endpoints, OpenAPI |
| `service-architect` | DI containers, service composition |
| `db-migrator` | Postgres schema migrations, rollbacks |
| `cache-specialist` | Redis cache-aside, TTL, invalidation |
| `auth-engineer` | JWT, sessions, OAuth, RBAC |
| `event-developer` | RabbitMQ/Kafka, event sourcing, CQRS |
| `file-pipeline` | File uploads, processing |

### 3.4 Mode: frontend

| Agent | Specialty |
|-------|-----------|
| `component-dev` | React/Vue components |
| `responsive-dev` | Mobile-first CSS, breakpoints |
| `state-manager` | Zustand/Redux/React Query |
| `animation-dev` | Framer Motion, CSS transitions |
| `a11y-auditor` | WCAG 2.1 AA, ARIA, keyboard nav |
| `perf-optimizer` | Core Web Vitals, LCP/INP/CLS |
| `design-system` | Design tokens, themes, multi-brand |

### 3.5 Mode: review

| Agent | Specialty |
|-------|-----------|
| `correctness-reviewer` | Logic, edge cases, spec adherence |
| `readability-reviewer` | Naming, complexity, dead code |
| `architecture-reviewer` | Dependencies, circular deps |
| `security-reviewer` | OWASP Top 10, injection vectors |
| `perf-reviewer` | N+1 queries, pagination, bundle size |
| `dependency-auditor` | Outdated packages, CVEs, licenses |
| `quality-scorer` | Aggregate score, gate pass/fail |

### 3.6 Mode: docs

| Agent | Specialty |
|-------|-----------|
| `api-doc-writer` | OpenAPI specs, Swagger UI |
| `readme-writer` | README, getting started guides |
| `changelog-writer` | Keepachangelog, release notes |
| `inline-doc-writer` | JSDoc, TypeDoc, comments |
| `diagram-generator` | Mermaid flows, ER diagrams |
| `adr-writer` | Architecture Decision Records |
| `doc-coverage-auditor` | Docs completeness, gaps |

### 3.7 Mode: deploy

| Agent | Specialty |
|-------|-----------|
| `docker-builder` | Multi-stage Dockerfile, BuildKit |
| `compose-orchestrator` | Docker Compose, healthchecks |
| `coolify-deployer` | Coolify API deployment |
| `secret-rotator` | Env rotation, Vault integration |
| `rollback-executor` | Deploy/migration rollback |
| `zfs-snapshotter` | ZFS snapshots, pre-deploy safety |
| `health-checker` | Health endpoints, smoke tests |

---

## 4. Hermes Status Table

| Component | Type | Host | Port | Status |
|-----------|------|------|------|--------|
| Hermes Gateway | Agent (bare metal) | Ubuntu Desktop | 3001 | Operational |
| Hermes MCP | MCP Server (bare metal) | Ubuntu Desktop | 8092 | Operational |
| Telegram Bot | Polling | — | — | `@CEO_REFRIMIX_bot` |
| Hermes Second Brain | Vault | Gitea | — | `hermes-second-brain` |

### Hermes Environment Variables

| Secret | Purpose |
|--------|---------|
| `HERMES_API_KEY` | Hermes Gateway authentication |
| `HERMES_GATEWAY_URL` | Gateway endpoint |
| `TELEGRAM_BOT_TOKEN` | Telegram polling bot token |

### Hermes Directory Symlink

| Path | Target | Size | Purpose |
|------|--------|------|---------|
| `/srv/monorepo/hermes/` | `~/.hermes/` | ~287MB | Working directory for Hermes agent operations |

**Note:** `hermes/` in the monorepo is a symlink to `~/.hermes/` on the host system. All Hermes state, configs, and scripts live in the home directory while remaining accessible from `/srv/monorepo/hermes/`.

---

## 5. Mem0 / Qdrant Collections

**Endpoint:** `http://localhost:6333`
**Embedding Model:** `nomic-embed-text` (768 dimensions)
**Distance Metric:** Cosine
**HNSW Index:** `m=16`, `ef_construct=200`

### 5.1 Agency Collections

| Collection | Purpose | Payload Indexes |
|------------|---------|-----------------|
| `agency_clients` | Client profiles + health scoring | id, plan, chat_id, created_at |
| `agency_campaigns` | Marketing campaigns | id, client_id, status, created_at |
| `agency_brand_guides` | Brand guidelines per client | id, client_id, version |
| `agency_conversations` | Full conversation history | id, chat_id, client_id, session_id |
| `agency_working_memory` | Agent session memory | id, user_id, last_updated |
| `agency_assets` | Creative assets metadata | id, client_id, campaign_id, type |
| `agency_tasks` | Tasks & deliverables | id, client_id, status, assignee |
| `agency_video_metadata` | Video transcription + moments | id, client_id, campaign_id |
| `agency_knowledge` | Internal knowledge base | id, type, tags |

### 5.2 Mem0 Collection

| Collection | Embedding | TTL Policy |
|------------|-----------|------------|
| `will` | nomic-embed-text (768-dim) | Conversations: 7d, Important: 30d |

---

## 6. Quick Commands

### 6.1 Nexus Agent Commands

```bash
# List all modes and agents
nexus.sh --mode list

# View agents by mode
nexus.sh --mode debug
nexus.sh --mode test
nexus.sh --mode backend
nexus.sh --mode frontend
nexus.sh --mode review
nexus.sh --mode docs
nexus.sh --mode deploy

# SPEC workflow
nexus.sh --spec SPEC-204 --phase plan
nexus.sh --spec SPEC-204 --phase execute --parallel 15
nexus.sh --spec SPEC-204 --phase verify
nexus.sh --spec SPEC-204 --phase complete

# Utility
nexus.sh --status
nexus.sh --resume
nexus.sh --snapshot
```

### 6.2 Smoke Tests

```bash
# Run all smoke tests
bash smoke-tests/run-all.sh

# Individual tests
bash smoke-tests/smoke-env-secrets-validate.sh
```

### 6.3 Second Brain Sync

```bash
# Sync monorepo structure to second-brain
bash scripts/sync-second-brain.sh

# Boot second brain context
bash ~/.hermes/scripts/sb-boot.sh

# Pull latest second-brain
cd /tmp/hermes-second-brain && git pull origin main
```

### 6.4 Docker / Coolify

```bash
# Coolify API
curl -s http://localhost:8000/api/v1/health

# Docker Compose stack
docker compose -f /srv/monorepo/docker-compose.yml ps
```

### 6.5 Qdrant / Vector DB

```bash
# Qdrant health
curl -s http://localhost:6333/health

# List collections
curl -s http://localhost:6333/collections | jq '.result.collections[].name'
```

---

## Flow-Next Integration

| Command | Purpose |
|---------|---------|
| /flow-next:prospect | Generate ranked ideas |
| /flow-next:plan | Create task queue from SPEC |
| /flow-next:work | Execute with workers |
| /flow-next:audit | Memory review |
| /flow-next:nexus-init | Init Nexus context |

**Note:** Flow-Next adds plan-first + re-anchoring to Claude Code workflow. Nexus still available for parallel execution.

---

## 7. Key Documentation Links

| Document | Path | Purpose |
|----------|------|---------|
| **Architecture Overview** | `docs/ARCHITECTURE-OVERVIEW.md` | Full system topology |
| **Nexus Guide** | `docs/NEXUS_GUIDE.md` | 7x7 agent framework |
| **Qdrant Schema** | `docs/QDRANT_COLLECTION_SCHEMA.md` | Vector collections |
| **Second Brain** | `docs/SECOND-BRAIN.md` | Knowledge vault sync |
| **Fault Tolerance** | `docs/FAULT_TOLERANCE.md` | Resilience patterns |
| **OPS Runbook** | `docs/OPS_RUNBOOK.md` | Operational procedures |
| **Network Governance** | `/srv/ops/ai-governance/PORTS.md` | Port allocation |
| **Subnet Governance** | `/srv/ops/ai-governance/SUBDOMAINS.md` | Subdomain registry |
| **HOMELAB-OPS** | `docs/HOMELAB-OPS.md` | Homelab operations guide |
| **AGENTS.md** | `AGENTS.md` | Monorepo agent processes |

---

## 8. Active SPECs

| SPEC | Title | Status |
|------|-------|--------|
| 050 | Network & Port Governance | Codified |
| 068 | Circuit Breaker | Codified |
| 074 | Hermes Second Brain | Active |
| 090 | Orchestrator v3 | Active |
| 204 | Nexus Framework | Active |

---

## 9. Infrastructure Ports (Reserved)

| Port | Service | Status |
|------|---------|--------|
| :3000 | Open WebUI | Reserved |
| :4000 | LiteLLM | Reserved |
| :4001 | OpenClaw Bot | Reserved |
| :8000 | Coolify PaaS | Reserved |
| :8080 | Open WebUI (Coolify) | Reserved |
| :8642 | Hermes | Reserved |
| :6333 | Qdrant | Reserved |
| :5173 | Vite (Dev) | Free |
| :4002-4099 | Microservices | Free |

---

## 10. Alert Channels

| Severity | Channel | Contact |
|----------|---------|---------|
| P1 Outage | Telegram `@CEO_REFRIMIX_bot` | Hermes incident-response |
| P2 Degradation | Grafana Dashboard | monitor.zappro.site |
| P3 Warning | Loki Log Alerts | Via Grafana |
| Info | Second Brain Sync | Auto (30min cron) |

---

*Generated automatically from monorepo-TREE.md, NEXUS_GUIDE.md, QDRANT_COLLECTION_SCHEMA.md, and ARCHITECTURE-OVERVIEW.md*
