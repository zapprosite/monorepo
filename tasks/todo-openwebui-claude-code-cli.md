# TODO: OpenWebUI — Claude Code CLI Orchestration

**Generated:** 2026-04-09
**Plan:** tasks/plan-openwebui-claude-code-cli.md
**Status:** PENDING — awaiting human review

---

## Task 1: Native MCP Setup (Zero Code — RECOMENDADO)

**Goal:** Configure OpenWebUI native MCP support without writing code.

- [ ] **[T-OWM-1]** Aceder Admin Settings → External Tools → Add Server
- [ ] **[T-OWM-2]** Configurar auth type (Bearer Token recommended)
- [ ] **[T-OWM-3]** Testar connection: `claude-code --mcp <server-url>`
- [ ] **[T-OWM-4]** Para stdio-based MCP servers: usar MCPO proxy

**Verification:** MCP tools visíveis no Claude Code após conexão

---

## Task 2: REST API Automation Scripts

**Files:** `~/openwebui-api.sh`, `~/openwebui_admin.py`

- [ ] **[T-OWR-1]** `openwebui_api.sh` — models, chats, config GET/PUT
- [ ] **[T-OWR-2]** `openwebui_admin.py` — SCIM user management (list/create/update/delete)
- [ ] **[T-OWR-3]** CLI interface: `--list`, `--create`, `--update`, `--delete`

**Verification:** `python3 openwebui_admin.py list` → JSON users

---

## Task 3: Voice/STT Integration

**Goal:** OpenWebUI → wav2vec2 → texto via CLI

- [ ] **[T-OWV-1]** Verificar AUDIO_STT_OPENAI_API_BASE_URL=http://10.0.19.8:8201/v1
- [ ] **[T-OWV-2]** Testar transcription: `curl -X POST -F "file=@audio.wav" .../audio/transcriptions`
- [ ] **[T-OWV-3]** Smoke test E2E

**Verification:** `echo "teste" | text-to-audio | send-to-openwebui-stt` → `"teste"`

---

## Task 4: Custom MCP Wrapper (Só se Necessário)

**Dir:** `~/openwebui-mcp/` (only if native MCP insufficient)

- [ ] **[T-OWC-1]** Avaliar se native MCP cobre todos os casos de uso
- [ ] **[T-OWC-2]** Se não, criar project structure
- [ ] **[T-OWC-3]** Implementar server.py com REST→MCP mapping
- [ ] **[T-OWC-4]** Mapear POST /api/v1/chat/completions como MCP tool
- [ ] **[T-OWC-5]** Mapear GET /api/v1/models como MCP resource

**Verification:** MCP server conecta via `claude-code --mcp localhost:8014`

---

## Task 5: Smoke Tests

**Dir:** `tasks/smoke-tests/openwebui-mcp/`

- [ ] **[T-OWS-1]** Test: API key auth works
- [ ] **[T-OWS-2]** Test: chat completions returns valid response
- [ ] **[T-OWS-3]** Test: audio transcription returns text
- [ ] **[T-OWS-4]** Test: user list returns JSON array
- [ ] **[T-OWS-5]** Test: native MCP tools visible in Claude Code

**Verification:** `bash tasks/smoke-tests/openwebui-mcp/run.sh` → 5/5 PASS

---

## Dependencies

```
Task 1 (Native MCP) → Task 2 (REST API) → Task 3 (Voice) → Task 4 (Custom MCP — optional) → Task 5 (Smoke Tests)
```

---

## Stats

| # | Task | Priority |
|---|------|----------|
| 1 | Native MCP Setup | 🔴 CRITICAL |
| 2 | REST API Scripts | HIGH |
| 3 | Voice/STT | MEDIUM |
| 4 | Custom MCP Wrapper | LOW (only if needed) |
| 5 | Smoke Tests | HIGH |

---

## Notes

- **🔴 KEY FINDING:** OpenWebUI v0.6.31+ has NATIVE MCP built-in — Admin UI → External Tools → Add Server
- **MCPO:** `docker run -p 8080:8080 ghcr.io/open-webui/mcpo:latest` for stdio-based MCP servers
- **Bearer Token:** Usar `WEBUI_SECRET_KEY` do container
- **REST API:** Complementa MCP para operações não cobertas (admin, backup)

---
