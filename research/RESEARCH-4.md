# RESEARCH-4: Database Testing — Vitest + ORM + Testcontainers

**Date:** 2026-04-17
**Author:** RESEARCH-4 Agent
**Spec:** SPEC-065 Testing + Observability + Database
**Status:** CONCLUÍDO

---

## 1. Vitest — State of the Art 2026

### Overview
Vitest 3.x é o standard para testes TypeScript/Node em 2026. Vite-native, HMR, ESM-first, zero config optional.

### Padrão Recomendado (packages/zod-schemas — BEST PATTERN)

```typescript
// packages/zod-schemas/vitest.config.ts
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./src/test-utils/env-setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.spec.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      exclude: ["src/db/migrations/**", "dist/**"],
    },
  },
});
```

**Key decisions:**
- `globals: true` — describe/it disponíveis sem imports
- `environment: "node"` — para código backend (não "jsdom")
- `tsconfigPaths` — resolve `workspace:*` aliases
- `setupFiles` — carrega env vars ANTES dos imports
- `coverage.provider: "v8"` — mais rápido que istanbul

### Para apps hermes-agency e ai-gateway

```typescript
// apps/hermes-agency/vitest.config.ts
import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./test/setup.ts"],
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov", "html"],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
  },
});
```

---

## 2. ORM Testing — Orchid ORM + Vitest

### Unit Tests (sem DB real)

Mockar o ORM nas unit tests para velocidade:

```typescript
// test/auth.test.ts (padrão atual ai-gateway)
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  // Setup env ANTES de importar módulos
  process.env.AI_GATEWAY_FACADE_KEY = 'test-key-32-bytes-xxxxxxxxxxxxxxxxxxx';
  process.env.LITELLM_LOCAL_URL = 'http://localhost:4000/v1';
});

describe('ChatCompletionRequestSchema', () => {
  it('accepts valid request', async () => {
    const { ChatCompletionRequestSchema } = await import('@repo/zod-schemas/openai-compat.zod');
    const result = ChatCompletionRequestSchema.safeParse({...});
    expect(result.success).toBe(true);
  });
});
```

### Integration Tests (com DB real)

**Padrão Testcontainers para PostgreSQL:**

```typescript
// test/setup.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';

let container: PostgreSqlContainer;

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabaseName('testdb')
    .withUsername('test')
    .withPassword('test')
    .start();

  process.env.DATABASE_URL = container.getConnectionUri();
});

afterAll(async () => {
  await container.stop();
});
```

### Dependência necessária

```bash
# packages/orchid-orm ou apps/api/package.json
pnpm add -D @testcontainers/postgresql@latest vitest@latest
```

**Alternativa mais leve:** usar `globalSetup` com PostgreSQL sobre socket Docker:

```typescript
// test/docker-postgres-setup.ts
// Não usa testcontainers — docker run direto via subprocess
// Mais rápido mas menos isolado
```

---

## 3. Testcontainers — Padrão 2026

### Porquê Testcontainers?

- **Isolamento** — cada test suite tem PostgreSQL limpo
- **Paridade** — mesmo PostgreSQL que produção (16-alpine)
- **CI/CD** — funciona em Gitea Actions com Docker socket
- **Cleanup automático** — container morre com afterAll()

### Gitea Actions — Docker Socket

```yaml
# .gitea/workflows/test.yml
services:
  docker:
    image: docker:24-dind
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_DB: testdb
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    options: >-
      --health-cmd pg_isready
      --health-interval 5s
      --health-timeout 5s
      --health-retries 5
```

### Para apps que usam Orchid ORM

Orchid ORM usa `$db` pattern. Integration tests:

```typescript
// src/modules/hermes/hermes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getDatabase } from '../../db';

let db: ReturnType<typeof getDatabase>;

beforeAll(async () => {
  db = getDatabase(process.env.DATABASE_URL!);
  await db.exec(File.readSync('./src/db/migrations/001_init.sql'));
});

afterAll(async () => {
  await db.$pool.end();
});

describe('Hermes agency router', () => {
  it('creates agent record', async () => {
    const agent = await db.agent.create({
      name: 'Test Agent',
      teamId: 'team_test',
    });
    expect(agent.id).toBeDefined();
    expect(agent.createdAt).toBeInstanceOf(Date);
  });
});
```

---

## 4. Coverage — Padrão 2026

### Thresholds SOTA

| Métrica | Mínimo | Target |
|---------|--------|--------|
| Lines | 70% | 80% |
| Functions | 70% | 80% |
| Branches | 60% | 70% |
| Statements | 70% | 80% |

### Coverage Reports

```typescript
coverage: {
  provider: "v8", // mais rápido que istanbul
  reporter: ["text", "lcov", "html"],
  reportsDirectory: "./coverage",
  exclude: [
    "**/*.test.ts",
    "**/*.spec.ts",
    "dist/**",
    "node_modules/**",
    "src/db/migrations/**",
    "**/test-utils/**",
  ],
  thresholds: {
    lines: 70,
    functions: 70,
    branches: 60,
    statements: 70,
    // Fail CI se cair abaixo
    perFile: false,
  },
}
```

### Gitea Actions — upload to Coverage

```yaml
- name: Upload coverage
  uses: actions/upload-artifact@v4
  with:
    name: coverage
    path: coverage/lcov.info
```

---

## 5. Estrutura de Testes Recomendada

```
apps/hermes-agency/
├── src/
│   ├── router.ts
│   ├── skills/
│   └── test-utils/
│       └── env-setup.ts        # setupFiles
├── test/
│   ├── setup.ts                # global setup + testcontainers
│   ├── auth.test.ts            # auth middleware
│   ├── router.test.ts          # endpoint tests
│   └── fixtures/
│       └── agents.ts           # test data factories
└── vitest.config.ts

packages/zod-schemas/
├── src/
│   ├── openai-compat.zod.ts
│   └── test-utils/
│       └── env-setup.ts
└── vitest.config.ts
```

---

## 6. Gitea Actions — CI/CD Expandido (SPEC-065 T3)

### ci.yml (lint + typecheck + test)

```yaml
name: CI

on:
  push:
    branches: [main, 'feature/**']
  pull_request:

jobs:
  ci:
    runs-on: ubuntu-latest
    container: node:22-alpine
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: oven-sh/setup-bun@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm -r lint
      - run: pnpm -r typecheck
      - run: pnpm test --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/lcov.info
```

### test.yml (testes unitários + integração)

Separar unit de integração permite parallelismo:

```yaml
name: Tests

on:
  push:
    branches: [main, 'feature/**']

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:unit

  integration:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: testdb
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:integration
```

---

## 7. Smoketests (já existem — expandir)

Smoke tests actuais são bash scripts. Recomenda-se manter como smoke mas adicionar:

```bash
#!/bin/bash
# smoke-tests/smoke-ai-gateway.sh
# Verifies: /health, /v1/models, auth

AI_GW_URL="${AI_GATEWAY_URL:-http://localhost:4002}"
KEY="${AI_GATEWAY_FACADE_KEY:-test-key}"

# Test 1: Health
curl -sf "${AI_GW_URL}/health" || exit 1

# Test 2: Auth required
curl -sf "${AI_GW_URL}/v1/models" | grep -q "error" || exit 1

# Test 3: Valid auth
curl -sf -H "Authorization: Bearer ${KEY}" "${AI_GW_URL}/v1/models" | grep -q "object" || exit 1
```

---

## 8. Recomendações para SPEC-065

### Prioridade 1 — Testes Unitários (sem DB)

1. **hermes-agency** — criar `vitest.config.ts` + `test/setup.ts`
   - Testes para: `agency_router.ts`, `skills/*.ts`, `auth.test.ts`
2. **ai-gateway** — já tem `test/auth.test.ts` com 11 tests
   - Adicionar: `router.test.ts`, `metrics.test.ts`
3. **packages/zod-schemas** — já tem vitest.config.ts
   - Expandir: 100% schema coverage

### Prioridade 2 — Integração (com DB)

1. **apps/api** — já usa Orchid ORM, tem docker-compose.yml
   - Testcontainers para PostgreSQL
   - Testes para: CRUD handlers, auth middleware, rate limiting

### Prioridade 3 — CI/CD

1. `.gitea/workflows/ci.yml` — lint + typecheck + test
2. `.gitea/workflows/smoke.yml` — smoke tests em produção
3. Coverage threshold: 70% lines

### NÃO RECOMENDADO

- **pytest** — não é usado neste monorepo (Bun runtime)
- **Jest** — obsoleto, Vitest é o standard 2026
- **Mock de DB** — prefira testcontainers para integração real

---

## 9. Tooling

| Tool | Uso | Versão |
|------|-----|--------|
| `vitest` | Test runner | 3.x |
| `vite-tsconfig-paths` | Alias resolution | latest |
| `@testcontainers/postgresql` | DB integration tests | 12.x |
| `coverage.provider: v8` | Coverage engine | built-in |
| `bun test` | Alternativa a vitest | bun built-in |

---

## 10. Conclusão

Vitest 3.x + v8 coverage é o standard 2026. Para DB:

- **Unit tests:** mock ORM, testar lógica pura
- **Integration tests:** testcontainers com PostgreSQL 16-alpine
- **Smoke tests:** bash scripts existentes (manter)
- **CI:** Gitea Actions com Docker socket + postgres service

Próximo passo: CODER-1 implementa vitest.config.ts para hermes-agency e expõe test:coverage script.
