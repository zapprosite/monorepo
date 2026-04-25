# Nexus Guide — 7×7 Agent Harness

Guia prático para usar o Nexus framework com 49 agentes especializados.

---

## Quick Start

```bash
# Listar todos os modos e agentes
nexus.sh --mode list

# Ver agentes de um modo específico
nexus.sh --mode test
nexus.sh --mode debug
nexus.sh --mode docs

# Ver o system-prompt de um agente específico
nexus.sh --mode docs --agent adr-writer
nexus.sh --mode backend --agent auth-engineer

# Workflow completo com SPEC
nexus.sh --spec SPEC-204 --phase plan
nexus.sh --spec SPEC-204 --phase review
nexus.sh --spec SPEC-204 --phase execute --parallel 15
nexus.sh --spec SPEC-204 --phase verify
nexus.sh --spec SPEC-204 --phase complete
```

---

## Arquitectura

```
Nexus = vibe-kit (loop runner) + PREVC (workflow) + 49 agents (execution)

PREVC Phases:
  P → R → E → V → C
  │   │   │   │   │
  │   │   │   │   └─ Complete (deploy + docs)
  │   │   │   └──── Verify (test suite + review)
  │   │   └──────── Execute (15 workers paralelos)
  │   └──────────── Review (risk assessment)
  └───────────────── Plan (SPEC → queue.json)
```

---

## Os 7 Modos

### debug — Diagnóstico e Troubleshooting

Quando algo quebra, usa este modo.

```bash
nexus.sh --mode debug
```

| Agente | Use When |
|--------|----------|
| `log-diagnostic` | Erros em logs, padrões de erro, bursts |
| `stack-trace` | Exceptions, crashes, stack analysis |
| `perf-profiler` | CPU/memory/IO lentidão, memory leaks |
| `network-tracer` |Timeouts DNS/HTTP/TLS, connectivity |
| `security-scanner` | CVEs, secrets expostos, injection |
| `sre-monitor` | Alert triage, SLO/SLA breaches |
| `incident-response` | Service outage, P1 incidents |

**Exemplo prático:**
```bash
# Analisar um crash
nexus.sh --mode debug --agent stack-trace
# Copia o stack trace para o agente analisar

# Diagnosticar logs
nexus.sh --mode debug --agent log-diagnostic
# Faz parsing de JSON logs, detecta padrões
```

---

### test — Testing

Para escrever e validar testes.

```bash
nexus.sh --mode test
```

| Agente | Use When |
|--------|----------|
| `unit-tester` | Funções, lógica pura, edge cases |
| `integration-tester` | APIs, queries DB, integrações |
| `e2e-tester` | User flows completos, Playwright/Cypress |
| `coverage-analyzer` | Coverage gaps, thresholds |
| `boundary-tester` | Min/max/empty/null values |
| `flaky-detector` | Testes intermitentes, timing issues |
| `property-tester` | fast-check, invariants algébricos |

**Exemplo prático:**
```bash
# Gerar testes unitários para um ficheiro
nexus.sh --mode test --agent unit-tester
# Instruções: Lê o source, gera testes Jest/Vitest

# Analisar coverage
nexus.sh --mode test --agent coverage-analyzer
# Executa pnpm test -- --coverage, reporta gaps
```

---

### backend — API, Services, Database

Para desenvolver o backend.

```bash
nexus.sh --mode backend
```

| Agente | Use When |
|--------|----------|
| `api-developer` | Novos endpoints REST/GraphQL, OpenAPI |
| `service-architect` | DI containers, composição de serviços |
| `db-migrator` | Schema migrations Postgres, Rollback |
| `cache-specialist` | Redis cache-aside, TTL, invalidation |
| `auth-engineer` | JWT, sessions, OAuth, RBAC |
| `event-developer` | RabbitMQ/Kafka, event sourcing, CQRS |
| `file-pipeline` | Uploads, processamento de ficheiros |

**Exemplo prático:**
```bash
# Criar um novo endpoint
nexus.sh --mode backend --agent api-developer
# Instruções: Define schema Zod, implementa route, documenta OpenAPI

# Adicionar caching Redis
nexus.sh --mode backend --agent cache-specialist
# Instruções: Implementa cache-aside pattern com TTL
```

---

### frontend — UI, Components, Styling

Para desenvolver o frontend.

```bash
nexus.sh --mode frontend
```

| Agente | Use When |
|--------|----------|
| `component-dev` | Novos componentes React/Vue |
| `responsive-dev` | Mobile-first CSS, breakpoints |
| `state-manager` | Zustand/Redux/React Query |
| `animation-dev` | Framer Motion, transições CSS |
| `a11y-auditor` | WCAG 2.1 AA, ARIA, keyboard nav |
| `perf-optimizer` | Core Web Vitals, LCP/INP/CLS |
| `design-system` | Design tokens, themes, multi-brand |

**Exemplo prático:**
```bash
# Criar componente React
nexus.sh --mode frontend --agent component-dev
# Instruções: Cria .tsx com TypeScript, Storybook story

# Audit de acessibilidade
nexus.sh --mode frontend --agent a11y-auditor
# Instruções: Verifica ARIA labels, keyboard nav, contrast
```

---

### review — Code Review

Para fazer review de código.

```bash
nexus.sh --mode review
```

| Agente | Use When |
|--------|----------|
| `correctness-reviewer` | Lógica, edge cases, spec adherence |
| `readability-reviewer` | Naming, complexidade, dead code |
| `architecture-reviewer` | Dependencies, circular deps, layers |
| `security-reviewer` | OWASP Top 10, secrets, injection |
| `perf-reviewer` | N+1 queries, pagination, bundle size |
| `dependency-auditor` | Outdated packages, CVEs, licenses |
| `quality-scorer` | Aggregate score, gate pass/fail |

**Exemplo prático:**
```bash
# Review completo de security
nexus.sh --mode review --agent security-reviewer
# Instruções: Verifica OWASP Top 10, secrets no código

# Aggregate quality score
nexus.sh --mode review --agent quality-scorer
# Instruções: Soma findings, calcula score 0-100
```

---

### docs — Documentação

Para gerar e manter documentação.

```bash
nexus.sh --mode docs
```

| Agente | Use When |
|--------|----------|
| `api-doc-writer` | OpenAPI specs, Swagger UI |
| `readme-writer` | README, getting started guides |
| `changelog-writer` | Keepachangelog, release notes |
| `inline-doc-writer` | JSDoc, TypeDoc, comments |
| `diagram-generator` | Mermaid flows, ER diagrams |
| `adr-writer` | Architecture Decision Records |
| `doc-coverage-auditor` | Docs completeness, gaps |

**Exemplo prático:**
```bash
# Gerar ADR
nexus.sh --mode docs --agent adr-writer
# Instruções: Escreve ADR para decisão técnica

# Documentar API
nexus.sh --mode docs --agent api-doc-writer
# Instruções: Gera OpenAPI 3.1 YAML from routes
```

---

### deploy — Docker, Coolify, Rollback

Para deployment e operações.

```bash
nexus.sh --mode deploy
```

| Agente | Use When |
|--------|----------|
| `docker-builder` | Multi-stage Dockerfile, BuildKit |
| `compose-orchestrator` | Docker Compose, healthchecks |
| `coolify-deployer` | Deploy via Coolify API |
| `secret-rotator` | Env rotation, Vault integration |
| `rollback-executor` | Rollback deploy/migration |
| `zfs-snapshotter` | ZFS snapshots, pre-deploy safety |
| `health-checker` | Health endpoints, smoke tests |

**Exemplo prático:**
```bash
# Build Docker image otimizada
nexus.sh --mode deploy --agent docker-builder
# Instruções: Multi-stage Dockerfile, não-root user

# Deploy via Coolify
nexus.sh --mode deploy --agent coolify-deployer
# Instruções: Trigger API, poll status, health check
```

---

## PREVC Workflow — Exemplo Completo

### 1. Plan (criar SPEC e queue)

```bash
# Criar SPEC.md com requirements
nano docs/SPEC-205.md

# Inicializar workflow
nexus.sh --spec SPEC-205 --phase plan
# Lê SPEC.md, extrai ACs, cria queue.json com tasks
# Cada task tem agent_role atribuído (e.g., backend/api-developer)

# Editar queue.json para ajustar agentes se necessário
nano .claude/vibe-kit/queue.json
```

### 2. Review (avaliar riscos)

```bash
nexus.sh --spec SPEC-205 --phase review
# human approval gate
# Review agents avaliam: feasibility, risks, dependencies
```

### 3. Execute (correr workers)

```bash
nexus.sh --spec SPEC-205 --phase execute --parallel 15
# 15 workers processam queue.json em paralelo
# ZFS snapshot自动 cada 3 tasks
# Em caso de falha: debug-agent diagnostics
```

### 4. Verify (validar qualidade)

```bash
nexus.sh --spec SPEC-205 --phase verify
# human approval gate
# Executa: pnpm test, pnpm tsc, pnpm lint, pnpm build
# Quality gates avaliados
```

### 5. Complete (deploy final)

```bash
nexus.sh --spec SPEC-205 --phase complete
# deploy-agent deploys
# docs-agent finalizes docs
# ZFS snapshot final
# PR criado
```

---

## Agentes Individuais — Como Usar

Cada agente tem um `system-prompt.md` com:

1. **Capabilities** — o que sabe fazer
2. **Protocol** — passos que segue
3. **Output Format** — formato do output JSON
4. **Handoff** — para quem passa o testemunho depois

**Para usar um agente específico:**

```bash
# Ver o prompt completo
nexus.sh --mode backend --agent auth-engineer

# Num contexto real, o agente seria invocado via:
mclaude -p "You are auth-engineer. Implement JWT auth for /api/login"
```

---

## Rate Limiting (500 RPM)

Para testes que fazem requests externos:

```bash
# Teste isolado em worktree com rate limit
bash .claude/vibe-kit/scripts/test-worktree.sh SPEC-204 'pnpm test'

# O script:
# - Cria git worktree isolado
# - Instala deps
# - Executa com delay de 0.12s entre requests (500 RPM)
# - Faz cleanup automático
```

---

## ZFS Snapshots

Nexus cria snapshots ZFS automaticamente:

```
tank@nexus-SPEC-205-plan-20260424T120000
tank@nexus-SPEC-205-review-20260424T120500
tank@nexus-SPEC-205-execute-20260424T121000
tank@nexus-SPEC-205-verify-20260424T121500
tank@nexus-SPEC-205-complete-20260424T122000
```

**Rollback se algo correr mal:**
```bash
sudo zfs rollback -r tank@nexus-SPEC-205-execute-20260424T120000
```

---

## Ficheiros Principais

| Ficheiro | Purpose |
|----------|---------|
| `.claude/vibe-kit/nexus.sh` | Entry point |
| `.claude/vibe-kit/queue.json` | Task queue |
| `.claude/vibe-kit/state.json` | Phase state |
| `.claude/vibe-kit/agents/{mode}/{agent}/system-prompt.md` | Agent prompts |
| `.claude/vibe-kit/scripts/test-worktree.sh` | Isolated testing |
| `docs/SPEC-204.md` | Framework specification |

---

## Tips & Tricks

### Escolher o agente certo
- **Não sabes qual?** Usa `nexus.sh --mode list` para ver todos
- **Múltiplos agentes?** Podes correr vários em paralelo para coisas independentes
- **Handoff chain:** Cada output diz para quem passar — segue a cadeia

### Debugging
- Logs em `.claude/vibe-kit/logs/`
- State em `.claude/vibe-kit/state.json`
- Snapshot se algo correr mal: `nexus.sh --snapshot`

### CI Mode
```bash
nexus.sh --spec SPEC-205 --phase execute --parallel 15 --force
# --force skipa todos os human gates
```

### Resume
```bash
nexus.sh --resume
# Retoma do ponto onde parou (lê state.json)
```

---

## Quick Reference Card

```
nexus.sh --mode list                              # Todos os modos
nexus.sh --mode test                              # Listar agentes test
nexus.sh --mode test --agent unit-tester         # Ver prompt unit-tester

nexus.sh --spec SPEC-205 --phase plan             # Iniciar workflow
nexus.sh --spec SPEC-205 --phase execute         # Executar tasks
nexus.sh --spec SPEC-205 --phase verify          # Verificar
nexus.sh --status                                # Estado atual
nexus.sh --resume                                # Retomar
nexus.sh --snapshot                              # Snapshot ZFS
```
