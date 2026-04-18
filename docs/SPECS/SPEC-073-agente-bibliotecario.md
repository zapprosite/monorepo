# SPEC-073 — Agente Bibliotecário do Hermes

**Data:** 2026-04-18
**Autor:** William Rodrigues
**Status:** Draft

---

## 1. Resumo & Visão

> _"O segundo cérebro é basicamente uma estrutura aonde você vai colocar todo o contexto da sua empresa, dos seus negócios, dos seus projetos."_ — Bruno Okamoto

O Agente Bibliotecário é a memória persistente e organizacional do Hermes Agent. Ele implementa os três pilares do Second Brain (Contexto, Skills, Rotinas) de forma pragmática:

- **Contexto** → coleção de notas e fragmentos organizacionais em memória semântica (Qdrant)
- **Skills** → templates reutilizáveis de prompts e workflows
- **Rotinas** → automações cron que executam tarefas recorrentes de conhecimento

O agente opera silenciosamente em background, enriquecendo cada conversa do Hermes com memória institucional e histórica, sem necessidade de o usuário repetir informações.

**Stack:** Qdrant (memória semântica) + SQLite/NVMe (task board) — SEM Mem0, SEM LangChain.

---

## 2. Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                     Hermes CLI / Gateway                         │
│                  /memory  /task  /context                       │
└─────────────────────────┬───────────────────────────────────────┘
                          │
              ┌───────────┴────────────┐
              │   LibrarianAgent       │
              │   (hermes/tools/librarian/)
              │                         │
              ├─────────────────────────┤
              │                         │
    ┌─────────▼──────────┐  ┌──────────▼───────────┐
    │   SemanticMemory    │  │      TaskBoard       │
    │   (Qdrant :6333)    │  │  (SQLite /srv/data)  │
    │                     │  │                       │
    │  Collection: will   │  │  Tables:             │
    │  - memories          │  │  tasks               │
    │  - contexts          │  │  projects            │
    │  - snippets          │  │  tags                │
    │  Embedding: E5-mistral│  │                       │
    │  (1024 dim) ou       │  │                       │
    │  MiniLM (384 dim)    │  │                       │
    └─────────────────────┘  └──────────────────────-─┘
```

### 2.1 Escolha do Embedding Model

| Modelo | Dimensão | Velocidade | Qualidade | RAM | Recomendação |
|--------|----------|------------|-----------|-----|-------------|
| **E5-mistral** (nomic-ai) | 1024 | ~300 tok/s CPU | ⭐⭐⭐⭐⭐ | ~2GB | **Recomendado** — qualidade superior para retrieval |
| **MiniLM** (all-MiniLM-L6-v2) | 384 | ~1000 tok/s CPU | ⭐⭐⭐⭐ | ~500MB | Boa alternativa se E5 for lento |

**Decisão:** Usar E5-mistral por padrão; detectar performance e permitir switch via `/memory model mini` ou `/memory model e5`.

### 2.2 Stack de Dados

| Camada | Tecnologia | Location | Conteúdo |
|--------|-----------|----------|----------|
| Memória semântica | Qdrant | `:6333` | Notas, contextos, snippets com embedding |
| Task board | SQLite | `/srv/data/librarian/tasks.db` | Tarefas, projetos, tags |
| Trajectórias | SQLite | `/srv/data/librarian/trajectories/` | Histórico de execuções |

---

## 3. Comandos

### 3.1 `/memory` — Memória Semântica

```
/memory save <texto> [tag1 tag2]   # Salva na memória
/memory query <pergunta>            # Semantic search
/memory list                        # Lista memórias recentes
/memory get <id>                    # Mostra memória específica
/memory delete <id>                 # Remove memória
/memory stats                       # Estatísticas (count, collection size)
/memory model [e5|mini]             # Troca embedding model
```

**Comportamento do `save`:**
- Gera embedding com o modelo ativo
- Armazena no Qdrant (collection `will`)
- Salva metadados: timestamp, tags, source (default: "manual")
- Retorna ID da memória criada

**Comportamento do `query`:**
- Gera embedding da pergunta
- Faz ANN search no Qdrant (top_k=5 por padrão)
- Retorna memórias mais relevantes com score de similaridade
- Se score < 0.7, avisa que não encontrou nada relevante

### 3.2 `/context` — Contextos Organizacionais

```
/context save <nome> <texto>        # Salva contexto nomeado
/context list                       # Lista contextos
/context get <nome>                 # Mostra contexto
/context delete <nome>              # Remove contexto
/context set-default <nome>         # Define contexto padrão para todas as sessões
```

**Contexto** é uma memória especial com nome fixo que é injetado automaticamente no system prompt de cada sessão. Uso típico: contexto da empresa, do projeto atual, de preferências.

### 3.3 `/task` — Task Board

```
/task new <título>                  # Nova tarefa
/task list [filtro]                 # Lista tarefas (filtro: pending|done|all|categorias)
/task done <id>                     # Marca como feita
/task edit <id> <novo título>        # Edita título
/task delete <id>                   # Remove tarefa
/task tags <id> add|remove <tag>   # Gerencia tags
/task project <nome>                # Lista tarefas de um projeto
/task stats                         # Estatísticas do board
```

**Schema da tarefa:**
```sql
CREATE TABLE tasks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    status     TEXT DEFAULT 'pending',  -- pending | done | cancelled
    project    TEXT,
    tags       TEXT,                    -- JSON array
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    done_at    TEXT
);
CREATE TABLE projects (
    name  TEXT PRIMARY KEY,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE tags (
    name   TEXT PRIMARY KEY,
    color  TEXT
);
```

---

## 4. Componentes

### 4.1 `hermes/tools/librarian/`

```
hermes/tools/librarian/
├── __init__.py                    # Registry exports
├── config.py                       # LibrarianConfig (Qdrant URL, collection, db path)
├── semantic_memory.py              # SemanticMemory class — Qdrant CRUD
├── task_board.py                  # TaskBoard class — SQLite CRUD
├── embedding.py                    # Embedding generation (E5 / MiniLM)
├── commands.py                     # Command handlers (/memory, /context, /task)
└── utils.py                       # Helpers
```

### 4.2 Dependency Injection

```python
# Singleton pattern — uma instância por sessão Hermes
_librarian_instance: LibrarianAgent | None = None

def get_librarian() -> LibrarianAgent:
    global _librarian_instance
    if _librarian_instance is None:
        _librarian_instance = LibrarianAgent()
    return _librarian_instance
```

### 4.3 Qdrant Collection Schema

```python
# Collection: "will" (nome fixo, hardcoded — único usuário)
# Vector params: dim=1024 (E5) ou 384 (MiniLM), metric=Cosine

# Payload fields:
# - text: str          — conteúdo da memória
# - tags: list[str]    — tags
# - source: str        — "manual" | "context" | "task" | "cron" | "import"
# - created_at: str    — ISO timestamp
# - name: str | None   — para contextos nomeados
```

---

## 5. Fluxos

### 5.1 Semantic Search Flow

```
User: "/memory query quem é o CEO da empresa?"

→ SemanticMemory.embed("quem é o CEO da empresa?")
  → EmbeddingModel.encode() → [1024-dim vector]
  → QdrantClient.search(collection="will", query_vector=[...], limit=5)
  → Para cada resultado com score > 0.7:
       formata como resposta
  → Se nenhum score > 0.7:
       "Não encontrei nada relevante na memória."
```

### 5.2 Context Auto-Injection Flow

```
Nova sessão Hermes inicia
  → LibrarianAgent.get_default_context()
    → Qdrant: busca por name="default" E source="context"
    → Se existe: injeta no system prompt
    → Se não: retorna ""
```

### 5.3 Task Board Flow

```
User: "/task new Implementar login via OAuth"
  → TaskBoard.create(title="Implementar login via OAuth")
    → SQLite INSERT
    → Retorna task_id=42

User: "/task list"
  → TaskBoard.list(status="pending")
    → SQLite SELECT
    → Formata como lista Markdown
```

---

## 6. Design Decisions

| Decisão | Alternativa considerada | Justificativa |
|---------|------------------------|---------------|
| Qdrant em vez de Mem0 | Mem0 (managed) | Mem0 adiciona abstração desnecessária; Qdrant é deployado e controlado localmente |
| SQLite em vez de PostgreSQL | PostgreSQL | Tarefas não precisam de concurrent writes complexos; SQLite é mais simples no NVMe |
| E5-mistral como default | OpenAI ada-002 | E5-mistral roda localmente via Ollama (SEM gasto de API) |
| embedding local via Ollama | OpenAI embeddings API | Evita leaking de dados sensíveis para APIs externas |
| Sem LangChain | LangChain | Overhead de abstração; implementações diretas são mais simples |

---

## 7. GAIA Inspiration (não copiar)

> "A GAIA (theexperiencecompany/gaia, 168 stars) é inspiração conceitual, NÃO implementação." — Memory + workflow hub para agents.

**O que GAIA faz:** hub central de memória e workflows para múltiplos agents.
**O que vamos fazer:** memory layer integrada ao Hermes Agent existente, não um hub separado.

**Diferenciação do GAIA:**
- GAIA é stand-alone; somos in-process no Hermes
- GAIA usa Mem0; usamos Qdrant nativo
- GAIA é TypeScript/Nx; somos Python (Hermes原生)
- Não copiamos arquitetura, apenas o conceito de "memória organizacional"

---

## 8. Progresso de Crescimento do Storage

Estimativa de crescimento diário (NVMe Gen5 `/srv/data`):

| Componente | Crescimento/dia | Limit |
|-----------|----------------|-------|
| Memórias Qdrant (vectors 1024-float) | ~5-20MB (se muitas notas) | 4TB NVMe |
| Task board SQLite | ~5MB/dia | 4TB NVMe |
| Trajectories | ~50MB/dia (já existe) | 4TB NVMe |
| **Total estimado** | **~65MB/dia** | **~4TB** |

Qdrant no NVMe Gen5: ~10MB/dia para memórias de texto. Contexto: espaço disponível é massivo.

---

## 9. Comandos Derivados do Vídeo (Bruno Okamoto)

Baseado nos três pilares do Second Brain:

### Pilares implementados

| Pilar | Comando | Descrição |
|-------|---------|-----------|
| **Contexto** | `/context` | Memórias organizacionais nomeadas auto-injectadas |
| **Skills** | `/memory save --type=skill` | Templates de workflows reutilizáveis |
| **Rotinas** | `/cron` (existente) | Automação de tarefas recorrentes |

### Expansão futura (fora do escopo v1)

- `/skill` — criar e gerenciar skills (workflows de múltiplos passos)
- `/routine` — criar rotinas (cron jobs para knowledge management)
- `/project` — gerenciar projetos (grupo de contextos + tasks + rotinas)

---

## 10. Out of Scope (v1)

- Multi-usuário / ACLs — único usuário (William)
- Sync com Obsidian / Notion — integração futura opcional
- Knowledge graph — ANN search é suficiente por agora
- Auto-arquivamento de sessões — melhorar o trajectory.py existente

---

## 11. Verificação

```
# Qdrant OK
curl http://localhost:6333/health

# Collection existe
curl http://localhost:6333/collections/will

# SQLite OK
ls -lh /srv/data/librarian/tasks.db

# Teste de save + query
/memory save teste de memória
/memory query teste
# Deve retornar a memória com score alto

# Teste de task
/task new minha primeira tarefa
/task list
# Deve mostrar a tarefa
```
