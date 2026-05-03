# ADR-001 — Qdrant como Vector Store Local

**Status:** aceite
**Date:** 2026-04-24
**Author:** Principal Engineer
**Spec:** SPEC-VIBE-BRAIN-REFACTOR

---

## Context

O sistema Hermes opera como um "second brain" com 3 camadas de memória:

```
REPO (source of truth) → QDRANT (RAG) → MEM0 (preferências)
         ↓
    HERMES EXECUTOR
```

A camada de **Qdrant** serve como vector store para retrieval semântico (RAG) sobre o repositório indexado. O sistema precisa de:

1. **Long-term memory** — persistência de embeddings com retenção indefinida
2. **Multi-modal** — suportar embeddings de texto, áudio transcrito, e código
3. **Hot/cold separation** — separar documentos frequentemente acedidos (hot) de archival (cold)
4. **Metadata filtering** — filtrar por `doc_type`, `project`, `service`, `owner`

---

## Decision

**Qdrant** é adotado como vector store local para a camada RAG do Hermes second brain.

### Metadata Schema

```json
{
  "project": "hermes-second-brain",
  "doc_type": "adr|runbook|architecture|api|prompt|glossary",
  "service": "hermes-agents|mcloud|codex",
  "source_path": "path/to/file.md",
  "updated_at": "2026-04-24",
  "owner": "william",
  "version": "v1",
  "access_frequency": "hot|cold"
}
```

### Collection Strategy

| Collection | Purpose | Hot/Cold |
|------------|---------|----------|
| `brain-vectors` | Documentos RAG principais | Hot |
| `brain-archive` | Documentos antigos/arquivados | Cold |
| `brain-audio` | Transcrições de áudio | Hot |
| `brain-code` | Snippets de código indexados | Cold |

---

## Alternatives Considered

### 1. Pinecone

**Pro:**
- Managed service, zero ops
- Serverless tier disponível
- Multi-modal support

**Contra:**
- ❌ Dependência de serviço externo (vendor lock-in)
- ❌ Custo cumulativo para grandes volumes
- ❌ Latência adicional para queries locais
- ❌ Requer API key externa

**Veredicto:** Rejeitado — o sistema prioriza infra local para privacidade e latência mínima.

---

### 2. Weaviate

**Pro:**
- Open source
- GraphQL + REST API
- Multi-modal (texto, imagens)

**Contra:**
- ❌ Schema mais complexo que Qdrant
- ❌ Performance inferior emANN benchmarks
- ❌ Menor adoção no ecossistema Node/Python

**Veredicto:** Rejeitado — Qdrant oferece melhor performance/peso para o caso de uso.

---

### 3. Chroma

**Pro:**
- Embedded, simples de usar
- Good for prototyping

**Contra:**
- ❌ Não recomendado para produção
- ❌ Sem metadata filtering nativo
- ❌ Escalabilidade limitada
- ❌ Não suporta hot/cold separation

**Veredicto:** Rejeitado — não serve para um second brain production-grade.

---

### 4. Qdrant (escolhido)

**Pro:**
- ✅ Open source (Apache 2.0)
- ✅ Local deployment (privacidade, zero custo)
- ✅ Metadata filtering nativo (`doc_type`, `project`, `service`)
- ✅ ANN benchmarks competitivos (HNSW)
- ✅ REST + gRPC API
- ✅ Python/Python clients oficiais
- ✅ Hot/cold separation via collection strategy
- ✅ Named vectors para multi-modal
- ✅ Filters payloads grandes

**Contra:**
- ⚠️ Requer gestão de serviço próprio (mitigado por Docker/Coolify)

---

## Rationale

A escolha de Qdrant sobre as alternativas prende-se com:

1. **Privacidade** — vector store local significa que embeddings nunca saem do homelab. Critico para um second brain que processa documentação interna.

2. **Performance** — HNSW index do Qdrant oferece recall >95% com latência <10ms para coleções até 10M vectors.

3. **Metadata filtering** — o segundo brain precisa de filtrar por `doc_type`, `project`, `service`. Qdrant soporta filters com a mesma performance que full-scan.

4. **Multi-modal via Named Vectors** — Qdrant permite múltiplos vectores por documento (ex: texto + audio embedding). Suporta o requisito de multi-modal sem compromises.

5. **Hot/cold separation** — collection strategy natural com `brain-vectors` (hot) e `brain-archive` (cold). HNSW parametizado diferentemente para cada collection.

6. **Ecossistema** — Python client oficial, integração fácil com LangChain/LlamaIndex, comunidade ativa.

---

## Consequences

### Positive

- **Privacidade total** — embeddings nunca saem do homelab
- **Zero custo** — infra local, sem subscription
- **Performance** — latência mínima para queries locais
- **Flexibilidade** — metadata filters e hot/cold separation nativos
- **Extensibilidade** — Named vectors para multi-modal future-proof

### Negative

- **Ops overhead** — Qdrant precisa de ser gerido (updates, backups, monitoring)
- **Escalabilidade** — limitado a recursos do homelab (mitigado por archival strategy)
- **Consistência** — eventual consistency em coleções cold (acceptable trade-off)

### Mitigations for Negative

| Risco | Mitigação |
|-------|-----------|
| Ops overhead | Docker Compose com auto-restart, healthcheck |
| Backup | ZFS snapshot do volume Qdrant (já coberto por backup-runbook) |
| Escala | Archive policy mensal para documentos >6 meses sem access |
| Monitoring | Prometheus metrics expostas em `/metrics` |

---

## Implementation

### Docker Compose Service

```yaml
services:
  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
      - "6334:6334"
    volumes:
      - qdrant_storage:/qdrant/storage
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:6333/readyz"]
      interval: 30s
      timeout: 10s

volumes:
  qdrant_storage:
```

### Collection Creation

```bash
# Hot collection (documentos ativos)
curl -X PUT "http://localhost:6333/collections/brain-vectors" \
  -H "Content-Type: application/json" \
  --data '{
    "vectors": {
      "size": 1536,
      "distance": "Cosine"
    },
    "payload_schema": {
      "doc_type": { "type": "keyword" },
      "project": { "type": "keyword" },
      "service": { "type": "keyword" },
      "access_frequency": { "type": "keyword" }
    }
  }'
```

### Hybrid Search Config

```json
{
  "prefetch": [
    { "query": 768, "filter": { "doc_type": "architecture" } },
    { "query": 384, "filter": { "service": "hermes-agents" } }
  ],
  "fusion": {
    "kind": "dbsf"
  }
}
```

---

## Related ADRs

- ADR-001 (existing): .env as canonical secrets source
- ADR-002: Mem0 para memória dinâmica
- ADR-003 (future): Vibe Loop pattern

---

**Authority:** Platform Governance
**Last updated:** 2026-04-24
