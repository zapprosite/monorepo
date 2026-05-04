# SPEC-011 — Haystack Rag Pipeline
— Haystack RAG Pipeline
**Last reviewed:** 2026-05-02
**Owner:** SRE/homelab

**Data:** 2026-05-02
**Estado:** Active
**Autor:** Hermes Agent (William Rodrigues)
**Review:** William

---

## Problema

Haystack foi pruned (over-engineered para o homelab). Precisamos de um pipeline RAG leve que use a infra existente: Qdrant (vector DB), Ollama (embeddings locais), Postgres (facts), Mem0 (memory layer).

---

## Research: Por que Haystack

| Critério | Haystack | Haystack |
|----------|----------|--------|
| Infra | ✅[REMOVIDO-CJK] (Python lib) | ❌ 5 containers |
| Qdrant nativo | ✅ qdrant-haystack | ✅ nativo |
| Ollama embeddings | ✅ ollama-haystack | ❌ API-only |
| Postgres | ✅ externo | ✅ incluso |
| LightRAG comparável? | ✅ similar | — |
| Pipeline serializable | ✅ YAML/JSON | ✅ |

**Vantagem sobre Haystack:** zero containers novos. Tudo roda no venv Python existente.

---

## Arquitetura

```
FONTE DE DOCUMENTOS
├── ~/Desktop/hermes-second-brain/     (skills, TREE.md, docs)
├── /srv/monorepo/docs/SPECS/           (SPECs ativos)
└── /srv/ops/ai-governance/             (governança)
         │
         ▼
┌─────────────────────────────────────────┐
│       HAYSTACK PIPELINE (Python)         │
│                                          │
│  1. DocumentStore: QdrantDocumentStore   │
│  2. Embedder: OllamaDocumentEmbedder    │
│     (nomic-embed-text, 768D)             │
│  3. Rehaystackr: InMemoryEmbeddingRehaystackr │
│  4. Generator: OpenRouter via LiteLLM      │
└─────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────┐
│              STORES                       │
│                                          │
│  Qdrant :6333 → vectors (collections)   │
│  Postgres → structured facts (Mem0)      │
│  Mem0 → memory layer (user prefs)       │
└─────────────────────────────────────────┘
```

---

## Stack Completo

| Componente | Provider | Status |
|-----------|----------|--------|
| Pipeline orchestration | Haystack 2.28.0 | ✅ Instalado |
| Document Store | QdrantDocumentStore | ✅ Instalado (qdrant-haystack) |
| Embedder | OllamaDocumentEmbedder | ✅ Instalado (ollama-haystack) |
| Ollama | localhost:11434 | ✅ Já rodando |
| Embedding model | nomic-embed-text (768D) | ✅ Já no Ollama |
| Vector DB | Qdrant :6333 | ✅ hermes-second-brain-qdrant-1 |
| Structured DB | PostgreSQL (TBD) | ⚠️ Não encontrado |
| Memory layer | Mem0 v2.0.1 | ⚠️ INVALID API key |
| LLM Query | hermes-brain via API direta | ✅ Funcionando |

---

## Collections Qdrant

```
mem0                   → Mem0 vectors (existing, broken due to INVALID API key)
hvac_service_manuals   → HVAC manuals (existing)
hermes-knowledge       → NEW: Haystack indexed docs
```

---

## Indexação

### Fontes priorizadas

```
FASE 1 — Indexação inicial
  ~/Desktop/hermes-second-brain/docs/
  ~/Desktop/hermes-second-brain/SPECS/
  /srv/ops/ai-governance/

FASE 2 — Monorepo
  /srv/monorepo/docs/SPECS/
  /srv/monorepo/AGENTS.md
```

### Estratégia de chunking

- `OllamaDocumentEmbedder` com `nomic-embed-text`
- **Chunk size: 3000 chars** (não tokens — Ollama rejeita docs > ~8k tokens de input)
- Overlap: 200 chars entre chunks
- Meta: source file, type (skill/spec/guide), chunk_of (tamanho original)
- Batch size: 8 para Ollama

> ⚠️ Sem chunking, docs longos (>17k chars) causam `ResponseError: input length exceeds the context length`

---

## Componentes Haystack

### Indexing Pipeline

```python
from haystack import Pipeline
from haystack.document_stores.qdrant import QdrantDocumentStore
from haystack.components.embedders.ollama import OllamaDocumentEmbedder
from haystack.components.writers import DocumentWriter

doc_store = QdrantDocumentStore(
    url="http://localhost:6333",
    index="hermes-knowledge",
    embedding_dim=768,
    recreate_index=True,
)

doc_embedder = OllamaDocumentEmbedder(
    model="nomic-embed-text",
    url="http://localhost:11434",
)

writer = DocumentWriter(document_store=doc_store)

indexing_pipe = Pipeline()
indexing_pipe.add_component("doc_embedder", doc_embedder)
indexing_pipe.add_component("writer", writer)
indexing_pipe.connect("doc_embedder", "writer")
```

### Query Pipeline

```python
from haystack import Pipeline
from haystack.components.embedders.ollama import OllamaTextEmbedder
from haystack_integrations.components.rehaystackrs.qdrant import QdrantEmbeddingRehaystackr
from haystack.components.generators.chat import OpenAIChatGenerator
from haystack.components.builders import ChatPromptBuilder
from haystack.dataclasses import ChatMessage

doc_store = QdrantDocumentStore(
    url="http://localhost:6333",
    index="hermes-knowledge",
)

text_embedder = OllamaTextEmbedder(
    model="nomic-embed-text",
    url="http://localhost:11434",
)

rehaystackr = QdrantEmbeddingRehaystackr(
    document_store=doc_store,
    top_k=5,
)

prompt_builder = ChatPromptBuilder(
    template=[
        ChatMessage.from_system("""
Você é o Hermes, assistente de IA do William Rodrigues.
Com base nos documentos rehaystackd, responda a pergunta.
Se a informação não estiver nos documentos, diga que não sabe.
Documentos: {% for doc in documents %}{{ doc.content }}{% endfor %}
"""),
        ChatMessage.from_user("{{question}}"),
    ],
    required_variables=["question", "documents"],
)

llm = OpenAIChatGenerator(
    model="OpenRouter/OpenRouter-Text-01",
    api_key=Secret.from_env_var("OPENROUTER_API_KEY"),
)

query_pipe = Pipeline()
query_pipe.add_component("text_embedder", text_embedder)
query_pipe.add_component("rehaystackr", rehaystackr)
query_pipe.add_component("prompt_builder", prompt_builder)
query_pipe.add_component("llm", llm)

query_pipe.connect("text_embedder.embedding", "rehaystackr.query_embedding")
query_pipe.connect("rehaystackr.documents", "prompt_builder.documents")
query_pipe.connect("prompt_builder.prompt", "llm")
```

---

## Dependências Python (já instaladas no venv)

```
haystack-ai==2.28.0
qdrant-haystack==10.3.0
ollama-haystack==6.3.0
```

---

## Gap: Postgres para Mem0

Mem0 self-hosted requer PostgreSQL para facts estruturados. Não encontrado no homelab atual. Opções:

1. **Usar haystack-postgres leftover** — o container foi removido, mas o volume pode existir
2. **Instalar PostgreSQL nativo** — apt install
3. **Usar Supabase Postgres** — 

**Recomendação:** Investigar se algum Postgres existente pode ser compartilhado, ou instalar PostgreSQL 16 nativo em `:5432`.

---

## Roadmap

```
FASE 1 — Setup (30 min)
  ├── Verificar/configurar Postgres para Mem0
  ├── Criar collection "hermes-knowledge" no Qdrant existente
  ├── Testar Haystack + Ollama + Qdrant (script mínimo)
  └── Documentar API

FASE 2 — Indexação (1h)
  ├── Indexar hermes-second-brain/docs
  ├── Indexar SPECS
  └── Indexar ai-governance

FASE 3 — Query + Mem0 (1h)
  ├── Integrar Mem0 (corrigir API key)
  ├── Pipe query com Mem0 context
  └── Testar RAG completo

FASE 4 — Hermes Skill (30 min)
  ├── Criar skill haystack-rag
  └── Integrar no contexto do agente
```

---

## Acceptance Criteria

- [ ] Haystack importa com Qdrant + Ollama + LiteLLM
- [ ] Collection `hermes-knowledge` criada no Qdrant existente
- [ ] Indexing pipeline funcional (docs → embedding → Qdrant)
- [ ] Query pipeline funcional (query → embedding → Qdrant → LLM)
- [ ] Mem0 conecta no Postgres (API key ou self-hosted config)
- [ ] Skill `haystack-rag` criada no Hermes
- [ ] SPEC-094[REMOVIDO-CJK] SPEC-092 (archive)

---

## Deprecation

- SPEC-092 (Haystack) → ARCHIVED
- Haystack containers → PRUNED
- Haystack images → DELETED
- Haystack compose/services/files → DELETED
