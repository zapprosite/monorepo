# SPEC-008: All Agents

**Status:** DRAFT
**Created:** 2026-04-10
**Author:** will
**Related:** SPEC-001, SPEC-002, SPEC-005

---

## Objective

Implementar todos os 8 agentes do swarm.

---

## Agent Pool

| Agent | Workers | LLM | Timeout |
|-------|---------|-----|---------|
| intake_agent | 2 | — | 10s |
| classifier_agent | 2 | MiniMax M2.7 | 8s |
| access_control_agent | 1 | — | 3s |
| rag_agent | 3 | MiniMax Embedding | 30s |
| ranking_agent | 2 | MiniMax M2.7 | 15s |
| response_agent | 2 | MiniMax M2.7 | 20s |
| billing_agent | 1 | — | 10s |
| memory_agent | 1 | — | 5s |

---

## Agent Interface

```go
type AgentInterface interface {
    Execute(ctx context.Context, task *SwarmTask) (map[string]any, error)
}

type SwarmTask struct {
    ID        string
    GraphID   string
    NodeID    string
    AgentType string
    Input     map[string]any
    Output    map[string]any
    Status    TaskStatus
    Retries   int
    MaxRetries int
    TimeoutMs int
}
```

---

## intake_agent

```go
type IntakeAgent struct{}

func (i *IntakeAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    // 1. Parse WhatsApp webhook payload
    // 2. Validate X-Hub-Signature-256
    // 3. Extract text, media, metadata
    // 4. Normalize UTF-8
    // 5. Download media via Graph API if needed
    // 6. Write to shared state
    return map[string]any{
        "request_id": uuid.New().String(),
        "phone": phone,
        "message_type": messageType,
        "normalized_text": text,
    }, nil
}
```

---

## classifier_agent

```go
type ClassifierAgent struct{}

func (c *ClassifierAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    // 1. Read normalized_text from state
    // 2. Read conversation history
    // 3. LLM: classify intent (technical|commercial|billing|greeting|image_search)
    // 4. Extract entities (brand, model, btu, error_code, part, refrigerant)
    // 5. Rewrite query for retrieval
    // 6. Write to shared state
}
```

---

## access_control_agent

```go
type AccessControlAgent struct{}

func (a *AccessControlAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    // 1. Lua script: atomic check + decrement user:{phone}:requests_remaining
    // 2. Decision: allow | block | redirect
    // 3. Write to shared state
}
```

---

## rag_agent

```go
type RAGAgent struct{}

func (r *RAGAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    // 1. Read rewritten_query, entities from state
    // 2. Check cache
    // 3. Generate embedding (MiniMax)
    // 4. Hybrid search Qdrant
    // 5. Return top-20 candidates
}
```

---

## ranking_agent

```go
type RankingAgent struct{}

func (r *RankingAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    // 1. Read candidates from state
    // 2. Re-rank with cross-encoder or MiniMax
    // 3. Filter score < 0.5
    // 4. Assemble context (max 4000 tokens)
}
```

---

## response_agent

```go
type ResponseAgent struct{}

func (r *ResponseAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    // 1. Read assembled_context from state
    // 2. LLM: generate response (MiniMax M2.7)
    // 3. Anti-hallucination check
    // 4. Format for WhatsApp (4096 char limit)
    // 5. Send via WhatsApp Cloud API
    // 6. Write to shared state
}
```

---

## billing_agent

```go
type BillingAgent struct{}

func (b *BillingAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    // 1. Read event_type
    // 2. Handle: request_used | upgrade_requested | payment_received | subscription_deleted
    // 3. Update Redis user state
    // 4. Send confirmation via WhatsApp if needed
}
```

---

## memory_agent

```go
type MemoryAgent struct{}

func (m *MemoryAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    // 1. Persist conversation (LPUSH + LTRIM 0 19)
    // 2. Extract facts (LLM)
    // 3. Audit log
    // 4. Update metrics
}
```

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | All 8 agents implement AgentInterface | Unit tests |
| AC-2 | Each agent writes to shared state | Integration test |
| AC-3 | Fallback behavior documented | Error simulation |
| AC-4 | Metrics tracked per agent | Redis stats check |
