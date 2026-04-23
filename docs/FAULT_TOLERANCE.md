# Fault Tolerance Architecture — Hermes Agency

> **Versão:** 1.0.0
> **Data:** 2026-04-23
> **Autor:** Principal Engineer — Platform Governance
> **Status:** Proposta

---

## 1. Visão Geral

Este documento define a arquitetura de tolerância a falhas para o Hermes Agency, estabelecendo mecanismos de proteção contra falhas em cascata, degradação graciosa de serviços, e padrões de fallback para manter a resiliência do sistema.

### Objetivos

- **Continuidade operacional** — sistema permanece funcional mesmo com falhas parciais
- **Prevenção de falhas em cascata** — circuit breakers isolam componentes falhantes
- **Degradação graciosa** — serviços essenciais continuam operando sem dependências opcionais
- **Observabilidade** — métricas e logs para diagnóstico de falhas
- **Testabilidade** — caos engineering para validar resiliência

---

## 2. Arquitetura de Circuit Breaker

### 2.1 Granularidade Híbrida

O circuit breaker opera em **dois níveis**:

```
┌─────────────────────────────────────────────────────────────┐
│                      CIRCUIT BREAKERS                       │
├─────────────────────────────────────────────────────────────┤
│  NÍVEL SKILL (Hermes Agency Skills)                         │
│  ├── agency-ceo          → per-skill breaker                │
│  ├── agency-onboarding  → per-skill breaker                │
│  ├── agency-video-editor→ per-skill breaker                │
│  ├── agency-organizer    → per-skill breaker                │
│  ├── agency-creative     → per-skill breaker                │
│  ├── agency-design       → per-skill breaker                │
│  ├── agency-social       → per-skill breaker                │
│  ├── agency-pm           → per-skill breaker                │
│  ├── agency-analytics    → per-skill breaker                │
│  ├── agency-brand-guardian → per-skill breaker             │
│  ├── rag-instance-organizer → per-skill breaker            │
│  └── agency-client-success → per-skill breaker             │
├─────────────────────────────────────────────────────────────┤
│  NÍVEL FERRAMENTA (Tool Registry)                          │
│  ├── qdrant_*         → breaker por collection             │
│  ├── rag_*            → breaker por dataset                 │
│  ├── mem0_*           → breaker por memory store            │
│  ├── postgres_*       → breaker por connection pool         │
│  ├── llm_complete     → breaker por provider (minimax/ollama)│
│  └── redis_*         → breaker por operation type          │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Estados do Circuit Breaker

```
                    ┌───────────────────────────────────────┐
                    │                                       │
                    ▼                                       │
              ┌──────────┐      failure ≥ threshold    ┌─────┴─────┐
    ┌────────▶│  CLOSED  │────────────────────────────▶│   OPEN   │
    │         └──────────┘                              └──────────┘
    │               ▲                                          │
    │               │         success during half_open         │
    │               │                                          │
    │               │    ┌──────────────────────────────────┐   │
    │               │    │                                  │   │
    │               │    ▼                                  │   │
    │         ┌──────────┐     failure during half_open     │   │
    │         │ HALF_OPEN│─────────────────────────────────┘   │
    │         └──────────┘                                    │
    │               │                                          │
    │               │ recovery_timeout elapsed                 │
    └───────────────┴──────────────────────────────────────────┘
```

**Transições:**

| Estado | Comportamento | Transição para CLOSED | Transição para OPEN |
|--------|---------------|----------------------|---------------------|
| `CLOSED` | Operações normais | — | `failureCount ≥ threshold` |
| `HALF_OPEN` | Permite 1 request de teste | Success | Failure |
| `OPEN` | Rejeita todas as operações | `recovery_timeout` expirado | — |

### 2.3 Thresholds Configuráveis por Ferramenta

```typescript
// Critérios para classificação de criticidade
type ToolCriticality = 'critical' | 'high' | 'medium' | 'low';

const TOOL_THRESHOLDS: Record<string, { failureThreshold: number; recoveryTimeoutMs: number; backoffMultiplier: number }> = {
  // Critical — 2 failures, 30s recovery, no backoff
  'qdrant_*':              { failureThreshold: 2, recoveryTimeoutMs: 30_000, backoffMultiplier: 1.0 },
  'postgres_*':            { failureThreshold: 2, recoveryTimeoutMs: 30_000, backoffMultiplier: 1.0 },
  'mem0_*':                { failureThreshold: 3, recoveryTimeoutMs: 30_000, backoffMultiplier: 1.0 },

  // High — 3 failures, 60s recovery, 1.5x backoff
  'llm_complete':          { failureThreshold: 3, recoveryTimeoutMs: 60_000, backoffMultiplier: 1.5 },
  'rag_*':                 { failureThreshold: 3, recoveryTimeoutMs: 60_000, backoffMultiplier: 1.5 },

  // Medium — 5 failures, 2min recovery, 2x backoff
  'redis_*':               { failureThreshold: 5, recoveryTimeoutMs: 120_000, backoffMultiplier: 2.0 },
  'generate_script':       { failureThreshold: 5, recoveryTimeoutMs: 120_000, backoffMultiplier: 2.0 },
  'write_copy':            { failureThreshold: 5, recoveryTimeoutMs: 120_000, backoffMultiplier: 2.0 },

  // Low — 10 failures, 5min recovery, 3x backoff
  'analyze_engagement':    { failureThreshold: 10, recoveryTimeoutMs: 300_000, backoffMultiplier: 3.0 },
  'create_mood_board':     { failureThreshold: 10, recoveryTimeoutMs: 300_000, backoffMultiplier: 3.0 },
};
```

### 2.4 Exponential Backoff

Quando um circuit breaker transita de OPEN para HALF_OPEN, o timeout de recuperação aumenta exponencialmente:

```
recoveryTimeout = BASE_RECOVERY_TIMEOUT × (backoffMultiplier ^ failureStreak)

Exemplo (backoffMultiplier=1.5):
  Streak 0: 30s
  Streak 1: 45s
  Streak 2: 67.5s
  Streak 3: 101.25s
  Streak 4: 151.87s
  Streak 5: 227.81s (max: 10 minutes)
```

### 2.5 Persistência em Redis

**Key Schema:**
```
hermes:cb:skill:{skillId}         → CircuitBreakerState (JSON)
hermes:cb:tool:{toolPattern}      → CircuitBreakerState (JSON)
hermes:cb:provider:{providerName}  → CircuitBreakerState (JSON)
hermes:cb:stats:{skillId}         → { successCount, failureCount, avgLatencyMs }
```

**TTL Strategy:**
- OPEN state: `recoveryTimeout * 2` (garantir que sobrevive a restart)
- CLOSED state: `3600s` (1h, renova a cada success)
- HALF_OPEN state: `60s` (teste rápido)

---

## 3. Degradação Graciosa

### 3.1 Dependency Graph

```
┌──────────────────────────────────────────────────────────────────┐
│                     HERMES AGENCY CORE                           │
│                                                                  │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐         │
│  │ LiteLLM     │     │ Ollama      │     │ PostgreSQL  │         │
│  │ (:4000)     │     │ (:11434)    │     │ MCP         │         │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘         │
│         │                   │                   │                 │
│         └───────────┬───────┴───────────────────┘                 │
│                     ▼                                             │
│              ┌─────────────┐     ┌─────────────┐                   │
│              │ LLM Router  │     │ Skill       │                   │
│              │             │────▶│ Executor    │                   │
│              └──────┬──────┘     └─────────────┘                   │
│                     │                                             │
│         ┌───────────┼───────────┐                                  │
│         ▼           ▼           ▼                                  │
│  ┌────────────┐ ┌─────────┐ ┌────────────┐                         │
│  │ Mem0      │ │ Qdrant  │ │ Trieve RAG │                         │
│  │ (memory)  │ │ (tasks) │ │ (search)   │                         │
│  └────────────┘ └─────────┘ └────────────┘                         │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 Fallback Strategy Matrix

| Dependency | Failure Mode | Fallback Behavior | User Impact |
|------------|--------------|-------------------|-------------|
| **Mem0** | Connection timeout, OOM | Continue sem contexto de memória | "Using general knowledge" |
| **Qdrant** | Connection refused, search timeout | Retorna erro para operações de task | "Task storage unavailable" |
| **Trieve RAG** | Search fails | Usa LLM sem contexto RAG | "Generic response" |
| **PostgreSQL MCP** | Query timeout, auth failure | Retorna erro para operações DB | "Database temporarily unavailable" |
| **Ollama** | Model not found, inference timeout | Fallback para LiteLLM | — (transparente) |
| **LiteLLM** | All providers fail | Retorna erro com retry-after | "Service overloaded" |
| **Redis** | Connection refused | In-memory fallback para rate limiting | Rate limiting desabilitado |

### 3.3 Implementation Pattern

```typescript
// Pattern: Degradação graciosa com fallback chain
async function executeWithGracefulDegradation(
  operation: string,
  primary: () => Promise<T>,
  fallbacks: Array<{ name: string; fn: () => Promise<T> }>,
  onDegradation?: (msg: string) => void
): Promise<T> {
  try {
    return await primary();
  } catch (primaryError) {
    console.warn(`[Degradation] ${operation} primary failed: ${primaryError}`);

    for (const fallback of fallbacks) {
      try {
        const result = await withTimeout(fallback.fn(), 10000, `fallback:${fallback.name}`);
        onDegradation?.(`Using ${fallback.name} fallback`);
        return result;
      } catch (fallbackError) {
        console.warn(`[Degradation] ${operation} fallback ${fallback.name} failed: ${fallbackError}`);
      }
    }

    throw new ServiceUnavailableError(operation, primaryError);
  }
}
```

---

## 4. Provider Fallback Chain

### 4.1 LLM Provider Priority

```
Priority 1: MiniMax (via LiteLLM :4000)
    ↓ (fail → 5s timeout)
Priority 2: Ollama (:11434) — gemma4-12b-it
    ↓ (fail → 30s timeout)
Priority 3: Groq (via LiteLLM)
    ↓ (fail → 10s timeout)
Priority 4: OpenAI (via LiteLLM)
    ↓ (all fail)
Error: "All LLM providers unavailable"
```

### 4.2 Embeddings Fallback

```
Priority 1: Ollama nomic-embed-text (:11434)
    ↓ (fail → 15s timeout)
Priority 2: OpenAI text-embedding-ada-002 (via LiteLLM)
    ↓ (all fail)
Warning: "Embeddings unavailable — semantic search disabled"
```

### 4.3 Code Implementation

```typescript
// src/litellm/fallback-router.ts

const LLM_PROVIDERS = [
  { name: 'minimax', url: 'http://lite-llm:4000', model: 'minimax-m2.7', timeout: 5000 },
  { name: 'ollama', url: 'http://ollama:11434', model: 'gemma4-12b-it', timeout: 30000 },
  { name: 'groq', url: 'http://lite-llm:4000', model: 'groq/llama-3.3-70b', timeout: 10000 },
  { name: 'openai', url: 'http://lite-llm:4000', model: 'gpt-4o-mini', timeout: 10000 },
] as const;

const EMBEDDING_PROVIDERS = [
  { name: 'ollama-nomic', url: 'http://ollama:11434', model: 'nomic-embed-text', timeout: 15000 },
  { name: 'openai-ada', url: 'http://lite-llm:4000', model: 'text-embedding-ada-002', timeout: 10000 },
] as const;

export async function llmCompleteWithFallback(req: LLMRequest): Promise<LLMResponse> {
  const errors: string[] = [];

  for (const provider of LLM_PROVIDERS) {
    try {
      const result = await callProvider(provider, req);
      recordSuccess(`llm:${provider.name}`);
      return result;
    } catch (error) {
      errors.push(`${provider.name}: ${error}`);
      recordFailure(`llm:${provider.name}`, String(error));

      // Check circuit breaker for this provider
      if (!isCallPermitted(`llm:${provider.name}`)) {
        console.warn(`[FallbackRouter] ${provider.name} circuit breaker is OPEN, skipping`);
        continue;
      }
    }
  }

  throw new AllProvidersFailedError('LLM', errors);
}
```

---

## 5. Rate Limiting

### 5.1 Rate Limit Tiers

```
┌─────────────────────────────────────────────────────────────────┐
│                     RATE LIMIT HIERARCHY                        │
├─────────────────────────────────────────────────────────────────┤
│  GLOBAL (Redis sliding window)                                   │
│  └── 1000 req/min per Hermes Agency instance                    │
├─────────────────────────────────────────────────────────────────┤
│  PER-USER (Redis sorted set)                                    │
│  └── 100 req/min per user_id                                    │
│  └── 10 req/min per user_id for LLM calls                        │
├─────────────────────────────────────────────────────────────────┤
│  PER-SKILL (Redis sliding window)                                │
│  └── 50 req/min per skill_id                                    │
├─────────────────────────────────────────────────────────────────┤
│  PER-TOOL (token bucket)                                        │
│  └── 20 req/min per tool for critical tools                     │
│  └── 60 req/min per tool for medium tools                       │
│  └── 120 req/min per tool for low tools                         │
├─────────────────────────────────────────────────────────────────┤
│  EXTERNAL API (downstream)                                       │
│  └── Respects X-RateLimit-* headers                             │
│  └── Implements retry-with-backoff                               │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Sliding Window Algorithm (Redis)

```lua
-- sliding_window_rate_limit.lua
-- KEYS[1] = rate limit key (e.g., "hermes:rl:user:123")
-- ARGV[1] = current timestamp (ms)
-- ARGV[2] = window size (ms)
-- ARGV[3] = max requests
-- Returns: { allowed: 0|1, remaining: number, retryAfter: number|nil }

local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])

-- Remove old entries outside window
redis.call('ZREMRANGEBYSCORE', key, 0, now - window)

-- Count current requests in window
local count = redis.call('ZCARD', key)

if count >= limit then
  local oldest = redis.call('ZRANGE', key, 0, 0, 'WITHSCORES')
  local retryAfter = math.ceil((oldest[2] + window - now) / 1000)
  return { 0, 0, retryAfter }
end

-- Add new request
redis.call('ZADD', key, now, now .. '-' .. math.random(1000000))
redis.call('EXPIRE', key, math.ceil(window / 1000))

return { 1, limit - count - 1, nil }
```

### 5.3 External API Rate Limit Handling

```typescript
// Retry with exponential backoff for rate limit responses
async function callWithRateLimitBackoff(
  fn: () => Promise<Response>,
  options: { maxRetries: number; baseDelayMs: number; maxDelayMs: number }
): Promise<Response> {
  for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
    const response = await fn();

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      const backoff = retryAfter
        ? parseInt(retryAfter) * 1000
        : Math.min(options.baseDelayMs * Math.pow(2, attempt), options.maxDelayMs);

      console.warn(`[RateLimit] 429 received. Retrying in ${backoff}ms (attempt ${attempt + 1}/${options.maxRetries})`);
      await sleep(backoff);
      continue;
    }

    return response;
  }

  throw new Error(`Max retries exceeded for rate-limited operation`);
}
```

---

## 6. Bulkhead Isolation

### 6.1 Thread Pool Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                    BULKHEAD POOLS                               │
├─────────────────────────────────────────────────────────────────┤
│  POOL_A: Critical (max 5 concurrent)                            │
│  ├── postgres_* queries                                         │
│  ├── qdrant_* operations                                         │
│  └── mem0_* memory operations                                   │
├─────────────────────────────────────────────────────────────────┤
│  POOL_B: High Priority (max 10 concurrent)                      │
│  ├── llm_complete                                               │
│  ├── rag_retrieve / rag_search                                  │
│  └── langgraph_execute                                          │
├─────────────────────────────────────────────────────────────────┤
│  POOL_C: Medium Priority (max 20 concurrent)                     │
│  ├── generate_script                                            │
│  ├── write_copy                                                 │
│  ├── generate_hashtags                                          │
│  └── analyze_engagement                                         │
├─────────────────────────────────────────────────────────────────┤
│  POOL_D: Low Priority / Background (max 50 concurrent)          │
│  ├── schedule_post                                              │
│  ├── create_mood_board                                          │
│  └── fetch_metrics                                              │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Memory Limits per Skill Execution

```typescript
const SKILL_MEMORY_LIMITS: Record<string, { maxMemoryMb: number; timeoutMs: number }> = {
  'agency-ceo':              { maxMemoryMb: 512,  timeoutMs: 60000 },
  'agency-onboarding':       { maxMemoryMb: 256,  timeoutMs: 30000 },
  'agency-video-editor':     { maxMemoryMb: 1024, timeoutMs: 120000 },
  'agency-organizer':        { maxMemoryMb: 128,  timeoutMs: 15000 },
  'agency-creative':         { maxMemoryMb: 256,  timeoutMs: 45000 },
  'agency-design':           { maxMemoryMb: 512,  timeoutMs: 60000 },
  'agency-social':           { maxMemoryMb: 128,  timeoutMs: 20000 },
  'agency-pm':               { maxMemoryMb: 128,  timeoutMs: 15000 },
  'agency-analytics':        { maxMemoryMb: 512,  timeoutMs: 90000 },
  'agency-brand-guardian':   { maxMemoryMb: 256,  timeoutMs: 30000 },
  'rag-instance-organizer':  { maxMemoryMb: 512,  timeoutMs: 60000 },
  'agency-client-success':   { maxMemoryMb: 128,  timeoutMs: 20000 },
};

const DEFAULT_TIMEOUT_MS = 30000;
```

### 6.3 Execution Wrapper

```typescript
export async function executeWithBulkhead<T>(
  pool: 'A' | 'B' | 'C' | 'D',
  skillId: string,
  fn: () => Promise<T>,
  skillConfig?: { maxMemoryMb?: number; timeoutMs?: number }
): Promise<T> {
  const poolLimits = {
    A: { maxConcurrent: 5, defaultTimeoutMs: 30000 },
    B: { maxConcurrent: 10, defaultTimeoutMs: 60000 },
    C: { maxConcurrent: 20, defaultTimeoutMs: 60000 },
    D: { maxConcurrent: 50, defaultTimeoutMs: 120000 },
  };

  const { maxConcurrent, defaultTimeoutMs } = poolLimits[pool];
  const timeoutMs = skillConfig?.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const acquired = await acquireSemaphore(`bulkhead:pool:${pool}`, maxConcurrent);
  try {
    return await withTimeout(fn(), timeoutMs);
  } finally {
    releaseSemaphore(`bulkhead:pool:${pool}`, acquired);
  }
}
```

---

## 7. Chaos Engineering

### 7.1 Test Mode Flags

```typescript
// Environment variables for chaos injection
const CHAOS_CONFIG = {
  enabled: process.env['CHAOS_ENABLED'] === 'true',
  failureRate: parseFloat(process.env['CHAOS_FAILURE_RATE'] ?? '0.1'),      // 10% default
  latencyMs: parseInt(process.env['CHAOS_LATENCY_MS'] ?? '500'),           // 500ms default
  latencyVariance: parseInt(process.env['CHAOS_LATENCY_VARIANCE_MS'] ?? '200'),
  forceCircuitOpen: process.env['CHAOS_FORCE_CIRCUIT_OPEN'] === 'true',
  targetService: process.env['CHAOS_TARGET_SERVICE'] ?? 'all',             // 'qdrant', 'llm', 'all'
};
```

### 7.2 Chaos Injection Functions

```typescript
// src/chaos/injector.ts

export function maybeInjectLatency(operationId: string): Promise<void> | void {
  if (!CHAOS_CONFIG.enabled) return;

  const latency = CHAOS_CONFIG.latencyMs +
    Math.random() * CHAOS_CONFIG.latencyVariance - CHAOS_CONFIG.latencyVariance / 2;

  console.debug(`[Chaos] Injecting ${latency.toFixed(0)}ms latency for ${operationId}`);

  return sleep(latency);
}

export function maybeInjectFailure<T>(operationId: string, fn: () => T): T {
  if (!CHAOS_CONFIG.enabled) return fn();

  if (Math.random() < CHAOS_CONFIG.failureRate) {
    const target = CHAOS_CONFIG.targetService;
    const shouldInject = target === 'all' || operationId.includes(target);

    if (shouldInject) {
      console.warn(`[Chaos] Injecting failure for ${operationId}`);
      throw new ChaosInjectedError(`Chaos: simulated failure for ${operationId}`);
    }
  }

  return fn();
}

export function maybeForceCircuitOpen(skillId: string): void {
  if (CHAOS_CONFIG.forceCircuitOpen && CHAOS_CONFIG.enabled) {
    const cb = getOrCreate(skillId);
    cb.state = 'open';
    cb.tripReason = 'chaos_injection';
    console.warn(`[Chaos] Force-opening circuit for ${skillId}`);
  }
}
```

### 7.3 Health Check Endpoints

```
GET /health                    → Overall system health
GET /health/circuit-breakers   → All circuit breaker states
GET /health/deps               → Dependency status (Redis, Qdrant, Ollama, etc.)
GET /health/chaos             → Chaos mode status (if enabled)

POST /admin/chaos/enable      → Enable chaos mode
POST /admin/chaos/disable     → Disable chaos mode
POST /admin/chaos/inject      → Manually inject failure for specific service
POST /admin/circuit-breaker/{skillId}/reset → Reset specific breaker
```

### 7.4 Chaos Test Scenarios

| Scenario | Injection | Expected Behavior |
|----------|-----------|-------------------|
| Qdrant down | `CHAOS_TARGET_SERVICE=qdrant CHAOS_FAILURE_RATE=1.0` | Tasks created in-memory, circuit OPEN after 2 failures |
| Ollama timeout | `CHAOS_TARGET_SERVICE=ollama CHAOS_LATENCY_MS=60000` | Fallback to LiteLLM MiniMax |
| Mem0 OOM | `CHAOS_TARGET_SERVICE=mem0 CHAOS_FAILURE_RATE=0.5` | Continue without memory context |
| Network partition | Chaos monkey kills network | Graceful degradation to cached responses |
| LiteLLM rate limit | 100% 429 responses | Circuit OPEN, fallback chain exhausted, error returned |

---

## 8. Observabilidade

### 8.1 Métricas (Prometheus)

```promql
# Circuit Breaker Metrics
hermes_circuit_breaker_state{service, state="closed|open|half_open"}
hermes_circuit_breaker_failures_total{service, error_type}
hermes_circuit_breaker_recovery_duration_seconds{service}

# Fallback Metrics
hermes_fallback激活次数{service, fallback_target}
hermes_provider_failures_total{provider, error_code}

# Rate Limiting Metrics
hermes_rate_limit_exceeded_total{limit_type="user|skill|tool"}
hermes_rate_limit_remaining{key}

# Bulkhead Metrics
hermes_bulkhead_pool_utilization{pool="A|B|C|D"}
hermes_skill_timeout_total{skill_id}

# Chaos Metrics
hermes_chaos_injections_total{service, type="latency|failure"}
```

### 8.2 Structured Logging

```typescript
// Log format for fault tolerance events
interface FaultToleranceLog {
  timestamp: string;           // ISO 8601
  level: 'info' | 'warn' | 'error';
  event: 'circuit_open' | 'circuit_closed' | 'fallback_activated' | 'rate_limit_exceeded' | 'chaos_injection';
  service: string;
  details: Record<string, unknown>;
  traceId?: string;
}

// Example log lines
console.log(JSON.stringify({
  timestamp: new Date().toISOString(),
  level: 'warn',
  event: 'circuit_open',
  service: 'qdrant:agency_tasks',
  details: { failureCount: 3, reason: 'connection refused', recoveryTimeout: 30000 },
  traceId: 'abc123',
}));
```

---

## 9. Configuração

### 9.1 Environment Variables

```bash
# Circuit Breaker
CIRCUIT_BREAKER_ENABLED=true
CIRCUIT_BREAKER_THRESHOLD=3
CIRCUIT_BREAKER_RECOVERY_MS=30000
CIRCUIT_BREAKER_BACKOFF_MULTIPLIER=1.5
CIRCUIT_BREAKER_MAX_BACKOFF_MS=600000

# Redis State Persistence
REDIS_URL=redis://redis:6379
REDIS_CB_TTL_SECONDS=3600

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_USER_RPM=100
RATE_LIMIT_SKILL_RPM=50
RATE_LIMIT_TOOL_RPM=20

# Bulkhead
BULKHEAD_POOL_A_CONCURRENT=5
BULKHEAD_POOL_B_CONCURRENT=10
BULKHEAD_POOL_C_CONCURRENT=20
BULKHEAD_POOL_D_CONCURRENT=50

# Provider Fallback
LLM_PRIMARY_PROVIDER=minimax
LLM_FALLBACK_ENABLED=true

# Chaos Engineering
CHAOS_ENABLED=false
CHAOS_FAILURE_RATE=0.1
CHAOS_LATENCY_MS=500
```

---

## 10. Roadmap de Implementação

### Fase 1: Circuit Breaker Enhanced (Semana 1)
- [ ] Redis-backed state persistence
- [ ] Exponential backoff
- [ ] Per-tool thresholds
- [ ] Health endpoint for circuit breakers

### Fase 2: Provider Fallback (Semana 2)
- [ ] LLM fallback chain implementation
- [ ] Embeddings fallback
- [ ] Integration with LiteLLM proxy

### Fase 3: Graceful Degradation (Semana 3)
- [ ] Mem0 fallback → continue without memory
- [ ] Qdrant fallback → in-memory task storage
- [ ] Trieve fallback → generic LLM responses

### Fase 4: Rate Limiting (Semana 4)
- [ ] Redis sliding window implementation
- [ ] Per-user, per-skill, per-tool limits
- [ ] External API rate limit handling

### Fase 5: Bulkhead + Chaos (Semana 5)
- [ ] Thread pool isolation
- [ ] Memory limits per skill
- [ ] Chaos injection framework
- [ ] Load testing validation

---

## 11. Appendix: Enhanced Circuit Breaker API

### New Interface

```typescript
// src/skills/circuit_breaker.ts (enhanced)

export interface CircuitBreakerConfig {
  failureThreshold: number;      // default: 3
  recoveryTimeoutMs: number;      // default: 30000
  backoffMultiplier: number;     // default: 1.5
  halfOpenMaxCalls: number;       // default: 1
  redisKeyPrefix?: string;        // default: 'hermes:cb'
}

export interface CircuitBreakerState {
  id: string;                     // skillId or toolId
  type: 'skill' | 'tool' | 'provider';
  state: 'closed' | 'open' | 'half_open';
  failureCount: number;
  failureStreak: number;          // consecutive failures (for backoff)
  lastFailure: number | null;
  lastSuccess: number | null;
  lastStateChange: number;
  tripReason: string | null;
  config: CircuitBreakerConfig;
}

// New functions
export function createCircuitBreaker(id: string, type: 'skill' | 'tool' | 'provider', config?: Partial<CircuitBreakerConfig>): CircuitBreakerState;
export function isCallPermitted(id: string, type?: 'skill' | 'tool' | 'provider'): boolean;
export function recordSuccess(id: string, type?: 'skill' | 'tool' | 'provider'): void;
export function recordFailure(id: string, reason: string, type?: 'skill' | 'tool' | 'provider'): void;
export function getCircuitBreakerState(id: string): CircuitBreakerState | null;
export function getAllCircuitBreakerStates(): CircuitBreakerState[];
export function resetCircuitBreaker(id: string, type?: 'skill' | 'tool' | 'provider'): void;
export function forceOpenCircuit(id: string, reason: string, type?: 'skill' | 'tool' | 'provider'): void;

// Redis sync
export async function loadCircuitBreakersFromRedis(): Promise<void>;
export async function saveCircuitBreakerToRedis(id: string): Promise<void>;
export async function syncAllCircuitBreakersToRedis(): Promise<void>;
```

---

## 12. Appendix: Error Classes

```typescript
// src/errors/fault-tolerance.ts

export class CircuitBreakerOpenError extends Error {
  constructor(
    public readonly serviceId: string,
    public readonly recoveryTimeoutMs: number,
    public readonly tripReason: string
  ) {
    super(`Circuit breaker OPEN for ${serviceId}: ${tripReason}. Retry after ${recoveryTimeoutMs}ms`);
    this.name = 'CircuitBreakerOpenError';
  }
}

export class AllProvidersFailedError extends Error {
  constructor(
    public readonly operation: string,
    public readonly providerErrors: string[]
  ) {
    super(`All providers failed for ${operation}: ${providerErrors.join('; ')}`);
    this.name = 'AllProvidersFailedError';
  }
}

export class RateLimitExceededError extends Error {
  constructor(
    public readonly limitType: 'user' | 'skill' | 'tool',
    public readonly key: string,
    public readonly retryAfterMs: number
  ) {
    super(`Rate limit exceeded for ${limitType}:${key}. Retry after ${retryAfterMs}ms`);
    this.name = 'RateLimitExceededError';
  }
}

export class ServiceUnavailableError extends Error {
  constructor(
    public readonly service: string,
    public readonly originalError: unknown
  ) {
    super(`Service unavailable: ${service}`);
    this.name = 'ServiceUnavailableError';
  }
}

export class ChaosInjectedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ChaosInjectedError';
  }
}
```
