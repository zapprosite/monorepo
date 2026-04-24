# AGENTS.md — Monorepo Command Center

> **Data:** 2026-04-17 (Enterprise Refactor)
> **Authority:** Claude Code CLI + Gitea Actions + Antigravity Kit (.agent/)
> **Stack:** pnpm workspaces + Turbo pipeline + Biome lint

---

## 3-Phase Orchestrator v3 (/execute) — SPEC-090 [DRAFT - not implemented]

Pipeline de 3 fases com dependências reais. Sem fake parallelism.

### Fluxo

```
/execute "descrição"
  → /spec "descrição"           # Cria SPEC.md
  → /pg                         # Gera pipeline.json
  → run-pipeline.sh             # Executa 3 fases com gates
  → SHIPPER cria PR ou ISSUE    # No Gitea
```

### Arquitetura de 3 Fases

```
FASE 1 ─────────────────────────────────────────────────────────
  [SPEC-ANALYZER] ←→ [ARCHITECT]
        ↓                 ↓
     (parallel)       (parallel)
        └──────┬──────────┘
               ↓
FASE 2 ─────────────────────────────────────────────────────────
         [CODER-1]  ←→  [CODER-2]
         (parallel)      (parallel)
               ↓
FASE 3 ─────────────────────────────────────────────────────────
  [TESTER] → [DOCS] → [SMOKE] → [REVIEWER]
       ↓        ↓         ↓          ↓
       └────────┴─────────┴──────────┘
                    ↓
              [SHIPPER]
```

### As 7 Agentes

| Agente         | Fase | Tipo   | Responsabilidade                    |
| -------------- | ---- | ------ | ----------------------------------- |
| SPEC-ANALYZER  | 1    | claude | Analisa SPEC, extrai AC e filedeltas |
| ARCHITECT      | 1    | claude | Revê arquitetura e flags issues     |
| CODER-1        | 2    | claude | Backend (Fastify/tRPC)              |
| CODER-2        | 2    | claude | Frontend (React/MUI)                |
| TESTER         | 3    | claude | Escreve testes                      |
| DOCS           | 3    | claude | Atualiza documentação               |
| SMOKE          | 3    | claude | Gera smoke tests                    |
| REVIEWER       | 3    | claude | Code review final                   |
| SHIPPER        | -    | claude | Cria PR ou ISSUE no Gitea           |

**Agentes eliminados (inline now):** TYPES, LINT, SECRETS, GIT

### Gate entre Fases

| Fase | Gate | Ação se Falhar |
| ---- | ---- | -------------- |
| 1    | SPEC-ANALYZER + ARCHITECT completam | BLOCK — rollback + exit 1 |
| 2    | CODER-1 + CODER-2 completam (exit 0) | BLOCK — rollback + issue Gitea |
| 3    | REVIEWER completa | SHIPPER cria PR ou ISSUE |

### Error Handling

| Cenario                          | Ação                              |
| -------------------------------- | --------------------------------- |
| SPEC-ANALYZER falha              | BLOCK — rollback + exit 1        |
| ARCHITECT falha                  | BLOCK — rollback + exit 1        |
| CODER-1 OU CODER-2 falha         | BLOCK — rollback + issue Gitea   |
| TESTER falha                     | WARN + proceed                   |
| DOCS falha                       | WARN + proceed                   |
| SMOKE falha                      | WARN + proceed                   |
| REVIEWER falha                   | WARN + proceed                   |
| SHIPPER falha                    | ISSUE manual                     |

### Agent State File

```json
{
  "agent": "CODER-1",
  "spec": "SPEC-042",
  "status": "running|completed|failed",
  "started": "ISO timestamp",
  "finished": "ISO timestamp",
  "exit_code": 0,
  "log": ".claude/skills/orchestrator/logs/CODER-1.log"
}
```

### Coordenação via Filesystem

- **Agent states**: `tasks/agent-states/{AGENT}.json`
- **Logs**: `.claude/skills/orchestrator/logs/{AGENT}.log`
- **Pipeline**: `tasks/pipeline.json`
- **Snapshots**: `tasks/snapshots.log`

### Scripts (SPEC-090)

**Core orchestration:**
- `orchestrator/scripts/run-pipeline.sh` — Script principal (3 fases)
- `orchestrator/scripts/wait-for-phase.sh` — Poll até fase completar
- `orchestrator/scripts/check-gate.sh` — Verifica se gate foi satisfeito
- `orchestrator/scripts/ship.sh` — Cria PR ou ISSUE no Gitea

**Rollback Engine:**
- `orchestrator/scripts/snapshot.sh` — ZFS snapshot antes de cada fase
- `orchestrator/scripts/rollback.sh` — Restore from snapshot

**V1 — Version Lock:**
- `orchestrator/scripts/versions-check.sh` — Deteta drift de versões pinned
- `orchestrator/scripts/versions-update.sh` — Sincroniza versões

**V2 — Orchestrator v2 (Legacy):**
- `orchestrator/scripts/circuit_breaker.sh` — 3 retries, exp backoff 2^n
- `orchestrator/scripts/reentrancy_lock.sh` — PID lock por pipeline
- `orchestrator/scripts/dead_letter.sh` — DLQ after 3 failures

**V3 — Observability:**
- `orchestrator/scripts/trace_id.sh` — UUID por pipeline
- `orchestrator/scripts/metrics_collector.sh` — Prometheus exporter

**V5 — Capacity Planner:**
- `orchestrator/scripts/capacity_calculator.sh` — Calcula RAM/CPU disponíveis
- `orchestrator/scripts/auto_throttle.sh` — Auto-throttle parallelism

**V6 — Cost Engine:**
- `orchestrator/scripts/track_cost.sh` — Regista custo LLM por pipeline
- `orchestrator/scripts/model_fallback.sh` — Modelo fallback quando budget exceeded

**V7 — Runbooks:**
- `docs/OPS/RUNBOOKS/` — P1-SERVICE-DOWN, P2-SERVICE-DEGRADED, P3-NON-CRITICAL, P4-INFORMATIONAL, ORCHESTRATOR-FAILURE, PIPELINE-ROLLBACK

**Docs ops:**
- `docs/OPS/CAPACITY.md` — Capacity planner usage
- `docs/OPS/COST-CONTROL.md` — Cost engine usage

### Custo por Pipeline

| Versão | Agentes | Custo estimado |
| ------ | -------- | ------------- |
| v1 (14 agentes) | 14 simultâneos | ~$2-3 |
| v3 (3 fases) | 2-4 simultâneos | ~$0.50 |

---

## Hermes Gateway (SPEC-093)

**Canonical SPEC:** `docs/SPECS/SPEC-093-homelab-intelligence-architecture.md`

### Hermes Gateway — Python/systemd (bare-metal)

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                        HERMES GATEWAY (bare-metal)                            ║
║                        Porta :8642 — @CEO_REFRIMIX_bot                        ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                               ║
║  USER (Telegram) ──polled by──→ Hermes Gateway :8642                       ║
║                                        │                                      ║
║                               LLM (via LiteLLM :4000)                        ║
║                                        │                                      ║
║                        Qdrant (:6333) + Redis (:6379)                        ║
║                                        │                                      ║
║                               Edge TTS (voice output)                         ║
║                                        │                                      ║
║                                     RESPONSE                                  ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

### Stack

| Component | Host | Porta | Purpose |
| --------- | ---- | ----- | ------- |
| Hermes Gateway | bare-metal | :8642 | Telegram polling @CEO_REFRIMIX_bot |
| LiteLLM | Docker | :4000 | LLM proxy + rate limiting |
| Qdrant | Coolify | :6333 | Vector storage |
| Redis | Docker | :6379 | Caching + state |
| Edge TTS | bare-metal | — | Voice synthesis |

### Deployment

- **Runtime:** Python 3.x
- **Manager:** systemd (service: hermes-gateway)
- **Polling:** Self-polling via Telegram Bot API
- **Location:** `/srv/hermes-gateway/`

---

## Skill-that-Calls-Skills (Meta-Skills)

### Examples

- `/execute` → invoca `/spec` → `/pg` → 3 fases
- `/ship` → invoca sync → commit → push → PR

### Skill Metadata (SKILL.md)

```yaml
---
name: orchestrator
type: meta-skill
trigger: /execute
skills_called:
  - /spec
  - /pg
  - run-agents
deprecated: false
---
```

---

## Network & Port Governance (OBRIGATÓRIO)

> **SPEC-050 (2026-04-15):** UFW + Traefik consolidated rules. Ler antes de qualquer porta ou subdomínio.

### Stack de Rede Completo

```
INTERNET → Cloudflare → cloudflared → TRAEFIK (80/443/8080) → UFW → SERVICES
```

### Antes de qualquer porta ou subdomínio:

1. Ler `/srv/monorepo/docs/INFRASTRUCTURE/PORTS.md`
2. Ler `/srv/monorepo/docs/INFRASTRUCTURE/SUBDOMAINS.md`
3. Verificar com `ss -tlnp | grep :PORTA`
4. Atualizar ambos os docs se adicionar porta/subdomínio

### UFW (Host Firewall)

- UFW ativo com `default INPUT DROP`
- Portas autorizadas: 22, 80, 443, 8080 (Cloudflare), 8000 (Coolify via Cloudflare)
- Nunca abrir 2222 (Gitea SSH) sem approval

### Traefik (Coolify Proxy)

- Todas as entradas passam por Traefik (Coolify Proxy) nas portas 80/443/8080
- Regras de ingress via Cloudflare Zero Trust Tunnel
- Nunca fazer port forwarding direto bypassing Traefik

### Portas Reservadas (Nunca usar)

- :3000 → Open WebUI proxy (RESERVED)
- :4000 → LiteLLM production (RESERVED)
- :4001 → Hermes Agent Bot (RESERVED)
- :4002 → ai-gateway OpenAI compat (RESERVED — SPEC-047)
- :8000 → Coolify PaaS (RESERVED)
- :8080 → Open WebUI (Coolify managed) (RESERVED)
- :8642 → Hermes Gateway (RESERVED)
- :6333 → Qdrant (RESERVED)

### Portas Livres para Dev

- Faixa :4002–:4099 (microserviços)
- :5173 (Vite frontend)

### Adicionar Porta

1. `ss -tlnp | grep :PORTA` — confirmar livre
2. Adicionar a PORTS.md (Service, Host, Port, Purpose)
3. Se pública: adicionar a SUBDOMAINS.md + Terraform + cloudflared restart
4. Se firewall: `sudo ufw allow PORT/tcp`

### Adicionar Subdomínio

1. Verificar se porta já está em PORTS.md
2. Adicionar entrada em SUBDOMAINS.md
3. `cd /srv/ops/terraform/cloudflare && terraform apply`
4. Verificar cloudflared logs após restart

### O que NÃO fazer

- ❌ Bypassar Traefik fazendo port forwarding direto
- ❌ Abrir portas sem verificar PORTS.md primeiro
- ❌ Adicionar subdomínio sem Terraform + cloudflared restart
- ❌ Desativar UFW ou fazer `ufw disable`
- ❌ Usar portas reservadas para dev
- ❌ Commit changes sem atualizar PORTS.md + SUBDOMAINS.md

---

## ⚠️ REGRA ANTI-HARDCODED — OBRIGATÓRIA (atualizado 2026-04-15)

**Nenhuma URL, porta, token, API key ou model name pode ser hardcoded no código.**

```ts
// ✅ CORRECTO — sempre via process.env
const STT_URL = process.env.STT_DIRECT_URL ?? 'http://localhost:8202';
const GW_KEY = process.env.AI_GATEWAY_FACADE_KEY ?? '';

// ❌ PROIBIDO — hardcoded
const STT_URL = 'http://localhost:8202';
const API_KEY = 'sk-abc123...';
```

**Fonte canónica:** `/srv/monorepo/.env` ( está PRUNED desde 2026-04-13)
**Regras completas:** `.claude/rules/anti-hardcoded-env.md` + `.claude/rules/anti-hardcoded-secrets.md`

---

## IMPORTANT — FOR INFRASTRUCTURE ARCHITECTURE

**For infrastructure architecture, see [docs/ARCHITECTURE-OVERVIEW.md](docs/ARCHITECTURE-OVERVIEW.md)**

This document covers the complete infrastructure stack: Coolify, Ollama, Hermes Agent, Qdrant, LiteLLM, and how services connect.

---

## OBRIGATORIO PARA TODOS OS LLMs — LEIA PRIMEIRO

Antes de qualquer acao neste repositorio, TODO LLM **DEVE** ler:

| Documento                                                                                                  | Porquê                                                                                                 | Prioridade |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------- |
| **[docs/GOVERNANCE/SECRETS-MANDATE.md](../../docs/GOVERNANCE/SECRETS-MANDATE.md)**                         | **Zero tolerance** — `.env` only. Tokens hardcoded = rejeicao imediata. Alucinacao de tokens = banido. | CRITICO    |
| **[docs/GOVERNANCE/GUARDRAILS.md](../../docs/GOVERNANCE/GUARDRAILS.md)**                                   | Operacoes proibidas, anti-fragilidade, voice pipeline imutavel                                         | CRITICO    |
| **[docs/GOVERNANCE/APPROVAL_MATRIX.md](../../docs/GOVERNANCE/APPROVAL_MATRIX.md)**                         | "Posso fazer isto?" — tabela de aprovacoes por operacao                                                | CRITICO    |
| **[docs/GOVERNANCE/CHANGE_POLICY.md](../../docs/GOVERNANCE/CHANGE_POLICY.md)**                             | Snapshot antes de mudancas + checklist preflight                                                       | ALTA       |
| **[docs/GOVERNANCE/IMMUTABLE-SERVICES.md](../../docs/GOVERNANCE/IMMUTABLE-SERVICES.md)**                   | Servicos que nunca se tocam (coolify-proxy, prometheus, cloudflared...)                                | CRITICO    |
| **[docs/GOVERNANCE/PINNED-SERVICES.md](../../docs/GOVERNANCE/PINNED-SERVICES.md)**                         | Voice stack: Hermes Agent (gateway:8642, mcp:8092)                                                     | CRITICO    |
| **[docs/GOVERNANCE/DUPLICATE-SERVICES-RULE.md](../../docs/GOVERNANCE/DUPLICATE-SERVICES-RULE.md)**         | Port registry, auto-heal whitelist — portas reservadas                                                 | ALTA       |
| **[docs/GOVERNANCE/INCIDENTS.md](../../docs/GOVERNANCE/INCIDENTS.md)**                                     | Severity levels, incident response checklist                                                           | CRITICO    |
| **[docs/GOVERNANCE/RECOVERY.md](../../docs/GOVERNANCE/RECOVERY.md)**                                       | ZFS rollback/DB restore step-by-step                                                                   | CRITICO    |
| **[docs/GOVERNANCE/ANTI-FRAGILITY.md](../../docs/GOVERNANCE/ANTI-FRAGILITY.md)**                           | O que NAO fazer — antipatterns, servicos pinned                                                        | CRITICO    |
| **[docs/GOVERNANCE/CONTRACT.md](../../docs/GOVERNANCE/CONTRACT.md)**                                       | Principios inegociaveis (dados sacrossantos, snapshot mandatory)                                       | ALTA       |
| **[docs/SPECS/SPEC-HERMES-INTEGRATION.md](../../docs/SPECS/SPEC-HERMES-INTEGRATION.md)**                   | Hermes Agent integration patterns, API usage, Telegram voice pipeline                                  | CRITICO    |
| **[docs/GOVERNANCE/MASTER-PASSWORD-PROCEDURE.md](../../docs/GOVERNANCE/MASTER-PASSWORD-PROCEDURE.md)**     | Credential handling procedure                                                                          | ALTA       |
| **[docs/GOVERNANCE/DATABASE_GOVERNANCE.md](../../docs/GOVERNANCE/DATABASE_GOVERNANCE.md)**                 | Protected schemas, destructive-operation rules                                                         | ALTA       |
| **[docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md](../../docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md)** | Anti-patterns AP-1 a AP-4 (Docker TCP, host-as-backend, DNS)                                           | CRITICO    |
| **[docs/GUIDES/CODE-REVIEW-GUIDE.md](../../docs/GUIDES/CODE-REVIEW-GUIDE.md)**                             | 5-axis review framework                                                                                | ALTA       |
| **[docs/GOVERNANCE/SECRETS_POLICY.md](../../docs/GOVERNANCE/SECRETS_POLICY.md)**                           | Secrets policy complementar                                                                            | ALTA       |
| **[.claude/CLAUDE.md](../../.claude/CLAUDE.md)**                                                           | Regras Claude Code, git mirror, version lock                                                           | ALTA       |
| **[.claude/rules/anti-hardcoded-secrets.md](../../.claude/rules/anti-hardcoded-secrets.md)**               | Anti-hardcoded secrets pattern                                                                         | CRITICO    |

### TL;DR (para LLMs com pressa)

```
SECRETS → .env como fonte canonica
Immutable/Pinned Services → NUNCA tocar
Voice Pipeline (Hermes) → gateway :8642 | mcp :8092 | Telegram polling
Anti-patterns (AP-1/2/3) → Docker TCP bridge, host-as-backend, localhost testing
Nao sabe? → PERGUNTE ANTES DE FAZER
Hardcoded Values → USAR VARIAVEIS DE AMBIENTE — nunca hardcodar URLs, IPs, portas, tokens

ANTES DE QUALQUER ACAO: verificar .env → .claude/skills/ → AGENTS.md → .claude/CLAUDE.md
```

**Sem ler estes documentos, nao faca NADA.**

---

## IMPORTANT FOR ALL LLMs — READ FIRST

Before any work in this repository, EVERY LLM **MUST** read:

| Document                                                                                                   | Why                                                                                                   | Priority |
| ---------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| **[docs/GOVERNANCE/SECRETS-MANDATE.md](../../docs/GOVERNANCE/SECRETS-MANDATE.md)**                         | **Zero tolerance** — `.env` only. Hardcoded tokens = instant rejection. Token hallucination = banned. | CRITICAL |
| **[docs/GOVERNANCE/GUARDRAILS.md](../../docs/GOVERNANCE/GUARDRAILS.md)**                                   | Forbidden ops, anti-fragility, immutable voice pipeline                                               | CRITICAL |
| **[docs/GOVERNANCE/APPROVAL_MATRIX.md](../../docs/GOVERNANCE/APPROVAL_MATRIX.md)**                         | "Can I do this?" — approval table by operation type                                                   | CRITICAL |
| **[docs/GOVERNANCE/IMMUTABLE-SERVICES.md](../../docs/GOVERNANCE/IMMUTABLE-SERVICES.md)**                   | Services that are never touched (coolify-proxy, prometheus, cloudflared...)                           | CRITICAL |
| **[docs/GOVERNANCE/PINNED-SERVICES.md](../../docs/GOVERNANCE/PINNED-SERVICES.md)**                         | Voice stack: Hermes Agent (gateway:8642, mcp:8092)                                                    | CRITICAL |
| **[docs/GOVERNANCE/INCIDENTS.md](../../docs/GOVERNANCE/INCIDENTS.md)**                                     | Severity levels, incident response checklist                                                          | CRITICAL |
| **[docs/GOVERNANCE/RECOVERY.md](../../docs/GOVERNANCE/RECOVERY.md)**                                       | ZFS rollback/DB restore step-by-step                                                                  | CRITICAL |
| **[docs/GOVERNANCE/ANTI-FRAGILITY.md](../../docs/GOVERNANCE/ANTI-FRAGILITY.md)**                           | What NOT to do — antipatterns, pinned services                                                        | CRITICAL |
| **[docs/SPECS/SPEC-HERMES-INTEGRATION.md](../../docs/SPECS/SPEC-HERMES-INTEGRATION.md)**                   | Hermes Agent integration patterns, API usage, Telegram voice pipeline                                 | CRITICAL |
| **[docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md](../../docs/INCIDENTS/CONSOLIDATED-PREVENTION-PLAN.md)** | Anti-patterns AP-1 to AP-4 (Docker TCP, host-as-backend, DNS)                                         | CRITICAL |
| **[docs/GOVERNANCE/CHANGE_POLICY.md](../../docs/GOVERNANCE/CHANGE_POLICY.md)**                             | Snapshot before changes + preflight checklist                                                         | HIGH     |
| **[docs/GOVERNANCE/DUPLICATE-SERVICES-RULE.md](../../docs/GOVERNANCE/DUPLICATE-SERVICES-RULE.md)**         | Port registry, auto-heal whitelist, reserved ports                                                    | HIGH     |
| **[docs/GOVERNANCE/MASTER-PASSWORD-PROCEDURE.md](../../docs/GOVERNANCE/MASTER-PASSWORD-PROCEDURE.md)**     | Credential handling procedure                                                                         | HIGH     |
| **[docs/GOVERNANCE/DATABASE_GOVERNANCE.md](../../docs/GOVERNANCE/DATABASE_GOVERNANCE.md)**                 | Protected schemas, destructive-operation rules                                                        | HIGH     |
| **[docs/REFERENCE/ARCHITECTURE-MASTER.md](../../docs/REFERENCE/ARCHITECTURE-MASTER.md)**                   | Full monorepo structure, CI/CD, directory layout                                                      | HIGH     |
| **[docs/GUIDES/CODE-REVIEW-GUIDE.md](../../docs/GUIDES/CODE-REVIEW-GUIDE.md)**                             | 5-axis review framework                                                                               | HIGH     |
| **[docs/REFERENCE/TOOLCHAIN.md](../../docs/REFERENCE/TOOLCHAIN.md)**                                       | pnpm, turbo, biome, git, docker, zfs commands                                                         | HIGH     |
| **[.claude/CLAUDE.md](../../.claude/CLAUDE.md)**                                                           | Claude Code rules, git mirror, version lock                                                           | HIGH     |

### TL;DR (for LLMs in a hurry)

```
Secrets → .env como fonte canonica
Immutable/Pinned Services → NEVER touch
Voice Pipeline (Hermes) → gateway :8642 | mcp :8092 | Telegram polling
Anti-patterns (AP-1/2/3) → Docker TCP bridge, host-as-backend, localhost testing
Don't know? → ASK BEFORE DOING
Hardcoded Values → USE ENVIRONMENT VARIABLES — never hardcode URLs, IPs, ports, tokens
```

**Without reading these documents, do NOTHING.**

---

## Infraestrutura Atual (14/04/2026)

| Servico        | Onde              | Porta | Proposito                   |
| -------------- | ----------------- | ----- | --------------------------- |
| Coolify        | Ubuntu Desktop    | 8000  | Container management (PaaS) |
| Ollama         | Ubuntu Desktop    | 11434 | LLM inference (RTX 4090)    |
| Hermes Gateway | Ubuntu bare metal | 8642  | Agent brain + messaging     |
| Hermes MCP     | Ubuntu bare metal | 8092  | MCP proxy                   |
| Qdrant         | Coolify           | 6333  | Vector database (RAG)       |
| LiteLLM        | Docker Compose    | 4000  | LLM proxy + rate limiting   |
| Grafana        | Docker Compose    | 3100  | Metrics dashboards          |
| Loki           | Docker Compose    | 3101  | Log aggregation             |
| Prometheus     | Docker Compose    | 9090  | Metrics collection          |

Ver [docs/ARCHITECTURE-OVERVIEW.md](docs/ARCHITECTURE-OVERVIEW.md) para diagrama completo.

---

## Arquitectura Unified (09/04/2026)

```
+-------------------------------------------------------------+
|                    CLAUDE CODE CLI                          |
|  (Orchestrator principal — tokens infinitos, 20 agents)     |
+-------------------------------------------------------------+
|  .claude/commands/    .claude/skills/    .claude/workflows/|
|  > 33 slash commands  > 33 skills         > 7 workflows    |
+-------------------------------------------------------------+
|                    TURBO PIPELINE                          |
|  turbo.json defines build/lint/test pipeline              |
|  pnpm workspaces (apps/, packages/)                       |
+-------------------------------------------------------------+
|  .gitea/workflows/        .agent/                         |
|  > 4 Gitea Actions       > 18 specialist agents           |
|  > ci-feature            > 20 workflows (Antigravity Kit) |
|  > code-review                                           |
|  > deploy-main                                          |
|  > rollback                                              |
+-------------------------------------------------------------+
|  scripts/          smoke-tests/        docs/SPECS/         |
|  > health-check   > E2E (Playwright) > 15+ SPECs         |
|  > deploy         > smoke-hermes       > tasks.md          |
|  > backup          > +more                                  |
|  > restore                                                  |
|  > mirror-push                                         |
+-------------------------------------------------------------+
```

---

## Tool Stack (Raiz)

| Ficheiro              | Tool       | Uso                                       |
| --------------------- | ---------- | ----------------------------------------- | -------------------------------------------------------------------------------- |
| `turbo.json`          | Turbo      | Pipeline de build/test/lint               |
| `biome.json`          | Biome      | Lint + Format (substitui ESLint+Prettier) |
| `yarn.lock`           | Yarn Berry | Package manager c/ workspaces             | DEPRECATED — use pnpm. Todos os comandos de build usam pnpm (ver Build Commands) |
| `pnpm-workspace.yaml` | pnpm       | Workspace definition                      |
| `package.json`        | Node.js    | Scripts e dependencias                    |
| `docker-compose.yml`  | Docker     | Containers de desenvolvimento             |

---

## Apps & Packages

| App/Package                  | Tipo    | Stack                                    | Notas                             |
| ---------------------------- | ------- | ---------------------------------------- | --------------------------------- |
| `apps/list-web`              | Web     | Static HTML+JS                           | Google OAuth, tools list          |
| `apps/api`                   | API     | Fastify + OrchidORM + tRPC               | PostgreSQL                        |
| `apps/web`                   | Web     | React 19 + MUI + tRPC                    | —                                 |
| `apps/orchestrator`          | Agent   | Node.js + tRPC + YAML                    | Human gates                       |
| `apps/perplexity-agent`      | Agent   | Python + Streamlit + LangChain           | Browser automation                |
| `apps/todo-web`              | Web     | Static HTML+JS + Google OAuth 2.0 + PKCE | nginx:alpine, container: todo-web |
| `packages/ui-mui`            | UI Lib  | React + Material UI                      | → frontend                        |
| `packages/zod-schemas`       | Schemas | TypeScript + Zod                         | → backend, frontend, orchestrator |
| `packages/typescript-config` | Config  | TypeScript                               | Dev tooling                       |

---

## Onde Pedir Ajuda

| Servico                     | Onde                                     | Como                             |
| --------------------------- | ---------------------------------------- | -------------------------------- |
| **Secrets (.env)**          | `.env` como fonte canonica               | Nao usar  SDK em codigo |
| **Coolify (containers)**    | `coolify.zappro.site`                    | Ver skill `coolify-access`       |
| **Ollama (LLM local)**      | `localhost:11434`                        | Via LiteLLM `:4000`              |
| **Hermes Agent**            | `hermes.zappro.site` ou `localhost:8642` | Gateway API + Telegram           |
| **Qdrant (vectores)**       | Coolify, porta `6333`                    | RAG e embeddings                 |
| **LiteLLM (proxy)**         | `localhost:4000`                         | Multi-provider LLM proxy         |
| **Cloudflare (DNS/tunnel)** | `cloudflare.zappro.site`                 | Ver skill `cloudflare-terraform` |

---

## Criando Novos Subdominios + OAuth

### Quick Decision: Which Method?

| Situation                             | Method                      | Time    |
| ------------------------------------- | --------------------------- | ------- |
| MVP / quick test / prototyping        | Direct OAuth (no CF Access) | ~10 min |
| Production / team / security critical | CF Access Zero Trust        | ~20 min |
| Internal tool / single developer      | Direct OAuth                | ~10 min |
| Multi-user / company dashboard        | CF Access                   | ~20 min |

### Method 1: Direct OAuth (MVP Fast Path)

For quick prototyping — Google OAuth handled in the app JS, no Cloudflare Access.

#### Step 0: FIRST — Print OAuth URI for user (BEFORE writing any code)

```bash
echo "Add to Google Cloud Console → OAuth Client → Authorized Redirect URIs:"
echo "https://SUBDOMAIN.zappro.site/auth/callback"
echo ""
echo "Add to Authorized JavaScript Origins:"
echo "https://SUBDOMAIN.zappro.site"
```

#### Steps:

1. Print OAuth URIs → wait for user to configure Google Console
2. Create subdomain via Cloudflare API (fast, ~30s):
   ```bash
   /srv/ops/scripts/create-subdomain.sh SUBDOMAIN http://localhost:PORT
   ```
3. Generate app files (HTML + nginx + Dockerfile)
4. Deploy: `docker compose up -d`
5. Smoke test: `curl -sk https://SUBDOMAIN.zappro.site`
6. Update SUBDOMAINS.md + PORTS.md

#### Skills:

- `/new-subdomain` — create subdomain via Cloudflare API
- `/oauth-google-direct` — OAuth in app JS
- `/prd-to-deploy` — full orchestrator (one-shot)

### Method 2: CF Access Zero Trust (V2 Production)

Google OAuth handled by Cloudflare Edge — app receives pre-authenticated requests.

#### Step 0: FIRST — Print TWO URIs for user

```bash
echo "STEP 1 — Google Cloud Console:"
echo "  Redirect URI: https://TEAM_DOMAIN/cdn-cgi/access/callback"
echo ""
echo "STEP 2 — Cloudflare Zero Trust Dashboard:"
echo "  one.dash.cloudflare.com → Settings → Authentication → Add Google IdP"
```

#### Steps:

1. Print both URIs → wait for user to configure both
2. Create subdomain via Terraform (add to variables.tf → terraform apply)
3. Add CF Access application + policy to access.tf → terraform apply
4. Deploy app (no OAuth code needed!)
5. Test: request should require Google login

#### Skills:

- `/cloudflare-terraform` — Terraform-based subdomain + CF Access
- `/oauth-google-cloudflare` — CF Access setup guide

### Scripts Available

| Script                                 | Purpose                                    |
| -------------------------------------- | ------------------------------------------ |
| `/srv/ops/scripts/create-subdomain.sh` | Create subdomain via Cloudflare API (fast) |
| `/srv/ops/scripts/setup-oauth.sh`      | Print OAuth URIs + generate config         |

### One-Shot Flow: PRD → Deploy

```
Human: /prd-to-deploy "I want X app"
  → Step 0: Print OAuth URIs immediately
  → Generate SPEC
  → Create subdomain
  → ⏸️ Wait for user OAuth config
  → Generate files
  → Deploy + smoke test
  → Update docs
  → ✅ Done
```

See: `/prd-to-deploy` skill + SPEC-035-one-shot-prd-to-deploy.md

---

## Slash Commands (`.claude/commands/`)

| Comando        | Ficheiro          | Cadeia                                               | Uso                        |
| -------------- | ----------------- | ----------------------------------------------------- | -------------------------- |
| `/pg`          | `pg.md`           | SPEC → pipeline.json                                  | Gerar tasks de SPECs       |
| `/plan`        | `plan.md`         | SPEC → tasks                                          | Planear implementacao      |
| `/rr`          | `rr.md`           | Commits → REVIEW                                      | Code review report         |
| `/se`          | `se.md`           | Scan secrets                                          | Secrets audit              |
| `/sec`         | `sec.md`          | Security scan                                         | Auditoria OWASP            |
| `/feature`     | `feature.md`      | git-feature workflow                                  | Nova branch feature        |
| `/ship`        | `ship.md`         | Pre-launch checklist                                  | Deploy checklist           |
| `/turbo`       | `turbo.md`        | Commit+merge+tag+branch                               | Git turbo workflow         |
| `/code-review` | `code-review.md`  | Commits → 5-axis review                               | Full review                |
| `/scaffold`    | `scaffold.md`     | Template → novo modulo                                | Scaffold projeto           |
| `/img`         | `vision-local.md` | Ollama Qwen2.5-VL                                     | Analise de imagem          |
| `/codegen`     | `codegen.md`      | Zod schema → tRPC router                              | MiniMax code generation    |
| `/msec`        | `msec.md`         | Security audit pre-commit                             | MiniMax semantic security  |
| `/dm`          | `dm.md`           | API ref, PORTS, SUBDOMAINS                            | MiniMax doc maintenance    |
| `/bug-triage`  | `bug-triage.md`   | Docker crash, tunnel DOWN                             | MiniMax bug triage         |
| `/bcaffold`    | `bcaffold.md`     | Zod schema → Fastify+tRPC                             | MiniMax backend scaffold   |
| `/migrate`     | `migrate.md`      | OrchidORM migration                                   | MiniMax DB migration       |
| `/trpc`        | `trpc.md`         | Add tRPC router                                       | MiniMax router composition |
| `/infra-gen`   | `infra-gen.md`    | Docker/TF/Prometheus/Gitea                            | MiniMax infra generation   |
| `/mxr`         | `mxr.md`          | PR review long-context                                | MiniMax holistic review    |
| `/md`          | `md.md`           | Modo dormir: escaneia SPECs pendentes e gera pipeline | pasta: monorepo            |

---

## Skills (`.claude/skills/`)

**33 skills locais + 10 MiniMax-enhanced skills (SPEC-034)**:

| Skill                     | Proposito                               | Trigger             |
| ------------------------- | --------------------------------------- | ------------------- |
| `bug-investigation`       | Debug sistematico                       | `/bug`              |
| `test-generation`         | Gerar testes                            | `/test`             |
| `code-review`             | Review 5-axis                           | `/review`           |
| `refactoring`             | Cleanup code smells                     | `/refactor`         |
| `documentation`           | Gerar docs                              | `/docs`             |
| `security-audit`          | OWASP top 10                            | `/sec`              |
| `pipeline-gen`            | SPEC → pipeline.json                    | `/pg`               |
| `smoke-test-gen`          | SPEC → smoke tests                      | `/st`               |
| `secrets-audit`           | Scan hardcoded secrets                  | `/se`               |
| `human-gates`             | Identificar blockers                    | `/hg`               |
| `spec-driven-development` | Spec → plan → implement                 | `/spec`             |
| `context-prune`           | Limpar contexto                         | —                   |
| `deploy-validate`         | Pre-deploy check                        | —                   |
| `mcp-health`              | Health MCP servers                      | —                   |
| `repo-scan`               | Scan tasks pendentes                    | `/rs`               |
| `self-healing`            | Auto-heal loop                          | —                   |
| `snapshot-safe`           | ZFS safe operations                     | —                   |
| `cost-reducer`            | Optimizar custos                        | —                   |
| `browser-dev`             | Browser automation                      | —                   |
| `researcher`              | Web research (MiniMax M2.1)             | —                   |
| `minimax-research`        | Deep code/error analysis (MiniMax M2.1) | `/minimax-research` |
| `minimax-code-gen`        | tRPC router from Zod schema             | `/codegen`          |
| `minimax-security-audit`  | OWASP + secrets audit                   | `/msec`             |
| `doc-maintenance`         | Docs sync: API ref, PORTS, SUBDOMAINS   | `/dm`               |
| `minimax-debugger`        | Docker crash + tunnel + 529 triage      | `/bug-triage`       |
| `backend-scaffold`        | Fastify + tRPC from Zod schema          | `/bcaffold`         |
| `db-migration`            | OrchidORM migration + rollback          | `/migrate`          |
| `trpc-compose`            | Add new tRPC router                     | `/trpc`             |
| `infra-from-spec`         | Infrastructure from natural language    | `/infra-gen`        |
| `review-minimax`          | Holistic PR review (1M context)         | `/mxr`              |

---

## Scripts (`scripts/`)

| Script              | Funcao                           | CI/CD            |
| ------------------- | -------------------------------- | ---------------- |
| `health-check.sh`   | Docker, ZFS, disk, git           | Pre-deploy       |
| `deploy.sh`         | Validation + ZFS snapshot + push | Deploy main      |
| `backup.sh`         | Git bundle + 7-backup rotation   | Cron             |
| `restore.sh <name>` | Restore from named backup        | DR               |
| `mirror-push.sh`    | Push Gitea + GitHub              | Feature branches |
| `sync-env.js`       | .env → workspaces                | Pre-build        |

---

## Smoke Tests (`smoke-tests/`)

| Teste                           | Service               | Metodo                |
| ------------------------------- | --------------------- | --------------------- |
| `smoke-chat-zappro-site.sh`     | chat.zappro.site      | curl + redirect       |
| `smoke-chat-zappro-site-e2e.sh` | chat.zappro.site      | Playwright E2E OAuth  |
| `playwright-chat-e2e.mjs`       | chat.zappro.site      | Playwright full chain |
| `pipeline-hermes-voice.sh`      | Hermes voice pipeline | curl health           |

---

## Gitea Actions (`.gitea/workflows/`)

| Workflow                      | Trigger         | Chain                                               |
| ----------------------------- | --------------- | --------------------------------------------------- |
| `ci-feature.yml`              | Push branch     | lint → build → test                                 |
| `code-review.yml`             | PR              | 5 gates: lint + test + security + AI review + human |
| `deploy-main.yml`             | Merge main      | build → human gate → Coolify deploy                 |
| `rollback.yml`                | Manual dispatch | Coolify rollback + audit                            |
| `deploy-perplexity-agent.yml` | Push            | Coolify API deploy                                  |

---

## Antigravity Kit (`.agent/`)

18 agents especializados + 20 workflows, 10 skills:

### Agentes

`architect-specialist`, `backend-specialist`, `bug-fixer`, `code-reviewer`, `database-specialist`, `debugger`, `devops-specialist`, `documentation-writer`, `feature-developer`, `frontend-specialist`, `mobile-specialist`, `module-architect`, `orchestrator`, `performance-optimizer`, `refactoring-specialist`, `security-auditor`, `executive-ceo`, `context-optimizer`

### Workflows

`api-design`, `bug-investigation`, `code-review`, `commit-message`, `debug`, `documentation`, `feature-breakdown`, `git-feature`, `git-mirror-gitea-github`, `git-ship`, `git-turbo`, `pr-review`, `refactoring`, `security-audit`, `sincronizar-tudo`, `test-generation`, `ui-ux-p-max`, +more

### Integration

`.claude/` → `.agent/` (automatic search via `search.md` rules)
`.agent/rules/` → Included in context

---

## LLM Tiering — Canonical Stack (SPEC-053/SPEC-057)

| Tier          | Model                         | Provider                | Use Case                                |
| ------------- | ----------------------------- | ----------------------- | --------------------------------------- |
| **PRIMARY**   | `qwen2.5vl:7b`                | Ollama (:11434)         | Texto + Visão + Voice (RTX 4090)        |
| **FALLBACK**  | `llama3-portuguese-tomcat-8b` | Ollama (:11434)         | Texto fallback local                    |
| **EMERGENCY** | `MinIMax M2.7`                | API (`MINIMAX_API_KEY`) | Apenas quando Ollama offline (SPEC-053) |

**MinIMax skills** (`/codegen`, `/msec`, `/dm`, `/bug-triage`, `/mxr`) continuam ativos para code gen, security, docs e debugging. MinIMax NUNCA deve ser o primeiro choice — apenas quando Ollama falhar.

Ver [docs/ARCHITECTURE-OVERVIEW.md](docs/ARCHITECTURE-OVERVIEW.md) para stack completo.

---

## Spec-Driven Development

### Workflow

```
SPEC → pipeline.json → 14 agentes → PR
```

### Comandos

| Cmd        | Purpose                          |
| ---------- | -------------------------------- |
| `/spec`    | Create SPEC.md                   |
| `/pg`      | Generate pipeline.json           |
| `/execute` | Full: spec → pg → 14 agents → PR |

### Pipeline States

- `pending` → `in_progress` → `completed`
- `blocked` → waiting on dependencies

---

## Skills (`.claude/skills/`)

```
SPEC-TEMPLATE.md → SPEC-*.md → tasks.md → pipeline.json
                                        → smoke-tests/
                                        → REVIEW-*.md
```

| SPEC     | Topico                                       |
| -------- | -------------------------------------------- |
| SPEC-007 | Hermes OAuth profiles                        |
| SPEC-009 | Hermes persona voice stack                   |
| SPEC-013 | Unified Claude Agent Monorepo                |
| SPEC-014 | Cursor AI CI/CD Pattern                      |
| SPEC-015 | Gitea Actions Enterprise                     |
| SPEC-034 | MiniMax LLM use cases (10 new skills)        |
| SPEC-035 | MiniMax Research replacement — Tavily → M2.1 |

---

## CI/CD Loop (Cursor AI Pattern — 09/04/2026)

```
PUSH → Gitea Actions (ci-feature)
       ↓
    lint + build + test
       ↓
    PR → code-review workflow
          ↓
       5 gates: lint | test | security | AI review | human
          ↓
       Merge → deploy-main workflow
                ↓
             Human gate (approve)
                ↓
             Coolify deploy
                ↓
             Smoke tests E2E
                ↓
             PASS → done
             FAIL → rollback workflow
```

**AI Self-Fix Loop (a implementar):**

```
AI review finds issue → AI fixes → re-commit → re-review
```

---

## Turbo Pipeline (`turbo.json`)

```json
{
  "pipeline": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "test": { "dependsOn": ["build"], "outputs": ["coverage/**"] },
    "lint": { "outputs": [] },
    "typecheck": { "outputs": [] }
  }
}
```

**Comandos:**

```bash
turbo run build          # Build all packages
turbo run build --filter=backend   # Build specific
turbo run test          # Test all
turbo run lint          # Biome lint
```

---

## Biome (`biome.json`)

```bash
biome ci .              # Check (CI mode)
biome format --write .  # Format
biome lint --write .    # Fix linting
```

---

## Build Commands

```bash
# Install
pnpm install

# Build (turbo)
pnpm build              # turbo run build
pnpm build --filter=apps/backend

# Test
pnpm test              # turbo run test
pnpm test --filter=apps/frontend -- --coverage

# Lint (biome)
pnpm lint              # biome ci .

# Dev
pnpm dev               # turbo run dev
pnpm dev --filter=apps/frontend

# Type check
pnpm typecheck         # turbo run typecheck
```

---

## Gitea + GitHub Remotes

| Remote   | URL                                                 | Uso           |
| -------- | --------------------------------------------------- | ------------- |
| `origin` | `git@github.com:zapprosite/monorepo.git`            | GitHub mirror |
| `gitea`  | `ssh://git@127.0.0.1:2222/will-zappro/monorepo.git` | Gitea primary |

```bash
# Push to both
git push --force-with-lease gitea HEAD && git push --force-with-lease origin HEAD
```

---

## Cron Jobs (Auto-Orchestration)

| Job                        | Cron           | Funcao                                                       |
| -------------------------- | -------------- | ------------------------------------------------------------ |
| `614f0574`                 | `*/30 * * * *` | Sync docs → memory                                           |
| `modo-dormir-daily`        | `0 3 * * *`    | SPEC → pipeline                                              |
| `code-review-daily`        | `0 4 * * *`    | Code review commits                                          |
| `test-coverage-daily`      | `0 5 * * *`    | Test coverage                                                |
| `secrets-audit-daily`      | `0 6 * * *`    | Secrets scan                                                 |
| `mcp-health-daily`         | `0 8 * * *`    | MCP server health                                            |
| `d201999d`                 | `*/5 * * * *`  | Auto-healer (Coolify)                                        |
| `95c72b71`                 | `3 */15 * * *` | Resource monitor                                             |
| `minimax-doc-sync-daily`   | `0 7 * * *`    | MiniMax: PORTS.md + SUBDOMAINS.md vs live → SERVICE_STATE.md |
| `minimax-bug-triage-daily` | `0 9 * * *`    | MiniMax: health-check.log → proactive anomaly report         |

---

## Ops Infrastructure Tools (Tunnel, Health, Auto-Heal)

**Critical scripts** for tunnel management, health monitoring, and homelab operations.
These are NOT in the monorepo — they're in `/srv/ops/` and `/srv/monorepo/tasks/`.

### Tunnel Health (SPEC-032)

| Script                                           | Purpose                                         | Cron            |
| ------------------------------------------------ | ----------------------------------------------- | --------------- |
| `/srv/ops/scripts/smoke-tunnel.sh`               | Curl all 13 subdomains, report DOWN             | `*/30 * * * *`  |
| `/srv/ops/scripts/tunnel-autoheal.sh`            | Restart cloudflared if DOWN >5min, ZFS snapshot | on-demand       |
| `/srv/ops/scripts/validate-ingress.sh`           | Verify ingress rules → reachable IPs (nc check) | on-demand       |
| `/srv/ops/scripts/gotify-alert.sh`               | Alert helper → POST `localhost:8050/gotify`     | —               |
| `/srv/ops/scripts/pre-commit-subdomain-check.sh` | Validate new subdomain entries in variables.tf  | pre-commit hook |

**Usage:**

```bash
# Smoke test all subdomains
bash /srv/ops/scripts/smoke-tunnel.sh

# Validate tunnel ingress rules
bash /srv/ops/scripts/validate-ingress.sh

# Auto-heal (rate-limited, ZFS snapshot first)
bash /srv/ops/scripts/tunnel-autoheal.sh

# Alert test
bash /srv/ops/scripts/gotify-alert.sh "Tunnel Test" "Smoke test passed 13/13"
```

### Backup & Recovery

| Script                                     | Purpose                          |
| ------------------------------------------ | -------------------------------- |
| `/srv/ops/scripts/backup-zfs-snapshot.sh`  | ZFS snapshot of tank pool        |
| `/srv/ops/scripts/restore-zfs-snapshot.sh` | Restore from named ZFS snapshot  |
| `/srv/ops/scripts/backup-qdrant.sh`        | Qdrant vector DB backup          |
| `/srv/ops/scripts/backup-postgres.sh`      | Postgres backup (, gitea dbs) |
| `/srv/ops/scripts/zfs-snapshot-prune.sh`   | Prune ZFS snapshots >7 days      |

### Homelab Monitoring

| Script                                                     | Purpose                                  |
| ---------------------------------------------------------- | ---------------------------------------- |
| `/srv/ops/scripts/homelab-health-check.sh`                 | Full health: Docker, ZFS, disk, services |
| `/srv/ops/scripts/homelab-gemma-monitor.sh`                | GPU + memory monitoring                  |
| `/srv/ops/scripts/ollama-healthcheck.sh`                   | Ollama LLM status                        |
| `/srv/monorepo/tasks/smoke-tests/pipeline-hermes-voice.sh` | Voice pipeline smoke test                |

### Ops Infrastructure

| Script                                       | Purpose                                |
| -------------------------------------------- | -------------------------------------- |
| `/srv/ops/scripts/mirror-sync.sh`            | Push to Gitea + GitHub remotes         |
| `/srv/ops/scripts/audit-branches.sh`         | Audit stale branches                   |
| `/srv/ops/scripts/cleanup-branches.sh`       | Remove stale branches (needs approval) |
| `/srv/ops/terraform/cloudflare/variables.tf` | Cloudflare Tunnel ingress rules        |

### Skills (`.claude/skills/`)

| Skill                          | Trigger         | Purpose                                    |
| ------------------------------ | --------------- | ------------------------------------------ |
| `list-web-from-zero-to-deploy` | `/new-list-web` | Create list-web app zero→deploy            |
| `repo-scan`                    | `/rs`           | Scan tasks in SPEC/TODO/TASKMASTER formats |
| `security-audit`               | `/sec`          | OWASP top 10 vulnerability scan            |

---

## Quick Reference

```bash
# Health check
bash scripts/health-check.sh

# Deploy com snapshot
bash scripts/deploy.sh --snapshot

# Mirror push
bash scripts/mirror-push.sh

# Smoke test
bash smoke-tests/smoke-chat-zappro-site.sh

# E2E test
node smoke-tests/playwright-chat-e2e.mjs chat.zappro.site

# Turb build
yarn build

# Biome lint
yarn lint

# Sync env
node scripts/sync-env.js

# AI-CONTEXT sync (OBRIGATORIO apos cada feature)
bash /home/will/.claude/mcps/ai-context-sync/sync.sh
```

---

## AI-CONTEXT Sync (SPEC-027)

**OBRIGATORIO apos cada feature/PR merge**

Apos fazer commit + push de qualquer feature, **SEMPRE** executar:

```bash
bash /home/will/.claude/mcps/ai-context-sync/sync.sh
```

**Porquê:** Mantem o memory dos agentes atualizado. Sem sync, o proximo agente nao tem contexto das mudancas.

**O que sincroniza:**

- `docs/GOVERNANCE/` → `memory/` (regras imutaveis)
- `docs/SPECS/` → `memory/` (specs atualizadas)
- `docs/SKILLS/` → `memory/skills/`
- `.context/docs/` → `memory/` (contexto auto-gerado)

**Docs rigidos que exigem sync apos mudanca:**

- `VERSION-LOCK.md` — versoes pinned (inclui voice pipeline desktop)
- `AGENTS.md` — regras de agentes
- `docs/GOVERNANCE/*` — governance do homelab
- `docs/SPECS/SPEC-*.md` — especificacoes
- `docs/OPERATIONS/SKILLS/*.md` — skills de operacao
- `docs/OPERATIONS/SKILLS/voice-pipeline-desktop.md` — Ctrl+Shift+C shortcut

**Verificacao:**

```bash
cat /home/will/.claude/mcps/ai-context-sync/manifest.json | jq '.last_sync'
```

---

## Git Workflow (SPEC-026)

### Mirror Sync

Before any merge:

```bash
bash /srv/ops/scripts/mirror-sync.sh
```

### Audit

Weekly branch audit:

```bash
bash /srv/ops/scripts/audit-branches.sh
```

### Tag Policy

See `docs/GOVERNANCE/TAG-POLICY.md`

| Format             | Use                |
| ------------------ | ------------------ |
| vMAJOR.MINOR.PATCH | Releases           |
| phase/N-name       | Process milestones |
| feat/NAME          | Feature flags      |

### Never

- Push directly to main
- Date-based tags (v20260412...)
- Non-feature branch names (feat/\* only)

## MiniMax Quick Reference (SPEC-034)

```bash
# Code generation — tRPC router from Zod schema
/codegen contract

# Semantic security audit pre-commit (OWASP + secrets audit)
/msec

# Documentation maintenance — API ref, PORTS, SUBDOMAINS
/dm api-ref      # Update TRPC-API.md from routers
/dm ports        # ss -tlnp vs PORTS.md drift
/dm subdomains   # curl health vs SUBDOMAINS.md

# Bug triage — Docker crash, tunnel DOWN, 529 errors
/bug-triage

# Backend scaffold — Fastify + tRPC from Zod
/bcaffold contract packages/zod-schemas/src/contract.zod.ts

# DB migration — OrchidORM migration + rollback
/migrate contract

# Add tRPC router to monorepo
/trpc myRouter

# Infrastructure generation — Docker, Terraform, Prometheus, Gitea
/infra-gen terraform subdomain chat http://10.0.5.2:8080
/infra-gen prometheus alerts loki
/infra-gen gitea workflow deploy-prd push

# Holistic PR review (1M token context)
/mxr 42
/mxr --commit abc123
```

**Crons MiniMax:**

```bash
# 07h — PORTS.md + SUBDOMAINS.md vs live system → SERVICE_STATE.md
0 7 * * * /srv/monorepo/.claude/skills/doc-maintenance/sync.sh

# 08h — Proactive anomaly report from health-check.log
0 8 * * * /srv/monorepo/.claude/skills/minimax-debugger/triage.sh
```

---

## Research Agent (SPEC-035 — COMPLETED)

** Tavily API replaced with MiniMax M2.1 for research (2026-04-13)**

The `/minimax-research` skill uses MiniMax LLM instead of Tavily web search:

| Aspect   | Tavily (DEPRECATED)  | MiniMax M2.1 (ACTIVE)    |
| -------- | -------------------- | ------------------------ |
| Method   | Web search API       | LLM inference            |
| Context  | URLs + snippets      | Full error/code analysis |
| Key      | `TAVILY_API_KEY`     | `MINIMAX_API_KEY`        |
| Source   | `.env` canonical     | `.env` canonical         |
| Use case | General web research | Deep code/error analysis |

### Skill

Trigger: `/minimax-research <query>`

For error analysis, architecture research, or code investigation. See `.claude/skills/minimax-research/SKILL.md`.

### Script

`scripts/cursor-loop-research-minimax.sh` — Research agent using MiniMax LLM:

```bash
# Usage
bash scripts/cursor-loop-research-minimax.sh "<topic or error message>"
```

- **Auth:** `MINIMAX_API_KEY` via `.env`
- **Endpoint:** `https://api.minimax.io/anthropic/v1/messages` (same pattern as voice pipeline)
- **Model:** MiniMax-M2.1 (200k+ context, fast inference)

## ⚠️ Regra HC-33: API_BASE SEM path

| ❌ ERRADO | ✅ CORRETO |
|----------|-----------|
| `https://api.minimax.io/anthropic/v1` | `https://api.minimax.io` |

LiteLLM concatena: `${api_base}${path_do_model}`

Se LiteLLM retornar 404, verificar se api_base NÃO tem caminho.

### Cron Jobs

| Job                        | Schedule    | Function                                                     |
| -------------------------- | ----------- | ------------------------------------------------------------ |
| `minimax-doc-sync-daily`   | `0 7 * * *` | MiniMax: PORTS.md + SUBDOMAINS.md vs live → SERVICE_STATE.md |
| `minimax-bug-triage-daily` | `0 9 * * *` | MiniMax: health-check.log → proactive anomaly report         |

### Migration (SPEC-035)

| Step                              | Status       |
| --------------------------------- | ------------ |
| cursor-loop-research.sh updated   | ✅ COMPLETED |
| MINIMAX_API_KEY via .env | ✅ COMPLETED |
| TAVILY_API_KEY removed from vault | ✅ COMPLETED |
| minimax-research skill created    | ✅ COMPLETED |

See `docs/SPECS/SPEC-035-minimax-research-replacement.md` for full details.

---

## Encoding and Localization Guidance

**Regra:** Docs e UI em PT-BR. Codigo (variaveis, funcoes, classes, commits) em EN.

### Antes de qualquer alteracao de texto user-facing

1. Verificar que o arquivo alvo usa UTF-8
2. Confirmar que acentos portugueses renderizam corretamente
3. Se o arquivo ja exibe mojibake ou acentos quebrados — corrigir o encoding ANTES de introduzir novo texto

### Escopo de verificacao obrigatoria

Aplicar este check antes de editar:

- Labels, titulos, descricoes, tooltips
- Tabs e linhas de tabela
- Mensagens de validacao
- Empty states
- Conteudo exportado user-facing
- Documentacao gerada automaticamente

### Verificacao final para mudancas em PT-BR

Apos qualquer alteracao de texto em portugues, confirmar que os seguintes termos
(e similares) estao renderizando corretamente:

- Projecao
- Receita Liquida
- Lucro Bruto
- Configuracao, Acao, Descricao, Numero

Estender essa verificacao a exports e docs gerados quando a mudanca
introduz ou atualiza texto em portugues.

### Padrao do repositorio

| Camada                                       | Idioma        |
| -------------------------------------------- | ------------- |
| Codigo-fonte (vars, funcoes, classes, types) | English       |
| Commits e branch names                       | English       |
| Comentarios tecnicos inline                  | English       |
| Docs (CLAUDE.md, AGENTS.md, ADRs, runbooks)  | PT-BR         |
| UI / texto user-facing                       | PT-BR (UTF-8) |
| Mensagens de erro user-facing                | PT-BR (UTF-8) |
| Logs internos de sistema                     | English       |

---

## End-of-Session Sync Pattern (OBRIGATORIO)

**Aplica-se a:** TODO e QUALQUER trabalho feito no monorepo — SEMPRE no final de cada sessao.

### Comandos Canonicos

| Comando  | Uso                         | Docs sync | Tag | PR  |
| -------- | --------------------------- | --------- | --- | --- |
| `/ship`  | Fim de sessao completo      | ✅        | ❌  | ❌  |
| `/turbo` | Feature pronta (quick ship) | ❌        | ✅  | ❌  |

### Workflow `/ship`

```
SYNC DOCS → COMMIT → PUSH BOTH → MERGE MAIN → NEW BRANCH
```

### Workflow `/turbo`

```
COMMIT → PUSH BOTH → MERGE MAIN → TAG → NEW BRANCH
```

### Branch Naming (pre-push hook)

- **Formato:** `feature/xxx-yyy` (primeiro segmento = letras, nao numeros)
- **Exemplos:** `feature/quantum-helix-done` ✅ | `feature/1776082911-done` ❌
- **Excepcoes:** `main` e `master` tem bypass automatico

### Porquê

- **Docs → Memory:** ai-context-sync mantem docs e memory alinhados
- **Both remotes:** Gitea (internal) + GitHub (public) = mirror
- **Merge main:** Evita divergencia entre os dois remotes
- **Random branch:** Cada sessao = feature branch isolada, nunca main diretamente

### Scripts

| Script                                   | Uso                                  |
| ---------------------------------------- | ------------------------------------ |
| `~/.claude/mcps/ai-context-sync/sync.sh` | Sincroniza docs → memory             |
| `/srv/ops/scripts/mirror-sync.sh`        | Sincroniza git mirrors               |
| `/srv/ops/scripts/cleanup-sessions.sh`   | Limpa sessoes Claude Code velhas     |
| `~/.hermes/scripts/sb-boot.sh`           | Boot Second Brain → sb-context.md    |
| `/srv/monorepo/scripts/sync-second-brain.sh` | Push TREE → hermes-second-brain  |
| `/ship` skill                            | End-of-session sync pattern completo |
| `/turbo` command                         | Quick feature ship com tag           |

### Hermes Second Brain

Repositório de conhecimento central. Mantém TREE.md de cada projeto para contexto cross-session.

| Item | Detalhe |
| ---- | ------- |
| **Repo** | `ssh://git@127.0.0.1:2222/will-zappro/hermes-second-brain.git` |
| **Boot** | `~/.hermes/sb-context.md` (lido ao iniciar, gerado por `sb-boot.sh`) |
| **Sync auto** | Gitea Actions no monorepo → push to main atualiza `monorepo-TREE.md` via API |
| **Sync manual** | `./scripts/sync-second-brain.sh` |
| **Skills** | `.claude/skills/gitea-cli/` + `.claude/skills/second-brain-loader/` |
| **Docs** | `docs/SECOND-BRAIN.md` (guia completo de integração) |

**Como LLM lê o Second Brain ao iniciar:**
1. `sb-boot.sh` fetches `*/TREE.md` do second-brain via API Gitea
2. Escreve digest em `~/.hermes/sb-context.md`
3. Qualquer agente que leia esse ficheiro tem contexto completo de todos os projetos

### NAO FACA

- Commitar diretamente em `main`
- Push para apenas um remote (origin OU gitea)
- Pular o sync de docs → memory (usa `/ship`)
- Criar branch com nome fixo (sempre random suffix)
- Branch names com primeiro segmento só numeros (e.g. `feature/12345-x`)

### Pre-Push Hook Fix (13/04/2026)

O hook `.git/hooks/pre-push` agora permite `main`/`master` sem bloquear. Mantem o formato `feature/xxx-yyy` para todas as outras branches.

### Autoridade

QUANDO TERMINAR O WORK — este pattern é **SEMPRE** executado. Nao e opcional.
