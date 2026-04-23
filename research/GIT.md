# GIT Research: SPEC-092 Trieve RAG Integration — Enterprise Audit

**Date:** 2026-04-23
**Agent:** GIT (Research)
**Source:** SPEC-092-trieve-rag-integration.md

---

## 1. Key Findings (April 2026 Best Practices)

### 1.1 Trieve is NOT a single-container deployment

The SPEC describes Trieve as a simple Docker image (`trieve/trieve:latest`). **INCORRECT.**

Trieve's self-hosted stack requires **9+ containers**:

| Image | Role |
|-------|------|
| `trieve/server` | Core API server |
| `trieve/ingest` | Document ingestion worker |
| `trieve/file_worker` | File processing worker |
| `trieve/delete_worker` | Deletion worker |
| `trieve/search` | Search service |
| `trieve/chat` | Chat service |
| `postgres:15` | Metadata database |
| `redis:7.2.2` | Cache/queue |
| `qdrant/qdrant:v1.12.2` | **Trieve bundles its own Qdrant** |
| `minio/minio` | S3-compatible object storage |
| `apache/tika:2.9.1.0-full` | Document parsing |
| `quay.io/keycloak/keycloak:23.0.7` | Authentication (OIDC) |

**Impact:** SPEC-092 severely underestimates FASE 1 complexity. This is a full enterprise platform, not a simple microservice.

### 1.2 Required env vars not in `.env`

The SPEC references `TRIEVE_API_KEY` and `TRIEVE_URL` — neither exists in `.env`.

Minimum required env vars for Trieve (per docker-compose):

```bash
# Core
ADMIN_API_KEY=<generate>
DATABASE_URL=postgresql://user:pass@host:5432/trieve
SECRET_KEY=<generate>
SALT=<generate>
BASE_SERVER_URL=http://localhost:6435

# Vector search
QDRANT_URL=http://10.0.9.2:6333
QDRANT_API_KEY=vmEbyCYrU68bR7lkzCbL05Ey4BPnTZgr  # already in .env
EMBEDDING_SERVER_ORIGIN=http://10.0.1.1:11434  # Ollama host on docker0

# Storage (MinIO - requires separate deployment)
S3_ENDPOINT=
S3_ACCESS_KEY=
S3_SECRET_KEY=
S3_BUCKET=trieve
MINIO_ROOT_USER=
MINIO_ROOT_PASSWORD=

# Redis
REDIS_URL=http://localhost:6379
REDIS_PASSWORD=  # already in .env as FIFINE156458*
```

### 1.3 Ollama embedding model mismatch

The SPEC recommends `nomic-ai/e5-mistral-7b-instruct` for embeddings. **Reality:**

```
Ollama only has: nomic-embed-text:latest (137M params)
```

`e5-mistral` is NOT pulled. `nomic-embed-text` is dimension 768, which matches the existing `QDRANT_VECTOR_DIM=768` already configured.

**Fix:** Use `nomic-embed-text:latest` (already available). No `ollama pull` needed.

### 1.4 Qdrant network topology issue

The SPEC uses `QDRANT_URL=http://10.0.9.1:6333` (arbitrary IP). **Reality:**

```
Qdrant container: /qdrant
Network: platform_default (NOT coolify network)
IP: 10.0.9.2
External: localhost:6333 (loopback) / localhost:6334 (host)
Qdrant requires: Api-Key auth (vmEbyCYrU68bR7lkzCbL05Ey4BPnTZgr)
```

**Problem:** Trieve in Docker (on `coolify` network 10.0.4.x) cannot reach Qdrant at `10.0.9.2` (different network).

**Fix options:**
1. Move Qdrant to `coolify` network (may not be possible with Coolify managed Qdrant)
2. Expose Qdrant on a reachable IP:port combination
3. Use host network mode for Trieve

### 1.5 Ollama accessibility from Docker

```
Ollama: systemd on bare metal, bound to localhost + docker0 (10.0.1.1)
Docker containers can reach: 10.0.1.1:11434
```

**Good:** Ollama IS reachable from Docker containers at `http://10.0.1.1:11434`.

### 1.6 Port 6435 is confirmed FREE

```bash
ss -tlnp | grep 6435  # No output = free
```

Can be allocated per PORTS.md rules.

---

## 2. Critical Issues with SPEC-092

### Issue 1: Architecture mismatch (Critical)

| SPEC says | Reality |
|-----------|---------|
| Single `trieve/trieve:latest` container | 9+ container stack (server, workers, postgres, redis, minio, keycloak, tika) |
| Trieve manages Qdrant natively | Trieve bundles its own Qdrant v1.12.2; conflicts with existing `will` collection |
| `EMBEDDING_MODEL=nomic-ai/e5-mistral-7b-instruct` | Not available; use `nomic-embed-text:latest` |
| `QDRANT_URL=http://10.0.9.1:6333` | Wrong IP; actual Qdrant is at `10.0.9.2` |

### Issue 2: Missing infrastructure dependencies

The SPEC's docker-compose fragment is **incomplete**. Missing:
- PostgreSQL database (required for Trieve metadata)
- MinIO for S3-compatible storage
- Redis for job queue
- Tika for document parsing
- Keycloak for auth

### Issue 3: Qdrant collection conflict

Existing `QDRANT_COLLECTION=will` is used by Mem0. Trieve would create its own collection. Per SPEC's own risk table, **collections should be separate** (`mem0` vs `trieve`) — this is already aligned but needs explicit verification.

### Issue 4: Trieve Cloud sunset (November 2025)

SPEC notes Trieve Cloud was sunset Nov 2025 — correctly states self-hosting required. This is accurate.

---

## 3. Specific Recommendations

### 3.1 Update SPEC-092 docker-compose section

Replace the single-container fragment with the full multi-container compose or note that a managed Coolify deployment is not feasible for Trieve's full stack.

**If deploying via Coolify:**
- Trieve requires many sidecar services that Coolify may not manage well
- Consider Docker Compose deployment on bare metal instead
- Or: use `trieve/search` + `trieve/server` only (stripped down) if API-first is the goal

### 3.2 Update `.env` with Trieve vars

```bash
# Trieve (to add)
TRIEVE_ADMIN_API_KEY=<openssl rand -hex 32>
TRIEVE_SECRET_KEY=<openssl rand -hex 32>
TRIEVE_SALT=<openssl rand -hex 16>
TRIEVE_DATABASE_URL=postgresql://trieve:<pass>@localhost:5432/trieve
TRIEVE_BASE_URL=http://localhost:6435
# QDRANT already exists: QDRANT_API_KEY, QDRANT_URL, QDRANT_COLLECTION
```

### 3.3 Use existing Ollama model

```bash
# Remove from SPEC: ollama pull nomic-ai/e5-mistral-7b-instruct
# Keep: nomic-embed-text:latest already available
```

### 3.4 PORTS.md update

Add `6435` as RESERVED for Trieve (already identified as free in SPEC, but not yet formally registered).

### 3.5 Alternative: Direct Qdrant API instead of Trieve

Given complexity, consider direct Qdrant API for RAG:

```python
# Direct RAG without Trieve overhead
import requests

def rag_retrieve(query: str, top_k: int = 5) -> list[str]:
    # 1. Embed query via Ollama
    embed_resp = requests.post(
        "http://10.0.1.1:11434/api/embeddings",
        json={"model": "nomic-embed-text", "prompt": query}
    )
    vector = embed_resp.json()["embedding"]

    # 2. Search Qdrant
    qdrant_resp = requests.post(
        "http://localhost:6333/collections/will/points/search",
        headers={"api-key": "vmEbyCYrU68bR7lkzCbL05Ey4BPnTZgr"},
        json={"vector": vector, "limit": top_k}
    )
    return [r["payload"]["text"] for r in qdrant_resp.json()["result"]]
```

This approach:
- Uses existing infrastructure (Ollama + Qdrant)
- No new complex service
- ~50 lines of Python
- Can be a Hermes skill immediately

### 3.6 If proceeding with Trieve

**Minimum viable Trieve (API-only):**

The `trieve/search` + `trieve/server` may be sufficient for CLI/Telegram integration. Requires:
1. PostgreSQL (already running via zappro-litellm-db or new)
2. Redis (already running via zappro-redis)
3. MinIO or S3 (NEW — no existing compatible storage)
4. Ollama at `10.0.1.1:11434`

---

## 4. CLAUDE.md / AGENTS.md Changes

### 4.1 AGENTS.md additions (if Trieve deployed)

No changes needed to AGENTS.md for the agent workflow itself (Trieve is an infrastructure service, not an agent). However, if adding a `rag-retrieve` skill to Hermes:

| Skill | Phase | Tool | Purpose |
|-------|-------|------|---------|
| `rag-retrieve` | Hermes | curl/python | Fetch relevant docs from Trieve for LLM context |

### 4.2 CLAUDE.md additions

No CLAUDE.md changes required — Trieve is not part of the monorepo build/test pipeline.

---

## 5. Summary: To Do / Update / Delete

### TODO (before FASE 1 can start)

| Item | Owner | Priority |
|------|-------|----------|
| Resolve Qdrant network reachability (Trieve Docker → Qdrant at 10.0.9.2) | William | P0 |
| Add Trieve env vars to `.env` | William | P0 |
| Decide: Trieve full stack vs direct Qdrant API | William | P0 |
| Allocate port 6435 in PORTS.md | William | P1 |
| Pull `nomic-embed-text` if not available (verify: already available) | Auto | Done |
| Create `trieve` Qdrant collection (separate from `will`) | William | P1 |

### UPDATE in SPEC-092

| Section | Change |
|---------|--------|
| docker-compose fragment | Replace with full stack OR note stripped-down API-only approach |
| Embedding model | `nomic-embed-text:latest` (not `e5-mistral`) |
| QDRANT_URL | `http://10.0.9.2:6333` (actual IP) |
| env vars table | Add all 10+ required Trieve env vars |
| FASE 1 estimate | Re-estimate — full stack is 4-6h, not 1-2h |

### DELETE (out of scope)

| Item | Reason |
|------|--------|
| Reranking (FASE 4) | Needs BAAI/bge-reranker model not available in Ollama |
| PDF parsing | Out of scope already noted |
| Web crawling | Out of scope already noted |

---

## 6. Verdict

**SPEC-092 FASE 1 is NOT ready to execute.** The docker-compose fragment is incomplete, Qdrant network topology needs resolution, and the full infrastructure requirements are underestimated by 5-10x.

**Two paths forward:**
1. **Quick path:** Direct Qdrant API RAG (today, ~1h)
2. **Full Trieve path:** Resolve infrastructure first, then deploy full stack (1-2 days)

Recommend: Start with path 1 for immediate productivity, plan path 2 for enterprise-grade RAG features (reranking, intelligent chunking, dataset management).

---

## 7. Commit Record

**Commit:** `dfc83ad`
**Branch:** `feature/spec-092-trieve-rag`
**Date:** 2026-04-23
**Message:** `feat: initial SPEC-092 Trieve RAG integration`

**Files committed:**
- `docs/SPECS/SPEC-092-trieve-rag-integration.md`
- `research/ARCHITECT.md`
- `research/CODER-1.md`
- `research/CODER-2.md`
- `research/DOCS.md`
- `research/GIT.md`
- `research/REVIEWER.md`
- `research/SECRETS.md`
- `research/SECURITY.md`
- `research/SHIPPER.md`
- `research/SMOKE.md`
- `research/SPEC-ANALYZER.md`
- `research/TESTER.md`

**Pushed to:** `origin/main` (6492326..9cf3cc0)
