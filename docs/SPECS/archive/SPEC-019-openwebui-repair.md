---
archived: true
superseded_by: SUBDOMAINS.md (chat.zappro.site routing fixed)
see_also:
  - SUBDOMAINS.md
---

> ⚠️ ARCHIVED — Superseded by [SPEC-024](../SPEC-024.md) and related canonical specs.

# SPEC-019: OpenWebUI Repair — Tunnel + OAuth + Voice STT

**Status:** RESOLVED
**Resolved:** 2026-04-09
**Author:** will + Claude Code

---

## Resumo

O OpenWebUI está a funcionar internamente mas o túnel Cloudflare não respondia, e o OAuth Google não estava configurado. Adicionalmente, o utilizador queria adicionar voice STT (wav2vec2) ao OpenWebUI como alternativa ao OpenClaw para Telegram.

---

## Estado Atual

| Campo | Valor |
|-------|-------|
| Container | `open-webui-wbmqefxhd7vdn2dme3i6s9an` |
| Status | Running (healthy) |
| Porto | 8080 |
| Rede | `wbmqefxhd7vdn2dme3i6s9an` (10.0.5.2) + `qgtzrmi...` (10.0.19.10) |
| IPs | `10.0.5.2` (wbmqefx...), `10.0.19.10` (qgtzrmi...) |
| OAuth | GOOGLE configured (env vars present) |
| Redirect URL | `https://chat.zappro.site/oauth/google/callback` |
| SERVICE_URL | `https://chat.zappro.site` |

---

## Problema 1: Cloudflare Tunnel Não Responde

**Sintoma:**
```bash
curl https://chat.zappro.site/  # → 000 (connection refused)
curl https://openwebui-wbmqefxhd7vdn2dme3i6s9an.191.17.50.123.sslip.io/  # → 000
```

**Verificações:**
- `nslookup chat.zappro.site` → resolve para IP
- `nslookup openwebui-wbmqefxhd7vdn2dme3i6s9an.191.17.50.123.sslip.io` → resolve para IP
- Coolify proxy a funcionar: `curl http://localhost:8080/` → 000
- Container interno: `curl http://172.17.0.x:8080/` → needs test

**Hipóteses:**
1. Cloudflare Tunnel não está a fazer proxy para o domínio
2. Traefik/Coolify não está a routear para o container
3. O domínio SSLIP não está a funcionar (precisa de curl com IP real)

---

## Problema 2: OAuth Google Não Configurado

O OAuth Google está nas variáveis mas pode não estar a funcionar porque:
1. O `SERVICE_URL_OPENWEBUI` está指向 `sslip.io` que pode não ser o URL real do Google OAuth
2. O Google OAuth callback precisa de verificar o domínio

---

## Problema 3: Voice STT com wav2vec2 no OpenWebUI

O utilizador quer adicionar transcription de voz ao OpenWebUI usando wav2vec2 local.

**Arquitetura desejada:**
```
OpenWebUI → /v1/audio/transcriptions → wav2vec2 (:8202)
```

---

## Ficheiros e Logs

### Logs relevantes:
```bash
docker logs open-webui-wbmqefxhd7vdn2dme3i6s9an --tail 50
```

### Container env (OAuth):
```
OAUTH_GOOGLE_REDIRECT_URL=https://chat.zappro.site/oauth/google/callback
SERVICE_URL_OPENWEBUI=http://openwebui-wbmqefxhd7vdn2dme3i6s9an.191.17.50.123.sslip.io
OAUTH_GOOGLE_CLIENT_ID=297107448858-324eplshrg5vv2br911l4dtm8bjh0sl1.apps.googleusercontent.com
OAUTH_GOOGLE_CLIENT_SECRET=[GOOGLE_OAUTH_SECRET]
```

---

## Plano de Ação

### Fase 1: Diagnóstico do Tunnel
1. Verificar se Cloudflare Tunnel existe e está activo
2. Verificar se o domínio está a resolver para o IP correcto
3. Testar routing interno entre containers

### Fase 2: Corrigir OAuth
1. Verificar se `SERVICE_URL_OPENWEBUI` está correcto
2. Actualizar Google OAuth callback URL se necessário
3. Testar login Google

### Fase 3: Voice STT (opcional)
1. Configurar OpenAI-compatible API endpoint no OpenWebUI
2. Apontar para wav2vec2 (:8202)
3. Testar transcription

---

## Fixes Applied

### Fix 1: Cloudflared Tunnel Routing Fixed

**Problem:** cloudflared was routing to wrong host (192.168.1.5 instead of 10.0.5.2).

**Fix:** Updated cloudflared tunnel routing to point to `10.0.5.2:8080` (OpenWebUI container).

**Verification:**
```bash
curl https://chat.zappro.site/  # → 200 OK
```

**Result:** OpenWebUI accessible externally at `https://chat.zappro.site/`

---

### Fix 2: SERVICE_URL Updated

**Problem:** `SERVICE_URL_OPENWEBUI` was pointing to `.sslip.io` domain which is not accessible externally.

**Fix:** Updated `SERVICE_URL` to `https://chat.zappro.site`.

**Env change:**
```
SERVICE_URL_OPENWEBUI=https://chat.zappro.site
SERVICE_FQDN_OPENWEBUI=chat.zappro.site
SERVICE_FQDN_OPENWEBUI_8080=chat.zappro.site:8080
```

**Note:** `SERVICE_URL_OPENWEBUI_8080` remains `http://...sslip.io:8080` because OpenWebUI internal config uses this for the 8080 port reference. The external-facing URL (`https://chat.zappro.site`) is what matters for OAuth callback.

**Result:** OAuth callbacks resolve correctly, Google OAuth flow works.

---

### Fix 3: OLLAMA_BASE_URL Fixed

**Problem:** Ollama base URL was missing or incorrect, causing OpenWebUI to be unable to reach local models.

**Fix:** Set `OLLAMA_BASE_URL=http://10.0.5.1:11434`

**Result:** OpenWebUI connects to local Ollama instance at 10.0.5.1:11434.

**Network fix applied:** OpenWebUI now on both networks (`wbmqefxhd7vdn2dme3i6s9an` + `qgtzrmi6771lt8l7x8rqx72f`) via docker-compose.yml persistent config.

---

### Fix 4: Audio STT Configured (wav2vec2)

**Problem:** OpenWebUI needed voice transcription capability using local wav2vec2.

**Fix:** Configured `AUDIO_STT_ENGINE=openai` with `AUDIO_STT_OPENAI_BASE_URL=http://10.0.5.1:8201/v1`

**Env changes:**
```
AUDIO_STT_ENGINE=openai
AUDIO_STT_OPENAI_BASE_URL=http://10.0.5.1:8201/v1
AUDIO_STT_OPENAI_API_KEY=unused
AUDIO_STT_OPENAI_MODEL=whisper-1
```

**Result:** OpenWebUI transcribes audio via local wav2vec2 at :8201 (OpenAI-compatible endpoint).

**Arquitetura:**
```
OpenWebUI → /v1/audio/transcriptions → wav2vec2 (:8201) → whisper-api → texto
```

---

### Fix 5: Cloudflare Access OAuth Bypass

**Problem:** Cloudflare Access policy was blocking OAuth flow for `chat.zappro.site`.

**Fix:** Added bypass rule for `/oauth/*` path in Cloudflare Access policy.

**Result:** Google OAuth login works end-to-end via `https://chat.zappro.site/oauth/google/callback`

---

## Final Configuration Summary

| Setting | Value |
|---------|-------|
| Container | `open-webui-wbmqefxhd7vdn2dme3i6s9an` |
| Networks | `wbmqefxhd7vdn2dme3i6s9an` (10.0.5.2) + `qgtzrmi6771lt8l7x8rqx72f` (10.0.19.10) |
| SERVICE_URL_OPENWEBUI | `https://chat.zappro.site` |
| SERVICE_FQDN_OPENWEBUI | `chat.zappro.site` |
| OLLAMA_BASE_URL | `http://10.0.5.1:11434` |
| AUDIO_STT_ENGINE | `openai` |
| AUDIO_STT_OPENAI_BASE_URL | `http://10.0.19.8:8201/v1` |
| AUDIO_STT_OPENAI_MODEL | `whisper-1` |
| OAuth Redirect | `https://chat.zappro.site/oauth/google/callback` |
| External Access | `https://chat.zappro.site/` |

---

## Referências

- `/srv/monorepo/docs/INCIDENTS/INCIDENT-2026-04-09-openclaw-tts-route-fix.md`
- Container env vars detalhados no investigation output

---

**Data:** 2026-04-09
**Updated:** 2026-04-09 — Added fixes applied, resolved status

---

## CLI/API Control Findings (09/04/2026)

### Verified Working Endpoints (external access via https://chat.zappro.site)

| Endpoint | Method | Auth | Status |
|----------|--------|------|--------|
| /api/v1/auths/signin | POST | JSON body | ✅ WORKS |
| /api/v1/models | GET | Bearer JWT | ✅ WORKS |
| /api/v1/chat/completions | POST | Bearer JWT | ✅ WORKS |
| /api/v1/users | GET | Bearer JWT | ⚠️ HTML (needs path fix) |
| /api/v1/config | GET | Bearer JWT | ⚠️ HTML redirect |

### Authentication
- JWT token obtained via POST /api/v1/auths/signin with email+password
- Credentials: admin@openwebui.local / AdminPass123! (created during this session)

### Models Available (historical — 2026-04-09)
- llama3-portuguese-tomcat-8b-instruct-q8:latest
- Qwen3-VL-8B-Instruct (later replaced qwen2.5vl)
- nomic-embed-text:latest
- arena-model

### CLI Tools Created
- /srv/monorepo/docs/OPERATIONS/SKILLS/openwebui_admin.py - Admin CLI
- /srv/monorepo/docs/OPERATIONS/SKILLS/openwebui_mcp.py - MCP server wrapper (pending)
- /srv/monorepo/tasks/smoke-tests/openwebui-api.sh - Smoke tests (pending)
