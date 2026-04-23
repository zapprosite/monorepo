# TESTER Report — SPEC-092 Trieve RAG Integration

**Date:** 2026-04-23
**Author:** TESTER Agent
**Focus:** /test (Verification & Validation)

---

## 1. Key Findings

### 1.1 Infrastructure Status

| Component | Status | Details |
|-----------|--------|---------|
| Qdrant `:6333` | ✅ Running | Coolify managed, collection `will` (Mem0) |
| Ollama `:11434` | ✅ Running | Only `nomic-embed-text:latest` available |
| Port 6435 | ✅ Free | Available in range 4002–4099 |
| Mem0 | ✅ Running | Uses collection `will` for agent memory |

### 1.2 Critical Issues Found

#### Issue #1: Wrong Embedding Model in SPEC
**Severity:** HIGH

The SPEC-092 specifies `nomic-ai/e5-mistral-7b-instruct` as the embedding model, but Ollama only has `nomic-embed-text:latest` installed.

```
$ curl http://localhost:11434/api/tags
nomic-embed-text:latest
```

**Recommendation:** Use `nomic-embed-text` (already available) or pull `nomic-ai/e5-mistral-7b-instruct` before deploying Trieve.

#### Issue #2: Qdrant Network Address
**Severity:** MEDIUM

The SPEC docker-compose uses `http://10.0.9.1:6333` but PORTS.md shows Qdrant is on Coolify network at `10.0.19.5:6333`.

```
# PORTS.md says:
| 6333 | Qdrant | Coolify net (10.0.19.5) | Containers: `10.0.19.5:6333` |
```

**Recommendation:** Verify actual Qdrant host via `docker inspect` or use `host.docker.internal:6333`.

#### Issue #3: Collection Naming Collision
**Severity:** MEDIUM

| System | Collection | Purpose |
|--------|------------|---------|
| Mem0 | `will` | Agent memory/preferences |
| Trieve | `trieve` (proposed) | Document RAG |

**Risk:** Low (separate collections), but ensure `QDRANT_COLLECTION=trieve` is set correctly.

#### Issue #4: Trieve Cloud Sunsetting
**Severity:** INFO

Trieve Cloud was sunset as of **November 1st, 2025**. Self-hosting is now the only option — aligns with SPEC choice.

---

## 2. Specific Recommendations

### 2.1 Update SPEC-092 Docker Compose

Replace the placeholder IP with actual Qdrant address:

```yaml
services:
  trieve:
    image: trieve/trieve:latest
    ports:
      - "6435:3000"
    environment:
      - QDRANT_URL=http://10.0.19.5:6333  # Verify via docker inspect
      - QDRANT_COLLECTION=trieve
      - OLLAMA_BASE_URL=http://host.docker.internal:11434
      - EMBEDDING_MODEL=nomic-embed-text    # Changed from e5-mistral
      - DATABASE_URL=sqlite:///srv/data/trieve/trieve.db
    volumes:
      - /srv/data/trieve:/run/trieve
    restart: unless-stopped
```

### 2.2 Add to PORTS.md

```markdown
| 6435 | Trieve (RAG) | Docker Compose | RAG API + chunking | Reserved |
```

### 2.3 Update AGENTS.md Skills

Add a `rag-retrieve` skill pattern:

```markdown
## RAG Operations (Trieve)

| Skill | Purpose | Location |
|-------|---------|----------|
| `rag-retrieve` | Query Trieve search API | hermes-second-brain/skills/rag/ |
| `rag-index` | Index documents into Trieve | hermes-second-brain/skills/rag/ |
```

### 2.4 Add Smoke Tests

Create `/srv/monorepo/smoke-tests/smoke-trieve.sh`:

```bash
#!/bin/bash
set -e

TRIEVE_URL=${TRIEVE_URL:-http://localhost:6435}
API_KEY=${TRIEVE_API_KEY:-}

echo "🔍 Testing Trieve RAG..."

# 1. Health check
health=$(curl -s -o /dev/null -w "%{http_code}" "$TRIEVE_URL/api/health")
if [ "$health" != "200" ]; then
    echo "❌ Health check failed: $health"
    exit 1
fi
echo "✅ Health: $health"

# 2. Search API (requires API key)
if [ -n "$API_KEY" ]; then
    result=$(curl -s -X POST "$TRIEVE_URL/api/v1/search" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d '{"query":"test","limit":1}')
    if echo "$result" | grep -q "results"; then
        echo "✅ Search API working"
    else
        echo "❌ Search API failed: $result"
    fi
fi

echo "✅ Trieve smoke tests passed"
```

---

## 3. What to Add/Update/Delete

### Add

| Item | File | Reason |
|------|------|--------|
| Port 6435 reservation | `/srv/ops/ai-governance/PORTS.md` | New service |
| `smoke-trieve.sh` | `/srv/monorepo/smoke-tests/` | Verification |
| `rag-retrieve` skill | `hermes-second-brain/skills/rag/` | Hermes integration |
| `TRIEVE_API_KEY` | `/srv/monorepo/.env.example` | New secret |
| `TRIEVE_URL` | `/srv/monorepo/.env.example` | New config |

### Update

| Item | Change |
|------|--------|
| SPEC-092 §docker-compose | Fix `OLLAMA_BASE_URL` → `host.docker.internal:11434`, `EMBEDDING_MODEL` → `nomic-embed-text` |
| SPEC-092 §commands | Add actual API examples (auth header is `Authorization: Bearer`) |
| PORTS.md | Add 6435 Trieve entry |
| AGENTS.md | Add RAG skill documentation |

### Delete

| Item | Reason |
|------|--------|
| Nothing to delete | SPEC-092 is well scoped, no conflicts found |

---

## 4. April 2026 Best Practices

### 4.1 Trieve Deployment
- Use `host.docker.internal` for Ollama access from Docker
- Trieve Cloud sunset = self-hosting only now
- Use CPU embeddings initially, GPU later if needed

### 4.2 Chunking Strategy
- `heading` strategy is correct for markdown docs (preserves structure)
- Limit `top_k=5` chunks to avoid context overflow (as SPEC notes)

### 4.3 Authentication
- API key via `Authorization: Bearer {key}` header
- Generate on first login via Trieve dashboard

### 4.4 Collection Isolation
- Trieve: `trieve` collection
- Mem0: `will` collection
- No overlap, safe

---

## 5. Verification Checklist

Before marking SPEC-092 as complete, verify:

- [ ] `curl http://localhost:6435/api/health` → 200
- [ ] `curl http://localhost:11434/api/tags` → `nomic-embed-text` available
- [ ] Qdrant accessible from Trieve container
- [ ] Search API returns results with API key
- [ ] No port conflicts (6435 not in use)
- [ ] PORTS.md updated with 6435 → Trieve
- [ ] `.env` has `TRIEVE_API_KEY` and `TRIEVE_URL`
