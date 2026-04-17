# RESEARCH-2: Gitea Actions Best Practices 2026

## Overview

Gitea Actions é compatível com GitHub Actions syntax (YAML). Usa **act** runners. Suporta matrix builds, caching, secrets, e workflow_dispatch.

---

## 1. Matrix Builds

### Padrão canónico

```yaml
jobs:
  test:
    strategy:
      matrix:
        node: ['18', '20', '22']
        db:   ['postgres:15', 'postgres:16']
        exclude:
          - node: '18'
            db: 'postgres:16'  # Node 18 não suporta PG 16
    runs-on: ubuntu-latest
    services:
      postgres:
        image: ${{ matrix.db }}
        env:
          POSTGRES_DB: test
          POSTGRES_USER: runner
          POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
        ports:
          - 5432:5432
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node }}
          cache: 'npm'  # cache automático
      - run: npm ci
      - run: npm test
```

### Boas práticas

- **exclude** para combos inválidas
- **max-parallel** para limitar concurrency: `max-parallel: 3`
- **fail-fast: false** para não cancelar matrix jobs em falha

---

## 2. Caching

### Cache de dependências

```yaml
- name: Cache node_modules
  uses: actions/cache@v4
  with:
    path: ~/.npm
    key: ${{ runner.os }}-npm-${{ hashFiles('**/package-lock.json') }}
    restore-keys: |
      ${{ runner.os }}-npm-

- name: Cache turbo build
  uses: actions/cache@v4
  with:
    path: .turbo
    key: ${{ runner.os }}-turbo-${{ hashFiles('**/turbo.json') }}
    restore-keys: |
      ${{ runner.os }}-turbo-
```

### Cache de UV (Python)

```yaml
- name: Cache uv
  uses: actions/cache@v4
  with:
    path: ~/.cache/uv
    key: ${{ runner.os }}-uv-${{ hashFiles('requirements.txt') }}
```

---

## 3. Secrets Management

### Gitea Secrets (via UI ou CLI)

```bash
# Gitea CLI para adicionar secrets
gitea admin auth add-oauth2
# Secrets são configurados em: Repo → Settings → Secrets
```

```yaml
# Uso em workflows
env:
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}  # para npm private packages
```

### Boas práticas

- Secrets NUNCA em logs (`::add-mask::` para mascarar)
- Secret por ambiente: `SECRETS_PRODUCTION`, `SECRETS_STAGING`
- Rotate regularmente

---

## 4. Workflow Dispatch (manual triggers)

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
      skip_tests:
        description: 'Skip tests'
        type: boolean
        default: false

jobs:
  deploy:
    if: ${{ !inputs.skip_tests }}
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}
    steps:
      - uses: actions/checkout@v4
      - run: echo "Deploying to ${{ inputs.environment }}"
```

---

## 5. Recomendações para Monorepo

### ci.yml sugerido

```yaml
name: CI

on:
  push:
    branches: [main, 'feature/**']
  pull_request:

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint

  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run typecheck

  test:
    strategy:
      matrix:
        app: [hermes-agency, ai-gateway, api]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm test -- --filter=${{ matrix.app }}

  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: bash smoke-tests/smoke-all.sh
```

### E2E com docker-compose

```yaml
e2e:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16
      env:
        POSTGRES_DB: test
        POSTGRES_USER: runner
        POSTGRES_PASSWORD: ${{ secrets.POSTGRES_PASSWORD }}
      ports:
        - 5432:5432
  steps:
    - uses: actions/checkout@v4
    - name: docker-compose up
      run: docker-compose -f docker-compose.test.yml up -d
    - name: Run e2e tests
      run: npm run test:e2e
    - name: docker-compose down
      run: docker-compose -f docker-compose.test.yml down
```

---

## 6. Caching vs Artefacts

| Tipo | Uso | Duração |
|------|-----|---------|
| `actions/cache` | Deps, builds intermédios | until manual purge ou TTL |
| `actions/upload-artifact` | Resultados de testes, logs | 90 dias default |

**Turbo/pnpm** → usar `actions/cache` para `.turbo/` e `node_modules/.cache/`

---

## 7. Runner Tags (Gitea Actions)

```yaml
jobs:
  gpu-tests:
    runs-on: [gpu]  # runner tag
    steps:
      - uses: actions/checkout@v4
      - run: nvidia-smi
```

Tags permitem segregar runners (CPU vs GPU vs ARM).

---

## Fontes

- [Gitea Actions Docs](https://docs.gitea.com/usage/actions/overview)
- [GitHub Actions Syntax](https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions)
- [actions/cache](https://github.com/actions/cache)
- [Gitea Actions Matrix](https://blog.gitea.io/2023/11/gitea-actions-is-now-part-of-gitea/)
