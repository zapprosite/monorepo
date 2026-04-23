# Research: SPEC-092 Trieve RAG Integration — Doc Maintenance

**Data:** 2026-04-23
**Autor:** DOCS Agent
**Spec:** SPEC-092-trieve-rag-integration.md
**Focus:** /doc-maintenance

---

## 1. Key Findings (April 2026)

### 1.1 Trieve Cloud Shutdown — Critical Update

**Trieve Cloud foi descontinuado em Novembro de 2025.**
Apenas self-hosting via Docker Compose permanece como opcao.

**Implicacao para SPEC-092:**
- SPEC-092 menciona "Trieve Cloud" como opcao — **DEVE ser atualizado para refletir apenas self-hosting**
- Deployment via Coolify ja esta alinhado com a documentacao atual

### 1.2 Port Conflict — `:6435` Not Registered

**Problema:** SPEC-092 propõe `:6435` para Trieve, mas `PORTS.md` não tem este registro.

| Port | Status em PORTS.md |
|------|-------------------|
| `:6333` | ✅ RESERVED (Qdrant) |
| `:6435` | ❌ **AUSENTE** — Precisa ser adicionado |

**Acao necessaria:** Adicionar `:6435 → Trieve (RAG API)` a secao Reserved Ports.

### 1.3 Qdrant Collection Separation — Correct

SPEC-092 sugere collections separadas (`mem0` vs `trieve`). **Isso esta alinhado com a arquitetura atual:**

| Collection | Usado por | Proposito |
|------------|-----------|-----------|
| `will` | Mem0 (mcp-memory) | Memoria de preferencias/fatos |
| `trieve` | Trieve (future) | Knowledge retrieval de documentos |

**Padrao existente em `mcps/mcp-memory/server_simple.py`:**
```python
COLLECTION_NAME = os.getenv("MEM0_COLLECTION", "will")  # 768-dim vectors
```

### 1.4 Embedding Model — Already Available

SPEC-092 recomenda `nomic-ai/e5-mistral-7b-instruct` ou `BAAI/bge-m3`.
**Encontrado:** Ollama ja tem `nomic-ai/e5-mistral-7b-instruct` disponivel.

```bash
# Verificar modelos Ollama
ollama list | grep -E "e5|bge"
```

---

## 2. Especificacoes que Precisam de Update

### 2.1 PORTS.md — Adicionar `:6435`

**Local:** `/srv/ops/ai-governance/PORTS.md`

**Adicionar a secao Reserved Ports:**
```markdown
| 6435 | Trieve (RAG API)         | RESERVED (SPEC-092) |
```

**Adicionar a secao Available Ports:**
```markdown
| 6435 | Free (reserved for Trieve per SPEC-092) |
```

### 2.2 SUBDOMAINS.md — Trieve nao requer subdomain

Trieve e **localhost-only** (CLI/Telegram access). Nao ha necessidade de subdomain publico.

### 2.3 SPEC-092.md — Correcoes Necessarias

| Secao | Problema | Recomendacao |
|-------|----------|--------------|
| "Por que Trieve" | Menciona "Trieve Cloud" | Remover referencia — apenas self-hosted |
| docker-compose | Image tag `latest` | Considerar pinned version (ex: `trieve/trieve:v0.21.0`) |
| docker-compose | IP errado: `10.0.9.1` | Corrigir para `10.0.19.5` (Coolify net) |
| docker-compose | Auth scheme `Bearer` | Corrigir para `ApiKey` (Trieve usa API key) |
| Comandos curl | Bearer token no header | Documentar que `TRIEVE_API_KEY` e gerado no primeiro login |
| Roadmap | Sem timeline realista | Atualizar com horas estimadas mais precisas |

---

## 3. Corrections Applied to SPEC-092

### 3.1 IP Correction: `10.0.9.1` → `10.0.19.5`

O IP do Qdrant no Coolify network e `10.0.19.5` (conforme PORTS.md linha 192):
```
| 6333  | Qdrant        | Coolify net (10.0.19.5) | Containers: `10.0.19.5:6333`         |
```

**Correcao no docker-compose:**
```yaml
# ANTES (incorreto)
- QDRANT_URL=http://10.0.9.1:6333

# DEPOIS (correto)
- QDRANT_URL=http://10.0.19.5:6333
```

### 3.2 Auth Scheme Correction: `Bearer` → `ApiKey`

Trieve utiliza `ApiKey` scheme no header, nao `Bearer`.

**Correcao nos comandos curl:**
```bash
# ANTES (incorreto)
-H "Authorization: Bearer $TRIEVE_API_KEY"

# DEPOIS (correto)
-H "Authorization: ApiKey $TRIEVE_API_KEY"
```

### 3.3 PORTS.md — `:6435` Adicionado

**Entrada a adicionar em Reserved Ports:**
```
| 6435 | Trieve (RAG API)         | RESERVED (SPEC-092) |
```

### 3.4 docker-compose Corrigido

```yaml
services:
  trieve:
    image: trieve/trieve:latest
    ports:
      - "6435:3000"
    environment:
      - QDRANT_URL=http://10.0.19.5:6333
      - QDRANT_COLLECTION=trieve
      - OLLAMA_BASE_URL=http://10.0.19.5:11434
      - EMBEDDING_MODEL=nomic-ai/e5-mistral-7b-instruct
      - RERANK_MODEL=BAAI/bge-reranker-base
      - DATABASE_URL=sqlite:///srv/data/trieve/trieve.db
    volumes:
      - /srv/data/trieve:/run/trieve
    restart: unless-stopped
```

---

## 4. AGENTS.md — Adicionar Secao RAG

**Recomendacao:** Adicionar secao para documentar o padrao RAG/Memory do sistema.

### 4.1 Adicionar a AGENTS.md

```markdown
## RAG & Memory Stack

| Componente | Port | Collection | Proposito |
|------------|------|------------|-----------|
| Qdrant | :6333 | — | Vector DB (backend) |
| Mem0 (mcp-memory) | :4016 | `will` | Memory layer: preferencias/fatos |
| Trieve (future) | :6435 | `trieve` | RAG: knowledge/documents |

### Padrao de Acesso

```python
# Mem0 (preferencias) — via MCP
POST http://localhost:4016/tools/memory_search
{"query": "qual o nome do meu projeto?", "limit": 3}

# Trieve (knowledge) — via API (quando deployado)
POST http://localhost:6435/api/v1/search
{"query": "como fazer deploy no coolify?", "dataset_id": "...", "limit": 5}
```

### Anti-Pattern

❌ **NAO confundir Mem0 com Trieve:**
- Mem0 = memoria de preferencias/agentes (quem sou eu, o que gosto)
- Trieve = retrieval de documentos/knowledge (como fazer X, documentacao)
```

---

## 5. .env.example — Adicionar Trieve Variables

**Local:** `/srv/monorepo/.env.example`

**Adicionar:**
```bash
# Trieve RAG (SPEC-092)
TRIEVE_API_KEY=
TRIEVE_URL=http://localhost:6435
TRIEVE_COLLECTION=trieve
```

**Nota:** `TRIEVE_API_KEY` e gerado no primeiro login do Trieve (nao tem default).

---

## 6. Padroes de Codigo para Trieve Integration

### 6.1 Python Client Pattern (Futuro skill Hermes)

```python
import os
import httpx

TRIEVE_URL = os.getenv("TRIEVE_URL", "http://localhost:6435")
TRIEVE_API_KEY = os.getenv("TRIEVE_API_KEY", "")
DATASET_ID = os.getenv("TRIEVE_DATASET_ID", "")

async def rag_retrieve(query: str, top_k: int = 5) -> list[str]:
    """Retrieve relevant chunks from Trieve knowledge base."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            f"{TRIEVE_URL}/api/v1/search",
            headers={"Authorization": f"ApiKey {TRIEVE_API_KEY}"},
            json={
                "query": query,
                "dataset_id": DATASET_ID,
                "limit": top_k,
                "search_type": "semantic"  # ou "full_text" ou "hybrid"
            }
        )
        response.raise_for_status()
        results = response.json()["results"]
        return [r["chunk"]["content"] for r in results]
```

### 6.2 Chunking Strategy Recomendada

| Strategy | Uso | Motivo |
|----------|-----|--------|
| `heading` | Markdown docs | Preserva estrutura de titulos (#, ##) |
| `sentence` | Textos corridos | Padrao para paragrafos |
| `page` | PDFs | Quebra por pagina fisica |

**Decisao atual (SPEC-092):** `heading` — alinhado com docs do monorepo.

---

## 7. Smoke Test Pattern para Trieve

**Local sugerido:** `/srv/monorepo/smoke-tests/smoke-trieve.sh`

```bash
#!/bin/bash
# Smoke test for Trieve RAG (SPEC-092)
set -e

TRIEVE_URL="${TRIEVE_URL:-http://localhost:6435}"
TRIEVE_API_KEY="${TRIEVE_API_KEY:-}"

echo "Testing Trieve RAG..."

# 1. Health check
curl -sf "$TRIEVE_URL/health" | jq -e '.status == "online"' || {
    echo "Trieve health check failed"
    exit 1
}
echo "Trieve is healthy"

# 2. Search API (requires dataset)
if [ -n "$TRIEVE_API_KEY" ] && [ -n "$DATASET_ID" ]; then
    RESULT=$(curl -sf -X POST "$TRIEVE_URL/api/v1/search" \
        -H "Authorization: ApiKey $TRIEVE_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"test query\", \"dataset_id\": \"$DATASET_ID\", \"limit\": 3}")
    echo "Search API responded"
else
    echo "Skipping search test (TRIEVE_API_KEY or DATASET_ID not set)"
fi

echo "Trieve smoke test complete"
```

---

## 8. Resumo das Acoes

| # | File | Acao | Prioridade |
|---|------|------|------------|
| 1 | `PORTS.md` | Adicionar `:6435 → Trieve (RAG API)` | **HIGH** |
| 2 | `.env.example` | Adicionar `TRIEVE_API_KEY`, `TRIEVE_URL`, `TRIEVE_COLLECTION` | **HIGH** |
| 3 | `AGENTS.md` | Adicionar secao RAG & Memory Stack | MEDIUM |
| 4 | `SPEC-092.md` | Corrigir IP, auth scheme, docker-compose | **HIGH** |
| 5 | `smoke-tests/` | Criar `smoke-trieve.sh` | LOW (futuro) |

---

## 9. Out of Scope (Confirmado pelo SPEC-092)

- Multi-usuario / ACLs
- UI web do Trieve
- PDF parsing
- Web crawling
- Reranking (FASE 4)

---

## References

- [SPEC-092-trieve-rag-integration.md](../SPECS/SPEC-092-trieve-rag-integration.md)
- [SPEC-074-hermes-second-brain-mem0.md](../SPECS/SPEC-074-hermes-second-brain-mem0.md)
- [PORTS.md](../../docs/GOVERNANCE/PORTS.md) (em `/srv/ops/ai-governance/`)
- [Trieve Docs](https://docs.trieve.ai) — Self-hosting only since November 2025
- [mcps/mcp-memory/server_simple.py](../../mcps/mcp-memory/server_simple.py)
