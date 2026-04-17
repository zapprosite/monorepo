---
name: SPEC-065-testing-observability-database
description: Testing, CI/CD, Observability e Database — pytest/tests, Gitea Actions expandidas, Prometheus dashboards, resolve Orchid ORM
spec_id: SPEC-065
status: IN_PROGRESS
priority: critical
author: Principal Engineer
date: 2026-04-17
---

# SPEC-065: Testing + Observability + Database

## Problema

| Área          | Status     | Porquê                                        |
| ------------- | ---------- | --------------------------------------------- |
| pytest/tests  | ❌ Ausente | Packages/apps sem test suite                  |
| CI/CD         | ⚠️ Parcial | Só 2 Gitea Actions workflows                  |
| Observability | ⚠️ Basic   | Prometheus existe mas dashboards não são SOTA |
| Database      | ❌ Legacy  | Orchid ORM/pg não está em uso                 |

---

## O Que Fazer

### 1. Testing (pytest + Vitest)

**Adicionar test suite aos apps TypeScript:**

- `apps/hermes-agency/` → Vitest (já tem `vitest.config.ts`?)
- `apps/ai-gateway/` → Vitest
- Testes unitários para: router, skills, agency_router

**Packages:**

- `packages/ui/` → Vitest
- `packages/zod-schemas/` → Vitest + Zod assertion tests

**Smoke tests** (já existem, 6 scripts):

- Manter e expandir para cubrir SPEC-065

### 2. CI/CD — Gitea Actions Expandidas

**Adicionar workflows:**

- `ci.yml` — lint + typecheck + test (substitui o que foi apagado)
- `test.yml` — testes unitários + integração
- `e2e.yml` — smoke tests nos serviços

### 3. Observability — Prometheus Dashboards

**Melhorar dashboards:**

- Dashboard JSON para: ai-gateway, hermes-agency, STT, TTS
- Alertas: service down, high latency, error rate

### 4. Database — Orchid ORM Status

**Verificar se `packages/db/` é usado:**

- Se não: apagar de vez
- Se sim: adicionar testes

---

## Research (Melhores Práticas Abril 2026)

- Vitest vs Jest: Vitest é mais rápido e native ESM
- Gitea Actions: workflow dispatch + matrix jobs
- Prometheus: exemplar storage + recording rules
- Test coverage: 80% como target mínimo

---

## Tarefas

1. Research: melhores práticas testing (Vitest, coverage, 2026)
2. Research: Gitea Actions best practices (matrix, caching, secrets)
3. Research: Prometheus dashboards (exemplars, recording rules)
4. Add Vitest config aos apps que não têm
5. Write unit tests para hermes-agency (router, skills, agency_router)
6. Write unit tests para ai-gateway
7. Expand Gitea Actions: ci.yml + test.yml + e2e.yml
8. Add Prometheus recording rules para services
9. Verify/resolve Orchid ORM (delete ou manter)
10. Commit + PR

---

## Acceptance Criteria

- [ ] hermes-agency: tests passing (Vitest)
- [ ] ai-gateway: tests passing (Vitest)
- [ ] packages: zod-schemas tests passing
- [ ] ci.yml: lint + typecheck working
- [ ] test.yml: unit tests in CI
- [ ] e2e.yml: smoke tests in CI
- [ ] Prometheus: recording rules added
- [ ] Database: Orchid ORM resolved (delete or keep with tests)
