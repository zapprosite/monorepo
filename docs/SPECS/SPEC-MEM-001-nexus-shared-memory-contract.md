---
name: SPEC-MEM-001
description: Nexus Shared Memory Contract — Hermes/Mem0/Qdrant/second-brain/Claude/Codex
status: draft
owner: AI Team
created: 2026-04-27
---

# SPEC-MEM-001 — Nexus Shared Memory Contract

## 1. Overview

Define the contract between Nexus agents (Hermes, Mem0, Qdrant, second-brain, Claude, Codex) for how context, memory, and knowledge are shared across the homelab runtime.

**Goal:** Eliminate silos — any agent can read/write memory that other agents can retrieve.

---

## 2. Components

### 2.1 Mem0 — Memory Layer

- **Role:** Primary memory store for agent session context
- **Collection:** `agent_memories` (per-agent namespaces)
- **Operations:** `mem0.add()`, `mem0.search()`, `mem0.get()`
- **Retention:** Session-scoped with optional long-term archive to Qdrant

### 2.2 Qdrant — Vector Store

- **Role:** Long-term knowledge base + semantic search
- **Collections:**
  - `rag_governance` — homelab operational knowledge
  - `hvac_chunks` — HVAC manual RAG (SPEC-HVAC-001)
  - `agent_memories_archive` — archived Mem0 sessions
- **Embedding model:** `nomic-embed-text` via LiteLLM
- **Operations:** `qdrant upsert`, `qdrant search`, `qdrant delete`

### 2.3 second-brain — Personal Knowledge

- **Role:** User's personal notes, docs, runbooks
- **Sync:** Filesystem watcher → Qdrant `rag_governance`
- **Index:** Full-text + embeddings
- **Access:** Read-only for agents (Claude, Codex) unless user approves writes

### 2.4 Hermes — Agent Runtime (SPEC-002)

- **Role:** Router and execution boundary
- **Memory access:** Reads Mem0 + Qdrant for context injection
- **Skill registry:** Skills stored in Qdrant `rag_governance`

### 2.5 Claude/Codex — Agent Clients

- **Role:** Consumer of shared memory
- **Protocol:** Via Hermes CLI/API — never direct Qdrant/Mem0 access
- **Context injection:** Hermes fetches relevant memories before invoking skill

---

## 3. Data Flow

```
User input
    ↓
Hermes (router)
    ↓
Mem0 (session memory) ←→ Qdrant (long-term)
    ↓                    ↓
second-brain         rag_governance
(agent writes)       (shared knowledge)
    ↓
Claude / Codex
(context returned)
```

---

## 4. Access Rules

| Actor | Mem0 | Qdrant | second-brain |
|-------|------|--------|-------------|
| Hermes | read/write | read/write | read |
| Claude | read | read/write | read |
| Codex | read | read/write | read |
| Mem0 | write (own) | read (archive) | — |
| User | read/write | read/write | read/write |

**Rule:** No agent writes to second-brain directly. All writes go through Hermes skill invocation with user approval.

---

## 5. Schema

### Mem0 Memory Entry

```json
{
  "user_id": "hermes",
  "agent_id": "claude",
  "session_id": "uuid",
  "content": "string",
  "metadata": {
    "type": "fact | preference | context | skill_result",
    "source": "hermes | claude | user",
    "ttl_hours": 168
  },
  "created_at": "ISO8601"
}
```

### Qdrant Point

```json
{
  "id": "uuid",
  "vector": [0.0, ...],
  "payload": {
    "collection": "rag_governance",
    "doc_type": "skill | runbook | spec | incident",
    "title": "string",
    "content": "string",
    "source": "string",
    "tags": ["string"],
    "indexed_at": "ISO8601"
  }
}
```

---

## 6. Open Issues

- [ ] **TTL strategy:** Mem0 session memories → Qdrant archive cutoff (e.g., after 7 days inactive)
- [ ] **Write approval flow:** How does Hermes get user approval for second-brain writes?
- [ ] **Mem0/Qdrant sync:** Should Mem0 periodically archive to Qdrant, or on demand?
- [ ] **Embedding consistency:** nomic-embed-text vs OpenAI embeddings — same model across all collections?

---

## 7. Related SPECs

- [SPEC-002](SPEC-002-hermes-agent-runtime.md) — Hermes Agent Runtime (router)
- [SPEC-003](SPEC-003-memory-rag-llm-stack.md) — Memory RAG LLM Stack (Qdrant, LiteLLM, embedding contract)
- [SPEC-HVAC-001](../products/HVAC/SPEC-HVAC-001-rag-ingestion.md) — HVAC RAG Ingestion (Qdrant consumer)
