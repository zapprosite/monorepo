---
name: SPEC-060-hermes-agency-post-hardening-improvements
description: 4 post-hardening improvements from SPEC-059 audit — LangGraph error handling, TTS response size limit, skills registry O(1), circuit breaker per skill
status: COMPLETED
priority: high
author: Principal Engineer
date: 2026-04-17
specRef: SPEC-059
---

# SPEC-060: Hermes Agency — Post-Hardening Improvements

> ⚠️ **Serviços Envolvidos:** `apps/hermes-agency/src/langgraph/*.ts`, `apps/hermes-agency/src/skills/index.ts`, `apps/hermes-agency/src/telegram/bot.ts`, `apps/hermes-agency/src/router/agency_router.ts`

> ⚠️ **Não alterar lógica de negócio do CEO MIX** — apenasresiliencia e performance.

---

## Objective

Implementar 4 melhorias identificadas na auditoria de 50 checks do SPEC-059:

1. **HC-23** — Error handling nos LangGraph nodes (17 functions sem try/catch podem corromper graph state em produção 24/7)
2. **HC-31** — Response size limit no TTS (serviço comprometido poderia retornar GB de dados)
3. **HC-33** — Skills registry com Map O(1) em vez de `find()` O(N) (performance em deployments com muitas skills)
4. **HC-36** — Circuit breaker por skill para prevenir degradação progressiva (skill com bug não bloqueia outras)

---

## Tech Stack

| Component                | Technology                           | Notes                             |
| ------------------------ | ------------------------------------ | --------------------------------- |
| LangGraph Error Handling | try/catch + error boundaries         | Prevenir corrupcao de graph state |
| TTS Response Limit       | AbortSignal + hard byte limit        | Prevenir memory exhaustion        |
| Skills Registry          | `Map<string, Skill>`                 | O(1) lookup vs O(N) find()        |
| Circuit Breaker          | Per-skill failure counter + cooldown | Prevenir cascading failures       |

---

## Architecture Overview

### HC-23: Error Handling nos LangGraph Nodes

**Problema atual:** 17 functions em `langgraph/*.ts` executam operacoes async (LLM calls, Qdrant fetch, bot.telegram.sendMessage) sem try/catch. Uma excecao lancada pode deixar o graph num estado inconsistente em producao 24/7.

**Estado atual (antes):**

```
executeLeadQualification(state) { /* sem try/catch — throw pode escapar */ }
creativeNode(state) { /* sem try/catch */ }
videoNode(state) { /* sem try/catch */ }
...
```

**Estado desejado (depois):**

```
executeLeadQualification(state) {
  try {
    const result = await llmComplete(...);
    return { ...state, ...result };
  } catch (err) {
    console.error('[LangGraph] executeLeadQualification failed:', err);
    return { ...state, error: err.message }; // Error boundary — nao corrompe
  }
}
```

**Nota:** LangGraph nodes em erro devem retornar estado com `error` field (nao lancar excecao para cima), permitindo recovery proximo ciclo.

---

### HC-31: TTS Response Size Limit

**Problema atual:** `synthesizeSpeech` em `bot.ts` faz `Buffer.from(await response.arrayBuffer())` sem limite de tamanho. Um servico TTS comprometido poderia retornar GB de audio, causando memory exhaustion.

**Estado atual:**

```typescript
return Buffer.from(await response.arrayBuffer()); // sem limite
```

**Estado desejado:**

```typescript
// Limitar response a 50MB para prevnir memory exhaustion
const MAX_TTS_SIZE = 50 * 1024 * 1024; // 50MB
const arrayBuffer = await response.arrayBuffer();
if (arrayBuffer.byteLength > MAX_TTS_SIZE) {
  throw new Error(`TTS response too large: ${arrayBuffer.byteLength} bytes (max 50MB)`);
}
return Buffer.from(arrayBuffer);
```

---

### HC-33: Skills Registry O(1)

**Problema atual:** `skills/index.ts` usa `AGENCY_SKILLS.find(s => s.id === id)` (O(N)) e `AGENCY_SKILLS.find(s => s.triggers.includes(trigger))` (O(N\*M)). Em datacenter com muitas skills, lookups repetidos afetam performance.

**Estado atual:**

```typescript
export function getSkillById(skillId: string): Skill | undefined {
  return AGENCY_SKILLS.find((s) => s.id === skillId); // O(N)
}

export function getSkillByTrigger(trigger: string): Skill | undefined {
  return AGENCY_SKILLS.find((s) => s.triggers.includes(trigger)); // O(N*M)
}
```

**Estado desejado:**

```typescript
// Build indexes once at startup
const _skillById = new Map<string, Skill>();
const _skillByTrigger = new Map<string, Skill>();

for (const skill of AGENCY_SKILLS) {
  _skillById.set(skill.id, skill);
  for (const t of skill.triggers) _skillByTrigger.set(t, skill);
}

export function getSkillById(skillId: string): Skill | undefined {
  return _skillById.get(skillId); // O(1)
}

export function getSkillByTrigger(trigger: string): Skill | undefined {
  return _skillByTrigger.get(trigger); // O(1)
}
```

**Bonus:** Validar IDs duplicados com `fail-hard` (nao apenas console.error).

---

### HC-36: Circuit Breaker por Skill

> **MIGRATED → SPEC-068** (SPEC-089): Esta implementação foi movida para `skills/circuit_breaker.ts` (SPEC-068) que é agora o módulo canónico. O código inline foi removido do `agency_router.ts`.

**Problema original (para referência):** Se uma skill entra em loop de falhas (excecoes repetidas), continua a ser invocada, causando degradaao progressiva sem auto-recovery.

**Estado desejado:**

```typescript
interface CircuitBreaker {
  failures: number;
  lastFailure: number;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  cooldownMs: number; // tempo para tentar novamente
}

// Configuravel via env var
const CIRCUIT_BREAKER_THRESHOLD = parseInt(
  process.env['HERMES_CIRCUIT_BREAKER_THRESHOLD'] ?? '5',
  10,
);
const CIRCUIT_BREAKER_COOLDOWN_MS = parseInt(
  process.env['HERMES_CIRCUIT_BREAKER_COOLDOWN_MS'] ?? '30000',
  10,
);

const _circuitBreakers = new Map<string, CircuitBreaker>();

function shouldAllowSkill(skillId: string): boolean {
  const cb = _circuitBreakers.get(skillId);
  if (!cb) return true;

  if (cb.state === 'CLOSED') return true;

  if (cb.state === 'OPEN') {
    if (Date.now() - cb.lastFailure > CIRCUIT_BREAKER_COOLDOWN_MS) {
      cb.state = 'HALF_OPEN';
      return true;
    }
    return false;
  }

  // HALF_OPEN: permite uma tentativa
  return true;
}

function recordSkillFailure(skillId: string): void {
  const cb = _circuitBreakers.get(skillId) ?? {
    failures: 0,
    lastFailure: 0,
    state: 'CLOSED',
    cooldownMs: CIRCUIT_BREAKER_COOLDOWN_MS,
  };
  cb.failures++;
  cb.lastFailure = Date.now();

  if (cb.failures >= CIRCUIT_BREAKER_THRESHOLD) {
    cb.state = 'OPEN';
    console.warn(
      `[HermesAgency] Circuit breaker OPEN for skill ${skillId} — cooldown ${CIRCUIT_BREAKER_COOLDOWN_MS}ms`,
    );
  }

  _circuitBreakers.set(skillId, cb);
}

function recordSkillSuccess(skillId: string): void {
  const cb = _circuitBreakers.get(skillId);
  if (cb) {
    cb.failures = 0;
    cb.state = 'CLOSED';
  }
}
```

**Integrao no router:**

```typescript
export async function executeSkill(skillId: string, context: SkillContext): Promise<string> {
  if (!shouldAllowSkill(skillId)) {
    return `⚠️ Skill ${skillId} temporarily unavailable (circuit breaker open). Try again later.`;
  }

  try {
    const result = await skill.execute(context);
    recordSkillSuccess(skillId);
    return result;
  } catch (err) {
    recordSkillFailure(skillId);
    throw err;
  }
}
```

---

## Decisions Log

| Date       | Decision                                          | Rationale                                                                              |
| ---------- | ------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 2026-04-17 | Error handling via return state com `error` field | LangGraph nodes em erro retornam estado, nao lancam — previne corrupcao de graph       |
| 2026-04-17 | 50MB como limite maximo para TTS response         | Telegram voice messages limite 50MB, audio maior que isso e invalido de qualquer forma |
| 2026-04-17 | Map indexing no startup (lazy initialization)     | Indexes construidos uma vez, nao em cada chamada — O(1) garantido                      |
| 2026-04-17 | 5 falhas como threshold do circuit breaker        | Failures >= 5 em curta janela indica bug na skill, nao sobrecarga temporaria           |
| 2026-04-17 | Circuit breaker cooldown 30s                      | Tempo suficiente para operador investigar sem bloquear[REMOVIDO-CJK] completamente               |

---

## Code Style

Mesmo padrao anti-hardcoded dos restantes componentes Hermes Agency:

```typescript
// ✅ CORRETO — env var com fallback documentado
const CIRCUIT_BREAKER_THRESHOLD = parseInt(
  process.env['HERMES_CIRCUIT_BREAKER_THRESHOLD'] ?? '5',
  10,
);
const MAX_TTS_SIZE = parseInt(process.env['HERMES_MAX_TTS_SIZE_BYTES'] ?? '52428800', 10); // 50MB

// ❌ ERRADO — hardcoded
const MAX_TTS_SIZE = 50 * 1024 * 1024; // PROIBIDO
```

---

## Non-Goals

- **Nao** adicionar prometheus metrics para circuit breaker (SPEC-023 ja cobre)
- **Nao** alterar a logica de routing do CEO MIX (skill selection)
- **Nao** adicionar retry logic automatico (circuit breaker apenas abre, nao faz retry)
- **Nao** alterar LangGraph state schema (apenas adicionar error handling)

---

## Goals

### Must Have

- [x] **HC-23**: Error handling com try/catch nos 17 LangGraph nodes
- [x] **HC-31**: TTS response size limit 50MB com Buffer limit check
- [x] **HC-33**: Skills registry Map O(1) + validacao de IDs duplicados fail-hard
- [x] **HC-36**: Circuit breaker por skill com threshold 5 / cooldown 30s

### Should Have

- [x] ESLint compilacao sem errors
- [ ] Smoke test para circuit breaker (skill unavailable retorna mensagem correta)

---

## Acceptance Criteria

| #    | Criterion                                                             | Test                                                                                  |
| ---- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| AC-1 | LangGraph node que falha retorna estado com `error` field (nao throw) | Node throw → state.error preenchido, graph continua                                   |
| AC-2 | TTS response >50MB lancah exception com mensagem clara                | Mock TTS retorna 60MB → `Error: TTS response too large: 62914560 bytes (max 50MB)`    |
| AC-3 | Skills registry lookup e O(1)                                         | `getSkillById` e `getSkillByTrigger` nao usam `find()`                                |
| AC-4 | Skill com 5 falhas consecutivas abre circuit breaker                  | Mock skill falha 5x → `circuit breaker OPEN` logged, 6a invocacao retorna unavailable |
| AC-5 | Circuit breaker fecha automaticamente apos cooldown                   | Apos 30s em OPEN → volta a `HALF_OPEN`, proxima tentativa succeed → `CLOSED`          |
| AC-6 | ESLint passa com 0 errors                                             | `pnpm eslint apps/hermes-agency/src/ --max-warnings=999` → 0 errors                   |

---

## Files to Modify

| File                                                     | Change                                                                                                                 |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `apps/hermes-agency/src/langgraph/lead_qualification.ts` | try/catch em todas as functions                                                                                        |
| `apps/hermes-agency/src/langgraph/content_pipeline.ts`   | try/catch em todos os nodes                                                                                            |
| `apps/hermes-agency/src/langgraph/social_calendar.ts`    | try/catch em todas as functions                                                                                        |
| `apps/hermes-agency/src/skills/index.ts`                 | Map O(1) + validacao fail-hard                                                                                         |
| `apps/hermes-agency/src/router/agency_router.ts`         | Circuit breaker + env vars                                                                                             |
| `apps/hermes-agency/src/telegram/bot.ts`                 | TTS response size limit                                                                                                |
| `.env`                                                   | `HERMES_CIRCUIT_BREAKER_THRESHOLD=5`, `HERMES_CIRCUIT_BREAKER_COOLDOWN_MS=30000`, `HERMES_MAX_TTS_SIZE_BYTES=52428800` |
| `.env.example`                                           | Placeholders para novas env vars                                                                                       |

---

## Open Questions

| #    | Question                                                                                                       | Impact | Priority |
| ---- | -------------------------------------------------------------------------------------------------------------- | ------ | -------- |
| OQ-1 | Circuit breaker deve ser por skillId ou por skill instance? (mesma skill em diferentes users cuenta separada?) | Medium | Low      |
| OQ-2 | Error state no LangGraph deve guardar mensagem completa ou apenas code?                                        | Medium | Low      |

---

## Dependencies

| Dependency | Status    | Notes                    |
| ---------- | --------- | ------------------------ |
| SPEC-059   | COMPLETED | Baseline de hardening    |
| SPEC-058   | COMPLETED | Hermes Agency Suite base |
