---
name: minimax-refactor
description: Assisted module refactoring — detect and fix code smells using MiniMax LLM (TRPCError missing, db.$transaction, select(*))
trigger: /refactor-module
---

# MiniMax Refactor

## Objetivo

Detect and fix common module-level code smells in the monorepo using MiniMax LLM — with awareness of tRPC/OrchidORM patterns specific to this codebase.

## Quando usar

- Module has grown organically and needs cleanup
- Spotting missing `db.$transaction` in multi-step mutations
- Finding `TRPCError` not thrown on error paths
- Replacing `select("*")` with explicit column selection

## Como usar

```
/refactor-module <module-path>
```

Example:
```
/refactor-module apps/api/src/modules/contracts
/refactor-module apps/api/src/modules/auth
```

## Fluxo

```
/refactor-module <path>
  -> MiniMax le todos os arquivos em <path>
  -> Detecta code smells:
      - TRPCError ausente em catch blocks
      - db.$transaction ausente em mutacoes multi-step
      - select("*") -> substituir por colunas explicitas
      - protectedProcedure ausente em mutacoes sensiveis
      - Procedimentos sem input validation (Zod)
  -> Output: diff sugerido por arquivo
  -> Human review -> apply
```

## Output esperado

```
apps/api/src/modules/contracts/contracts.trpc.ts
  Line 45: [SMELL] TRPCError not thrown in catch — add TRPCError(INTERNAL_SERVER_ERROR)
  Line 78: [SMELL] select("*") — replace with explicit columns

Suggested diff: [inline diff]
```

## Bounded context

**Faz:**
- Code smell detection especifico ao stack tRPC/OrchidORM/Fastify
- Sugere diffs — nao aplica automaticamente
- Mantem comportamento existente (refactor puro, sem feature changes)

**Nao faz:**
- Nao adiciona features novas
- Nao modifica schemas Zod
- Nao altera logica de negocio

## Relacionado

- `/review` — Code review geral (nao especifico a code smells)
- `/codegen` — Gera novo codigo (nao refatora existente)

## Dependencias

- `MINIMAX_API_KEY` em Infisical vault
- Endpoint: `https://api.minimax.io/anthropic/v1`

## Referencias

- SPEC-034: `docs/SPECS/SPEC-034-minimax-agent-use-cases.md` (Code Generation section — Refactoring subsection)
