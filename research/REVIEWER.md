# REVIEWER Report — SPEC-092 Trieve RAG Integration

**Data:** 2026-04-23
**Reviewer:** Claude Code (REVIEWER agent)
**Spec:** SPEC-092-trieve-rag-integration.md
**Status:** DRAFT

---

## 1. Key Findings

### 1.1 SPEC Status: DRAFT — Pending Approval

O SPEC-092 está marcado como `draft` no frontmatter e listando William como "Review". Não há evidências de que foi implementado ou aprovado.

### 1.2 Trieve Maintenance Concern (⚠️ MEDIUM RISK)

| Aspecto | Finding |
|---------|--------|
| **Última release** | `trieve-helm-0.2.2` — Março 2025 (13+ meses atrás) |
| **Commits** | 5,608 (vs 2.6k estrelas no GitHub) |
| **Docker images** | `trieve/server`, `trieve/chat`, `trieve/ingest`, `trieve/file_worker` — todas com 0 stars oficiais |
| **Verdict** | Trieve parece menos ativo que o reivindicado. 13 meses sem release é preocupante para um projeto "production-ready" |

**Recomendação:** Validar se Trieve ainda está em desenvolvimento ativo antes de investir 6-9h de implementação. Alternativas: [Quivr](https://github.com/QuivrHQ/quivr) (21k stars, mais ativo) ou построить RAG custom com FastAPI + Qdrant.

### 1.3 Qdrant Network Topology (❌ ISSUE)

O SPEC usa `http://10.0.9.1:6333` para Qdrant, mas a infraestrutura real é diferente:

| Rede | Range | Qdrant |
|------|-------|--------|
| Coolify network | `10.0.19.x` | ✅ Qdrant container lá |
| docker0 | `10.0.1.x` | Ollama |
| mcp-memory network | `10.0.13.2` | Qdrant acessível via container |

**Teste realizado:**
```bash
curl http://localhost:6333/health  # FALHOU
curl http://10.0.19.5:6333/health  # FALHOU (Qdrant não neste IP)
docker inspect qdrant-c95x9bgnhpedt0zp7dfsims7 # IP: 10.0.13.2
```

**mcp-memory está OK** usando `http://127.0.0.1:6333` dentro do container Docker. Qdrant real está em `10.0.13.2:6333` (no mcp-memory network).

### 1.4 Conflito de collections Mem0 vs Trieve (⚠️ RISK)

| Componente | Collection | Status |
|-----------|------------|--------|
| mcp-memory (Mem0) | `will` | ✅ OK |
| Trieve (proposto) | `trieve` | ❌ diferente do Mem0 — OK |

O SPEC menciona "Collections separadas: `mem0` vs `trieve`" — isso está correto e mitiga o risco.

### 1.5 API Endpoint Mismatch (❌ ISSUE)

O SPEC assume endpoints `/api/v1/` (padrão REST), mas os docs reais mostram:

| Operation | SPEC | Docs Trieve |
|-----------|------|-------------|
| Adicionar chunk | `/api/v1/chunks` | `/api/chunk` |
| Dataset ID header | Bearer token | `TR-Dataset` (UUID) |
| Health | `/health` | Não confirmado nos docs |

**Verificar:** `https://api.trieve.ai/llms.txt` para API completa.

### 1.6 Existing RAG Infrastructure

| Componente | Status | Notes |
|-----------|--------|-------|
| mcp-memory (Mem0) | ✅ ACTIVE | Porta 4016, MCP server, colecao "will" |
| Qdrant | ✅ ACTIVE (Coolify) | Container `qdrant-c95x9bgnhpedt0zp7dfsims7` |
| Ollama embeddings | ✅ ACTIVE | `nomic-embed-text:latest` disponível |
| SPEC-074 (Second Brain) | ✅ ACTIVE | draft origin, mas implementação Mem0 existe |
| RAG flow (data-flow.md) | ✅ EXISTS | LiteLLM → Qdrant → context |

**Conclusão:** Já existe pipeline RAG básico usando Mem0+Qdrant. Trieve seria uma CAMADA ADICIONAL, não substituição.

### 1.7 Port 6435 — Available ✅

Porta livre na faixa 4002-4099. Nenhum serviço em uso.

### 1.8 Herme Agent Integration — No Existing Skill

O SPEC propõe criar skill `rag-retrieve` para Hermes, mas:
- AGENTS.md não menciona RAG ou retrieval skills
- Não há referência a Trieve em nenhum agent skill existente
- Hermes Agency (apps/hermes-agency) não tem código de RAG

---

## 2. Specific Recommendations

### 2.1 Update PORTS.md — Required Before Deploy

Adicionar entrada para Trieve (assim que decidido):

```markdown
| Trieve  | Docker     | 6435   | RAG API (chunking + search)     |
```

### 2.2 Update SUBDOMAINS.md — Only If Public

Se Trieve for exposto (não recomendado para v1 — CLI-only):
```markdown
| trieve.zappro.site | 6435 | PLANNED | Trieve RAG API |
```

### 2.3 Consider Alternative: Custom RAG Pipeline

Dado que:
1. Mem0 já faz semantic search
2. Qdrant já existe
3. Ollama embeddings já disponíveis
4. mcp-memory já existe

**Opção mais simples:** Criar um novo MCP server `mcp-rag` que:
- Usa Ollama para embeddings (mesmo model, e5-mistral)
- Busca em Qdrant collection separada (`rag-docs`)
- Retorna chunks para injeção no context

**Vantagem:** Mais control, menos dependência externa, mesmo tempo de desenvolvimento.

### 2.4 Embedding Model Consistency

O SPEC propõe `nomic-ai/e5-mistral-7b-instruct` mas mcp-memory usa `sentence-transformers/all-MiniLM-L6-v2` (via Mem0 config).

**Recomendação:** Padronizar em `nomic-ai/e5-mistral-7b-instruct` para todos os embeddings do sistema.

### 2.5 Dataset Sources — Clarify Paths

O SPEC lista:
```
hermes-second-brain/docs/
monorepo/docs/SPECS/
/srv/ops/ai-governance/
```

Mas `hermes-second-brain` é um repo Git separado (Gitea), não um diretório local. Precisaria de:
1. Clone do repo
2. Path correto para docs dentro do repo
3. Sync strategy para manter index atualizado

---

## 3. Code/Config Examples

### 3.1 Corrected docker-compose fragment

```yaml
services:
  trieve:
    image: trieve/server:latest
    container_name: trieve
    ports:
      - "6435:3000"
    environment:
      - QDRANT_URL=http://10.0.13.2:6333  # IP real do Qdrant no docker network
      - QDRANT_COLLECTION=trieve
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
      - EMBEDDING_MODEL=nomic-ai/e5-mistral-7b-instruct
      - RERANK_MODEL=BAAI/bge-reranker-base
      - DATABASE_URL=sqlite:///srv/data/trieve/trieve.db
    volumes:
      - /srv/data/trieve:/run/trieve
    restart: unless-stopped
    network_mode: mcp-memory_net  # Ou criar network específica
```

### 3.2 Hermes rag-retrieve skill (pseudo-code)

```typescript
// apps/hermes-agency/src/skills/rag-retrieve.ts
// (Adicionar ao existing skills/index.ts)

const TRIEVE_URL = process.env.TRIEVE_URL ?? 'http://localhost:6435';
const TRIEVE_API_KEY = process.env.TRIEVE_API_KEY;

async function ragRetrieve(query: string, topK = 5): Promise<string[]> {
  const response = await fetch(`${TRIEVE_URL}/api/chunk/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TRIEVE_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ query, limit: topK })
  });

  if (!response.ok) throw new Error(`Trieve API error: ${response.status}`);

  const data = await response.json();
  return data.results.map((r: any) => r.chunk.chunk_html);
}
```

---

## 4. Changes to SPEC

### 4.1 Adicionar/Atualizar

| Item | Action | Notes |
|------|--------|-------|
| Network topology | UPDATE | Usar IP correto do Qdrant (`10.0.13.2`) |
| API endpoints | VERIFY | Confirmar `/api/v1/` vs `/api/` pattern |
| Maintenance status | ADD | Disclaimer sobre activity do Trieve |
| Dataset paths | CLARIFY | `hermes-second-brain` = Gitea repo, não path local |
| RAG vs Mem0 distinction | ADD | Trieve = document retrieval, Mem0 = memory/preferences |

### 4.2 Deletar

| Item | Reason |
|------|--------|
| Referência a `/api/v1/` como certo | Precisa verificação |
| IP `10.0.9.1` para Qdrant | IP não existe na rede |

### 4.3 Acceptance Criteria — Add

```markdown
- [ ] Validar que Trieve ainda está em desenvolvimento ativo (commits 2026)
- [ ] Testar API endpoints com versão atual do Trieve
- [ ] Confirmar Qdrant connection string correta
```

---

## 5. Summary

| Aspect | Verdict |
|--------|---------|
| **Concept** | ✅ Sound — RAG pipeline é valoroso |
| **Trieve choice** | ⚠️ Caution — maintenance parece baixa |
| **Architecture** | ⚠️ Issues — IP wrong, API endpoints need verification |
| **Existing infra** | ✅ Good — Qdrant, Ollama, Mem0 já existem |
| **Timeline** | Realista (6-9h para todas as fases) |
| **Riscos** | Médios — Trieve maintenance, Qdrant network confusion |

**Recomendação:** APROVAR com condições:
1. Validar Trieve activity recente antes de começar
2. Corrigir network topology (IP do Qdrant)
3. Verificar API endpoints com versão real
4. Ou considerar custom RAG pipeline (mesmo effort, menos dependência)

---

## 6. References Checked

- [x] PORTS.md (6435 livre ✅)
- [x] SUBDOMAINS.md (não mencionado ✅)
- [x] AGENTS.md (sem Trieve/RAG skill ✅)
- [x] SPEC-074 (Mem0 active, diferente propósito ✅)
- [x] docker-compose.yml (mcp-memory rodando ✅)
- [x] Qdrant health (UP via docker network ✅)
- [x] Ollama embeddings (nomic-embed-text disponível ✅)
- [x] Trieve GitHub (last release March 2025 ⚠️)
- [x] Trieve Docker images (existem ✅)
