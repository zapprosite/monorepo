# Enterprise Review Aggregate — 2026-04-26
**Monorepo:** /srv/monorepo | **Nexus 7 Agents** | **Helix Scanner**

---

## Executive Summary

| Category | Critical | High | Medium | Low | Score |
|----------|----------|------|--------|-----|-------|
| Security | 4 | 3 | 2 | 1 | 4.5/10 |
| Correctness | 3 | 4 | 2 | 1 | 5.0/10 |
| Performance | 2 | 3 | 2 | 2 | 5.5/10 |
| Architecture | 1 | 2 | 3 | 3 | 6.5/10 |
| Dependencies | 0 | 2 | 4 | 2 | 7.0/10 |
| Readability | 0 | 1 | 4 | 3 | 7.5/10 |
| **TOTAL** | **10** | **15** | **17** | **12** | **6.0/10** |

---

## Critical Issues (BLOCKING)

### 🔴 Security
1. **IDOR em 40+ endpoints** — Sem filtro team/user em list queries
   - `clients.trpc.ts`, `leads.trpc.ts`, `contracts.trpc.ts`, etc.
   - Qualquer usuário autenticado acessa TODOS os registros

2. **AI Gateway sem rate limiting** — `/v1/chat/completions`, `/v1/audio/*`
   - Vulnerável a DoS

3. **SSRF via STT_URL** — `audio-transcriptions.ts:103`
   - attacker pode redirecionar para internal network

### 🔴 Correctness
4. **TypeScript: 340+ erros de tipo** — Bloqueia build
   - `apps/api`: 329 erros
   - `apps/ai-gateway`: 11 erros

5. **SQL Injection risk** — `webhookQueue.utils.ts:222`
   - String interpolation em SQL interval

6. **Upsert broken** — `session.auth.store.ts:40-62`
   - Encadeia `findBy` → `upsert` incorretamente

### 🔴 Performance
7. **Missing pagination** — `journal_entries.trpc.ts`
   - Retorna TODOS os registros sem limite

8. **N+1 queries** — `webhookProcessor.ts`
   - Loop faz query por item

### 🔴 Architecture
9. **God Module anti-pattern** — `db.ts`
   - 30+ table imports, 27 módulos dependem dele

---

## High Priority

| Issue | File | Fix |
|-------|------|-----|
| Rate limiter memory leak | `teamRateLimit.middleware.ts:6` | Clear Map periodically |
| vibe-kit elapsed bug | `vibe-kit.sh:26-35` | START_EPOCH timing issue |
| Inverted launch logic | `vibe-kit-launcher.sh:28` | `pending=0 && done>=5` wrong |
| ESM/CJS mismatch | `webhookProcessor.ts:87` | `require.main` not ESM |

---

## Medium Priority

- Mixed Portuguese/Spanish em `mcp-conectores`
- 8 packages desatualizados (eslint, lint-staged)
- 27 modules poderiam ser separate packages
- scripts/ bloat (50+ scripts)

---

## Recommendations

### Phase 1 (This Week)
1. Fix IDOR — adicionar filtro team em todos os endpoints
2. Corrigir TypeScript errors (329 em api/)
3. Adicionar rate limiting ao AI Gateway

### Phase 2 (This Month)
4. Decompose db.ts em per-module registries
5. Implement pagination em journal entries
6. Fix N+1 queries

### Phase 3 (Next Quarter)
7. Extract stable modules → packages/
8. Document scripts/ taxonomy
9. Move hermes symlink to /srv/

---

## Quality Score: 6.0/10

**Verdict:** Needs immediate attention on security and correctness before production deployment.

---

*Generated: 2026-04-26 | Nexus 7 Agents + Helix Scanner*
