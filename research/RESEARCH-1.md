# RESEARCH-1: Testing Best Practices 2026

**SPEC:** SPEC-065-testing-observability-database
**Focus:** Testing best practices, Vitest vs Jest, coverage targets, TypeScript/Node.js patterns
**Date:** 2026-04-17

---

## 1. Vitest vs Jest — 2026 Verdict

### Winner: Vitest ✅

| Criteria | Vitest | Jest |
|----------|--------|------|
| TypeScript native | ✅ First-class | ⚠️ Needs ts-jest |
| ESM support | ✅ Native | ❌ Legacy transforms |
| Performance | ✅ 2-3x faster | ❌ Slower |
| Vite integration | ✅ Native | ❌ Needs config |
| Maintenance | ✅ Active (2026) | ⚠️ Slow/legacy |
| Watch mode | ✅ Instant HMR | ❌ Slow |
| Coverage (v8) | ✅ Native | ✅ Works |

**Conclusion:** Vitest é o padrão 2026 para TypeScript/Node.js. Jest está em modo de manutenção.

- **Jest:** Em descontinuação gradual. Manutenção lenta desde 2022. Novas features param em Jest.
- **Vitest:** 10M+ downloads/mês, usado por: Nuxt, Astro, Remix, Vue, etc. API compatível com Jest (easy migration).

---

## 2. Coverage Target — 80% é Realista?

### Meta Recomendada: **70-80% lines**

| Nível | Coverage | Quando Usar |
|-------|----------|-------------|
| Mínimo | 60% | Apps simples, MVPs |
| Recomendado | **70-80%** | Production apps |
| Alto | 85%+ | Libraries, critical paths |

**80% lines coverage** é o padrão da indústria para 2026.

### O que NÃO coberturar (comum em 2026):
- `dist/`, `node_modules/`, migrations
- `*.test.ts`, `*.spec.ts`
- Config files
- Generated types

**No monorepo (apps/api/vitest.config.ts):**
```typescript
coverage: {
  provider: "v8",
  reporter: ["text", "lcov"],
  exclude: ["src/db/migrations/**", "dist/**"],
}
```

---

## 3. Test Patterns TypeScript/Node.js 2026

### 3.1 Unit Tests — Business Logic

```typescript
import { describe, it, expect } from 'vitest'

// Zod schema validation tests (packages/zod-schemas)
describe('userCreateInputZod', () => {
  it('parses valid input', () => {
    const result = userCreateInputZod.safeParse(validInput)
    expect(result.success).toBe(true)
  })

  it('rejects invalid email', () => {
    const result = userCreateInputZod.safeParse({ email: 'not-an-email' })
    expect(result.success).toBe(false)
  })
})
```

### 3.2 HTTP/Integration Tests — Fastify

```typescript
// apps/api/src/__tests__/http.test.ts (padrão actual)
import { app } from '@backend/app'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

beforeAll(async () => { await app.ready() })
afterAll(async () => { await app.close() })

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok' })
  })
})
```

### 3.3 Router/tRPC Tests

```typescript
// Pattern para routers tRPC
describe('journal-entries router', () => {
  it('creates entry with valid input', async () => {
    const caller = appRouter.createCaller({ userId: 'test-user' })
    const result = await caller.journalEntries.create({ title: 'Test', content: '...' })
    expect(result.id).toBeDefined()
  })
})
```

### 3.4 Mock Patterns (2026)

```typescript
import { vi } from 'vitest'

// Mock de env vars
vi.stubEnv('AI_GATEWAY_FACADE_KEY', 'test-key')

// Mock de módulos
vi.mock('./qdrant/client', () => ({
  initAllCollections: vi.fn().mockResolvedValue(undefined),
}))
```

---

## 4. Estado Actual do Monorepo

### 4.1 Apps com Vitest Config

| App | vitest.config.ts | Test Files | Status |
|-----|-------------------|------------|--------|
| `apps/api` | ✅ Existe | ✅ 14+ test files | **Working** |
| `packages/zod-schemas` | ✅ Existe | ✅ Tests nos Zod schemas | **Working** |
| `apps/hermes-agency` | ❌ Ausente | ❌ Nenhum | **A FAZER** |
| `apps/ai-gateway` | ❌ Ausente | ❌ Nenhum | **A FAZER** |
| `apps/web` | ✅ Existe | ❌ Nenhum test | **A FAZER** |

### 4.2 Scripts Disponíveis

```json
// hermes-agency (package.json)
"test": "vitest run",
"test:watch": "vitest"
// vitest: ^2.0.0 (devDependency já existe!)
```

```json
// ai-gateway (package.json)
"test": "vitest run",
// vitest: ^3.1.1 (devDependency já existe!)
```

### 4.3 CI Actual (.gitea/workflows/ci.yml)

```yaml
- run: pnpm turbo test
```

**Problema:** `turbo test` executa em todos os packages, mas hermes-agency e ai-gateway não têm tests configurados.

---

## 5. Recomendações para SPEC-065

### 5.1 Prioridade Alta — Adicionar Vitest Config

```typescript
// apps/hermes-agency/vitest.config.ts (criar)
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      exclude: ['dist/**', 'node_modules/**'],
    },
  },
})
```

### 5.2 Testes a Adicionar — hermes-agency

```typescript
// src/__tests__/health.test.ts
describe('Health Endpoint', () => {
  it('returns 200 on /health', async () => {
    const res = await fetch('http://localhost:3001/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('ok')
  })
})

// src/__tests__/env.test.ts
describe('Environment', () => {
  it('has required env vars', () => {
    expect(process.env.HERMES_AGENCY_BOT_TOKEN).toBeDefined()
    expect(process.env.AI_GATEWAY_FACADE_KEY).toBeDefined()
  })
})
```

### 5.3 Testes a Adicionar — ai-gateway

```typescript
// src/__tests__/health.test.ts
describe('AI Gateway Health', () => {
  it('returns ok on /health', async () => {
    const res = await fetch(`http://localhost:${process.env.AI_GATEWAY_PORT ?? 4002}/health`)
    expect(res.status).toBe(200)
  })
})

// src/__tests__/routes.test.ts
describe('Chat Completions', () => {
  it('rejects request without API key', async () => {
    const res = await fetch(`http://localhost:${process.env.AI_GATEWAY_PORT ?? 4002}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', messages: [{ role: 'user', content: 'hi' }] }),
    })
    expect(res.status).toBe(401)
  })
})
```

### 5.4 CI Workflows — Melhora

```yaml
# .gitea/workflows/test.yml (novo)
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo test --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/**/lcov.info
```

### 5.5 Coverage Target

| Package | Target | Priority |
|---------|--------|----------|
| `packages/zod-schemas` | 90% | Alta (schemas críticos) |
| `apps/api` | 80% | Alta |
| `apps/ai-gateway` | 70% | Média |
| `apps/hermes-agency` | 70% | Média |
| `packages/ui` | 60% | Baixa (React components) |

---

## 6. Conclusão

**Vitest é a escolha correta para 2026.** O monorepo já usa Vitest em `apps/api` com bons padrões (Fastify `inject()`, coverage v8). O gap principal é `hermes-agency` e `ai-gateway` que têm Vitest como devDependency mas sem config ou tests.

**Ação imediata:** Criar `vitest.config.ts` para hermes-agency e ai-gateway, adicionar 3-5 testes básicos de health/env validation, e melhorar o CI workflow para fazer upload de coverage.

---

## Fontes

- Vitest docs: https://vitest.dev
- State of JS 2025: Vitest superou Jest em satisfação
- Monorepo actual: `apps/api/vitest.config.ts`, `apps/api/src/__tests__/`