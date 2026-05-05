# RAG Architecture — Homelab Knowledge Layer

**Status:** ATIVO (Haystack removido 2026-05-02)
**Stack:** Haystack 2.x + Qdrant + Ollama (nomic-embed-text) + LiteLLM (hermes-brain)

---

## Visão Geral

RAG (Retrieval-Augmented Generation) fornece busca de conhecimento factual para agentes AI via **Haystack 2.x**, com Mem0 lidando com memória conversacional e estado de sessão.

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Query                                 │
└─────────────────────────────┬───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Ollama (:11434)                                │
│  ┌─────────────────┐         ┌─────────────────┐               │
│  │ nomic-embed-text│         │   LLM (local)   │               │
│  │   (768 dim)     │         │                 │               │
│  └────────┬────────┘         └────────┬────────┘               │
└───────────┼────────────────────────────┼────────────────────────┘
            │                            │
            │ embed query                 │ LLM prompt + chunks
            ▼                            ▼
┌─────────────────────────────────────────────────────────────────┐
│               Qdrant (:6333)                                      │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Haystack 2.x Pipeline (scripts/haystack-rag-pipeline.py)│  │
│  │  ┌─────────────┐ ┌──────────────┐ ┌──────────────────┐  │  │
│  │  │ hermes-     │ │ second-brain  │ │ skills           │  │  │
│  │  │ knowledge   │ │               │ │                  │  │  │
│  │  └─────────────┘ └──────────────┘ └──────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
            │
            │ (Mem0: conversational memory)
            ▼
┌─────────────────────────────────────────────────────────────────┐
│               Mem0 v2 — Session + Facts Memory                    │
│  Coleção: `will` (2044 pontos)                                   │
│  Provider: LiteLLM (hermes-brain) via Qdrant                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Stack Componentes

### Qdrant (:6333)

Vector database para todas as coleções RAG.

- **Host:** `127.0.0.1:6333` (localhost, não exposto)
- **API Key:** `QDRANT_API_KEY` em `~/.hermes/secrets.env`
- **Coleções ativas:**

| Coleção | Pontos | Dimensão | Conteúdo |
|---------|--------|----------|----------|
| `hermes-knowledge` | 191 | 768 | Chunks do second-brain |
| `skills` | 225 | 768 | Skills do Hermes |
| `second-brain` | 79 | 768 | Docs raw |
| `hvac_manuals_v1` | 442 | 768 | Manuais HVAC |
| `will` | 2044 | 768 | Mem0 facts (2048D na verdade) |

### Ollama (:11434)

Embedding provider local.

- **Embedding Model:** `nomic-embed-text` (768 dimensões)
- **Base URL:** `http://localhost:11434`
- **Chunking:** 3000 chars / 200 overlap (Ollama context limit)

### LiteLLM (:4018)

Proxy LLM multi-provider.

- **Host:** `localhost:4018` (não 4000!)
- **Auth:** `LITELLM_MASTER_KEY`
- **Models:** `hermes-brain`, `hermes-cloud-cheap`

---

## Pipeline Haystack

**Script:** `/srv/monorepo/scripts/haystack-rag-pipeline.py`

### Query Flow

```
User query
    │
    ├─→ OllamaTextEmbedder (nomic-embed-text) → 768D vector
    │
    ├─→ QdrantEmbeddingRehaystackr (hermes-knowledge)
    │         ↓
    │   top-k chunks (score > 0.5)
    │         ↓
    ├─→ Mem0.search() (facts sobre user/project)
    │
    └─→ hermes-brain (via LiteLLM 4018)
             ↓
      [system prompt] + [RAG chunks] + [Mem0 facts]
             ↓
          Answer
```

### Indexing

```bash
# Reindexar second-brain (com chunking)
python3 /srv/monorepo/scripts/haystack-rag-pipeline.py \
  --index /srv/monorepo/ --recreate

# Query única
python3 /srv/monorepo/scripts/haystack-rag-pipeline.py \
  --query "como configurar o Hermes Agent?"

# Teste de integração
python3 /srv/monorepo/scripts/haystack-rag-pipeline.py --test
```

### Chunking Strategy

| Tipo | Chunk Size | Overlap | Motivo |
|------|------------|---------|--------|
| Docs longos | 3000 chars | 200 | Limite contexto Ollama |
| Skills | 1500 chars | 100 | Semanticamente autocontido |
| Short docs | não chunkar | - | < 3000 chars |

---

## Mem0 — Facts e Preferências

**Problema resolvido (2026-05-02):** Mem0 v2 precisa de provider LLM. Configurado via **LiteLLM** (não OpenAI).

### Configuração

```bash
# Provider: LiteLLM (self-hosted, sem OpenAI key)
MEM0_LLM_PROVIDER=litellm
MEM0_LLM_MODEL=hermes-brain
MEM0_LITELLM_API_BASE=http://localhost:4018
MEM0_LITELLM_API_KEY=<LITELLM_MASTER_KEY>

# Storage: Qdrant local
MEM0_STORE=qdrant
MEM0_QDRANT_HOST=127.0.0.1
MEM0_QDRANT_PORT=6333
MEM0_COLLECTION=will
```

### Operações

```python
from mem0 import Memory

m = Memory()
m.add("William prefere respostas diretas e assertivas", user_id="7220607041")
m.search("preferências de comunicação do William", user_id="7220607041")
m.get_all(user_id="7220607041")
```

---

## Dataset Naming Convention

Padrão: `{app}[-{lead}][-{type}]`

| Dataset | App | Tipo | Descrição |
|---------|-----|------|-----------|
| `hermes-knowledge` | hermes | knowledge | Second-brain chunkado |
| `skills` | skills | - | Skills indexadas |
| `hvac_manuals_v1` | hvacr | manuals | Manuais técnicos |
| `will` | mem0 | facts | Facts e preferências |

---

## Environment Variables

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `QDRANT_URL` | `http://127.0.0.1:6333` | Qdrant host |
| `QDRANT_API_KEY` | `***` | Qdrant API key |
| `OLLAMA_URL` | `http://localhost:11434` | Ollama host |
| `OLLAMA_MODEL` | `nomic-embed-text` | Embedding model |
| `LITELLM_URL` | `http://localhost:4018` | LiteLLM host (não 4000!) |
| `LITELLM_MODEL` | `hermes-brain` | Chat model |

---

## Troubleshooting

### Retrieval retornando 0 resultados

1. Verificar se collection existe: `qc.get_collection('hermes-knowledge')`
2. Verificar se vetores existem: `qc.scroll('hermes-knowledge', limit=1, with_vectors=True)`
3. Se vetores vazios → reindexar com `--recreate`

### Ollama embedding falhando

```bash
# Testar Ollama
curl -X POST http://localhost:11434/api/embed \
  -d '{"model":"nomic-embed-text","input":"test"}'

# Verificar se modelo existe
curl http://localhost:11434/api/tags
```

### LiteLLM retornando 401

```bash
# Verificar porta correta (4018, não 4000)
curl -H "Authorization: Bearer <LITELLM_MASTER_KEY>" \
  http://localhost:4018/v1/models
```

---

## Histórico

- **2026-05-02:** Haystack removido. Haystack 2.x + Qdrant direto é o novo stack. LiteLLM porta corrigida para 4018.
- **2026-04-30:** Stack anterior com Haystack depreciado.
