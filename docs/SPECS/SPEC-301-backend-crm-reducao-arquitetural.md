# Brainstorm: Backend CRM — Redução Arquitetural (SPEC-301)

**Data:** 2026-05-04
**Autor:** SRE Dev Senior
**Status:** DRAFT — Aguardando aprovação
**Motivação:** O backend do CRM (`apps/api`) tem 28 módulos, 40 tabelas, 26 routers tRPC e ~15K linhas de código. Muito disso é boilerplate CRUD repetido. O objetivo é entregar a mesma funcionalidade com ~40% menos linhas.

---

## 1. Diagnóstico da Gordura

### 1.1 CRUD Boilerplate — 60% do backend

Cada módulo segue exatamente o mesmo padrão:

```ts
// Padrão repetido 28×:
listX:      protectedProcedure.input(listZod).query(...)
createX:    protectedProcedure.input(createZod).mutation(...)
updateX:    protectedProcedure.input(updateZod).mutation(...)
deleteX:    protectedProcedure.input(deleteZod).mutation(...)
getById:    protectedProcedure.input(getByIdZod).query(...)
```

**Impacto:** ~200 procedures que poderiam ser gerados por uma factory.

### 1.2 Módulos Orfãos ou de Baixo Uso

| Módulo | Arquivos | Uso Estimado | Ação Proposta |
|--------|----------|--------------|---------------|
| `loyalty` | 3 | Baixo — programa fidelidade não ativo | Fundir em `clients` ou remover |
| `memory` | 4 proc | Alto — RAG via Hermes/Mem0 | ✅ Substituído (trieve removido) |
| `editorial` | 9 proc | Baixo — duplica `content-engine` | Fundir em `content-engine` |
| `api-gateway` | 17 arq | Alto complexidade | Simplificar para middleware único |
| `haystack` | ? | Provável duplicação com Qdrant | Avaliar remoção |

### 1.3 Schema Duplicado

- `packages/zod-schemas/` define schemas Zod
- `apps/api/src/modules/*/tables/*.table.ts` define schemas OrchidORM
- Os dois frequentemente divergem (ex: `status` obrigatório em um, opcional no outro)

### 1.4 Testes Quebrados

~15 arquivos de teste com erros de compilação. Se não são mantidos, são lixo que aumenta o tempo de build.

---

## 2. Abordagens

### A — Conservative (menos risco, menos ganho)

- Remover apenas módulos claramente não usados (`loyalty`, `editorial` → `content-engine`)
- Deletar testes quebrados
- **Economia estimada:** ~15% de linhas (~2.5K)

### B — Factory Pattern (recomendada)

- Criar `createCrudRouter(table, zodSchemas)` em `@backend/lib/crud-factory.ts`
- Cada módulo só define procedures customizados; o resto é gerado
- Unificar schemas Zod + OrchidORM via inferência
- **Economia estimada:** ~35% de linhas (~5K)
- **Risco:** Médio — requer refatorar 28 módulos

### C — Radical (mais risco, máximo ganho)

- Factory pattern + remover módulos orfãos + gerar frontend a partir de schema
- Unificar `editorial`+`content-engine`, `loyalty`→`clients`
- Criar `generic-crud-page.tsx` no frontend que renderiza qualquer tabela a partir de metadados
- **Economia estimada:** ~45% de linhas (~6.5K)
- **Risco:** Alto — muda arquitetura do frontend

---

## 3. Recomendação — Abordagem B (Factory Pattern)

Passos:

1. **Criar CRUD Factory** (`@backend/lib/crud-router.factory.ts`)
   ```ts
   export function createCrudRouter<TTable extends BaseTable>(
     table: TTable,
     schemas: { list: ZodType; create: ZodType; update: ZodType; delete: ZodType; getById: ZodType }
   ) { ... }
   ```

2. **Migrar módulos simples primeiro** (prompts, reminders, mcp-connectors)

3. **Unificar schemas** — OrchidORM `createTable` já tem tipos. Extrair Zod schemas via `z.infer<>` ou `zod-to-orchid` adapter.

4. **Remover testes quebrados** — se não passam, não servem.

5. **Documentar** — cada módulo passa de ~200 linhas para ~50 (só custom logic).

---

## 4. Critério de Aceitação

- [ ] Factory gera 5 procedures padrão (list, create, update, delete, getById)
- [ ] Pelo menos 10 módulos migrados para factory
- [ ] Build do backend passa (`pnpm --filter=api build`)
- [ ] `git diff --stat` mostra menos linhas no `apps/api/src/modules/`
- [ ] Nenhuma funcionalidade perdida (smoke tests passam)

---

*Less is more. Um router de 50 linhas que faz o mesmo que um de 200 vale 4× mais.*
