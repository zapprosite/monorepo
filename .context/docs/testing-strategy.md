---
type: doc
name: testing-strategy
description: Test frameworks, patterns, coverage requirements, and quality gates
category: testing
generated: 2026-03-16
updated: 2026-03-17
status: active
scaffoldVersion: "2.0.0"
---
## Testing Strategy

## Frameworks

| App | Framework | Environment |
|-----|-----------|-------------|
| `apps/backend` | Vitest 4 | Node |
| `apps/frontend` | Vitest 4 + jsdom | jsdom |

**Configs:**
- `apps/backend/vitest.config.ts` — tsconfig paths, Node environment
- `apps/frontend/vitest.config.ts` — React SWC, jsdom, `@testing-library/jest-dom`
- `apps/frontend/src/test-setup.ts` — setup global matchers

## Test Types

**Unit Tests** (`src/**/*.test.ts`, `src/**/*.test.tsx`):
- Funções puras, utils, validações Zod
- Componentes React isolados com `@testing-library/react`

**Integration Tests** (`src/**/*.integration.test.ts`):
- tRPC procedures contra banco de teste real
- Requerem `DATABASE_URL` apontando para DB de teste

**E2E** (futuro):
- Playwright — testar fluxos críticos (auth, criação de entidade)

## Comandos

```bash
yarn test                    # Todos os apps via Turbo
yarn test:watch              # Watch mode (por app)
yarn workspace @connected-repo/backend test -- --coverage
yarn workspace @connected-repo/frontend test -- --coverage
```

## Localização dos Arquivos

```
apps/backend/src/
└── modules/[feature]/
    ├── [feature].trpc.ts
    └── [feature].trpc.test.ts   ← co-localizado

apps/frontend/src/
└── modules/[feature]/
    └── pages/
        ├── [Feature].page.tsx
        └── [Feature].page.test.tsx
```

## Padrões

**Zod schemas** — testar validação de borda:
```typescript
it("rejects empty content", () => {
  expect(journalEntryCreateInputZod.safeParse({ content: "" }).success).toBe(false);
});
```

**tRPC procedures** — testar com caller direto:
```typescript
const caller = appTrpcRouter.createCaller({ user: mockUser });
const result = await caller.journalEntries.getAll();
```

**React components** — testar comportamento:
```typescript
render(<JournalEntryList entries={mockEntries} />);
expect(screen.getByText("My Entry")).toBeInTheDocument();
```

## CI

GitHub Actions (`.github/workflows/ci.yml`) roda `yarn test` em todo PR para `main`.
Postgres 15 disponível no CI para testes de integração.

## Related Resources

- [development-workflow.md](./development-workflow.md)
