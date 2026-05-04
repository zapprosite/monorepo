# Architecture Survey — Full Ecosystem
**Date:** 2026-05-02
**Repos scanned:** `/srv/monorepo`, `/srv/ops`, `/srv/hermes-second-brain`

---

## Repos Overview

| Repo | Path | Type | Files |
|------|------|------|-------|
| **monorepo** | `/srv/monorepo` | Node.js + Go + Python | 752 files (ts/tsx/go/py/sh) |
| **ops** | `/srv/ops` | Bash + Python + Docker | 165 files (sh/py/md) |
| **second-brain** | `/srv/hermes-second-brain` | Python + Docs | 26 files (md/py) |

---

## Repo 1: /srv/monorepo — Main Application Platform

### Apps (14 directories)

| App | Stack | Status |
|-----|-------|--------|
| `apps/api` | Fastify + tRPC + Prisma | **Ativo** |
| `apps/web` | React 18 + MUI + Emotion | **Ativo** |
| `apps/ai-gateway` | Fastify + ofetch | **Ativo** |
| `apps/orchestrator` | tRPC + BullMQ + YAML | **Ativo** |
| `apps/painel-organism` | React + Lucide | **Ativo** |
| `apps/CRM-REFRIMIX` | NestJS + Postgres + Redis | **Legado** |
| `apps/obsidian-web` | OpenWebUI template | Template |
| `apps/list-web` | OpenWebUI template | Template |
| `apps/monitoring` | Standalone | Standalone |
| `apps/hvac-manual-downloader` | Python scraper | Standalone |
| `apps/perplexity-agent` | Agent | Standalone |

### Packages (7 internas)

```
@repo/ui           → Componentes React compartilhados
@repo/trpc        → tRPC client/server types
@repo/zod-schemas → Schemas Zod validados
@repo/email       → Templates de email
@repo/config      → Configurações compartilhadas
@repo/env         → Validação de env vars
@repo/db          → Prisma client
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Node.js + Fastify + tRPC |
| Frontend | React 18 + MUI + Emotion |
| Database | PostgreSQL + Prisma ORM |
| Cache | Redis |
| Vector DB | Qdrant (RAG) |
| AI Gateway | LiteLLM `:4018` |
| LLM Chat | OpenRouter via hermes-brain |
| VL Model | Qwen2.5-VL-3B (Ollama `:11434`) |
| STT | Groq Whisper Turbo |
| TTS | Edge TTS |
| LangGraph | StateGraph + PostgreSQL checkpointing |
| Workers | BullMQ + Redis |
| Deploy | Coolify `:8000` |
| Repo | Gitea `:3300` |
| Container | Docker + Docker Compose |
| Storage | ZFS (tank pool) |

### Entry Points

```
Backend:   apps/api/src/server.ts, apps/api/src/main.ts
           apps/api/src/modules/*/  (20+ tRPC routers)
Frontend:  apps/web/src/App.tsx
Go:        cmd/manual-scraper/, cmd/index-hvac/, internal/whatsapp/
Scripts:   scripts/hvac-rag/, scripts/vibe/, scripts/*.sh
```

### LOC (TypeScript — 30s sample)

| Language | Files | Code | Comment |
|----------|-------|------|---------|
| TypeScript | 338 | 14,294 | 1,757 |
| TypeScript React | 147 | — | — |

**Total by type:** 348 TS + 147 TSX + 104 Go + 96 Python + 157 Shell = **752 files**

### Data Flows

```
RAG Pipeline:
  User → tRPC API → Qdrant (vector search) → LiteLLM :4018 → OpenRouter via hermes-brain → Response

Voice Pipeline:
  Telegram Voice → Groq Whisper (STT) → OpenRouter via hermes-brain (LLM) → Edge TTS → Telegram Voice

Auth Flow:
  OAuth/credentials → apps/api/src/modules/auth/ → Redis (sessions) → JWT → client

Webhook Flow:
  External → apps/api/src/modules/webhooks/ → validate → process → Postgres
```

### Git Hotspots (últimos commits)

```
3x  apps/web/e2e/smoke.spec.ts          (E2E test)
2x  apps/api/src/server.ts                (server config)
2x  *.trpc.test.ts (múltiplos módulos)  (unit tests)
2x  apps/web/package.json                 (deps)
```
**Padrão:** Mudanças recentes = fase de estabilização (testes E2E + unit)

### Docker Services

```
Standalone:
  docker-compose.yml              → fit-v2
  docker-compose.litellm.yml      → litellm
  docker-compose.openwebui.yml    → openwebui
  docker-compose.edge-tts.yml     → openai-edge-tts
  docker-compose.gitea-runner.yml → gitea-runner
  docker-compose.telegram-dev.yml → telegram-dev

  docker-compose.yml              → postgres, redis, api, web
  docker-compose.coolify.yml     → postgres, redis, api, web (Coolify deploy)
```

---

## Repo 2: /srv/ops — Infrastructure & Operations

### Structure

```
ops/
├── ai-governance/         → 8 governance docs (CONTRACT, GUARDRAILS, etc.)
│   ├── docs/             → sub-docs
│   ├── logs/             → run logs
│   └── skills/           → ops-specific skills
├── scripts/              → 15+ scripts bash/python
├── stacks/
│   ├── autoheal/         → docker-compose.yml
│   └── guardrail/        → guardrail.py + docker-compose.yml
├── gitea/
│   └── docker-compose.yml
├── hardware/              → hardware monitoring scripts
├── network/               → network diagnostics
├── docker/               → Docker monitoring scripts
├── systemd/              → systemd units
├── terraform/            → Terraform configs
├── grafana/               → Grafana configs
├── backup-logs/          → backup logs
├── backups/              → backup snapshots
├── locked-config/        → locked configs
├── logs/                 → operational logs
├── metrics/              → metrics collection
├── security/             → security scripts
├── state/                → state files
└── docs/                → ops documentation
```

### Tech Stack (ops)

| Layer | Technology |
|-------|-----------|
| Monitoring | Grafana + Prometheus |
| Auth | Keycloak |
| Metrics | Prometheus + Alertmanager |
| Docker | Docker + docker-compose |
| Backup | ZFS snapshots |
| Scripts | Bash + Python |
| Secrets | Vault-style manifest |
| Workflows | Gitea Actions |
| Networking | UFW + fail2ban + Tailscale |

### Scripts (15+ key scripts)

```
hermes-skill-teacher.sh     → skill teaching pipeline
backup-zfs-snapshot.sh      → ZFS backup + snapshot
keep-qwen-warm.sh          → keep qwen2.5vl:3b warm in Ollama
ollama-healthcheck.sh       → Ollama health check
hermes-mcp-watchdog.sh     → MCP watchdog
hermes-security-check.sh   → security audit
hermes-brain-dashboard.sh  → brain metrics dashboard
setup-oauth.sh             → OAuth setup
migrate-to-zfs.sh          → migrate to ZFS
pre-commit-subdomain-check.sh → subdomain check
smoke-subdomain.sh         → subdomain smoke test
patch-resource-limits.sh   → patch resource limits
redis-backup.sh            → Redis backup
```

### Gitea Workflows

```
.gitea/workflows/sync-brain.yml  → sync second-brain
```

### Docker Stacks

```
stacks/autoheal/   → autoheal stack
stacks/guardrail/  → guardrail stack
gitea/             → Gitea self-hosted
```

---

## Repo 3: /srv/hermes-second-brain — Knowledge & Memory

### Structure

```
second-brain/
├── apps/
│   ├── api/           → FastAPI app (router_memory.py, router_tasks.py)
│   └── cli/           → CLI commands (memory_commands.py, task_commands.py)
├── libs/
│   └── memory/        → manager.py, config.py
├── services/
│   └── qdrant/        → Qdrant integration
├── skills/
│   ├── librarian/     → SKILL.md
│   └── memory-archivist/ → SKILL.md
├── docs/
│   ├── AUDITS/         → audit docs
│   └── *.md
├── SPECs/             → SPEC documents
├── project-summaries/
│   └── hvac-rag/     → HVAC RAG project summaries
├── docker-compose.yml  → FastAPI + Qdrant
├── pipeline.json       → pipeline config
├── SOUL.md           → agent soul
└── CLAUDE.md         → Claude instructions
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| API | FastAPI + Pydantic |
| Memory | Mem0 (Qdrant-backed) |
| Vector DB | Qdrant (collections: hermes-knowledge, will, skills, hvac_manuals_v1) |
| Skills | librarian, memory-archivist |
| Pipeline | JSON-driven pipeline executor |

### Skills (2)

```
librarian/         → organize and manage knowledge
memory-archivist/  → memory management for agents
```

### Collections (Qdrant)

```
hermes-knowledge:  17 points   ✓ Zero CJK
skills:          115 points   ✓ Zero CJK (enriched with semantic tags)
hvac_manuals_v1: 442 points   ✓ Zero CJK
mem0:             26 points   ✓ Zero CJK
will:               0 points  (zombie — delete)
mem0migrations:     0 points  (zombie — delete)
```

---

## Cross-Repo Dependencies

```
second-brain
    ├── libs/memory/manager.py → Qdrant
    └── apps/api/router_memory.py → Qdrant

ops
    ├── scripts/keep-qwen-warm.sh → Ollama (:11434)
    ├── scripts/hermes-*.sh → ~/.hermes/ (symlink to monorepo)
    └── stacks/guardrail/guardrail.py → LiteLLM (:4018)

monorepo
    ├── apps/api → Postgres + Redis + Qdrant
    ├── hermes → /home/will/.hermes (symlink)
    ├── hermes-second-brain → /srv/hermes-second-brain (symlink)
    └── ops → /srv/ops (symlink)
```

---

## Ports Reference

| Port | Service |
|------|---------|
| 11434 | Ollama (LLM inference) |
| 4018 | LiteLLM proxy |
| 3300 | Gitea |
| 8000 | Coolify |
| 5432 | PostgreSQL (CRM) |
| 6379 | Redis (CRM) |
| 6333 | Qdrant |
| 8204 | Whisper STT (faster-whisper-server) |
| 8013 | Edge TTS (tts-edge.sh) |

---

## Recommendations

1. **Delete zombie Qdrant collections:** `will`, `mem0migrations` — 0 points, wasting resources
2. **Document ops/scripts/README:** 15+ scripts sem documentação centralizada
3. **Second-brain venv cleanup:** `venv/` no second-brain está em `/srv/` — verificar se necessário ou se pode usar venv do sistema
4. **CRM-REFRIMIX legibility:** Legado em `apps/CRM-REFRIMIX` — clarify se é archived ou active
5. **Gitea runner standalone:** `docker-compose.gitea-runner.yml` isolado — integrar ao ops stack ou documentar propósito
