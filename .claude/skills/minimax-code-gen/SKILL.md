---
name: minimax-code-gen
description: tRPC router + OrchidORM table generation from Zod schemas using MiniMax LLM
trigger: /codegen
---

# MiniMax Code Gen

## Objetivo

Generate complete tRPC CRUD routers and OrchidORM table definitions from existing Zod schemas, eliminating ~30min of boilerplate per module.

## Quando usar

- Creating a new module with a defined Zod schema
- Zod schemas exist but tRPC router is missing
- Need OrchidORM table scaffolded from schema

**Nao usar** para scaffolding full Fastify plugins (use `/bcaffold`).

## Como usar

```
/codegen <module-name>
```

Example:
```
/codegen contracts
```

## Fluxo

```
Dev define Zod schema
  -> /codegen <module>
  -> MiniMax analisa packages/zod-schemas/src/<module>.schema.ts
  -> Gera:
      apps/api/src/modules/<module>/<module>.trpc.ts   (CRUD router)
      apps/api/src/modules/<module>/<module>.table.ts  (OrchidORM)
      apps/api/src/routers/trpc.router.ts              (atualiza imports)
      packages/zod-schemas/src/index.ts                (atualiza exports)
```

## Output esperado

- `<module>.trpc.ts` com `list`, `getById`, `create`, `update`, `delete` procedures
- `<module>.table.ts` com colunas derivadas do schema Zod
- Diff de `trpc.router.ts` com novo import e registro

## Bounded context

**Faz:**
- Gera boilerplate tRPC + OrchidORM a partir de Zod schemas
- Segue padrao `protectedProcedure` do monorepo
- Usa `db.$transaction` para operacoes de escrita

**Nao faz:**
- Nao cria Zod schemas (esses devem pre-existir)
- Nao faz migrations de DB (use `/migrate`)
- Nao gera handlers Fastify REST (use `/bcaffold`)

## Dependencias

- `MINIMAX_API_KEY` em Infisical vault
- Endpoint: `https://api.minimax.io/anthropic/v1`
- Modelo: MiniMax-M2.7 (1M token context)

## Referencias

- SPEC-034: `docs/SPECS/SPEC-034-minimax-agent-use-cases.md`
- Padrao tRPC: `apps/api/src/routers/trpc.router.ts`
