# REVIEW-001: OpenClaw Bot — Voice Pipeline Audit

**Date:** 2026-04-07
**Branch:** `feature/audio-openclaw-bot-review`
**Status:** COMPLETED — findings below

---

## Executive Summary

A voice pipeline do OpenClaw Bot foi auditada por 4 agents em paralelo (Architecture, Security, Health, Audio). Findings principais:

| Severity | Count | Key Finding |
|----------|-------|-------------|
| **CRITICAL** | 4 | Voice pipeline desconectada, secrets expostos |
| **IMPORTANT** | 5 | Password reuse, browser evaluate enabled |
| **SUGGESTION** | 6 | Docs cleanup, network consolidation |

---

## CRITICAL Findings

### 1. Voice Pipeline Desconectada — OpenClaw não alcança Whisper nem Kokoro

**Location:** `/srv/data/coolify/services/qgtzrmi6771lt8l7x8rqx72f/docker-compose.yml`

**Problem:** OpenClaw não tem variáveis de ambiente `WHISPER_API_URL` ou `KOKORO_URL` configuradas. O docker-compose usa `env_file: .env` que contém as chaves mas não os URLs de serviço.

**Evidence:**
- Whisper API está em `whisper-api-gpu:8201` (não 9000)
- Kokoro está绑定 em `127.0.0.1:8012` — inacessível do container
- `curl http://whisper-api-gpu:8201/health` funciona do host, mas não do container OpenClaw

**Fix Required:**
```yaml
environment:
  WHISPER_API_URL: http://whisper-api-gpu:8201
  KOKORO_BASE_URL: http://zappro-kokoro:8880  # needs network fix first
```

**Why Critical:** Telegram voice messages não são processados pelo Whisper local — provavelmente só Deepgram funciona como fallback, ou STT completamente broken.

---

### 2. Kokoro TTS API Format Mismatch

**Location:** `configure.js` lines 362-375 + `openclaw.json`

**Problem:** OpenClaw configurado com `provider: "openai"` e `model: "kokoro"`, esperando API OpenAI TTS (`/v1/audio/speech`). Mas Kokoro não implementa este endpoint.

**Evidence:**
```
curl http://127.0.0.1:8012/v1/audio/speakers → {"detail":"Not Found"}
curl http://127.0.0.1:8012/v1/audio/speech → (404 ou formato diferente)
```

**Fix Required:** Ou configurar OpenClaw para usar provider nativo do Kokoro, ou criar proxy OpenAI-compatible.

---

### 3. Secrets Visíveis via `docker inspect`

**Location:** Container runtime (qualquer user com acesso ao Docker socket)

**Problem:** `docker inspect openclaw-qgtzrmi...` expõe todos os secrets em texto claro:
- `TELEGRAM_BOT_TOKEN`
- `OPENCLAW_GATEWAY_TOKEN`
- `DEEPGRAM_API_KEY`, `GEMINI_API_KEY`, `MINIMAX_API_KEY`, `OPENROUTER_API_KEY`
- `AUTH_PASSWORD`, `SERVICE_PASSWORD_OPENCLAW`

**Fix Required:** Migrar para Docker secrets ou init container que busca do Infisical.

---

### 4. Plain-text `.env` com 29 Secrets

**Location:** `/srv/data/coolify/services/qgtzrmi6771lt8l7x8rqx72f/.env`

**Problem:** docker-compose usa `env_file: .env` — secrets em arquivo plain text no filesystem, não no vault.

**Fix Required:** Usar Coolify Secrets management ou init script com Infisical SDK.

---

## IMPORTANT Findings

### 5. Password Reuse Anti-Pattern

| Variable | Value (same) |
|----------|--------------|
| `AUTH_PASSWORD` | `yRMLBtfhbaWLGXi24yJuTBE3WZGf782B` |
| `SERVICE_PASSWORD_OPENCLAW` | `yRMLBtfhbaWLGXi24yJuTBE3WZGf782B` |
| `OPENCLAW_GATEWAY_TOKEN` | `7NRPHyoSK2uLLKhE0T5GACeCRiBTOjCCPzHr3879Zx8f9WqiJLodZyU17D5uqlyn` |
| `SERVICE_PASSWORD_64_GATEWAYTOKEN` | `7NRPHyoSK2uLLKhE0T5GACeCRiBTOjCCPzHr3879Zx8f9WqiJLodZyU17D5uqlyn` |

---

### 6. Browser Remote Evaluate Enabled

**Location:** `docker-compose.yml:41`
```yaml
BROWSER_EVALUATE_ENABLED: 'true'
```

Risco de code execution via browser se serviço comprometido.

---

### 7. Port 8080 Bound to All Interfaces (`0.0.0.0`)

**Evidence:** `ss -tlnp` mostra `LISTEN 0.0.0.0:8080`

Recomendação: bindar para `127.0.0.1:8080` e deixar Traefik proxy lidar com exposição externa.

---

### 8. Todos API Keys de AI Providers em Environment Variables

**Location:** `docker-compose.yml:8-30`

16+ chaves expostas via env vars — todas visíveis via `docker inspect`.

---

### 9. Gateway Token Persistido em Docker Volume

**Location:** `docker-compose.yml:37` — `OPENCLAW_STATE_DIR: /data/.openclaw`

Volume `qgtzrmi6771lt8l7x8rqx72f_openclaw-data` contém token.

---

## SUGGESTION Findings

### 10. `/api/docs` e `/api/health` — Verificar Exposição

Endpoint não respondeu em testes — confirmar se são internos ou públicos.

---

### 11. Qdrant API Key em Plain Text nos Docs

**Location:** `docs/guides/openclaw-mcp-setup.md:167`

Usar placeholder `<QDRANT_API_KEY>` em documentação.

---

### 12. Deepgram Underutilized

Deepgram configurado mas só usado se Whisper falha — pode ser otimizado.

---

### 13. No Health Checks Between Voice Services

whisper-api-gpu e kokoro sem healthcheck — OpenClaw não detecta falhas.

---

### 14. GPU Memory Contention

whisper-api-gpu: 2397 MiB VRAM. Sem monitoring de memória GPU entre serviços.

---

### 15. Network Consolidation Recomendada

Serviços em 2 networks (`qgtzrmi` + `zappro-lite`) — latency unnecessarily complex.

---

## Architecture Diagram (Audio Flow)

```
Telegram Voice Msg
        │
        ▼
┌─────────────────────────────────┐
│ OpenClaw (10.0.19.4:8080)       │
│ telegram webhook → audio       │
└───────────────┬─────────────────┘
                │
    ┌───────────┴───────────┐
    ▼                       ▼
┌─────────────┐     ┌─────────────┐
│ whisper-   │     │ Deepgram    │
│ api-gpu    │     │ (fallback)  │
│ 10.0.19.8  │     │             │
│ :8201      │     │             │
└─────────────┘     └─────────────┘
        │               │
        ▼               ▼ (if whisper fails)
   STT via GPU      STT via API
        │
        ▼
┌─────────────────────────────────┐
│ Kokoro TTS (127.0.0.1:8012)     │  ← INACCESSIBLE from OpenClaw!
│ NOT reachable from container     │
└─────────────────────────────────┘
```

---

## Priority Fix Order

| Priority | Fix | Effort |
|----------|-----|--------|
| **P0** | Corrigir Kokoro network binding (expor em interface Docker) | Low |
| **P0** | Adicionar `WHISPER_API_URL` env var ao OpenClaw | Low |
| **P1** | Resolver API format Kokoro vs OpenAI | Medium |
| **P1** | Migrar secrets para Coolify Secrets (não env_file) | Medium |
| **P2** | Rotar todos os secrets (expostos nesta audit) | Low |
| **P2** | Bind port 8080 para 127.0.0.1 | Low |
| **P3** | Adicionar healthchecks | Medium |

---

## Verdict

**❌ BLOCKED** — Voice pipeline não funciona como esperado. STT via Whisper local não está conectado. TTS via Kokoro completamente inacessível.

**Ação requerida antes de merge:**
1. Corrigir Kokoro network binding
2. Adicionar WHISPER_API_URL ao OpenClaw
3. Resolver API format mismatch do Kokoro
4. Migrar secrets para Coolify Secrets

---

## Files Analyzed

| File | Lines | Key Content |
|------|-------|-------------|
| `/srv/data/coolify/services/qgtzrmi6771lt8l7x8rqx72f/docker-compose.yml` | 150+ | Service config |
| `/srv/data/coolify/services/qgtzrmi6771lt8l7x8rqx72f/.env` | 29 secrets | Plain text secrets |
| `/srv/data/coolify/services/qgtzrmi6771lt8l7x8rqx72f/scripts/configure.js` | 400+ | Audio config |
| `/srv/monorepo/docs/guides/openclaw-mcp-setup.md` | 200+ | Documentation |

---

**Auditors:** Architecture Specialist + Security Auditor + Performance Optimizer + Audio Pipeline Explorer
**Generated:** 2026-04-07
**Next Review:** After P0 fixes implemented
