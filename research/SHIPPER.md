# SHIPPER Report — SPEC-065 Testing + Observability + Database

**Agent:** SHIPPER
**Date:** 2026-04-17
**Branch:** feature/quantum-helix-1776444895
**Status:** Research Complete — Ready for PR

---

## Aggregate Research Summary

### 1. Testing — Estado Atual

| App/Package            | Vitest Dep | Test Script     | vitest.config.ts | Status        |
| ---------------------- | ---------- | --------------- | ---------------- | ------------- |
| `apps/hermes-agency`   | ✅ ^2.0.0  | ✅ `vitest run` | ❌ MISSING       | ⚠️ Configurar |
| `apps/ai-gateway`      | ✅ ^3.1.1  | ✅ `vitest run` | ❌ MISSING       | ⚠️ Configurar |
| `packages/zod-schemas` | ✅ ^3.1.1  | ✅ `vitest run` | ✅ EXISTS        | ✅ OK         |
| `packages/ui`          | ❌ Ausente | ❌ Ausente      | ❌ Ausente       | ❌ Adicionar  |
| `apps/api`             | ✅ ^3.1.1  | ✅ `vitest run` | ✅ EXISTS        | ✅ OK         |
| `apps/web`             | ✅ ^3.1.1  | ✅ `vitest run` | ✅ EXISTS        | ✅ OK         |

**Gaps identificados:**

- `hermes-agency` e `ai-gateway`: têm vitest como dep e script, mas sem `vitest.config.ts` — necessário criar
- `packages/ui`: sem vitest — necessario adicionar

**Testes existentes:** 6 smoke tests em `smoke-tests/` (shell scripts)

### 2. CI/CD — Estado Atual

**Workflows existentes em `.gitea/workflows/`:**

- `ci.yml` — lint + build + test (já cobre test via turbo)
- `deploy-on-green.yml`, `deploy-main.yml`, `rollback.yml`, `ci-feature.yml`, `code-review.yml`, `daily-report.yml`, `failure-report.yml`, `deploy-perplexity-agent.yml`

**Gaps:**

- ❌ `test.yml` dedicado (separar unit/integration tests)
- ❌ `e2e.yml` para smoke tests em CI

### 3. Observability — Estado Atual

**Prometheus/Grafana:**

- `apps/monitoring/grafana/provisioning/dashboards/homelab/homelab.json` — Dashboard genérico, 1 archivo só
- `apps/monitoring/prometheus/alerts.yml` — Alertas Prometheus

**Gaps:**

- ❌ Sem dashboards dedicados para: ai-gateway, hermes-agency, STT, TTS
- ❌ Sem recording rules
- ❌ Sem exemplar storage config

### 4. Database — Orchid ORM Status

**Finding:** `packages/db` NÃO EXISTE. orchid-orm está em:

- `apps/api/package.json` — dep `orchid-orm: ^1.57.6` + `pg: ^8.16.3`
- `apps/api/` usa Orchid ORM + pg para a API

**Decisão:** MANTER — `apps/api` é o único app que usa Orchid ORM/pg. Não é "legacy" — é a camada de dados da API.

---

## PR Description (para Gitea)

```
## Summary

SPEC-065: Testing, CI/CD, Observability e Database — Research completo.

### Estado validado:
- hermes-agency: vitest dep+script existem, config缺失 (criar vitest.config.ts)
- ai-gateway: vitest dep+script existem, config缺失 (criar vitest.config.ts)
- packages/zod-schemas: vitest config ✅ OK
- packages/ui: sem test suite — vitest a adicionar
- apps/api: vitest config ✅ OK
- apps/web: vitest config ✅ OK

CI/CD:
- ci.yml existente (lint+build+test via turbo) ✅
- test.yml e e2e.yml a criar

Observability:
- homelab.json genérico existe (apps/monitoring/grafana/)
- Dashboards dedicados (ai-gateway, hermes-agency, STT, TTS) a criar
- Recording rules a adicionar

Database:
- Orchid ORM + pg: APENAS em apps/api — é a camada de dados legítima, NÃO legacy

### Files changed (research):
- research/SHIPPER.md — este relatório

### Next steps (para CODERs):
1. Criar vitest.config.ts para hermes-agency e ai-gateway
2. Adicionar vitest a packages/ui
3. Criar workflows test.yml e e2e.yml
4. Criar dashboards Prometheus dedicados
5. Adicionar recording rules
```

---

## Recommendations for Implementation

### Priority 1 (Critical — Blocker PR)

1. **criar `vitest.config.ts`** em `apps/hermes-agency/` e `apps/ai-gateway/` (copiar de `apps/api/vitest.config.ts` como template)
2. **Adicionar vitest a `packages/ui`** (`vitest: ^3.1.1` + `vitest.config.ts`)
3. **Criar `.gitea/workflows/test.yml`** — unit + integration tests
4. **Criar `.gitea/workflows/e2e.yml`** — smoke tests em CI

### Priority 2 (Enhancement)

5. **Criar dashboards Prometheus** para ai-gateway e hermes-agency em `apps/monitoring/grafana/provisioning/dashboards/`
6. **Adicionar recording rules** em `apps/monitoring/prometheus/`
7. **Adicionar Zod assertion tests** em `packages/zod-schemas/src/__tests__/`

### Priority 3 (Nice-to-have)

8. **Expandir smoke tests** para cobrir SPEC-065 services
9. **Coverage target: 80%** (definido em SPEC-065)

---

## Anti-Hardcoded Validation

✅ Nenhum secret/endpoint hardcoded neste relatório
✅ Todas as URLs e portas consultadas via docs/INFRASTRUCTURE/PORTS.md
✅ Pesquisa feita em modo read-only

---

## Ready for Commit

Este relatório está pronto para ser commitado e o PR criado no Gitea.

**Files to commit:**

- `research/SHIPPER.md` (novo arquivo)
- `docs/SPECS/SPEC-065-testing-observability-database.md` (SPEC existente, pode ter sido modificado)

**Branch:** `feature/quantum-helix-1776444895` (já existe)
**Target:** `main`
