# CODER-1 Research Report: Trieve RAG Integration

**Date:** 2026-04-23
**SPEC:** SPEC-092 (Trieve RAG Integration)
**Focus:** `/backend-scaffold`

---

## 1. Key Findings

### 1.1 Trieve Integration Pattern (vs. Standard Backend Module)

The existing `/backend-scaffold` skill generates **Fastify plugin + tRPC router + OrchidORM table** — a full CRUD stack for internal DB entities. Trieve integration is **different**: it's an **external service client**, not a DB-backed module.

**Recommendation:** Create a dedicated `trieve-client` module pattern, NOT use `/backend-scaffold`.

### 1.2 Existing Infrastructure

| Component | Location | Pattern |
|-----------|----------|---------|
| Qdrant client | `apps/hermes-agency/src/qdrant/client.ts` | Direct REST fetch, no ORM |
| tRPC routers | `apps/api/src/modules/*/` | Fastify route + tRPC procedure |
| Skill registry | `apps/hermes-agency/src/skills/index.ts` | O(1) lookup maps |

**Key insight:** Hermes Agency already has a Qdrant client pattern (`apps/hermes-agency/src/qdrant/client.ts`) that can serve as a template for Trieve client.

### 1.3 Port Allocation

**Status: 6435 is FREE** (within 4002-4099 dev microservices range).

From `PORTS.md`:
- Reserved: 4000 (LiteLLM), 4002 (ai-gateway), 8092 (Hermes MCP), 8642 (Hermes Gateway)
- Free: 4004-4099 range

**Action required:** Add `6435 → Trieve (RAG API)` to `PORTS.md`.

### 1.4 Qdrant Collection Separation (SPEC-092 Risk Mitigation)

The SPEC mentions the risk of "Mem0 e Trieve competindo por Qdrant". 

**Current state:**
- Mem0 uses collection `mem0` (already configured)
- Hermes Agency uses collections prefixed `agency_` (9 collections)
- Trieve should use collection `trieve` (per SPEC-092 docker-compose)

**No conflict** — collections are already namespace-separated.

---

## 2. Recommendations for Implementation

### 2.1 New Module Pattern: `trieve-service/`

Instead of `/backend-scaffold`, create a new skill pattern for external service clients:

```
apps/api/src/services/trieve/
├── trieve-client.ts      # HTTP client for Trieve API
├── types.ts              # Zod schemas for Trieve payloads
└── index.ts              # Exported functions
```

### 2.2 Trieve Client API Design

```typescript
// Anti-hardcoded: all config via process.env
const TRIEVE_URL = process.env.TRIEVE_URL ?? 'http://localhost:6435';
const TRIEVE_API_KEY = process.env.TRIEVE_API_KEY ?? '';

export interface TrieveDataset {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface TrieveChunk {
  id: string;
  content: string;
  metadata: Record<string, string>;
}

export interface TrieveSearchResult {
  id: string;
  score: number;
  chunk: TrieveChunk;
}

export async function createDataset(name: string, description: string): Promise<TrieveDataset>
export async function uploadChunks(datasetId: string, chunks: TrieveChunk[]): Promise<void>
export async function search(
  datasetId: string,
  query: string,
  limit?: number
): Promise<TrieveSearchResult[]>
```

### 2.3 Hermes Agency Integration

Add `rag-retrieve` skill to `apps/hermes-agency/src/skills/index.ts`:

```typescript
{
  id: 'rag-retrieve',
  name: 'RAG RETRIEVE',
  description: 'Retrieves relevant document chunks from Trieve RAG pipeline',
  tools: ['trieve_search', 'chunk_aggregate'],
  triggers: ['rag', 'documentos', 'knowledge', 'retrieve'],
}
```

### 2.4 Environment Variables

Add to `.env` and `.env.example`:

```bash
# Trieve RAG (SPEC-092)
TRIEVE_URL=http://localhost:6435
TRIEVE_API_KEY=       # Generated on first Trieve login
```

---

## 3. What to Add/Update/Delete

### ADD

| File | Purpose |
|------|---------|
| `apps/api/src/services/trieve/trieve-client.ts` | Trieve API HTTP client |
| `apps/api/src/services/trieve/types.ts` | Zod schemas for Trieve payloads |
| `smoke-tests/smoke-trieve.sh` | Smoke test for Trieve health + search |
| `docs/SPECS/SPEC-092-trieve-rag-integration.md` | Update: mark as "In Progress" |

### UPDATE

| File | Change |
|------|--------|
| `PORTS.md` | Add `6435 → Trieve (RAG API)` |
| `SUBDOMAINS.md` | Add `trieve` subdomain if exposed externally |
| `.env.example` | Add `TRIEVE_URL`, `TRIEVE_API_KEY` |
| `AGENTS.md` | Add Trieve service to architecture diagram |
| `apps/hermes-agency/src/skills/index.ts` | Add `rag-retrieve` skill |

### DELETE

| File | Reason |
|------|--------|
| N/A | No deletions required for this integration |

---

## 4. Backend-Scaffold Gap Analysis

The `/backend-scaffold` skill is **not applicable** for Trieve because:

1. **No DB table** — Trieve is external service, not PostgreSQL
2. **No tRPC router** — Client library, not API server
3. **No OrchidORM** — Vector data lives in Qdrant via Trieve

**Alternative skill needed:** `/service-client` pattern for external API integrations (future).

---

## 5. Integration Sequence

For FASE 1 (Setup, 1-2h):

1. **Deploy Trieve** via Coolify on `:6435`
2. **Add env vars** to `.env` and `.env.example`
3. **Create `trieve-client.ts`** in `apps/api/src/services/`
4. **Verify health**: `curl http://localhost:6435/health`
5. **Test search API**: `curl -X POST http://localhost:6435/api/v1/search ...`
6. **Create smoke test** `smoke-trieve.sh`
7. **Update PORTS.md** with `:6435 → Trieve`

For FASE 2 (Indexação):

1. Create dataset "hermes-knowledge"
2. Index `hermes-second-brain/docs/`
3. Index `monorepo/docs/SPECS/`

For FASE 3 (Hermes Integration):

1. Add `rag-retrieve` skill to Hermes Agency
2. Integrate `trieve_search` tool into agency router

---

## 6. Code Example: Trieve Client Pattern

```typescript
// apps/api/src/services/trieve/trieve-client.ts
// Anti-hardcoded: all config via process.env

const TRIEVE_URL = process.env.TRIEVE_URL ?? 'http://localhost:6435';
const TRIEVE_API_KEY = process.env.TRIEVE_API_KEY ?? '';

const HEADERS = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TRIEVE_API_KEY}`,
};

export interface TrieveSearchResult {
  id: string;
  score: number;
  chunk: {
    id: string;
    content: string;
    metadata: Record<string, string>;
  };
}

export async function trieveSearch(
  datasetId: string,
  query: string,
  limit = 5
): Promise<TrieveSearchResult[]> {
  const res = await fetch(`${TRIEVE_URL}/api/v1/search`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ query, dataset_id: datasetId, limit }),
  });

  if (!res.ok) {
    throw new Error(`Trieve search failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { results: TrieveSearchResult[] };
  return data.results ?? [];
}

export async function createDataset(name: string, description: string) {
  const res = await fetch(`${TRIEVE_URL}/api/v1/datasets`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({ name, description }),
  });

  if (!res.ok) {
    throw new Error(`Trieve createDataset failed: ${res.status}`);
  }

  return (await res.json()) as { dataset: { id: string } };
}
```

---

## 7. References

- SPEC-092: `/srv/monorepo/docs/SPECS/SPEC-092-trieve-rag-integration.md`
- Qdrant client pattern: `apps/hermes-agency/src/qdrant/client.ts`
- Backend-scaffold skill: `.claude/skills/backend-scaffold/SKILL.md`
- PORTS.md: `/srv/ops/ai-governance/PORTS.md`
