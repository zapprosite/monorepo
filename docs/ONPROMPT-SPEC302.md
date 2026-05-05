# OnPrompt — SPEC-302 Phase 3 (Pós-Migração)

> **Regra de Ouro:** NÃO polir código legado. Criar NOVO usando a factory. Feature-driven refinement.

---

## Estado Atual do Projeto (2026-05-04)

- **Branch ativa:** `feature/nano-blade` → mergeada na `main`
- **TypeScript:** 0 erros
- **Padrão canônico:** `createCrudRouter()` factory em `apps/api/src/lib/crud-router.factory.ts`

### Módulos JÁ Migrados para Factory (9)

| Módulo | Factory Instances | Ações Customizadas |
|--------|-------------------|-------------------|
| `editorial` | 1 | moveToProducao, moveToRevisao, approveItem, publishItem, cancelItem |
| `clients` | 3 | — |
| `leads` | 1 | convertLeadToClient |
| `equipment` | 2 | listEquipmentForRg, assignRgNumber |
| `contracts` | 1 | activateContract, suspendContract, reactivateContract, endContract, cancelContract |
| `reminders` | 1 | completeReminder, cancelReminder (delete = soft delete) |
| `schedule` | 1 | confirmarAgendamento, iniciarAtendimento, concluirAtendimento, cancelarAgendamento |

### Módulos NÃO Migrados (9 — manter como legado ou migrar sob demanda)

| Módulo | Razão |
|--------|-------|
| `service-orders` | Multi-entity + PDF + signatures |
| `maintenance` | Plans + schedules + complex team checks |
| `kanban` | 3 hierarchical entities + reordering |
| `users` | publicProcedure for OAuth create |
| `user-roles` | RBAC + admin checks |
| `prompts` | Global catalog, no team filter |
| `email` | usuarioCriacaoId isolation |
| `journal-entries` | authorUserId isolation |
| `memory` | Hermes integration |

---

## Regras de Ouro para Esta Sessão

### ✅ FAÇA
- Usar `createCrudRouter()` para QUALQUER novo módulo CRUD
- Adicionar ações customizadas como procedures extras no `trpcRouter({ ...factory, acaoCustom: ... })`
- Manter `idColumn` descritivo: `editorialId`, `clientId`, `leadId` (nunca `id`)
- Usar `teamColumn: 'teamId'` quando a tabela tem coluna `teamId`
- Usar hooks (`buildListQuery`, `transformCreateInput`, `onBeforeUpdate`) para team checks via join quando não há `teamId` direto
- Commit atômico por módulo/feature
- Aceitar `any` nos hooks da factory (OrchidORM não exporta tipos internos)
- Deletar testes legados do módulo migrado (não consertar)

### ❌ NÃO FAÇA
- NUNCA tentar "tipar corretamente" os hooks da factory (perda de tempo)
- NUNCA tentar remover `@ts-ignore` das tabelas OrchidORM (padrão conhecido)
- NUNCA criar testes unitários para cada módulo (1 teste da factory é suficiente)
- NUNCA gastar mais de 30 min migrando um módulo complexo — se travar, manter legado
- NUNCA alterar tabelas OrchidORM ou schemas Zod sem necessidade real
- NUNCA alterar frontend para acomodar backend

---

## Checklist de Início de Sessão

```
□ Rodar: cd apps/api && pnpm exec tsc --noEmit (meta: 0 erros)
□ Verificar branch: git branch --show-current
□ Se for feature nova: git checkout -b feature/<nome>
□ Se for continuar: git pull gitea feature/<nome>
□ Verificar se existe SPEC para a tarefa
□ Se não existir SPEC: criar com /spec ou brainstorm antes de codar
```

---

## Snippet Rápido: Novo Módulo com Factory

```typescript
// apps/api/src/modules/<modulo>/<modulo>.trpc.ts
import { db } from '@backend/db/db';
import { createCrudRouter } from '@backend/lib/crud-router.factory';
import { trpcRouter } from '@backend/trpc';
import {
	<modulo>CreateInputZod,
	<modulo>GetByIdZod,
	<modulo>UpdateInputZod,
	list<Modulo>FilterZod,
} from '@repo/zod-schemas/<modulo>.zod';

const <MODULO>_MAX_LIMIT = 200;

const <modulo>Crud = createCrudRouter({
	table: db.<modulo>s,
	schemas: {
		list: list<Modulo>FilterZod,
		create: <modulo>CreateInputZod,
		update: <modulo>UpdateInputZod,
		delete: <modulo>GetByIdZod,
		getById: <modulo>GetByIdZod,
	},
	idColumn: '<modulo>Id',
	teamColumn: 'teamId',
	maxListLimit: <MODULO>_MAX_LIMIT,
	defaultOrder: { createdAt: 'DESC' },
	hooks: {
		buildListQuery: (query: any, input: any) => {
			if (input.search) {
				const term = `%${input.search}%`;
				query = query.whereSql`"nome" ILIKE ${term}`;
			}
			return query;
		},
	},
});

export const <modulo>RouterTrpc = trpcRouter({
	list<Modulo>s: <modulo>Crud.list,
	get<Modulo>Detail: <modulo>Crud.getById,
	create<Modulo>: <modulo>Crud.create,
	update<Modulo>: <modulo>Crud.update,
	delete<Modulo>: <modulo>Crud.delete,
});
```

---

## Snippet Rápido: Team Check via Join (sem teamId na tabela)

```typescript
hooks: {
	buildListQuery: (query: any, _input: any, ctx: any) => {
		return query
			// @ts-ignore TS2339 innerJoin not in type but exists at runtime
			.innerJoin('clients', '<tabela>.clienteId', 'clients.clientId')
			.where('clients.teamId', ctx.user.teamId);
	},
	transformCreateInput: async (input: any, ctx: any) => {
		const client = await db.clients.findOptional(input.clienteId);
		if (!client || client.teamId !== ctx.user.teamId)
			throw new TRPCError({ code: 'FORBIDDEN', message: 'Acesso negado' });
		return input;
	},
}
```

---

## Quando Migrar vs Quando Manter Legado

| Situação | Ação |
|----------|------|
| Módulo simples, só CRUD | **Migrar** (15 min) |
| Módulo com 1-2 ações customizadas | **Migrar** (30 min) — ações vão como extras |
| Módulo com workflow complexo + PDF | **Manter legado** — não vale o esforço |
| Módulo com múltiplas entidades (kanban) | **Manter legado** — factory é para 1 tabela |
| Novo módulo sendo criado | **USAR FACTORY** desde o início |

---

## Comandos Úteis

```bash
# Type check
pnpm exec tsc --project apps/api/tsconfig.json --noEmit

# Build API
cd apps/api && pnpm build

# Factory test
pnpm test -- apps/api/src/lib/__tests__/crud-router.factory.test.ts

# Biome check (não precisa ser zero, só não piorar)
pnpm exec biome check apps/api/src/modules/<modulo>/

# Health check completo
bash scripts/sre-check.sh ci --json
```

---

## Pipeline Enterprise

- **Pipeline JSON:** `docs/pipeline-enterprise-spec302.json`
- **CI/CD:** `.gitea/workflows/`
- **Factory:** `apps/api/src/lib/crud-router.factory.ts`
- **Test Factory:** `apps/api/src/lib/__tests__/crud-router.factory.test.ts`
- **Referência:** `apps/api/src/modules/editorial/editorial.trpc.ts`

---

## Lição Aprendida (Não Esquecer)

> A tentativa de "chegar no estado da arte" com tipagem perfeita, zero warnings, e testes E2E completos **paralisou o projeto por 2 dias** com zero valor entregue.
>
> O caminho inteligente é: **factory funcional + nova feature usando factory + iterar.**
>
> Código "bom o suficiente" em produção vale mais que código "perfeito" nunca mergeado.
