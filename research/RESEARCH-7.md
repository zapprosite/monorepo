# RESEARCH-7: Qdrant + Ollama + Trieve Integration

**Date:** 2026-04-23
**Focus:** Configuration, Embedding Server Setup, Collections, and Performance

---

## 1. Qdrant Configuration with Trieve

### Overview

Qdrant is an AI-native vector database used as Trieve's primary backend for vector storage and similarity search. It stores embedded document chunks and supports filtering, hybrid search, and semantic retrieval.

### Collection Configuration

**Basic Creation (Rust Client):**
```rust
use qdrant_client::Qdrant;
use qdrant_client::qdrant::{CreateCollectionBuilder, VectorParamsBuilder, Distance};

let client = Qdrant::from_url("http://localhost:6334").build()?;

client.create_collection(
    CreateCollectionBuilder::new("collection_name")
        .vectors_config(VectorParamsBuilder::new(768, Distance::Cosine)),
).await?;
```

**Multi-Vector Collections:**
```rust
let mut vectors_config = VectorsConfigBuilder::default();
vectors_config.add_named_vector_params("image", VectorParamsBuilder::new(4, Distance::Dot).build());
vectors_config.add_named_vector_params("text", VectorParamsBuilder::new(768, Distance::Cosine).build());

client.create_collection(
    CreateCollectionBuilder::new("collection_name").vectors_config(vectors_config),
).await?;
```

**Key Parameters:**
- `vectors_config`: Vector size and distance metric (Cosine, Dot, Euclid)
- Distance options: `Cosine` (most common for embeddings), `Dot` (for normalized vectors), `Euclid`

---

## 2. Ollama as Embedding Server

### Embedding API

Ollama exposes an embedding endpoint via `/api/embed`:

**Endpoint:** `POST /api/embed`

**Request:**
```json
{
  "model": "all-minilm",
  "input": "Why is the sky blue?"
}
```

**Response:**
```json
{
  "model": "all-minilm",
  "embeddings": [[0.010071029, -0.0017594862, ...]],
  "total_duration": 14143917,
  "load_duration": 1019500,
  "prompt_eval_count": 8
}
```

**Batch Processing:**
```json
{
  "model": "all-minilm",
  "input": ["Why is the sky blue?", "Why is the grass green?"]
}
```

**Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| `model` | string | Embedding model name (e.g., "all-minilm") |
| `input` | string or array | Text(s) to embed |
| `truncate` | boolean | Truncate to fit context length (default: true) |
| `options` | object | Additional model parameters |
| `keep_alive` | duration | Model memory retention (default: 5m) |
| `dimensions` | integer | Number of output dimensions |

**Deprecated:** `POST /api/embeddings` (use `/api/embed` instead)

### Common Embedding Models

- `all-minilm` - Small, fast model (384 dimensions)
- `nomic-embed-text` - High-quality text embeddings
- Custom GGUF models via Hugging Face integration

---

## 3. Collections and Indexes

### Segment Structure

Qdrant divides data into **segments** with independent vector/payload storage and indexes:
- **Appendable segments** - Full operations support
- **Non-appendable segments** - Read/delete only, optimized

### Payload Index Types

| Field Type | Use Case | Filter Operators |
|------------|----------|------------------|
| `keyword` | Text matching | Match |
| `integer` | Numeric filtering | Match, Range |
| `float` | Numeric range | Range |
| `bool` | Boolean matching | Match |
| `geo` | Geographic queries | Geo Bounding Box, Radius |
| `datetime` | Time filtering | Range |
| `text` | Full-text search | Match, Contains |
| `uuid` | UUID matching | Match |

### Full-Text Index Tokenizers

- `word` (default)
- `whitespace`
- `prefix`
- `multilingual`

Features: ASCII folding (v1.16.0+), Snowball stemmers, custom stopwords.

### Vector Index: HNSW

Qdrant uses **HNSW (Hierarchical Navigable Small World Graph)**:

| Parameter | Default | Description |
|-----------|---------|-------------|
| `m` | 16 | Edges per node |
| `ef_construct` | 100 | Neighbors during construction |
| `full_scan_threshold` | 10000 | Point where full-scan beats HNSW |

**Filterable HNSW (v1.16.0+):** ACORN algorithm explores second-hop neighbors for improved filtered search accuracy.

**Sparse Vector Index (v1.7.0+):** Exact inverted-index for zero-heavy vectors. IDF modifier weights rare terms higher.

---

## 4. Performance Considerations

### Quantization Methods

| Method | Compression | Accuracy | Speed | Best For |
|--------|-------------|----------|-------|----------|
| **Scalar (uint8)** | 4x | 0.99 | up to 2x | General use |
| **Binary (1-bit)** | 32x | 0.95* | up to 40x | High-dim (1536+) |
| **Binary (1.5-bit)** | 24x | 0.95** | up to 30x | Medium (1024-1536) |
| **Binary (2-bit)** | 16x | 0.95*** | up to 20x | Low (768-1024) |
| **Product Quantization** | up to 64x | 0.7 | 0.5x | Very large datasets |

*For high-dimensional vectors (1536+)

### Storage Modes

1. **All in RAM** - Fastest, highest memory usage
2. **Hybrid** - Original on disk, quantized in RAM (balanced)
3. **All on Disk** - Minimal memory, best with SSDs

### Storage Configuration

**Memmap Storage:**
```yaml
on_disk: true  # In collection creation
memmap_threshold: 10000  # Global or per-collection
```

**HNSW on Disk (v1.12.0+):**
```yaml
hnsw_config:
  on_disk: true
```

### Low-Latency Search Optimization

**Horizontal Scaling:**
- Replicate across multiple shards
- Higher replication = lower read latency, higher write latency

**Delayed Fan-Out (v1.17.0+):**
```yaml
read_fan_out_delay_ms: <95th_percentile_latency>
```
Fallback to alternate replicas after threshold.

**Indexed-Only Queries:**
```yaml
indexed_only: true  # Consistent latency, recent writes delayed
prevent_unoptimized: true  # Experimental: avoids "blinking points"
```

### Data Flow for Writes

```
WAL → Update Queue (1M max) → Unoptimized Segments → Indexed HNSW Graph
```

Under heavy write load, data is searchable but unindexed, causing latency spikes until indexing completes.

### Memory Optimization Guidance

| Scenario | memmap_threshold | indexing_threshold |
|----------|------------------|-------------------|
| Balanced | Match indexing | 10000 (default) |
| High write / Low RAM | Lower (e.g., 5000) | 10000 |

---

## 5. Trieve Integration Notes

Trieve documentation was largely inaccessible during this research session due to connection issues. However, based on Qdrant and Ollama integration patterns:

### Expected Trieve Configuration

- **Embedding Model:** Configurable to use Ollama via `/api/embed`
- **Vector DB:** Qdrant as primary backend (default)
- **Chunking:** Document splitting with overlap parameters
- **Search:** Hybrid search (vector + keyword), re-ranking support

### Recommended Setup

1. **Ollama Server:** Run embedding model (e.g., `ollama run all-minilm`)
2. **Qdrant:** Deploy with quantization enabled for production
3. **Trieve:** Configure `EMBEDDING_MODEL` to point to Ollama endpoint

---

## Sources

- [Qdrant Documentation - Collections](https://qdrant.tech/documentation/manage-data/collections/)
- [Qdrant Documentation - Indexing](https://qdrant.tech/documentation/manage-data/indexing/)
- [Qdrant Documentation - Quantization](https://qdrant.tech/documentation/manage-data/quantization/)
- [Qdrant Documentation - Storage](https://qdrant.tech/documentation/manage-data/storage/)
- [Qdrant Documentation - Low-Latency Search](https://qdrant.tech/documentation/search/low-latency-search/)
- [Ollama GitHub - Embedding API](https://github.com/ollama/ollama/blob/main/docs/api.md)
- [Hugging Face - Ollama Integration](https://huggingface.co/docs/hub/ollama)
