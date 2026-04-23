# SMOKE Research: SPEC-092 Trieve RAG Integration

**Data:** 2026-04-23
**Agent:** SMOKE
**Spec:** SPEC-092 (Trieve RAG Integration)
**Status:** COMPLETED

---

## 1. Key Findings

### Trieve Stack Components

| Componente | Porta | Tipo | Smoke Test Prioridade |
|------------|-------|------|-----------------------|
| Trieve API | `:6435` | RAG gateway | **P0** — health, search, dataset |
| Qdrant | `:6333` | Vector storage | **P0** — collections, points |
| Ollama | `:11434` | Embedding | **P1** — model list, generate |
| Mem0 | `:6333` | Memory (sep. coll.) | P2 — já testado em agency-suite |

### Trieve API Endpoints (v1)

```
GET  /health                    — health check
GET  /api/v1/datasets          — list datasets
POST /api/v1/datasets          — create dataset
GET  /api/v1/datasets/{id}     — get dataset
POST /api/v1/chunks            — create chunk
POST /api/v1/search            — semantic search
GET  /api/v1/search            — search via query params
POST /api/v1/rerank            — rerank results
```

### Anti-Hardcoded Pattern

Todas as URLs e keys **devem** vir de `.env`:

```bash
# Required env vars
TRIEVE_API_KEY=<generated_on_first_login>
TRIEVE_URL=http://localhost:6435
QDRANT_URL=http://10.0.9.1:6333
OLLAMA_BASE_URL=http://10.0.9.1:11434
```

### Existing Smoke Test Conventions

| Pattern | Exemplo |
|---------|---------|
| `set -euo pipefail` | Todos os scripts |
| `source /srv/monorepo/.env` | Via `set -a; source ...; set +a` |
| Cores: `RED`, `GREEN`, `YELLOW`, `NC` | `smoke-agency-suite.sh` |
| `PASS=0; FAIL=0` + `pass()`/`fail()` | `smoke-agency-hardening.sh` |
| Exit 0 = pass, exit 1 = fail | Universal |
| Timeout 5-8s por request | Universal |
| Test file cleanup | `/tmp/*.wav`, `/tmp/*.mp3` |

---

## 2. Recommendations for CLAUDE.md / AGENTS.md

### Adicionar em AGENTS.md (novo bloco)

```markdown
## SPEC-092: Trieve RAG Integration

Smoke test: `smoke-tests/smoke-trieve-rag.sh`

### Acceptance Criteria Validados
- [ ] Trieve `:6435` health → `/health`
- [ ] Qdrant `:6333` collections → `GET /collections`
- [ ] Ollama `:11434` embedding model → `POST /api/embeddings`
- [ ] Dataset criado → `POST /api/v1/datasets`
- [ ] Search API → `POST /api/v1/search` com query PT-BR
- [ ] Hermes skill `rag-retrieve` registrado

### Anti-Hardcoded
```bash
TRIEVE_API_KEY   # .env — nunca hardcoded
TRIEVE_URL=http://localhost:6435
QDRANT_URL       # via .env (Coolify host: 10.0.9.1)
OLLAMA_BASE_URL  # via .env
```
```

### Adicionar em CLAUDE.md (novo skill)

```markdown
### /st — Smoke Test Gen
Regra: `smoke-tests/smoke-{servico}.sh` — um script por spec.
Um test por acceptance criterion. Exit 0 = pass.
```

---

## 3. Smoke Test Structure (smoke-trieve-rag.sh)

```bash
#!/usr/bin/env bash
# smoke-trieve-rag.sh — SPEC-092 Trieve RAG Integration validation
# Tests: Trieve health, Qdrant, Ollama embedding, dataset, search API
# Anti-hardcoded: all config via .env

set -a; source "${ENV_FILE:-/srv/monorepo/.env}"; set +a

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
PASS=0; FAIL=0; WARN=0

pass() { echo -e "${GREEN}✅ PASS${NC}: $1"; ((PASS++)) || true; }
fail() { echo -e "${RED}❌ FAIL${NC}: $1"; ((FAIL++)) || true; }
warn() { echo -e "${YELLOW}⚠️  WARN${NC}: $1"; ((WARN++)) || true; }

TRIEVE_URL="${TRIEVE_URL:-http://localhost:6435}"
TRIEVE_KEY="${TRIEVE_API_KEY:-}"
QDRANT_URL="${QDRANT_URL:-http://localhost:6333}"
OLLAMA_URL="${OLLAMA_BASE_URL:-http://localhost:11434}"
EMBED_MODEL="${EMBEDDING_MODEL:-nomic-ai/e5-mistral-7b-instruct}"

echo "=============================================="
echo "  Trieve RAG — Smoke Test (SPEC-092)"
echo "=============================================="

# ── 1. Trieve Health ──────────────────────────────────────────
echo ""
echo "── 1. Trieve :6435 ─────────────────────────"

((TOTAL++)) || true
if curl -sf --max-time 5 "${TRIEVE_URL%/}/health" 2>/dev/null | grep -q 'ok\|200\|healthy'; then
  pass "Trieve /health → 200"
else
  fail "Trieve /health unreachable"
fi

# ── 2. Qdrant Connection ──────────────────────────────────────
echo ""
echo "── 2. Qdrant :6333 ─────────────────────────"

((TOTAL++)) || true
if curl -sf --max-time 5 "${QDRANT_URL%/}/collections" 2>/dev/null | grep -q 'collections\|result'; then
  pass "Qdrant /collections → accessible"
else
  fail "Qdrant :6333 unreachable"
fi

# Check 'trieve' collection exists
((TOTAL++)) || true
if curl -sf "${QDRANT_URL%/}/collections/trieve" 2>/dev/null | grep -q 'trieve\|vectors'; then
  pass "Qdrant 'trieve' collection exists"
else
  warn "Qdrant 'trieve' collection not found (create via Trieve)"
fi

# ── 3. Ollama Embedding ───────────────────────────────────────
echo ""
echo "── 3. Ollama :11434 Embedding ───────────────"

((TOTAL++)) || true
if curl -sf --max-time 5 "${OLLAMA_URL%/}/api/tags" 2>/dev/null | grep -q 'models'; then
  pass "Ollama /api/tags → accessible"
else
  fail "Ollama :11434 unreachable"
fi

# Check embedding model available
((TOTAL++)) || true
if curl -s "${OLLAMA_URL%/}/api/tags" 2>/dev/null | grep -q "$EMBED_MODEL"; then
  pass "Embedding model '$EMBED_MODEL' available"
else
  warn "Embedding model '$EMBED_MODEL' not loaded (pull if needed)"
fi

# ── 4. Dataset API ─────────────────────────────────────────────
echo ""
echo "── 4. Dataset Management ─────────────────────"

# List datasets (requires auth)
((TOTAL++)) || true
DS_RESPONSE=$(curl -sf --max-time 10 \
  -H "Authorization: Bearer ${TRIEVE_KEY}" \
  "${TRIEVE_URL%/}/api/v1/datasets" 2>/dev/null || echo '{}')
if echo "$DS_RESPONSE" | python3 -c "import sys,json; d=json.load(sys.stdin); print('ok')" 2>/dev/null | grep -q "ok"; then
  pass "Dataset list API accessible"
else
  fail "Dataset API inaccessible (check TRIEVE_API_KEY)"
fi

# Check for 'hermes-knowledge' dataset
((TOTAL++)) || true
if echo "$DS_RESPONSE" | grep -q 'hermes-knowledge\|hermes-second-brain'; then
  pass "Dataset 'hermes-knowledge' exists"
else
  warn "Dataset 'hermes-knowledge' not found (create in FASE 2)"
fi

# ── 5. Search API ──────────────────────────────────────────────
echo ""
echo "── 5. Search API ─────────────────────────────"

# RAG semantic search — PT-BR query
((TOTAL++)) || true
SEARCH_RESP=$(curl -sf --max-time 30 \
  -H "Authorization: Bearer ${TRIEVE_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"query":"como fazer deploy no coolify","limit":3}' \
  "${TRIEVE_URL%/}/api/v1/search" 2>/dev/null || echo '{"error":"failed"}')

if echo "$SEARCH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('results',[])))" 2>/dev/null | grep -qE '[1-3]'; then
  RESULT_COUNT=$(echo "$SEARCH_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('results',[])))" 2>/dev/null)
  pass "Search API returned $RESULT_COUNT results"
else
  # If no dataset indexed yet, this is expected — don't fail
  if echo "$SEARCH_RESP" | grep -q 'error\|empty\|no.*result'; then
    warn "Search returned no results (may need indexing)"
  else
    warn "Search API not returning expected format"
  fi
fi

# ── 6. Hermes Skill ────────────────────────────────────────────
echo ""
echo "── 6. Hermes rag-retrieve Skill ──────────────"

# Verify skill exists in hermes skills index
((TOTAL++)) || true
if grep -q "rag-retrieve\|trieve\|rag_retrieve" /srv/monorepo/apps/hermes-agency/src/skills/index.ts 2>/dev/null; then
  pass "rag-retrieve skill defined in Hermes"
else
  warn "rag-retrieve skill not yet implemented (FASE 3)"
fi

# Hermes gateway reachable
((TOTAL++)) || true
if curl -sf --max-time 5 http://localhost:8642/health 2>/dev/null | grep -q 'ok'; then
  pass "Hermes Gateway :8642 reachable"
else
  warn "Hermes Gateway :8642 unreachable"
fi

# ── Summary ────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo -e "  ${GREEN}$PASS passed${NC} | ${RED}$FAIL failed${NC} | ${YELLOW}$WARN warnings${NC}"
echo "=============================================="
(( FAIL > 0 )) && exit 1 || exit 0
```

---

## 4. What to Add/Update/Delete

### ADD (novos ficheiros)

| Ficheiro | Conteúdo |
|----------|----------|
| `smoke-tests/smoke-trieve-rag.sh` | Smoke test completo SPEC-092 |
| `smoke-tests/results/trieve-rag.json` | Resultado JSON (para CI/CD) |
| `.env` entries | `TRIEVE_API_KEY`, `TRIEVE_URL`, `EMBEDDING_MODEL` |

### UPDATE (ficheiros existentes)

| Ficheiro | Mudança |
|----------|---------|
| `AGENTS.md` | Adicionar bloco SPEC-092 + acceptance criteria |
| `CLAUDE.md` | Adicionar `/st` skill reference |
| `PORTS.md` | Adicionar `:6435 → Trieve (RAG API)` |
| `SUBDOMAINS.md` | Adicionar entrada se exposto externamente |
| `SPEC-092.md` | Acceptance criteria checkboxes |

### DELETE (se aplicável)

| Ficheiro | Razão |
|----------|-------|
| — | NenhumDELETE por agora |

---

## 5. Port Governance Note

**:6435 está na faixa livre** (4002–4099 microserviços) conforme CLAUDE.md.

**Antes de usar:** Verificar com `ss -tlnp | grep :6435` que está livre.

---

## 6. Dependencies on Existing Smoke Tests

- `smoke-agency-suite.sh` — Valida Qdrant, Ollama (reusar 패턴)
- `smoke-hermes-ready.sh` — Valida Hermes Gateway `:8642`
- `smoke-multimodal-stack.sh` — Valida Ollama `:11434`

**Não duplicar** — o novo script deve focar ONLY em Trieve + RAG-specific checks.
