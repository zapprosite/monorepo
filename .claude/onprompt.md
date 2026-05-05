# OnPrompt — SPEC-302 Phase 3 (2026-05-04)

## Estado Atual
- **Branch:** `feature/nano-blade` (mergeada na main)
- **TS errors:** 0
- **Padrão:** `createCrudRouter()` factory
- **Docs:** `docs/ONPROMPT-SPEC302.md` (versão completa)

## Regras de Ouro
1. **NÃO polir legado** — criar NOVO com factory
2. **Feature-driven refinement** — factory evolui com demanda real
3. **Aceitar `any` nos hooks** — OrchidORM não exporta tipos internos
4. **Commit atômico** — 1 módulo/feature por commit
5. **NÃO criar testes unitários por módulo** — 1 teste da factory é suficiente

## Snippet: Novo Módulo
```typescript
const crud = createCrudRouter({
  table: db.items, schemas: { list, create, update, delete, getById },
  idColumn: 'itemId', teamColumn: 'teamId',
  maxListLimit: 200, defaultOrder: { createdAt: 'DESC' },
});
export const router = trpcRouter({ ...crud, acaoCustom: protectedProcedure... });
```

## Checklist Início
- [ ] `cd apps/api && pnpm exec tsc --noEmit` (meta: 0)
- [ ] Verificar branch atual
- [ ] Consultar SPEC se existir
- [ ] Usar `/spec` ou brainstorm antes de codar features complexas

## Comandos
```bash
# Type check
pnpm exec tsc --project apps/api/tsconfig.json --noEmit

# Build API
cd apps/api && pnpm build

# Factory tests
pnpm test -- apps/api/src/lib/__tests__/crud-router.factory.test.ts
```

## Módulos Migrados (usar como referência)
- `editorial` — referência canônica
- `clients`, `leads`, `equipment`, `contracts`, `reminders`, `schedule`

## Módulos Legado (não tocar)
- `service-orders`, `maintenance`, `kanban`, `users`, `user-roles`, `prompts`, `email`, `journal-entries`, `memory`

## Pipeline
- `docs/pipeline-enterprise-spec302.json`
- `.gitea/workflows/ci-feature.yml`, `code-review.yml`, `deploy-main.yml`
