# SPEC-107 — Hermes RAG Pipeline + Infinite Memory
**Last reviewed:** 2026-05-02
**Owner:** SRE/homelab

**Status:** IMPLEMENTED
**Updated:** 2026-05-02
**Owner:** William Rodrigues / Hermes

---

## 1. Context & Problem Statement

William exige:
1. **Memoria infinita** — nunca perder contexto entre sessoes
2. **Pipeline RAG** — buscar contexto do second-brain via Qdrant
3. **Mem0** — facts estruturados para personalidade e preferencias
4. **Zero API key externa** — tudo local ou OpenRouter
5. **NUNCA resetar** — "Approved" nao pode limpar sessao

**Stack atual (4 colecoes Qdrant ativas):**

| Collection | Points | Dims | Uso | Status |
|---|---|---|---|---|
| `mem0` | 26 | 768D | Facts Mem0 (auto-gerenciado) | Ativa |
| `hermes-knowledge` | 17 | 768D | RAG chunks (SPECs, skills, tree) | Rebuilt 2026-05-02 |
| `skills` | 225 | 768D | Skills index | Ativa |
| `hvac_manuals_v1` | 442 | 768D | Manuais HVAC | Ativa |

**DELETED:**
- `will` (2044 pts) — vectors sem payload, inutil
- `second-brain` (79 pts) — vectors sem payload, inutil
- `mem0migrations` (0 pts, 1536D wrong dims) — deletada

**Ports confirmed:**
- LiteLLM: `localhost:4018` (key: `LITELLM_MASTER_KEY`)
- Qdrant: `127.0.0.1:6333` (key: `QDRANT_API_KEY`)
- Ollama: `localhost:11434` (nomic-embed-text, qwen2.5vl:3b)

---

## 2. Arquitetura

```
HERMES AGENT
     |
     +-- Mem0 (facts + prefs) --> Qdrant collection=mem0
     |                               (Ollama nomic-embed-text 768D)
     |
     +-- RAG (docs) ---------> Qdrant collection=hermes-knowledge
     |                               (Ollama nomic-embed-text 768D)
     |
     +-- Session ------------> SQLite FTS5 (hermes_state.db)
     |                               (append-only, never reset)
     |
     +-- LLM generation ----> LiteLLM (4018) --> hermes-brain
     |
     +-- TTS ---------------> Edge TTS (AntonioNeural, +10%)
```

---

## 3. Mem0 Configuration (IMPLEMENTED)

**Stack implementado:**
- LLM: `litellm` provider → `hermes-brain` (via LiteLLM port 4018)
- Embedder: `ollama` provider → `nomic-embed-text` 768D (direto `localhost:11434`)
- Vector store: `qdrant` → collection `mem0` em `127.0.0.1:6333`
- History DB: SQLite at `/home/will/.mem0/history.db`

**CLI wrappers:**
```bash
python3 scripts/mem0_wrapper.py add "fact" --category user_pref
python3 scripts/mem0_wrapper.py search "query"
python3 scripts/mem0_wrapper.py get_all
```

**Import no codigo:**
```python
import sys
sys.path.insert(0, '/srv/monorepo/scripts')
from mem0_wrapper import get_memory

m = get_memory()
m.add(fact, user_id='will', infer=False, metadata={'category': cat})
m.search(query, filters={'user_id': 'will'})
```

**Environment (de `~/.hermes/secrets.env`):**
```
LITELLM_MASTER_KEY=sk-zap...n0p1
QDRANT_API_KEY=e6420...4da1
OPENAI_API_KEY=not-needed  # placeholder
```

**Regras de uso:**
- `infer=False` sempre — hermes-brain nao suporta function calling
- `filters={'user_id': 'will'}` obrigatorio em `search()` e `get_all()`
- 20 facts populadas (2026-05-02)

---

## 4. Infinite Memory (Three-Layer)

| Layer | Tech | Content | Retention |
|---|---|---|---|
| Working | In-context | Last N messages | Per turn |
| Short-term | SQLite FTS5 | Conversation history | Session |
| Long-term | Qdrant + Mem0 | Facts, prefs, RAG | Forever |

**Fluxo pos-interacao:**
```
After every user interaction:
  1. Extract facts --> Mem0.add(user_id, facts, infer=False)
  2. Append session --> SQLite (never delete)
  3. Chunk docs --> Qdrant upsert if important
```

---

## 5. Query Pipeline

```
User query
    |
    +-> Mem0.search(query) --> facts about user/project
    +-> Qdrant RAG (hermes-knowledge) --> top-k docs
    +-> session_search(query) --> past conversations
    +-> LiteLLM (hermes-brain)
            |
            v
    [system prompt] + [Mem0 facts] + [RAG docs] + [session]
            |
            v
         Answer
```

**Context loading order (Blueprint):**
```
1. SOUL.md -- agent identity, permanent rules
2. Mem0 facts -- user profile, preferences
3. session_search -- relevant past conversations
4. Qdrant RAG -- documentation, skills
```

---

## 6. Key Files

| File | Purpose |
|---|---|
| `/srv/monorepo/scripts/mem0_wrapper.py` | Mem0 CLI wrapper |
| `/srv/monorepo/scripts/haystack-rag-pipeline.py` | RAG pipeline (Qdrant + Haystack) |
| `/srv/monorepo/docs/SPECS/SPEC-107-rag-infinite-memory.md` | This spec |
| `~/.hermes/hermes-agent/hermes_state.db` | SQLite session (append-only) |
| `/srv/hermes-second-brain/` | Second-brain docs |

---

## 7. Implementation Status

| Phase | Status |
|---|---|
| Phase 1: Mem0 + LiteLLM integration | DONE |
| Phase 2: RAG pipeline (LiteLLM port fix) | DONE (port 4000->4018) |
| Phase 3: Infinite memory automation | PENDING |
| Phase 4: Skill creation | PENDING |

---

## 8. Notes

- LiteLLM `nomic-embed-text` via LiteLLM proxy nao funciona (Ollama not reachable from Docker)
  - Solucao: Mem0 usa Ollama diretamente para embeddings (`localhost:11434`)
  - LiteLLM usado apenas para chat (hermes-brain)
- `haystack-rag-pipeline.py` usa LiteLLM port 4018 (corrigido)
- `network_mode: host` no LiteLLM container quebrar acesso ao PostgreSQL — NAO usar
- `extra_hosts: host-gateway` nao resolve (Ollama nativo nao esta na rede Docker)
- CJK scanner: `python3 .claude/rules/scan-encoding.py . --fix`
