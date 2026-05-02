---
**Last reviewed:** 2026-05-02
**Owner:** SRE/homelab
name: SPEC-009
description: Blueprint shadow-context — arquitetura para memória infinita via mclaude -p workers + Qdrant + mem0 + Hermes
status: IN_PROGRESS
owner: will-zappro
created: 2026-04-29
updated: 2026-04-30
priority: critical
---

# SPEC-009 — Shadow Context Blueprint (Enterprise)

> **Refatorado:** 2026-04-30 com padrões enterprise de 20 agentes de pesquisa.
> **Stack:** TypeScript, Go, Redis, Qdrant, BullMQ patterns, OpenTelemetry

## Problema

O homelab tem peças desconectadas que desperdiçam potencial:

| Componente | Estado | Impacto |
|------------|--------|---------|
| **Qdrant** (:6333) | 401 — sem auth configurada | RAG/imemory não funciona |
| **mem0** (mcp-memory) | Desconectado do Qdrant | Second brain não persiste |
| **Hermes Second Brain** | 68KB em ~/.hermes, não ~/Desktop | Não está acessível como tutor |
| **Context window** | Tudo carrega na conversa (~2000 tokens) | Lento, perde contexto |
| **Workers mclaude -p** | Não consomem teu contexto | Oportunidade desperdiçada |

---

## Solução: Shadow Context Architecture (Enterprise)

```
┌─────────────────────────────────────────────────────────────────┐
│                    TWO CLIENT INTERFACES                          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  JANELA (contexto vivo, ~4000 tokens)                  │   │
│  │  ├─ CLAUDE.md (regras globais)                         │   │
│  │  ├─ Histórico da conversa (cada msg pesa)                 │   │
│  │  └─ Tool calls (Read/Edit/Bash)                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                          ↓ não carrega histórico                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  SHADOW CONTEXT (não pesa na janela)                    │   │
│  │  ├─ Files (AGENTS.md, SPECs, docs) → Read via tools   │   │
│  │  ├─ Qdrant (embeddings) → busca semântica             │   │
│  │  ├─ mem0 (via Hermes MCP) → preferences + learnings     │   │
│  │  └─ Hermes Second Brain → contexto estruturado          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  WORKERS (mclaude -p, contexto zero por task)         │   │
│  │  ├─ 15x parallel via VIBE_PARALLEL=15                 │   │
│  │  ├─ Estado em queue.json (não em memória)              │   │
│  │  └─ Resultados → Qdrant learnings collection            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack Enterprise

| Component | Technology | Notes |
|-----------|------------|-------|
| **Workers** | mclaude -p (MiniMax-M2.7) | Contexto zero por task |
| **Vector DB** | Qdrant (:6333) | Auth configurada, HNSW otimizado |
| **Memory** | mem0 via mcp-memory | Qdrant backend |
| **Tutor** | Hermes Gateway (:8642) + MCP (:8092) | Gateway API |
| **Second Brain** | ~/Desktop/hermes-second-brain/ | File-based + Qdrant search |
| **Queue** | queue.json atômico | fcntl.flock + os.replace |
| **Runner** | vibe-kit.sh | VIBE_PARALLEL=15, snapshot ZFS |
| **Cache** | Redis (:6379) | Semantic cache, BullMQ patterns |
| **Observability** | OpenTelemetry | W3C TraceContext, Golden Signals |

---

## Architecture Patterns (Enterprise)

### 1. Semantic Cache (Redis) — BullMQ Patterns

```go
// internal/rag/cache.go

type SemanticCache struct {
    redis *redis.Client
    ttl   time.Duration
}

type CacheConfig struct {
    TTL           time.Duration `env:"CACHE_TTL" envDefault:"24h"`
    MaxRetries    int          `env:"CACHE_MAX_RETRIES" envDefault:"3"`
    BackoffBase   int          `env:"CACHE_BACKOFF_MS" envDefault:"1000"` // ms
}

// Cache key: rag:cache:<sha256(normalized_query)>
func (c *SemanticCache) Get(ctx context.Context, query string) (*CachedResponse, bool, error) {
    hash := sha256(normalizeQuery(query))
    key := fmt.Sprintf("rag:cache:%s", hash)

    val, err := c.redis.Get(ctx, key).Result()
    if err == redis.Nil {
        return nil, false, nil
    }
    // Unmarshal and return
}

type CachedResponse struct {
    Response       string    `json:"response"`
    SourceChunkIDs []string `json:"source_chunk_ids"`
    Confidence    float64   `json:"confidence"`
    CachedAt      time.Time `json:"cached_at"`
}
```

**TTL Strategy (Tiered):**
| Data Type | TTL | Rationale |
|-----------|-----|-----------|
| Hot (frequente) | 5 min | Queries similares |
| Warm (moderate) | 1h | Resultados de embedding |
| Cold (infrequente) | 24h | Learnings estruturados |

### 2. Job Queue (Redis) — BullMQ Patterns

```go
// internal/rag/jobs.go

const (
    JobStateDelayed   = "delayed"
    JobStateWaiting  = "waiting"
    JobStateActive   = "active"
    JobStateCompleted = "completed"
    JobStateFailed   = "failed"
)

type Job struct {
    ID        string    `json:"id"`
    Type      string    `json:"type"`       // "rag_query" | "index_pdf"
    State     string    `json:"state"`
    Data      string    `json:"data"`       // JSON payload
    Attempts  int       `json:"attempts"`
    MaxRetry  int       `json:"max_retry"`  // 3
    Backoff   int       `json:"backoff"`    // exponential: 1s, 2s, 4s
    Error     string    `json:"error,omitempty"`
    CreatedAt int64     `json:"created_at"`
}

// Redis keys
const (
    QueuePrefix     = "rag:queue:"
    QueueDelayPrefix = "rag:delay:"
    QueueDLQPrefix  = "rag:dlq:"
    JobPrefix       = "rag:job:"
)

// AddJob with retry
func (q *JobQueue) AddJob(ctx context.Context, jobType string, data any) (string, error) {
    job := Job{
        ID:        ulid.Make().String(),
        Type:      jobType,
        State:     JobStateWaiting,
        Data:      mustMarshal(data),
        Attempts:  0,
        MaxRetry:  3,
        Backoff:   1000,
        CreatedAt: time.Now().UnixMilli(),
    }
    q.redis.HSet(ctx, JobPrefix+job.ID, jobToMap(job))
    q.redis.RPush(ctx, QueuePrefix+jobType, job.ID)
    return job.ID, nil
}

// ProcessJobs com exponential backoff
func (q *JobQueue) ProcessJobs(ctx context.Context, handler JobHandler) {
    for {
        jobID, err := q.redis.BLPop(ctx, 5*time.Second, QueuePrefix+handler.Type()).Result()
        if err == redis.Nil {
            continue
        }

        job := q.getJob(ctx, jobID[1])
        result := handler.Process(ctx, job)

        if result.Err != nil && job.Attempts < job.MaxRetry {
            q.retryJob(ctx, job, result.Err)
        } else if result.Err != nil {
            q.moveToDLQ(ctx, job, result.Err)
        } else {
            q.completeJob(ctx, job.ID)
        }
    }
}
```

### 3. OpenTelemetry Tracing

```go
// internal/rag/otel.go

var tracer = otel.Tracer("hvacr-swarm/rag")

func TraceRAGQuery(ctx context.Context, query string) (context.Context, *Span) {
    ctx, span := tracer.Start(ctx, "rag.query",
        trace.WithAttributes(
            attribute.String("rag.query", query),
        ),
    )
    return ctx, span
}

func TraceSearch(ctx context.Context, collection string, limit int) (context.Context, *Span) {
    ctx, span := tracer.Start(ctx, "rag.search",
        trace.WithAttributes(
            attribute.String("rag.collection", collection),
            attribute.Int("rag.limit", limit),
        ),
    )
    return ctx, span
}
```

**Trace hierarchy:**
```
rag.query
  ├── cache.lookup
  ├── embed.query
  ├── qdrant.search (dense)
  ├── qdrant.search (sparse)
  ├── qdrant.fusion (RRF)
  └── llm.response
```

---

## Error Handling (Enterprise)

### Claude API Error Handling

```go
// Erro tipado com sentinel errors
var (
    ErrNotFound      = errors.New("not found")
    ErrRateLimit     = errors.New("rate limit exceeded")
    ErrTimeout       = errors.New("operation timeout")
    ErrUnauthorized  = errors.New("unauthorized")
)

// Retry com exponential backoff + jitter
func callWithRetry(ctx context.Context, req Request, maxRetries int) (*Response, error) {
    var lastErr error
    baseDelay := 1000 * time.Millisecond
    maxDelay := 60 * time.Second

    for attempt := 0; attempt < maxRetries; attempt++ {
        resp, err := api.Call(ctx, req)

        if err == nil {
            return resp, nil
        }

        // Classificar erro
        var rateLimitErr *RateLimitError
        if errors.As(err, &rateLimitErr) {
            delay := time.Duration(baseDelay * (1 << attempt))
            delay += time.Duration(rand.Int63n(int64(delay / 2))) // jitter
            if delay > maxDelay {
                delay = maxDelay
            }
            select {
            case <-ctx.Done():
                return nil, ctx.Err()
            case <-time.After(delay):
                lastErr = err
                continue
            }
        }

        // Erro não retryable
        return nil, err
    }
    return nil, fmt.Errorf("retry exhausted: %w", lastErr)
}
```

### Circuit Breaker Pattern

```go
type CircuitBreaker struct {
    failures    int
    threshold  int
    state      CircuitState
    recovery   time.Duration
}

const (
    CircuitClosed   CircuitState = "closed"
    CircuitOpen     CircuitState = "open"
    CircuitHalfOpen CircuitState = "half_open"
)
```

---

## Observability (Golden Signals)

### Metrics

```go
var (
    cacheHitsTotal = promauto.NewCounterVec(
        prometheus.CounterOpts{
            Name: "rag_cache_hits_total",
            Help: "Total cache hits",
        },
        []string{"collection"},
    )

    queryDuration = promauto.NewHistogramVec(
        prometheus.HistogramOpts{
            Name:    "rag_query_duration_seconds",
            Buckets: []float64{.01, .05, .1, .5, 1, 5},
        },
        []string{"collection", "cache_status"},
    )

    jobState = promauto.NewGaugeVec(
        prometheus.GaugeOpts{
            Name: "rag_jobs_state",
            Help: "Jobs in each state",
        },
        []string{"queue", "state"},
    )
)
```

### SLO/SLI/SLA

| Metric | SLO | SLI |
|--------|-----|-----|
| Query latency (cached) | < 50ms p95 | Histogram |
| Query latency (uncached) | < 2s p95 | Histogram |
| Cache hit rate | ≥ 60% | Counter ratio |
| Job success rate | ≥ 95% | Counter ratio |
| DLQ depth | < 10 | Gauge |

---

## Acceptance Criteria (Enterprise)

| # | Criterion | Test | SLO |
|---|-----------|------|-----|
| AC-1 | Same query returns cached response | Cache hit logged | < 50ms |
| AC-2 | Job retries 3x on failure | Simulate error, check DLQ | DLQ < 10 |
| AC-3 | Chunk quality score in payload | Check Qdrant point | qdrant payload |
| AC-4 | Spans visible in OTEL | Trace ID in logs | W3C format |
| AC-5 | Cache miss → normal flow | Log cache miss + proceed | uncached < 2s |
| AC-6 | DLQ receives failed jobs after 3 retries | Check rag:dlq:* | DLQ < 10 |
| AC-7 | Circuit breaker opens on sustained failures | Inject errors | circuit open |
| AC-8 | Correlation ID propagates | Check traceparent header | W3C format |

---

## Files Structure

```
internal/rag/
├── cache.go           # Redis semantic cache (BullMQ patterns)
├── jobs.go           # Job queue (BullMQ patterns)
├── otel.go           # OpenTelemetry spans
├── quality.go        # Chunk quality scoring (qwen2.5-vl)
├── config.go         # RAGConfig with env vars
├── errors.go         # Sentinel errors + error types
└── metrics.go        # Prometheus metrics

internal/workers/
├── worker.go         # mclaude -p worker
├── queue.go         # queue.json atômico
└── context.go       # Shadow context propagation
```

---

## Pipeline JSON Schema (Updated)

```json
{
  "spec": "SPEC-009",
  "phase": "execute",
  "parallel_limit": 15,
  "tasks": [
    {
      "id": "T001",
      "name": "qdrant-auth-config",
      "description": "Configurar Qdrant com API key auth",
      "agent_role": "deploy-agent",
      "acceptance_criteria": [
        "Qdrant responde 200 em /collections com auth",
        "Benchmark: 1000 vectors, p99 < 50ms"
      ]
    },
    {
      "id": "T002",
      "name": "redis-semantic-cache",
      "description": "Implementar cache semântico com BullMQ patterns",
      "agent_role": "backend-agent",
      "acceptance_criteria": [
        "Cache hit < 50ms",
        "TTL adaptativo funcionando"
      ]
    },
    {
      "id": "T003",
      "name": "otel-tracing",
      "description": "Instrumentar com OpenTelemetry W3C TraceContext",
      "agent_role": "backend-agent",
      "acceptance_criteria": [
        "Spans visíveis no collector",
        "Correlation ID propagates"
      ]
    }
  ]
}
```

---

## Risks (Com mitigação)

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Qdrant auth quebrado | Alta | RAG não funciona | T-001 primeiro |
| Cache stampede | Média | Latência spikes | Lock pattern |
| Circuit breaker mal config | Média | False positives | Testar com chaos |
| DLQ growth unchecked | Alta | Lost jobs | Monitoring + alerting |

---

## Referências

- SPEC-060 (HVAC RAG Enterprise Pipeline) — patterns de cache/queue
- SPEC-010 (Monorepo Hardening) — observability patterns
- `/srv/monorepo/internal/swarm/worker.go` — retry/DLQ implementation
- `/srv/monorepo/docs/SPECS/SPEC-002-redis-queues.md` — Redis queue spec

---

## Status: IN_PROGRESS

**Bloqueado por:** SPEC-010 (DONE ✅)

**Próximos passos:**
1. Qdrant auth config (T-001)
2. Redis semantic cache (T-002)
3. OpenTelemetry tracing (T-003)
