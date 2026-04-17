---
name: SPEC-034
description: MiniMax LLM use cases for monorepo agent enhancement — 14-domain research synthesis
type: spec
status: DRAFT
priority: high
author: will + 14 MiniMax research agents
date: 2026-04-12
specRef: SPEC-024, SPEC-030
---

> ⚠️ **Draft** — Pending review and integration into AGENTS.md

# SPEC-034: MiniMax LLM Use Cases — Monorepo Agent Enhancement

**Data:** 12/04/2026
**Pesquisa:** 14 agents parallel MiniMax research (7 completaram, 7 x 529 API overload)
**Modelo:** MiniMax M2.7 (1M token context window — 1,048,576 tokens)

---

## Research Synthesis

### Agents Completados (7/14)

| Agent    | Domain                        | Status |
| -------- | ----------------------------- | ------ |
| AGENT-1  | Code Generation & Refactoring | ✅     |
| AGENT-2  | Automated Testing             | ❌ 529 |
| AGENT-3  | Security Auditing             | ✅     |
| AGENT-4  | Documentation Generation      | ✅     |
| AGENT-5  | Performance Optimization      | ❌ 529 |
| AGENT-6  | Bug Investigation             | ✅     |
| AGENT-7  | Architecture & System Design  | ❌ 529 |
| AGENT-8  | Frontend Development          | ❌ 529 |
| AGENT-9  | Backend/API Development       | ✅     |
| AGENT-10 | DevOps & Infrastructure       | ✅     |
| AGENT-11 | Code Review Quality           | ✅     |
| AGENT-12 | Onboarding & Knowledge        | ❌ 529 |
| AGENT-13 | Multi-Agent Orchestration     | ❌ 529 |
| AGENT-14 | Monitoring & Observability    | ❌ 529 |

---

## Canonical MiniMax Use Cases

### 1. Code Generation — `/codegen` (AGENT-1)

**MiniMax Strengths:**

- CRUD router generation from Zod schemas — elimina 30min boilerplate → 5min review
- tRPC router composition (21 routers + protectedProcedure pattern)
- OrchidORM query builder patterns (`.whereSql()`, `.order()`, `.limit()`)
- Refactoring: TRPCError missing, missing `db.$transaction`, `select("*")` → explicit

**Slash Command:** `/codegen <module-name>` ou `/scaffold-trpc <entity>`

**Fluxo:**

```
Dev define Zod schema → /codegen contract → MiniMax gera:
  - apps/api/src/modules/contracts/contracts.trpc.ts (CRUD completo)
  - apps/api/src/modules/contracts/contracts.table.ts (OrchidORM)
  - Atualiza routers/trpc.router.ts (import + registro)
  - Atualiza packages/zod-schemas/src/index.ts (export)
```

**Impacto:** 25+ módulos existentes com Zod schemas sem router completo.

---

### 2. Security Auditing — `/msec` (AGENT-3)

**MiniMax Strengths:**

- Semantic secret detection (não só regex — detecta `os.getenv("SECRET")` vs Infisical SDK)
- OWASP Top 10 reasoning (A01 Broken Access Control em `protectedProcedure`, A03 SQLi em `webhookProcessor`, A10 SSRF)
- Auth flow tracing (`logout` sem session verification, role-based access gaps)
- PT-BR native em logs do homelab

**Slash Command:** `/msec` (security audit pre-commit gate)

**Fluxo:**

```
git commit → /msec → MiniMax analyzes diff
  ├── Secret found → BLOCK + "Remove before push"
  ├── Infisical SDK violation → BLOCK + "Use Infisical SDK pattern"
  ├── OWASP A01 (Broken Access Control) → WARN + specific router line
  ├── SQLi safe (parameterized) → PASS
  └── SSRF in webhook processor → CRITICAL + fix suggestion
```

**Complementa:** `/se` (regex-based) + `/sec` (OWASP deep-dive)

---

### 3. Documentation Generation — `/dm` (AGENT-4)

**MiniMax Strengths:**

- tRPC procedure → markdown table (21 routers → API reference em PT-BR)
- Infrastructure drift detection (`ss -tlnp` vs PORTS.md, `curl` vs SUBDOMAINS.md)
- SPEC auto-population (Decisions Log + Dependencies de código real)
- TSDoc inline generation para functions sem documentação

**Slash Commands:**

```
/dm api-ref     # Parse tRPC routers → docs/REFERENCE/TRPC-API.md
/dm ports       # ss -tlnp vs PORTS.md diff → report drift
/dm subdomains  # curl health vs SUBDOMAINS.md → report DOWN/UP
/dm spec-fill   # Read SPEC-*.md + implementation → populate Decisions Log
/dm tsdoc       # Scan modules/ for undocumented functions → emit TSDoc comments
```

**Cron:**

```
| doc-sync-daily | 0 7 * * * | MiniMax: ports + subdomains health → update SERVICE_STATE.md |
```

---

### 4. Bug Investigation — `/bug-triage` (AGENT-6)

**MiniMax Strengths:**

- 200k+ token context — ingere Docker crash dumps inteiros sem chunking
- PT-BR native reasoning em logs do homelab (smoke-tunnel.sh, Gotify alerts)
- Long-horizon multi-step debugging (cloudflared → Docker → Postgres → tRPC → React)
- 529 pattern recognition — correlaciona API overload entre serviços
- Structured JSON output para log analysis pipelines

**Slash Command:** `/bug-triage`

**Fluxo:**

```
docker ps mostra loki Exit(1) → /bug-triage → gathers:
  - docker logs loki --tail 1000
  - docker inspect loki (exit code, restart count)
  - df -h (disk pressure)
  - zpool status tank (ZFS health)
→ MiniMax retorna:
  { root_cause: "loki compact failed: disk 95%", confidence: 0.92,
    next_step: "prune loki wal files", prevention: "add disk >80% alert" }
```

**Integrado com:** `/bug` skill existente (invoca MiniMax como sub-agent para Docker/tunnel/529 errors)

---

### 5. Backend/API Development — `/bcaffold` (AGENT-9)

**MiniMax Strengths:**

- Fastify plugin scaffold de Zod schemas (elimina ~80 linhas boilerplate por módulo)
- tRPC router composition (22 routers + 4 middlewares pattern)
- OrchidORM schema analysis + migration scripts (`yarn db g <name>`)
- Middleware chain synthesis (6-chain: apiKeyAuth → corsValidation → whitelistCheck → rateLimit → subscriptionCheck → requestLogger)
- OpenAPI bridge via FastifyZodOpenApiTypeProvider

**Slash Commands:**

```
/bcaffold <entity-name> <zod-schema-path>  # Plugin Fastify + tRPC router
/migrate <entity-name>                     # OrchidORM migration + rollback
/trpc <router-name>                        # Adiciona router tRPC ao monorepo
```

**Fluxo:**

```
Dev define Zod schema → /bcaffold contract → MiniMax gera:
  - modules/contracts/tables/contract.table.ts (OrchidORM)
  - modules/contracts/contracts.trpc.ts (tRPC router + procedures)
  - modules/api-gateway/handlers/contract.handler.ts (Fastify REST)
  - routers/trpc.router.ts (compositional update)
  - docs/SPECS/SPEC-<N>-contract.md (auto-generated spec)
  - smoke-tests/smoke-contract.sh
```

---

### 6. DevOps & Infrastructure — `/infra-gen` (AGENT-10)

**MiniMax Strengths:**

- YAML/Terraform generation (formata exatamente como monorepo usa: `map(object({...}))`)
- Long-context infra reasoning (1M — lê PORTS.md + SUBDOMAINS.md + variables.tf antes de gerar)
- Docker Compose + healthchecks + networks + volumes
- Prometheus alert rules (loki, cadvisor, node-exporter patterns de SPEC-023)
- Gitea Actions workflow generation

**Slash Commands:**

```
/infra-gen docker-compose [service]   # docker-compose.yml com healthchecks
/infra-gen terraform subdomain [subdomain] [ip:port]  # Terraform blocks
/infra-gen prometheus alerts [service]  # Alert rules
/infra-gen gitea workflow [name] [triggers]  # .gitea/workflows/NAME.yml
```

**Fluxo:**

```
/infra-gen terraform subdomain chat http://10.0.5.2:8080
→ MiniMax lê variables.tf + access.tf + PORTS.md + SUBDOMAINS.md
→ Output: updated variables.tf services block + access.tf policy
→ Human approval → commit
→ smoke-tunnel.sh post-deploy validation
```

---

### 7. Code Review Quality — `/mxr` (AGENT-11)

**MiniMax Strengths:**

- 1M token context — analiza PRs inteiros (30+ files) + SPECs + review history
- TypeScript deep analysis (inverted generics, `infer` misuse, non-exhaustive discriminated unions, type drift)
- PR description generation (conventional commits format + breaking changes + smoke tests)
- Review history tracking (SQLite `reviews/review-log.jsonl` — recurring issues)
- Governance rule enforcement (Infisical SDK, immutable services)

**Slash Command:** `/mxr` ou `/minimax-review [PR_NUMBER|--commit HASH]`

**Fluxo:**

```
PR open → code-review.yml triggered
  → MiniMax review-minimax (long context)
  → Ingest: 20 files diff + SPECs linked + review-log.jsonl
  → Output: REVIEW-NNN.md (5 axes + governance)
           + PR description draft (conventional commits)
  → Flag: "zod-schemas v12 breaking change propagates to 3 procedures"
  → Human reviewer: 80% of manual archaeology eliminated
```

**Complementa:** `/review` (per-file) + `/sec` (security parallel)

---

## New Skills — Summary

| Skill                    | Trigger            | Purpose                                                |
| ------------------------ | ------------------ | ------------------------------------------------------ |
| `minimax-code-gen`       | `/codegen`         | tRPC router generation from Zod schemas                |
| `minimax-refactor`       | `/refactor-module` | Assisted refactoring for module code smells            |
| `minimax-security-audit` | `/msec`            | OWASP + secrets + Infisical SDK enforcement            |
| `doc-maintenance`        | `/dm`              | Documentation sync (API ref, PORTS, SUBDOMAINS, TSDoc) |
| `minimax-debugger`       | `/bug-triage`      | Docker crash + tunnel + 529 triage                     |
| `backend-scaffold`       | `/bcaffold`        | Fastify + tRPC from Zod schema                         |
| `db-migration`           | `/migrate`         | OrchidORM migration + rollback                         |
| `trpc-compose`           | `/trpc`            | Add new tRPC router to monorepo                        |
| `infra-from-spec`        | `/infra-gen`       | Infrastructure from natural language                   |
| `review-minimax`         | `/mxr`             | Holistic PR review with long context                   |

---

## Cron Jobs Propostos

| Job                        | Cron        | Função                                                              |
| -------------------------- | ----------- | ------------------------------------------------------------------- |
| `minimax-bug-triage-daily` | `0 9 * * *` | MiniMax: health-check.log → proactive anomaly report                |
| `minimax-doc-sync-daily`   | `0 7 * * *` | MiniMax: PORTS.md + SUBDOMAINS.md vs live system → SERVICE_STATE.md |

---

## PT-BR Synthesis

MiniMax M2.7 com 1M tokens é o modelo ideal para este monorepo por 3 razões:

1. **Contexto longo** — elimina chunking manual em logs, PRs, e specs
2. **Custo baixo para automação** — viabiliza cron jobs de triage e documentação (Claude seria proibitivo)
3. **PT-BR nativo** — raciocina em português nos logs do homelab com mais precisão

As 10 skills acima cobrem os maiores pontos de atrito do desenvolvimento: boilerplate, bugs crónicos (tunnel DOWN, 529, crash loops), documentation drift, e code review fragmentado.

---

## Dependências

- MiniMax API key (Infisical: `MINIMAX_API_KEY`)
- MiniMax endpoint: `https://api.minimax.io/anthropic/v1`
- Rate limiting: respeitar limites por tier

---

## Acceptance Criteria

| #    | Criterion                                                 | Test                                               |
| ---- | --------------------------------------------------------- | -------------------------------------------------- |
| AC-1 | `/codegen` gera router tRPC completo de Zod schema        | Criar schema dummy + invocar + verificar output    |
| AC-2 | `/msec` detecta os.getenv vs Infisical SDK                | Testar com diff contendo `process.env.SECRET`      |
| AC-3 | `/dm ports` detecta drift em PORTS.md                     | Adicionar porta falsa + invocar + verificar report |
| AC-4 | `/bug-triage` diagnostica loki crash                      | Feed docker logs + verificar root_cause JSON       |
| AC-5 | `/mxr` analiza PR de 10+ files sem chunking               | Criar PR + invocar + verificar full diff coverage  |
| AC-6 | `/infra-gen terraform subdomain` gera variables.tf válido | Invocar + verificar Terraform syntax               |

---

## Files to Create/Modify

| File                                             | Action                                               |
| ------------------------------------------------ | ---------------------------------------------------- |
| `AGENTS.md`                                      | Adicionar 10 skills + 7 slash commands + 2 cron jobs |
| `.claude/skills/minimax-code-gen/SKILL.md`       | Criar                                                |
| `.claude/skills/minimax-security-audit/SKILL.md` | Criar                                                |
| `.claude/skills/doc-maintenance/SKILL.md`        | Criar                                                |
| `.claude/skills/minimax-debugger/SKILL.md`       | Criar                                                |
| `.claude/skills/backend-scaffold/SKILL.md`       | Criar                                                |
| `.claude/skills/infra-from-spec/SKILL.md`        | Criar                                                |
| `.claude/skills/review-minimax/SKILL.md`         | Criar                                                |
| `.claude/commands/codegen.md`                    | Criar                                                |
| `.claude/commands/msec.md`                       | Criar                                                |
| `.claude/commands/dm.md`                         | Criar                                                |
| `.claude/commands/bug-triage.md`                 | Criar                                                |
| `.claude/commands/bcaffold.md`                   | Criar                                                |
| `.claude/commands/infra-gen.md`                  | Criar                                                |
| `.claude/commands/mxr.md`                        | Criar                                                |

---

**Last updated:** 2026-04-12
**Research:** 14 parallel agents (7 completed, 7 x 529 API overload)
**Author:** will + brainstorm dev pro persona + MiniMax research
