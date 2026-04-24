# CODER-2 Research Report — SPEC-092 Trieve RAG Integration

**Data:** 2026-04-23
**Focus:** Frontend/Dashboard Implementation for Trieve RAG
**Author:** CODER-2 Agent
**Status:** Completed

---

## 1. Implementation Summary

Frontend dashboard for Trieve RAG search has been implemented at `/srv/monorepo/apps/web/src/modules/rag/`.

### Files Created

| File | Purpose |
|------|---------|
| `modules/rag/pages/RagSearch.page.tsx` | Main RAG search page with dataset selection and search |
| `modules/rag/components/rag/RagSearchBox.tsx` | Search form with dataset dropdown and query input |
| `modules/rag/components/rag/RagChunksViewer.tsx` | Display for retrieved chunks with score visualization |
| `modules/rag/rag.router.tsx` | React Router configuration for RAG module |
| `packages/ui/src/icons/SearchIcon.ts` | Search icon export |
| `packages/ui/src/icons/StarIcon.ts` | Star icon for relevance score display |
| `packages/ui/src/icons/FileTextIcon.ts` | File icon for chunk source display |

### Files Updated

| File | Change |
|------|--------|
| `apps/web/src/router.tsx` | Added `/rag/*` route to main router |

---

## 2. Key Components

### 2.1 RagSearchBox

- Dataset selection dropdown (populated via `trpc.trieve.listDatasets`)
- Semantic query text input with Enter key support
- Submit button with loading state
- Accessible form with proper labels

### 2.2 RagChunksViewer

- Displays retrieved chunks with:
  - Relevance score badge (color-coded: green >= 0.8, yellow >= 0.6, red < 0.6)
  - Chunk index and source metadata
  - Full content in monospace font
  - Expandable metadata chips
- Hover effects for visual feedback

### 2.3 RagSearchPage

- Main page integrating search and results
- Loading states for datasets and search
- Error handling with user-friendly messages
- Empty state when no results found

---

## 3. Backend Requirements

The frontend expects tRPC procedures:

- `trpc.trieve.listDatasets` — returns `Dataset[]` with `id`, `name`, `description`
- `trpc.trieve.search` — accepts `{ query, datasetId, limit }` returns `SearchResult[]`

### Type Definitions

```typescript
interface Dataset {
  id: string;
  name: string;
  description: string;
}

interface TrieveChunk {
  id: string;
  content: string;
  metadata: Record<string, string>;
}

interface SearchResult {
  id: string;
  score: number;
  chunk: TrieveChunk;
}
```

---

## 4. Integration

### Route Added

```typescript
{
  path: "rag/*",
  Component: lazy(() => import("@frontend/modules/rag/rag.router")),
}
```

### Access URL

- `/rag/` — Main RAG search dashboard

---

## 5. Pending Backend Implementation

To complete the RAG dashboard, the following tRPC procedures need to be implemented in the backend:

1. **`trieve.listDatasets`** — Query Trieve API for available datasets
2. **`trieve.search`** — Proxy search requests to Trieve API

These should follow the patterns established in CODER-1.md:
- Trieve client at `apps/api/src/services/trieve/trieve-client.ts`
- Auth using `ApiKey` scheme (not Bearer)
- Port `:6435` for Trieve service

---

## 6. UI/UX Notes

- Uses existing design system (`@repo/ui-mui`)
- Consistent with other pages (JournalEntries, etc.)
- Responsive layout with proper breakpoints
- Loading spinners and error states included
- Monospace font for chunk content display

---

## 7. References

- SPEC-092: `/srv/monorepo/docs/SPECS/SPEC-092-trieve-rag-integration.md`
- CODER-1.md: `/srv/monorepo/research/CODER-1.md`
- Existing RAG patterns: `apps/gateway/src/qdrant/client.ts`
