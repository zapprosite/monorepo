# CODER-1 Implementation Report: Trieve RAG Backend

**Date:** 2026-04-23
**SPEC:** SPEC-092 (Trieve RAG Integration)
**Status:** Implemented

---

## 1. What Was Done

### 1.1 Trieve Service Module (`src/services/trieve/`)

Created `src/services/trieve/` with three files:

| File | Purpose |
|------|---------|
| `types.ts` | Zod schemas for Trieve API payloads |
| `trieve-client.ts` | HTTP client for Trieve API with `ragRetrieve()` function |
| `index.ts` | Service exports barrel |

### 1.2 Trieve tRPC Router (`src/modules/trieve/`)

Created `src/modules/trieve/trieve.trpc.ts` with endpoints:

| Endpoint | Type | Description |
|----------|------|-------------|
| `trieve.listDatasets` | query | List all datasets |
| `trieve.createDataset` | mutation | Create new dataset |
| `trieve.search` | mutation | Search chunks in a dataset |
| `trieve.ragRetrieve` | mutation | **Core RAG function** — retrieves relevant chunks |

### 1.3 Router Registration

Updated `src/routers/trpc.router.ts` to register `trieveRouter`.

### 1.4 Environment Variables

Added to `.env.example`:
```bash
TRIEVE_URL=http://localhost:6435
TRIEVE_API_KEY=           # Generated on first Trieve login
TRIEVE_DEFAULT_DATASET_ID= # UUID of the default dataset for ragRetrieve()
```

---

## 2. Key Functions

### `ragRetrieve(query: string, top_k: number = 5)`

Signature from SPEC-092 pseudo-code:

```typescript
export async function ragRetrieve(
  query: string,
  top_k = 5,
): Promise<RagRetrieveResult[]> {
  const datasetId = process.env['TRIEVE_DEFAULT_DATASET_ID'];
  if (!datasetId) {
    throw new Error('TRIEVE_DEFAULT_DATASET_ID not set.');
  }

  const results = await search(datasetId, query, top_k);

  return results.map((r: SearchResult): RagRetrieveResult => ({
    content: r.chunk.content,
    score: r.score,
    source: r.chunk.metadata?.['source'] ?? r.chunk.metadata?.['file'] ?? undefined,
  }));
}
```

---

## 3. File Inventory

### Created
- `/srv/monorepo/apps/api/src/services/trieve/types.ts`
- `/srv/monorepo/apps/api/src/services/trieve/trieve-client.ts`
- `/srv/monorepo/apps/api/src/services/trieve/index.ts`
- `/srv/monorepo/apps/api/src/modules/trieve/trieve.trpc.ts`

### Modified
- `/srv/monorepo/apps/api/src/routers/trpc.router.ts` — added `trieveRouter`
- `/srv/monorepo/apps/api/.env.example` — added Trieve env vars

---

## 4. Integration Path

```
Hermes Agent
    │
    ├── tRPC call: trieve.ragRetrieve({ query, top_k })
    │
    ▼
trieveRouter (tRPC)
    │
    ▼
ragRetrieve() → search() → Trieve API (:6435)
    │
    ▼
Qdrant (:6333) ← Trieve manages embedding via Ollama (:11434)
    │
    ▼
Relevant chunks returned → injected into LLM context
```

---

## 5. Embedding Model

Per SPEC-092, the embedding model is `nomic-embed-text` (already available in Ollama):

```bash
# Trieve docker-compose config (per SPEC-092)
OLLAMA_BASE_URL=http://10.0.9.1:11434
EMBEDDING_MODEL=nomic-embed-text
```

This is configured at the Trieve Docker level, not in the client.

---

## 6. Pending (Not Implemented)

Per SPEC-092 roadmap:

| Phase | Task | Status |
|-------|------|--------|
| FASE 1 | Deploy Trieve via Coolify `:6435` | Pending |
| FASE 1 | Configure Qdrant collection | Pending |
| FASE 1 | Verify embedding via Ollama | Pending |
| FASE 2 | Create dataset "hermes-knowledge" | Pending |
| FASE 2 | Index `hermes-second-brain/docs/` | Pending |
| FASE 2 | Index `monorepo/docs/SPECS/` | Pending |
| FASE 3 | Add `rag-retrieve` skill to Hermes Agency | Pending |
| FASE 3 | Integrate into Hermes context flow | Pending |

---

## 7. Port Allocation

Port `6435` reserved for Trieve per SPEC-092.

Update required for `PORTS.md`: `6435 → Trieve (RAG API)` (within 4002-4099 dev microservice range).

---

## 8. References

- SPEC-092: `/srv/monorepo/docs/SPECS/SPEC-092-trieve-rag-integration.md`
- CODER-1 Research: `/srv/monorepo/research/CODER-1.md`
- Qdrant client pattern: `apps/hermes-agency/src/qdrant/client.ts`
- API tRPC pattern: `apps/api/src/routers/trpc.router.ts`
