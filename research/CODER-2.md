# CODER-2 Research Report — SPEC-092 Trieve RAG Integration

**Data:** 2026-04-23
**Focus:** Frontend Design for RAG Interfaces
**Author:** CODER-2 Agent

---

## 1. Key Findings (April 2026 Best Practices)

### 1.1 RAG Result Display Patterns

**Best Practice:** Separate "retrieved context" from "generated response" visually.

```
┌─────────────────────────────────────────────┐
│ 📚 Contexto Recuperado (3 chunks)           │
├─────────────────────────────────────────────┤
│ [1] score: 0.94 | source: SKILL.md          │
│ "Para fazer deploy no Coolify, você precisa  │
│  primeiro..."                               │
├─────────────────────────────────────────────┤
│ [2] score: 0.87 | source: SPEC-047.md       │
│ "O ai-gateway é exposing em :4002..."       │
└─────────────────────────────────────────────┘
```

**UI Recommendations:**
- Display relevance score (0.0–1.0) for transparency
- Show source document name/path
- Truncate chunks at ~300 chars with "ver mais"
- Use collapsible sections for multiple chunks

### 1.2 Context Injection in Hermes

**Current State:**
- `llmComplete()` in `litellm/router.ts` accepts `messages[]` and `systemPrompt`
- `agency_router.ts` does CEO routing, no RAG context injection yet

**Integration Pattern:**

```typescript
// Anti-hardcoded: all config via process.env
const TRIEVE_URL = process.env['TRIEVE_URL'] ?? 'http://localhost:6435';
const TRIEVE_API_KEY = process.env['TRIEVE_API_KEY'] ?? '';

interface RetrievedChunk {
  content: string;
  score: number;
  metadata: {
    source: string;
    type: string;
    doc_id: string;
  };
}

async function ragRetrieve(query: string, topK: number = 5): Promise<RetrievedChunk[]> {
  const response = await fetch(`${TRIEVE_URL}/api/v1/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TRIEVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit: topK,
      dataset_id: process.env['TRIEVE_DATASET_ID'],
    }),
  });

  if (!response.ok) throw new Error(`Trieve search failed: ${response.status}`);
  const data = await response.json() as { results: RetrievedChunk[] };
  return data.results;
}

function buildRAGSystemPrompt(query: string, chunks: RetrievedChunk[]): string {
  const context = chunks
    .map((c, i) => `[${i+1}] (score: ${c.score.toFixed(2)}) ${c.content}`)
    .join('\n\n');

  return `Você é o Hermes Agent. Use o contexto recuperado para responder com precisão.

## Contexto Recuperado
${context}

## Instrução
Responda a pergunta usando o contexto acima. Se o contexto não for relevante, diga que não sabe.`;
}
```

### 1.3 Hermes Router Integration

**Where to inject RAG:**
- `agency_router.ts:askCeoToRoute()` — BEFORE LLM decision, optionally retrieve context
- `agency_router.ts:executeSkill()` — inject context into skill execution

**Pattern for Context Window Management:**
- Top-k=5 chunks maximum
- Truncate each chunk at 512 tokens (~2000 chars)
- Include score threshold (reject < 0.5 relevance)

### 1.4 Qdrant Client Patterns (Existing)

**Found in `apps/hermes-agency/src/qdrant/client.ts`:**
- Already has `search()` function returning `{ id, score, payload }`
- Uses `COLLECTIONS.KNOWLEDGE` for agency knowledge base
- Collection separation: `mem0` vs `trieve` (SPEC-092 risk mitigation)

**Gap:** No existing `ragRetrieve` wrapper — needs to be built on top of Qdrant search.

---

## 2. Frontend Design Recommendations

### 2.1 Telegram/CLI Display (Hermes Primary UI)

```typescript
// Display format for Telegram
function formatRAGResults(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) {
    return '❌ Nenhum resultado encontrado.';
  }

  const header = `📚 *${chunks.length} resultados encontrados*\n`;
  const results = chunks
    .map((c, i) => {
      const truncated = c.content.length > 200
        ? c.content.slice(0, 200) + '...'
        : c.content;
      return `*${i + 1}.* \`${c.score.toFixed(2)}\` | \`${c.metadata.source}\`\n${truncated}`;
    })
    .join('\n\n');

  return header + results;
}
```

### 2.2 Search Result Card Design

| Field | Recommendation |
|-------|----------------|
| Score | Show as `0.94` badge with color coding (green >0.8, yellow >0.6, red <0.6) |
| Source | Truncate path, show icon by type (📄 doc, 📁 folder) |
| Content | First 200 chars + "ver mais" expand |
| Actions | Copy, Open source, Rerank (future) |

### 2.3 RAG vs. Mem0 Separation

| Layer | Purpose | Technology |
|-------|---------|------------|
| **Mem0** | User preferences, facts, conversation history | Mem0 (Qdrant `mem0` collection) |
| **Trieve** | Document knowledge, searchable docs | Trieve + Qdrant `trieve` collection |
| **Working Memory** | Agent session context | Qdrant `agency_working_memory` |

**Critical:** Keep collections SEPARATE. `client.ts` uses `KNOWLEDGE` for agency docs.

---

## 3. What to Add/Update/Delete

### 3.1 ADD (New Files/Functions)

| Item | Location | Purpose |
|------|----------|---------|
| `ragRetrieve()` wrapper | `apps/hermes-agency/src/trieve/client.ts` | Trieve API wrapper |
| `formatRAGResults()` | `apps/hermes-agency/src/telegram/formatters.ts` | Telegram display |
| RAG skill trigger | `apps/hermes-agency/src/skills/index.ts` | Add `trieve_retrieve` to tools |
| RAG system prompt builder | `apps/hermes-agency/src/rag/prompt_builder.ts` | Context injection |

### 3.2 UPDATE (Existing Files)

| File | Change |
|------|--------|
| `apps/hermes-agency/src/skills/index.ts` | Add `trieve_retrieve` to `REGISTERED_TOOLS` |
| `AGENTS.md` | Document RAG workflow, Trieve integration |
| `PORTS.md` | Add `:6435 → Trieve (RAG API)` |
| `SUBDOMAINS.md` | Add `trieve.zappro.site` if exposed |

### 3.3 DELETE (Nothing)

No deletions recommended for this spec. Frontend is minimal (CLI-first).

---

## 4. Specific Code Example

### 4.1 Trieve Client Wrapper

```typescript
// apps/hermes-agency/src/trieve/client.ts
// Anti-hardcoded: all config via process.env

const TRIEVE_URL = process.env['TRIEVE_URL'] ?? 'http://localhost:6435';
const TRIEVE_API_KEY = process.env['TRIEVE_API_KEY'] ?? '';
const TRIEVE_DATASET_ID = process.env['TRIEVE_DATASET_ID'] ?? '';

export interface TrieveChunk {
  id: string;
  content: string;
  score: number;
  metadata: {
    source: string;
    type: string;
  };
}

export async function trieveSearch(query: string, limit: number = 5): Promise<TrieveChunk[]> {
  const response = await fetch(`${TRIEVE_URL}/api/v1/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TRIEVE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      limit,
      dataset_id: TRIEVE_DATASET_ID,
    }),
  });

  if (!response.ok) {
    throw new Error(`Trieve search failed: ${response.status}`);
  }

  const data = await response.json() as { results: TrieveChunk[] };
  return data.results;
}
```

### 4.2 Integration in Agency Router

```typescript
// In agency_router.ts — inject RAG context when relevant
async function executeSkill(skillId: string, input: string, ctx: RouterContext): Promise<string> {
  // ... existing circuit breaker, brand guardian, human gate logic ...

  // NEW: RAG context retrieval for knowledge-intensive queries
  const knowledgeTriggers = ['o que é', 'como fazer', 'documentação', 'spec', 'regra'];
  const needsRAG = knowledgeTriggers.some(t => input.toLowerCase().includes(t));

  let ragContext = '';
  if (needsRAG) {
    try {
      const chunks = await trieveSearch(input, 3);
      if (chunks.length > 0) {
        ragContext = buildRAGSystemPrompt(input, chunks);
        console.log(`[agency_router] RAG retrieved ${chunks.length} chunks for query: "${input.slice(0, 50)}..."`);
      }
    } catch (err) {
      console.warn('[agency_router] RAG retrieval failed:', err);
    }
  }

  // Pass ragContext to skill execution...
  return `✅ Routed to **${skill.name}**${ragContext ? '\n📚 Contexto RAG injetado' : ''}`;
}
```

---

## 5. Recommendations Summary

1. **CLI-first UI** — Hermes already handles Telegram/CLI, no new frontend needed
2. **Integrate at router level** — inject RAG context before skill execution when query matches knowledge triggers
3. **Separate collections** — `mem0` for preferences, `trieve` for docs, `agency_*` for agency data
4. **Display score transparency** — always show relevance score (0.0–1.0) in results
5. **Limit top-k=5** — prevent context window overflow
6. **Update PORTS.md + SUBDOMAINS.md** — add `:6435` reservation

---

## 6. References

- Trieve SDK: https://ts-sdk.trieve.ai
- Trieve Docs: https://docs.trieve.ai
- Existing Qdrant client: `apps/hermes-agency/src/qdrant/client.ts`
- Existing router: `apps/hermes-agency/src/router/agency_router.ts`
- SPEC-092: `/srv/monorepo/docs/SPECS/SPEC-092-trieve-rag-integration.md`
