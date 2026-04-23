# SPEC-115 — Painel Organism — MCP Server Panel

**Data:** 2026-04-22
**Autor:** William Rodrigues
**Status:** IMPLEMENTED
**Review:** Claude Code CLI

---

## 1. Resumo

Sistema de painel de controlo para o homelab multi-claude — expõe MCP servers como endpoints geríveis. Stack completo com 6 MCP servers (4011-4016) operacionais.

**Nota:** `painel-organism` refere-se ao painel de organismos MCP — gestão centralizada de todos os MCP servers.

---

## 2. Arquitetura

### 2.1 MCP Servers (Ports 4011-4016)

| Port | Server | Backend | Status |
|------|--------|---------|--------|
| :4011 | mcp-qdrant | Qdrant (Vector DB) | ✅ Working |
| :4012 | mcp-coolify | Coolify API | ✅ Working |
| :4013 | mcp-ollama | Ollama (RTX 4090) | ✅ Working |
| :4014 | mcp-system | ZFS/Docker/System | ✅ Working |
| :4015 | mcp-cron | Cron Jobs | ✅ Working |
| :4016 | mcp-memory | Qdrant + LiteLLM | ✅ Working |

### 2.2 Capabilities Table

| Capability | Provider | Model | Status |
|------------|----------|-------|--------|
| Vector Search | Qdrant | — | ✅ Active |
| Coolify Management | Coolify API | — | ✅ Active |
| Ollama Models | Ollama | nomic-ai/e5-mistral-7b-instruct | ✅ Active |
| System Metrics | ZFS/Docker | — | ✅ Active |
| Cron Jobs | System | — | ✅ Active |
| Semantic Memory | Qdrant + LiteLLM | embedding-nomic (via LiteLLM) | ✅ Active |

### 2.3 LiteLLM Integration

**embedding-nomic model via LiteLLM:**

```
LiteLLM Proxy :4000
      │
      ├── embedding-nomic (nomic-ai/e5-mistral-7b-instruct)
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
      model: nomic-ai/e5-mistral-7b-instruct
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

## 5. Status: IMPLEMENTED

| Component | Status | Notes |
|-----------|--------|-------|
| mcp-qdrant (4011) | ✅ IMPLEMENTED | Vector search working |
| mcp-coolify (4012) | ✅ IMPLEMENTED | Coolify API integration |
| mcp-ollama (4013) | ✅ IMPLEMENTED | Ollama management |
| mcp-system (4014) | ✅ IMPLEMENTED | ZFS/Docker metrics |
| mcp-cron (4015) | ✅ IMPLEMENTED | Cron job management |
| mcp-memory (4016) | ✅ IMPLEMENTED | Qdrant + LiteLLM embeddings |
| Semantic search | ✅ IMPLEMENTED | embedding-nomic via LiteLLM |

**Last Updated:** 2026-04-22
