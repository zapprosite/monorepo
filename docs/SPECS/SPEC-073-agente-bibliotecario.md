# SPEC-073 — Agente Bibliotecário do Hermes (Second Brain)

**Data:** 2026-04-18
**Autor:** William Rodrigues
**Status:** Draft

---

## 1. Resumo & Visão

> _"O segundo cérebro é basicamente uma estrutura aonde você vai colocar todo o contexto da sua empresa, dos seus negócios, dos seus projetos."_ — Bruno Okamoto

O Agente Bibliotecário é a memória persistente e organizacional do Hermes Agent. Ele implementa os três pilares do Second Brain (Contexto, Skills, Rotinas) de forma pragmática:

- **Contexto** → memória semântica injetada automaticamente (hybrid: fixed default + similarity search on-flag)
- **Skills** → templates reutilizáveis de prompts e workflows
- **Rotinas** → automações cron que executam tarefas recorrentes de knowledge management

O agente opera silenciosamente em background, enriquecendo cada conversa do Hermes com memória institucional e histórica.

**Stack:** Qdrant (memória semântica) + SQLite/NVMe (task board) + E5-mistral (embedding) — SEM Mem0, SEM LangChain.

**Embedding:** E5-mistral (1024-dim) via Ollama local — roda 100% offline, sem API externa.

**Contexto híbrido:** Contexto fixo default (`/context set-default`) + similarity search opcional via flag `--recall` ou `+recall`.

---

## 2. Research — Enterprise Patterns

### 2.1 Referências Estudadas

| Projeto | GitHub | Padrões Extraídos |
|---------|--------|------------------|
| **GAIA** | theexperiencecompany/gaia (168⭐) | Nx monorepo, .agents/, .claude/, CLAUDE.md+AGENTS.md, mise task runner, docker profiles, observability (Loki/Grafana/Promtail), pre-commit hooks, healthchecks em todos os containers, CI/CD com GitHub Actions, release-please |
| **Mem0** | mem0ai/mem0 (53k⭐) | pyproject.toml + hatchling, multi-package (openmemory/, server/, cli/), FastAPI server, Alembic migrations, modular apps/, pydantic schemas, qdrant-client direto |
| **OpenMemory** | (sub-projeto do Mem0) | docker-compose minimal (Qdrant + API + Next.js UI), .env.example, .python-version, healthchecks |
| **Hermes Agent** | (referência interna) | tools/ registry pattern, skill_commands.py,ACP transport, trajectory saving, skin_engine |

### 2.2 Padrões Enterprise Adotados

Do GAIA:
- CLAUDE.md + AGENTS.md na raiz — convenções e instruções de agentes
- `.github/workflows/` com lint, test, build, release-please
- Docker profiles (`--profile`) para dev vs prod
- Healthchecks em todos os containers (curl, pg_isready, redis-cli ping)
- Pre-commit hooks (ruff, mypy)
- `.env.example` para todas as variáveis de ambiente
- Session completion protocol (git push mandatory)

Do Mem0:
- pyproject.toml com hatchling (build system moderno)
- Camadas separadas: `libs/` (core), `apps/` (API/CLI), `services/` (infra)
- Pydantic para schemas de entrada/saída
- Migrations com Alembic (para PostgreSQL futuro)
- Modular — cada responsabilidade em pacote separado

---

## 3. Arquitetura do Repositório

### 3.1 Estrutura de Pastas (standalone repo → future monorepo)

```
hermes-second-brain/            # Repo separado (Gitea v1 / GitHub v2)
│
├── CLAUDE.md                   # Convenções de código, stack, comandos
├── AGENTS.md                   # Instruções para agentes (Claude Code, etc)
├── Makefile                    # tarefas make (dev, test, lint, docker)
├── pyproject.toml              # hatchling build system
├── .python-version             # python version pin (3.12)
│
├── .github/
│   └── workflows/
│       ├── ci.yml              # lint + test + type-check
│       ├── release.yml         # release-please + Docker build
│       └── docker-publish.yml   # multi-platform Docker push
│
├── .gitignore                  # Python-first (venv, __pycache__, .env)
├── .dockerignore               # Python-first (venv, __pycache__, node_modules)
├── docker-compose.yml          # dev: qdrant + api + observability
├── docker-compose.prod.yml     # prod: qdrant + api (sem observability)
│
├── .env.example                # todas as vars documentadas
├── .pre-commit-config.yaml     # ruff, mypy, isort
│
├── libs/
│   ├── semantic-memory/         # Core: Qdrant CRUD, embedding, ANN search
│   │   ├── pyproject.toml
│   │   └── src/semantic_memory/
│   │       ├── __init__.py
│   │       ├── client.py       # QdrantClient wrapper (singleton)
│   │       ├── models.py       # Pydantic: Memory, MemoryCreate, MemorySearch
│   │       ├── repository.py   # CRUD operations
│   │       └── services.py     # Business logic
│   │
│   ├── embeddings/             # Embedding model abstraction
│   │   ├── pyproject.toml
│   │   └── src/embeddings/
│   │       ├── __init__.py
│   │       ├── base.py         # EmbeddingModel ABC
│   │       ├── e5_mistral.py   # E5-mistral via Ollama
│   │       └── minilm.py       # MiniLM fallback
│   │
│   └── task-board/             # SQLite task board
│       ├── pyproject.toml
│       └── src/task_board/
│           ├── __init__.py
│           ├── models.py       # Pydantic: Task, Project, Tag
│           ├── database.py     # SQLite connection + session
│           ├── repository.py   # CRUD
│           └── services.py     # Business logic
│
├── apps/
│   ├── api/                    # FastAPI REST + MCP server
│   │   ├── pyproject.toml
│   │   ├── Dockerfile
│   │   ├── .dockerignore
│   │   ├── .env.example
│   │   ├── alembic.ini
│   │   ├── alembic/            # Migrations (PostgreSQL futuro)
│   │   │   ├── env.py
│   │   │   └── versions/
│   │   ├── app/
│   │   │   ├── __init__.py
│   │   │   ├── main.py         # FastAPI app
│   │   │   ├── config.py      # Settings via pydantic-settings
│   │   │   ├── router.py      # /memories, /tasks, /contexts
│   │   │   ├── schemas.py     # Request/Response models
│   │   │   └── mcp_server.py  # MCP protocol handler
│   │   └── tests/
│   │       ├── __init__.py
│   │       ├── test_memories.py
│   │       ├── test_tasks.py
│   │       └── test_contexts.py
│   │
│   └── cli/                    # CLI Hermes (/memory, /task, /context)
│       ├── pyproject.toml
│       └── src/cli/
│           ├── __init__.py
│           ├── main.py         # click CLI entrypoint
│           ├── commands/
│           │   ├── memory.py
│           │   ├── task.py
│           │   └── context.py
│           └── formatter.py    # Rich output formatting
│
├── services/
│   ├── qdrant/                 # Qdrant container config
│   │   └── docker-compose.fragment.yml
│   └── observability/          # Loki + Grafana + Promtail (dev only)
│       ├── loki-config.yaml
│       ├── grafana-provisioning/
│       └── promtail-config.yaml
│
├── skills/                     # Hermès skill definitions
│   └── librarian/
│       ├── SKILL.md
│       └── references/
│           ├── memory-commands.md
│           ├── task-commands.md
│           └── context-commands.md
│
└── README.md                   # Setup + quick start + architecture
```

### 3.2 Arquitetura de Integração com Hermes

```
┌──────────────────────────────────────────────────────────────┐
│                     Hermes Agent (monorepo)                   │
│                                                              │
│  hermes/tools/librarian/                                     │
│  ├── __init__.py → exporta tools p/ registry                │
│  ├── config.py         → Lê QDRANT_URL do .env Hermes       │
│  ├── memory_tools.py   → /memory save|query|list|get|delete│
│  ├── context_tools.py  → /context save|list|get|set-default │
│  └── task_tools.py     → /task new|list|done|edit|delete   │
└────────────────────────────┬────────────────────────────────┘
                             │ Python package (pip install -e)
                             ▼
┌──────────────────────────────────────────────────────────────┐
│              hermes-second-brain (standalone repo)           │
│                                                              │
│  libs/semantic-memory/     libs/embeddings/   libs/task-board│
│       ↕ Qdrant (:6333)         ↕ Ollama         ↕ SQLite    │
│                                   (:11434)    (/srv/data)   │
└──────────────────────────────────────────────────────────────┘
```

**Estratégia de integração:** O `hermes-second-brain` é instalado como package Python (`pip install -e /path/to/hermes-second-brain`). Os tools do Hermes importam dos `libs/` diretamente.

---

## 4. .gitignore (Python-first — baseado em GAIA + Mem0)

```gitignore
# Byte-compiled
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
build/
dist/
*.egg-info/

# Virtual environments
.venv/
venv/
venv311/

# Test / coverage
.tox/
.nox/
.coverage
.coverage.*
.pytest_cache/
htmlcov/
coverage/

# Type checking
.mypy_cache/
.pytype/

# Linting
.ruff_cache/

# IDE
.idea/
.vscode/
*.swp

# Environment
.env
.env.*
!.env.example
!.env.dev

# Database
*.db
*.sqlite
*.sqlite3
!apps/api/alembic/*.sqlite

# Data (NVMe)
/srv/data/
/data/

# Qdrant storage (production)
qdrant_storage/

# Logs
*.log
logs/
**/logs/

# OS
.DS_Store
.DS_Store?

# Node (for any future JS/TS)
node_modules/
.pnpm-store/

# Build artifacts
*.pyc
*.pyo

# Distribution
dist/
build/
out/

# Documentation builds
_site/
.book/

# Jupyter
.ipynb_checkpoints/
*.ipynb

# pre-commit
.pre-commit-config.yaml.lock

# uv lock (committed optionally)
uv.lock
```

---

## 5. .dockerignore (Python-first)

```dockerignore
# Git
.git
.gitignore

# Python
__pycache__
*.py[cod]
*$py.class
.venv
venv
venv311/
.pytest_cache
.mypy_cache
.ruff_cache
.pytype
*.egg-info
dist
build

# Node (se aplicável)
node_modules
.pnpm-store

# IDE
.idea
.vscode
*.swp

# Logs e data
*.log
logs
.env
.env.*
Dockerfile
docker-compose*
.dockerignore

# OS
.DS_Store
.DS_Store?

# Docs
*.md
!README.md

# Test databases
test-db
*.db
*.sqlite
```

---

## 6. docker-compose.yml (Dev)

Inspirado no GAIA (profiles, healthchecks, observability) + OpenMemory (minimal):

```yaml
name: hermes-second-brain

services:
  # ─── Core API ────────────────────────────────────────────
  api:
    profiles: [api, all]
    build:
      context: .
      dockerfile: apps/api/Dockerfile
    environment:
      - PYTHONUNBUFFERED=1
      - PYTHONDONTWRITEBYTECODE=1
      - QDRANT_URL=http://qdrant:6333
      - OLLAMA_URL=http://ollama:11434
      - DATA_DIR=/data
      - LOG_FORMAT=json
      - LOG_COLORIZE=false
    env_file:
      - apps/api/.env
    volumes:
      - ../hermes-second-brain:/app
      - data:/data
    ports:
      - "${API_PORT:-8090}:8090"
    depends_on:
      qdrant:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8090/health"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: on-failure
    networks:
      - hsb_network

  # ─── Qdrant (vector store) ────────────────────────────────
  qdrant:
    image: qdrant/qdrant:v1.14.0
    profiles: [all]
    volumes:
      - qdrant_data:/qdrant/storage
    ports:
      - "${QDRANT_PORT:-6333}:6333"
      - "${QDRANT_GRPC_PORT:-6334}:6334"
    healthcheck:
      test: ["CMD", "/bin/bash", "-c", "cat < /dev/null > /dev/tcp/localhost/6333"]
      interval: 10s
      timeout: 10s
      retries: 5
    restart: unless-stopped
    networks:
      - hsb_network

  # ─── Observability (Dev only) ─────────────────────────────
  loki:
    image: grafana/loki:3.3.2
    profiles: [observability, all]
    ports:
      - "${LOKI_PORT:-3100}:3100"
    volumes:
      - ./services/observability/loki-config.yaml:/etc/loki/local-config.yaml
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    restart: unless-stopped
    networks:
      - hsb_network
    mem_limit: 512m
    cpus: "0.5"

  grafana:
    image: grafana/grafana:11.4.0
    profiles: [observability, all]
    ports:
      - "${GRAFANA_PORT:-4001}:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./services/observability/grafana-provisioning:/etc/grafana/provisioning
    environment:
      GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-changeme}
      GF_USERS_ALLOW_SIGN_UP: "false"
      GF_ANALYTICS_REPORTING_ENABLED: "false"
    restart: unless-stopped
    networks:
      - hsb_network
    mem_limit: 256m
    cpus: "0.5"

volumes:
  qdrant_data:
  data:
  loki_data:
  grafana_data:

networks:
  hsb_network:
    driver: bridge
```

---

## 7. Comandos (Interface do Agente)

### 7.1 `/memory` — Memória Semântica

```
/memory save <texto> [tag1 tag2]       # Salva na memória
/memory query <pergunta>               # Semantic search (ANN, top-5)
/memory list                            # Lista memórias recentes (últimas 10)
/memory get <id>                        # Mostra memória específica
/memory delete <id>                     # Remove memória
/memory stats                           # count, collection size, embedding model
/memory model [e5|mini]                 # Troca embedding model em runtime
```

**Opções de query:**
```
/memory query <pergunta>               # Standard (top_k=5, score>0.7)
/memory query <pergunta> +recall       # Extended (top_k=10, score>0.5)
/memory query <pergunta> --json        # Output JSON (for scripting)
```

### 7.2 `/context` — Contextos Organizacionais (Hybrid)

```
/context save <nome> <texto>            # Salva contexto nomeado
/context list                           # Lista contextos
/context get <nome>                     # Mostra contexto
/context delete <nome>                  # Remove contexto
/context set-default <nome>             # Define como default auto-inject
/context clear-default                  # Remove default
/context search <query>                 # Similarity search em contextos
```

**Comportamento híbrido:**
- `set-default` → contexto injetado automaticamene no system prompt de toda sessão Hermes
- `+recall` flag na query → faz similarity search no Qdrant e injeta top-K memórias relevantes além do default

### 7.3 `/task` — Task Board

```
/task new <título>                      # Nova tarefa (status=pending)
/task list [filtro]                     # pending | done | all (default: pending)
/task done <id>                         # Marca como done
/task edit <id> <novo título>           # Edita título
/task delete <id>                       # Remove tarefa
/task tags <id> add|remove <tag>       # Gerencia tags
/task project <nome>                    # Lista tarefas de projeto
/task projects                          # Lista todos os projetos
/task stats                             # pending vs done, por projeto
```

---

## 8. Schema de Dados

### 8.1 Qdrant Collection (`will`)

```python
# Collection: will
# Vector params: dim=1024 (E5) ou 384 (MiniLM), metric=Cosine, quantization=ScalarFloat16

# Payload:
{
    "text": str,           # conteúdo
    "tags": list[str],     # ["empresa", "projeto-x"]
    "source": str,          # "manual" | "context" | "task" | "cron" | "import"
    "memory_type": str,    # "memory" | "context" | "skill"
    "name": str | None,    # nome do contexto (se for context)
    "created_at": str,      # ISO 8601
    "updated_at": str,      # ISO 8601
}
```

### 8.2 SQLite Task Board (`/srv/data/librarian/tasks.db`)

```sql
CREATE TABLE tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    status     TEXT DEFAULT 'pending',   -- pending | done | cancelled
    project    TEXT,
    tags       TEXT,                     -- JSON array
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    done_at    TEXT
);

CREATE TABLE projects (
    name        TEXT PRIMARY KEY,
    description TEXT,
    created_at  TEXT DEFAULT (datetime('now'))
);

CREATE TABLE tags (
    name   TEXT PRIMARY KEY,
    color  TEXT
);

CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_project ON tasks(project);
```

---

## 9. Embedding Model

### 9.1 E5-mistral (default, 1024-dim)

```python
# Via Ollama local (SEM API externa)
# curl http://localhost:11434/api/embeddings -d '{"model":"nomic-ai/e5-mistral-7b","prompt":"text"}'

# Modelo: nomic-ai/e5-mistral-7b-instruct (Q8_0 GGUF ~4.9GB)
# Download: ollama pull nomic-ai/e5-mistral-7b-instruct
# Dimensão: 1024 (matches E5 default)
# Velocidade: ~300 tok/s em CPU (ou GPU se disponível)
```

### 9.2 MiniLM (fallback, 384-dim)

```python
# Via Ollama local
# curl http://localhost:11434/api/embeddings -d '{"model":"all-MiniLM-L6-v2","prompt":"text"}'

# Modelo:sentence-transformers/all-MiniLM-L6-v2 (onnx, ~90MB)
# Dimensão: 384
# Velocidade: ~1000 tok/s CPU
```

### 9.3 EmbeddingService

```python
class EmbeddingService:
    def __init__(self, model: str = "e5"):
        self.model = model
        self._client = OllamaClient(base_url=OLLAMA_URL)

    def encode(self, texts: list[str]) -> list[list[float]]:
        if self.model == "e5":
            # E5 requires "query: " or "passage: " prefix
            texts = [f"passage: {t}" for t in texts]
        return self._client.embeddings(model=self._model_name, texts=texts)

    def encode_query(self, query: str) -> list[float]:
        # E5 query encoding (different from passage)
        if self.model == "e5":
            query = f"query: {query}"
        return self._client.embeddings(model=self._model_name, texts=[query])[0]
```

---

## 10. Fluxos Principais

### 10.1 Context Auto-Injection (Híbrido)

```
Nova Sessão Hermes
│
├─ LibrarianAgent.get_default_context()
│   → Qdrant: busca name="default" AND source="context"
│   → Se existe: injeta conteúdo no system prompt
│   → Se não: retorna ""
│
├─ Se flag +recall:
│   → SemanticMemory.search(query, top_k=10, score_threshold=0.5)
│   → Formata memórias como contexto adicional
│
└─ System prompt final = [default_context] + [recall_memories]
```

### 10.2 Memory Save Flow

```
/memory save Meus KPIs de Março: MRR 50k, churn 2%
│
→ Validate: text not empty, tags valid
→ EmbeddingService.encode(["passage: Meus KPIs de Março..."])
→ SemanticMemoryRepository.create(
    text=...,
    vector=[...],
    tags=["kpi", "marco"],
    source="manual",
    memory_type="memory",
  )
→ QdrantClient.upsert(collection="will", id=uuid, vector=[...], payload={...})
→ Return memory_id
```

### 10.3 CLI Command Flow

```
/memory query Quem é o CEO?
│
→ SemanticMemoryService.search(
    query="Quem é o CEO?",
    top_k=5,
    score_threshold=0.7,
    model=current_model
  )
→ Format results (Rich tables)
→ Return formatted output
```

---

## 11. Progresso de Crescimento (NVMe Gen5 `/srv/data`)

| Componente | Crescimento/dia | Notas |
|-----------|----------------|-------|
| Memórias Qdrant (vectors 1024-float16) | ~10-20MB | se muitas notas |
| Task board SQLite | ~5MB/dia | se muitas tasks |
| Trajectories (existentes) | ~50MB/dia | já existente |
| **Total** | **~65MB/dia** | 4TB NVMe = ~65k dias (~178 anos) |

---

## 12. Gitea → GitHub Migration (v2)

### 12.1 Repositório Gitea (v1)

- Repo: `gitea.internal/will/hermes-second-brain` (ou similar)
- CI: GitHub Actions (mesmo working outside GitHub via `GITHUB_OUTPUT`)
- Container registry: Coolify internal ou GHCR.io

### 12.2 Migração para GitHub (v2 — futuro)

```bash
# Adicionar remote GitHub
git remote add github https://github.com/<NEW_ORG>/hermes-second-brain.git

# Tag v1.0.0
git tag -a v1.0.0 -m "v1.0.0: Initial Gitea release"
git push github v1.0.0

# Migração oficial
# https://docs.github.com/en/repositories/creating-and-managing-repositories/duplicating-a-repository
git clone --mirror https://gitea.internal/will/hermes-second-brain.git
cd hermes-second-brain.git
git remote set-url --push github https://github.com/<NEW_ORG>/hermes-second-brain.git
git push --mirror
```

**Nota:** A estrutura do repo é agnóstica de hosting — funciona igual em Gitea, GitHub, GitLab.

---

## 13. Out of Scope (v1)

- Multi-usuário / ACLs (single-user: William)
- Sync com Obsidian / Notion (v2)
- Knowledge graph (ANN search é suficiente)
- PostgreSQL (SQLite por agora; Alembic migrations preparadas)
- OAuth / API authentication (single-user)
- Auto-arquivamento de sessões Hermes (trajectory.py existente)

---

## 14. Verification Checklist

```bash
# 1. Qdrant OK
curl http://localhost:6333/health

# 2. Ollama OK
curl http://localhost:11434/api/tags

# 3. E5-mistral instalado
ollama list | grep e5

# 4. Collection existe
curl http://localhost:6333/collections/will

# 5. SQLite OK
ls -lh /srv/data/librarian/tasks.db

# 6. API health
curl http://localhost:8090/health

# 7. Teste completo
make test
make docker-test
```
