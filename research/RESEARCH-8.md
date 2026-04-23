# RESEARCH-8: RAG Pipeline Alternatives to Trieve

## Objetivo

Avaliar alternativas open-source para RAG pipeline, comparando Qdrant native search, FastEmbed, LlamaIndex e LangChain RAG.

## Stack Avaliada

### 1. Qdrant Native Search

**Descricao:** Vector search engine AI-native para similarity search semantica.

**Pontos Fortes:**
- Hybrid search (semantic + keyword)
- Multi-vector support (ColBERT, late interaction)
- Reranking nativo
- Low-latency search
- Qdrant Edge para embedding in-process (offline, robots, mobile, kiosks)
- Multitenancy integrado
- Collections com payload management

**Pontos Fracos:**
- Nao possui pipeline RAG completo - apenas motor de busca
- Requer integration manual com LLM providers

**Licenca:** Apache-2.0

---

### 2. FastEmbed

**Descricao:** Biblioteca leve para geracao de embeddings, mantida pelo time do Qdrant.

**Pontos Fortes:**
- Leve (ONNX Runtime vs PyTorch)
- Rapida com data parallelism
- Acurada - outperforma OpenAI Ada-002 no MTEB leaderboard
- Modelos SPLADE++ (sparse), ColBERT (late interaction)
- Image embeddings (CLIP ViT)
- Rerankers integrados
- Suporte multilingual
- Apache-2.0

**Pontos Fracos:**
- Apenas geracao de embeddings - precisa de vector store separado
- Nao e um pipeline RAG completo

---

### 3. LlamaIndex

**Descricao:** Framework completo para construir aplicacoes context-augmented com LLM. RAG e caso de uso central.

**Pontos Fortes:**
- Pipeline RAG completo: connectors -> indexes -> query engines
- Exemplo minimal em 5 linhas com `VectorStoreIndex.from_documents()`
- Integracao com 40+ vector stores (Pinecone, Chroma, Milvus, Weaviate, Qdrant, MongoDB Atlas, Azure AI Search, Elasticsearch, etc.)
- Flexibilidade em multiplos niveis: high-level API para prototyping rapido, low-level API para customizacao
- Data connectors para ingest de dados de sources nativas
- Chat engines para interacoes conversacionais
- Metadata filtering

**Pontos Fracos:**
- Curves steep se customizacao profunda e necessaria
- Documentacao pode ser confusa em alguns topicos

---

### 4. LangChain RAG

**Descricao:** Framework para construcao de aplicacoes com LLM, com enfase em retrieval chains e RAG Agents.

**Pontos Fortes:**
- RAG Agents: agente decide quando buscar, pode fazer multiplas searches
- RAG Chains: two-step approach (search + generation em uma chamada)
- LCEL (LangChain Expression Language) para composicao de chains
- Integracao com 40+ vector stores
- 30+ options para embeddings
- Multi-modal support
- Logging de retrieval steps para document-level visibility

**Pontos Fracos:**
- Breaking changes frequentes entre versoes
- Overhead de abstracao pode impactar performance
- Curva de aprendizado para LCEL

---

## Comparacao Directa

| Caracteristica | Qdrant | FastEmbed | LlamaIndex | LangChain |
|----------------|--------|-----------|------------|-----------|
| **Tipo** | Vector Store + Engine | Embedding Library | RAG Framework | LLM Framework + RAG |
| **Pipeline Completo** | Nao | Nao | Sim | Sim |
| **Hybrid Search** | Sim | Nao | Via integracao | Via integracao |
| **Reranking** | Nativo | Sim | Via integracao | Via integracao |
| **Multi-vector** | Sim (ColBERT) | Sim (ColBERT) | Via integracao | Via integracao |
| **Facilidade de Uso** | Media | Facil | Facil | Media |
| **Customizacao** | Baixa | Baixa | Alta | Alta |
| **Dependencias** | Qdrant server | ONNX Runtime | Flexivel | Flexivel |
| **Licenca** | Apache-2.0 | Apache-2.0 | MIT | MIT |

---

## Recomendacao

### Para pipelines completos (embeddings + vector store + retrieval + generation):

**1. LlamaIndex** - Melhor para maioria dos casos
- Pipeline completo e opinado
- Documentacao solida
- Flexibilidade em multiplos niveis
- Integra bem com Qdrant como vector store

**2. LangChain** - Para casos que exigem composicao complexa
- LCEL permite chains detalhadas
- Melhores tools para agents
- Vendor lock-in menor que alternativas

### Para componentes especializados:

**Qdrant** - Quando vector store com hybrid search e critico
- Performance solida
- Multi-vector nativo
- Edge computing support

**FastEmbed** - Quando embeddings rapidos e leves sao necessarios
- ONNX-based (sem PyTorch)
-Bom para serverless
- Rerankers nativos

---

## Fontes

- [Qdrant Documentation](https://qdrant.tech/documentation/)
- [FastEmbed GitHub](https://github.com/qdrant/fastembed)
- [LlamaIndex Framework](https://developers.llamaindex.ai/python/framework/)
- [LangChain RAG](https://docs.langchain.com/oss/python/langchain/rag.md)
- [LangChain Retrieval](https://docs.langchain.com/llms.txt)
