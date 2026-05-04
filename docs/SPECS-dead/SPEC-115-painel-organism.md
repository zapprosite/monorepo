# SPEC-115 — Painel Organism — MCP Server Panel

**Data:** 2026-04-23
**Autor:** William Rodrigues
**Status:** AUDITED
**Review:** Claude Code CLI

---

## 1. Resumo

Sistema de painel de controlo para o homelab multi-claude — expõe MCP servers como endpoints geríveis. Stack completo com 6 MCP servers (4011-4016) operacionais.

**Nota:** `painel-organism` refere-se ao painel de organismos MCP — gestão centralizada de todos os MCP servers.

**Audit Date:** 2026-04-23 — Coolify v4.0.0-beta.474 Released

---

## 2. Arquitetura

### 2.1 MCP Servers (Ports 4011-4016)

| Port | Server | Backend | Status (2026-04-23) |
|------|--------|---------|---------------------|
| :4011 | mcp-qdrant | Qdrant (Vector DB) | ✅ Working |
| :4012 | mcp-coolify | Coolify API | ❌ Not Found |
| :4013 | mcp-ollama | Ollama (RTX 4090) | ❌ Not Found |
| :4014 | mcp-system | ZFS/Docker/System | ❌ Not Found |
| :4015 | mcp-cron | Cron Jobs | ❌ Not Found |
| :4016 | mcp-memory | Qdrant + LiteLLM | ✅ Working |

### 2.2 Capabilities Table

| Capability | Provider | Model | Status |
|------------|----------|-------|--------|
| Vector Search | Qdrant | — | ✅ Active |
| Coolify Management | Coolify API | — | ⚠️ Needs Restart |
| Ollama Models | Ollama | nomic-ai/qwen2.5:3b | ⚠️ Needs Restart |
| System Metrics | ZFS/Docker | — | ⚠️ Needs Restart |
| Cron Jobs | System | — | ⚠️ Needs Restart |
| Semantic Memory | Qdrant + LiteLLM | embedding-nomic (via LiteLLM) | ✅ Active |

### 2.3 LiteLLM Integration

**embedding-nomic model via LiteLLM:**

```
LiteLLM Proxy :4000
      │
      ├── embedding-nomic (nomic-ai/qwen2.5:3b)
      │    └── Used by: mcp-memory (4016) for semantic search
      │
      └── Qdrant :6333
           └── Vector storage for memory embeddings
```

** LiteLLM Config for embeddings:**
```bash
model_list:
  - model_name: embedding-nomic
    litellm_params:
      model: nomic-ai/qwen2.5:3b
      api_base: http://localhost:11434
```

---

## 3. Painel Organism Structure

```
apps/painel-organism/
├── src/
│   └── components/           # Ink components for terminal UI
├── dist/                     # Build output
└── package.json
```

---

## 4. Semantic Search (mcp-memory)

**Stack:**
- **Memory Manager:** mem0ai wrapper
- **Vector DB:** Qdrant (`:6333`)
- **Embeddings:** LiteLLM proxy (`embedding-nomic`) → Ollama E5-mistral
- **Collection:** `will` (default)

**Verification:**
```bash
# Health check all MCP servers
curl http://localhost:4011/health  # mcp-qdrant
curl http://localhost:4012/health  # mcp-coolify
curl http://localhost:4013/health  # mcp-ollama
curl http://localhost:4014/health  # mcp-system
curl http://localhost:4015/health  # mcp-cron
curl http://localhost:4016/health  # mcp-memory

# LiteLLM embeddings working
curl -X POST http://localhost:4000/embeddings \
  -H "Content-Type: application/json" \
  -d '{"model": "embedding-nomic", "input": "test embedding"}'
```

---

## 5. Coolify v4.0.0-beta.474 — Abril 2026

### Security Hardening (CRITICAL)

| Fix | Description |
|-----|-------------|
| #9654 | Prevent data loss when persistent containers are pruned during service deletion |
| #9652 | Encrypt manual webhook secrets, strengthen HMAC signature verification |
| #9672 | Upgrade email verification hash, fix invitation link login |
| #9653 | Validate and rate-limit feedback endpoint |
| #9666 | Volume name and path validation with shell argument escaping |
| #9667 | Validate backup upload file type and size limits |
| #9668 | Tighten S3 endpoint URL validation |
| #9670 | Harden dev helper version validation |
| #9674 | Database credential validation (Postgres, MySQL, MariaDB) |

### API Changes

| Feature | Description |
|---------|-------------|
| #9677 | Optional expiration for API tokens with advance notification |
| #9614 | DELETE endpoint to remove preview deployments by PR ID |
| #9684 | Improved shell command tokenization |

### Deprecated

| Item | Removal |
|------|---------|
| Docker Swarm | Deprecated in v4, removed in v5 |

### New Services (v4.0.0-beta.472)

- Grimmory (Booklore successor)
- ElectricSQL
- EspoCRM
- LibreSpeed
- imgcompress
- Satisfactory game server

### Template Updates

- Supabase templates comprehensively updated
- Nextcloud healthcheck interval increased
- Rivet updated to v2.2.0
- Convex to latest version

---

## 6. Health Endpoint Analysis

### Current State (2026-04-23)

| Server | Port | Health Endpoint | Protocol | Status |
|--------|------|-----------------|----------|--------|
| mcp-memory | 4016 | `/health` | FastAPI | ✅ 200 OK |
| mcp-qdrant | 4011 | None | Qdrant TCP | ✅ Working |
| mcp-coolify | 4012 | `/health` | FastAPI+FastMCP | ✅ 200 OK |
| mcp-ollama | 4013 | `/health` | FastAPI+FastMCP | ✅ 200 OK |
| mcp-system | 4014 | `/health` | FastAPI+FastMCP | ✅ 200 OK |
| mcp-cron | 4015 | `/health` | FastAPI+FastMCP | ✅ 200 OK |

### Root Cause (Resolved)

- **Before**: Servers used `fastmcp.FastMCP` which provides SSE-only MCP protocol (no HTTP REST endpoints)
- **Solution**: Added FastAPI with `/health` endpoint alongside FastMCP using threading
- **Implementation**: FastMCP runs in daemon thread, FastAPI handles HTTP health checks

### Changes Made

1. Added `fastapi` and `uvicorn` to Dockerfile dependencies
2. Created FastAPI app with `/health` and `/` endpoints
3. FastMCP runs in `threading.Thread(daemon=True)` to avoid asyncio conflict
4. Updated `CMD` to use `uvicorn server:app`

---

## 7. Action Items

- [x] Add `/health` endpoint to mcp-coolify server ✅ 2026-04-23
- [x] Add `/health` endpoint to mcp-ollama server ✅ 2026-04-23
- [x] Add `/health` endpoint to mcp-system server ✅ 2026-04-23
- [x] Add `/health` endpoint to mcp-cron server ✅ 2026-04-23
- [ ] Update docker-compose healthcheck for each
- [ ] Verify Coolify v4.0.0 upgrade on production
- [ ] Check Docker Swarm deprecation impact
- [ ] Review webhook secret rotation

---

## 8. Status: HEALTH ENDPOINTS ADDED

| Component | Status | Notes |
|-----------|--------|-------|
| mcp-qdrant (4011) | ✅ Working | Qdrant TCP |
| mcp-coolify (4012) | ✅ Fixed | `/health` returns 200 |
| mcp-ollama (4013) | ✅ Fixed | `/health` returns 200 |
| mcp-system (4014) | ✅ Fixed | `/health` returns 200 |
| mcp-cron (4015) | ✅ Fixed | `/health` returns 200 |
| mcp-memory (4016) | ✅ Working | FastAPI with full API |
| Coolify | ⚠️ v4.0.0 | Security hardened |

**Last Updated:** 2026-04-22
