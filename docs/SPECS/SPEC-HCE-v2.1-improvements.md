# SPEC-HCE-v2.1-improvements.md

## Context

HCE (Hermes Context Engine) v2.0 delivered on commit c70d70a:
- `services/sync-engine.py` — scanner + embeddings + Qdrant upsert working
- `libs/context/ranker.py` — PageRank + token budget working
- `apps/api/context.py` — POST /context and GET /context/health working

## Critical Blockers for Production

1. `libs/memory/manager.py` throws `sqlite3.DatabaseError: file is not a database` on import — API fails to start cleanly
2. Zero tests for ranker/context/sync
3. No rate limit on /context — open to Ollama DDoS

## Execution Plan

### Phase 1: Fix SQLite Bootstrap
- Detect corruption on `sqlite3.connect()`
- If corrupted: log warning, delete file, recreate schema
- Must allow API to start cleanly every time
- Run `curl -sf http://localhost:8642/health` to verify

### Phase 2: Write Tests
- `tests/test_ranker.py` — PageRank convergence, token budget truncation
- `tests/test_context.py` — POST /context shape, health endpoint
- `tests/test_sync_engine.py` — mock Qdrant upsert, embedding call
- Delete old tests if any; create new ones

### Phase 3: Rate Limit Middleware
- `apps/api/rate_limit.py` — in-memory sliding window
- Applied to POST /context only
- Configurable via env vars (no hardcoded secrets)
- Return 429 with PT-BR message: "Muitas requisições. Aguarde um momento."

### Phase 4: Async Embeddings + Content-Hash Skip
- Convert sync-engine embedding calls to async (aiohttp)
- Skip upsert if content hash unchanged (SHA-256)
- Reduce redundant Qdrant writes

## Constraints
- Accept any in factory hooks (OrchidORM limitation) — not applicable here, Python code
- Delete old tests, never fix them — but we have zero tests, so create new
- Commit atomic per phase
- Nunca hardcodar secrets, usar `os.environ.get()`
- UI/texto em PT-BR, código/commits em EN
