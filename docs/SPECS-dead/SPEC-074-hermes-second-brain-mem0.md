# SPEC-074 — Hermes Second Brain com Mem0

**Data:** 2026-04-18
**Autor:** William Rodrigues
**Status:** Draft
**Review:** Claude Code CLI (não 14-agent pipeline)

---

## 1. Resumo

Repositório `hermes-second-brain` — memória persistente do Hermes Agent.
Stack: **Mem0** (core) + **Qdrant** (backend) + **SQLite** (tasks) + **Ollama E5-mistral** (embeddings).
Arquitetura enterprise (inspirada em GAIA + Mem0), simples de manter.

---

## 2. Por que Mem0 (e não custom)

| Opção | Esforço | Manutenção | Decisão |
|-------|---------|------------|---------|
| Custom (SPEC-073) | 3-4 semanas | Alta — código seu | ❌ Descartado |
| **Mem0** | 2-3 dias integrar | Baixa — 53k⭐, ativo | ✅ Escolhido |

**Mem0 faz o que precisamos:**
- `mem0.add()` — salvar memória
- `mem0.search()` — busca semântica (ANN)
- `mem0.get()` — recuperar por ID
- `mem0.delete()` — remover
- Backend: Qdrant, SQLite, PostgreSQL (troca via config)
- Embeddings: Ollama (E5-mistral 100% offline)

Qdrant já está deployado em `:6333`. Mem0 usa ele como backend.

---

## 3. Arquitetura

```
hermes-second-brain/
├── libs/
│   └── memory/               # Wrapper thin em volta do Mem0
│       ├── __init__.py       # exporta MemoryManager
│       ├── config.py         # QDRANT_URL, OLLAMA_URL, collection
│       └── manager.py        # fachada Mem0 + helpers Hermes
│
├── apps/
│   ├── api/                 # FastAPI — só expõe o que Hermes precisa
│   │   ├── main.py
│   │   ├── router_memory.py
│   │   └── router_tasks.py
│   └── cli/                  # CLI tools p/ Hermes Agent
│       ├── memory_commands.py
│       └── task_commands.py
│
├── services/
│   └── qdrant/              # docker-compose fragment (JÁ EXISTS em :6333)
│
├── skills/
│   └── librarian/           # SKILL.md p/ Hermes
│       └── SKILL.md
│
├── docker-compose.yml       # dev: api + qdrant + grafana (opcional)
├── docker-compose.prod.yml  # prod: api + qdrant
├── pyproject.toml          # hatchling
├── .env.example
└── README.md
```

**Integração com Hermes monorepo:**
```
hermes/tools/librarian/
├── memory_tools.py   → apps/cli/memory_commands.py
└── task_tools.py     → apps/cli/task_commands.py
```
Hermes instala via `pip install -e /path/to/hermes-second-brain`.

---

## 4. Comandos

### 4.1 `/memory`

```
/memory save <texto> [tag1 tag2]    # Salva no Mem0 → Qdrant
/memory query <pergunta>             # Semantic search (Mem0 → Qdrant)
/memory list                         # Lista últimas 10
/memory get <id>                     # Retrieve específico
/memory delete <id>                  # Remove
```

### 4.2 `/task`

```
/task new <título>              # Nova task (pending)
/task list                      # Lista pending
/task done <id>                 # Marca done
/task edit <id> <título>        # Edita título
/task delete <id>               # Remove
/task stats                     # pending vs done
```

---

## 5. Configuração

```bash
# .env (hermes-second-brain)
MEM0_BACKEND=qdrant
QDRANT_URL=http://localhost:6333
QDRANT_COLLECTION=will          # collection default
OLLAMA_URL=http://localhost:11434
OLLAMA_MODEL=nomic-ai/qwen2.5:3b
TASKS_DB_PATH=/srv/data/librarian/tasks.db
```

```python
# libs/memory/config.py
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    backend: str = "qdrant"
    qdrant_url: str = "http://localhost:6333"
    qdrant_collection: str = "will"
    ollama_url: str = "http://localhost:11434"
    ollama_model: str = "nomic-ai/qwen2.5:3b"
    tasks_db_path: str = "/srv/data/librarian/tasks.db"
```

---

## 6. Schema de Dados

### Qdrant Collection (`will`)

O Mem0 gerencia isso automaticamente. Payload exposto:

```json
{
  "text": "conteúdo da memória",
  "tags": ["empresa", "hvac"],
  "source": "manual",
  "created_at": "2026-04-18T..."
}
```

### SQLite Task Board

```sql
CREATE TABLE tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    status     TEXT DEFAULT 'pending',
    project    TEXT,
    tags       TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    done_at    TEXT
);
```

---

## 7. Dependências

```toml
# pyproject.toml
[project]
dependencies = [
    "mem0ai>=0.1.0",
    "qdrant-client>=1.7.0",
    "fastapi>=0.115.0",
    "uvicorn[standard]>=0.30.0",
    "pydantic-settings>=2.0.0",
    "rich>=13.0.0",
    "httpx>=0.27.0",
    "sqlalchemy>=2.0.0",
]
```

**E5-mistral via Ollama:** `ollama pull nomic-ai/qwen2.5:3b`

---

## 8. Progresso NVMe Gen5

| Componente | Crescimento/dia |
|------------|-----------------|
| Memórias (Qdrant, vectors 1024-float16) | ~10-20MB |
| Task board SQLite | ~5MB/dia |
| **Total** | **~25MB/dia máx** |

NVMe Gen5 4TB = ~178 anos. Sem preocupação.

---

## 9. Roadmap por Fase

```
FASE 1 — Hoje
  └── hermes-second-brain v1
      ├── Mem0 + Qdrant + SQLite
      ├── /memory + /task CLI
      ├── FastAPI mínima
      └── SKILL.md p/ Hermes

FASE 2 — Refrimix
  └── Jarvis: Hermes navega Ubuntu
      ├── Cron jobs lendo planilhas
      ├── Dashboard Telegram (obras/orçamentos)
      └── Context: obra + cliente + técnicos

FASE 3 — Zappro + Comunidade
  ├── Zappro.site: chatbot manuais (Qdrant)
  ├── WhatsApp bot Go (técnicos leigos)
  └── VRF Community (membros pagam)
```

---

## 10. Out of Scope v1

- Multi-usuário / ACLs (single-user: William)
- Sync Obsidian / Notion
- Neo4j / knowledge graph
- PostgreSQL (SQLite por ora)
- OAuth / API auth (single-user)

---

## 11. Verification

```bash
# Qdrant OK
curl http://localhost:6333/health

# Ollama OK
curl http://localhost:11434/api/tags

# E5-mistral
ollama list | grep e5

# Mem0 smoke
python -c "from mem0 import Mem0; m = Mem0(); print(m.search('test'))"

# Tasks DB
ls -lh /srv/data/librarian/tasks.db
```
