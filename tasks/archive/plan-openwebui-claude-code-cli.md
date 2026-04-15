# PLAN: OpenWebUI — Claude Code CLI Orchestration

**Date:** 2026-04-09
**Status:** IN PROGRESS (updated with MCP native discovery)
**Author:** will + Claude Code (20 parallel agents research synthesis)
**Spec Ref:** SPEC-019, docs/specflow/SPEC-019-openwebui-repair.md

---

## Context

OpenWebUI is now running at `https://chat.zappro.site` with OAuth working. The question is: **how can Claude Code CLI control OpenWebUI without touching the dashboard?**

Key findings from 20 parallel agents:
1. **OpenWebUI has NATIVE MCP support built-in since v0.6.31** — configurable at Admin Settings → External Tools → Add Server
2. **REST API** comprehensive with Bearer token auth + SCIM user management
3. **OpenAI-compatible endpoints** (`/v1/chat/completions`, `/v1/audio/speech`, `/v1/audio/transcriptions`)
4. **Python SDK** for programmatic user management
5. **Claude Code MCP**: HTTP MCP server can wrap OpenWebUI REST API (for cases where native MCP isn't enough)

---

## 🔴 CRITICAL DISCOVERY: Native MCP Support

**OpenWebUI v0.6.31+ has built-in MCP server support!**

Configurable at: **Admin Settings → External Tools → Add Server**

| Feature | Details |
|---|---|
| Protocol | MCP via Streamable HTTP/SSE |
| Auth | None, Bearer Token, OAuth 2.1 |
| Docker host access | `http://host.docker.internal:PORT` |
| Config location | Admin UI → External Tools |

**Example MCP servers already supported:**
- Notion MCP: `https://mcp.notion.com/mcp`
- Custom MCP servers via URL

**For stdio-based MCP servers**, use **MCPO proxy**:
```bash
docker run -p 8080:8080 ghcr.io/open-webui/mcpo:latest
```

This means Claude Code can connect DIRECTLY to OpenWebUI's native MCP support — no custom wrapper needed!

---

## Arquitetura Proposta (Atualizada)

```
┌─────────────────────────────────────────────────────────────┐
│  Claude Code CLI (local)                                    │
│                                                             │
│  Opção 1: Native MCP (RECOMENDADO)                         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  claude-code --mcp (built-in MCP client)             │   │
│  │  → OpenWebUI Admin UI → External Tools → Add Server │   │
│  │  → pointing to any MCP server URL                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Opção 2: Custom MCP Wrapper (para casos especiais)         │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  openwebui-mcp/ server.py                          │   │
│  │  → wraps REST API as MCP tools                     │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │
          │ Bearer Token Auth: WEBUI_SECRET_KEY
          ▼
┌─────────────────────────────────────────────────────────────┐
│  OpenWebUI Container (:8080)                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Native MCP: Admin Settings → External Tools        │   │
│  │  Bearer Token Auth: WEBUI_SECRET_KEY               │   │
│  │  SCIM 2.0 for user management                     │   │
│  │  OpenTelemetry metrics (port 3010)                │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Abordagens Avaliadas

| Approach | Status | Viabilidade |
|----------|--------|-------------|
| **Native MCP (Admin UI)** | ✅ BEST | OpenWebUI v0.6.31+ built-in, zero code needed |
| **MCP Server (HTTP wrapper)** | ✅ Good | For custom integrations, Claude Code MCP client |
| **REST API direct** | ✅ Good | `curl` + Bearer token, no wrapper needed |
| **Python SDK** | ✅ Good | User management, bulk operations |
| **docker exec** | ✅ OK | Container inspect, logs, config file edits |
| **SSH** | ❌ No SSH | Not supported by OpenWebUI |
| **Terraform** | ❌ No Terraform provider | OpenWebUI has no Terraform provider |
| **CLI** | ⚠️ Limited | No standalone CLI — only REST API |

**Winner:** Native MCP via Admin UI (zero code) + REST API for automation

---

## Dependency Graph

```
Opção 1 (Native MCP):
OpenWebUI Admin UI → External Tools → Add Server → Claude Code --mcp
├── Task 1: Configurar MCP nativo no Admin UI
├── Task 2: Testar conexão MCP
└── Task 3: Adicionar tools personalizado via MCPO

Opção 2 (Custom MCP Wrapper): ~/openwebui-mcp/
├── src/server.py         # MCP HTTP server
├── openwebui_admin.py    # Python SDK user mgmt
└── admin_ops.py          # Backup/restore/config
```

---

## Fases de Implementação

### Fase 1: Native MCP Setup (Zero Code)

**Goal:** Configure OpenWebUI native MCP without writing any code.

```
Tarefas:
- [ ] Aceder Admin Settings → External Tools → Add Server
- [ ] Adicionar MCP server URL (ex: http://localhost:8080 para MCPO)
- [ ] Testar: claude-code --mcp localhost:8080 (se MCPO configurado)
```

**MCPO for stdio-based MCP servers:**
```bash
# Expor qualquer MCP server como HTTP
docker run -p 8080:8080 ghcr.io/open-webui/mcpo:latest \
  --port 8080 -- <mcp-server-command>
```

---

### Fase 2: REST API Direct (Fallback/Automation)

**Goal:** CLI automation via curl/Bash for common admin tasks.

```
Tarefas:
- [ ] Testar API key auth: curl -H "Authorization: Bearer $WEBUI_SECRET_KEY"
- [ ] Criar script: openwebui_api.sh (models, chats, users)
- [ ] Criar script: openwebui_admin.py (SCIM user management)
```

**Key Endpoints:**
```bash
# Models
GET /api/v1/models

# Chat completions
POST /api/v1/chat/completions

# Audio transcription (STT)
POST /api/v1/audio/transcriptions

# Users (SCIM)
GET /api/v1/scim/v2/Users

# Config
GET /api/v1/config
PUT /api/v1/config

# Backup
GET /api/v1/analytics/export
```

---

### Fase 3: Custom MCP Wrapper (Para Casos Especiais)

**Goal:** Build custom MCP server only if native MCP doesn't cover needs.

```
Tarefas:
- [ ] Avaliar se native MCP cobre todos os casos
- [ ] Se não, criar ~/openwebui-mcp/ com server.py
- [ ] Mapear REST API endpoints como MCP tools
```

**Only needed if:**
- Native MCP doesn't support specific tool
- Need custom authentication flow
- Need to combine multiple backends

---

### Fase 4: Voice/STT Integration

**Goal:** OpenWebUI STT (wav2vec2) controllable via CLI.

```
Tarefas:
- [ ] Verificar AUDIO_STT_OPENAI_API_BASE_URL=http://10.0.19.8:8201/v1
- [ ] Testar: curl -X POST .../audio/transcriptions
- [ ] Expor como MCP tool se necessário
```

---

### Fase 5: Smoke Tests

**Goal:** Verificar que tudo funciona.

```
Tarefas:
- [ ] Testar MCP connection (native)
- [ ] Testar chat completions via REST API
- [ ] Testar audio transcription
- [ ] Testar user management (SCIM)
- [ ] Documentar em docs/
```

---

## Verification

| Check | Command | Expected |
|-------|---------|----------|
| API responds | `curl -s -H "Authorization: Bearer $WEBUI_SECRET_KEY" https://chat.zappro.site/api/v1/models` | `{"models": [...]}` |
| Native MCP | OpenWebUI Admin UI → External Tools → Add Server | Server added |
| STT works | `curl -X POST -F "file=@test.wav" .../audio/transcriptions` | `{"text":"..."}` |
| User list | `python3 openwebui_admin.py list` | JSON users list |

---

## Risks

| Risk | Impact | Mitigation |
|------|---------|------------|
| WEBUI_SECRET_KEY expõe tudo | 🔴 Critical | Usar apenas em rede interna / VPN |
| OpenWebUI actualiza API | ⚠️ Medium | Version pinning no MCP server |
| Native MCP requer UI | ⚠️ Low | Uma vez configurado, persiste |

---

## Next Step

Aprovar plano → executar Tasks 1-5. Commits atômicos por task.

---
