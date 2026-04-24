# ARCHITECT Research Report: SPEC-092 Trieve RAG Integration (REVISED)

**Data:** 2026-04-23
**SPEC:** SPEC-092 — Trieve RAG Integration
**Autor:** ARCHITECT Agent
**Status:** CORRECTED — contains critical infrastructure errors

---

## 1. Resumo Executivo

SPEC-092 possui **4 issues críticos** que impedem o deploy:

| # | Issue | Severidade |
|---|-------|-----------|
| 1 | Qdrant URL incorreta (`10.0.9.1` não existe na topologia) | CRÍTICA |
| 2 | Auth scheme divergente (`Bearer` vs `ApiKey`) | CRÍTICA |
| 3 | Ollama URL incorreta (`OLLAMA_BASE_URL` não é variável do Trieve) | ALTA |
| 4 | Embedding model não existente (`e5-mistral-7b-instruct` não está no Ollama) | ALTA |
| 5 | Internal port inconsistente (SPEC: 3000, ARCHITECT: 8090) | MÉDIA |

**Veredicto:** NÃO aprovo para deploy até correção.

---

## 2. Key Findings

### 2.1 Infrastructure Readiness

| Componente | Estado | Detalhes |
|------------|--------|----------|
| Qdrant `:6333` | ✅ Opera- cional | Coolify net `10.0.19.5:6333` — NÃO `10.0.9.1` |
| Ollama `:11434` | ✅ Opera- cional | Systemd service, `nomic-embed-text:latest` disponível |
| ai-gateway `:4002` | ✅ Opera- cional | OpenAI-compatible facade |
| Port range `:4002-4099` | ✅ Livre | Porta `:6435` disponível |

### 2.2 Trieve Cloud Sunset

Trieve Cloud foi **deprecated em November 2025** — self-hosting é o caminho correto. Confirmado.

### 2.3 Auth Scheme — DIVERGÊNCIA CRÍTICA

| Documento | Scheme |
|-----------|--------|
| SPEC-092 | `Bearer` |
| ARCHITECT.md | `Bearer` |
| SPEC-ANALYZER.md | `ApiKey` (conforme docs oficiais) |
| CODER-1.md | `Bearer` |
| CODER-2.md | `Bearer` |

**SPEC-ANALYZER está correto.** Trieve usa `ApiKey` scheme, não `Bearer`.
Correção obrigatória em TODO código.

### 2.4 API Endpoints — Verificar

SPEC-092 menciona:
- `POST /api/v1/datasets`
- `POST /api/v1/chunks`
- `POST /api/v1/search`

SPEC-ANALYZER indica que documentação oficial mostra `/api/chunk` para chunks.
**Verificar OpenAPI spec em `https://api.trieve.ai` antes do deploy.**

### 2.5 Ollama Embedding Variable — ERRADO

SPEC-092 usa `OLLAMA_BASE_URL` — **Trieve não usa essa variável**.
Variáveis corretas para embedding com Ollama:
- `EMBEDDING_SERVER_ORIGIN` (embedding primário)
- `EMBEDDING_SERVER_ORIGIN_BGEM3` (BGE-M3 embeddings)

### 2.6 Embedding Model — NÃO EXISTE

SPEC-092 especifica `nomic-ai/e5-mistral-7b-instruct`.
**Ollama do homelab tem `nomic-embed-text:latest`** — já disponível.

Se quiser BGE-M3:
```bash
ollama pull BAAI/bge-m3
```

---

## 3. Correções Críticas (antes do deploy)

### 3.1 Qdrant URL — CORRIGIR IP

```
ERRADO:  QDRANT_URL=http://10.0.9.1:6333    # IP não existe na topologia
CORRETO: QDRANT_URL=http://10.0.19.5:6333   # Coolify network (conforme PORTS.md)
```

**来源:** PORTS.md linha 192:
> "6333 | qdrant | Coolify net (10.0.19.5) | Containers: `10.0.19.5:6333`"

### 3.2 Auth Scheme — CORRIGIR para ApiKey

```
ERRADO:  Authorization: Bearer ${TRIEVE_API_KEY}
CORRETO: Authorization: ApiKey ${TRIEVE_API_KEY}
```

**Fonte:** SPEC-ANALYZER.md §2.3 — verificado contra documentação oficial Trieve.

### 3.3 Ollama Variable — CORRIGIR variável

```
ERRADO:  OLLAMA_BASE_URL=http://host.docker.internal:11434
CORRETO: EMBEDDING_SERVER_ORIGIN=http://host.docker.internal:11434
```

### 3.4 Embedding Model — Usar disponível

```
ERRADO:  EMBEDDING_MODEL=nomic-ai/e5-mistral-7b-instruct
CORRETO: EMBEDDING_MODEL=nomic-embed-text:latest
```

Ou fazer pull do modelo desejado:
```bash
ollama pull nomic-ai/e5-mistral-7b-instruct
ollama pull BAAI/bge-m3
```

---

## 4. Arquitetura Correta

### 4.1 Topologia

```
┌──────────────────────────────────────────────────────────────┐
│                    TRIEVE (Docker)                            │
│                      :6435 → :3000 (interno)                  │
│                                                              │
│  server (Rust) ──────────────────────────────────────────── │
│  │  • API v1 (/api/v1)                                      │
│  │  • Health check: http://localhost:3000/api/health        │
│  │  • Qdrant connection: 10.0.19.5:6333                    │
│  │  • Embedding: EMBEDDING_SERVER_ORIGIN → Ollama         │
│  │                                                            │
│  ├── qdrant-database (embedded)                             │
│  ├── redis (embedded)                                        │
│  └── postgres db (embedded)                                  │
└──────────────────────────────────────────────────────────────┘
                           │
                           ▼
         ┌─────────────────┬─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐      ┌───────────┐    ┌──────────┐
    │ Qdrant  │      │  Ollama   │    │  Redis   │
    │ :6333   │      │  :11434  │    │  :6379   │
    │10.0.19.5│      │ (host)   │    │          │
    └─────────┘      └───────────┘    └──────────┘
```

### 4.2 docker-compose CORRIGIDO

```yaml
services:
  trieve:
    image: trieve/trieve:latest
    ports:
      - "6435:3000"
    environment:
      - QDRANT_URL=http://10.0.19.5:6333
      - QDRANT_API_KEY=${QDRANT_API_KEY:-}
      - DATABASE_URL=postgres://postgres:password@localhost:5432/trieve
      - REDIS_URL=redis://localhost:6379
      - CREATE_QDRANT_COLLECTIONS=true
      # CORRIGIDO: Variável correta para Ollama
      - EMBEDDING_SERVER_ORIGIN=http://host.docker.internal:11434
      # Para BGE-M3:
      # - EMBEDDING_SERVER_ORIGIN_BGEM3=http://host.docker.internal:11434
      # Embedding model — CORRIGIDO: usar disponível
      - EMBEDDING_MODEL=nomic-embed-text:latest
    volumes:
      - /srv/data/trieve:/run/trieve
      - /srv/data/trieve-db:/var/lib/postgresql/data
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped
    network_mode: bridge
```

### 4.3 Trieve Client — CORRETO

```typescript
// apps/gateway/src/trieve/client.ts
// Anti-hardcoded: all config via process.env

const TRIEVE_URL = process.env['TRIEVE_URL'] ?? 'http://localhost:6435';
const TRIEVE_API_KEY = process.env['TRIEVE_API_KEY'] ?? '';

export interface TrieveChunk {
  id: string;
  content: string;
  score: number;
  metadata: {
    source: string;
    type: string;
  };
}

export async function trieveSearch(
  query: string,
  datasetId: string,
  limit = 5
): Promise<TrieveChunk[]> {
  const response = await fetch(`${TRIEVE_URL}/api/v1/search`, {
    method: 'POST',
    headers: {
      // CORRIGIDO: ApiKey scheme (não Bearer)
      'Authorization': `ApiKey ${TRIEVE_API_KEY}`,
      'Content-Type': 'application/json',
      'TR-Dataset': datasetId,
    },
    body: JSON.stringify({
      query,
      limit,
    }),
  });

  if (!response.ok) {
    throw new Error(`Trieve search failed: ${response.status}`);
  }

  const data = (await response.json()) as { results: TrieveChunk[] };
  return data.results;
}
```

---

## 5. Qdrant Collection Strategy

### Collections Separation

| Collection | Usado por | Purpose |
|------------|-----------|---------|
| `mem0` | Mem0 | User preferences/facts |
| `trieve` | Trieve | Document retrieval |
| `agency_*` | Hermes Agency | ad-hoc knowledge |

**Não há conflito** — collections são namespace-separated.

Trieve cria collections automaticamente com `CREATE_QDRANT_COLLECTIONS=true`.

---

## 6. Updates Necessárias

### PORTS.md — Adicionar Trieve

Adicionar à tabela **Available Ports (Dev Use)**:

```markdown
| Port | Status | Service |
|------|--------|---------|
| 6435 | RESERVED | Trieve RAG API |
```

Adicionar à tabela **Active Ports — Docker Compose**:

```markdown
| Port | Container | Access | Function |
| ---- | --------- | ------ | -------- |
| 6435 | docker-proxy → trieve | localhost | Trieve RAG API |
```

### SUBDOMAINS.md — Adicionar se exposto externamente

```markdown
| Subdomain | Target | Purpose |
| --------- | ------ | -------- |
| trieve.zappro.site | localhost:6435 | Trieve RAG (se exposto) |
```

### .env / .env.example — Adicionar Trieve vars

```bash
# Trieve RAG (SPEC-092)
TRIEVE_API_KEY=$(openssl rand -hex 32)
TRIEVE_URL=http://localhost:6435
QDRANT_API_KEY=
```

---

## 7. Riscos e Mitigações

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Qdrant IP errado | **ALTA** | Alto | Usar `10.0.19.5:6333` conforme PORTS.md |
| Auth scheme errado | **ALTA** | Alto | Usar `ApiKey` scheme conforme docs oficiais |
| Ollama variable errada | **ALTA** | Alto | Usar `EMBEDDING_SERVER_ORIGIN` |
| Embedding model não existe | **MÉDIA** | Alto | Usar `nomic-embed-text:latest` ou fazer pull |
| Trieve API breaking changes | Baixa | Alto | Lock version tag (`trieve/trieve:v0.21.0`) |
| Context window overflow | Média | Médio | Limitar `top_k=5` chunks |

---

## 8. Cronologia de Implementação

```
FASE 1 — Setup (1-2h)
  ├── Deploy Trieve via Docker Compose
  │   └── CORREÇÕES: QDRANT_URL=10.0.19.5:6333, EMBEDDING_SERVER_ORIGIN
  ├── Configurar Qdrant collection
  ├── Testar search API com curl (usando ApiKey auth)
  └── Verificar embedding via Ollama (nomic-embed-text)

FASE 2 — Indexação (2-3h)
  ├── Criar dataset "hermes-knowledge"
  ├── Indexar hermes-second-brain (skills, TREE.md)
  ├── Indexar SPECs ativos do monorepo
  └── Indexar /srv/ops/ai-governance/

FASE 3 — Integração Hermes (3-4h)
  ├── Criar skill `rag-retrieve` (TypeScript)
  ├── Integrar no fluxo de contexto
  ├── Testar retrieval + generation
  └── Documentar workflow

FASE 4 — Expansão (opcional)
  ├── Indexar hvacr-swarm/docs
  ├── Indexar monorepo README.md
  └── Adicionar reranking (BAAI/bge-reranker)
```

---

## 9. Out of Scope Confirmado

- Multi-usuário / ACLs ✅ (single-user)
- UI web ✅ (CLI-only inicialmente)
- PDF parsing ✅ (apenas markdown/text)
- Web crawling ✅ (apenas arquivos locais)
- Reranking ✅ (FASE 4, opcional)

---

## 10. Referências

- [Trieve GitHub](https://github.com/devflowinc/trieve)
- [Trieve Docs](https://docs.trieve.ai)
- [Trieve Self-Hosting](https://docs.trieve.ai/self-hosting/docker-compose)
- [BGE Embeddings](https://huggingface.co/BAAI/bge-m3)
- [Qdrant](https://qdrant.tech)
- [SPEC-ANALYZER.md](../SPEC-ANALYZER.md)
- [CODER-1.md](../CODER-1.md)
- [CODER-2.md](../CODER-2.md)
- [PORTS.md](/srv/ops/ai-governance/PORTS.md)
- [NETWORK_MAP.md](/srv/ops/ai-governance/NETWORK_MAP.md)
