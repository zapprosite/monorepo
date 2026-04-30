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

## Deployment

### Trieve

```bash
docker compose -f docker-compose.trieve.yml up -d
```

Verificar status:
```bash
docker ps | grep trieve
curl -s http://localhost:6435/api/v1/health | jq .
```

### Reiniciar (sem perder dados)

```bash
docker compose -f docker-compose.trieve.yml restart
```

### Parar

```bash
docker compose -f docker-compose.trieve.yml down
```

## Environment Variables

| Variavel | Default | Descricao |
|----------|---------|-----------|
| `TRIEVE_URL` | `http://localhost:6435` | URL da API Trieve |
| `TRIEVE_API_KEY` | — | Chave API do Trieve |
| `DATABASE_URL` | — | PostgreSQL (necessario para Trieve com banco externo) |
| `QDRANT_URL` | `http://localhost:6333` | URL do Qdrant (quando externo ao Trieve) |
| `OLLAMA_URL` | `http://localhost:11434` | URL do Ollama |
| `TRIEVE_DEFAULT_DATASET_ID` | — | Dataset padrao para recuperacao |

## Backup

### O que fazer backup

- **PostgreSQL (Trieve metadata):** Dados de datasets, chunks, configuracoes
  ```bash
  docker exec monorepo-postgres-1 pg_dump -U postgres trieve > backup_trieve_$(date +%Y%m%d).sql
  ```
- **Collections Qdrant:** Collections de agency (Mem0 working memory)
  - `agency_WORKING_MEMORY`
  - Colecoes customizadas via Trieve

### Restore

```bash
# PostgreSQL
docker exec -i monorepo-postgres-1 psql -U postgres trieve < backup_trieve_YYYYMMDD.sql

# Qdrant collections — usar snapshot via API Qdrant
curl -X POST http://localhost:6333/collections/<name>/points/snapshot
```

## Scaling

### Embedded vs External Qdrant

| Modo | Uso | Config |
|------|-----|--------|
| **Embedded** (default) | Dev/small scale | Qdrant rodando junto com Trieve via Docker Compose |
| **External** | Production/alta escala | `QDRANT_URL` apontando para cluster dedicado |

Para usar Qdrant externo, setar `QDRANT_URL` no ambiente do Trieve.

### Postgres Connection Pool

Trieve usa pool de conexoes PostgreSQL internamente. Para grandes volumes:

```yaml
# docker-compose.trieve.yml — adicionar ao servico trieve
environment:
  - DATABASE_POOL_SIZE=20
  - DATABASE_MAX_OVERFLOW=10
```

## Troubleshooting

### Trieve nao inicia

```bash
# Ver logs
docker compose -f docker-compose.trieve.yml logs trieve

# Verificar porta
ss -tlnp | grep 6435

# Reiniciar
docker compose -f docker-compose.trieve.yml down && docker compose -f docker-compose.trieve.yml up -d
```

### Erro "Connection refused" ao buscar chunks

1. Verificar se Trieve esta rodando: `curl http://localhost:6435/api/v1/health`
2. Verificar `TRIEVE_API_KEY` esta configurado corretamente
3. Checar se dataset existe: `GET /api/v1/datasets`

###Embedding falhando

```bash
# Verificar Ollama
curl http://localhost:11434/api/tags

# Testar embedding manualmente
curl -X POST http://localhost:11434/api/embed \
  -H "Content-Type: application/json" \
  -d '{"model":"nomic-embed-text","input":"test"}'
```

### Qdrant cheio / quota exceeded

- Verificar espaco em disco: `df -h`
- Limpar colecoes antigas: `DELETE /collections/<name>/points` (via API Qdrant)
- Trieve reseta collections automaticamente ao re-ingerir

### Postgres connection timeout

```bash
# Aumentar timeout no compose
environment:
  - DATABASE_CONNECT_TIMEOUT=30
```

## Related Documentation

- [AI Governance](../GOVERNANCE/)
