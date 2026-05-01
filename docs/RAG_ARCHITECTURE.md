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


---

## QDRANT SCHEMA

  "chat_id": "number",
  "created_at": "timestamp (ISO 8601)",
  "metadata": {
    "lead_source": "string",
    "industry": "string",
    "contacts": [
      {
        "name": "string",
        "role": "string",
        "email": "string"
      }
    ]
  }
}
```

**Payload Indexes:** `id`, `plan`, `chat_id`, `created_at`

---

## 2. `agency_campaigns` — Marketing Campaigns

Marketing campaign definitions with budget and performance metrics.

```json
{
  "id": "uuid (primary key)",
  "client_id": "uuid (FK → agency_clients)",
  "name": "string",
  "status": "draft | active | paused | completed",
  "created_at": "timestamp (ISO 8601)",
  "budget": "number (decimal)",
  "platforms": ["instagram", "facebook", "tiktok", "twitter", "linkedin", "youtube"],
  "metrics": {
    "impressions": "number (integer)",
    "clicks": "number (integer)",
    "conversions": "number (integer)",
    "spend": "number (decimal)"
  }
}
```

**Payload Indexes:** `id`, `client_id`, `status`, `created_at`

---

## 3. `agency_brand_guides` — Brand Guidelines

Brand guidelines per client including tone of voice, colors, and prohibited terms.

```json
{
  "id": "uuid (primary key)",
  "client_id": "uuid (FK → agency_clients)",
  "version": "string (semver, e.g. '2.1.0')",
  "tone_of_voice": "string",
  "colors": {
    "primary": "hex (e.g. '#FF5733')",
    "secondary": "hex",
    "accent": "hex (optional)"
  },
  "prohibited_terms": ["string"],
  "competitors": ["string"],
  "guidelines_text": "string (full brand guidelines content)",
  "created_at": "timestamp (ISO 8601)",
  "updated_at": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `client_id`, `version`

---

## 4. `agency_conversations` — Conversation History

Full conversation history per chat session.

```json
{
  "id": "uuid (primary key)",
  "chat_id": "number",
  "client_id": "uuid (FK → agency_clients)",
  "messages": [
    {
      "role": "user | assistant | system",
      "content": "string",
      "timestamp": "timestamp (ISO 8601)"
    }
  ],
  "session_id": "string",
  "created_at": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `chat_id`, `client_id`, `session_id`, `created_at`

---

## 5. `agency_working_memory` — Agent Working Memory

Agent working memory per session for context preservation.

```json
{
  "id": "string (session_id — primary key)",
  "user_id": "string",
  "recent_entries": [
    {
      "role": "string",
      "content": "string",
      "timestamp": "number (unix ms)"
    }
  ],
  "context": {
    "current_skill": "string",
    "current_task": "string",
    "metadata": "object (optional)"
  },
  "last_updated": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `user_id`, `last_updated`

---

## 6. `agency_assets` — Creative Assets

Metadata for creative assets (images, videos, documents).

```json
{
  "id": "uuid (primary key)",
  "client_id": "uuid (FK → agency_clients)",
  "campaign_id": "uuid (optional, FK → agency_campaigns)",
  "name": "string",
  "type": "image | video | document | audio",
  "url": "string (storage URL)",
  "tags": ["string"],
  "mime_type": "string",
  "size_bytes": "number (integer)",
  "created_at": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `client_id`, `campaign_id`, `type`, `tags`

---

## 7. `agency_tasks` — Tasks & Deliverables

Agency tasks and deliverables tracking.

```json
{
  "id": "uuid (primary key)",
  "client_id": "uuid (FK → agency_clients)",
  "campaign_id": "uuid (optional, FK → agency_campaigns)",
  "title": "string",
  "description": "string",
  "assignee": "string",
  "status": "pending | in_progress | review | completed | cancelled",
  "priority": "low | medium | high | urgent",
  "due_date": "timestamp (ISO 8601, optional)",
  "created_at": "timestamp (ISO 8601)",
  "updated_at": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `client_id`, `campaign_id`, `status`, `assignee`, `priority`

---

## 8. `agency_video_metadata` — Video Transcription

Video metadata with transcription and key moments.

```json
{
  "id": "uuid (primary key)",
  "client_id": "uuid (FK → agency_clients)",
  "campaign_id": "uuid (optional, FK → agency_campaigns)",
  "asset_id": "uuid (optional, FK → agency_assets)",
  "title": "string",
  "duration_seconds": "number (integer)",
  "transcription": "string (full text)",
  "key_moments": [
    {
      "timestamp": "number (seconds)",
      "label": "string",
      "description": "string"
    }
  ],
  "created_at": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `client_id`, `campaign_id`, `asset_id`

---

## 9. `agency_knowledge` — Agency Knowledge Base

Internal agency knowledge base documents.

```json
{
  "id": "uuid (primary key)",
  "type": "string (document | procedure | onboarding | policy)",
  "title": "string",
  "content": "string",
  "tags": ["string"],
  "created_at": "timestamp (ISO 8601)",
  "updated_at": "timestamp (ISO 8601)"
}
```

**Payload Indexes:** `id`, `type`, `tags`, `created_at`

---

## Collection Configuration Summary

| Collection | Vector Size | Distance | HNSW m | HNSW ef_construct | Payload Indexes |
|------------|-------------|----------|--------|-------------------|-----------------|
| agency_clients | 768 | Cosine | 16 | 200 | id, plan, chat_id, created_at |
| agency_campaigns | 768 | Cosine | 16 | 200 | id, client_id, status, created_at |
| agency_brand_guides | 768 | Cosine | 16 | 200 | id, client_id, version |
| agency_conversations | 768 | Cosine | 16 | 200 | id, chat_id, client_id, session_id, created_at |
| agency_working_memory | 768 | Cosine | 16 | 200 | id, user_id, last_updated |
| agency_assets | 768 | Cosine | 16 | 200 | id, client_id, campaign_id, type, tags |
| agency_tasks | 768 | Cosine | 16 | 200 | id, client_id, campaign_id, status, assignee, priority |
| agency_video_metadata | 768 | Cosine | 16 | 200 | id, client_id, campaign_id, asset_id |
| agency_knowledge | 768 | Cosine | 16 | 200 | id, type, tags, created_at |

---

## Mem0 Integration

Mem0 uses a separate collection for vector memory:

- **Collection:** `will`
- **Embedding Model:** `nomic-embed-text` via Ollama
- **Vector Size:** 768
- **Distance:** Cosine
- **TTL Policy:**
  - Conversations: 7 days
  - Important memories: 30 days

---

## Initialization

Run the initialization via Qdrant dashboard or API:
```bash
# Create collections via Qdrant dashboard at http://localhost:6334
# Or use the Qdrant Python client
```

Use `--reset true` to delete and recreate all collections (WARNING: destroys all data).


---

## SECOND BRAIN


Cada sistema é **independente** — não existe routing centralizado ou `agency_router` partilhado.

### Repositórios Conhecidos

| Projeto | TREE.md | Descrição |
|---------|---------|------------|
| `hermes-second-brain` | `TREE.md` | Vault principal |
| `monorepo` | `monorepo-TREE.md` | Estrutura do monorepo |
| `crm-reflex` | `crm-TREE.md` | CRM (se existir) |

---

## Ordem de Carregamento de Contexto (Obrigatória)

**Antes de qualquer tarefa** leia nesta ordem:

```bash
# 1. Monorepo AGENTS.md (source of truth para processos)
cat /srv/monorepo/AGENTS.md | tail -200

# 2. Second Brain TREE (mapeia estrutura de conhecimento)
cat ~/.hermes/sb-context.md 2>/dev/null || bash ~/.hermes/scripts/sb-boot.sh

# 3. OPS Governance (regras operacionais)
cat /srv/ops/ai-governance/README.md 2>/dev/null
cat /srv/ops/ai-governance/CONTRACT.md 2>/dev/null

# 4. Sistema atual (se mudança de infra)
cat ~/Desktop/SYSTEM_ARCHITECTURE.md 2>/dev/null
```

---

## Comandos para Sync/Clone

### Clone Manual do Second Brain

```bash
# Clone via SSH (recomendado — sem passwords em URLs)
git clone ssh://git@127.0.0.1:2222/will-zappro/hermes-second-brain.git /tmp/hermes-second-brain

# Clone via HTTPS com token (via .env)
source /srv/monorepo/.env
git clone https://will-zappro:${GITEA_TOKEN}@127.0.0.1:2222/will-zappro/hermes-second-brain.git /tmp/hermes-second-brain
```

### Atualizar Second Brain Local

```bash
# Pull das últimas alterações
cd /tmp/hermes-second-brain && git pull origin main

# Verificar estrutura
ls -la /tmp/hermes-second-brain/
```

### Gerar e Sincronizar TREE.md do Monorepo

```bash
# Sincroniza TREE.md do monorepo → second-brain (via Gitea Actions)
bash /srv/monorepo/scripts/sync-second-brain.sh

# O script:
# 1. Clona/actualiza hermes-second-brain
# 2. Gera monorepo-TREE.md com a estrutura actual
# 3. Commita e faz push para main
```

### Boot do Second Brain (sb-boot.sh)

```bash
# Executar boot loader — fetch TREE.mds → ~/.hermes/sb-context.md
bash ~/.hermes/scripts/sb-boot.sh

# Com project específico
bash ~/.hermes/scripts/sb-boot.sh monorepo

# Output: ~/.hermes/sb-context.md (lido por todos os agentes)
```

---

## Estrutura do Second Brain

```
hermes-second-brain/
├── monorepo-TREE.md    # Estrutura completa do monorepo (15MB+, gerado por sync-second-brain.sh)
├── TREE.md             # TREE do vault (não do monorepo)
├── athlos/             # Projeto Athlos
│   ├── agents/
│   ├── rotinas/
│   └── skills/
├── refrimix/           # Projeto Refrimix
│   ├── Captacao/
│   ├── Context/
│   ├── Obras/
│   ├── Pos-Venda/
│   └── Skills/
└── will/               # Projeto Will (contexto pessoal)
    ├── Context/
    ├── Routines/
    └── Skills/
```

---

## Quando Carregar Qual Secção

| Cenário | Secção a Carregar |
|---------|-------------------|
| **Tarefa de código** | `AGENTS.md` → `monorepo-TREE.md` (procurar dirs `apps/`, `packages/`) |
| **Decisão arquitectural** | `AGENTS.md` → `docs/ARCHITECTURE-OVERVIEW.md` |
| **Mudança de infra** | `AGENTS.md` → `OPS Governance` → `SYSTEM_ARCHITECTURE.md` |
| **Operação de rede/porta** | `AGENTS.md` → `PORTS.md` → `SUBDOMAINS.md` |
| **Bug triage** | `AGENTS.md` → `monorepo-TREE.md` → `smoke-tests/` |
| **Revisão de código** | `AGENTS.md` → `docs/GUIDES/CODE-REVIEW-GUIDE.md` |

---

## Integração com Gitea CLI

```bash
# Obter TREE.md específico via API
GITEA_TOKEN=$(grep -i '^GITEA_TOKEN=' /srv/monorepo/.env | cut -d= -f2-)
curl -s -X GET "http://127.0.0.1:3300/api/v1/repos/will-zappro/hermes-second-brain/contents/monorepo-TREE.md" \
  -H "Authorization: Bearer $GITEA_TOKEN"

# Listar todos os ficheiros no second-brain
curl -s -X GET "http://127.0.0.1:3300/api/v1/repos/will-zappro/hermes-second-brain/contents/" \
  -H "Authorization: Bearer $GITEA_TOKEN"
```

---

## Fluxo Completo de Inicialização

```
1. sb-boot.sh → fetch TREE.mds → ~/.hermes/sb-context.md
2. Agente lê ~/.hermes/sb-context.md → contexto completo
3. Agente lê /srv/monorepo/AGENTS.md → processos e regras
4. Agente executa tarefa
5. (Opcional) sync-second-brain.sh → actualiza monorepo-TREE.md
```

---

## Ficheiros Relacionados

| Ficheiro | Propósito |
|----------|-----------|
| `~/.hermes/sb-context.md` | Digest completo dos TREE.md (gerado por sb-boot.sh) |
| `~/.hermes/scripts/sb-boot.sh` | Boot loader — fetch TREE.mds via Gitea API |
| `/srv/monorepo/scripts/sync-second-brain.sh` | Sincroniza monorepo-TREE.md → second-brain |
| `/srv/monorepo/AGENTS.md` | Source of truth para processos do monorepo |

---

## Notas

- O `monorepo-TREE.md` é **muito grande** (15MB+) — contém a estrutura completa
- Para tarefas específicas, procure directamente no `sb-context.md` em vez de ler tudo
- O sync para o second-brain é automático via Gitea Actions após merge em main
- O token GitHub (valor redigido; usar `GITEA_TOKEN` da `.env`) é apenas para clone HTTPS manual


---

## LANGGRAPH ARCHITECTURE

| WF-4 Social Calendar | `social_calendar.ts` | stub — sequential async |
| WF-5 Lead Qualification | `lead_qualification.ts` | stub — sequential async |

### Goal

Migrate all stub workflows to proper LangGraph StateGraphs with:
- `MemorySaver` checkpointing for durable execution
- `interruptBefore` for human-in-the-loop approval points
- Shared state schema with `clientId` and `sessionId`
- Tool calls via `TOOL_REGISTRY`
- Circuit breaker checked per tool call

---

## Shared Infrastructure

### Base State Schema

Every workflow state extends a common base:

```typescript
interface BaseState {
  clientId: string;
  sessionId: string;
  currentStep: string;
  error?: string;
}
```

### Checkpointer

All graphs use `MemorySaver` for in-memory checkpointing:

```typescript
import { MemorySaver } from '@langchain/langgraph';

const checkpointer = new MemorySaver();
```

### Tool Execution Pattern

Each node calls `TOOL_REGISTRY` tools via `executeTool()`:

```typescript
import { TOOL_REGISTRY, executeTool } from '../skills/tool_registry.js';

async function someNode(state: MyState): Promise<Partial<MyState>> {
  const result = await executeTool('some_tool', { arg1: state.value1 });
  if (!result.ok) {
    return { error: result.error, currentStep: 'ERROR' };
  }
  return { output: result.data };
}
```

### Circuit Breaker Integration

Before each tool call, check if the circuit breaker permits execution:

```typescript
import { isCallPermitted } from '../skills/circuit_breaker.js';

async function someNode(state: MyState): Promise<Partial<MyState>> {
  if (!isCallPermitted('skill_id')) {
    return { error: 'Circuit breaker open for skill_id', currentStep: 'CIRCUIT_BREAKER' };
  }
  // ... proceed with tool call
}
```

---

## WF-1: Content Pipeline

**File:** `src/langgraph/content_pipeline.ts`
**Status:** REAL StateGraph

### State Schema

```typescript
interface ContentPipelineState extends BaseState {
  brief: string;
  campaignId: string;
  creativeOutput?: string;
  videoOutput?: string;
  designOutput?: string;
  brandScore?: number;
  finalOutput?: string;
  blocked: boolean;
  blockReason?: string;
  humanApproved?: boolean;
  humanComment?: string;
}
```

### Node Definitions

| Node | Tool Called | Description |
|---|---|---|
| `CREATIVE` | `brainstorm_angles`, `generate_script` | Generate marketing script and creative angles |
| `VIDEO` | `generate_script` (supplemental) | Video processing suggestions and timestamps |
| `DESIGN` | `create_mood_board` | Visual suggestions, color palette, layout |
| `BRAND_GUARDIAN` | Internal LLM scoring | Score brand consistency 0-1 |
| `HUMAN_GATE` | `human_gate_trigger` | Interrupt for human approval |
| `SOCIAL` | `write_copy`, `generate_hashtags` | Prepare social media captions |
| `ANALYTICS` | `analyze_engagement` (mock) | Predicted metrics and KPIs |

### Edges

```
START → CREATIVE → VIDEO → DESIGN → BRAND_GUARDIAN → HUMAN_GATE → SOCIAL → ANALYTICS → END
```

### Interrupt Configuration

```typescript
compiledGraph = workflow.compile({
  checkpointer,
  interruptBefore: ['HUMAN_GATE'],
});
```

### Resume Pattern

```typescript
await compiledGraph.invoke(
  { humanApproved: true, humanComment: 'Approved' } as Partial<ContentPipelineState>,
  { configurable: { thread_id: campaignId } }
);
```

---

## WF-2: Onboarding Flow

**File:** `src/langgraph/onboarding_flow.ts`
**Status:** stub → StateGraph (planned)

### Target State Schema

```typescript
interface OnboardingState extends BaseState {
  clientName: string;
  email: string;
  telegramChatId?: number;
  profileCreated: boolean;
  qdrantInitialized: boolean;
  welcomeSent: boolean;
  milestoneCreated: boolean;
  checkinScheduled: boolean;
  onboardingComplete: boolean;
  profile?: Record<string, unknown>;
  qdrantCollectionName?: string;
  milestoneId?: string;
}
```

### Node Definitions

| Node | Tools Called | Description |
|---|---|---|
| `CREATE_PROFILE` | `qdrant_query`, internal fetch | Create client profile in Qdrant `agency_clients` |
| `INIT_QDRANT` | `rag_create_dataset` | Create client-specific Qdrant collection |
| `SEND_WELCOME` | `schedule_post` (Telegram) | Send welcome message via bot |
| `CREATE_MILESTONE` | `create_task` | Create first check-in milestone task |
| `HUMAN_REVIEW` | `human_gate_trigger` | Interrupt for human review |
| `SCHEDULE_CHECKIN` | `set_reminder` | Schedule 7-day check-in reminder |

### Edges

```
START → CREATE_PROFILE → INIT_QDRANT → SEND_WELCOME → CREATE_MILESTONE → HUMAN_REVIEW → SCHEDULE_CHECKIN → END
```

### Interrupt Configuration

```typescript
interruptBefore: ['HUMAN_REVIEW'],
```

### Edge Routing (conditional)

```typescript
// After CREATE_PROFILE, check if profile was created successfully
.addEdge('CREATE_PROFILE', (state) =>
  state.profileCreated ? 'INIT_QDRANT' : 'END'
)

// After HUMAN_REVIEW, proceed or abort
.addEdge('HUMAN_REVIEW', (state) =>
  state.humanApproved ? 'SCHEDULE_CHECKIN' : 'END'
)
```

---

## WF-3: Status Update

**File:** `src/langgraph/status_update.ts`
**Status:** stub → StateGraph (planned)

### Target State Schema

```typescript
interface StatusUpdateState extends BaseState {
  campaignIds: string[];
  metrics: Record<string, unknown>[];
  report: string;
  broadcastSent: boolean;
  chatIds: number[];
  successCount: number;
}
```

### Node Definitions

| Node | Tools Called | Description |
|---|---|---|
| `FETCH_METRICS` | `qdrant_query`, scroll | Fetch all active campaigns and their metrics |
| `GENERATE_SUMMARY` | `rag_retrieve` (context), LLM | Generate status report in Portuguese |
| `SEND_UPDATE` | `schedule_post` (Telegram broadcast) | Send report to all client Telegram chats |
| `ARCHIVE` | `update_task_status` | Archive old campaigns, mark as 'completed' |

### Edges

```
START → FETCH_METRICS → GENERATE_SUMMARY → SEND_UPDATE → ARCHIVE → END
```

### No Interrupt Points

WF-3 is fully automated (recurring Monday 9am). No human intervention required.

---

## WF-4: Social Calendar

**File:** `src/langgraph/social_calendar.ts`
**Status:** stub → StateGraph (planned)

### Target State Schema

```typescript
interface SocialCalendarState extends BaseState {
  scheduledPosts: Array<{
    platform: string;
    content: string;
    scheduledTime: string;
  }>;
  brandScore?: number;
  metricsReport?: string;
  approvedPosts: Array<{ platform: string; content: string }>;
  published: boolean;
  engagementMetrics?: Record<string, unknown>;
}
```

### Node Definitions

| Node | Tools Called | Description |
|---|---|---|
| `SCRAPE_CALENDAR` | `qdrant_query`, scroll | Fetch scheduled posts from Qdrant |
| `BRAINSTORM_CONTENT` | `brainstorm_angles`, `write_copy` | Generate new content ideas |
| `BRAND_REVIEW` | Internal LLM scoring | Score brand consistency |
| `HUMAN_APPROVAL` | `human_gate_trigger` | Interrupt for human approval |
| `SCHEDULE_POST` | `schedule_post` | Schedule approved posts |
| `PUBLISH` | Internal (stub) | Publish to social platforms |
| `ANALYZE_ENGAGEMENT` | `analyze_engagement` | Fetch and analyze engagement metrics |

### Edges

```
START → SCRAPE_CALENDAR → BRAINSTORM_CONTENT → BRAND_REVIEW → HUMAN_APPROVAL →
  [approved] → SCHEDULE_POST → PUBLISH → ANALYZE_ENGAGEMENT → END
  [rejected] → END
```

### Interrupt Configuration

```typescript
interruptBefore: ['HUMAN_APPROVAL'],
```

---

## WF-5: Lead Qualification

**File:** `src/langgraph/lead_qualification.ts`
**Status:** stub → StateGraph (planned)

### Target State Schema

```typescript
interface LeadQualificationState extends BaseState {
  prospectId: string;
  prospectMessage: string;
  score: number;
  qualified: boolean;
  route: 'hot' | 'warm' | 'cold';
  taskCreated: boolean;
  taskId?: string;
  nurtureSequenceId?: string;
  prospectProfile?: Record<string, unknown>;
}
```

### Node Definitions

| Node | Tools Called | Description |
|---|---|---|
| `COLLECT_INFO` | `rag_retrieve` (context) | Enrich prospect info from RAG |
| `SCORE_LEAD` | Internal LLM scoring | Score 0-1 based on budget, timeline, fit |
| `ROUTE` | Internal routing | Route to hot/warm/cold based on score |
| `CREATE_TASK` | `create_task` | Create appropriate task in Qdrant |
| `AGENCY_CREATIVE` (hot) | `assign_to_agent` | Assign to agency-creative skill |
| `NURTURE` (warm) | `rag_create_dataset` | Add to nurture sequence dataset |
| `AWAIT_INFO` (cold) | `set_reminder` | Set reminder to follow up |

### Routing Logic

```
Score >= 0.8 → 'hot' → agency-creative immediately
Score >= 0.4 → 'warm' → nurture sequence
Score < 0.4 → 'cold' → await more info
```

### Edges

```
START → COLLECT_INFO → SCORE_LEAD → ROUTE →
  [hot] → CREATE_TASK → AGENCY_CREATIVE → END
  [warm] → CREATE_TASK → NURTURE → END
  [cold] → AWAIT_INFO → END
```

### Conditional Edge Pattern

```typescript
.addEdge('ROUTE', (state) => {
  if (state.score >= 0.8) return 'CREATE_TASK_HOT';
  if (state.score >= 0.4) return 'CREATE_TASK_WARM';
  return 'AWAIT_INFO';
})
```

---

## Implementation Roadmap

### Phase 1: Foundation (WF-2 Onboarding)

**Why first:** Onboarding is the entry point for new clients. Converting it to StateGraph first establishes the pattern for other workflows.

1. Define `OnboardingState` interface
2. Convert `executeOnboardingFlow()` to `StateGraph`
3. Add `interruptBefore: ['HUMAN_REVIEW']`
4. Wire tool calls to `TOOL_REGISTRY`
5. Add circuit breaker checks
6. Test interrupt/resume flow

### Phase 2: Automated Flows (WF-3, WF-4)

**Why second:** These have clearer sequential flows with one interrupt point each.

**WF-3 Status Update:**
1. Define `StatusUpdateState` interface
2. Convert to StateGraph (no interrupts)
3. Add broadcast tool integration

**WF-4 Social Calendar:**
1. Define `SocialCalendarState` interface
2. Convert to StateGraph
3. Add `interruptBefore: ['HUMAN_APPROVAL']`
4. Add engagement analytics

### Phase 3: Routing Flow (WF-5)

**Why last:** Lead qualification has conditional branching that requires careful edge routing.

1. Define `LeadQualificationState` interface
2. Convert to StateGraph with conditional edges
3. Implement hot/warm/cold routing
4. Add task creation for each route

### Phase 4: Cross-Cutting Concerns

1. Add shared `BaseState` type to all workflows
2. Implement thread_id persistence across restarts
3. Add monitoring/metrics per workflow
4. Document error handling patterns

---

## Error Handling Pattern

Each node should handle errors gracefully:

```typescript
async function myNode(state: MyState): Promise<Partial<MyState>> {
  try {
    const result = await executeTool('some_tool', { args: state.input });
    if (!result.ok) {
      return { error: result.error, currentStep: 'ERROR' };
    }
    return { output: result.data, currentStep: 'MY_NODE' };
  } catch (err) {
    console.error('[MyWorkflow] myNode failed:', err);
    return {
      error: err instanceof Error ? err.message : String(err),
      currentStep: 'ERROR',
    };
  }
}
```

### Error Edges

```typescript
.addEdge('MY_NODE', (state) =>
  state.error ? 'ERROR_HANDLER' : 'NEXT_NODE'
)
```

---

## Supervisor Integration

The `supervisor.ts` remains the single entry point:

```typescript
const WORKFLOW_REGISTRY = {
  content_pipeline: async (input, threadId) => {
    return await executeContentPipeline(input, threadId);
  },
  onboarding: async (input) => {
    const [clientName, email, telegramChatId] = input.split('|');
    return await executeOnboardingGraph({ clientName, email, telegramChatId });
  },
  // ... other workflows
};
```

---

## Metrics & Observability

Each workflow should emit structured logs:

```typescript
console.log(JSON.stringify({
  event: 'workflow_node_complete',
  workflow: 'onboarding',
  node: 'CREATE_PROFILE',
  clientId: state.clientId,
  duration_ms: Date.now() - startTime,
}));
```

---

## Testing Strategy

1. **Unit tests:** Test each node function in isolation with mocked `TOOL_REGISTRY`
2. **Integration tests:** Test full graph execution with `MemorySaver`
3. **Interrupt tests:** Test resume flow after `interrupt()` is triggered
4. **Error tests:** Verify graceful error handling and edge routing to ERROR_HANDLER

---

## File Structure

```
src/langgraph/
├── index.ts                    # Re-exports all graphs
├── supervisor.ts               # Workflow router (entry point)
├── content_pipeline.ts         # WF-1: StateGraph (REAL)
├── onboarding_flow.ts          # WF-2: StateGraph (planned)
├── status_update.ts            # WF-3: StateGraph (planned)
├── social_calendar.ts          # WF-4: StateGraph (planned)
└── lead_qualification.ts       # WF-5: StateGraph (planned)
```
