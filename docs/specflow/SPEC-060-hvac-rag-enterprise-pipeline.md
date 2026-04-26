---
name: SPEC-060 HVAC RAG Enterprise Pipeline
description: Pipeline RAG enterprise para hvacr-swarm — Semantic Cache Redis, BullMQ Jobs, OpenTelemetry, Chunk Quality Score
type: specification
status: DRAFT
priority: HIGH
author: will
date: 2026-04-17
related: SPEC-026, SPEC-032
---

# SPEC-060: HVAC RAG Enterprise Pipeline

**Status:** DRAFT
**Created:** 2026-04-17
**Related:** SPEC-026, SPEC-032

---

## 1. Objective

Adicionar features enterprise ao pipeline RAG do hvacr-swarm **sem criar salada**:

1. **Semantic Cache (Redis)** — query hash → cached response (evita re-embed + re-LLM)
2. **Chunk Quality Score** — qwen2.5-vl scoring no payload
3. **BullMQ Patterns** — jobs, retries, DLQ (substitui LPUSH direto)
4. **OpenTelemetry** — spans nos agents (traces scrape→embed→search→response)

**Princípio:** Mínimo de arquivos novos, máximo de impacto.

---

## 2. Architecture

```
INBOUND (WhatsApp/Terminal)
        ↓
┌───────────────────────────────────────────┐
│         SEMANTIC CACHE (Redis)            │
│  Key: sha256(normalized_query)           │
│  TTL: 24h                                 │
│  Value: {response, source_chunk_ids}      │
└───────────────────────────────────────────┘
        ↓ (cache miss)
┌───────────────────────────────────────────┐
│         BULLMQ JOB QUEUE                  │
│  Job: rag_query                          │
│  retries: 3, backoff: exponential        │
│  DLQ: rag_query_dlq                      │
└───────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────┐
│         RAG QUERY AGENT                   │
│  Span: rag.query                          │
│  ├── Embed query (nomic)                  │
│  ├── Hybrid search Qdrant                 │
│  └── Confidence scoring                   │
└───────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────┐
│         RESPONSE AGENT                    │
│  Span: rag.response                       │
│  └── MiniMax M2.7 → WhatsApp             │
└───────────────────────────────────────────┘

INDEXING PIPELINE
        ↓
┌───────────────────────────────────────────┐
│         BULLMQ JOB QUEUE                  │
│  Job: index_pdf → embed_chunks            │
│  Job: verify_chunk (qwen2.5-vl)          │
│  retries: 3, backoff: 5s                 │
│  DLQ: rag_index_dlq                       │
└───────────────────────────────────────────┘
        ↓
┌───────────────────────────────────────────┐
│         CHUNK QUALITY SCORE               │
│  qwen2.5-vl → quality_score (0-1)        │
│  Stored in Qdrant payload                 │
│  Used for ranking + filtering             │
└───────────────────────────────────────────┘
```

---

## 3. Components

### 3.1 Semantic Cache (Redis)

**Problema:** Queries idênticas fazem re-embed + re-LLM (custo + latência).

**Solução:**
```go
// internal/rag/cache.go

type SemanticCache struct {
    redis *redis.Client
    ttl   time.Duration // 24h default
}

func (c *SemanticCache) Get(ctx context.Context, query string) (*CachedResponse, bool, error) {
    hash := sha256256(normalizeQuery(query))
    key := fmt.Sprintf("rag:cache:%s", hash)

    val, err := c.redis.Get(ctx, key).Result()
    if err == redis.Nil {
        return nil, false, nil // cache miss
    }
    // unmarshal and return
}

func (c *SemanticCache) Set(ctx context.Context, query string, resp *CachedResponse) error {
    hash := sha256(normalizeQuery(query))
    key := fmt.Sprintf("rag:cache:%s", hash)
    data, _ := json.Marshal(resp)
    return c.redis.Set(ctx, key, data, c.ttl).Err()
}
```

**Cache key structure:**
```
rag:cache:<sha256(normalized_query)>
```

**Normalized query:** lowercase, trim spaces, remove punctuation.

**Cached response:**
```go
type CachedResponse struct {
    Response       string   `json:"response"`
    SourceChunkIDs []string `json:"source_chunk_ids"`
    Confidence     float64  `json:"confidence"`
    CachedAt       time.Time `json:"cached_at"`
}
```

**TTL:** 24h (configurável).

**Benefit:** ~70% cache hit rate esperado → -70% MiniMax calls, <50ms response.

---

### 3.2 Chunk Quality Score

**Problema:** Chunks sem qualidade (ruído, fragmentação) degradam RAG.

**Solução:** qwen2.5-vl scoring após chunking.

```go
// internal/rag/chunker.go — adicionar ao ChunkResult

type ChunkResult struct {
    ID            string            `json:"id"`
    Text          string            `json:"text"`
    ContentType   string            `json:"content_type"` // error_code, procedure, spec
    Section       string            `json:"section"`
    TokenCount    int               `json:"token_count"`
    Metadata      map[string]string `json:"metadata"`
    QualityScore  float64           `json:"quality_score"` // qwen2.5-vl score
}

// Adicionar ao Qdrant payload:
payload["quality_score"] = chunk.QualityScore
```

**Scoring criteria:**
| Score | Meaning | Action |
|-------|---------|--------|
| ≥ 0.8 | High quality | Use directly |
| 0.5-0.8 | Medium | Include with caveat |
| < 0.5 | Low quality | Flag for review or exclude |

**Implementation:** `rag/verifier.go` já existe — só expor score no payload.

---

### 3.3 BullMQ Patterns

**Problema:** Redis LPUSH direto não tem retries, DLQ, priority.

**Solução:** Implementar BullMQ-style patterns com Redis.

```go
// internal/rag/jobs.go

// Job States
const (
    JobStateDelayed  = "delayed"
    JobStateWaiting  = "waiting"
    JobStateActive   = "active"
    JobStateCompleted = "completed"
    JobStateFailed   = "failed"
)

// Job Record (Redis Hash)
type Job struct {
    ID        string `json:"id"`
    Type      string `json:"type"`      // "rag_query" | "index_pdf"
    State     string `json:"state"`
    Data      string `json:"data"`      // JSON payload
    Attempts  int    `json:"attempts"`
    MaxRetry  int    `json:"max_retry"` // 3
    Backoff   int    `json:"backoff"`   // exponential: 1s, 2s, 4s
    Error     string `json:"error,omitempty"`
    CreatedAt int64  `json:"created_at"`
}

// Queue keys (Redis)
const (
    QueuePrefix      = "rag:queue:"     // List: waiting jobs
    QueueDelayPrefix = "rag:delay:"    // Sorted Set: delayed jobs (score=timestamp)
    QueueDLQPrefix   = "rag:dlq:"      // List: dead letter
    JobPrefix        = "rag:job:"      // Hash: job data
)

// AddJob adds a job to the queue
func (q *JobQueue) AddJob(ctx context.Context, jobType string, data any) (string, error) {
    job := Job{
        ID:        ulid.Make().String(),
        Type:      jobType,
        State:     JobStateWaiting,
        Data:      mustMarshal(data),
        Attempts:  0,
        MaxRetry:  3,
        Backoff:   1000, // ms
        CreatedAt: time.Now().UnixMilli(),
    }
    // Save job hash
    q.redis.HSet(ctx, JobPrefix+job.ID, jobToMap(job))
    // Add to waiting list
    q.redis.RPush(ctx, QueuePrefix+jobType, job.ID)
    return job.ID, nil
}

// ProcessJobs consumes jobs from queue
func (q *JobQueue) ProcessJobs(ctx context.Context, handler JobHandler) {
    for {
        // BRPOP waiting queue
        jobID, err := q.redis.BLPop(ctx, 5*time.Second, QueuePrefix+handler.Type()).Result()
        if err == redis.Nil {
            continue
        }

        job := q.getJob(ctx, jobID[1])
        result := handler.Process(ctx, job)

        if result.Err != nil && job.Attempts < job.MaxRetry {
            // Retry with exponential backoff
            q.retryJob(ctx, job, result.Err)
        } else if result.Err != nil {
            // Move to DLQ
            q.moveToDLQ(ctx, job, result.Err)
        } else {
            // Mark completed
            q.completeJob(ctx, job.ID)
        }
    }
}
```

**Queues:**
| Queue | Type | Purpose |
|-------|------|---------|
| `rag:queue:rag_query` | `rag_query` | Query processing |
| `rag:queue:index_pdf` | `index_pdf` | PDF indexing |
| `rag:queue:embed_chunks` | `embed_chunks` | Batch embedding |
| `rag:dlq:rag_query` | DLQ | Failed queries |
| `rag:dlq:index_pdf` | DLQ | Failed indexing |

---

### 3.4 OpenTelemetry Instrumentation

**Problema:** Sem traces, impossível debugar pipeline.

**Solução:** Wrap existing agents com spans.

```go
// internal/rag/otel.go

var tracer = otel.Tracer("hvacr-swarm/rag")

// Span wrappers
func WithSpan(ctx context.Context, name string, fn func(ctx context.Context) error) error {
    ctx, span := tracer.Start(ctx, name)
    defer span.End()
    return fn(ctx)
}

// RAG Query spans
func TraceRAGQuery(ctx context.Context, query string) (context.Context, *Span) {
    ctx, span := tracer.Start(ctx, "rag.query",
        trace.WithAttributes(
            attribute.String("rag.query", query),
        ),
    )
    return ctx, span
}

// Embed span
func TraceEmbed(ctx context.Context, count int) (context.Context, *Span) {
    ctx, span := tracer.Start(ctx, "rag.embed",
        trace.WithAttributes(
            attribute.Int("rag.chunk_count", count),
        ),
    )
    return ctx, span
}

// Qdrant search span
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

**Exporter:** OTLP gRPC → Prometheus (já configurado no monorepo).

---

## 4. Files to Create/Modify

### New Files (4)

| File | Purpose |
|------|---------|
| `internal/rag/cache.go` | Redis semantic cache |
| `internal/rag/jobs.go` | BullMQ-style job queue |
| `internal/rag/otel.go` | OpenTelemetry spans |
| `internal/rag/quality.go` | Chunk quality scoring |

### Modified Files (2)

| File | Change |
|------|--------|
| `internal/rag/chunker.go` | Add `QualityScore` to `ChunkResult` |
| `internal/agents/rag_indexer_agent.go` | Use job queue for indexing |
| `internal/agents/rag_query_agent.go` | Use semantic cache + otel spans |

---

## 5. Configuration

```go
// internal/rag/config.go

type RAGConfig struct {
    // Cache
    CacheTTL time.Duration `env:"RAG_CACHE_TTL" envDefault:"24h"`

    // Job Queue
    JobMaxRetries    int `env:"RAG_JOB_MAX_RETRIES" envDefault:"3"`
    JobBackoffBase    int `env:"RAG_JOB_BACKOFF_MS" envDefault:"1000"`

    // Quality
    QualityThreshold float64 `env:"RAG_QUALITY_THRESHOLD" envDefault:"0.5"`

    // OTEL
    OTELEnabled bool `env:"OTEL_ENABLED" envDefault:"true"`
}
```

---

## 6. Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | Same query twice returns cached response | Cache hit logged |
| AC-2 | Job retries 3x on failure | Simulate error, check DLQ |
| AC-3 | Chunk quality score in payload | Check Qdrant point |
| AC-4 | Spans visible in OTEL collector | Trace ID in logs |
| AC-5 | Cache miss → normal flow | Log cache miss + proceed |
| AC-6 | DLQ receives failed jobs after 3 retries | Check rag:dlq:* lists |

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Cache hit rate | ≥ 60% | Redis `rag:cache:*` key count |
| Query latency (cached) | < 50ms | Prometheus histogram |
| Query latency (uncached) | < 2s | Prometheus histogram |
| Job success rate | ≥ 95% | Completed / total |
| DLQ depth | < 10 | Redis LLEN rag:dlq:* |
| Chunk quality avg | ≥ 0.7 | Qdrant payload quality_score avg |

---

## 8. Dependencies

| Dependency | Status |
|------------|--------|
| Redis | ✅ Already used by swarm |
| Qdrant | ✅ Already integrated |
| Ollama (nomic) | ✅ Already integrated |
| qwen2.5-vl | ✅ Via rag/verifier.go |
| MiniMax M2.7 | ✅ Already used |
| OTEL SDK | ✅ Available in monorepo |

---

## 9. Open Questions

| # | Question | Priority |
|---|----------|----------|
| OQ-1 | Usar Redis Streams ou Lists para job queue? | MEDIUM |
| OQ-2 | Qual TTL ideal para cache? | LOW |
| OQ-3 | Chunk quality threshold: 0.5 ou 0.6? | LOW |

---

## 10. Not in Scope

- BullMQ package (Go não tem) — usar patterns manuais com Redis
- Nova collection Qdrant — usar `hvac_service_manuals` existente
- Mudar embedding model — manter `nomic-embed-text`
- Mudar LLM do response — manter MiniMax M2.7
