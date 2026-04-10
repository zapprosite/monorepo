# ADR-TEMPLATE: Architecture Decision Record Template

**Data:** 2026-04-10
**Status:** ACCEPTED
**Author:** will
**Last Updated:** 2026-04-10

---

## ADR-NNN: Adotar Fastify como Backend HTTP Framework

**Data:** 2026-04-01
**Status:** ACCEPTED
**SPEC Ref:** SPEC-003-api-rest-v2.md

---

## Title

**ADR-NNN: [Decision Title in Imperative Form]**

Example: `ADR-001: Adotar Fastify como Backend HTTP Framework`

---

## Status

**Status:** PROPOSED | ACCEPTED | SUPERSEDED | DEPRECATED

Use the appropriate status:

- **PROPOSED** — Decision is under review, awaiting approval
- **ACCEPTED** — Decision is approved and implemented
- **SUPERSEDED** — Decision was replaced by a newer ADR (include reference)
- **DEPRECATED** — Decision is no longer relevant (include reason)

Example:
```
**Status:** ACCEPTED
**Superseded by:** [ADR-015](./015-titulo.md)
```

---

## Context

### Problem Statement

Describe the situation that necessitates this decision. Include:

- Business context and drivers
- Current pain points or limitations
- Technical constraints
- Stakeholder requirements

Example:
```
O pipeline de desenvolvimento atual utiliza Express.js como framework HTTP.
Durante peak load (300+ req/s), observamos latencia media de 450ms devido ao
blocking JSON parsing e ausencia de request id propagation nativo.

O team reportou que debugging em produção e impossivel sem middleware custom
de correlation IDs. O OpenTelemetry integration requer 3 packages adicionais
e ainda assim nao cobre 100% dos requests.

Precisao: reduzir latencia para <100ms em p95 e eliminar manual correlation
ID middleware.
```

### Technical Background

Optional: Add any relevant technical details that context-setting requires.

Example:
```
Stack atual:
- Runtime: Node.js 20 LTS
- Framework: Express 4.18
- Database: PostgreSQL 15 via Prisma ORM
- Cache: Redis 7
- Deployment: Docker + Coolify

Performance baseline (ab -k -c 50 -n 10000):
- RPS medio: 890
- Latencia p50: 120ms
- Latencia p95: 450ms
- Latencia p99: 890ms
```

---

## Decision

State clearly what was decided. Use active voice and specific terms.

Example:
```
Decidimos migrar o backend HTTP de Express.js para Fastify pelos seguintes motivos:

1. Performance: Fastify usa non-blocking JSON parsing nativo (simd-based),
   resultando em 40-60% reducao de latencia em benchmarks publicos.

2. Developer Experience: Schema-based validation com JSON Schema nativo
   elimina necessidade de express-validator ou joi.

3. Observability: Request id propagation automatico, built-in OpenTelemetry
   hooks, e pino logger integrado.

4. Plugin System: Encapsulated plugins com DI pattern nativo substituem
   middleware composition pattern do Express.

Migration strategy: incremental via reverse-proxy (新旧并行),
maximizando rollback capability.
```

---

## Consequences

### Positive

List beneficial outcomes.

Example:
```
- Latencia reduzida: p95 de 450ms para <100ms (baseado em benchmark interno)
- Debugging simplificado: correlation IDs automaticos em 100% dos requests
- Type safety: JSON Schema validation elimina validacao manual em 80% dos endpoints
- Bundle size: Fastify ~400KB vs Express ~700KB (tree-shakeable)
- Migration risk: incremental rollout via load balancer permite rollback em 5 minutos
```

### Negative

List drawbacks, costs, or risks.

Example:
```
- Learning curve: Team precisa aprender Fastify plugin system e schema syntax
- Breaking changes: Middleware Express nao sao compativeis (requer rewrite)
- Ecosystem: Alguns packages Express-only (e.g., passport.js) precisam adapter
- Operational: Novos health check patterns para Kubernetes probes
```

### Neutral

List side effects that are neither positive nor negative.

Example:
```
- Log format: Mudanca de morgan para pino requer ajuste em Logstash filters
- Metrics labels: Dashboard Grafana precisa de query updates (nao e break)
- Documentation: Todos os ADR internos precisarao referenciar novo stack
- Hiring: Fastify e menos conhecido que Express (porem community growing)
```

---

## Alternatives Considered

Document other options that were evaluated.

### Alternative A: NestJS

Example:
```
**Option:** Migrar para NestJS com Fastify adapter

**Pros:**
- TypeScript-first com decorators nativos
- Dependency injection automatico
- Modular architecture scale melhor para grandes teams

**Cons:**
- Overhead de framework e abstraction layers
- Boot time mais lento (2-3s vs 200ms Fastify)
- Opinionated:强行 opinionated sobre project structure
- Bundle size maior (~1.2MB)

**Verdict:** DESCARTADO — overhead nao justifica benefits para nosso team size (<10 devs)
```

### Alternative B: Hono + Bun

Example:
```
**Option:** Migrar para Hono framework com Bun runtime

**Pros:**
- Ultra-lightweight (~14KB)
- Edge-ready (Cloudflare Workers compatible)
- TypeScript-first com HonoX

**Cons:**
- Ecosystem imaturo (stable since 2023)
- Some middleware (Prisma, OpenTelemetry) requer polyfills
- Bun runtime em production ainda nao e battle-tested em nosso infra
- Team unfamiliar com Bun

**Verdict:** DESCARTADO — risk de immaturity nao compativel com production criticality
```

### Alternative C: Manter Express + Otimizar

Example:
```
**Option:** Otimizar Express existente com:

- express@5 com async middleware nativo
- compression middleware otimizado
- Custom correlation ID middleware

**Pros:**
- Zero migration cost
- Zero new dependencies
- Team ja conhece

**Cons:**
- Latencia p95 nao atingivel sem framework change (estimado: 450ms -> 380ms)
- Correlation ID ainda manual
- Technical debt acumulando (middleware legacy)

**Verdict:** DESCARTADO — nao resolve root cause do problema
```

---

## Notes

Additional information that doesnt fit other sections.

### Implementation Notes

```
- Fastify v4.x com @fastify/cors, @fastify/helmet, @fastify/jwt
- Prisma client mantem (nao muda)
- Migration sequence:
  1. New Fastify service em parallel (blue/green)
  2. Cutover 10% traffic via load balancer
  3. Monitor error rate e latency por 24h
  4. Progressive cutover ate 100%
- Rollback: Traffic 100% back to Express em <5min via label swap
```

### Open Questions

```
- [RESOLVED] Precisa suportar WebSocket? Sim, via @fastify/websocket
- [PENDING] GraphQL vs REST? REST mantem por enquanto, ADR separado
- [PENDING] API versioning strategy? v1 em prefix, v2 async (future ADR)
```

### Related Documents

```
- Fastify Performance: https://fastify.dev/benchmarks/
- Migration Guide: https://fastify.dev/docs/latest/Guides/Migration-Guide-V4/
- Express to Fastify: https://github.com/fastify/fastify/blob/main/docs/Migration-Guide-v4.md
- ADR-012: OpenTelemetry Integration (related)
- SPEC-003: API REST v2 (parent)
```

---

## Metadata

Optional: Include implementation tracking metadata.

```
**Implemented:** 2026-04-15
**Implementation PR:** https://gitea.example.com/will/api/pulls/142
**Completed Checklist:**
- [x] Code review approved
- [x] Integration tests passing
- [x] Load tests passed (p95 < 100ms)
- [x] Documentation updated
- [x] Team training completed
- [x] Rollback procedure tested
```

---

## Template Checklist

When creating a new ADR, ensure all sections are complete:

- [ ] Title: ADR-NNN with clear imperative description
- [ ] Status: Correct status (PROPOSED/ACCEPTED/SUPERSEDED/DEPRECATED)
- [ ] Problem Statement: Clear business and technical context
- [ ] Technical Background: Metrics, constraints, stack details
- [ ] Decision: Specific, actionable decision statement
- [ ] Positive Consequences: Measurable benefits
- [ ] Negative Consequences: Honest drawbacks
- [ ] Neutral Consequences: Side effects
- [ ] Alternatives Considered: At least 2 alternatives with pros/cons
- [ ] Notes: Implementation details, open questions, references
- [ ] Metadata: Tracking info for implemented decisions
