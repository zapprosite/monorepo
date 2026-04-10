# Blueprint: Multi-Agent Swarm HVAC-R — WhatsApp + RAG Multimodal + Go Graph

**Projeto:** Refrimix Tecnologia — Enxame de Agentes HVAC-R
**Data:** 2026-04-07
**Stack:** Go 1.23+ · Redis 7 (Streams + Pub/Sub + Lua) · Qdrant 1.13 · Gemini 2.5 Flash + Embedding 2 · WhatsApp Cloud API · Stripe BR
**Infra:** Contabo VPS (gateway público) + Homelab RTX 4090 (AI/vetorial) via Tailscale
**Paradigma:** Event-driven swarm com work-stealing, shared memory, graph-based orchestration

---

## 1. Arquitetura Geral do Swarm

### Topologia

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          SWARM CONTROLLER (Go)                              │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    EXECUTION GRAPH (DAG Runtime)                      │   │
│  │                                                                      │   │
│  │   intake ──► classifier ──► access_control ──┬──► rag ──► ranking    │   │
│  │                                              │         ──► response  │   │
│  │                                              ├──► billing            │   │
│  │                                              └──► memory (parallel)  │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    SHARED TASK BOARD (Redis)                          │   │
│  │                                                                      │   │
│  │   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐              │   │
│  │   │ intake   │ │ classify │ │   rag    │ │ response │  ...          │   │
│  │   │  queue   │ │  queue   │ │  queue   │ │  queue   │              │   │
│  │   └──────────┘ └──────────┘ └──────────┘ └──────────┘              │   │
│  │                                                                      │   │
│  │   Cada agente tem fila própria + pode STEAL de qualquer outra        │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    SHARED MEMORY LAYER                                │   │
│  │                                                                      │   │
│  │   Redis (KV + Streams)  ·  Qdrant (vetores)  ·  SQLite (persist.)   │   │
│  │                                                                      │   │
│  │   Estado global · Contexto do usuário · Histórico de decisões        │   │
│  │   Resultados RAG · Conversation history · Agent activity log         │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    AGENT POOL (goroutines)                            │   │
│  │                                                                      │   │
│  │   [intake×2] [classifier×2] [access×1] [rag×3] [ranking×2]          │   │
│  │   [response×2] [billing×1] [memory×1]                                │   │
│  │                                                                      │   │
│  │   Total: 14 workers · Escala horizontal por tipo · Work-stealing     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Como o Grafo de Execução Funciona

Cada mensagem do WhatsApp gera uma instância do grafo (DAG). O grafo define dependências entre estágios — cada nó é executado por um agente do pool. O runtime resolve dependências, dispara nós paralelos quando possível, e propaga falhas com retry automático.

```go
// Definição do grafo de execução para uma mensagem
type ExecutionGraph struct {
    ID       string
    Nodes    map[string]*GraphNode
    Edges    map[string][]string // node_id → depends_on[]
    State    *SharedState
    Created  time.Time
}

type GraphNode struct {
    ID          string
    AgentType   string            // "intake", "classifier", "rag", etc.
    Status      NodeStatus        // pending | running | completed | failed | skipped
    Input       map[string]any
    Output      map[string]any
    DependsOn   []string          // IDs dos nós predecessores
    MaxRetries  int
    Retries     int
    Timeout     time.Duration
    StartedAt   time.Time
    CompletedAt time.Time
    WorkerID    string            // qual worker executou
}

type NodeStatus string

const (
    NodePending   NodeStatus = "pending"
    NodeRunning   NodeStatus = "running"
    NodeCompleted NodeStatus = "completed"
    NodeFailed    NodeStatus = "failed"
    NodeSkipped   NodeStatus = "skipped"
)
```

### Resolução de Dependências — O Scheduler

```go
// O scheduler roda como goroutine contínua
func (g *ExecutionGraph) ResolveReady() []*GraphNode {
    ready := []*GraphNode{}
    for _, node := range g.Nodes {
        if node.Status != NodePending {
            continue
        }
        allDepsResolved := true
        for _, depID := range node.DependsOn {
            dep := g.Nodes[depID]
            if dep.Status != NodeCompleted {
                allDepsResolved = false
                break
            }
        }
        if allDepsResolved {
            ready = append(ready, node)
        }
    }
    return ready
}

// Dispatch: nós prontos → filas dos agentes correspondentes
func (s *Scheduler) Dispatch(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return
        case <-s.tick.C: // 10ms tick
            for _, graph := range s.activeGraphs {
                readyNodes := graph.ResolveReady()
                for _, node := range readyNodes {
                    node.Status = NodeRunning
                    task := &SwarmTask{
                        ID:        uuid.New().String(),
                        GraphID:   graph.ID,
                        NodeID:    node.ID,
                        AgentType: node.AgentType,
                        Input:     node.Input,
                        State:     graph.State,
                        Priority:  s.calculatePriority(node),
                        CreatedAt: time.Now(),
                    }
                    s.enqueueTask(ctx, task)
                }
            }
        }
    }
}
```

### Fluxo de Tarefas Entre Agentes

```
1. WhatsApp webhook → HTTP handler cria ExecutionGraph
2. Scheduler detecta nó "intake" como ready (sem dependências)
3. intake_queue recebe task → worker intake pega via BRPOP
4. intake completa → marca nó completed → propaga output para State
5. Scheduler detecta "classifier" como ready (depends_on: [intake])
6. classifier_queue recebe task → worker classifier pega
7. classifier completa → detecta intent "technical"
8. Scheduler detecta "access_control" como ready
9. access_control completa → decision: "allow"
10. Scheduler detecta 3 nós ready em paralelo: rag, billing, memory
11. Três workers pegam simultaneamente
12. rag completa → ranking ready → response ready
13. response envia via WhatsApp → graph marcado como done
```

---

## 2. Modelo de Agentes

### Tabela de Agentes

| Agente | Workers | Prioridade | Pode Steal De | Timeout |
|--------|---------|------------|---------------|---------|
| intake_agent | 2 | critical | classifier | 10s |
| classifier_agent | 2 | critical | intake, rag | 8s |
| access_control_agent | 1 | critical | — | 3s |
| rag_agent | 3 | high | ranking | 30s |
| ranking_agent | 2 | high | rag, response | 15s |
| response_agent | 2 | critical | ranking | 20s |
| billing_agent | 1 | low | memory | 10s |
| memory_agent | 1 | low | billing | 5s |

### intake_agent

```json
{
  "agent": "intake_agent",
  "responsibilities": [
    "Receber payload do WhatsApp webhook",
    "Validar assinatura X-Hub-Signature-256",
    "Extrair texto, mídia, metadados",
    "Normalizar encoding UTF-8",
    "Baixar mídia via Graph API se necessário",
    "Publicar no shared state o input normalizado"
  ],
  "inputs": {
    "webhook_payload": "WhatsApp Cloud API webhook JSON",
    "signature": "X-Hub-Signature-256 header"
  },
  "outputs": {
    "request_id": "uuid",
    "phone": "5511999887766",
    "message_type": "text|image|video|audio|document",
    "normalized_text": "string",
    "media_bytes": "[]byte | nil",
    "media_type": "mime/type | nil",
    "timestamp": "ISO 8601"
  },
  "fallback": {
    "invalid_signature": "reject 403, log alert, no retry",
    "media_download_fail": "retry 2x, then process text-only",
    "timeout": "dead-letter queue, alert"
  },
  "shared_state_writes": [
    "state:{graph_id}:input",
    "state:{graph_id}:phone",
    "state:{graph_id}:message_type"
  ]
}
```

### classifier_agent

```json
{
  "agent": "classifier_agent",
  "responsibilities": [
    "Classificar intent da mensagem (technical, commercial, billing, greeting, image_search)",
    "Extrair entidades HVAC-R (marca, modelo, BTU, código de erro, peça, refrigerante)",
    "Determinar sub-intent (diagnosis, spec_lookup, installation, maintenance, pricing)",
    "Reescrever query para otimizar retrieval semântico"
  ],
  "inputs": {
    "normalized_text": "string",
    "media_type": "string | nil",
    "conversation_history": "[]Message (últimas 5)"
  },
  "outputs": {
    "intent": "technical|commercial|billing|greeting|image_search",
    "sub_intent": "diagnosis|spec_lookup|installation|maintenance|pricing",
    "confidence": 0.95,
    "entities": {
      "brand": "string | nil",
      "model": "string | nil",
      "btu": "int | nil",
      "error_code": "string | nil",
      "part": "string | nil",
      "refrigerant": "string | nil"
    },
    "rewritten_query": "string",
    "requires_rag": true
  },
  "fallback": {
    "low_confidence": "default to technical, flag for review",
    "llm_timeout": "rule-based fallback classifier (keyword matching)",
    "empty_text": "classify as greeting"
  },
  "shared_state_writes": [
    "state:{graph_id}:intent",
    "state:{graph_id}:entities",
    "state:{graph_id}:rewritten_query"
  ],
  "llm_config": {
    "model": "gemini-2.5-flash",
    "temperature": 0.1,
    "max_tokens": 256,
    "system_prompt": "Classifique a mensagem de um técnico HVAC-R. Extraia entidades técnicas."
  }
}
```

### access_control_agent

```json
{
  "agent": "access_control_agent",
  "responsibilities": [
    "Verificar estado do usuário no Redis (atomic via Lua script)",
    "Aplicar regras: new_user → free_limit → trial_on → trial_off",
    "Decrementar contador de requests gratuitos",
    "Decidir: allow | block | redirect"
  ],
  "inputs": {
    "phone": "5511999887766",
    "intent": "string"
  },
  "outputs": {
    "decision": "allow|block|redirect",
    "user_state": "new_user|free_limit|trial_on|trial_off",
    "remaining_requests": 7,
    "redirect_url": "https://zappro.site | nil"
  },
  "fallback": {
    "redis_down": "allow (fail-open for availability)",
    "race_condition": "Lua script WATCH/MULTI garante atomicidade",
    "corrupted_state": "reset to free_limit with 0 requests"
  },
  "shared_state_writes": [
    "state:{graph_id}:access_decision",
    "user:{phone}:requests_remaining (DECR)",
    "user:{phone}:last_request_at"
  ],
  "lua_script": "access_check.lua (atomic check + decrement)"
}
```

### rag_agent

```json
{
  "agent": "rag_agent",
  "responsibilities": [
    "Gerar embedding da query via Gemini Embedding 2 (768D)",
    "Gerar embedding de imagem se media_type == image",
    "Executar busca híbrida no Qdrant (dense + BM25 sparse + RRF fusion)",
    "Aplicar filtros de metadata HVAC-R (brand, model, btu, error_code)",
    "Retornar top-20 candidatos pré-ranking",
    "Verificar cache de queries similares antes de buscar"
  ],
  "inputs": {
    "rewritten_query": "string",
    "entities": "{}",
    "media_bytes": "[]byte | nil",
    "media_type": "string | nil"
  },
  "outputs": {
    "candidates": [
      {
        "id": "uuid",
        "score": 0.92,
        "content_type": "pdf|image|video",
        "chunk_text": "string (500-1000 tokens)",
        "metadata": {
          "brand": "Carrier",
          "model": "42XCA",
          "source": "manual_carrier_42xca.pdf",
          "page": 12
        }
      }
    ],
    "total_candidates": 20,
    "search_time_ms": 45,
    "cache_hit": false
  },
  "fallback": {
    "qdrant_down": "circuit breaker → sparse-only fallback via Redis FT.SEARCH",
    "embedding_api_fail": "BM25 keyword-only search",
    "no_results": "broaden filters, remove metadata constraints, retry",
    "all_low_scores": "flag response as uncertain"
  },
  "shared_state_writes": [
    "state:{graph_id}:rag_candidates",
    "state:{graph_id}:search_time_ms",
    "cache:query:{hash} (TTL 1h)"
  ]
}
```

### ranking_agent

```json
{
  "agent": "ranking_agent",
  "responsibilities": [
    "Re-ranquear candidatos usando cross-encoder ou Gemini como judge",
    "Filtrar candidatos com score < 0.5",
    "Ordenar por relevância final",
    "Montar contexto de até 4000 tokens para geração",
    "Incluir conversation history no contexto"
  ],
  "inputs": {
    "candidates": "[]{id, score, chunk_text, metadata}",
    "rewritten_query": "string",
    "conversation_history": "[]Message"
  },
  "outputs": {
    "ranked_results": "[top 5 com score reranked]",
    "assembled_context": "string (max 4000 tokens)",
    "context_sources": "[]{source, page, relevance}"
  },
  "fallback": {
    "reranker_fail": "usar scores originais do Qdrant sem re-ranking",
    "context_too_large": "truncar chunks de menor relevância",
    "all_filtered": "retornar mensagem 'sem informação disponível'"
  },
  "shared_state_writes": [
    "state:{graph_id}:ranked_results",
    "state:{graph_id}:assembled_context"
  ]
}
```

### response_agent

```json
{
  "agent": "response_agent",
  "responsibilities": [
    "Gerar resposta final via Gemini 2.5 Flash com contexto RAG",
    "Validar anti-hallucination (grounding check)",
    "Formatar para WhatsApp (limites de caracteres, emojis moderados)",
    "Enviar via WhatsApp Cloud API POST /{phone_id}/messages",
    "Incluir fonte citada na resposta",
    "Incluir contador de requests restantes (se free_limit)"
  ],
  "inputs": {
    "assembled_context": "string",
    "context_sources": "[]{}",
    "intent": "string",
    "phone": "string",
    "user_state": "string",
    "remaining_requests": "int"
  },
  "outputs": {
    "response_text": "string",
    "whatsapp_message_id": "wamid.xxx",
    "delivery_status": "sent|failed",
    "confidence": 0.92,
    "hallucination_check": "passed|failed|regenerated"
  },
  "fallback": {
    "generation_fail": "retry com temperature 0.1, max 2x",
    "hallucination_detected": "regenerar com prompt restritivo, max 2x, then fallback genérico",
    "whatsapp_api_fail": "retry 3x com backoff, dead-letter se persistir",
    "message_too_long": "split em múltiplas mensagens de 4096 chars"
  },
  "shared_state_writes": [
    "state:{graph_id}:response_sent",
    "state:{graph_id}:delivery_status",
    "user:{phone}:conversation (LPUSH)"
  ],
  "llm_config": {
    "model": "gemini-2.5-flash",
    "temperature": 0.3,
    "max_tokens": 1024,
    "system_prompt": "Assistente técnico HVAC-R. Responda APENAS com base no contexto. Cite fontes. Max 300 palavras."
  }
}
```

### billing_agent

```json
{
  "agent": "billing_agent",
  "responsibilities": [
    "Registrar evento de uso (request_used)",
    "Gerar checkout Stripe quando free_limit esgotado",
    "Processar webhooks Stripe (checkout.session.completed, invoice.paid)",
    "Atualizar estado do usuário no Redis após pagamento",
    "Enviar mensagem de confirmação de ativação via WhatsApp"
  ],
  "inputs": {
    "event_type": "request_used|upgrade_requested|payment_received|subscription_deleted",
    "phone": "string",
    "stripe_event": "{} | nil"
  },
  "outputs": {
    "checkout_url": "string | nil",
    "plan_activated": "bool",
    "billing_event_logged": "bool"
  },
  "fallback": {
    "stripe_api_fail": "retry 3x, alert admin via Telegram bot",
    "webhook_duplicate": "idempotency check via event_id",
    "payment_failed": "notificar user, manter trial_off"
  },
  "shared_state_writes": [
    "user:{phone}:status (SET trial_on)",
    "user:{phone}:plan (SET pro)",
    "billing:events:{event_id} (idempotency)"
  ]
}
```

### memory_agent

```json
{
  "agent": "memory_agent",
  "responsibilities": [
    "Persistir conversation history no Redis (LIST, últimas 20 msgs)",
    "Extrair fatos duráveis da conversa e gravar em memória de longo prazo",
    "Registrar decisões dos agentes (audit trail)",
    "Limpar estado expirado (TTL-based cleanup)",
    "Alimentar métricas de uso para dashboard"
  ],
  "inputs": {
    "graph_id": "uuid",
    "phone": "string",
    "agent_decisions": "[]{agent, decision, timestamp}",
    "response_text": "string",
    "user_message": "string"
  },
  "outputs": {
    "conversation_persisted": "bool",
    "facts_extracted": "[string]",
    "audit_logged": "bool"
  },
  "fallback": {
    "redis_full": "evict oldest entries, alert",
    "extraction_fail": "skip fact extraction, persist raw only"
  },
  "shared_state_writes": [
    "user:{phone}:conversation (LPUSH + LTRIM 0 19)",
    "user:{phone}:facts (SADD)",
    "audit:{graph_id} (HSET)",
    "metrics:daily:{date}:requests (INCR)"
  ]
}
```

---

## 3. Memória Compartilhada

### Arquitetura de 3 Camadas

```
┌─────────────────────────────────────────────────────────────┐
│                  CAMADA 1: Redis 7 (Hot State)              │
│                                                             │
│  ┌───────────────┐ ┌──────────────┐ ┌───────────────────┐  │
│  │ KV Store      │ │ Streams      │ │ Pub/Sub           │  │
│  │ user state    │ │ task events  │ │ agent coordination│  │
│  │ graph state   │ │ audit trail  │ │ live updates      │  │
│  │ cache         │ │ metrics      │ │ heartbeats        │  │
│  └───────────────┘ └──────────────┘ └───────────────────┘  │
│                                                             │
│  Latência: <1ms · TTL-managed · Lua scripts atômicos       │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  CAMADA 2: Qdrant (Vetorial)                │
│                                                             │
│  Collection: hvacr_knowledge                                │
│  Vectors: dense 768D + sparse BM25                          │
│  Payloads: brand, model, btu, error_code, part, etc.        │
│  Busca: hybrid RRF fusion + metadata filters                │
│                                                             │
│  Latência: 10-50ms · Persistente · GPU-accelerated          │
└─────────────────────────────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                  CAMADA 3: SQLite (Cold Persist)             │
│                                                             │
│  Tables: users, billing_events, audit_log, conversations    │
│  Propósito: backup, analytics, compliance                   │
│  Sync: Redis → SQLite via memory_agent (async)              │
│                                                             │
│  Latência: 1-5ms · WAL mode · Compacto                      │
└─────────────────────────────────────────────────────────────┘
```

### Redis Key Schema

```
# ═══════════════════════════════════════════════════
# GRAPH STATE (por execução de mensagem)
# ═══════════════════════════════════════════════════

state:{graph_id}:input              → HASH  { phone, text, media_type, timestamp }
state:{graph_id}:intent             → STRING "technical"
state:{graph_id}:entities           → HASH  { brand, model, btu, error_code }
state:{graph_id}:rewritten_query    → STRING "Erro E4 split Carrier 12000 BTU diagnóstico"
state:{graph_id}:access_decision    → STRING "allow"
state:{graph_id}:rag_candidates     → LIST  [ JSON per candidate ]
state:{graph_id}:ranked_results     → LIST  [ JSON top 5 ]
state:{graph_id}:assembled_context  → STRING "contexto montado..."
state:{graph_id}:response_sent      → HASH  { text, message_id, status, confidence }
state:{graph_id}:agent_log          → STREAM { agent, action, duration_ms, timestamp }

TTL: state:{graph_id}:* → 300s (5 min após conclusão do graph)

# ═══════════════════════════════════════════════════
# USER STATE (persistente)
# ═══════════════════════════════════════════════════

user:{phone}:status                 → STRING "free_limit|trial_on|trial_off"
user:{phone}:requests_remaining     → STRING "7"
user:{phone}:plan                   → STRING "free|trial|pro|enterprise"
user:{phone}:total_requests         → STRING "42"
user:{phone}:created_at             → STRING "2026-04-07T22:00:00Z"
user:{phone}:trial_expires_at       → STRING "2026-04-14T22:00:00Z"
user:{phone}:last_request_at        → STRING "2026-04-07T22:58:00Z"
user:{phone}:stripe_customer_id     → STRING "cus_xxx"
user:{phone}:conversation           → LIST  [ JSON msgs, LTRIM 0 19 ]
user:{phone}:facts                  → SET   { "técnico de campo", "trabalha com Carrier" }

# ═══════════════════════════════════════════════════
# TASK BOARD (filas de trabalho)
# ═══════════════════════════════════════════════════

swarm:queue:{agent_type}            → LIST  [ JSON tasks, LPUSH/BRPOP ]
swarm:queue:{agent_type}:processing → HASH  { task_id → worker_id }
swarm:queue:{agent_type}:dead       → LIST  [ dead-letter tasks ]
swarm:board:all                     → ZSET  { task_json → priority_score }

# ═══════════════════════════════════════════════════
# AGENT REGISTRY + HEARTBEAT
# ═══════════════════════════════════════════════════

swarm:agents:registry               → HASH  { worker_id → JSON{type,status,capabilities} }
swarm:agents:heartbeat:{worker_id}  → STRING "alive" (SETEX 15s)
swarm:agents:stats:{worker_id}      → HASH  { tasks_completed, tasks_stolen, avg_duration_ms }

# ═══════════════════════════════════════════════════
# CACHE
# ═══════════════════════════════════════════════════

cache:query:{sha256_hash}           → STRING "cached response JSON" (TTL 1h)
cache:embedding:{sha256_hash}       → STRING "cached embedding []float64" (TTL 24h)

# ═══════════════════════════════════════════════════
# PUB/SUB CHANNELS
# ═══════════════════════════════════════════════════

swarm:events:task_completed         → PUB/SUB (graph_id, node_id, agent_type)
swarm:events:agent_status           → PUB/SUB (worker_id, status, load)
swarm:events:graph_done             → PUB/SUB (graph_id, total_duration_ms)
swarm:events:rebalance              → PUB/SUB (trigger rebalancing)

# ═══════════════════════════════════════════════════
# METRICS
# ═══════════════════════════════════════════════════

metrics:daily:{date}:requests       → STRING (INCR)
metrics:daily:{date}:latency_sum    → STRING (INCRBY)
metrics:daily:{date}:errors         → STRING (INCR)
metrics:agent:{agent_type}:p99_ms   → STRING (updated periodically)
```

### Sincronização entre Camadas

```go
// memory_agent executa sync Redis → SQLite a cada 60s
func (m *MemoryAgent) SyncToSQLite(ctx context.Context) {
    ticker := time.NewTicker(60 * time.Second)
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            // Sync billing events
            events := m.redis.LRange(ctx, "billing:events:pending", 0, -1).Val()
            for _, evt := range events {
                m.db.Exec("INSERT INTO billing_events ...")
            }
            m.redis.Del(ctx, "billing:events:pending")

            // Sync audit logs (Redis Streams → SQLite)
            entries := m.redis.XRange(ctx, "audit:stream", "-", "+").Val()
            for _, entry := range entries {
                m.db.Exec("INSERT INTO audit_log ...")
            }
            m.redis.XTrimMinID(ctx, "audit:stream", lastProcessedID)
        }
    }
}
```

---

## 4. Sistema de Filas Compartilhadas — Task Board em Tempo Real

### Modelo de Task (JSON)

```json
{
  "task_id": "t_a1b2c3d4",
  "graph_id": "g_x7y8z9",
  "node_id": "n_intake_01",
  "type": "intake",
  "status": "pending",
  "priority": 100,
  "agent_responsible": null,
  "worker_id": null,
  "input": {
    "webhook_payload": "...",
    "signature": "sha256=..."
  },
  "output": null,
  "created_at": "2026-04-07T22:58:00.000Z",
  "claimed_at": null,
  "completed_at": null,
  "retries": 0,
  "max_retries": 3,
  "timeout_ms": 10000,
  "stolen_from": null,
  "error": null
}
```

### Work-Stealing em Go + Redis

```go
// Cada worker roda este loop como goroutine
type SwarmWorker struct {
    ID          string
    AgentType   string           // "intake", "classifier", etc.
    Agent       AgentInterface   // implementação do agente
    Redis       *redis.Client
    StealFrom   []string         // tipos de agentes que pode assumir
    MyQueue     string           // swarm:queue:{agent_type}
    Processing  string           // swarm:queue:{agent_type}:processing
    HeartbeatTTL time.Duration
}

func (w *SwarmWorker) Run(ctx context.Context) {
    // Registrar no registry
    w.register(ctx)
    defer w.deregister(ctx)

    // Heartbeat em goroutine separada
    go w.heartbeatLoop(ctx)

    for {
        select {
        case <-ctx.Done():
            return
        default:
            task := w.claimTask(ctx)
            if task != nil {
                w.executeTask(ctx, task)
            }
        }
    }
}

func (w *SwarmWorker) claimTask(ctx context.Context) *SwarmTask {
    // 1. Tenta própria fila primeiro (BRPOP com timeout curto)
    result, err := w.Redis.BRPop(ctx, 100*time.Millisecond, w.MyQueue).Result()
    if err == nil {
        task := parseTask(result[1])
        w.markProcessing(ctx, task)
        return task
    }

    // 2. Fila vazia → work-stealing
    return w.stealTask(ctx)
}

func (w *SwarmWorker) stealTask(ctx context.Context) *SwarmTask {
    for _, targetType := range w.StealFrom {
        targetQueue := fmt.Sprintf("swarm:queue:%s", targetType)
        queueLen := w.Redis.LLen(ctx, targetQueue).Val()

        // Só rouba se target tem mais de 1 task
        if queueLen > 1 {
            // LMOVE atômico: pega do final da fila do outro
            data, err := w.Redis.LMove(ctx, targetQueue, w.MyQueue, "RIGHT", "LEFT").Result()
            if err == nil {
                task := parseTask(data)
                task.StolenFrom = targetType
                w.markProcessing(ctx, task)
                log.Printf("[STEAL] Worker %s stole task %s from %s", w.ID, task.ID, targetType)
                return task
            }
        }
    }
    return nil
}

func (w *SwarmWorker) executeTask(ctx context.Context, task *SwarmTask) {
    // Timeout por task
    taskCtx, cancel := context.WithTimeout(ctx, time.Duration(task.TimeoutMs)*time.Millisecond)
    defer cancel()

    start := time.Now()
    output, err := w.Agent.Execute(taskCtx, task)
    duration := time.Since(start)

    if err != nil {
        w.handleFailure(ctx, task, err)
        return
    }

    // Sucesso: atualizar state, publicar evento, remover de processing
    task.Output = output
    task.Status = "completed"
    task.CompletedAt = time.Now()
    w.updateSharedState(ctx, task)
    w.Redis.HDel(ctx, w.Processing, task.ID)

    // Publicar conclusão para o scheduler
    w.Redis.Publish(ctx, "swarm:events:task_completed", marshalEvent(task))

    // Atualizar stats
    w.Redis.HIncrBy(ctx, fmt.Sprintf("swarm:agents:stats:%s", w.ID), "tasks_completed", 1)
    if task.StolenFrom != "" {
        w.Redis.HIncrBy(ctx, fmt.Sprintf("swarm:agents:stats:%s", w.ID), "tasks_stolen", 1)
    }
}

func (w *SwarmWorker) handleFailure(ctx context.Context, task *SwarmTask, err error) {
    task.Retries++
    task.Error = err.Error()

    if task.Retries >= task.MaxRetries {
        // Dead-letter
        task.Status = "dead"
        deadQueue := fmt.Sprintf("swarm:queue:%s:dead", task.Type)
        w.Redis.LPush(ctx, deadQueue, marshal(task))
        log.Printf("[DEAD] Task %s after %d retries: %v", task.ID, task.Retries, err)
    } else {
        // Re-enqueue com backoff
        task.Status = "pending"
        task.AgentResponsible = ""
        backoff := time.Duration(1<<uint(task.Retries)) * time.Second
        time.AfterFunc(backoff, func() {
            w.Redis.LPush(ctx, fmt.Sprintf("swarm:queue:%s", task.Type), marshal(task))
        })
    }

    w.Redis.HDel(ctx, w.Processing, task.ID)
}

// Heartbeat: se parar, tasks órfãs são redistribuídas
func (w *SwarmWorker) heartbeatLoop(ctx context.Context) {
    ticker := time.NewTicker(5 * time.Second)
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            w.Redis.SetEx(ctx, fmt.Sprintf("swarm:agents:heartbeat:%s", w.ID), "alive", w.HeartbeatTTL)
        }
    }
}
```

### Lua Script — Atomic Task Claim com Anti-Conflito

```lua
-- claim_task.lua
-- KEYS[1] = swarm:queue:{agent_type}
-- KEYS[2] = swarm:queue:{agent_type}:processing
-- ARGV[1] = worker_id
-- ARGV[2] = current_timestamp

local task_json = redis.call('RPOP', KEYS[1])
if not task_json then
    return nil
end

-- Marcar como processing atomicamente
local task = cjson.decode(task_json)
task['status'] = 'running'
task['worker_id'] = ARGV[1]
task['claimed_at'] = ARGV[2]

redis.call('HSET', KEYS[2], task['task_id'], cjson.encode(task))

return cjson.encode(task)
```

### Redistribuição de Tasks Órfãs

```go
// Watchdog: detecta workers mortos e redistribui tasks
func (s *SwarmController) OrphanWatchdog(ctx context.Context) {
    ticker := time.NewTicker(10 * time.Second)
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            // Listar todos os workers registrados
            registry := s.Redis.HGetAll(ctx, "swarm:agents:registry").Val()
            for workerID, infoJSON := range registry {
                // Checar heartbeat
                alive := s.Redis.Exists(ctx, fmt.Sprintf("swarm:agents:heartbeat:%s", workerID)).Val()
                if alive == 0 {
                    // Worker morto: redistribuir tasks em processing
                    info := parseWorkerInfo(infoJSON)
                    processingKey := fmt.Sprintf("swarm:queue:%s:processing", info.AgentType)
                    orphanTasks := s.Redis.HGetAll(ctx, processingKey).Val()

                    for taskID, taskJSON := range orphanTasks {
                        task := parseTask(taskJSON)
                        if task.WorkerID == workerID {
                            // Re-enqueue
                            task.Status = "pending"
                            task.WorkerID = ""
                            task.AgentResponsible = ""
                            s.Redis.LPush(ctx, fmt.Sprintf("swarm:queue:%s", task.Type), marshal(task))
                            s.Redis.HDel(ctx, processingKey, taskID)
                            log.Printf("[ORPHAN] Redistributed task %s from dead worker %s", taskID, workerID)
                        }
                    }

                    // Remover worker morto
                    s.Redis.HDel(ctx, "swarm:agents:registry", workerID)
                }
            }
        }
    }
}
```

### Painel em Tempo Real (SSE endpoint)

```go
// GET /api/swarm/board — Server-Sent Events para dashboard real-time
func (h *Handler) SwarmBoard(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Content-Type", "text/event-stream")
    w.Header().Set("Cache-Control", "no-cache")
    w.Header().Set("Connection", "keep-alive")

    flusher, ok := w.(http.Flusher)
    if !ok {
        http.Error(w, "streaming not supported", 500)
        return
    }

    // Subscrever em todos os canais de eventos do swarm
    pubsub := h.Redis.PSubscribe(r.Context(),
        "swarm:events:task_completed",
        "swarm:events:agent_status",
        "swarm:events:graph_done",
        "swarm:events:rebalance",
    )
    defer pubsub.Close()

    // Enviar snapshot inicial
    snapshot := h.buildBoardSnapshot(r.Context())
    fmt.Fprintf(w, "event: snapshot\ndata: %s\n\n", marshal(snapshot))
    flusher.Flush()

    // Stream de eventos em tempo real
    ch := pubsub.Channel()
    for {
        select {
        case <-r.Context().Done():
            return
        case msg := <-ch:
            eventType := extractEventType(msg.Channel)
            fmt.Fprintf(w, "event: %s\ndata: %s\n\n", eventType, msg.Payload)
            flusher.Flush()
        }
    }
}

type BoardSnapshot struct {
    Agents     []AgentStatus   `json:"agents"`
    Queues     []QueueStatus   `json:"queues"`
    ActiveGraphs int           `json:"active_graphs"`
    TasksPerSecond float64     `json:"tasks_per_second"`
    Timestamp  string          `json:"timestamp"`
}

type AgentStatus struct {
    WorkerID       string `json:"worker_id"`
    Type           string `json:"type"`
    Status         string `json:"status"` // idle | working | stealing
    CurrentTask    string `json:"current_task"`
    TasksCompleted int64  `json:"tasks_completed"`
    TasksStolen    int64  `json:"tasks_stolen"`
    AvgDurationMs  int64  `json:"avg_duration_ms"`
    LastHeartbeat  string `json:"last_heartbeat"`
}

type QueueStatus struct {
    AgentType   string `json:"agent_type"`
    Pending     int64  `json:"pending"`
    Processing  int64  `json:"processing"`
    DeadLetter  int64  `json:"dead_letter"`
}
```

---

## 5. Orquestração com Go Graph

### Definição Declarativa do Grafo

```go
// graph_builder.go — Construção do DAG para cada mensagem
func BuildMessageGraph(graphID string, hasMedia bool) *ExecutionGraph {
    g := &ExecutionGraph{
        ID:    graphID,
        Nodes: make(map[string]*GraphNode),
        Edges: make(map[string][]string),
        State: NewSharedState(graphID),
    }

    // Nó 1: intake (entry point — sem dependências)
    g.AddNode(&GraphNode{
        ID: "intake", AgentType: "intake",
        DependsOn: []string{}, MaxRetries: 3, Timeout: 10 * time.Second,
    })

    // Nó 2: classifier (depende de intake)
    g.AddNode(&GraphNode{
        ID: "classifier", AgentType: "classifier",
        DependsOn: []string{"intake"}, MaxRetries: 2, Timeout: 8 * time.Second,
    })

    // Nó 3: access_control (depende de classifier)
    g.AddNode(&GraphNode{
        ID: "access_control", AgentType: "access_control",
        DependsOn: []string{"classifier"}, MaxRetries: 2, Timeout: 3 * time.Second,
    })

    // Nós 4, 5, 6: paralelos após access_control
    g.AddNode(&GraphNode{
        ID: "rag", AgentType: "rag",
        DependsOn: []string{"access_control"}, MaxRetries: 3, Timeout: 30 * time.Second,
    })

    g.AddNode(&GraphNode{
        ID: "billing", AgentType: "billing",
        DependsOn: []string{"access_control"}, MaxRetries: 5, Timeout: 10 * time.Second,
    })

    g.AddNode(&GraphNode{
        ID: "memory_pre", AgentType: "memory",
        DependsOn: []string{"access_control"}, MaxRetries: 1, Timeout: 5 * time.Second,
    })

    // Nó 7: ranking (depende de rag)
    g.AddNode(&GraphNode{
        ID: "ranking", AgentType: "ranking",
        DependsOn: []string{"rag"}, MaxRetries: 2, Timeout: 15 * time.Second,
    })

    // Nó 8: response (depende de ranking + access_control)
    g.AddNode(&GraphNode{
        ID: "response", AgentType: "response",
        DependsOn: []string{"ranking", "access_control"}, MaxRetries: 3, Timeout: 20 * time.Second,
    })

    // Nó 9: memory_post (depende de response — persiste resultado final)
    g.AddNode(&GraphNode{
        ID: "memory_post", AgentType: "memory",
        DependsOn: []string{"response"}, MaxRetries: 1, Timeout: 5 * time.Second,
    })

    // Conditional: se access_control.decision == "block", skip rag→ranking→response
    g.AddConditionalSkip("access_control", "block",
        []string{"rag", "ranking", "response", "memory_post"})

    return g
}

// Conditional skip: quando access nega, pula direto para response de bloqueio
func (g *ExecutionGraph) AddConditionalSkip(sourceNode string, triggerValue string, skipNodes []string) {
    g.Conditions = append(g.Conditions, Condition{
        SourceNode:   sourceNode,
        OutputField:  "decision",
        TriggerValue: triggerValue,
        Action:       "skip",
        TargetNodes:  skipNodes,
    })
}
```

### Visualização do Grafo

```
                    ┌─────────┐
                    │ intake  │
                    └────┬────┘
                         │
                    ┌────▼─────┐
                    │classifier│
                    └────┬─────┘
                         │
                  ┌──────▼──────┐
                  │access_control│
                  └──┬───┬───┬──┘
                     │   │   │
            ┌────────┘   │   └────────┐
            │            │            │
       ┌────▼───┐  ┌─────▼────┐  ┌───▼───────┐
       │  rag   │  │ billing  │  │memory_pre  │
       └────┬───┘  └──────────┘  └────────────┘
            │
       ┌────▼────┐
       │ ranking │
       └────┬────┘
            │
       ┌────▼─────┐
       │ response │
       └────┬─────┘
            │
       ┌────▼──────┐
       │memory_post│
       └───────────┘

  ── Paralelo: rag + billing + memory_pre executam simultaneamente
  ── Conditional: se access_control = "block", skip rag→ranking→response
                  response_agent envia mensagem de bloqueio diretamente
```

### Execução Paralela e Recuperação de Falhas

```go
// O runtime monitora eventos e avança o grafo
func (r *GraphRuntime) ProcessEvent(ctx context.Context, event TaskCompletedEvent) {
    graph := r.GetGraph(event.GraphID)
    node := graph.Nodes[event.NodeID]

    if event.Status == "completed" {
        node.Status = NodeCompleted
        node.Output = event.Output
        node.CompletedAt = time.Now()

        // Propagar output para shared state
        r.propagateOutput(ctx, graph, node)

        // Avaliar condições
        r.evaluateConditions(ctx, graph, node)

        // Resolver próximos nós
        readyNodes := graph.ResolveReady()
        for _, next := range readyNodes {
            r.scheduler.EnqueueNode(ctx, graph, next)
        }

        // Checar se grafo concluiu
        if graph.IsComplete() {
            totalDuration := time.Since(graph.Created)
            r.Redis.Publish(ctx, "swarm:events:graph_done", marshalGraphDone(graph, totalDuration))
            r.cleanupGraph(ctx, graph)
        }
    } else if event.Status == "failed" {
        node.Status = NodeFailed
        // O handleFailure no worker já faz retry/dead-letter
        // Se dead-letter: marcar dependentes como skipped
        if node.Retries >= node.MaxRetries {
            r.skipDependents(ctx, graph, node)
        }
    }
}

func (r *GraphRuntime) evaluateConditions(ctx context.Context, graph *ExecutionGraph, node *GraphNode) {
    for _, cond := range graph.Conditions {
        if cond.SourceNode != node.ID {
            continue
        }
        outputVal := getOutputField(node.Output, cond.OutputField)
        if outputVal == cond.TriggerValue {
            for _, targetID := range cond.TargetNodes {
                target := graph.Nodes[targetID]
                target.Status = NodeSkipped
            }
            // Se access blocked: criar nó especial response_block
            if cond.TriggerValue == "block" {
                r.enqueueBlockResponse(ctx, graph)
            }
        }
    }
}
```

---

## 6. Pipeline End-to-End

### Fluxo Completo

```
Timestamp  Agente            Ação                                    Duração
─────────────────────────────────────────────────────────────────────────────
T+0ms      HTTP Handler      Recebe webhook WhatsApp                  1ms
T+1ms      Scheduler         Cria ExecutionGraph, enfileira intake     1ms
T+2ms      intake_agent      BRPOP, valida, normaliza, escreve state  8ms
T+10ms     Scheduler         Detecta classifier ready, enfileira       1ms
T+11ms     classifier_agent  Classifica intent, extrai entidades      120ms
T+131ms    Scheduler         Detecta access_control ready              1ms
T+132ms    access_control    Lua script Redis: allow, remaining=7      2ms
T+134ms    Scheduler         Detecta 3 nós ready: rag, billing, mem    1ms
T+135ms    rag_agent         Embedding + hybrid search Qdrant         280ms
T+135ms    billing_agent     Registra request_used (paralelo)           5ms
T+135ms    memory_agent      Persiste input na conversa (paralelo)     10ms
T+415ms    Scheduler         Detecta ranking ready                      1ms
T+416ms    ranking_agent     Re-rank + monta contexto                 150ms
T+566ms    Scheduler         Detecta response ready                     1ms
T+567ms    response_agent    Gemini gera resposta + envia WhatsApp    800ms
T+1367ms   Scheduler         Detecta memory_post ready                  1ms
T+1368ms   memory_agent      Persiste resposta + audit log              8ms
T+1376ms   Runtime           Graph completo. Cleanup state.             2ms
─────────────────────────────────────────────────────────────────────────────
TOTAL:     ~1.4s end-to-end (mensagem → resposta no WhatsApp)
```

### Simulações curl

#### Envio de Mensagem (Mock WhatsApp Webhook)

```bash
# ═══ Simular mensagem de texto recebida ═══
curl -s -X POST http://localhost:8080/webhook \
  -H "Content-Type: application/json" \
  -H "X-Hub-Signature-256: sha256=mock_dev_mode" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "BIZ_ID",
      "changes": [{
        "field": "messages",
        "value": {
          "messaging_product": "whatsapp",
          "metadata": {"phone_number_id": "PH_ID"},
          "contacts": [{"profile": {"name": "João Técnico"}, "wa_id": "5511999887766"}],
          "messages": [{
            "from": "5511999887766",
            "id": "wamid.test001",
            "timestamp": "1712534280",
            "type": "text",
            "text": {"body": "Qual o erro E4 no split Carrier 12000 BTU?"}
          }]
        }
      }]
    }]
  }' | jq .

# Resposta esperada:
# { "graph_id": "g_a1b2c3d4", "status": "accepted", "queued_at": "2026-04-07T22:58:00Z" }
```

#### Consultar Task Board (estado das filas)

```bash
# ═══ Snapshot do painel de filas ═══
curl -s http://localhost:8080/api/swarm/board/snapshot | jq .

# Resposta esperada:
# {
#   "agents": [
#     {"worker_id": "w_intake_01", "type": "intake", "status": "idle", "tasks_completed": 142},
#     {"worker_id": "w_rag_01", "type": "rag", "status": "working", "current_task": "t_xyz"}
#   ],
#   "queues": [
#     {"agent_type": "intake", "pending": 0, "processing": 0, "dead_letter": 0},
#     {"agent_type": "rag", "pending": 2, "processing": 1, "dead_letter": 0}
#   ],
#   "active_graphs": 3,
#   "tasks_per_second": 12.5
# }
```

#### Criar Task Manualmente (Admin API)

```bash
# ═══ Injetar task diretamente na fila de um agente ═══
curl -s -X POST http://localhost:8080/api/swarm/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "type": "rag",
    "priority": 80,
    "input": {
      "rewritten_query": "Erro E4 split Carrier 12000 BTU diagnóstico",
      "entities": {"brand": "Carrier", "error_code": "E4", "btu": 12000}
    }
  }' | jq .

# Resposta: { "task_id": "t_manual_01", "queued_to": "swarm:queue:rag" }
```

#### Consumo por Agente (debug: ver claim)

```bash
# ═══ Ver tasks em processing por agente ═══
curl -s http://localhost:8080/api/swarm/agents/w_rag_01/tasks | jq .

# Resposta:
# {
#   "worker_id": "w_rag_01",
#   "current_tasks": [
#     {"task_id": "t_xyz", "type": "rag", "status": "running", "claimed_at": "...", "duration_ms": 180}
#   ],
#   "stats": {"completed": 89, "stolen": 12, "avg_ms": 285}
# }
```

#### Ver Estado do Grafo (debug)

```bash
# ═══ Status de um grafo de execução específico ═══
curl -s http://localhost:8080/api/swarm/graphs/g_a1b2c3d4 | jq .

# Resposta:
# {
#   "graph_id": "g_a1b2c3d4",
#   "status": "running",
#   "nodes": {
#     "intake": {"status": "completed", "duration_ms": 8},
#     "classifier": {"status": "completed", "duration_ms": 120},
#     "access_control": {"status": "completed", "duration_ms": 2, "output": {"decision": "allow"}},
#     "rag": {"status": "running", "worker_id": "w_rag_02", "duration_ms": 180},
#     "billing": {"status": "completed", "duration_ms": 5},
#     "memory_pre": {"status": "completed", "duration_ms": 10},
#     "ranking": {"status": "pending"},
#     "response": {"status": "pending"},
#     "memory_post": {"status": "pending"}
#   },
#   "total_elapsed_ms": 321
# }
```

#### Resposta Final (Mock WhatsApp Send)

```bash
# ═══ Simular envio de resposta (em produção vai via Graph API) ═══
curl -s -X POST "https://graph.facebook.com/v21.0/PH_ID/messages" \
  -H "Authorization: Bearer MOCK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "messaging_product": "whatsapp",
    "to": "5511999887766",
    "type": "text",
    "text": {
      "body": "O erro E4 no split Carrier 42XCA 12000 BTU indica falha no sensor de temperatura do evaporador.\n\n📋 Diagnóstico:\n1. Desligue o equipamento e aguarde 5 min\n2. Verifique o conector do sensor no PCB\n3. Meça a resistência: 10kΩ a 25°C\n4. Se fora da faixa, substitua (peça CNRBP3050)\n\n📖 Manual Carrier 42XCA, p.12\n⚡ Consultas restantes: 7/10"
    }
  }'
```

#### Smoke Test: Bloqueio por Limite

```bash
# ═══ Esgotar 10 requests e verificar bloqueio ═══
for i in $(seq 1 11); do
  RESPONSE=$(curl -s -X POST http://localhost:8080/webhook \
    -H "Content-Type: application/json" \
    -H "X-Hub-Signature-256: sha256=mock_dev_mode" \
    -d "{
      \"object\": \"whatsapp_business_account\",
      \"entry\": [{\"id\": \"BIZ\", \"changes\": [{\"field\": \"messages\", \"value\": {
        \"messaging_product\": \"whatsapp\",
        \"metadata\": {\"phone_number_id\": \"PH\"},
        \"messages\": [{\"from\": \"5511900000099\", \"id\": \"wamid.test_$i\",
          \"timestamp\": \"1712534280\", \"type\": \"text\",
          \"text\": {\"body\": \"teste $i\"}}]
      }}]}]
    }")
  echo "Request $i: $RESPONSE"
done

# Requests 1-10: {"status": "accepted"}
# Request 11:    {"status": "blocked", "redirect": "https://zappro.site"}
```

#### Smoke Test: Ativação via Stripe

```bash
# ═══ Simular webhook Stripe de pagamento ═══
curl -s -X POST http://localhost:8080/webhooks/stripe \
  -H "Content-Type: application/json" \
  -H "Stripe-Signature: t=1712534280,v1=mock_sig" \
  -d '{
    "id": "evt_smoke_001",
    "type": "checkout.session.completed",
    "data": {"object": {
      "id": "cs_smoke_001", "status": "complete", "payment_status": "paid",
      "client_reference_id": "5511900000099",
      "metadata": {"phone": "5511900000099", "plan": "pro"},
      "amount_total": 4990, "currency": "brl"
    }}
  }' | jq .

# Verificar ativação:
curl -s http://localhost:8080/api/users/5511900000099/status | jq .
# { "status": "trial_on", "plan": "pro", "remaining_requests": -1 }
```

---

## 7. Engineering JSONs

### agents.json

```json
{
  "swarm": {
    "name": "hvacr_whatsapp_swarm",
    "version": "1.0.0",
    "total_workers": 14,
    "agents": [
      {
        "type": "intake",
        "workers": 2,
        "priority_weight": 6,
        "steal_from": ["classifier"],
        "queue": "swarm:queue:intake",
        "timeout_ms": 10000,
        "max_retries": 3,
        "capabilities": ["webhook_parse", "signature_validation", "media_download"],
        "resource": "cpu_light"
      },
      {
        "type": "classifier",
        "workers": 2,
        "priority_weight": 6,
        "steal_from": ["intake", "rag"],
        "queue": "swarm:queue:classifier",
        "timeout_ms": 8000,
        "max_retries": 2,
        "capabilities": ["intent_classification", "entity_extraction", "query_rewrite"],
        "resource": "gpu_light",
        "llm": "gemini-2.5-flash"
      },
      {
        "type": "access_control",
        "workers": 1,
        "priority_weight": 6,
        "steal_from": [],
        "queue": "swarm:queue:access_control",
        "timeout_ms": 3000,
        "max_retries": 2,
        "capabilities": ["redis_lua", "user_state_management"],
        "resource": "cpu_light"
      },
      {
        "type": "rag",
        "workers": 3,
        "priority_weight": 3,
        "steal_from": ["ranking"],
        "queue": "swarm:queue:rag",
        "timeout_ms": 30000,
        "max_retries": 3,
        "capabilities": ["embedding_generation", "hybrid_search", "qdrant_query"],
        "resource": "gpu_heavy",
        "models": ["gemini-embedding-2-preview", "Qdrant/bm25"]
      },
      {
        "type": "ranking",
        "workers": 2,
        "priority_weight": 3,
        "steal_from": ["rag", "response"],
        "queue": "swarm:queue:ranking",
        "timeout_ms": 15000,
        "max_retries": 2,
        "capabilities": ["cross_encoder_reranking", "context_assembly"],
        "resource": "gpu_light"
      },
      {
        "type": "response",
        "workers": 2,
        "priority_weight": 6,
        "steal_from": ["ranking"],
        "queue": "swarm:queue:response",
        "timeout_ms": 20000,
        "max_retries": 3,
        "capabilities": ["response_generation", "hallucination_check", "whatsapp_send"],
        "resource": "gpu_heavy",
        "llm": "gemini-2.5-flash"
      },
      {
        "type": "billing",
        "workers": 1,
        "priority_weight": 1,
        "steal_from": ["memory"],
        "queue": "swarm:queue:billing",
        "timeout_ms": 10000,
        "max_retries": 5,
        "capabilities": ["stripe_checkout", "webhook_processing", "plan_activation"],
        "resource": "cpu_light"
      },
      {
        "type": "memory",
        "workers": 1,
        "priority_weight": 1,
        "steal_from": ["billing"],
        "queue": "swarm:queue:memory",
        "timeout_ms": 5000,
        "max_retries": 1,
        "capabilities": ["conversation_persist", "fact_extraction", "audit_logging", "sqlite_sync"],
        "resource": "cpu_light"
      }
    ]
  }
}
```

### tasks.json

```json
{
  "task_schema": {
    "version": "1.0.0",
    "fields": {
      "task_id": {"type": "string", "format": "t_{ulid}", "required": true},
      "graph_id": {"type": "string", "format": "g_{ulid}", "required": true},
      "node_id": {"type": "string", "required": true},
      "type": {
        "type": "string",
        "enum": ["intake", "classifier", "access_control", "rag", "ranking", "response", "billing", "memory"],
        "required": true
      },
      "status": {
        "type": "string",
        "enum": ["pending", "running", "completed", "failed", "dead", "skipped"],
        "default": "pending"
      },
      "priority": {"type": "integer", "min": 0, "max": 100, "default": 50},
      "agent_responsible": {"type": "string", "nullable": true},
      "worker_id": {"type": "string", "nullable": true},
      "input": {"type": "object", "required": true},
      "output": {"type": "object", "nullable": true},
      "created_at": {"type": "string", "format": "ISO 8601", "required": true},
      "claimed_at": {"type": "string", "format": "ISO 8601", "nullable": true},
      "completed_at": {"type": "string", "format": "ISO 8601", "nullable": true},
      "retries": {"type": "integer", "default": 0},
      "max_retries": {"type": "integer", "default": 3},
      "timeout_ms": {"type": "integer", "default": 10000},
      "stolen_from": {"type": "string", "nullable": true},
      "error": {"type": "string", "nullable": true}
    },
    "priority_rules": {
      "critical_agents": {"types": ["intake", "access_control", "response"], "base_priority": 90},
      "high_agents": {"types": ["classifier", "rag", "ranking"], "base_priority": 70},
      "low_agents": {"types": ["billing", "memory"], "base_priority": 30},
      "boost_rules": [
        {"condition": "user.plan == 'pro'", "boost": 10},
        {"condition": "retries > 0", "boost": -5},
        {"condition": "age_ms > 5000", "boost": 15}
      ]
    }
  }
}
```

### memory_schema.json

```json
{
  "memory_schema": {
    "version": "1.0.0",
    "layers": {
      "hot": {
        "engine": "Redis 7",
        "purpose": "Estado em tempo real, filas, cache",
        "namespaces": {
          "graph_state": {
            "pattern": "state:{graph_id}:*",
            "ttl_seconds": 300,
            "types": {
              "input": "HASH",
              "intent": "STRING",
              "entities": "HASH",
              "rewritten_query": "STRING",
              "access_decision": "STRING",
              "rag_candidates": "LIST",
              "ranked_results": "LIST",
              "assembled_context": "STRING",
              "response_sent": "HASH",
              "agent_log": "STREAM"
            }
          },
          "user_state": {
            "pattern": "user:{phone}:*",
            "ttl_seconds": null,
            "types": {
              "status": "STRING",
              "requests_remaining": "STRING",
              "plan": "STRING",
              "total_requests": "STRING",
              "created_at": "STRING",
              "trial_expires_at": "STRING",
              "last_request_at": "STRING",
              "stripe_customer_id": "STRING",
              "conversation": "LIST (max 20)",
              "facts": "SET"
            }
          },
          "task_board": {
            "pattern": "swarm:queue:*",
            "types": {
              "pending": "LIST (LPUSH/BRPOP)",
              "processing": "HASH {task_id → task_json}",
              "dead": "LIST (dead-letter)"
            }
          },
          "agent_registry": {
            "pattern": "swarm:agents:*",
            "types": {
              "registry": "HASH {worker_id → info_json}",
              "heartbeat:{worker_id}": "STRING (SETEX 15s)",
              "stats:{worker_id}": "HASH {completed, stolen, avg_ms}"
            }
          },
          "cache": {
            "pattern": "cache:*",
            "types": {
              "query:{hash}": "STRING (TTL 1h)",
              "embedding:{hash}": "STRING (TTL 24h)"
            }
          },
          "pubsub_channels": [
            "swarm:events:task_completed",
            "swarm:events:agent_status",
            "swarm:events:graph_done",
            "swarm:events:rebalance"
          ]
        }
      },
      "vector": {
        "engine": "Qdrant 1.13",
        "purpose": "Busca semântica HVAC-R",
        "collection": "hvacr_knowledge",
        "config": {
          "dense_vectors": {"name": "dense", "size": 768, "distance": "Cosine"},
          "sparse_vectors": {"name": "sparse", "modifier": "IDF"},
          "payload_fields": [
            {"name": "content_type", "type": "keyword"},
            {"name": "brand", "type": "keyword"},
            {"name": "model", "type": "keyword"},
            {"name": "btu", "type": "integer", "range_index": true},
            {"name": "error_code", "type": "keyword"},
            {"name": "part", "type": "keyword"},
            {"name": "refrigerant", "type": "keyword"},
            {"name": "source_document", "type": "keyword"},
            {"name": "page_number", "type": "integer"},
            {"name": "chunk_type", "type": "keyword"},
            {"name": "video_start_time", "type": "keyword"},
            {"name": "embedding_version", "type": "keyword"},
            {"name": "created_at", "type": "datetime"}
          ]
        }
      },
      "cold": {
        "engine": "SQLite (WAL mode)",
        "purpose": "Persistência, analytics, compliance",
        "tables": {
          "users": "phone, status, plan, created_at, total_requests",
          "billing_events": "event_id, phone, type, amount_brl, stripe_id, timestamp",
          "audit_log": "graph_id, agent, action, input_hash, output_hash, duration_ms, timestamp",
          "conversations": "phone, role, content, timestamp"
        },
        "sync_interval_seconds": 60
      }
    }
  }
}
```

### queue_schema.json

```json
{
  "queue_schema": {
    "version": "1.0.0",
    "engine": "Redis 7 (LIST + HASH + LMOVE)",
    "architecture": "work-stealing with per-agent queues",
    "queues": {
      "intake": {
        "key": "swarm:queue:intake",
        "processing_key": "swarm:queue:intake:processing",
        "dead_letter_key": "swarm:queue:intake:dead",
        "max_retries": 3,
        "timeout_ms": 10000,
        "priority_class": "critical",
        "claim_strategy": "BRPOP 100ms → steal from classifier"
      },
      "classifier": {
        "key": "swarm:queue:classifier",
        "processing_key": "swarm:queue:classifier:processing",
        "dead_letter_key": "swarm:queue:classifier:dead",
        "max_retries": 2,
        "timeout_ms": 8000,
        "priority_class": "critical",
        "claim_strategy": "BRPOP 100ms → steal from intake, rag"
      },
      "access_control": {
        "key": "swarm:queue:access_control",
        "processing_key": "swarm:queue:access_control:processing",
        "dead_letter_key": "swarm:queue:access_control:dead",
        "max_retries": 2,
        "timeout_ms": 3000,
        "priority_class": "critical",
        "claim_strategy": "BRPOP 100ms (no stealing — specialized)"
      },
      "rag": {
        "key": "swarm:queue:rag",
        "processing_key": "swarm:queue:rag:processing",
        "dead_letter_key": "swarm:queue:rag:dead",
        "max_retries": 3,
        "timeout_ms": 30000,
        "priority_class": "high",
        "claim_strategy": "BRPOP 100ms → steal from ranking"
      },
      "ranking": {
        "key": "swarm:queue:ranking",
        "processing_key": "swarm:queue:ranking:processing",
        "dead_letter_key": "swarm:queue:ranking:dead",
        "max_retries": 2,
        "timeout_ms": 15000,
        "priority_class": "high",
        "claim_strategy": "BRPOP 100ms → steal from rag, response"
      },
      "response": {
        "key": "swarm:queue:response",
        "processing_key": "swarm:queue:response:processing",
        "dead_letter_key": "swarm:queue:response:dead",
        "max_retries": 3,
        "timeout_ms": 20000,
        "priority_class": "critical",
        "claim_strategy": "BRPOP 100ms → steal from ranking"
      },
      "billing": {
        "key": "swarm:queue:billing",
        "processing_key": "swarm:queue:billing:processing",
        "dead_letter_key": "swarm:queue:billing:dead",
        "max_retries": 5,
        "timeout_ms": 10000,
        "priority_class": "low",
        "claim_strategy": "BRPOP 100ms → steal from memory"
      },
      "memory": {
        "key": "swarm:queue:memory",
        "processing_key": "swarm:queue:memory:processing",
        "dead_letter_key": "swarm:queue:memory:dead",
        "max_retries": 1,
        "timeout_ms": 5000,
        "priority_class": "low",
        "claim_strategy": "BRPOP 100ms → steal from billing"
      }
    },
    "work_stealing": {
      "condition": "own_queue_empty AND target_queue_len > 1",
      "operation": "LMOVE target_queue own_queue RIGHT LEFT",
      "atomic": true,
      "tracking": "swarm:agents:stats:{worker_id}:tasks_stolen INCR"
    },
    "orphan_detection": {
      "interval_seconds": 10,
      "heartbeat_ttl_seconds": 15,
      "action": "re-enqueue to original agent queue"
    }
  }
}
```

### graph_execution.json

```json
{
  "graph_execution": {
    "version": "1.0.0",
    "graph_type": "DAG (Directed Acyclic Graph)",
    "scheduler_tick_ms": 10,
    "max_concurrent_graphs": 100,
    "default_graph": {
      "name": "whatsapp_message_pipeline",
      "nodes": [
        {
          "id": "intake",
          "agent_type": "intake",
          "depends_on": [],
          "max_retries": 3,
          "timeout_ms": 10000,
          "parallel_group": null
        },
        {
          "id": "classifier",
          "agent_type": "classifier",
          "depends_on": ["intake"],
          "max_retries": 2,
          "timeout_ms": 8000,
          "parallel_group": null
        },
        {
          "id": "access_control",
          "agent_type": "access_control",
          "depends_on": ["classifier"],
          "max_retries": 2,
          "timeout_ms": 3000,
          "parallel_group": null
        },
        {
          "id": "rag",
          "agent_type": "rag",
          "depends_on": ["access_control"],
          "max_retries": 3,
          "timeout_ms": 30000,
          "parallel_group": "post_access"
        },
        {
          "id": "billing",
          "agent_type": "billing",
          "depends_on": ["access_control"],
          "max_retries": 5,
          "timeout_ms": 10000,
          "parallel_group": "post_access"
        },
        {
          "id": "memory_pre",
          "agent_type": "memory",
          "depends_on": ["access_control"],
          "max_retries": 1,
          "timeout_ms": 5000,
          "parallel_group": "post_access"
        },
        {
          "id": "ranking",
          "agent_type": "ranking",
          "depends_on": ["rag"],
          "max_retries": 2,
          "timeout_ms": 15000,
          "parallel_group": null
        },
        {
          "id": "response",
          "agent_type": "response",
          "depends_on": ["ranking", "access_control"],
          "max_retries": 3,
          "timeout_ms": 20000,
          "parallel_group": null
        },
        {
          "id": "memory_post",
          "agent_type": "memory",
          "depends_on": ["response"],
          "max_retries": 1,
          "timeout_ms": 5000,
          "parallel_group": null
        }
      ],
      "conditions": [
        {
          "source_node": "access_control",
          "output_field": "decision",
          "trigger_value": "block",
          "action": "skip",
          "target_nodes": ["rag", "ranking", "response", "memory_post"],
          "alternative_action": "enqueue_block_response"
        }
      ],
      "completion_criteria": {
        "success": "all non-skipped nodes completed",
        "timeout": "60s total graph timeout",
        "failure": "any critical node in dead-letter"
      }
    }
  }
}
```

---

## 8. Estratégia Anti-Ociosidade

### Pool de Workers — Escuta Contínua

```go
// main.go — Bootstrap do swarm
func main() {
    ctx, cancel := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
    defer cancel()

    rdb := redis.NewClient(&redis.Options{Addr: "localhost:6379"})
    agents := loadAgentsConfig("agents.json") // carrega agents.json

    var wg sync.WaitGroup

    // Spawnar workers conforme configuração
    for _, agentCfg := range agents.Swarm.Agents {
        for i := 0; i < agentCfg.Workers; i++ {
            wg.Add(1)
            workerID := fmt.Sprintf("w_%s_%02d", agentCfg.Type, i+1)
            worker := &SwarmWorker{
                ID:           workerID,
                AgentType:    agentCfg.Type,
                Agent:        createAgent(agentCfg.Type),
                Redis:        rdb,
                StealFrom:    agentCfg.StealFrom,
                MyQueue:      agentCfg.Queue,
                Processing:   agentCfg.Queue + ":processing",
                HeartbeatTTL: 15 * time.Second,
            }
            go func() {
                defer wg.Done()
                worker.Run(ctx) // Loop infinito até ctx.Done()
            }()
        }
    }

    // Swarm controller (scheduler + watchdog + rebalancer)
    controller := NewSwarmController(rdb)
    go controller.SchedulerLoop(ctx)      // 10ms tick, resolve DAGs
    go controller.OrphanWatchdog(ctx)      // 10s tick, redistribui tasks
    go controller.RebalanceLoop(ctx)       // 30s tick, ajusta pool
    go controller.MetricsCollector(ctx)    // 5s tick, agrega métricas

    // HTTP server (webhook + admin API + SSE board)
    srv := NewHTTPServer(rdb, controller)
    go srv.ListenAndServe(":8080")

    wg.Wait()
}
```

### Rebalanceamento Automático

```go
// Detecta desequilíbrio e ajusta workers
func (c *SwarmController) RebalanceLoop(ctx context.Context) {
    ticker := time.NewTicker(30 * time.Second)
    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            queueDepths := map[string]int64{}
            for _, agentType := range allAgentTypes {
                depth := c.Redis.LLen(ctx, fmt.Sprintf("swarm:queue:%s", agentType)).Val()
                queueDepths[agentType] = depth
            }

            // Identificar filas congestionadas (> 10 tasks pendentes)
            for agentType, depth := range queueDepths {
                if depth > 10 {
                    // Publicar evento de rebalanceamento
                    c.Redis.Publish(ctx, "swarm:events:rebalance", marshalRebalance(agentType, depth))
                    log.Printf("[REBALANCE] Queue %s has %d pending — signaling workers to help", agentType, depth)
                }
            }

            // Workers escutam o canal e priorizam stealing dessa fila
        }
    }
}
```

### Detecção de Agente Inativo

```go
// Todo worker reporta atividade; se >30s sem atividade, é marcado como stalled
func (c *SwarmController) detectStalled(ctx context.Context) []string {
    stalled := []string{}
    registry := c.Redis.HGetAll(ctx, "swarm:agents:registry").Val()

    for workerID := range registry {
        stats := c.Redis.HGetAll(ctx, fmt.Sprintf("swarm:agents:stats:%s", workerID)).Val()
        lastActive, _ := time.Parse(time.RFC3339, stats["last_active_at"])

        if time.Since(lastActive) > 30*time.Second {
            stalled = append(stalled, workerID)
            log.Printf("[STALL] Worker %s inactive for >30s — investigating", workerID)
        }
    }
    return stalled
}
```

---

## 9. Integração RAG Multimodal — Acesso Compartilhado

### Como Agentes Acessam Contexto

```
rag_agent:
  1. Lê state:{graph_id}:rewritten_query (escrito por classifier)
  2. Lê state:{graph_id}:entities (escrito por classifier)
  3. Checa cache:query:{hash} → se hit, pula embedding + busca
  4. Gera embedding via Gemini Embedding 2
  5. Busca Qdrant: hybrid dense + sparse + RRF
  6. Escreve state:{graph_id}:rag_candidates

ranking_agent:
  1. Lê state:{graph_id}:rag_candidates (escrito por rag_agent)
  2. Lê state:{graph_id}:rewritten_query
  3. Lê user:{phone}:conversation (últimas 5 msgs para contexto)
  4. Re-rankeia, monta contexto
  5. Escreve state:{graph_id}:ranked_results + assembled_context

response_agent:
  1. Lê state:{graph_id}:assembled_context (escrito por ranking)
  2. Lê state:{graph_id}:access_decision (escrito por access_control)
  3. Lê user:{phone}:remaining_requests
  4. Gera resposta via Gemini 2.5 Flash
  5. Envia via WhatsApp Cloud API
  6. Escreve state:{graph_id}:response_sent
```

### Como Evitam Redundância

```go
// Cache-first pattern no rag_agent
func (r *RAGAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    query := task.Input["rewritten_query"].(string)
    cacheKey := fmt.Sprintf("cache:query:%s", hashSHA256(query))

    // 1. Cache check
    cached, err := r.Redis.Get(ctx, cacheKey).Result()
    if err == nil {
        return map[string]any{
            "candidates": json.Unmarshal(cached),
            "cache_hit":  true,
        }, nil
    }

    // 2. Embedding check (reuse se mesma query recente)
    embCacheKey := fmt.Sprintf("cache:embedding:%s", hashSHA256(query))
    var embedding []float64
    embCached, err := r.Redis.Get(ctx, embCacheKey).Result()
    if err == nil {
        embedding = parseFloats(embCached)
    } else {
        embedding = r.generateEmbedding(ctx, query)
        r.Redis.SetEx(ctx, embCacheKey, marshalFloats(embedding), 24*time.Hour)
    }

    // 3. Qdrant search
    candidates := r.hybridSearch(ctx, embedding, task.Input["entities"])

    // 4. Cache resultado
    r.Redis.SetEx(ctx, cacheKey, marshal(candidates), 1*time.Hour)

    return map[string]any{
        "candidates": candidates,
        "cache_hit":  false,
    }, nil
}
```

---

## 10. Estratégia de Evolução

### Fase 1: Swarm Mínimo (3 agents, mock)

```
Workers: intake×1, rag×1, response×1
Total:   3 goroutines
RAG:     1 PDF indexado, keyword search
LLM:     Gemini 2.5 Flash (API)
WhatsApp: Mock (curl)
Billing:  Desativado
Memory:   Redis only
```

### Fase 2: Swarm Básico (6 agents, semi-real)

```
Workers: intake×1, classifier×1, access_control×1, rag×2, response×1
Total:   6 goroutines
RAG:     5+ PDFs, hybrid search Qdrant
LLM:     Gemini 2.5 Flash
WhatsApp: Test number (Meta sandbox)
Billing:  Stripe test mode
Memory:   Redis + SQLite
```

### Fase 3: Swarm Completo (14 agents, produção)

```
Workers: intake×2, classifier×2, access_control×1, rag×3, ranking×2,
         response×2, billing×1, memory×1
Total:   14 goroutines
RAG:     20+ manuais, 50+ vídeos, multimodal
LLM:     Gemini 2.5 Flash + local Gemma3 27B (fallback)
WhatsApp: Business Account verificado
Billing:  Stripe live (Pix, Boleto, Cartão)
Memory:   Redis + Qdrant + SQLite, sync completo
Dashboard: SSE board em tempo real
Monitoring: Grafana + Telegram bot alerts
```

### Adicionar Novo Agente Sem Quebrar

```go
// 1. Implementar AgentInterface
type PricingAgent struct{}

func (p *PricingAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    // Lógica de cotação HVAC-R
    return map[string]any{"quote": "R$ 3.500,00"}, nil
}

// 2. Adicionar em agents.json
// { "type": "pricing", "workers": 1, "steal_from": ["billing"], ... }

// 3. Registrar no factory
func createAgent(agentType string) AgentInterface {
    switch agentType {
    case "intake":     return &IntakeAgent{}
    case "pricing":    return &PricingAgent{}  // novo
    // ...
    }
}

// 4. Adicionar nó no grafo (se necessário)
g.AddNode(&GraphNode{
    ID: "pricing", AgentType: "pricing",
    DependsOn: []string{"classifier"}, Timeout: 10 * time.Second,
})

// 5. Deploy: restart com novo binário — workers antigos drenam, novos iniciam
```

---

## 11. Diferenciais Avançados

### Aprendizado com Histórico

```go
// memory_agent extrai fatos das conversas e armazena por usuário
func (m *MemoryAgent) extractFacts(ctx context.Context, phone, userMsg, botResponse string) {
    // Gemini extrai fatos duráveis da conversa
    prompt := fmt.Sprintf(`Extraia fatos duráveis desta conversa HVAC-R:
User: %s
Bot: %s
Retorne apenas fatos úteis para futuras consultas.`, userMsg, botResponse)

    facts := m.LLM.Generate(ctx, prompt)
    for _, fact := range facts {
        m.Redis.SAdd(ctx, fmt.Sprintf("user:%s:facts", phone), fact)
    }
}

// classifier_agent usa fatos para enriquecer classificação
func (c *ClassifierAgent) enrich(ctx context.Context, phone, query string) string {
    facts := c.Redis.SMembers(ctx, fmt.Sprintf("user:%s:facts", phone)).Val()
    if len(facts) > 0 {
        return fmt.Sprintf("Contexto do usuário: %s\nQuery: %s", strings.Join(facts, "; "), query)
    }
    return query
}
```

### Priorização Inteligente

```go
func (s *Scheduler) calculatePriority(node *GraphNode, graphState *SharedState) int {
    base := priorityBase[node.AgentType] // 90 critical, 70 high, 30 low

    // Boost: usuário pagante
    if graphState.UserPlan == "pro" || graphState.UserPlan == "enterprise" {
        base += 10
    }

    // Boost: task envelhecendo na fila (>5s)
    age := time.Since(graphState.CreatedAt)
    if age > 5*time.Second {
        base += 15
    }

    // Penalidade: retry
    base -= node.Retries * 5

    // Cap
    if base > 100 { base = 100 }
    if base < 0   { base = 0 }

    return base
}
```

### Cooperação Emergente

```
O swarm produz cooperação emergente naturalmente:

1. Work-stealing: quando rag_agent está sobrecarregado, ranking_agent
   (que pode steal de rag) automaticamente assume tasks de retrieval

2. Rebalanceamento: controller detecta fila congestionada e publica
   evento → workers priorizam stealing daquela fila

3. Fallback cascata: se Gemini API cai, response_agent retry → dead-letter
   → controller detecta → publica alerta → classifier_agent automaticamente
   redireciona para respostas pré-cached

4. Memória coletiva: fatos extraídos por memory_agent são usados por
   classifier_agent para enriquecer queries futuras de qualquer usuário
   com equipamento similar
```

### Sistema Nunca Para

```
Garantias de disponibilidade:

1. Fail-open em access_control: se Redis cai, permite acesso (não bloqueia)
2. Circuit breaker em Qdrant: sparse-only fallback se vetorial cai
3. Circuit breaker em Gemini: respostas pré-cached para erros comuns
4. Dead-letter com alertas: tasks que falharam 3x vão para dead-letter
   + Telegram alert para admin
5. Orphan watchdog: tasks de workers mortos são redistribuídas em <15s
6. Graceful shutdown: SIGTERM → drain filas → complete tasks in progress → exit
7. Auto-restart via Docker/Coolify: se processo morre, volta em <5s
```

---

## 12. Estrutura de Diretórios

```
refrimix-hvacr-swarm/
├── cmd/
│   ├── swarm/                 # Binário principal (server + workers + controller)
│   │   └── main.go
│   ├── ingestion/             # CLI de ingestão de documentos
│   │   └── main.go
│   └── admin/                 # CLI admin (manual task inject, stats)
│       └── main.go
├── internal/
│   ├── swarm/
│   │   ├── controller.go      # Scheduler, Orphan Watchdog, Rebalancer
│   │   ├── graph.go           # ExecutionGraph, DAG resolver
│   │   ├── graph_builder.go   # BuildMessageGraph factory
│   │   ├── worker.go          # SwarmWorker (claim, execute, steal, heartbeat)
│   │   ├── task.go            # SwarmTask struct + JSON marshal
│   │   └── board.go           # SSE board endpoint
│   ├── agents/
│   │   ├── interface.go       # AgentInterface
│   │   ├── intake.go          # IntakeAgent
│   │   ├── classifier.go      # ClassifierAgent
│   │   ├── access.go          # AccessControlAgent
│   │   ├── rag.go             # RAGAgent
│   │   ├── ranking.go         # RankingAgent
│   │   ├── response.go        # ResponseAgent
│   │   ├── billing.go         # BillingAgent
│   │   └── memory.go          # MemoryAgent
│   ├── memory/
│   │   ├── redis.go           # Redis client, Lua scripts
│   │   ├── qdrant.go          # Qdrant client, hybrid search
│   │   ├── sqlite.go          # SQLite persistence
│   │   └── shared_state.go    # SharedState read/write helpers
│   ├── whatsapp/
│   │   ├── webhook.go         # Webhook handler
│   │   ├── sender.go          # Message sender (Graph API)
│   │   └── types.go           # WhatsApp payload types
│   ├── billing/
│   │   ├── stripe.go          # Checkout, webhooks
│   │   └── plans.go           # Plan definitions (BRL)
│   ├── rag/
│   │   ├── embedder.go        # Gemini Embedding 2 client
│   │   ├── retriever.go       # Qdrant hybrid search + RRF
│   │   ├── reranker.go        # Cross-encoder / Gemini judge
│   │   └── generator.go       # Gemini 2.5 Flash response gen
│   ├── circuitbreaker/
│   │   └── breaker.go         # Circuit breaker for external APIs
│   └── config/
│       └── config.go          # Environment + JSON config loader
├── lua/
│   ├── access_check.lua       # Atomic access control
│   └── claim_task.lua         # Atomic task claiming
├── configs/
│   ├── agents.json
│   ├── tasks.json
│   ├── memory_schema.json
│   ├── queue_schema.json
│   └── graph_execution.json
├── scripts/
│   ├── smoke_tests.sh
│   ├── seed_data.sh
│   └── curl_mocks/
│       ├── inbound_text.sh
│       ├── inbound_image.sh
│       ├── stripe_webhook.sh
│       └── admin_inject_task.sh
├── deployments/
│   ├── docker-compose.local.yml
│   ├── docker-compose.staging.yml
│   ├── docker-compose.prod.yml
│   └── Dockerfile
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

### Makefile

```makefile
.PHONY: dev run build test smoke seed board

dev:
	docker compose -f deployments/docker-compose.local.yml up -d redis qdrant
	go run cmd/swarm/main.go

build:
	CGO_ENABLED=1 GOOS=linux go build -o bin/swarm cmd/swarm/main.go
	CGO_ENABLED=0 GOOS=linux go build -o bin/ingestion cmd/ingestion/main.go

test:
	go test ./... -v -race -cover

smoke:
	bash scripts/smoke_tests.sh http://localhost:8080

seed:
	go run cmd/ingestion/main.go --path=data/pdfs/

board:
	@echo "SSE Board: http://localhost:8080/api/swarm/board"
	curl -N http://localhost:8080/api/swarm/board

deploy-staging:
	docker compose -f deployments/docker-compose.staging.yml up -d --build

deploy-prod:
	docker compose -f deployments/docker-compose.prod.yml up -d --build
```
