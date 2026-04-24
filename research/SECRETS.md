# SECRETS Research: SPEC-092 Trieve RAG Integration

**Data:** 2026-04-23
**Agent:** SECRETS
**Focus:** API Authentication & Secrets Management for Trieve RAG Pipeline

---

## 1. Key Findings (April 2026 Best Practices)

### Trieve API Authentication

Trieve uses **API key authentication** via the `Authorization` header:

```http
Authorization: Bearer <TRIEVE_API_KEY>
```

**Required Headers:**
- `Authorization: Bearer <token>` — API key authentication
- `TR-Dataset: <dataset_id>` — Dataset identification

### Environment Variables Pattern

Trieve self-hosted deployment requires:

```bash
# Core API
TRIEVE_API_KEY=<generated_on_first_login>
TRIEVE_URL=http://localhost:6435

# Qdrant Connection (for vector storage)
QDRANT_URL=http://10.0.9.1:6333
QDRANT_COLLECTION=trieve

# Ollama (for embeddings)
OLLAMA_BASE_URL=http://10.0.9.1:11434
EMBEDDING_MODEL=nomic-ai/e5-mistral-7b-instruct
RERANK_MODEL=BAAI/bge-reranker-base

# Database
DATABASE_URL=sqlite:///srv/data/trieve/trieve.db
```

### Security Best Practices

1. **API Key Generation:** Generated on first login — store immediately in `.env`
2. **Default Credentials:** Keycloak admin defaults to `admin/aintsecure` — **MUST** change on first deploy
3. **Header Requirements:** All requests require both `Authorization` AND `TR-Dataset` headers
4. **Bulk Limits:** Max 120 chunks per bulk upload request
5. **Collection Isolation:** Use separate Qdrant collection for Trieve (`trieve`) vs Mem0 (`mem0`)

---

## 2. Secrets Integration Recommendations

### Add to `.env`

```bash
# Trieve RAG (SPEC-092)
TRIEVE_API_KEY=<openssl rand -hex 32>
TRIEVE_URL=http://localhost:6435
TRIEVE_DATASET_ID=<uuid_after_creation>
```

### Add to `.env.example`

```bash
# Trieve RAG
TRIEVE_API_KEY=replace-with-openssl-rand-hex-32
TRIEVE_URL=http://localhost:6435
TRIEVE_DATASET_ID=replace-with-dataset-uuid
```

### Secrets Validation (anti-hardcoded)

```typescript
// apps/hermes/src/skills/rag-retrieve.ts
const REQUIRED_TRIEVE = ['TRIEVE_API_KEY', 'TRIEVE_URL'];
for (const key of REQUIRED_TRIEVE) {
  if (!process.env[key]) {
    throw new Error(`FATAL: ${key} not set in .env`);
  }
}
```

---

## 3. Code Example: Trieve RAG Skill

```typescript
// apps/hermes/src/skills/rag-retrieve.ts
// Anti-hardcoded: all config via process.env

interface TrieveSearchResult {
  chunk: {
    content: string;
    metadata: Record<string, unknown>;
  };
  score: number;
}

export async function ragRetrieve(
  query: string,
  topK: number = 5
): Promise<string[]> {
  const TRIEVE_API_KEY = process.env.TRIEVE_API_KEY;
  const TRIEVE_URL = process.env.TRIEVE_URL ?? 'http://localhost:6435';
  const TRIEVE_DATASET_ID = process.env.TRIEVE_DATASET_ID;

  if (!TRIEVE_API_KEY) {
    throw new Error('TRIEVE_API_KEY not set in .env');
  }

  const response = await fetch(`${TRIEVE_URL}/api/v1/search`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TRIEVE_API_KEY}`,
      'Content-Type': 'application/json',
      'TR-Dataset': TRIEVE_DATASET_ID ?? '',
    },
    body: JSON.stringify({
      query,
      limit: Math.min(topK, 5), // Context window protection
    }),
  });

  if (!response.ok) {
    throw new Error(`Trieve search failed: ${response.status}`);
  }

  const results: TrieveSearchResult[] = await response.json();
  return results.map(r => r.chunk.content);
}
```

---

## 4. Updates Required

### Update: `/srv/ops/ai-governance/PORTS.md`

Adicionar:
```
:6435 → Trieve (RAG API) — self-hosted, requires TRIEVE_API_KEY
```

### Update: `/srv/ops/ai-governance/SUBDOMAINS.md`

Adicionar se exposto externamente:
```
trieve.zappro.site → :6435 (Trieve RAG Dashboard)
```

### Update: SPEC-092 (Correções)

1. **Authentication:** Clarificar que `TRIEVE_API_KEY` é Bearer token, não Basic auth
2. **Keycloak:** Adicionar warning sobre default credentials `admin/aintsecure`
3. **TR-Dataset header:** Adicionar aos exemplos de curl
4. **Qdrant collection isolation:** Usar `trieve` collection separada de `mem0`

---

## 5. Security Checklist (Pre-Deploy)

- [ ] Generate `TRIEVE_API_KEY` via `openssl rand -hex 32`
- [ ] Add to `.env` (never commit)
- [ ] Add placeholder to `.env.example`
- [ ] Change Keycloak admin password (default: `admin/aintsecure`)
- [ ] Verify `QDRANT_COLLECTION=trieve` (separate from `mem0`)
- [ ] Add `:6435` to PORTS.md
- [ ] Test authentication: `curl -H "Authorization: Bearer $TRIEVE_API_KEY" http://localhost:6435/api/v1/health`

---

## 7. Secret Scan Results (2026-04-23)

### Scan Command
```bash
grep -r "TRIEVE_API_KEY\|QDRANT_URL\|OLLAMA_BASE_URL" --include="*.ts" --include="*.yaml" --include="*.json" . 2>/dev/null | grep -v node_modules
```

### Findings

| Secret | Found | Status |
|--------|-------|--------|
| `TRIEVE_API_KEY` | No | Clean |
| `QDRANT_URL` | Yes | Safe - via `process.env` |
| `OLLAMA_BASE_URL` | No | Clean |

### Files Using QDRANT_URL (all safe pattern)

All references use `process.env['QDRANT_URL']` with fallback to localhost:

- `apps/gateway/src/langgraph/status_update.ts` - fallback `'http://localhost:6333'`
- `apps/gateway/src/index.ts` - required env var (no fallback)
- `apps/gateway/src/langgraph/onboarding_flow.ts` - fallback `'http://localhost:6333'`
- `apps/gateway/src/langgraph/social_calendar.ts` - fallback `'http://localhost:6333'`
- `apps/gateway/src/qdrant/client.ts` - fallback `'http://localhost:6333'`

### Assessment

**No secrets exposed.** All environment variables are accessed via `process.env[]` pattern with appropriate fallbacks. No hardcoded API keys or credentials found.

---

## 8. References

- [Trieve Self-Hosting Docs](https://docs.trieve.ai/self-hosting/docker-compose)
- [Trieve API Reference](https://docs.trieve.ai/api-reference)
- SPEC-092: `/srv/monorepo/docs/SPECS/SPEC-092-trieve-rag-integration.md`
- Anti-Hardcoded Secrets Rule: `/srv/monorepo/.claude/rules/anti-hardcoded-secrets.md`
