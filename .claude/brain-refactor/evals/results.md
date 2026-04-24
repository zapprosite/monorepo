# Brain Refactor — Retrieval Eval Results

**Date:** 2026-04-24
**Task:** T13 — Run retrieval evals and report precision/recall
**Collection:** `will` (Qdrant, 1953 points)
**Embedding Model:** Ollama `nomic-embed-text:latest` (768-dim)

---

## Exec Summary

| Metric | Value |
|--------|-------|
| **Precision@5** | 33.8% |
| **Recall@5** | 33.8% |
| **F1@5** | 33.7% |
| **Score >= 3 (PASS)** | 0 / 20 |
| **Score >= 2 (MARGINAL)** | 7 / 20 |
| **Score < 2 (FAIL)** | 13 / 20 |
| **VERDICT** | **NOT READY** (threshold >= 75%) |

---

## Root Cause Analysis

### CRITICAL: Zero-Vector Indexing

The agent files were indexed with **zero vectors** (`[0.0] * 768`) instead of real embeddings.

Evidence from `scripts/index-agents-to-qdrant.py`:
```python
ZERO_VECTOR = [0.0] * VECTOR_SIZE  # line 59

points.append({"id": point_id, "vector": ZERO_VECTOR, "payload": payload})  # line 127
```

Consequence:
- `indexed_vectors_count: 0` in Qdrant collection info
- Agent docs (1857/1953 points) are **completely unsearchable** by vector similarity
- All searches return score=0.0000 when filtering to `doc_type=agent`
- The 85 Mem0 patterns (which have real embeddings) dominate all retrieval results

### Data Distribution

| doc_type | Count | Searchable |
|----------|-------|------------|
| agent | 1857 | NO (zero vectors) |
| service | 11 | unknown |
| (Mem0 patterns) | 85 | YES (real embeddings) |

---

## Per-Question Results

| ID | Query Topic | Score | Status | Finding |
|----|-------------|-------|--------|---------|
| Q01 | CEO Router O(1) vs LLM | 1/4 | FAIL | Mem0 backup pattern — unrelated |
| Q02 | LangGraph workflows | 1/4 | FAIL | incident-response pattern — unrelated |
| Q03 | Tool Registry 50 tools | 1/4 | FAIL | LiteLLM port info — unrelated |
| Q04 | Skills inventory 13 skills | 1/4 | FAIL | ai-context-sync status — unrelated |
| Q05 | LiteLLM routing | 2/4 | MARGINAL | mentions LiteLLM embeddings (tangent) |
| Q06 | Qdrant collections | 1/4 | FAIL | incident-response — unrelated |
| Q07 | Trieve datasets | 1/4 | FAIL | backup location — unrelated |
| Q08 | Second Brain API | 2/4 | MARGINAL | mcp-memory mentions LiteLLM embeddings (tangent) |
| Q09 | Redis keys | 1/4 | FAIL | security pattern — unrelated |
| Q10 | PostgreSQL schema | 1/4 | FAIL | network pattern — unrelated |
| Q11 | Hermes Gateway auth | 1/4 | FAIL | MCP health endpoints — unrelated |
| Q12 | 3-layer memory | 2/4 | MARGINAL | mcp-memory CRUD memories (partial) |
| Q13 | Mem0 embedding fix | 2/4 | MARGINAL | mentions LLM but not the fix |
| Q14 | Qdrant metadata schema | 1/4 | FAIL | backup location — unrelated |
| Q15 | Memory Manager | 1/4 | FAIL | backup verification — unrelated |
| Q16 | Entry points | 1/4 | FAIL | LiteLLM embeddings — unrelated |
| Q17 | Telegram flow | 1/4 | FAIL | incident-response template — unrelated |
| Q18 | Cron jobs | 2/4 | MARGINAL | mentions health check cron (partial) |
| Q19 | Coolify lifecycle | 2/4 | MARGINAL | Docker containers (tangent) |
| Q20 | MCPO server 8092 | 2/4 | MARGINAL | mcp-ollama porta 4014 (tangent) |

---

## Why Mem0 Patterns Dominate

When searching the full collection (1953 points), the top results are always Mem0 patterns because:
1. They have real 768-dim embeddings from nomic-embed-text
2. They have semantic text content like `[pattern] litellm:`, `[pattern] incident-response:`
3. The 1857 agent points have zero vectors — cosine similarity with zero vectors = 0

When filtering to `doc_type=agent`, all results return score=0.0000 confirming zero-vector problem.

---

## Recommendations

### P0 — Fix Zero-Vector Re-indexing (Blocking)

The agent files MUST be re-indexed with real embeddings:

```bash
# 1. Generate real embeddings for each agent file chunk
# 2. Use nomic-embed-text via Ollama or LiteLLM
# 3. Upsert to Qdrant with real vectors
# 4. Trigger Qdrant index rebuild (indexed_vectors_count should go from 0 to 1857)
```

### P1 — Improve Mem0 Pattern Quality

Even for Mem0 patterns, the retrieved texts are generic templates. The patterns need:
- More specific text content (not just template placeholders)
- Better metadata tagging (doc_type, service_name)

### P2 — Increase Coverage

Current coverage gaps:
- No AGENTS.md content indexed (source of agent instructions)
- No llms.txt content indexed (101 skills inventory)
- No architecture-map.yaml indexed (system topology)
- Only 11 service points (should be more)

### P3 — Build ANN Index

After re-indexing, trigger Qdrant index rebuild:
```bash
curl -X POST http://localhost:6333/collections/will/index
```

---

## Next Steps

1. **Re-index agents** with real embeddings (P0)
2. **Re-test** retrieval after fix (P0)
3. **Index missing content** — AGENTS.md, llms.txt, architecture-map.yaml (P2)
4. **Target**: >= 75% precision@5 to achieve PRODUCTION READY
