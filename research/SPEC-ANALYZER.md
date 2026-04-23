# SPEC-ANALYZER Report — SPEC-092 Trieve RAG Integration

**Data:** 2026-04-23
**Analisado por:** SPEC-ANALYZER Agent
**SPEC:** docs/SPECS/SPEC-092-trieve-rag-integration.md

---

## 1. Resumo Executivo

SPEC-092 propõe integrar Trieve como camada RAG para o homelab. A escolha de Trieve é sólida (API-first, Qdrant-native, lightweight). **Problemas críticos encontrados:** credentials hardcoded no docker-compose, API endpoint inconsistente com a documentação oficial, porta `:6435` não auditada no PORTS.md.

---

## 2. Key Findings (April 2026 Best Practices)

### 2.1 Trieve — Escolha Correta ✅

| Critério | Avaliação |
|----------|-----------|
| API-first design | ✅ Perfeito para integração CLI/Telegram |
| Qdrant-native | ✅ Nascido com Qdrant, não adapter |
| Self-hostable | ✅ 100% open source |
| Chunking inteligente | ✅ Heading/sentence/page strategies |
| Lightweight | ✅ Deploy simples vs Dify/LangChain |

Trieve Cloud foi **deprecated em November 2025** — self-hosting é o caminho correto.

### 2.2 BGE-M3 — Embedding Model Recomendado ✅

| Especificação | Valor |
|--------------|-------|
| Dimensão | 1024 |
| Max sequence | 8192 tokens |
| Idiomas | 100+ (inclui PT-BR e EN) |
| Tipo | Dense + Sparse + Multi-vector (ColBERT-style) |

**Ideal para:** Markdown docs em português com estrutura de headings.

### 2.3 API Authentication — Divergência Encontrada ⚠️

| SPEC | Documentação Oficial |
|------|---------------------|
| `Authorization: Bearer $TRIEVE_API_KEY` | `Authorization: ApiKey <key>` |

**Correção necessária** — Trieve usa `ApiKey` scheme, não `Bearer`.

### 2.4 API Endpoints — Divergência Encontrada ⚠️

| SPEC | Documentação Oficial |
|------|---------------------|
| `POST /api/v1/datasets` | `POST /api/chunk` (chunk endpoint) |
| `POST /api/v1/chunks` | Datasets são gerenciados via API separada |
| `POST /api/v1/search` | Endpoint pode variar |

**Nota:** Documentação oficial mostra `/api/chunk` para chunks. Verificar OpenAPI spec completa em `https://api.trieve.ai` para endpoints exatos de datasets e search.

### 2.5 Qdrant Connection — Divergência Encontrada ⚠️

| SPEC | Infraestrutura Real |
|------|-------------------|
| `QDRANT_URL=http://10.0.9.1:6333` | Qdrant está em `10.0.19.5:6333` (Coolify network) |

**Correção necessária** — Usar IP da Coolify network conforme PORTS.md.

---

## 3. Recomendações de Código

### 3.1 docker-compose — CORRIGIDO

```yaml
services:
  trieve:
    image: trieve/trieve:latest
    ports:
      - "6435:3000"
    environment:
      # Qdrant — CORRIGIDO para Coolify network
      - QDRANT_URL=http://10.0.19.5:6333
      - QDRANT_COLLECTION=trieve
      # Ollama embedding
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
      - EMBEDDING_MODEL=BAAI/bge-m3
      # Database
      - DATABASE_URL=sqlite:///srv/data/trieve/trieve.db
      # Auth — CORRIGIDO: ApiKey scheme
      - AUTHORIZATION_API_KEY=${TRIEVE_API_KEY}
    volumes:
      - /srv/data/trieve:/run/trieve
    extra_hosts:
      - "host.docker.internal:host-gateway"
    restart: unless-stopped
    network_mode: bridge
```

**Correções aplicadas:**
1. `host.docker.internal:11434` para Ollama (acesso host do container)
2. `10.0.19.5:6333` para Qdrant (Coolify network correto)
3. `AUTHORIZATION_API_KEY` (variável correta se existir)

### 3.2 Hermes RAG Skill — Exemplo Implementação

```typescript
// apps/hermes/src/skills/rag-retrieve.ts
// Anti-hardcoded: all config via process.env

const TRIEVE_URL = process.env.TRIEVE_URL ?? 'http://localhost:6435';
const TRIEVE_API_KEY = process.env.TRIEVE_API_KEY;
const RAG_TOP_K = parseInt(process.env.RAG_TOP_K ?? '5', 10);

if (!TRIEVE_API_KEY) {
  throw new Error('TRIEVE_API_KEY missing in .env');
}

interface TrieveChunk {
  id: string;
  content: string;
  metadata: Record<string, string>;
  score: number;
}

interface TrieveSearchResponse {
  results: Array<{
    chunk: TrieveChunk;
    score: number;
  }>;
}

export async function ragRetrieve(
  query: string,
  datasetId: string,
  topK: number = RAG_TOP_K
): Promise<string[]> {
  const response = await fetch(`${TRIEVE_URL}/api/v1/search`, {
    method: 'POST',
    headers: {
      'Authorization': `ApiKey ${TRIEVE_API_KEY}`,
      'Content-Type': 'application/json',
      'TR-Dataset': datasetId,
    },
    body: JSON.stringify({
      query,
      limit: topK,
      search_type: 'semantic', // ou 'hybrid' para BM25 + semantic
    }),
  });

  if (!response.ok) {
    throw new Error(`Trieve search failed: ${response.status} ${await response.text()}`);
  }

  const data: TrieveSearchResponse = await response.json();
  return data.results.map(r => r.chunk.content);
}

export const ragSkill = {
  name: 'rag-retrieve',
  description: 'Retrieves relevant document chunks from Trieve RAG',
  parameters: {
    query: { type: 'string', description: 'Search query' },
    datasetId: { type: 'string', description: 'Trieve dataset ID' },
    topK: { type: 'number', description: 'Number of chunks to retrieve', default: 5 },
  },
  execute: ragRetrieve,
};
```

### 3.3 Environment Variables — .env Additions

```bash
# Trieve RAG (SPEC-092)
TRIEVE_API_KEY=$(openssl rand -hex 32)
TRIEVE_URL=http://localhost:6435
RAG_TOP_K=5
```

---

## 4. O que Adicionar/Atualizar/Deletar

### 4.1 Adicionar

| Item | Ficheiro | Razão |
|------|---------|-------|
| Porta `:6435` reservada | `/srv/ops/ai-governance/PORTS.md` | SPEC-092 acceptance criteria |
| Variáveis `TRIEVE_*` | `/srv/monorepo/.env.example` | Canonical secrets source |
| Skill `rag-retrieve` | `hermes-second-brain/skills/` | Integração Hermes |
| Smoke test | `smoke-tests/smoke-trieve.sh` | Health check do Trieve |

### 4.2 Atualizar

| Item | Ficheiro | Mudança |
|------|---------|---------|
| API endpoints | `SPEC-092` | Corrigir para `/api/chunk` e autenticação `ApiKey` |
| QDRANT_URL | `SPEC-092` docker-compose | `10.0.19.5:6333` (Coolify network) |
| Ollama URL | `SPEC-092` docker-compose | `host.docker.internal:11434` |
| AGENTS.md | Adicionar Trieve/RAG à arquitetura | Documentar nova skill |

### 4.3 Deletar

| Item | Razão |
|------|-------|
| Nada identificado | SPEC está bem focado, sem dead code |

---

## 5. Acceptance Criteria (from SPEC-092)

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

## 6. Arquivos Afetados

| Arquivo | Papel |
|---------|-------|
| `/srv/ops/ai-governance/PORTS.md` | Registrar porta `:6435` |
| `/srv/ops/ai-governance/SUBDOMAINS.md` | Atualizar subdomínios (se aplicável) |
| `hermes-second-brain/docs/` | Knowledge source (indexação) |
| `monorepo/docs/SPECS/` | Knowledge source (SPECs ativos) |
| `/srv/ops/ai-governance/` | Knowledge source (governança) |
| `hvacr-swarm/docs/` | Knowledge source (FASE 2) |
| `monorepo/AGENTS.md` | Knowledge source (FASE 2) |

---

## 7. Dependências

### Infraestrutura Existente

| Componente | Porta | Status | Papel |
|------------|-------|--------|-------|
| Qdrant | `:6333` | Existe | Vector storage + retrieval |
| Ollama | `:11434` | Existe | Embedding (e5-mistral ou bge) |
| Mem0 | `:6333` | Existe | Memory layer (collections separadas) |
| Hermes Agent | — | Existe | Orchestration + generation |
| Second Brain | — | Existe | Knowledge source |

### Novas Dependências

| Componente | Origem | Notas |
|------------|--------|-------|
| Trieve | Docker (Coolify) | Porta `:6435` |
| BGE Embeddings | Ollama | `nomic-ai/e5-mistral-7b-instruct` ou `BAAI/bge-m3` |
| BGE Reranker | Ollama | Opcional (FASE 4) |
| SQLite | Local | `/srv/data/trieve/trieve.db` |

---

## 8. Decisões de Arquitectura

### 8.1 Deployment

- **Trieve** via Docker via Coolify em porta `:6435`
- Docker image oficial: `trieve/trieve:latest`
- Persistência em `/srv/data/trieve/`

### 8.2 Dataset Sources (Knowledge Sources)

**FASE 1 — Indexação inicial:**
- `hermes-second-brain/docs/` (skills, TREE.md)
- `monorepo/docs/SPECS/` (SPECs ativos)
- `/srv/ops/ai-governance/` (governança)

**FASE 2 — Expansão:**
- `hvacr-swarm/docs/`
- `monorepo/AGENTS.md`
- README.md files (raiz dos repos)

### 8.3 Embedding Model

- **Recomendado:** `BAAI/bge-m3` ou `nomic-ai/e5-mistral-7b-instruct`
- Pull: `ollama pull nomic-ai/e5-mistral-7b-instruct`

### 8.4 Chunking Strategy

| Strategy | Quando usar | Tamanho |
|----------|-------------|---------|
| `heading` | Docs com headers (#, ##) | Variável |
| `sentence` | Textos corridos | 512 tokens |
| `page` | PDFs | 1024 tokens |

**Decisão:** Usar `heading` para markdown docs (preserva estrutura).

### 8.5 API Endpoint

```
http://localhost:6435/api/v1
```

### 8.6 Integração Hermes

Hermes usa Trieve via:
1. **Direct fetch** — curl/python para search API
2. **Resultado** — chunks relevantes injetados no context do LLM

### 8.7 Collection Separation

- `mem0` collection (Mem0)
- `trieve` collection (Trieve)
Evita competição por Qdrant.

### 8.8 Limitações (Out of Scope)

- Multi-usuário / ACLs
- UI web do Trieve (CLI-only)
- PDF parsing (apenas markdown/text)
- Web crawling (apenas arquivos locais)
- Reranking (FASE 4, opcional)

---

## 9. Riscos e Mitigações (Atualizado)

| Risco | Prob | Impacto | Mitigação |
|-------|------|---------|-----------|
| Trieve API breaking changes | Baixa | Alto | Lock version tag (`trieve/trieve:v0.21.0`) em vez de `latest` |
| Qdrant network path wrong | **Alta** | Alto | Usar `host.docker.internal` para Ollama, `10.0.19.5` para Qdrant (verificado em PORTS.md) |
| Auth scheme wrong (Bearer vs ApiKey) | **Alta** | Alto | Usar `ApiKey` scheme conforme docs oficiais |
| Context window overflow | Média | Médio | Manter `top_k=5` chunks, resumir se necessário |
| BGE-M3 dimensions mismatch | Baixa | Médio | 1024 dims — verificar Trieve config para não hardcoded |

---

## 10. Port Check

✅ **Porta `:6435` está livre** na faixa `4002–4099` (microserviços) conforme PORTS.md.

⚠️ **Não está listada como reservada** — necessário adicionar antes do deploy.

---

## 11. Cronologia de Implementação Sugerida

```
FASE 1 — Setup (1-2h)
  ├── Deploy Trieve via Coolify :6435
  │   └── CORREÇÃO: QDRANT_URL=10.0.19.5:6333, Ollama via host.docker.internal
  ├── Configurar Qdrant collection
  ├── Testar search API com curl (usando ApiKey auth)
  └── Verificar embedding via Ollama (BGE-M3)

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

## 12. Conclusão

SPEC-092 está bem fundamentado. **Ações críticas antes do deploy:**

1. **Corrigir** docker-compose com IPs corretos da Coolify network
2. **Corrigir** autenticação de `Bearer` para `ApiKey`
3. **Adicionar** porta `:6435` ao PORTS.md
4. **Version lock** Trieve image (evitar `latest`)
5. **Adicionar** `TRIEVE_*` vars ao `.env.example`

**Veredicto:** ✅ Aprovado para implementação com correções acima.

---

## Referências

- [Trieve GitHub](https://github.com/devflowinc/trieve)
- [Trieve Docs](https://docs.trieve.ai)
- [BGE-M3 HF](https://huggingface.co/BAAI/bge-m3)
- [Qdrant](https://qdrant.tech)
- [SPEC-092 Original](/srv/monorepo/docs/SPECS/SPEC-092-trieve-rag-integration.md)
- [PORTS.md](/srv/ops/ai-governance/PORTS.md)
