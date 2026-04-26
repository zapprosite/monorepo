# SPEC-092 — Trieve RAG Integration

**Data:** 2026-04-23
**Estado:** Active
**Autor:** Hermes Agent (William Rodrigues)
**Review:** William

---

## Problema

O homelab não possui um pipeline de RAG (Retrieval-Augmented Generation) completo e production-ready. O sistema atual tem:

- **Qdrant** (vector DB) — infraestrutura pronta
- **Mem0** (memory layer) — memória de preferências/fatos, não de knowledge
- **Second Brain** (docs) — conhecimento estático, sem retrieval otimizado
- **Hermes** (agent) — generation, mas sem retrieval refinado de documentos

Falta: documentos → chunking → embedding → index → retrieve → generate de forma integrada.

---

## Research: Por que Trieve

### Opções avaliadas

| Opção | Estrelas | Qdrant native? | Complex. | Decisão |
|-------|----------|----------------|----------|---------|
| **Trieve** | 2.6k | ✅ Sim (criado com) | Média | ✅ Escolhido |
| Dify | 139k | ⚠️ Suporta | Alta (muito completo) | ❌ Overkill |
| LangChain | 135k | ✅ Suporta | Alta (muito flexível) | ❌ Verbose demais |
| RAGFlow | 15k | ⚠️ Suporta | Alta | ❌ Heavy |
| FastGPT | 22k | ⚠️ Suporta | Média | ❌ Chinês-heavy |

### Por que Trieve

1. **API-first** — perfeito pro teu pattern CLI/Telegram
2. **Qdrant-first** — nasceu conectando no Qdrant, não adapter
3. **Chunking inteligente** — múltiplas estratégias (headings, sentences, etc)
4. **Reranking** — semantic search com reranking (BAAI/bge-reranker)
5. **Lightweight** — deploy simples, não um monstro como Dify
6. **Self-hostable** — 100% open source

---

## Arquitetura Proposta

### Stack Completo

```
┌─────────────────────────────────────────────────────────────┐
│                      HERMES AGENT                           │
│                   (Telegram / CLI)                         │
└─────────────────────┬───────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    TRIEVE (RAG)                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │ Chunks   │  │ Datasets │  │ Search  │  │ Rerank   │   │
│  │ Pipeline │  │ Manager  │  │ API     │  │ Engine   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────┬───────────────────────────────────────┘
                      │
          ┌───────────┼───────────┐
          ▼           ▼           ▼
    ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ QDRANT   │ │ OLLAMA   │ │ MEM0     │
    │ (vectDB) │ │ (embed)  │ │ (memory) │
    │  :6333   │ │  :11434  │ │  :6333   │
    └──────────┘ └──────────┘ └──────────┘
          │                      │
          ▼                      ▼
    ┌──────────────────────────────────────────────────────┐
    │              SECOND BRAIN (Docs)                      │
    │  hermes-second-brain/docs/                             │
    │  monorepo/docs/                                       │
    │  hvacr-swarm/docs/                                    │
    └──────────────────────────────────────────────────────┘
```

### Integração com Infraestrutura Existente

| Componente | Já existe? | Papel no RAG |
|------------|------------|--------------|
| Qdrant `:6333` | ✅ Sim | Vector storage + retrieval |
| Ollama `:11434` | ✅ Sim | Embedding (qwen2.5:3b ou bge) |
| Mem0 | ✅ Sim | Memory layer (separado do RAG) |
| Hermes Agent | ✅ Sim | Orchestration + generation |
| Second Brain | ✅ Sim | Knowledge source (documents) |

---

## Decisões de Arquitectura

### 1. Deployment: Docker via Coolify

Trieve oferece Docker image oficial. Deploy via Coolify em porta reservada (sugestão: `6435` — livre na faixa :4002–:4099).

### 2. Dataset Sources (Knowledge Sources)

Prioridade de indexação:

```
FASE 1 — Indexação inicial
  ├── hermes-second-brain/docs/    (skills, TREE.md)
  ├── monorepo/docs/SPECS/         (SPECs ativos)
  └── /srv/ops/ai-governance/      (governança)

FASE 2 — Expansão
  ├── hvacr-swarm/docs/
  ├── monorepo/AGENTS.md
  └── README.md files (raiz dos repos)
```

### 3. Embedding Model

**Recomendado:** `BAAI/bge-m3` ou `nomic-ai/qwen2.5:3b` (já no Ollama)

```bash
# Pull model se necessário
ollama pull nomic-ai/qwen2.5:3b
```

### 4. Chunking Strategy

| Strategy | Quando usar | Tamanho |
|----------|-------------|---------|
| `heading` | Docs com headers (#, ##) | Variável |
| `sentence` | Textos corridos | 512 tokens |
| `page` | PDFs | 1024 tokens |

**Decisão:** Usar `heading` para markdown docs (preserva estrutura).

### 5. API Endpoint

```
http://localhost:6435/api/v1
```

### 6. Integração Hermes

Hermes usa Trieve via:
1. **Direct fetch** — curl/python pro search API
2. **Resultado** — chunks relevantes injetados no context do LLM

---

## Configuração

### docker-compose fragment (Trieve)

```yaml
services:
  trieve:
    image: trieve/trieve:latest
    ports:
      - "6435:3000"
    environment:
      - QDRANT_URL=http://10.0.9.1:6333
      - QDRANT_COLLECTION=trieve
      - OLLAMA_BASE_URL=http://10.0.9.1:11434
      - EMBEDDING_MODEL=nomic-ai/qwen2.5:3b
      - RERANK_MODEL=BAAI/bge-reranker-base
      - DATABASE_URL=sqlite:///srv/data/trieve/trieve.db
    volumes:
      - /srv/data/trieve:/run/trieve
    restart: unless-stopped
```

### Environment variables (secrets.env)

```bash
# Trieve
TRIEVE_API_KEY=generated_on_first_login
TRIEVE_URL=http://localhost:6435
```

---

## Comandos

### Indexar dataset

```bash
# Criar dataset
curl -X POST http://localhost:6435/api/v1/datasets \
  -H "Authorization: Bearer $TRIEVE_API_KEY" \
  -d '{"name": "hermes-second-brain", "description": "Docs do Hermes"}'

# Upload chunks (exemplo básico)
curl -X POST http://localhost:6435/api/v1/chunks \
  -H "Authorization: Bearer $TRIEVE_API_KEY" \
  -d '{
    "dataset_id": "uuid",
    "content": "# SKILL.md\n\nConteúdo do skill...",
    "metadata": {"source": "hermes-second-brain", "type": "skill"}
  }'
```

### Search

```bash
curl -X POST http://localhost:6435/api/v1/search \
  -H "Authorization: Bearer $TRIEVE_API_KEY" \
  -d '{
    "query": "como fazer deploy no coolify?",
    "dataset_id": "uuid",
    "limit": 5
  }'
```

### No Hermes (futuro skill)

```python
# pseudo-code pro Hermes
async def rag_retrieve(query: str, top_k: int = 5) -> list[str]:
    response = requests.post(
        f"{TRIEVE_URL}/api/v1/search",
        headers={"Authorization": f"Bearer {TRIEVE_API_KEY}"},
        json={"query": query, "limit": top_k}
    )
    return [r["chunk"]["content"] for r in response.json()["results"]]
```

---

## Roadmap por Fase

```
FASE 1 — Setup (1-2h)
  ├── Deploy Trieve via Coolify :6435
  ├── Configurar Qdrant collection
  ├── Testar search API com curl
  └── Verificar embedding via Ollama

FASE 2 — Indexação (2-3h)
  ├── Criar dataset "hermes-knowledge"
  ├── Indexar hermes-second-brain (skills, TREE.md)
  ├── Indexar SPECs ativos do monorepo
  └── Indexar /srv/ops/ai-governance/

FASE 3 — Integração Hermes (3-4h)
  ├── Criar skill `rag-retrieve` pro Hermes
  ├── Integrar no flujo de contexto
  ├── Testar retrieval + generation
  └── Documentar workflow

FASE 4 — Expansão (opcional)
  ├── Indexar hvacr-swarm/docs
  ├── Indexar monorepo README.md
  └── Adicionar reranking (BAAI/bge-reranker)
```

---

## Acceptance Criteria

- [ ] Trieve deployado em `:6435` e respondendo `/health`
- [ ] Qdrant connection funcionando
- [ ] Ollama embedding gerando vectors
- [ ] Dataset criado e indexado com Second Brain docs
- [ ] Search API retornando resultados relevantes
- [ ] Hermes skill `rag-retrieve` criado e funcionando
- [ ] Context do Hermes inclui chunks do Trieve quando relevante
- [ ] PORTS.md atualizado com `:6435 → Trieve (RAG)`
- [ ] SUBDOMAINS.md atualizado (se exposto externamente)

---

## Out of Scope

- Multi-usuário / ACLs (single-user: William)
- UI web do Trieve (CLI-only interaction initially)
- PDF parsing (apenas markdown/text)
- Web crawling (apenas arquivos locais)
- Reranking (FASE 4, opcional)

---

## Riscos e Mitigações

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Trieve API incompatibility com Qdrant version | Baixa | Alto | Testar com Qdrant 1.7+ |
| Embedding quality ruim | Média | Médio | Testar qwen2.5:3b vs bge-m3 |
| Mem0 e Trieve competindo por Qdrant | Baixa | Médio | Collections separadas: `mem0` vs `trieve` |
| Context window overflow | Média | Médio | Limitar top_k=5 chunks |

---

## Port Reserved

```
:6435 → Trieve (RAG API)
```

**Update necessário:** `/srv/ops/ai-governance/PORTS.md` e `SUBDOMAINS.md`

---

## Referências

- [Trieve GitHub](https://github.com/devflowinc/trieve)
- [Trieve Docs](https://docs.trieve.ai)
- [BGE Embeddings](https://huggingface.co/BAAI/bge-m3)
- [Qdrant](https://qdrant.tech)
