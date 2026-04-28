---
spec: SPEC-200
title: Hermes Ecosystem — Arquitetura Enterprise Standard
status: active
date: 2026-04-24
author: SRE Session
---

# SPEC-200 — Hermes Ecosystem: Arquitetura Enterprise Standard

## 1. Visão Geral

O ecossistema Hermes opera em **dois sistemas complementares** no Ubuntu Desktop:

| Sistema | Linguagem | Origem | Papel |
|---------|-----------|--------|-------|
| **Hermes Gateway** | Python | `/home/will/.hermes/hermes-agent/` | Agente principal, polling Telegram @CEO_REFRIMIX_bot |
| **Hermes Gateway** | TypeScript | `/srv/monorepo/apps/hermes-gateway/` | Camada agency/marketing, polling Telegram @hermes-editor-social-bot |

**Resolução de conflito:** Python usa `@CEO_REFRIMIX_bot` (TELEGRAM_BOT_TOKEN), TypeScript usa `@hermes-editor-social-bot` (EDITOR_SOCIAL_BOT_TOKEN). Bots separados, sem conflito.

---

## 2. Padrão SOUL.md

O ecossistema segue o padrão definido em `/home/will/.hermes/SOUL.md`:

| Função | Provider | Endpoint |
|--------|----------|----------|
| **Text Primary** | MiniMax M2.7 | `api.minimax.io` (token plan) |
| **Vision** | Qwen2.5-VL-3B | `:3999` container (RTX 4090, ~4GB VRAM) |
| **STT** | Groq Whisper Turbo | API cloud (150min/dia gratis) |
| **TTS** | Edge TTS | `pt-BR-AntonioNeural` via tts-edge.sh |

### Voice/TTS Bridge
- Script: `~/.hermes/scripts/tts-edge.sh`
- Voice: `pt-BR-AntonioNeural` (neural, male, +10% speed)
- Formato: mp3 → opus → Telegram voice
- Fallback: `tts-hermes.sh`

---

## 3. Infraestrutura Compartilhada (zappro-* stack)

**Rede Docker:** `zappro-infra` (bridge)

| Container | Status | Porta | Papel |
|-----------|--------|-------|-------|
| `zappro-qdrant` | RUNNING | 127.0.0.1:6333 | Qdrant — DB vetorial (1953 vetores `will`, 79 `second-brain`) |
| `zappro-redis` | RUNNING | 127.0.0.1:6379 | Redis — cache/sessão (${REDIS_PASSWORD}) |
| `zappro-edge-tts` | RUNNING | 127.0.0.1:8012 | Kokoro TTS bridge |
| `hermes-gateway` | RUNNING | 127.0.0.1:3001 | TypeScript agency |

**Legado PRUNED:** `aurelia-*` containers foram removidos.

### zappro-litellm
- **Path:** `/home/will/zappro-lite/`
- **Porta:** `:4000` (OpenAI-compat)
- **Modelos:** minimax-m2.7, qwen2.5vl-3b, qwen3.5-vl, seed-vl-mini
- **Config:** `/srv/data/zappro-router/config.yaml` (model_fallbacks cascade)
- **Cache:** Redis (zappro-redis:6379)
- **API Base Rule:** `https://api.minimax.io` (SEM `/anthropic/v1`)

---

## 4. Hermes Gateway (Python)

- **Serviço:** `hermes-gateway.service` (systemd system-level)
- **Processo:** `/home/will/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main gateway run --replace`
- **Porta:** `:8642` (localhost only)
- **Bot:** `@CEO_REFRIMIX_bot` (token `${TELEGRAM_BOT_TOKEN}`)
- **Modelo primário:** `minimax/MiniMax-M2.7` via LiteLLM
- **Config:** `/home/will/.hermes/config.yaml`
- **Env:** `/home/will/.hermes/.env` → symlink → `/srv/monorepo/.env`
- **Skills:** coolify_sre, perplexity_browser, claude_code

### systemd Unit (ATIVO)
```
/etc/systemd/system/hermes-gateway.service → RUNNING
/home/will/.config/systemd/user/hermes-gateway.service → DEAD (user-level desabilitado)
```

---

## 5. Hermes Gateway (TypeScript)

- **Container:** `hermes-gateway` (Docker Compose)
- **Compose:** `/srv/monorepo/apps/hermes-gateway/docker-compose.yml`
- **Porta:** `:3001` (localhost only)
- **Bot:** `@hermes-editor-social-bot` (token `${EDITOR_SOCIAL_BOT_TOKEN}`)
- **Source:** `/srv/monorepo/apps/hermes-gateway/`
- **Skills:** 23 tools — RAG, LangGraph, campaign, analytics, social media
- **Modelo:** MiniMax M2.7 via `HERMES_MINIMAX_BASE=https://api.minimax.io/anthropic/v1`

---

## 6. Hermes Second Brain

- **Path:** `/srv/hermes-second-brain/`
- **API:** Mem0 + Qdrant + SQLite
- **Porta:** `:6334`
- **Start:** `cd /srv/hermes-second-brain && uvicorn apps.api.main:app --port 6334`
- **Relação:** Fornece `/memory` e `/task` endpoints para Hermes Gateway
- **Status:**systemd unit **PENDENTE** (SPEC-202)

---

## 7. Conflito Dual-Polling — RESOLVIDO

**PROBLEMA ORIGINAL:** Python hermes-gateway E TypeScript hermes-gateway usavam o mesmo `@CEO_REFRIMIX_bot` token.

**RESOLUÇÃO APLICADA:**
- Python Hermes Gateway → `@CEO_REFRIMIX_bot` (TELEGRAM_BOT_TOKEN)
- TypeScript Hermes Gateway → `@hermes-editor-social-bot` (EDITOR_SOCIAL_BOT_TOKEN)

**Dois bots separados**, sem conflito de polling.

---

## 8. `.env` Canônico

**Fonte de verdade:** `/srv/monorepo/.env`

Symlinks ativos:
- `/home/will/.hermes/.env` → `/srv/monorepo/.env`
- `/home/will/zappro-lite/.env` → `/srv/monorepo/.env`
- `/srv/monorepo/apps/api/.env` → `/srv/monorepo/.env`
- `/home/will/ai-router/.env` → `/srv/monorepo/.env`
- `/srv/apps/platform/.env` → `/srv/monorepo/.env`
- `/srv/apps/monitoring/.env` → `/srv/monorepo/.env`
- `/srv/ops/mcp-qdrant/.env` → `/srv/monorepo/.env`

### VARS CRÍTICAS
| Var | Valor | Uso |
|-----|-------|-----|
| `MINIMAX_API_BASE` | `https://api.minimax.io` | LiteLLM (SEM path) |
| `HERMES_MINIMAX_BASE` | `https://api.minimax.io/anthropic/v1` | Hermes Gateway router.ts (COM path) |
| `TELEGRAM_BOT_TOKEN` | `${TELEGRAM_BOT_TOKEN}` | @CEO_REFRIMIX_bot (Python gateway) |
| `EDITOR_SOCIAL_BOT_TOKEN` | `${EDITOR_SOCIAL_BOT_TOKEN}` | @hermes-editor-social-bot (TS agency) |

---

## 9. Rede e Portas

| Porta | Serviço | Access |
|-------|---------|--------|
| 3001 | hermes-gateway | 127.0.0.1 |
| 4000 | zappro-litellm | 0.0.0.0 |
| 6333 | zappro-qdrant | 127.0.0.1 |
| 6334 | hermes-second-brain | 127.0.0.1 (PENDENTE) |
| 6379 | zappro-redis | 127.0.0.1 |
| 8642 | hermes-gateway | 127.0.0.1 |

---

## 10. Mudanças em 2026-04-24

1. **Redis migration fix:** Estrutura de dados corrigida (`/srv/data/redis/` consolidado)
2. **hermes-gateway token:** Adicionado `TELEGRAM_BOT_TOKEN=${EDITOR_SOCIAL_BOT_TOKEN}` (hermes-editor-social-bot)
3. **aurelia-guardrail** renomeado → **zappro-guardrail** (`/srv/ops/stacks/guardrail/docker-compose.yml`)
4. **`/home/will/aurelia/`** deletado
5. **`/srv/ops/ai-governance/env-backups/`** deletado
6. **zappro-redis mount:** Atualizado de `/home/will/aurelia/data/redis:/data` para `/srv/data/redis:/data`

---

## 11. Tarefas Pendentes

| ID | Tarefa | Prioridade |
|----|--------|-----------|
| P0-SYSTEMD | Desabilitar hermes-gateway.service user-level duplicata | ALTA |
| P0-SECOND-BRAIN | Criar systemd unit para hermes-second-brain (:6334) | MÉDIA |
| P0-LITELLM | Verificar zappro-litellm status (:4000) | ALTA |
| P0-004 | homelab-control: modo operador vs modo marketing | MÉDIA |
| P0-005 | Typed adapters: codex, claude, opencode, gitea, coolify | MÉDIA |

---

## 12. Referências

- SOUL.md: `/home/will/.hermes/SOUL.md`
- Canonical .env: `/srv/monorepo/.env`
- Infra compose: `/home/will/zappro-lite/docker-compose.infra.yml`
- Hermes Gateway: `/srv/monorepo/apps/hermes-gateway/docker-compose.yml`
- Governance: `/srv/ops/ai-governance/`