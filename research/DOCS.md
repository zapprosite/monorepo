# Research: SPEC-092 Trieve RAG Integration — Doc Maintenance

**Data:** 2026-04-23
**Autor:** DOCS Agent
**Spec:** SPEC-092-trieve-rag-integration.md
**Focus:** /doc-maintenance

---

## 1. Key Findings (April 2026)

### 1.1 Trieve Cloud Shutdown — Critical Update

**Trieve Cloud foi descontinuado em Novembro de 2025.**
Apenas self-hosting via Docker Compose permanece como opção.

**Implicação para SPEC-092:**
- SPEC-092 menciona "Trieve Cloud" como opção — **DEVE ser atualizado para refletir apenas self-hosting**
- Deployment via Coolify já está alinhado com a documentação atual

### 1.2 Port Conflict — `:6435` Not Registered

**Problema:** SPEC-092 propõe `:6435` para Trieve, mas `PORTS.md` não tem este registro.

| Port | Status em PORTS.md |
|------|-------------------|
| `:6333` | ✅ RESERVED (Qdrant) |
| `:6435` | ❌ **AUSENTE** — Precisa ser adicionado |

**Ação necessária:** Adicionar `:6435 → Trieve (RAG API)` à seção Reserved Ports.

### 1.3 Qdrant Collection Separation — Correct

SPEC-092 sugere collections separadas (`mem0` vs `trieve`). **Isso está alinhado com a arquitetura atual:**

| Collection | Usado por | Propósito |
|------------|-----------|-----------|
| `will` | Mem0 (mcp-memory) | Memória de preferências/fatos |
| `trieve` | Trieve (future) | Knowledge retrieval de documentos |

**Padrão existente em `mcps/mcp-memory/server_simple.py`:**
```python
COLLECTION_NAME = os.getenv("MEM0_COLLECTION", "will")  # 768-dim vectors
```

### 1.4 Embedding Model — Already Available

SPEC-092 recomenda `nomic-ai/e5-mistral-7b-instruct` ou `BAAI/bge-m3`.
**Encontrado:** Ollama já tem `nomic-ai/e5-mistral-7b-instruct` disponível.

```bash
# Verificar modelos Ollama
ollama list | grep -E "e5|bge"
```

---

## 2. Especificações que Precisam de Update

### 2.1 PORTS.md — Adicionar `:6435`

**Local:** `/srv/ops/ai-governance/PORTS.md`

**Adicionar à tabela Reserved Ports:**
```markdown
| 6435 | Trieve (RAG API)         | RESERVED (SPEC-092) |
```

**Adicionar à tabela Available Ports:**
```markdown
| 6435 | Free (reserved for Trieve per SPEC-092) |
```

### 2.2 SUBDOMAINS.md — Trieve não requer subdomain

Trieve é **localhost-only** (CLI/Telegram access). Não há necessidade de subdomain público.

### 2.3 SPEC-092.md — Correções Necessárias

| Seção | Problema | Recomendação |
|-------|----------|--------------|
| "Por que Trieve" | Menciona "Trieve Cloud" | Remover referência — apenas self-hosted |
| docker-compose | Image tag `latest` | Considerar pinned version (ex: `trieve/trieve:v0.21.0`) |
| Comandos curl | Bearer token no header | Documentar que `TRIEVE_API_KEY` é gerado no primeiro login |
| Roadmap | Sem timeline realista | Atualizar com horas estimadas mais precisas |

---

## 3. AGENTS.md — Adicionar Seção RAG

**Recomendação:** Adicionar seção para documentar o padrão RAG/Memory do sistema.

### 3.1 Adicionar a AGENTS.md

```markdown
## RAG & Memory Stack

| Componente | Port | Collection | Propósito |
|------------|------|------------|-----------|
| Qdrant | :6333 | — | Vector DB (backend) |
| Mem0 (mcp-memory) | :4016 | `will` | Memory layer: preferências/fatos |
| Trieve (future) | :6435 | `trieve` | RAG: knowledge/documents |

### Padrão de Acesso

```python
# Mem0 (preferências) — via MCP
POST http://localhost:4016/tools/memory_search
{"query": "qual o nome do meu projeto?", "limit": 3}

# Trieve (knowledge) — via API (quando deployado)
POST http://localhost:6435/api/v1/search
{"query": "como fazer deploy no coolify?", "dataset_id": "...", "limit": 5}
```

### Anti-Pattern

❌ **NÃO confundir Mem0 com Trieve:**
- Mem0 = memória de preferências/agentes (quem sou eu, o que gosto)
- Trieve = retrieval de documentos/knowledge (como fazer X,文档)
```

---

## 4. .env.example — Adicionar Trieve Variables

**Local:** `/srv/monorepo/.env.example`

**Adicionar:**
```bash
# Trieve RAG (SPEC-092)
TRIEVE_API_KEY=
TRIEVE_URL=http://localhost:6435
TRIEVE_COLLECTION=trieve
```

**Nota:** `TRIEVE_API_KEY` é gerado no primeiro login do Trieve (não tem default).

---

## 5. Padrões de Código para Trieve Integration

### 5.1 Python Client Pattern (Futuro skill Hermes)

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
            headers={"Authorization": f"Bearer {TRIEVE_API_KEY}"},
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

### 5.2 Chunking Strategy Recomendada

| Strategy | Uso | Motivo |
|----------|-----|--------|
| `heading` | Markdown docs | Preserva estrutura de títulos (#, ##) |
| `sentence` | Textos corridos | Padrão paraparágrafos |
| `page` | PDFs | Quebra por página física |

**Decisão atual (SPEC-092):** `heading` — alinhado com docs do monorepo.

---

## 6. Smoke Test Pattern para Trieve

**Local sugerido:** `/srv/monorepo/smoke-tests/smoke-trieve.sh`

```bash
#!/bin/bash
# Smoke test for Trieve RAG (SPEC-092)
set -e

TRIEVE_URL="${TRIEVE_URL:-http://localhost:6435}"
TRIEVE_API_KEY="${TRIEVE_API_KEY:-}"

echo "🔍 Testing Trieve RAG..."

# 1. Health check
curl -sf "$TRIEVE_URL/health" | jq -e '.status == "online"' || {
    echo "❌ Trieve health check failed"
    exit 1
}
echo "✅ Trieve is healthy"

# 2. Search API (requires dataset)
if [ -n "$TRIEVE_API_KEY" ] && [ -n "$DATASET_ID" ]; then
    RESULT=$(curl -sf -X POST "$TRIEVE_URL/api/v1/search" \
        -H "Authorization: Bearer $TRIEVE_API_KEY" \
        -H "Content-Type: application/json" \
        -d "{\"query\": \"test query\", \"dataset_id\": \"$DATASET_ID\", \"limit\": 3}")
    echo "✅ Search API responded"
else
    echo "⚠️ Skipping search test (TRIEVE_API_KEY or DATASET_ID not set)"
fi

echo "✅ Trieve smoke test complete"
```

---

## 7. Resumo das Ações

| # | File | Ação | Prioridade |
|---|------|------|------------|
| 1 | `PORTS.md` | Adicionar `:6435 → Trieve (RAG API)` | **HIGH** |
| 2 | `.env.example` | Adicionar `TRIEVE_API_KEY`, `TRIEVE_URL`, `TRIEVE_COLLECTION` | **HIGH** |
| 3 | `AGENTS.md` | Adicionar seção RAG & Memory Stack | MEDIUM |
| 4 | `SPEC-092.md` | Remover referência Trieve Cloud, fix docker-compose tag | MEDIUM |
| 5 | `smoke-tests/` | Criar `smoke-trieve.sh` | LOW (futuro) |

---

## 8. Out of Scope (Confirmado pelo SPEC-092)

- Multi-usuário / ACLs
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
