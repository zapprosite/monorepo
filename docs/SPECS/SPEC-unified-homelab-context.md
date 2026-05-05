# SPEC-UHC-001 — Unified Homelab Context Architecture (UHCA)

> **Status:** APPROVED — Architecture Definition  
> **Date:** 2026-05-05  
> **Classificação:** SRE Architecture (Senior)  
> **Escopo:** Definição arquitetural definitiva do sistema de contexto inteligente do homelab  
> **Versão:** 1.0  
> **Padrão de referência:** SRE Architecture Patterns 05/2026  

---

## 1. Declaração Arquitetural

**O sistema de contexto do homelab é um produto, não um script.** Não admite dívida técnica, forks temporários, ou "vamos ver se funciona". Cada decisão aqui é irreversível e fundamentada.

### 1.1 Posição Arquitetural

O homelab opera 3 repositórios, 22 containers, 4 backends distintos, e 2 runtimes de agent (Go swarm + Python API). Sem um **sistema de contexto unificado**, cada sessão de agent reinventa a descoberta, gasta 30% dos tokens em navegação, e comete erros por desconhecimento da infraestrutura real.

**A arquitetura UHCA resolve isso com 3 princípios imutáveis:**

1. **Single Source of Truth (SSOT):** Um único grafo de conhecimento indexa todos os repos, serviços, e documentos. Não há replicação tolerada.
2. **Separação de Responsabilidades Motor/API:** O motor de processamento (Go) não mistura protocolo de entrada (Python FastAPI). Cada camada tem SLA próprio.
3. **Observability-First:** Todo componente expõe métricas, health checks, e traces antes de ser considerado "deployed".

---

## 2. Padrões SRE 05/2026 — Como Aplicamos

| Padrão SRE | Definição Canônica | Aplicação UHCA |
|------------|-------------------|----------------|
| **SSOT (Single Source of Truth)** | Um único sistema mantém o estado correto; leituras são cache, não fonte | Qdrant `hermes-context` é o único index vetorial. TREE.md é derivado, nunca editado. |
| **Blast Radius Containment** | Falha em um componente não derruba o sistema todo | Swarm Go e Hermes API rodam em processos separados. Qdrant caído → Hermes responde 503, não crasha. |
| **Observability-First (Golden Signals)** | Latência, Tráfego, Erros, Saturação (LTES) em todo serviço | Cada endpoint /context expõe: p95 latência, req/min, error rate, tokens/saturação. Prometheus scrape obrigatório. |
| **GitOps** | Infra e config declarativa versionada em git | docker-compose.yml, systemd units, e regras de sync são git-tracked. Nada é configurado manualmente no host. |
| **Infra as Code (IaC)** | Terraform/Compose para provisionamento | `/srv/ops/` mantém IaC. `/srv/monorepo/` e `/srv/hermes-second-brain/` não provisionam infra — consomem. |
| **Circuit Breaker** | Falha cascata evitada por isolamento automático | `internal/circuitbreaker/breaker.go` (3-state) protege Qdrant, Ollama, e Redis. |
| **Graceful Degradation** | Serviço degradado vale mais que serviço morto | Se Ollama cai, sync usa último hash conhecido (cache Redis). Se Qdrant cai, API retorna TREE.md estático. |
| **Immutable Infrastructure** | Artefatos não são modificados após deploy | Docker images com SHA lock. Go binaries com version tag. Nunca `latest`. |

---

## 3. Arquitetura Definitiva

### 3.1 Diagrama de Contexto (C4 Level 1)

```
┌──────────────────────────────────────────────────────────────────────┐
│                         AGENT (Claude/Cursor)                        │
│  "Como funciona o auth do CRM?"                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ HTTP POST /context
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    HERMES API — Python/FastAPI                       │
│  :8642  —  REST Gateway                                              │
│  Responsabilidade: Protocolo, Auth, Rate Limit, Serialização         │
│  SLA: p95 < 100ms, 99.9% uptime                                      │
└──────────────────────────────┬───────────────────────────────────────┘
                               │ gRPC/HTTP interno :8643
                               ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    SWARM ENGINE — Go                                 │
│  :8643  —  Context Processor                                         │
│  Responsabilidade: Embed, Search, Rank, Compact                      │
│  SLA: p95 < 200ms, throughput > 50 req/s                             │
│                                                                      │
│  ├─ DAG Executor (ExecutionGraph)                                    │
│  ├─ 3-Layer Memory (Redis hot / Qdrant vector / SQLite cold)         │
│  ├─ RAG Pipeline (chunker → verifier → refiner)                      │
│  ├─ 9 Agents (intake, classifier, ranking, response...)              │
│  └─ Circuit Breaker (Qdrant, Ollama, Redis)                          │
└──────────────────────────────┬───────────────────────────────────────┘
                               │
           ┌───────────────────┼───────────────────┐
           ▼                   ▼                   ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   Redis       │    │   Qdrant      │    │   SQLite      │
│  :6379        │    │  :6333        │    │  (cold)       │
│  Cache/Sync   │    │  Vectors      │    │  Audit/Logs   │
│  State/DLQ    │    │  hermes-context│   │  Billing      │
└───────────────┘    └───────────────┘    └───────────────┘
```

### 3.2 Diagrama de Containers (C4 Level 2)

```
┌─────────────────────────────────────────────────────────────────────┐
│                         REPOS (Git-tracked)                          │
│                                                                      │
│  /srv/monorepo/          /srv/hermes-second-brain/   /srv/ops/      │
│  ├── apps/api (TS)       ├── apps/api (Python)       ├── tf/        │
│  ├── apps/web (React)    ├── libs/                   ├── scripts/   │
│  ├── internal/ (Go)      ├── services/               ├── docs/      │
│  ├── packages/           └── docs/                    └── compose/   │
│  └── docs/                                                           │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼ sync-engine (Go)
┌─────────────────────────────────────────────────────────────────────┐
│                         TREE-SITTER AST PARSER                       │
│  Input: .py, .ts, .tsx, .js, .go, .md, .yml                        │
│  Output: Symbols, Imports, Exports, Dependencies, ServiceGraph       │
│  Biblioteca: nexus_repo_map.py (portada para Go)                    │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         EMBEDDING ENGINE                             │
│  Modelo: nomic-embed-text:latest (Ollama :11434)                     │
│  Dimensão: 768D                                                      │
│  Batch: async pool de 4 workers                                      │
│  Cache: content-hash SHA-256 em Redis (skip se unchanged)           │
└─────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         QDRANT — hermes-context                      │
│  Schema:                                                             │
│    id: UUID (SHA-256 do path)                                        │
│    vector: float[768]                                                │
│    payload: {repo, path, doc_type, content_hash, symbols[], content} │
│  Index: payload.repo (keyword), payload.doc_type (keyword)          │
│  Distance: Cosine                                                    │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.3 Data Flow — Query Path

```
1. Agent envia query: "auth flow"
   ↓
2. Hermes API recebe POST /context
   Valida: budget_tokens (200-8000), scope (repos), agent_id
   Rate limit: token bucket, 10 req/min por IP
   ↓
3. Delega ao Swarm Engine (:8643)
   ↓
4. Swarm Engine:
   a. Embed query via Ollama (768D) — <50ms
   b. Hybrid Search Qdrant:
      - Dense: cosine similarity no vector da query
      - Sparse: BM25 no texto do payload
      - Fusion: RRF (Reciprocal Rank Fusion) — top_k=25
   c. Rank:
      - Build graph real de imports (tree-sitter edges)
      - PageRank nos resultados
      - Boosts: recency (1.3x <1d), type (spec/code/service), agent frequency
   d. Compact:
      - Greedy token packing até budget
      - Markdown formatado com sources
   ↓
5. Retorna ao Hermes API
   ↓
6. Hermes API responde ao Agent:
   { context: "# Contexto...", sources: [...], tokens_used, tokens_budget }
```

### 3.4 Data Flow — Sync Path

```
1. Trigger: cron 5min OU git pre-commit hook OU manual
   ↓
2. sync-engine (Go):
   a. Git ls-files em cada repo (monorepo, hermes, ops)
   b. Para cada arquivo:
      - Calc SHA-256 do conteúdo
      - Check Redis: hash já existe? → skip (80% dos arquivos)
      - Se novo/modificado:
        * Parse AST (tree-sitter)
        * Extract: symbols, imports, exports, doc_type
        * Chunk (se doc/spec) ou signature (se code)
        * Embed via Ollama
        * Upsert Qdrant com content_hash
   c. Docker ps → service graph
   d. Delete orphans: pontos no Qdrant com path que sumiu do git
   ↓
3. Gera /srv/TREE.md (markdown tree unificado)
   ↓
4. Atualiza métricas Prometheus:
   hermes_sync_duration_seconds, hermes_sync_files_total, hermes_sync_skipped_total
```

---

## 4. Decisões Arquiteturais Irreversíveis (ADRs)

### ADR-UHC-001: Go Swarm é o Motor de Contexto Único
**Decisão definitiva:** Todo processamento pesado de contexto (embed, search, rank, RAG) executa no runtime Go (`internal/swarm/`). Hermes Python (`apps/api/`) é estritamente uma camada de protocolo REST.

**Justificativa:**
- Go swarm já possui: DAG executor, 3-layer memory, 9 agents, RAG pipeline, circuit breaker — tudo testado e pronto.
- Reescrever em Python seria reimplementar ~8.000 LOC com performance inferior (GIL, memória maior).
- Separação de responsabilidades: Python faz I/O (HTTP), Go faz CPU (embed/rank).

**Trade-off aceito:** Time to deploy é maior (precisa fixar ambiente Go). Ganho: runtime estável, baixa latência, baixo footprint.

**Anti-pattern rejeitado:** "Motor em Python porque a equipe conhece Python melhor." Conhecimento de linguagem é superado por existência de motor funcional.

### ADR-UHC-002: Tree-sitter é o Parser Obrigatório
**Decisão definitiva:** Toda extração de símbolos usa tree-sitter AST real. Regex-based parsing é proibido em produção.

**Justificativa:**
- Tree-sitter extrai: classes, funções, métodos, arrow functions, interfaces, types, enums, imports, exports, scopes aninhados.
- Regex falha em: decorators, generics, template literals, nested functions, default exports.
- `nexus_repo_map.py` já existe e funciona. Será portado para Go como biblioteca `internal/ast/`.

**Trade-off aceito:** Overhead de parser (2-5ms por arquivo) é aceitável para precisão. Cache de hash elimina re-parse de arquivos inalterados.

### ADR-UHC-003: Qdrant é a Única Fonte Vetorial
**Decisão definitiva:** Um único cluster Qdrant (:6333) serve todos os vetores do homelab. Collections por domínio, não por serviço.

**Collections canônicas:**
| Collection | Domínio | Retenção |
|------------|---------|----------|
| `hermes-context` | Repo-maps, docs, SPECs, service-graph | Permanente |
| `hvac-manuals` | RAG corpus HVAC (PDFs técnicos) | Permanente |
| `mem0` | Memórias de conversa por agent | TTL 90 dias |

**Collections proibidas (zombie):**
- `will` → deletada (dados migrados ou perdidos — era vazia)
- `mem0migrations` → deletada
- `skills` → avaliar se migra para `hermes-context` ou mantém
- `hermes-knowledge` → avaliar se migra ou deleta

**Trade-off aceito:** Single point of failure no Qdrant. Mitigação: ZFS snapshot diário em `/tank/qdrant`, restore <5min.

### ADR-UHC-004: Redis é Cache, Não Fonte
**Decisão definitiva:** Redis (:6379) armazena apenas: cache de embeddings (content-hash), filas de jobs, estados de graph, dirty-sets. Nunca armazena dados primários.

**Justificativa:**
- Redis é efêmero (sem persistência garantida no nosso setup).
- Dados primários (vetores) ficam no Qdrant. Dados de auditoria no SQLite.
- Redis como cache permite: skip de re-embed, job queues rápidas, dirty-set tracking.

**Anti-pattern rejeitado:** "Usar Redis como banco de dados principal." Redis é cache + fila, não DB.

### ADR-UHC-005: Hermes API Não Faz Embed Diretamente
**Decisão definitiva:** O endpoint `POST /context` do Hermes NUNCA chama Ollama diretamente. Sempre delega ao Swarm Engine (:8643).

**Justificativa:**
- Centraliza rate limiting e circuit breaker no swarm.
- Permite batching de embeddings (múltiplas queries agrupadas).
- Facilita fallback: se Ollama cai, swarm retorna erro controlado; Hermes retorna 503 com retry-after.

**Trade-off aceito:** Latência adicional de 1-2ms (hop interno localhost). Ganho: observability centralizada, melhor resource management.

---

## 5. Componentes Definidos

### 5.1 Hermes API (Python/FastAPI) — Camada de Protocolo

**Responsabilidades:**
- Receber requests HTTP de agents (Claude, Cursor, CLI)
- Validar inputs (Pydantic), autenticar (API key futuro), rate limit
- Delegar processamento ao Swarm Engine
- Serializar respostas (JSON, markdown)
- Health checks e métricas Prometheus (`/metrics`)

**NÃO faz:**
- Embed (delega ao swarm)
- Search Qdrant diretamente (delega ao swarm)
- PageRank (delega ao swarm)
- RAG pipeline (delega ao swarm)

**Endpoints:**
| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/context` | POST | Recebe query, retorna contexto otimizado |
| `/context/health` | GET | Health do swarm + Qdrant |
| `/memory/*` | CRUD | Mem0 wrapper (mantido para compatibilidade) |
| `/task/*` | CRUD | Task board SQLite (mantido) |
| `/metrics` | GET | Prometheus metrics |

### 5.2 Swarm Engine (Go) — Camada de Processamento

**Responsabilidades:**
- Embed de queries e documentos (Ollama client)
- Hybrid search Qdrant (dense + sparse + RRF)
- Ranker com PageRank real (grafo de imports)
- Compactação por token budget
- RAG pipeline (chunk, verify, refine)
- Sync engine (indexação contínua dos repos)
- Circuit breaker para dependências externas

**Pacotes:**
| Pacote | Função |
|--------|--------|
| `internal/swarm/` | DAG executor, scheduler, worker pool |
| `internal/memory/` | 3-layer memory (Redis/Qdrant/SQLite) |
| `internal/agents/` | 9 agents especializados |
| `internal/rag/` | Chunker, parser, verifier, refiner |
| `internal/circuitbreaker/` | 3-state breaker |
| `internal/ast/` | Tree-sitter wrapper (novo, portado de Python) |
| `cmd/swarm/` | HTTP server + bootstrap |
| `cmd/sync/` | Sync engine daemon (novo) |

### 5.3 Sync Engine (Go) — Novo

**Onde:** `cmd/sync/main.go`
**O que faz:**
1. Descobre repos via config (`/srv/sync-config.yaml`)
2. Git ls-files → lista de arquivos rastreados
3. Para cada arquivo: check Redis hash → skip se unchanged
4. Parse AST (tree-sitter via `internal/ast/`)
5. Chunk ou extract signatures
6. Embed via Ollama (async pool)
7. Upsert Qdrant (`hermes-context`)
8. Delete orphans (paths que sumiram)
9. Gera `/srv/TREE.md`
10. Expõe métricas Prometheus

**Configuração:**
```yaml
# /srv/sync-config.yaml
repos:
  - name: monorepo
    path: /srv/monorepo
    type: mixed  # go + ts
    scopes: [apps, packages, docs, internal]
    exclude: [node_modules, dist, .turbo]
    frequency: 5m
  - name: hermes
    path: /srv/hermes-second-brain
    type: python
    scopes: [apps, libs, services, docs]
    exclude: [venv, __pycache__]
    frequency: 5m
  - name: ops
    path: /srv/ops
    type: iac
    scopes: []
    exclude: [.git, secrets]
    frequency: 15m

ollama:
  url: http://localhost:11434
  model: nomic-embed-text:latest
  workers: 4

qdrant:
  url: http://localhost:6333
  collection: hermes-context
  api_key: ${QDRANT_API_KEY}

redis:
  url: redis://localhost:6379
  password: ${REDIS_PASSWORD}

tree:
  output: /srv/TREE.md
```

---

## 6. SLIs e SLOs

### 6.1 Service Level Indicators (SLIs)

| SLI | Medição | Instrumento |
|-----|---------|-------------|
| Latência de query | p95 do tempo entre POST /context e resposta completa | Prometheus histogram `hermes_query_duration_seconds` |
| Taxa de sync | Tempo para indexar 500 arquivos | Prometheus gauge `hermes_sync_duration_seconds` |
| Skip rate | % de arquivos pulados por cache hit | Prometheus counter `hermes_sync_skipped_total / hermes_sync_files_total` |
| Disponibilidade | % de tempo que /context/health retorna 200 | Blackbox probe a cada 10s |
| Error rate | % de requests retornando 5xx | Prometheus counter `hermes_requests_total{status=~"5.."}` |
| Token eficiência | tokens_used / tokens_budget médio | Prometheus summary `hermes_context_tokens_used` |

### 6.2 Service Level Objectives (SLOs)

| SLO | Target | Janela |
|-----|--------|--------|
| Latência p95 | < 300ms | 7 dias |
| Disponibilidade | > 99.5% | 30 dias |
| Error rate | < 0.1% | 7 dias |
| Skip rate | > 80% | 1 dia |
| Sync duration (500 arquivos) | < 120s | 1 dia |

### 6.3 Alertas (Página quando quebrar)

| Condição | Severidade | Ação |
|----------|-----------|------|
| Latência p95 > 500ms por 5min | P2 | Escalar swarm workers, check Ollama |
| Error rate > 1% por 2min | P1 | Circuit breaker aberto? Check Qdrant/Redis |
| Sync falhou > 15min | P2 | Check cron, check Ollama disponibilidade |
| Qdrant collection < 100 docs | P3 | Sync parado? Reindex manual |
| Swarm Go DOWN (health falha) | P1 | Restart systemd service, check logs |

---

## 7. Anti-Patterns Proibidos (Arquitetura SRE)

### ❌ AP-001: Múltiplos Syncs Paralelos
**Proibido:** Rodar `sync-engine.py` (Python) e `cmd/sync` (Go) simultaneamente. Causa race condition no Qdrant e TREE.md inconsistente.
**Mitigação:** PID lock no Redis (`SET sync_lock <pid> NX EX 300`).

### ❌ AP-002: Fake Embeddings
**Proibido:** Gerar vetores sintéticos (ex: `[0.5]*768`). Invalida semantic search.
**Mitigação:** `ai-context-sync.sh` foi deletado (Phase 1). Code review rejeita qualquer vetor não gerado por Ollama.

### ❌ AP-003: Regex Parsing em Produção
**Proibido:** Usar regex para extrair symbols de código. Só tree-sitter é aceito.
**Mitigação:** `sync-engine.py` regex parser deletado. `internal/ast/` é a única biblioteca de parse.

### ❌ AP-004: Hardcoded Secrets
**Proibido:** Tokens, keys, ou passwords em código-fonte.
**Mitigação:** CI scan (`scripts/env-vault-sync.sh`) rejeita commit com padrão de secret.

### ❌ AP-005: Motor e API no Mesmo Processo
**Proibido:** Hermes Python chamar Ollama/Qdrant diretamente. Toda chamada pesada passa pelo swarm.
**Mitigação:** Arquitetura de 2 processos. Health check do swarm falha se API tenta bypass.

### ❌ AP-006: Manual Edit de TREE.md
**Proibido:** Editar `TREE.md` manualmente. É output, não input.
**Mitigação:** Pre-commit hook rejeita commit se TREE.md foi modificado manualmente (check git diff).

---

## 8. Disaster Recovery

### 8.1 Cenário: Qdrant Corrompido
1. **Detect:** Health check falha, Qdrant não responde em :6333
2. **Isolate:** Circuit breaker abre. Swarm retorna 503. Hermes retorna TREE.md estático do filesystem.
3. **Recover:** `zfs rollback tank/qdrant@daily-$(date -d yesterday +%Y%m%d)`
4. **Validate:** `curl localhost:6333/collections/hermes-context` → 200, points_count > 0
5. **Restore full:** Se snapshot não resolve, reindex completo: `go run cmd/sync/main.go --once --force`

### 8.2 Cenário: Swarm Go Crash
1. **Detect:** Health check :8643 falha por 3 checks consecutivos
2. **Isolate:** Hermes API detecta 503 do swarm e retorna erro 503 com `Retry-After: 30`
3. **Recover:** `systemctl restart swarm-engine`
4. **Validate:** `curl localhost:8643/health` → 200

### 8.3 Cenário: Ollama Down
1. **Detect:** Embed requests falham, circuit breaker abre após 5 falhas
2. **Isolate:** Swarm para de embedar. Cache Redis serve queries recentes (TTL 1h).
3. **Recover:** `systemctl restart ollama`
4. **Validate:** `curl localhost:11434/api/tags` → lista de models

---

## 9. Estado Atual vs Estado Definido

| Componente | Estado Atual (2026-05-05) | Estado Definido (UHC) | Gap |
|------------|---------------------------|----------------------|-----|
| Motor de contexto | Hermes Python (incompleto) | Swarm Go (completo) | Migrar processamento para Go |
| Parser de código | Regex (sync-engine.py) | Tree-sitter (internal/ast) | Portar nexus_repo_map.py para Go |
| Sync | Python script, só hermes | Go daemon, 3 repos | Criar cmd/sync/main.go |
| Ranker | PageRank fraco (Python) | PageRank real com import graph (Go) | Implementar no swarm |
| Fake embeddings | ai-context-sync.sh gera vetores 0.5 | Proibido | Deletar script |
| TREE.md | Incompleto (só hermes) | Unificado em /srv/TREE.md | Unificar geração |
| Testes | 0 no Hermes, Go não roda | Go ≥80% passam, Hermes tem smoke tests | Corrigir ambiente Go, escrever tests |
| Infra drift | Serviços DOWN, portas conflitantes | Tudo UP, mapa de portas limpo | Limpar infra |
| Collections Qdrant | 7 collections (2 zombie) | 3-4 collections (0 zombie) | Deletar will, mem0migrations |

---

## 10. Referências

- Go Swarm: `/srv/monorepo/internal/swarm/`
- Hermes HCE v2: `/srv/hermes-second-brain/docs/ARCHITECTURE-v2.md`
- Tree-sitter parser: `/srv/hermes-second-brain/libs/nexus_repo_map.py`
- Monorepo SPEC-302: `/srv/monorepo/docs/SPECS/SPEC-302-monorepo-emergency-to-arte.md`
- Infra governance: `/srv/ops/ai-governance/PORTS.md`, `SUBDOMAINS.md`, `SECRETS_POLICY.md`
- SRE Book (Google): https://sre.google/sre-book/table-of-contents/
- C4 Model: https://c4model.com/

---

*Arquitetura definida não é sugestão. É lei.*
