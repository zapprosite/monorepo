---
name: backend-scaffold
description: Full backend module scaffold — Fastify plugin + tRPC router + OrchidORM + smoke test — from Zod schema
trigger: /bcaffold
---

# Backend Scaffold

## Objetivo

Generate a complete backend module (Fastify plugin + tRPC router + OrchidORM table + smoke test) from a Zod schema path — eliminating ~80 lines of boilerplate per module.

## Quando usar

- New entity needs full backend stack (REST + tRPC + DB)
- tRPC router generation alone is insufficient (use `/codegen` for that)
- Need Fastify REST handler alongside tRPC

## Como usar

```
/bcaffold <entity-name> <zod-schema-path>
```

Example:
```
/bcaffold contracts packages/zod-schemas/src/contracts.schema.ts
```

## Fluxo

```
/bcaffold <entity> <schema-path>
  -> MiniMax le schema Zod
  -> Gera:
      apps/api/src/modules/<entity>/tables/<entity>.table.ts   (OrchidORM)
      apps/api/src/modules/<entity>/<entity>.trpc.ts           (tRPC router)
      apps/api/src/modules/api-gateway/handlers/<entity>.handler.ts  (Fastify REST)
      apps/api/src/routers/trpc.router.ts                      (atualiza imports)
      docs/SPECS/SPEC-<N>-<entity>.md                         (auto-spec)
      smoke-tests/smoke-<entity>.sh                           (smoke test)
```

## Output esperado

6 files gerados ou atualizados, com:
- OrchidORM table com colunas derivadas do schema
- tRPC router com `list`, `getById`, `create`, `update`, `delete`
- Fastify handler com middleware chain (apiKeyAuth -> corsValidation -> rateLimit -> ...)
- Smoke test com `curl` para endpoints gerados

## Bounded context

**Faz:**
- Full module scaffold — REST + tRPC + DB
- Segue middleware chain do monorepo (6-chain pattern)
- Gera auto-spec para rastreabilidade

**Nao faz:**
- Nao cria Zod schemas (devem pre-existir)
- Nao cria migrations de DB (use `/migrate` apos scaffold)
- Nao faz deploy ou migracao automatica

## Relacionado

- `/codegen` — Apenas tRPC router (subset de `/bcaffold`)
- `/migrate` — Gera migration OrchidORM apos scaffold
- `/trpc` — Adiciona apenas router tRPC isolado

## Dependencias

- `MINIMAX_API_KEY` em .env
- Endpoint: `https://api.minimax.io/anthropic/v1`
- Schema Zod deve existir em `packages/zod-schemas/src/`

## Referencias

- SPEC-034: `docs/SPECS/SPEC-034-minimax-agent-use-cases.md` (Backend section)
