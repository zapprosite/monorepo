# Research: Embedding & Chunking Strategies for RAG

**Date:** 2026-04-23
**Topic:** Best practices for embedding models and chunking strategies in RAG systems

---

## 1. Embedding Models Comparison

### BGE-M3 vs nomic-embed-text-v1.5

| Specification | BGE-M3 | nomic-embed-text-v1.5 |
|---------------|--------|----------------------|
| **Embedding Dimension** | 1024 | 768 (native) |
| **Max Sequence Length** | 8192 tokens | 8192 tokens |
| **Architecture** | XLM-RoBERTa | nomic-bert-2048 |
| **Parameters** | ~560M (estimated) | 136.7M |
| **Languages** | 100+ multilingual | English-focused |
| **License** | MIT | Apache-2.0 |
| **Retrieval Modes** | Dense + Sparse + ColBERT | Dense only |

#### BGE-M3 Advantages
- **Multilingual support** (100+ languages) - ideal for non-English corpora
- **Multi-functionality** - supports dense, sparse (BM25-style), and ColBERT multi-vector retrieval
- **Self-knowledge distillation** training technique
- **MCLS method** for long-document performance without fine-tuning
- Top performer on MIRACL (multilingual) and MKQA (cross-lingual) benchmarks

#### nomic-embed-text-v1.5 Advantages
- **Matryoshka Representation Learning (MRL)** - adjustable dimensionality (768/512/256/128/64)
- **Significantly smaller** (136M vs ~560M parameters) - faster inference
- **Lower dimensionality** (768 vs 1024) - smaller vector storage footprint
- **Apache-2.0 license** - commercial use allowed without restrictions
- Dimension truncatable with minimal MTEB score loss:
  - 768: 62.28
  - 512: 61.96 (-0.32)
  - 256: 61.04 (-1.24)
  - 128: 59.34 (-2.94)

#### Recommendation

| Use Case | Recommended Model |
|----------|-------------------|
| **Multilingual corpus** | BGE-M3 |
| **English-only, resource-constrained** | nomic-embed-text-v1.5 |
| **Long documents (>2048 tokens)** | BGE-M3 (ColBERT mode) |
| **Cost-sensitive, smaller vectors** | nomic-embed-text-v1.5 (512 dim) |
| **Complex retrieval (late interaction)** | BGE-M3 (ColBERT) |

---

## 2. Chunking Strategies

### 2.1 Strategy Types

#### Fixed-Size Chunking
- Splits text into chunks of predetermined token/character count
- **Pros:** Consistent, predictable vector sizes, simple to implement
- **Cons:** May split semantic units (sentences, code blocks), poor context boundary alignment
- **Typical sizes:** 256, 512, 1024 tokens

#### Heading-Based (Structure-Aware) Chunking
- Splits on document structure: headings, sections, paragraphs
- **Pros:** Respects semantic boundaries, maintains context coherence
- **Cons:** Variable chunk sizes, may be too large or too small
- **Best for:** Technical documentation, manuals, structured content

#### Hierarchical Chunking
- Creates multi-level chunks (small chunks grouped into parent chunks)
- **Pros:** Supports both precise retrieval and broad context, flexible reranking
- **Cons:** More complex implementation, higher storage requirements
- **Best for:** Deep documents with nested structure

#### Semantic Chunking
- Clusters sentences/paragraphs based on embedding similarity
- **Pros:** Semantic coherence within chunks, natural boundaries
- **Cons:** Slower (requires embedding computation), less predictable
- **Best for:** Narrative content, research papers

#### Sentence-Based Chunking
- Groups consecutive sentences into chunks
- **Pros:** Fine-grained retrieval, good for precise question answering
- **Cons:** May lose broader context, many small chunks = higher query overhead
- **Best for:** Q&A systems, fact extraction

### 2.2 Optimal Chunk Size Recommendations

| Use Case | Recommended Chunk Size | Overlap |
|----------|----------------------|---------|
| **General RAG** | 512 tokens | 20% (102 tokens) |
| **Long documents** | 1024 tokens | 15% (154 tokens) |
| **Q&A / Fact extraction** | 256-512 tokens | 10-20% |
| **Code retrieval** | 128-256 tokens | 15% |
| **Legal documents** | 512-1024 tokens | 10% |

### 2.3 Key Principles

1. **Respect semantic boundaries** - avoid splitting sentences, code blocks, or entity references
2. **Maintain context window** - ensure each chunk has enough surrounding context for relevance
3. **Overlap for continuity** - 10-20% overlap helps capture cross-chunk relationships
4. **Match embedding model context** - chunks should fit within model's max sequence length with margin for query
5. **Hierarchy when needed** - use parent chunks for reranking or context augmentation

---

## 3. Embedding Dimensions & Max Sequence Considerations

### Dimensions Impact

| Dimensions | Vector Size (bytes) | Storage | MTEB Score Delta | Use Case |
|------------|---------------------|---------|------------------|----------|
| 1024 | 4KB | Highest | baseline | Maximum precision |
| 768 | 3KB | High | baseline | Balanced |
| 512 | 2KB | Moderate | -0.3 to -0.5 | Cost-optimized |
| 256 | 1KB | Low | -1.2 to -1.5 | Large-scale retrieval |
| 128 | 512B | Very low | -2.9 to -3.0 | Ultra-high scale |

### Sequence Length Considerations

1. **Chunk vs Context budget:**
   - Reserve tokens for query + response (typically 500-1000 tokens)
   - Effective chunk length = model max - query tokens - buffer

2. **Long-context models (8192 tokens):**
   - Can embed entire documents as single chunks
   - Reduces need for complex chunking strategies
   - Higher memory/compute requirements

3. **Optimal practice:**
   - Use 75-80% of max sequence length for chunk content
   - Example: For 8192 token model with 500 token query budget, use ~6000 tokens per chunk

---

## 4. Summary Recommendations

### For English-Only RAG Systems
```
Model: nomic-embed-text-v1.5
Dimensions: 512 (MTEB 61.96, 2KB vectors)
Chunk Size: 512 tokens
Overlap: 20%
Strategy: Semantic or heading-based
```

### For Multilingual RAG Systems
```
Model: BGE-M3
Dimensions: 1024
Chunk Size: 512-1024 tokens
Overlap: 15-20%
Strategy: Hierarchical with structural awareness
```

### For Resource-Constrained Environments
```
Model: nomic-embed-text-v1.5 at 256 dimensions
Dimensions: 256 (MTEB 61.04, 1KB vectors)
Chunk Size: 256 tokens
Overlap: 15%
Strategy: Fixed-size with semantic merge
```

---

## Sources

- [BAAI/bge-m3 - Hugging Face](https://huggingface.co/BAAI/bge-m3)
- [nomic-ai/nomic-embed-text-v1.5 - Hugging Face](https://huggingface.co/nomic-ai/nomic-embed-text-v1.5)
- [MTEB Leaderboard](https://huggingface.co/spaces/mteb/leaderboard)
