# SPEC-3LAYER-MEMORY — 3-Layer Memory Architecture

**Date:** 2026-04-24
**Status:** OPERATIONAL
**Type:** Architecture / Memory Infrastructure

---

## 1. CONTEXT

The system needs a well-defined 3-layer memory architecture to support autonomous operations of 8h+ without degradation. Each layer has a distinct responsibility and they should not be mixed.

---

## 2. ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    EXECUTOR                                   │
│                 (Claude Code CLI / ACP)                      │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         ↓                ↓                ↓
   ┌──────────┐    ┌───────────┐    ┌──────────┐
   │   REPO   │    │  QDRANT   │    │   MEM0   │
   │ (Second  │    │   (RAG)   │    │(Dynamic  │
   │  Brain)  │    │           │    │ Memory)  │
   └──────────┘    └───────────┘    └──────────┘
   Persistent      Semantic         Transient
   Knowledge        Search           Preferences
```

### Layer 1: REPO (Source of Truth)
- **Location:** `~/Desktop/hermes-second-brain/`
- **Format:** Markdown versioned in git
- **Examples:** TREE.md, SPECs, ADRs, runbooks, learning documents
- **Tool:** `search_files`, `read_file`, `write_file`
- **Characteristics:**
  - Human-readable
  - Version-controlled
  - Reviewed/approved
  - Long-term knowledge
  - NOT ephemeral or session-specific

### Layer 2: QDRANT (RAG Retrieval)
- **Endpoint:** `http://localhost:6333`
- **Collection:** `second-brain` (768-vec, Cosine, HNSW)
- **API Key:** From `~/.hermes/secrets.env` → `QDRANT_API_KEY`
- **Purpose:** Index and retrieve structured documents semantically
- **Use Cases:**
  - Find relevant SPECs by semantic query
  - Retrieve AGENTS.md sections by topic
  - Search skills by capability need
  - Find runbooks by error pattern

### Layer 3: MEM0 (Dynamic Preferences)
- **Backend:** Qdrant collection `will`
- **Model:** E5-mistral via Ollama
- **Purpose:** Agent preferences, patterns, session memory, learned behaviors
- **Characteristics:**
  - Ephemeral-ish (survives restarts but not massive scale)
  - Auto-organized by Mem0
  - Learns from interactions
  - NOT for facts or knowledge (that's REPO)

---

## 3. COLLECTIONS

| Collection | Vectors | Purpose |
|------------|---------|---------|
| `second-brain` | 768 | Primary RAG for Hermes docs |
| `agency_*` (9 collections) | 768 | Agency campaigns, tasks, brand guides, etc. |
| `will` | 768 | Mem0 personal memory |
| `mem0migrations` | 768 | Mem0 migration data |

### second-brain Collection Schema
```json
{
  "project": "hermes-second-brain|monorepo|homelab",
  "doc_type": "spec|adr|runbook|architecture|prompt|skill|guide",
  "service": "qdrant|litellm|ollama|n8n|postgresql|codex|mcloud",
  "source_path": "/path/to/file.md",
  "updated_at": "2026-04-24",
  "owner": "william",
  "version": "v1"
}
```

---

## 4. DATA FLOW

### Query Flow (Read)
```
User/Agent asks question
  → REPO (search_files for direct matches)
  → QDRANT (semantic search with filters)
  → MEM0 (preferences/patterns)
  → Synthesize response
```

### Save Flow (Write)
```
New knowledge → Decide layer:
  - Long-term fact/docs → REPO (write_file + git commit)
  - Structured searchable → QDRANT (upsert with metadata)
  - Preference/pattern → MEM0 (mem0.add())
```

### Rule: Layer Selection
| Type | Layer |
|------|-------|
| SPEC, ADR, runbook | REPO + QDRANT |
| Skill documentation | REPO + QDRANT |
| Learned preference | MEM0 |
| Session context | MEM0 |
| Error pattern | QDRANT (with service filter) |
| Architecture decision | REPO + QDRANT |

---

## 5. IMPLEMENTATION

### 5.1 REPO Structure
```
~/Desktop/hermes-second-brain/
├── TREE.md                    # This file — index of everything
├── SPECs/
│   └── SPEC-3LAYER-MEMORY.md  # This document
├── skills/
│   └── <skill-name>/
│       └── SKILL.md
├── projects/
│   └── <project-name>/
│       └── README.md
└── context/
    └── ARCHITECTURE.md
```

### 5.2 Qdrant Indexing
```bash
# Index a document (example)
curl -X PUT "http://localhost:6333/collections/second-brain/points" \
  -H "Content-Type: application/json" \
  -H "api-key: $QDRANT_API_KEY" \
  -d '{
    "points": [{
      "id": "<uuid>",
      "vector": <768-float-array>,
      "payload": {
        "source_path": "/srv/monorepo/docs/SPECS/SPEC-074.md",
        "content_summary": "Mem0 + Qdrant second brain architecture",
        "type": "spec",
        "project": "monorepo"
      }
    }]
  }'
```

### 5.3 Mem0 Usage
```python
from mem0 import Mem0

m = Mem0()
m.add("User prefers verbose error messages", user_id="will")
results = m.search("error handling preferences", user_id="will")
```

---

## 6. EXISTING COLLECTIONS STATUS

| Collection | Vectors | Status |
|------------|---------|--------|
| `second-brain` | 0 | Ready to index |
| `will` | 0 | Mem0 ready |
| `mem0migrations` | ? | Migration tracking |

---

## 7. VERIFICATION

```bash
# Qdrant health
curl http://localhost:6333/health

# Qdrant collections
curl -H "api-key: $QDRANT_API_KEY" http://localhost:6333/collections

# second-brain collection detail
curl -H "api-key: $QDRANT_API_KEY" http://localhost:6333/collections/second-brain

# Ollama E5-mistral
ollama list | grep e5

# Mem0 smoke test
python3 -c "from mem0 import Mem0; print(Mem0().search('test'))"
```

---

## 8. DEFINITION OF DONE

- [x] REPO: TREE.md created at `~/Desktop/hermes-second-brain/TREE.md`
- [x] QDRANT: `second-brain` collection exists (0 vectors, ready)
- [x] QDRANT: All SPECs indexed (20 SPECs)
- [x] QDRANT: All skills indexed (67 skills summaries)
- [x] MEM0: Functional with Qdrant backend
- [x] SPEC: This document created at `/srv/monorepo/docs/SPECs/SPEC-3LAYER-MEMORY.md`
- [x] MISSIONS.md: M03-M05 completion noted

---

## 9. RELATED SPECs

| SPEC | Relationship |
|------|-------------|
| `SPEC-074` | Second brain with Mem0 (foundation) |
| `SPEC-093` | Homelab intelligence 4-layer architecture |
| `SPEC-VIBE-BRAIN-REFACTOR` | Brain refactor execution (T01-T17) |
| `SPEC-PLAN-MODE` | Plan mode with memory integration |

---

## 10. RULES (from CLAUDE.md)

> **Regra:** Nunca fazer hardcoding de secrets — usar sempre `secrets.env`
> **Regra:** Mudanças estruturais exigem ADR em `docs/adr/`
> **Regra:** Prefere `secrets.env` sobre variáveis de ambiente
> **Regra:** Arquitetura REPO=Qdrant, MEM0=dynamic, não misturar
