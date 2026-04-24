---
name: SPEC-068-langgraph-circuit-breaker
description: "CANONICAL — Circuit breaker por skill agent — evita cascade failures quando uma skill falha repetidamente. Substitui HC-36 de SPEC-060 (migrado em SPEC-089). Buddy with SPEC-060."
spec_id: SPEC-068
status: CANONICAL
priority: high
author: Claude Code
date: 2026-04-18
---

# SPEC-068: Circuit Breaker por Skill — Hermes Gateway Suite

## Problema

Quando uma skill (ex: `agency-analytics`, `agency-creative`) falha repetidamente (ex: LLM timeout, Qdrant indisponível), o sistema continua a enviar pedidos para a skill degradada, desperdiçando recursos e acumulando latência. Não há mecanismo de "trip" que pare de invocar a skill até ela recuperar.

## Estado Atual

| Componente | Status | Notas |
|-----------|--------|-------|
| LangGraph error handling | ✅ Existe | try/catch + error state em cada node |
| TTS response size limit | ✅ Existe | `bot.ts:267` — 50MB MAX_TTS_SIZE |
| Skills registry O(1) | ✅ Existe | `skills/index.ts:253-254` — Map lookup |
| **Circuit breaker per skill** | ✅ IMPLEMENTADO | `router.ts:11-71` + `skills/circuit_breaker.ts` |

## Goals

1. **Prevenir cascade failures** — skill que falha 3x seguidas é "tripped"
2. **Auto-recovery** — após 30s, tenta novamente (half-open)
3. **Transparência** — logs claros no estado do circuit breaker
4. **Sem impacto** — fallback graceful quando circuit breaker está aberto

---

## Design

### Modelo de Estados

```
CLOSED (normal)
  │  3 falhas consecutivas → OPEN
  ▼
OPEN (tripped)
  │  30s timeout → HALF_OPEN
  ▼
HALF_OPEN (testando)
  │  sucesso → CLOSED
  │  falha → OPEN (reset timer)
  ▼
```

### Ficheiros

| Ficheiro | Descrição |
|----------|-----------|
| `skills/circuit_breaker.ts` | Módulo partilhado — interface + funções |
| `router/agency_router.ts:11-71` | CB local integrado (mesmo padrão) |
| `index.ts` | `GET /health/circuit-breakers` endpoint |

---

## Tarefas

### T-1: Módulo circuit_breaker.ts ✅

`apps/hermes-gateway/src/skills/circuit_breaker.ts`:
- `CircuitBreakerState` interface
- `isCallPermitted(skillId)` — check se chamada permitida
- `recordSuccess(skillId)` — reset failure count
- `recordFailure(skillId, reason)` — incrementa e tripa se threshold
- `getAllCircuitBreakers()` — para /health endpoint
- `resetCircuitBreaker(skillId)` — para tests/admin

### T-2: Integração router.ts ✅

- `shouldAllowSkill()` verificado antes de cada skill (lines 162-165)
- `recordSkillSuccess()` após sucesso (lines 177, 185, 189)
- `recordSkillFailure()` no catch (line 192)

### T-3: Endpoint /health/circuit-breakers ✅

`GET /health/circuit-breakers?userId=XXX` — admin-only (HERMES_ADMIN_USER_IDS)

### T-4: Unit tests ✅

`__tests__/circuit_breaker.test.ts` — 12 testes cobrindo todas as transições

---

## Acceptance Criteria

- [x] `apps/hermes-gateway/src/skills/circuit_breaker.ts` criado com interface + funções
- [x] `router.ts` invoca CB antes de cada skill (local CB, lines 162-165)
- [x] `recordSuccess()` chamada após skill completar com sucesso
- [x] `recordFailure()` chamada quando skill lança exceção
- [x] `GET /health/circuit-breakers` retorna estado de todos os circuit breakers
- [x] Skill que falha 3x consecutivas entra em OPEN
- [x] Após 30s em OPEN, skill passa para HALF_OPEN automaticamente
- [x] Log formatado `[CircuitBreaker] skillId: state=X` em todas as transições
- [x] Unit tests para circuit_breaker.ts (12 testes passing)
- [x] SPEC-068 written and reviewed

---

## Files Affected

- `apps/hermes-gateway/src/skills/circuit_breaker.ts` — **NOVO**
- `apps/hermes-gateway/src/router/router.ts` — CB local (já existia)
- `apps/hermes-gateway/src/index.ts` — endpoint `/health/circuit-breakers`
- `apps/hermes-gateway/src/__tests__/circuit_breaker.test.ts` — **NOVO**
- `SPEC-068` (este ficheiro)

---

## Dependencies

- SPEC-060 (post-hardening improvements — error handling, TTS limit, skills O(1))
- SPEC-058 (Hermes Gateway Suite — 11 skills)
