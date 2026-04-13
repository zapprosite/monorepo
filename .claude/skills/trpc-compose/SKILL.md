---
name: trpc-compose
description: Add a new tRPC router to the monorepo — generates router file + updates trpc.router.ts composition
trigger: /trpc
---

# tRPC Compose

## Objetivo

Add a new tRPC router to the monorepo composition layer — generates the router file and updates `trpc.router.ts` with the correct import and registration pattern.

## Quando usar

- Adding a new feature area that needs a tRPC router
- Router exists but is not registered in `trpc.router.ts`
- Need to add procedures to an existing router

## Como usar

```
/trpc <router-name>
```

Example:
```
/trpc notifications
/trpc audit-log
```

## Fluxo

```
/trpc <router-name>
  -> MiniMax le:
      apps/api/src/routers/trpc.router.ts (patterns atuais)
      packages/zod-schemas/src/<router>.schema.ts (se existir)
  -> Gera:
      apps/api/src/modules/<router>/<router>.trpc.ts
        - Router com procedures seguindo padrao protectedProcedure
        - Input/output tipados com Zod schemas do monorepo
      apps/api/src/routers/trpc.router.ts (atualiza):
        - Novo import
        - Merge no AppRouter
```

## Output esperado

Novo router file:
```typescript
// apps/api/src/modules/notifications/notifications.trpc.ts
export const notificationsRouter = router({
  list: protectedProcedure.input(ListNotificationsSchema).query(...)
  markRead: protectedProcedure.input(MarkReadSchema).mutation(...)
})
```

Diff de `trpc.router.ts`:
```typescript
// + import { notificationsRouter } from '../modules/notifications/notifications.trpc'
// + notifications: notificationsRouter,
```

## Bounded context

**Faz:**
- Gera router tRPC com procedures basicas
- Atualiza `trpc.router.ts` com import e registro
- Segue padrao `protectedProcedure` + Zod input/output

**Nao faz:**
- Nao gera OrchidORM table (use `/codegen` ou `/bcaffold` para full stack)
- Nao cria Zod schemas (devem pre-existir em `packages/zod-schemas/`)
- Nao faz migration de DB

## Relacionado

- `/codegen` — Router tRPC + OrchidORM table (nao apenas router)
- `/bcaffold` — Full module (Fastify + tRPC + DB + smoke test)

## Dependencias

- `MINIMAX_API_KEY` em Infisical vault
- Endpoint: `https://api.minimax.io/anthropic/v1`
- 22 routers existentes como contexto em `trpc.router.ts`

## Referencias

- SPEC-034: `docs/SPECS/SPEC-034-minimax-agent-use-cases.md` (Backend section — /trpc)
