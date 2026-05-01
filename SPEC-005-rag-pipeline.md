# SPEC-005: RAG Pipeline

**Status:** DRAFT
**Created:** 2026-04-10
**Author:** will
**Related:** SPEC-003, SPEC-006

---

## Objective

Implementar pipeline RAG multimodal: embedding + hybrid search + ranking.

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Embedding | Gemini Embedding 2 (768D) |
| Vector DB | Qdrant 1.13 |
| Reranker | Gemini as judge |
| LLM | Gemini 2.5 Flash |

---

## RAG Flow

```
query → classifier (rewritten_query) → rag_agent → Qdrant hybrid search
                                                    ↓
                                              ranking_agent (rerank)
                                                    ↓
                                              top-5 results → response_agent
```

---

## rag_agent

```go
type RAGAgent struct{}

func (r *RAGAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    // 1. Cache check
    // 2. Generate embedding (Gemini Embedding 2)
    // 3. Hybrid search: dense + sparse + RRF fusion
    // 4. Metadata filters (brand, model, btu, error_code)
    // 5. Return top-20 candidates
}
```

---

## ranking_agent

```go
func (r *RankingAgent) Execute(ctx context.Context, task *SwarmTask) (map[string]any, error) {
    // 1. Read candidates from state
    // 2. Re-rank using cross-encoder or Gemini
    // 3. Filter score < 0.5
    // 4. Assemble context (max 4000 tokens)
    // 5. Return top-5 + assembled_context
}
```

---

## Hybrid Search

```
Score = RRF(dense_score) + RRF(sparse_score)

RRF(k) = 1 / (k + rank)

Fusion: Reciprocal Rank Fusion
```

---

## Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | Cache hit returns immediately | mock with same query twice |
| AC-2 | Dense + sparse fusion works | Manual test Qdrant |
| AC-3 | Reranker filters low scores | Unit test with score=0.3 |
| AC-4 | Context assembled < 4000 tokens | Token count check |
