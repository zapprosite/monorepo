# ADR-20260424 — Mem0 como Camada de Memória Dinâmica

**Status:** aceito
**Date:** 2026-04-24
**Author:** Principal Engineer
**Spec:** SPEC-VIBE-BRAIN-REFACTOR (FASE 1 + FASE 3)

---

## Context

O ecossistema Hermes opera com 3 camadas de memória com responsabilidades distintas:

| Camada | Responsabilidade | Tecnologia |
|--------|-----------------|------------|
| **REPO** | Fonte de verdade — documentação versionada | Git +文件系统 |
| **Qdrant** | RAG retrieval com metadata filters | Qdrant (:6333) |
| **Mem0** | Memória dinâmica — preferências, padrões, contexto acumulado | Mem0 + Qdrant backend |

Historicamente, Qdrant era usado como store genérico para ambas as funções. Essa sobreposição criou ambiguidade sobre onde cada tipo de dado deveria residir. Além disso, a configuração do Mem0 estava quebrada — embedding model mismatch impedia检索.

---

## Decision

**Mem0 é adotado como camada de memória dinâmica**, usando Qdrant como backend de armazenamento vetorial. Raw Qdrant é reservado exclusivamente para RAG retrieval com metadata filters.

---

## 1. Por que Mem0 em vez de Raw Qdrant

### Opções consideradas

| Opção | Esforço inicial | Manutenção | Decisão |
|-------|----------------|------------|---------|
| Raw Qdrant + custom wrapper | 2 semanas | **Alta** — código próprio para cada operação (add/search/delete/update) | ❌ Descartado |
| Raw Qdrant direto | 0 dias | **Muita baixa** — mas sem gestão de identidade,Versioning, ouTTL | ❌ Descartado |
| **Mem0 + Qdrant backend** | 2-3 dias | **Baixa** — 53k⭐, comunidade ativa, updates transparents | ✅ Escolhido |
| LangChain memory | 1 semana | **Média** — abstração leaky, vendor lock-in | ❌ Descartado |

### O que Mem0 fornece que raw Qdrant não tem

- **Identidade de memória** — cada memória tem ID, user_id, agent_id, metadata
- **Versioning automático** — memórias são actualizadas, não sobrepostas
- **TTL implícito** — preferências expiram naturalmente
- **API unificada** — `add` / `search` / `get` / `delete` sem lógica custom
- **Qdrant como backend** — não há lock-in; troca de backend via config

Raw Qdrant é inferior para memória dinâmica porque:

1. Não tem conceito de "usuário" ou "agente" — tudo é ponto flat
2. Update significa delete + insert manual
3. Filtros por metadata sãomanually geridos
4. Não há patterns depreferência ou contexto acumulado

---

## 2. Hybrid Search — BM25 Desactivado na Colecção Existente

### Configuração aplicada

```
QDRANT_COLLECTION=hermes_memory
BM25_ENABLED=false  # na colecção existente
SEMANTIC_ENABLED=true
```

### Trade-off

| Aspecto | BM25 activo | BM25 desactivado |
|---------|-------------|-----------------|
| Retrieval keywords | ✅ Excelente | ❌ Depende só de vetores |
| Retrieval semântico | ✅ Híbrido | ✅ Semântico puro |
| Compatibilidade colección existente | ⚠️ Reindexação necessária | ✅ Sem mudança |
| Overhead de storage | +15-20% | Zero |

**Decisão: BM25 desactivado na colección existente (`hermes_memory`).**

Razão: a colección `hermes_memory` já existe com ~2000 vectors. Re-indexar com BM25 implicaria:
- Recriar a colección (perder histórico de versões se não houver snapshot)
- Overhead de storage adicional sem benefit imediato
- Complexidade adicional no pipeline de indexação

**Future proof:** Quando Mem0 estabilizar em produção, uma nueva colección `hermes_memory_hybrid` pode ser criada com BM25 activo se retrieval keyword-heavy for necessário.

---

## 3. Provider Configuration — LiteLLM Proxy

### Configuração do embedding provider

```
# ~/.hermes/config.yaml  (hermes-second-brain)
mem0:
  embeddings_provider: litellm
  embeddings_model: embedding-nomic  # ✅ CORRECTO — via LiteLLM
  # NÃO usar: text-embedding-3-small (OpenAI, custos + dependência)
```

### Porquê LiteLLM Proxy em vez de OpenAI directo

| Aspecto | OpenAI directo | LiteLLM Proxy (:4000) |
|---------|---------------|----------------------|
| Custo | Pay-per-token | Cache local (ollama/nomic gratís) |
| Latência | ~200-500ms | ~20-50ms (local) |
| Offline | ❌ Requer internet | ✅ 100% offline |
| Abstração | Nenhuma | Multi-provider transparente |
| Fallback | Nenhum | `ollama/embedding-nomic` → `openai/embedding-3-small` |

### LiteLLM proxy como canonical gateway

```
# LiteLLM proxy (:4000) — já em produção
ollama/embedding-nomic     # embedding local, 100% offline
openai/embedding-3-small   # fallback cloud (não usado activamente)
```

Vantagens:
- **Failover automático** — se ollama falha, tenta openai (sem mudança de código)
- **Observabilidade centralizada** — logs, metrics, rate limits num ponto
- **Zero vendor lock-in** — troca de provider é config, não código

---

## 4. Migration Path — De Hoje para Stateful Memory

### Fase 1 — Fix Mem0 (hoje)
```
OPENAI_EMBEDDINGS_MODEL=embedding-nomic  # ✅ JÁ FEITO
mem0.search("qual é a stack do Hermes?")  # debe funcionar
```

### Fase 2 — Indexar preferências
```
mem0.add(
    text="Usuário prefere respostas em PT-BR",
    user_id="william",
    metadata={"type": "preference", "category": "language"}
)
```

### Fase 3 — Raw Qdrant para RAG estruturado
```
Qdrant collection: hermes_docs
Metadata filters: doc_type, project, service, owner
Index: AGENTS.md, llms.txt, architecture-map.yaml
```

### Fase 4 — (Future) Mem0 com memória episodial
```
mem0.add(
    text="Usuário perguntou sobre backup yesterday",
    metadata={
        "type": "episode",
        "timestamp": "2026-04-24T10:00:00Z",
        "outcome": "showed backup-runbook"
    }
)
# Pesquisa: "o que o usuário perguntou sobre backup?"
```

### Fase 5 — (Future) Migração BM25
Se retrieval keyword-heavy for necessário:
1. Criar nueva colección `hermes_memory_hybrid`
2. Indexar com `enable_hybrid=True`
3. Switch gradual de queries
4. Delete colección antiga após validação

---

## Consequences

### Positive
- Mem0 fornece API de memória dinâmica sem código custom
- Qdrant dedicado para RAG — metadata filters, colecções isoladas
- LiteLLM proxy elimina dependência de OpenAI para embeddings
- Arquitectura alinhada com SPEC-VIBE-BRAIN-REFACTOR (3 camadas)

### Negative
- Mais uma dependencia (`mem0`) — 53k⭐ masvendor risk
- BM25 desactivado pode degradar retrieval keyword-heavy
- LiteLLM proxy adiciona hop de rede (~5ms local)

### Neutral
- Mem0 é supplementary a Qdrant, não replacement
- Qdrant continua como source of truth para RAG
- Migração para hybrid search é opcional e adiada

---

## References

- [SPEC-VIBE-BRAIN-REFACTOR.md](../../SPECS/SPEC-VIBE-BRAIN-REFACTOR.md)
- [SPEC-074 — Hermes Second Brain com Mem0](../../SPECS/SPEC-074-hermes-second-brain-mem0.md)
- [SPEC-059 — Hermes Agency Datacenter Hardening (removed)](../../SPECS/)
- [Mem0 Docs](https://docs.mem0.ai) — embedding model configuration
- ADR-001 (.env as canonical secrets source) — padrão de gestão de config
