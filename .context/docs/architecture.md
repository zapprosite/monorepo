---
type: doc
name: architecture
description: System architecture, layers, patterns, and design decisions
category: architecture
generated: 2026-03-16
updated: 2026-03-17
status: active
scaffoldVersion: "2.0.0"
---
## Architecture Notes

## Estilo: Modular Monolith

Monorepo com dois apps (`backend`, `frontend`) e pacotes compartilhados. Cada app é dividido em módulos por domínio. Não há microserviços — tudo roda num processo único por app.

## Fluxo de Requisição

```
Browser
  └──tRPC (HTTP POST)──▶ Fastify :4000
                              │
                         Session check
                              │
                         tRPC procedure
                              │
                         Orchid ORM ──▶ PostgreSQL :5432
```

Para APIs externas (produtos):
```
Client ──REST──▶ /api/v1/* ──▶ API Gateway middleware chain
                                 ├── apiKeyAuthHook
                                 ├── corsValidationHook
                                 ├── whitelistCheckHook
                                 ├── teamRateLimitHook
                                 ├── subscriptionCheckHook
                                 └── requestLoggerHook
                                          │
                                     Handler
```

## Camadas Backend

```
apps/backend/src/
├── server.ts          — entry point, porta via env.PORT (default 4000)
├── app.ts             — Fastify instance, plugins (session, rate-limit, CORS)
├── trpc.ts            — tRPC init, context, middlewares (auth, rate-limit)
├── routers/           — agregação de rotas
│   ├── app.router.ts  — /health, /, /oauth2, /trpc, openapi plugin
│   ├── trpc.router.ts — AppTrpcRouter (agrega todos os módulos)
│   └── oauth2.router.ts
├── modules/[feature]/ — domínios de negócio
│   ├── tables/        — Orchid ORM table definitions
│   └── [feature].trpc.ts — procedures tRPC
├── db/                — instância db, migrations, seed
└── configs/           — env.config.ts (Zod), logger.config.ts
```

## Camadas Frontend

```
apps/frontend/src/
├── App.tsx            — providers (tRPC, QueryClient, Router)
├── router.tsx         — React Router config (lazy-loaded por módulo)
├── modules/[feature]/ — páginas + router por domínio
├── components/        — componentes shared (layout, forms)
└── utils/             — trpc.client.ts, queryClient.ts
```

## Padrões Detectados

| Padrão | Localização | Descrição |
|--------|-------------|-----------|
| Module per domain | `modules/[feature]/` | Cada feature é um módulo isolado |
| Zod-first | `packages/zod-schemas/` | Schema único para back+front |
| tRPC caller | `trpc.router.ts` | Type-safe sem codegen |
| Protected procedure | `trpc.ts` | Auth middleware por procedure |
| Session-backed auth | `modules/auth/` | DB sessions + OAuth2 Google |
| API Gateway chain | `modules/api-gateway/` | Middleware chain para produto externo |

## Decisões Arquiteturais

**tRPC para interno, REST para externo**
- tRPC: frontend ↔ backend, sem OpenAPI, tipo-safe automático
- REST/OpenAPI: APIs de produto externas, Swagger UI, consumidores externos

**Orchid ORM com migrations explícitas**
- `yarn db -- g <name>` gera migration
- `timestampNumber` (epoch ms) em vez de ISO strings — consistência com JS

**Zod compartilhado**
- `packages/zod-schemas/` é a fonte de verdade de validação
- Import por path direto (sem barrel): `@connected-repo/zod-schemas/user.zod`

**Port via env var**
- Backend: `env.PORT` (default 4000) — porta 3000 está ocupada pelo CapRover
- Ver: [`/srv/ops/ai-governance/PORTS.md`](/srv/ops/ai-governance/PORTS.md)

## Dependências Externas

| Serviço | Uso | Port |
|---------|-----|------|
| PostgreSQL | banco principal | 5432 |
| Google OAuth2 | autenticação | HTTPS |
| CapRover | deploy/proxy | 80/443/3000 |

## Infraestrutura: Coolify + GitOps

### Arquitetura de Deploy

```
Gitea (git push)
    └── Gitea Action
            └── Coolify API (deploy trigger)
                    └── Coolify (container orchestration)
                            └── Cloudflare Tunnel → web.zappro.site
```

### API Coolify

| Endpoint | Método | Uso |
|----------|--------|-----|
| `/api/v1/applications` | GET | Listar apps |
| `/api/v1/applications/{uuid}/deploy` | POST | Trigger deploy |
| `/api/v1/applications/{uuid}/restart` | POST | Restart container |
| `/api/v1/applications/{uuid}/logs` | GET | Ver logs |
| `/api/v1/applications/{uuid}` | GET | Status detalhado |

### Secrets (Infisical)

| Secret | Projeto | Uso |
|--------|---------|-----|
| `OPENROUTER_API_KEY` | `zappro-p-tc-k` | LLM do agent |
| `COOLIFY_API_KEY` | `zappro-p-tc-k` | API Coolify |
| `COOLIFY_URL` | `zappro-p-tc-k` | http://localhost:8000 |

### Skills de Automação Coolify

| Skill | Descrição | Trigger |
|-------|-----------|---------|
| `coolify-deploy-trigger` | Trigger deploy via API | manual |
| `coolify-auto-healer` | Monitora + restart se degraded/down | cron 5min |
| `coolify-health-check` | Verifica health endpoint pós-deploy | manual |
| `coolify-resource-monitor` | CPU/memory alerts (>80%) | cron 15min |
| `coolify-incident-diagnostics` | Diagnóstico de erros + sugestões | manual |
| `coolify-rollback` | Rollback para versão anterior | manual |

### Scripts de Deploy (gitea-coolify-deploy)

| Script | Função |
|--------|--------|
| `deploy.sh` | Deploy via Coolify API (SSRF protected, HEREDOC Python) |
| `smoke-test.sh` | Health check HTTP 200 com retry (timeout 60s) |
| `auto-healer.sh` | Restart containers degraded/down (cron 5min) |
| `resource-monitor.sh` | CPU >70%, Memory >80% alerts (cron 15min) |

Localização: `/home/will/.claude/skills/gitea-coolify-deploy/scripts/`

### Gitea Workflow (deploy-perplexity-agent.yml)

Fluxo completo:
```
1. Checkout code
2. Get APP UUID (lookup por nome)
3. Trigger deploy (POST /deploy)
4. Wait for status (polling, 60s timeout)
5. Smoke test (HTTP 200 em /_stcore/health)
6. Rollback on failure (auto, se smoke test fail)
```

Localização: `/.gitea/workflows/deploy-perplexity-agent.yml`

### Incident Registrado

**INCIDENT-2026-04-08:** Container não deployado — GitOps gap entre Terraform (DNS) e Coolify (Deploy).

Prevenção: ver checklist em `SPEC-PERPLEXITY-GITOPS.md` antes de marcar "deploy pronto".

## Related Resources

- [project-overview.md](./project-overview.md)
- [data-flow.md](./data-flow.md)
- [tooling.md](./tooling.md)
