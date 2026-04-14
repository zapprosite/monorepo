---
name: db-migration
description: OrchidORM migration + rollback generation using MiniMax LLM
trigger: /migrate
---

# DB Migration

## Objetivo

Generate OrchidORM migration files (up + down) for a given entity, following monorepo conventions and using MiniMax to infer column types from Zod schemas.

## Quando usar

- After `/bcaffold` creates a new table definition
- Schema changed and migration is needed
- Need rollback migration for an existing migration

## Como usar

```
/migrate <entity-name>
```

Example:
```
/migrate contracts
/migrate users --rollback
```

## Fluxo

```
/migrate <entity>
  -> MiniMax le:
      apps/api/src/modules/<entity>/tables/<entity>.table.ts
      packages/zod-schemas/src/<entity>.schema.ts
  -> Infere tipos de colunas (string->text, number->integer, etc.)
  -> Gera:
      apps/api/src/db/migrations/<timestamp>_create_<entity>.ts (up)
      apps/api/src/db/migrations/<timestamp>_create_<entity>.rollback.ts (down)
  -> Output: migration files prontos para review
  -> Dev executa: yarn db migrate (nao automatico)
```

## Output esperado

```
apps/api/src/db/migrations/20260413120000_create_contracts.ts
  -> createTable("contracts") com colunas derivadas do OrchidORM table

apps/api/src/db/migrations/20260413120000_create_contracts.rollback.ts
  -> dropTable("contracts")
```

## Bounded context

**Faz:**
- Gera migration up + rollback (down)
- Infere tipos de colunas de OrchidORM table + Zod schema
- Segue convencao de timestamps do monorepo

**Nao faz:**
- Nao executa `yarn db migrate` automaticamente (requer intervencao humana)
- Nao modifica dados existentes (apenas schema)
- Nao altera tabelas com dados em producao sem aprovacao

## Comando de execucao (humano)

```bash
yarn db migrate           # aplica migration
yarn db migrate --rollback  # reverte ultima migration
```

## Dependencias

- `MINIMAX_API_KEY` em Infisical vault
- OrchidORM table file deve existir (use `/bcaffold` primeiro)
- Endpoint: `https://api.minimax.io/anthropic/v1`

## Referencias

- SPEC-034: `docs/SPECS/SPEC-034-minimax-agent-use-cases.md` (Backend section — /migrate)
- OrchidORM docs: `apps/api/src/db/`
