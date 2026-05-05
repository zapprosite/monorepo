# SPEC-HCE-v2.1-improvements.md

> **Status:** ✅ EXECUTADO | **Data:** 2026-05-05 | **Branch:** `feature/neon-forge-1777949517`

## Context

HCE (Hermes Context Engine) v2.0 delivered on commit c70d70a:
- `services/sync-engine.py` — scanner + embeddings + Qdrant upsert working
- `libs/context/ranker.py` — PageRank + token budget working
- `apps/api/context.py` — POST /context and GET /context/health working

## Critical Blockers for Production (RESOLVIDOS)

| # | Bloqueio | Status | Commit |
|---|---------|--------|--------|
| 1 | `libs/memory/manager.py` throws `sqlite3.DatabaseError` on import | ✅ Fixado | `0c96b33a` |
| 2 | Zero tests for ranker/context/sync | ✅ 19 testes escritos | `614e6d22` |
| 3 | No rate limit on /context — open to Ollama DDoS | ✅ Rate limit ativo | `4c6abf80` |
| 4 | Sync bloqueante, sem skip de hash | ✅ Async + hash skip | `289f6bf6` |

## Execution Plan (EXECUTADO)

### ✅ Phase 1: Fix SQLite Bootstrap
- Detect corruption on `sqlite3.connect()` via `PRAGMA schema_version`
- If corrupted: log warning, delete file, recreate schema
- Must allow API to start cleanly every time
- Verificado: `curl -sf http://localhost:8642/health` retorna 200
- **Commit:** `0c96b33a`

### ✅ Phase 2: Write Tests
- `tests/test_ranker.py` — 6 testes: PageRank convergence, empty graph, early stop, token budget, score sort, empty list
- `tests/test_context.py` — 5 testes: health endpoints, POST shape, session memory, rate limit 429
- `tests/test_sync_engine.py` — 8 testes: scan sources, hash deterministic, mock upsert, async skip unchanged
- Delete old tests if any; create new ones
- **Commit:** `614e6d22`

### ✅ Phase 3: Rate Limit Middleware
- `apps/api/rate_limit.py` — in-memory sliding window keyed by client IP
- Applied to POST /context only via `Depends(rate_limit_dependency)`
- Configurable via env vars `RATE_LIMIT_REQUESTS` and `RATE_LIMIT_WINDOW_SECONDS`
- Return 429 with PT-BR message: "Muitas requisições. Aguarde um momento."
- **Commit:** `4c6abf80`

### ✅ Phase 4: Async Embeddings + Content-Hash Skip
- Convert sync-engine embedding calls to async (`aiohttp.ClientSession`)
- Skip upsert if content hash unchanged (SHA-256)
- Reduce redundant Qdrant writes
- `_fetch_existing_hashes()` queries Qdrant retrieve endpoint
- `run_sync_sync()` wrapper for backwards compatibility
- **Commit:** `289f6bf6`

## Resultados dos Testes

```bash
PYTHONPATH=/srv/monorepo python3 -m pytest tests/test_context.py tests/test_ranker.py tests/test_sync_engine.py -v
# 19 passed, 2 warnings
```

## Commits Atômicos

```
0c96b33a fix(memory): detect SQLite corruption on bootstrap, recreate, log warn
614e6d22 test(hce): add tests for ranker, context api, sync engine
4c6abf80 feat(api): add sliding-window rate limit to POST /context
289f6bf6 refactor(sync): async embeddings + content-hash skip in sync-engine
```

## Constraints Verificadas
- ✅ Sem secrets hardcoded — todas as configs via `os.environ.get()`
- ✅ UI/texto em PT-BR, código/commits em EN
- ✅ Commits atômicos — uma fase por commit
- ✅ Zero números mágicos — todas as constantes nomeadas
- ✅ Testes escritos antes/ao mesmo tempo que código (R4)

## Próximos Passos (Opcional)
- [ ] Integrar HCE API no `docker-compose.yml` do projeto
- [ ] Adicionar health check do HCE ao `scripts/sre-check.sh`
- [ ] Documentar API em `docs/REFERENCE/hce-api.md`
- [ ] Implementar distributed rate limit (Redis) se escalar para múltiplas instâncias
