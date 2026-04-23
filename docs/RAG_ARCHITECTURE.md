# RAG Architecture — Homelab Knowledge Layer

## Overview

RAG (Retrieval-Augmented Generation) provides factual knowledge retrieval for AI agents via Trieve, with Mem0 handling conversational memory and session state.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Query                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Ollama (:11434)                                │
│  ┌─────────────────┐         ┌─────────────────┐               │
│  │ nomic-embed-text│         │   LLM (llama4)   │               │
│  │   (768 dim)     │         │                 │               │
│  └────────┬────────┘         └────────┬────────┘               │
└───────────┼────────────────────────────┼────────────────────────┘
            │                            │
            │ embed query                 │ LLM prompt + chunks
            ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Trieve (:6435)                               │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  RAG Datasets (managed internally)                        │  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐  │  │
│  │  │ hermes-      │ │ monorepo-    │ │ governance-      │  │  │
│  │  │ knowledge    │ │ docs         │ │ knowledge         │  │  │
│  │  └─────────────┘ └──────────────┘ └──────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │                                   │
│                              ▼                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Qdrant (:6333) — Vector DB (Trieve internal)           │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            │
            │ (Mem0: conversation memory)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Mem0 — Session Memory                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Working Memory Collection (Qdrant agency_*)            │  │
│  │  - sessionId, role, content, timestamp                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### Trieve (:6435)

RAG API that manages Qdrant internally. Handles dataset management, chunk indexing, and hybrid search.

- **Base URL:** `http://localhost:6435`
- **API Version:** v1
- **Auth:** `Authorization: ApiKey <TRIEVE_API_KEY>`

### Qdrant (:6333)

Vector database managed internally by Trieve. Collections are created automatically.

- **Base URL:** `http://localhost:6333`
- **Note:** Direct Qdrant access is for agency collections (Hermes Suite), not Trieve datasets

### Ollama (:11434)

Local LLM and embedding provider.

- **Embedding Model:** `nomic-embed-text` (768 dimensions)
- **LLM Model:** `llama4` (default for inference)
- **Base URL:** `http://localhost:11434`

### Mem0

Memory layer on top of Qdrant for conversational context and session state.

- **Collection:** `agency_WORKING_MEMORY` (1024 dimensions via bge-m3)
- **Purpose:** Conversation context, working memory, session state

## Dataset Naming Convention

Datasets follow the pattern: `{app}[-{lead}][-{type}]`

| Component | Description | Example |
|-----------|-------------|---------|
| `app` | Application identifier | `hermes`, `hvacr`, `monorepo` |
| `lead` | Optional project/lead dimension | `will`, `client-alfa` |
| `type` | Content type | `knowledge`, `memory`, `context` |

### Pre-configured Datasets

| Dataset | App | Chunking | Description |
|---------|-----|----------|-------------|
| `hermes-knowledge` | hermes | heading | Hermes Agent skills, prompts, TREE.md |
| `hermes-memory` | hermes | sentence | Hermes session working memory |
| `monorepo-docs` | monorepo | heading | SPECs, AGENTS.md, documentation |
| `hvacr-knowledge` | hvacr | heading | HVAC-R swarm documentation |
| `governance-knowledge` | governance | heading | PORTS.md, SUBDOMAINS.md, NETWORK_MAP.md |
| `pgadmin-schema` | pgadmin | sentence | PostgreSQL schemas, queries, best practices |
| `qdrant-docs` | qdrant | heading | Qdrant collections, indexing, search |

## Knowledge Sources

| Source | Path | Content |
|--------|------|---------|
| hermes-second-brain | `/srv/monorepo/hermes-second-brain/` | Agent knowledge, TREE.md |
| monorepo/docs | `/srv/monorepo/docs/` | SPECs, AGENTS.md |
| governance | `/srv/ops/ai-governance/` | PORTS.md, SUBDOMAINS.md, NETWORK_MAP.md |

## RAG Retrieval Flow

```
User Query
    │
    ▼
┌──────────────────┐
│ Embed via Ollama │
│ nomic-embed-text │
└────────┬─────────┘
         │ 768-dim vector
         ▼
┌──────────────────┐
│ Search Trieve    │
│ Hybrid: semantic │
│ + fulltext       │
│ top-k chunks     │
└────────┬─────────┘
         │ chunks + scores
         ▼
┌──────────────────┐
│ Inject into LLM  │
│ prompt context   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ LLM Response     │
│ (Hermes Agent)   │
└──────────────────┘
```

## Trieve API Endpoints

### Create Dataset
```http
POST /api/v1/datasets
Content-Type: application/json
Authorization: ApiKey <key>

{
  "name": "hermes-lead-will-knowledge",
  "description": "Hermes knowledge for lead will"
}
```

### Index Chunks (Bulk)
```http
POST /api/v1/chunks
Content-Type: application/json
TR-Dataset: <dataset_id>
Authorization: ApiKey <key>

{
  "chunks": [
    {
      "chunk_html": "<h1>Title</h1><p>Content...</p>",
      "metadata": { "source": "file.md", "heading": "Title" },
      "tag_set": "documentation"
    }
  ]
}
```

**Bulk Limit:** 120 chunks per request

### Search Chunks
```http
POST /api/v1/chunk/search
Content-Type: application/json
TR-Dataset: <dataset_id>
Authorization: ApiKey <key>

{
  "query": "How do I configure HVacr?",
  "limit": 5,
  "search_type": "hybrid",
  "highlight_results": true
}
```

### List Datasets
```http
GET /api/v1/datasets
Authorization: ApiKey <key>
```

## Mem0 vs Trieve

| Aspect | Mem0 | Trieve |
|--------|------|--------|
| **Purpose** | Conversation context, working memory | Factual knowledge, documentation |
| **Storage** | Qdrant agency_* collections | Trieve-managed Qdrant collections |
| **Content** | Session messages, user/assistant turns | Docs, specs, reference material |
| **Retrieval** | Recent entries by sessionId | Hybrid search by query similarity |
| **Dimensions** | 1024 (bge-m3) | 768 (nomic-embed-text) |
| **TTL** | Session-scoped | Persistent, indexed |

**When to use Mem0:**
- Conversation history and context
- Working memory during agent session
- Session state persistence

**When to use Trieve:**
- Factual knowledge retrieval
- Documentation search
- Reference material injection

## Embedding Strategy

| Parameter | Value |
|-----------|-------|
| Model | `nomic-embed-text` |
| Provider | Ollama (:11434) |
| Dimensions | 768 |
| Endpoint | `POST /api/embed` |

## Chunking Strategies

| Strategy | Use Case | Method |
|----------|----------|--------|
| `heading` | Documentation | Split by markdown headings (# ## ###) |
| `sentence` | Memory, short content | Split by sentence-ending punctuation |
| `page` | Long documents | Fixed word count (500 words) |

## Ingestion Pipeline

Script: `scripts/rag-ingest.ts`

```bash
# Ingest hermes knowledge
npx tsx scripts/rag-ingest.ts --app hermes --type knowledge --chunking heading

# Ingest with lead dimension
npx tsx scripts/rag-ingest.ts --app hermes --lead will --type knowledge

# Dry run (show files without indexing)
npx tsx scripts/rag-ingest.ts --app monorepo --dry-run
```

### Pipeline Steps

1. **Scan** — Walk knowledge source directories
2. **Chunk** — Split content by strategy (heading/sentence/page)
3. **Embed** — Generate vectors via Ollama nomic-embed-text
4. **Index** — Bulk upload to Trieve (120 chunks/request)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TRIEVE_URL` | `http://localhost:6435` | Trieve API URL |
| `TRIEVE_API_KEY` | — | Trieve API key |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama URL |
| `TRIEVE_DEFAULT_DATASET_ID` | — | Default dataset for retrieval |

## Related Documentation

- [Hermes Agency RAG Instance Organizer](../apps/hermes-agency/src/skills/rag-instance-organizer.ts)
- [Mem0 Client](../apps/hermes-agency/src/mem0/client.ts)
- [Qdrant Client](../apps/hermes-agency/src/qdrant/client.ts)
- [AI Governance](../GOVERNANCE/)
