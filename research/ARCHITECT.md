# ARCHITECT Research Report: SPEC-092 Trieve RAG Integration

**Data:** 2026-04-23
**SPEC:** SPEC-092 — Trieve RAG Integration
**Autor:** ARCHITECT Agent

---

## 1. Key Findings

### ✅ Infrastructure Readiness

| Componente | Estado | Detalhes |
|------------|--------|----------|
| Qdrant `:6333` | ✅ Opera- cional | Docker proxy em `127.0.0.1:6333`, não precisa de API key localmente |
| Ollama `:11434` | ✅ Opera- cional | Systemd service, `nomic-embed-text:latest` disponível |
| ai-gateway `:4002` | ✅ Opera- cional | OpenAI-compatible facade, `nomic-embed-text` também disponível via `/embeddings` |
| Port range `:4002-4099` | ✅ Livre | Porta `:6435` disponível para Trieve |

### ⚠️ Critical Issues in SPEC-092

1. **Wrong Qdrant URL**: SPEC-092 usa `http://10.0.9.1:6333` — IP de Coolify network não existe na nossa topologia. Qdrant está em `127.0.0.1:6333` via docker-proxy.

2. **Wrong Ollama env var**: SPEC-092 usa `OLLAMA_BASE_URL` — Trieve não usa essa variável. Deve usar `EMBEDDING_SERVER_ORIGIN` para embedding.

3. **Trieve Cloud Sunset**: Trieve Cloud foi descontinuado em Nov 2025. Self-hosting é obrigatório.

4. **Wrong embedding model**: `nomic-ai/e5-mistral-7b-instruct` não está no Ollama. Temos `nomic-embed-text:latest` — usar este.

---

## 2. Trieve Deployment Architecture (Corrected)

### Topologia Correta

```
┌──────────────────────────────────────────────────────────────┐
│                    TRIEVE (Docker)                          │
│                      :6435 → :3000                          │
│                                                              │
│  server (Rust) ────────────────────────────────────────────  │
│  │  • API v1 (/api/v1)                                      │
│  │  • Health check: http://localhost:8090/api/health        │
│  │  • Qdrant connection: localhost:6333                    │
│  │  • Embedding: EMBEDDING_SERVER_ORIGIN → Ollama :11434    │
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
    │ Qdrant │      │  Ollama   │    │  Redis   │
    │ :6333  │      │  :11434   │    │  :6379   │
    └─────────┘      └───────────┘    └──────────┘
         ▲
         │
    ┌─────────────┐
    │   Docker    │
    │   Network   │
    └─────────────┘
```

### docker-compose fragment (Correto)

```yaml
services:
  trieve:
    image: trieve/trieve:latest
    network_mode: host
    ports:
      - "6435:8090"  # API external
      - "6436:5173"  # Dashboard (optional)
      - "6437:5174"  # Search UI (optional)
    environment:
      - QDRANT_URL=http://localhost:6333
      - QDRANT_API_KEY=${QDRANT_API_KEY:-}
      - DATABASE_URL=postgres://postgres:password@localhost:5432/trieve
      - REDIS_URL=redis://localhost:6379
      - EMBEDDING_SERVER_ORIGIN=http://localhost:11434
      - EMBEDDING_SERVER_ORIGIN_BGEM3=http://localhost:11434
      - RERANKER_SERVER_ORIGIN=http://localhost:8080
      - CREATE_QDRANT_COLLECTIONS=true
    volumes:
      - /srv/data/trieve:/run/trieve
      - /srv/data/trieve-db:/var/lib/postgresql/data
    restart: unless-stopped
```

---

## 3. Environment Variables (Canonical)

### Trieve Secrets (.env)

```bash
# Trieve Core
TRIEVE_API_KEY=generate_with_openssl_rand_hex_32
TRIEVE_URL=http://localhost:6435
QDRANT_API_KEY=${QDRANT_API_KEY:-}  # Empty = localhost auth disabled
```

### Embedding Configuration

Trieve usa `EMBEDDING_SERVER_ORIGIN` (não `OLLAMA_BASE_URL`):

| Variável | Valor | Descrição |
|----------|-------|-----------|
| `EMBEDDING_SERVER_ORIGIN` | `http://localhost:11434` | Ollama para embeddings |
| `EMBEDDING_SERVER_ORIGIN_BGEM3` | `http://localhost:11434` | BGE-M3 embeddings |
| `RERANKER_SERVER_ORIGIN` | (optional) | Reranking endpoint |

### Ollama Model

Ollama disponível: `nomic-embed-text:latest` (137M params)

**Se precisar de modelo melhor para embeddings:**
```bash
ollama pull nomic-ai/e5-mistral-7b-instruct
```

⚠️ **Nota:** E5-mistral é ~7B params e consome mais VRAM. `nomic-embed-text` é suficiente para a maioria dos casos.

---

## 4. Qdrant Collection Strategy

### Collections Separation

Para evitar conflito entre Mem0 e Trieve:

| Collection | Usado por | Purpose |
|------------|-----------|---------|
| `mem0` | Mem0 | User preferences/facts |
| `trieve` | Trieve | Document retrieval |
| (default) | Direct Qdrant | ad-hoc |

Trieve cria collections automaticamente com `CREATE_QDRANT_COLLECTIONS=true`.

### Verificar Collections Existentes

```bash
curl -s http://localhost:6333/collections \
  -H "Authorization: Bearer ${QDRANT_API_KEY:-}" | python3 -m json.tool
```

---

## 5. API Integration (Hermes → Trieve)

### Endpoint

```
http://localhost:6435/api/v1
```

### Search Example

```bash
curl -X POST http://localhost:6435/api/v1/search \
  -H "Authorization: Bearer ${TRIEVE_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "como fazer deploy no coolify?",
    "dataset_id": "uuid-do-dataset",
    "limit": 5
  }'
```

### Hermes Skill Pattern

```typescript
// services/rag-retrieve.ts
const TRIEVE_URL = process.env.TRIEVE_URL ?? 'http://localhost:6435';
const TRIEVE_API_KEY = process.env.TRIEVE_API_KEY ?? '';

export async function ragRetrieve(query: string, topK = 5): Promise<string[]> {
  const response = await fetch(`${TRIEVE_URL}/api/v1/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TRIEVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit: topK,
      // dataset_id set at skill initialization
    }),
  });

  if (!response.ok) {
    throw new Error(`Trieve search failed: ${response.statusText}`);
  }

  const data = await response.json();
  return data.results.map((r: { chunk: { content: string } }) => r.chunk.content);
}
```

---

## 6. Updates Necessárias

### AGENTS.md (Add RAG Skill)

```markdown
## Hermes Voice+Vision (SPEC-053)
...
### RAG Integration (SPEC-092)

| Skill | Script | Descrição |
|-------|--------|-----------|
| `rag-retrieve` | `skills/rag-retrieve.ts` | Search Trieve RAG pipeline |

**Environment:**
- `TRIEVE_URL=http://localhost:6435`
- `TRIEVE_API_KEY` (from .env)
```

### PORTS.md (Add Trieve)

Adicionar à tabela **Available Ports (Dev Use)**:

```markdown
| Port | Status | Service |
|------|--------|---------|
| 6435 | RESERVED | Trieve RAG API |
```

Adicionar à tabela **Active Ports**:

```markdown
| Port | Process | Access | Function |
|------|---------|--------|----------|
| 6435 | docker-proxy → trieve | localhost | Trieve RAG API |
```

### .env / .env.example (Add Trieve vars)

```bash
# Trieve RAG (SPEC-092)
TRIEVE_API_KEY=generate_with_openssl_rand_hex_32
TRIEVE_URL=http://localhost:6435
QDRANT_API_KEY=
```

---

## 7. Deployment Steps (Refined)

### FASE 1 — Setup

```bash
# 1. Pull Trieve image
docker pull trieve/trieve:latest

# 2. Create data directories
mkdir -p /srv/data/trieve /srv/data/trieve-db

# 3. Create .env for Trieve
cat >> /srv/monorepo/.env << 'EOF'
TRIEVE_API_KEY=$(openssl rand -hex 32)
TRIEVE_URL=http://localhost:6435
QDRANT_API_KEY=
EOF

# 4. Start Trieve
docker run -d \
  --name trieve \
  --network host \
  -p 6435:8090 \
  -p 6436:5173 \
  -p 6437:5174 \
  -e QDRANT_URL=http://localhost:6333 \
  -e QDRANT_API_KEY \
  -e DATABASE_URL=postgres://postgres:password@localhost:5432/trieve \
  -e REDIS_URL=redis://localhost:6379 \
  -e EMBEDDING_SERVER_ORIGIN=http://localhost:11434 \
  -e EMBEDDING_SERVER_ORIGIN_BGEM3=http://localhost:11434 \
  -e CREATE_QDRANT_COLLECTIONS=true \
  -v /srv/data/trieve:/run/trieve \
  -v /srv/data/trieve-db:/var/lib/postgresql/data \
  --restart unless-stopped \
  trieve/trieve:latest

# 5. Wait and check health
sleep 30
curl -sf http://localhost:6435/api/health || echo "Trieve not ready yet"
```

### FASE 2 — Indexação

```bash
# Get API key from .env
TRIEVE_API_KEY=$(grep TRIEVE_API_KEY /srv/monorepo/.env | cut -d= -f2)

# Create dataset
curl -X POST http://localhost:6435/api/v1/datasets \
  -H "Authorization: Bearer $TRIEVE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "hermes-knowledge", "description": "Hermes Second Brain + SPECs"}'
```

### FASE 3 — Integração

Criar skill `rag-retrieve` em `hermes-second-brain/skills/`.

---

## 8. Risk Assessment (Updated)

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Qdrant collection conflict com Mem0 | **ALTA** | Alto | Collections separadas: `mem0` vs `trieve` (default) |
| Embedding model mismatch | Média | Médio | Usar `nomic-embed-text` que já existe |
| Trieve version incompatibility | Baixa | Alto | Testar com Qdrant 1.7+ (temos 1.12) |
| Context window overflow | Média | Médio | Limitar `top_k=5` chunks |

⚠️ **Aviso:** Mem0 e Trieve vão competir pelo mesmo Qdrant instance. Mitigação: collections separadas via `CREATE_QDRANT_COLLECTIONS=true` (Trieve cria `trieve` collection).

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
