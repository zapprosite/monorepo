---
name: SPEC-010
description: Monorepo Hardening Fix Pack — correção crítica de deploy, segurança, performance e qualidade de código pós-auditoria
status: IN_PROGRESS
priority: critical
author: will-zappro
date: 2026-04-29
specRef: SPEC-009 (predecessor stuck), SPEC-AUDIT-FIXES-PHASE2
---

# SPEC-010: Monorepo Hardening Fix Pack

> ⚠️ **Contexto:** Esta SPEC nasce diretamente da auditoria completa do monorepo (2026-04-29) que atribuiu nota **5.5/10**. Os itens aqui são não-negociáveis para qualquer deploy seguro em produção. Nenhuma nova feature deve ser iniciada antes desta SPEC estar DONE.
>
> ⚠️ **Governance:** Antes de alterar infraestrutura de deploy ou expor novas portas, verificar `docs/GOVERNANCE/IMMUTABLE-SERVICES.md`, `ops/ai-governance/PORTS.md` e `ops/ai-governance/SUBDOMAINS.md`.

---

## Objective

Corrigir falhas críticas de deploy, segurança operacional, performance e qualidade de código identificadas na auditoria do monorepo. O objetivo é elevar a nota de 5.5/10 para mínimo 7.5/10, tornando o monorepo seguro para deploy contínuo em produção. Os focos principais são: (1) infraestrutura de deploy funcional e segura, (2) hardening de segurança no backend, (3) eliminação de débitos técnicos críticos no código, e (4) cobertura mínima de testes nos caminhos de autenticação e gateway.

---

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Backend | Fastify 5 + tRPC 11 | `/srv/monorepo/apps/api` |
| ORM | Orchid ORM + pg | PostgreSQL via `DB_*` env vars |
| Frontend | React 19 + Vite 7 + MUI 7 | `/srv/monorepo/apps/web` |
| Monorepo | Turbo 2.9.6 + pnpm 9.0.6 | Build orchestration |
| Validation | Zod 4 | Shared via `@connected-repo/zod-schemas` |
| Container | Docker + Docker Compose | Multi-stage builds |
| CI/CD | Gitea Actions | `.gitea/workflows/` (ver SPEC-015) |
| Formatter/Linter | Biome 2.3.0 | `biome.json` na raiz |
| Test Runner | Vitest 4 | Backend + frontend unit tests |

---

## Commands

```bash
# Build all apps (deve passar limpo)
pnpm turbo build

# Type check all apps
pnpm turbo typecheck

# Lint all apps (Biome)
pnpm turbo lint

# Run all tests
pnpm turbo test

# Build Docker images localmente
docker build -t zappro/api:latest -f apps/api/Dockerfile .
docker build -t zappro/web:latest -f apps/web/Dockerfile .

# Validate docker-compose.prod.yml
docker compose -f deployments/docker-compose.prod.yml config

# Run backend tests with coverage
pnpm --filter api vitest run --coverage

# Run frontend tests
pnpm --filter web vitest run
```

---

## Project Structure (Escopo desta SPEC)

```
/srv/monorepo/
├── apps/
│   ├── api/
│   │   ├── Dockerfile                     # [NOVO] Multi-stage build
│   │   ├── src/
│   │   │   ├── server.ts                  # [EDIT] CORS fix
│   │   │   ├── app.ts                     # [EDIT] Cookie config fix
│   │   │   ├── modules/api-gateway/
│   │   │   │   ├── middleware/apiKeyAuth.middleware.ts  # [EDIT] O(1) lookup
│   │   │   │   └── api-gateway.router.ts  # [EDIT] Remove NOT_IMPLEMENTED
│   │   │   ├── modules/email/email.trpc.ts # [EDIT] Remove stubs
│   │   │   ├── trpc.ts                    # [EDIT] Resolve FIXME
│   │   │   └── __tests__/                 # [NOVO] Tests críticos
│   │   └── package.json                   # [EDIT] Unified scope
│   └── web/
│       ├── Dockerfile                     # [NOVO] Multi-stage build
│       └── package.json                   # [EDIT] Unified scope
├── deployments/
│   └── docker-compose.prod.yml            # [EDIT] Images buildadas, secrets isolados
├── packages/
│   ├── zod-schemas/package.json           # [EDIT] Unified scope
│   ├── trpc/package.json                  # [EDIT] Unified scope
│   └── ...
├── .gitea/workflows/                      # [NOVO] CI/CD pipeline
└── biome.json                             # [EDIT] Add noConsoleLog em prod
```

---

## Code Style

As convenções existentes em `biome.json` e `CONVENTIONS.md` continuam válidas. Adições para esta SPEC:

- **Nunca** deixar `FIXME` ou `TODO` em código mergeado para `main`.
- **Nunca** expor endpoints `NOT_IMPLEMENTED` em produção.
- **Sempre** usar `process.env.*` para secrets — validar via Zod em `env.config.ts`.
- **Sempre** adicionar teste ao corrigir bug ou alterar middleware.

---

## Testing Strategy

| Level | Scope | Framework | Location | Target (esta SPEC) |
|-------|-------|-----------|----------|-------------------|
| Unit | Middlewares isolados | vitest | `apps/api/src/modules/**/__tests__/*.test.ts` | +6 novos arquivos |
| Integration | tRPC routers + DB | vitest + testcontainers/pg | `apps/api/src/__tests__/**/*.test.ts` | +3 novos suites |
| Security | Auth flows, CORS, rate-limit | vitest | `apps/api/src/__tests__/security/*.test.ts` | +2 novos suites |
| E2E | Login → CRUD crítico | playwright | `apps/web/src/__tests__/e2e/*.spec.ts` | +1 smoke test |

### Coverage Targets (mínimos para DONE)

- `apps/api/src/modules/api-gateway/`: **≥ 70%** line coverage
- `apps/api/src/modules/auth/`: **≥ 80%** line coverage
- `apps/api/src/middlewares/`: **≥ 75%** line coverage
- `apps/web/src/`: **≥ 40%** line coverage (baseline)

---

## Boundaries

### Always

- Rodar `pnpm turbo typecheck && pnpm turbo lint && pnpm turbo test` antes de marcar qualquer task DONE.
- Usar ZFS snapshot antes de alterar infraestrutura de deploy (`zfs snapshot tank/monorepo@pre-spec010-YYYYMMDD`).
- Validar `docker compose config` antes de push.
- Manter `.env` gitignored; `.env.example` atualizado se novas vars forem adicionadas.

### Ask First

- Alterações em `ops/ai-governance/PORTS.md` ou `SUBDOMAINS.md`.
- Adição de novos env vars que afetam produção.
- Mudanças no schema de banco (Orchid ORM migrations).

### Never

- Fazer `docker compose -f deployments/docker-compose.prod.yml up` sem validar local primeiro.
- Committar valores reais de secrets em qualquer arquivo.
- Deixar endpoints com `throw TRPCError({ code: "NOT_IMPLEMENTED" })` expostos.

---

## Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| SC-1 | `docker build` produz imagens funcionais para api e web | `docker run --rm zappro/api:latest node -e "require('./dist/server.js')"` não crasha |
| SC-2 | `docker-compose.prod.yml` sobe stack completo sem erros | `docker compose -f deployments/docker-compose.prod.yml up --dry-run` passa |
| SC-3 | CORS rejeita origens não autorizadas em produção | Teste: `curl -H "Origin: https://evil.com"` retorna 403 em `/trpc` |
| SC-4 | API key lookup é O(1) | Benchmark: 1000 keys em < 50ms (p99) |
| SC-5 | Zero `FIXME`, `TODO`, `NOT_IMPLEMENTED` no código fonte de produção | `grep -rn "FIXME\|TODO\|NOT_IMPLEMENTED" apps/api/src apps/web/src` retorna vazio |
| SC-6 | Cobertura de testes atinge mínimos definidos | `pnpm --filter api vitest run --coverage` passa thresholds |
| SC-7 | CI/CD pipeline executa build + test + lint em push para main | Gitea Actions green |

---

## Open Questions

| # | Question | Impact | Priority |
|---|----------|--------|----------|
| OQ-1 | Gitea Actions runner já está registrado e funcional? | CI/CD block | Critical |
| OQ-2 | PostgreSQL de testes roda via testcontainers ou precisa de instância dedicada? | Test setup | High |
| OQ-3 | Coolify deve fazer o deploy final ou usamos docker-compose raw em produção? | Deploy strategy | Med |

---

## User Story

Como **operador do homelab**, quero que o monorepo tenha deploy seguro, testes confiáveis e código sem débito técnico crítico, para que eu possa fazer deploy contínuo sem medo de quebrar produção ou expor dados.

---

## Goals

### Must Have (MVP)

- [x] T-010-001: Dockerfile multi-stage funcional para `api` e `web`
- [ ] T-010-002: `docker-compose.prod.yml` corrigido (images buildadas, sem mount de `.env` inteiro)
- [ ] T-010-003: CORS global restrito + cookie domain configurado para multi-subdomain
- [ ] T-010-004: API key lookup O(1) com índice em `teams.apiSecretHash`
- [ ] T-010-005: Remover todos `FIXME`, `TODO`, `NOT_IMPLEMENTED` do código de produção
- [ ] T-010-006: Cobertura mínima de testes nos módulos auth + api-gateway + middlewares

### Should Have

- [ ] T-010-007: CI/CD pipeline Gitea Actions (build, typecheck, lint, test, security scan)
- [ ] T-010-008: Unificar package names para namespace consistente (`@zappro/*` ou `@repo/*`)
- [ ] T-010-009: Cleanup de configs de IDEs/AI tools legadas no repo

### Could Have

- [ ] T-010-010: Playwright E2E smoke test (login → dashboard)
- [ ] T-010-011: Adicionar `noConsoleLog` rule no Biome para builds de produção

---

## Non-Goals

- **NÃO** inclui migração de banco de dados não relacionada a índice `apiSecretHash`.
- **NÃO** inclui refactor arquitetural de módulos (ex: reorganizar `modules/*` em camadas).
- **NÃO** inclui implementação de novas features de negócio.
- **NÃO** inclui migração de Orchid ORM para Drizzle ou outro ORM.
- **NÃO** altera a stack de voice/STT/TTS (imutável por governança).

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | `docker build -f apps/api/Dockerfile .` completa com sucesso e container inicia | `docker run --rm -e NODE_ENV=test zappro/api:latest pnpm --filter api test` passa |
| AC-2 | Requisição de origem não-allowed é bloqueada em produção | `curl -H "Origin: https://attacker.com" $API_URL/trpc` → HTTP 403 |
| AC-3 | API key é validada em < 50ms com 1000 teams | Benchmark script em `apps/api/src/__tests__/perf/apiKey.perf.test.ts` |
| AC-4 | Zero stubs de `NOT_IMPLEMENTED` expostos via HTTP | `grep -r "NOT_IMPLEMENTED" apps/api/src/modules/` retorna vazio |
| AC-5 | Testes de auth cobrem login OAuth2, session store, e logout | `pnpm --filter api vitest run --reporter=verbose src/modules/auth/__tests__/` passa |
| AC-6 | Pipeline CI roda em ≤ 10 minutos para o monorepo inteiro | Timer no Gitea Actions ≤ 600s |

---

## Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| SPEC-009 | STUCK | Predecessor stuck em phase execute; esta SPEC é independente, mas consome lições aprendidas |
| Infra: Docker + Docker Compose | READY | Já instalado no host |
| Infra: Gitea | READY | `https://git.zappro.site` funcional; verificar runner status para OQ-1 |
| Infra: PostgreSQL | READY | Usado por api e LiteLLM |
| Infra: Biome 2.3.0 | READY | Configurado na raiz |
| Package: `@connected-repo/zod-schemas` | READY | Workspace link |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-29 | Criar SPEC-010 como fix pack pós-auditoria | Auditoria atribuiu 5.5/10; correções são pré-requisito para qualquer nova feature |
| 2026-04-29 | Scope limitado a 7 tasks must-have | Evitar scope creep; should-have e could-have são follow-ups |
| 2026-04-29 | Manter Orchid ORM (não migrar para Drizzle) | Fora do escopo; migração de ORM é SPEC separada |
| 2026-04-30 | Docker: usar `node-linker=hoisted` + `tsx` runtime | pnpm workspace symlinks quebram em multi-stage copy; `tsx` resolve ESM extension issues em deps como `pqb` |
| 2026-04-30 | Docker: copiar `dist/` do host ao invés de compilar no container | `tsc` tem 100+ erros existentes no codebase; rebuild host-side com `tsc-alias` + patch ESM é mais pragmático |
| 2026-04-30 | Web: `vite.docker.config.ts` sem bundle analyzer | Plugin `vite-bundle-analyzer` tenta abrir browser com `xdg-open` que não existe em Alpine; config separada evita hacks de env |

---

## Tasks (pipeline.json Schema)

```json
{
  "spec": "SPEC-010",
  "phase": "execute",
  "parallel_limit": 3,
  "tasks": [
    {
      "id": "T-010-001",
      "name": "docker-multi-stage-build",
      "description": "Criar Dockerfiles multi-stage para api e web. O Dockerfile root atual serve apenas um index.html estático — é inútil. Novos Dockerfiles devem usar node:22-alpine, instalar pnpm, fazer turbo prune/build, e expor porta correta.",
      "agent_role": "deploy-agent",
      "file_context": [
        "/srv/monorepo/Dockerfile",
        "/srv/monorepo/apps/api/package.json",
        "/srv/monorepo/apps/web/package.json",
        "/srv/monorepo/turbo.json"
      ],
      "expected_output": "apps/api/Dockerfile e apps/web/Dockerfile funcionais",
      "acceptance_criteria": [
        "docker build -f apps/api/Dockerfile . completa sem erros",
        "docker build -f apps/web/Dockerfile . completa sem erros",
        "Containers iniciam e respondem HTTP em health endpoints"
      ]
    },
    {
      "id": "T-010-002",
      "name": "docker-compose-prod-fix",
      "description": "Corrigir deployments/docker-compose.prod.yml para usar images buildadas (não build: ../Dockerfile quebrado), remover mount de .env do host, e usar env vars individuais ou Docker secrets.",
      "agent_role": "deploy-agent",
      "file_context": [
        "/srv/monorepo/deployments/docker-compose.prod.yml",
        "/srv/monorepo/deployments/docker-compose.local.yml",
        "/srv/monorepo/.env.example"
      ],
      "expected_output": "docker-compose.prod.yml validado e funcional",
      "acceptance_criteria": [
        "docker compose -f deployments/docker-compose.prod.yml config passa sem erros",
        "Não há referência a /srv/monorepo/.env dentro de volumes ou env_file",
        "Dependências de serviços (depends_on + condition) estão corretas"
      ]
    },
    {
      "id": "T-010-003",
      "name": "cors-cookie-security-harden",
      "description": "Restringir CORS global para ALLOWED_ORIGINS (remover origin: true), configurar cookie domain para produção multi-subdomain, e garantir sameSite adequado.",
      "agent_role": "backend-agent",
      "file_context": [
        "/srv/monorepo/apps/api/src/server.ts",
        "/srv/monorepo/apps/api/src/app.ts",
        "/srv/monorepo/apps/api/src/configs/env.config.ts"
      ],
      "expected_output": "CORS rejeita origens não autorizadas; cookies funcionam cross-subdomain",
      "acceptance_criteria": [
        "Requisição com Origin não-allowed retorna 403 em /trpc",
        "Requisição com Origin allowed retorna 200 + CORS headers",
        "Cookie session funciona entre app.zappro.site e api.zappro.site"
      ]
    },
    {
      "id": "T-010-004",
      "name": "api-key-o1-lookup-index",
      "description": "Adicionar índice em teams.apiSecretHash e refatorar apiKeyAuthHook para O(1) lookup. Atualmente faz SELECT * de todas as teams e verifica em loop — vulnerável a DoS.",
      "agent_role": "backend-agent",
      "file_context": [
        "/srv/monorepo/apps/api/src/modules/api-gateway/middleware/apiKeyAuth.middleware.ts",
        "/srv/monorepo/apps/api/src/db/db.ts",
        "/srv/monorepo/apps/api/src/modules/teams/tables/teams.table.ts"
      ],
      "expected_output": "Lookup O(1) com índice de hash",
      "acceptance_criteria": [
        "Migration adiciona índice em apiSecretHash (ou nova coluna apiKeyHashIndex)",
        "Hook busca diretamente pela hash sem loop",
        "Benchmark: 1000 teams, p99 < 50ms"
      ]
    },
    {
      "id": "T-010-005",
      "name": "remove-production-stubs",
      "description": "Eliminar FIXME em trpc.ts, TODOs em middlewares, e endpoints NOT_IMPLEMENTED (email templates, campaign retrieval). Ou implementar ou remover exposição.",
      "agent_role": "backend-agent",
      "file_context": [
        "/srv/monorepo/apps/api/src/trpc.ts",
        "/srv/monorepo/apps/api/src/modules/email/email.trpc.ts",
        "/srv/monorepo/apps/api/src/modules/kanban/kanban.logging.ts",
        "/srv/monorepo/apps/api/src/middlewares/sessionSecurity.middleware.ts"
      ],
      "expected_output": "Código de produção limpo de stubs e FIXMEs",
      "acceptance_criteria": [
        "grep -rn 'FIXME\|TODO\|NOT_IMPLEMENTED' apps/api/src retorna vazio",
        "Email router não expõe endpoints que retornam 501",
        "trpc.ts error logging funciona corretamente"
      ]
    },
    {
      "id": "T-010-006",
      "name": "backend-test-coverage-baseline",
      "description": "Criar testes críticos para auth (OAuth2, session, logout), api-gateway (apiKey, rate-limit, CORS), e middlewares (sessionSecurity). Cobertura mínima: auth 80%, gateway 70%, middlewares 75%.",
      "agent_role": "debug-agent",
      "file_context": [
        "/srv/monorepo/apps/api/src/modules/auth/__tests__/",
        "/srv/monorepo/apps/api/src/__tests__/",
        "/srv/monorepo/apps/api/src/test-utils/",
        "/srv/monorepo/apps/api/vitest.config.ts"
      ],
      "expected_output": "Suites de teste críticos rodando e passando",
      "acceptance_criteria": [
        "Testes de apiKeyAuthHook cobrem sucesso, falha, IDOR mismatch",
        "Testes de session security cobrem expiry e suspicious activity",
        "Coverage report atinge thresholds definidos em SC-6"
      ]
    },
    {
      "id": "T-010-007",
      "name": "gitea-ci-cd-pipeline",
      "description": "Configurar pipeline Gitea Actions com stages: (1) setup pnpm, (2) lint + typecheck, (3) test with coverage, (4) docker build, (5) security scan (trivy ou npm audit). Block merge se falhar.",
      "agent_role": "deploy-agent",
      "file_context": [
        "/srv/monorepo/.gitea/",
        "/srv/monorepo/package.json",
        "/srv/monorepo/turbo.json"
      ],
      "expected_output": "Pipeline .gitea/workflows/ci.yml funcional",
      "acceptance_criteria": [
        "Pipeline dispara em push para main e PRs",
        "Build stage passa em ≤ 10 min",
        "Security scan bloqueia merge se vulnerabilities > high"
      ]
    }
  ]
}
```

---

## Riscos

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| Docker multi-stage quebra build dev | Média | Devs não conseguem rodar local | Manter `docker-compose.local.yml` funcional e separado |
| CORS restrict quebra frontend em dev | Alta | Dev local não comunica com API | `isDev` flag mantém localhost permissivo, só restringe em prod |
| Índice apiSecretHash exige migração | Média | Migration pode falhar em produção | Testar migration em staging primeiro; rollback script pronto |
| Gitea runner não disponível | Alta | CI/CD não executa | Validar OQ-1 antes de iniciar T-010-007; fallback para validação manual |
| Testes de auth dependem de OAuth2 | Baixa | Google OAuth difícil de mockar | Usar `createCallerFactory` com mock context (padrão já existente) |

---

## Referências

- `/srv/monorepo/docs/AUDITS/REVIEW-AGGREGATE-2026-04-26.md` — Resultados de reviews automatizados
- `/srv/monorepo/docs/SPECS/SPEC-AUDIT-FIXES-PHASE2.md` — Precedente de SPEC de correção
- `/srv/monorepo/docs/SPECS/SPEC-015-GITEA-ACTIONS-ENTERPRISE.md` — CI/CD enterprise pattern
- `/srv/monorepo/AGENTS.md` — Regras de infra e segurança
- `/srv/monorepo/.claude/vibe-kit/queue.json.stuck-20260429-202200` — Estado stuck de SPEC-009 (lições)

---

## Checklist

- [ ] SPEC written e revisada
- [ ] Architecture decisions documentadas (Decisions Log acima)
- [ ] Acceptance criteria são testáveis
- [ ] Dependencies identificadas
- [ ] Security review done (hardening CORS + auth + deploy)
- [ ] Tasks geradas com pipeline.json schema (ver seção Tasks)
- [ ] Turbo commands verificados localmente (baseline antes de começar)
- [ ] No hardcoded secrets no SPEC ou tasks
- [ ] SPEC-INDEX.md atualizado com esta SPEC

---

## Nota de Encerramento

Esta SPEC é um **hard stop**. Nenhuma feature nova (incluindo continuação de SPEC-009) deve ser iniciada antes de T-010-001 a T-010-006 estarem DONE. A saúde do monorepo é pré-requisito para qualquer inovação subsequente.

> *"Não se constrói no alicerce rachado."*
