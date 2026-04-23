# Observabilidade e Monitoramento — Hermes Agency Suite

## Visão Geral

Este documento define a arquitetura de observabilidade para a camada de inteligência AI do homelab, cobrindo todos os serviços integrados ao Hermes Agency.

## Componentes Monitorados

| Serviço | Porta | Função |
|---------|-------|--------|
| Hermes Agency | :3001 | Orquestrador de skills AI |
| LiteLLM | :4000 | Proxy unificado para modelos |
| Qdrant | :6333 | Banco vetorial para RAG |
| Redis | :6379 | Cache e pub/sub |
| Trieve | :6435 | RAG as a Service |
| PostgreSQL (MCP) | :4017 | Banco de dados relacional |
| Ollama | :11434 | Inference server local |

---

## 1. Métricas a Coletar

### 1.1 Hermes Agency (:3001)

```typescript
// Métricas de Request
- http_requests_total{method, route, status_code}
- http_request_duration_seconds{method, route} (histogram: p50, p95, p99)
- http_requests_in_flight{gateway}

// Métricas de Skill
- skill_invocations_total{skill_id, skill_name}
- skill_execution_duration_seconds{skill_id}
- skill_errors_total{skill_id, error_type}

// Métricas de Circuit Breaker
- circuit_breaker_state{skill_id, state}
- circuit_breaker_transitions_total{skill_id, from_state, to_state}
```

### 1.2 LiteLLM (:4000)

```typescript
// Métricas de Modelo
- litellm_requests_total{model, provider}
- litellm_request_duration_seconds{model, provider}
- litellm_tokens_total{model, provider, token_type} // prompt/completion
- litellm_cost_total{model, provider}

// Métricas de Erro
- litellm_errors_total{model, provider, error_type}
- litellm_retries_total{model, provider}
```

### 1.3 Qdrant (:6333)

```typescript
// Métricas de Coleção
- qdrant_collections_total
- qdrant_collection_points_total{collection}
- qdrant_collection_vectors_total{collection}
- qdrant_collection_index_size_bytes{collection}

// Métricas de Query
- qdrant_query_duration_seconds{collection}
- qdrant_query_errors_total{collection}
- qdrant_search_duration_seconds{collection}
```

### 1.4 Redis (:6379)

```typescript
// Métricas de Conexão
- redis_connected_clients
- redis_connection_pool_size

// Métricas de Memória
- redis_memory_used_bytes
- redis_memory_max_bytes

// Métricas de Keys
- redis_keys_total
- redis_expires_total
```

### 1.5 Trieve (:6435)

```typescript
// Métricas de Dataset
- troive_datasets_total
- troive_chunks_total{dataset_id}

// Métricas de Busca
- troive_search_duration_seconds{dataset_id}
- troive_search_results_count{dataset_id}
```

### 1.6 PostgreSQL (:4017)

```typescript
// Métricas de Query
- postgres_query_duration_seconds{query_type}
- postgres_queries_total{query_type, status}

// Métricas de Conexão
- postgres_connections_active
- postgres_connections_idle
- postgres_connection_pool_size
```

### 1.7 Ollama (:11434)

```typescript
// Métricas de Modelo
- ollama_models_loaded
- ollama_model_load_duration_seconds{model}
- ollama_inference_duration_seconds{model}
- ollama_inference_tokens_total{model}

// Métricas de Embedding
- ollama_embedding_duration_seconds{model}
- ollama_embedding_tokens_total{model}
```

---

## 2. Health Endpoints

### 2.1 `/health` — Liveness

Retorna 200 se o serviço está rodando.

```json
{
  "status": "ok",
  "service": "hermes-agency-suite",
  "version": "0.1.0",
  "timestamp": "2026-04-23T10:00:00.000Z"
}
```

### 2.2 `/health/ready` — Readiness

Verifica dependências críticas.

```json
{
  "ready": true,
  "checks": {
    "qdrant": "connected",
    "ollama": "connected",
    "redis": "connected",
    "litellm": "connected"
  },
  "timestamp": "2026-04-23T10:00:00.000Z"
}
```

### 2.3 `/health/detailed` — Full Status

Status completo com circuit breakers e memória.

```json
{
  "status": "healthy|degraded|unhealthy",
  "uptime_seconds": 3600,
  "memory": {
    "rss_bytes": 150000000,
    "heap_used_bytes": 80000000,
    "heap_total_bytes": 100000000
  },
  "circuitBreakers": [
    {
      "skillId": "web_search",
      "state": "closed",
      "failureCount": 0,
      "lastFailure": null,
      "lastSuccess": 1713868800000
    }
  ],
  "collections": {
    "qdrant": {
      "agency_clients": { "points": 150, "vectors": 150 },
      "agency_campaigns": { "points": 42, "vectors": 42 }
    }
  },
  "dependencies": {
    "qdrant": { "status": "connected", "latency_ms": 5 },
    "ollama": { "status": "connected", "latency_ms": 12 },
    "redis": { "status": "connected", "latency_ms": 2 },
    "litellm": { "status": "connected", "latency_ms": 8 }
  },
  "timestamp": "2026-04-23T10:00:00.000Z"
}
```

---

## 3. Grafana Dashboard

Dashboard em: `/grafana/dashboards/hermes-agency.json`

### 3.1 Panel 1: Hermes Agency Overview

```grafana
- Request Rate: http_requests_total (rate 5m)
- Latency p50/p95/p99: histogram_quantile
- Error Rate: rate(http_errors_total[5m])
- Requests in Flight: http_requests_in_flight
```

### 3.2 Panel 2: AI Model Usage

```grafana
- Tokens per Model: sum by model (litellm_tokens_total)
- Cost Estimate: sum by model, provider (litellm_cost_total)
- Requests by Provider: count by provider
```

### 3.3 Panel 3: Memory Systems

```grafana
- Qdrant Collection Sizes: qdrant_collection_points_total
- Redis Memory: redis_memory_used_bytes
- Redis Keys: redis_keys_total
```

### 3.4 Panel 4: RAG Performance

```grafana
- Search Latency p95: histogram_quantile(0.95, qdrant_search_duration_seconds)
- Chunk Counts: sum by dataset (trieve_chunks_total)
- Search Result Sizes: avg by dataset (trieve_search_results_count)
```

### 3.5 Panel 5: Circuit Breaker Status

```grafana
- State per Skill: circuit_breaker_state (0=closed, 1=half_open, 2=open)
- Transitions: rate(circuit_breaker_transitions_total[5m])
```

### 3.6 Panel 6: Skill Execution

```grafana
- Calls per Skill: sum by skill_id (skill_invocations_total)
- Success Rate: sum by skill_id (erros / total)
- Duration p95: histogram_quantile(0.95, skill_execution_duration_seconds)
```

---

## 4. Alerting Rules

### 4.1 Critical Alerts

```yaml
# Circuit Breaker OPEN > 5 minutos
- alert: CircuitBreakerOpen
  expr: circuit_breaker_state == 2
  for: 5m
  labels:
    severity: critical
  annotations:
    summary: "Circuit breaker {{ $labels.skill_id }} OPEN"

# Error Rate > 5%
- alert: HighErrorRate
  expr: rate(http_errors_total[5m]) / rate(http_requests_total[5m]) > 0.05
  for: 5m
  labels:
    severity: critical
```

### 4.2 Warning Alerts

```yaml
# RAG Search Latency > 2s
- alert: RAGSearchSlow
  expr: histogram_quantile(0.95, qdrant_search_duration_seconds[5m]) > 2
  for: 5m
  labels:
    severity: warning

# Qdrant Collection > 80% capacity
- alert: QdrantCollectionNearCapacity
  expr: qdrant_collection_points_total / 100000 > 0.8
  labels:
    severity: warning

# LiteLLM Error Rate > 10%
- alert: LiteLLMHighErrorRate
  expr: rate(litellm_errors_total[5m]) / rate(litellm_requests_total[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
```

### 4.3 Info Alerts

```yaml
# Circuit Breaker State Change
- alert: CircuitBreakerStateChange
  expr: increase(circuit_breaker_transitions_total[1m]) > 0
  labels:
    severity: info
```

---

## 5. Logging Strategy

### 5.1 Structured JSON Format

```json
{
  "timestamp": "2026-04-23T10:00:00.000Z",
  "level": "error",
  "service": "hermes-agency",
  "correlationId": "req_abc123",
  "skillId": "web_search",
  "message": "Skill execution failed",
  "error": {
    "type": "NetworkError",
    "message": "Connection timeout",
    "stack": "..."
  },
  "duration_ms": 5000,
  "metadata": {
    "userId": "user_123",
    "chatId": "chat_456"
  }
}
```

### 5.2 Log Levels

| Level | Uso |
|-------|-----|
| `error` | Falhas de skill, erros de conexão, exceptions |
| `warn` | Circuit breaker trips, retries, degraded mode |
| `info` | Request received, skill executed, health checks |
| `debug` | Request/response bodies, embeddings, vectors |

### 5.3 Correlation IDs

- Gerar UUID para cada requisição HTTP
- Propagar via headers `X-Correlation-ID`
- Incluir em todos os logs da requisição

### 5.4 Data Redaction

Regex patterns para redacted:

```typescript
const REDACT_PATTERNS = [
  { pattern: /Bearer\s+[A-Za-z0-9-_]+/g, replacement: 'Bearer [REDACTED]' },
  { pattern: /"api[_-]?key"\s*:\s*"[^"]+"/gi, replacement: '"api_key": "[REDACTED]"' },
  { pattern: /"token"\s*:\s*"[^"]+"/gi, replacement: '"token": "[REDACTED]"' },
  { pattern: /"password"\s*:\s*"[^"]+"/gi, replacement: '"password": "[REDACTED]"' },
];
```

---

## 6. Prometheus Metrics Implementation

### 6.1 Metrics Server

Adicionar endpoint `/metrics` no Hermes Agency:

```typescript
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Counters
export const httpRequestsTotal = new Counter({
  name: 'hermes_http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status_code'],
});

export const skillInvocationsTotal = new Counter({
  name: 'hermes_skill_invocations_total',
  help: 'Total skill invocations',
  labelNames: ['skill_id', 'skill_name', 'status'],
});

// Histograms
export const httpRequestDuration = new Histogram({
  name: 'hermes_http_request_duration_seconds',
  help: 'HTTP request duration',
  labelNames: ['method', 'route'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
});

export const skillExecutionDuration = new Histogram({
  name: 'hermes_skill_execution_duration_seconds',
  help: 'Skill execution duration',
  labelNames: ['skill_id'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});

// Gauges
export const circuitBreakerState = new Gauge({
  name: 'hermes_circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=half_open, 2=open)',
  labelNames: ['skill_id'],
});

export const qdrantCollectionPoints = new Gauge({
  name: 'hermes_qdrant_collection_points',
  help: 'Qdrant collection point count',
  labelNames: ['collection'],
});

// Metrics endpoint
healthServer.on('request', (req, res) => {
  if (req.url === '/metrics') {
    res.setHeader('Content-Type', register.contentType);
    register.metrics().then((metrics) => res.end(metrics));
  }
});
```

### 6.2 Instrumentation Points

```typescript
// Request logging middleware
app.addHook('onRequest', async (req) => {
  req.correlationId = crypto.randomUUID();
  httpRequestsTotal.inc({ method: req.method, route: req.route });
});

// Skill execution wrapper
async function executeSkillWithMetrics(skillId: string, fn: () => Promise<void>) {
  const timer = skillExecutionDuration.startTimer({ skill_id: skillId });
  try {
    await fn();
    skillInvocationsTotal.inc({ skill_id: skillId, status: 'success' });
  } catch (error) {
    skillInvocationsTotal.inc({ skill_id: skillId, status: 'error' });
    throw error;
  } finally {
    timer();
  }
}

// Circuit breaker state sync
function syncCircuitBreakerMetrics() {
  const breakers = getAllCircuitBreakers();
  for (const cb of breakers) {
    const stateMap = { closed: 0, half_open: 1, open: 2 };
    circuitBreakerState.set({ skill_id: cb.skillId }, stateMap[cb.state]);
  }
}
```

---

## 7. Dashboards JSON Schema

O dashboard JSON segue o [formato Grafana Dashboard JSON](https://grafana.com/docs/grafana/latest/dashboards/json-model/).

Dashboard disponível em: `/grafana/dashboards/hermes-agency.json`

### 7.1 Dashboard Variables

```json
{
  "variables": [
    {
      "name": "datasource",
      "type": "datasource",
      "query": "prometheus"
    }
  ]
}
```

---

## 8. Implementação Recomendada

### 8.1 Dependencies

```bash
npm install prom-client pino pino-pretty
```

### 8.2 Files to Create/Modify

1. `/srv/monorepo/apps/hermes-agency/src/metrics/index.ts` — Prometheus registry
2. `/srv/monorepo/apps/hermes-agency/src/middleware/logging.ts` — Request logging
3. `/srv/monorepo/apps/hermes-agency/src/middleware/metrics.ts` — Metrics collection
4. `/srv/monorepo/apps/hermes-agency/src/index.ts` — Add /metrics and /health/detailed endpoints
5. `/srv/monorepo/apps/hermes-agency/prometheus.yml` — Scrape config
6. `/srv/monorepo/grafana/dashboards/hermes-agency.json` — Grafana dashboard
7. `/srv/monorepo/docs/OBSERVABILITY.md` — This document

### 8.3 Prometheus Scrape Config

```yaml
scrape_configs:
  - job_name: 'hermes-agency'
    static_configs:
      - targets: ['localhost:3001']
    metrics_path: /metrics
    scrape_interval: 15s

  - job_name: 'litellm'
    static_configs:
      - targets: ['localhost:4000']
    scrape_interval: 15s

  - job_name: 'qdrant'
    static_configs:
      - targets: ['localhost:6333']
    metrics_path: /metrics
    scrape_interval: 30s
```
