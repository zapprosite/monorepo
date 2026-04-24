---
spec: SPEC-200
title: Hermes Ecosystem — Arquitetura Completa e Estado Atual
status: active
date: 2026-04-24
author: audit session
---

# SPEC-200 — Hermes Ecosystem: Arquitetura e Estado Atual

## 1. Visão Geral

O ecossistema Hermes é composto por **dois sistemas distintos** que operam em paralelo no Ubuntu Desktop:

| Sistema | Linguagem | Origem | Papel |
|---------|-----------|--------|-------|
| **Hermes Gateway** | Python | Clone do projeto OpenSource Hermes | Agente principal, orquestrador |
| **Hermes Agency** | TypeScript | Monorepo interno | Complemento — camada de agência/marketing |

Eles NÃO são duplicatas — são camadas complementares.

---

## 2. Componentes Ativos

### 2.1 Python — Hermes Gateway (ATIVO)

- **Serviço:** `hermes-gateway.service` (systemd system-level)
- **Processo:** `/home/will/.hermes/hermes-agent/venv/bin/python -m hermes_cli.main gateway run --replace`
- **Porta:** `:8642` (localhost only)
- **Bot:** `@CEO_REFRIMIX_bot` (token `8759194670:...`)
- **Modelo primário:** `minimax/MiniMax-M2.7`
- **Config:** `/home/will/.hermes/config.yaml`
- **Env:** `/home/will/.hermes/.env` → symlink → `/srv/monorepo/.env`
- **Skills ativas:** coolify_sre, perplexity_browser, claude_code
- **Memória:** Qdrant `will` (1953 vetores), `second-brain` (79 vetores)

### 2.2 TypeScript — Hermes Agency (ATIVO desde 2026-04-24)

- **Container:** `hermes-agency` (Docker)
- **Porta:** `:3001` (localhost only)
- **Bot:** `@CEO_REFRIMIX_bot` (token `8759194670:...`) ← **MESMO TOKEN**
- **Compose:** `/srv/monorepo/apps/hermes-agency/docker-compose.yml`
- **Source:** `/srv/monorepo/apps/hermes-agency/`
- **Skills:** 23 tools — RAG, LangGraph, campaign, analytics, social media
- **Modelo:** MiniMax M2.7 via `HERMES_MINIMAX_BASE=https://api.minimax.io/anthropic/v1`

### 2.3 Hermes Second Brain (INATIVO — não tem systemd unit)

- **Path:** `/srv/hermes-second-brain/`
- **Papel:** API de memória — Mem0 + Qdrant + SQLite
- **Porta prevista:** `:6334`
- **Start manual:** `cd /srv/hermes-second-brain && uvicorn apps.api.main:app --port 6334`
- **Relação:** Fornece `/memory` e `/task` endpoints para o Hermes Gateway

---

## 3. Infraestrutura Compartilhada (aurelia-*)

Containers `aurelia-*` ainda são a infraestrutura ativa para ambos os sistemas Hermes.

| Container | Status | Porta | Papel |
|-----------|--------|-------|-------|
| `aurelia-qdrant-1` | RUNNING | 127.0.0.1:6333 | Qdrant — DB vetorial compartilhado |
| `aurelia-redis-1` | RUNNING | 127.0.0.1:6379 | Redis — cache/sessão |
| `aurelia-kokoro` | RUNNING | 127.0.0.1:8012 | TTS (Kokoro) — voz |
| `aurelia-smart-router` | EXITED (3 semanas) | — | LiteLLM LEGADO — substituído por zappro-litellm |
| `aurelia-api` | EXITED (3 semanas) | — | Python Aurelia API — falha no mount de .env |

**Nota:** `aurelia-smart-router` e `aurelia-api` estão mortos. A palavra "aurelia" é legado — o LiteLLM ativo é `zappro-litellm` em `/home/will/zappro-lite/`.

---

## 4. Conflito Crítico — Dual Polling no Mesmo Token

**PROBLEMA:** Python hermes-gateway E TypeScript hermes-agency usam `TELEGRAM_BOT_TOKEN=8759194670` (@CEO_REFRIMIX_bot).

No Telegram, apenas UM processo pode fazer long-polling por bot token simultaneamente. O mais recente a chamar `getUpdates` "rouba" as mensagens do outro.

**Estado atual (2026-04-24):**
- Python hermes-gateway está rodando há mais tempo → provavelmente recebendo as mensagens
- TypeScript hermes-agency iniciado hoje → pode haver conflito

**Resolução pendente:**
- Opção A: TypeScript usa `EDITOR_SOCIAL_BOT_TOKEN` (`@editor_social_bot`) — dois bots separados
- Opção B: Python gateway delega para TypeScript via HTTP (hermes-agency como sub-agente)
- Opção C: Migrar o @CEO_REFRIMIX_bot inteiro para o TypeScript e aposentar o Python gateway

---

## 5. Duplicata de systemd Unit

`hermes-gateway.service` existe em dois lugares:
- `/etc/systemd/system/hermes-gateway.service` → **ATIVO/RUNNING** (system-level)
- `/home/will/.config/systemd/user/hermes-gateway.service` → **DEAD** (user-level, falhou)

Ação: desabilitar e remover o user-level.

```bash
systemctl --user disable hermes-gateway.service
systemctl --user stop hermes-gateway.service
```

---

## 6. `.env` Canônico

**Fonte de verdade:** `/srv/monorepo/.env`

Todos os apps agora symlinkat para o canônico:
- `/home/will/.hermes/.env` → `/srv/monorepo/.env`
- `/home/will/zappro-lite/.env` → `/srv/monorepo/.env`
- `/srv/monorepo/apps/api/.env` → `/srv/monorepo/.env`
- `/home/will/ai-router/.env` → `/srv/monorepo/.env`
- `/srv/apps/platform/.env` → `/srv/monorepo/.env`
- `/srv/apps/monitoring/.env` → `/srv/monorepo/.env` (já era)
- `/srv/ops/mcp-qdrant/.env` → `/srv/monorepo/.env` (já era)

**Var conflito resolvido:**
- `MINIMAX_API_BASE=https://api.minimax.io` — para LiteLLM (sem path, LiteLLM adiciona)
- `HERMES_MINIMAX_BASE=https://api.minimax.io/anthropic/v1` — para hermes-agency router.ts (com path Anthropic)

---

## 7. O Que Foi Feito em 2026-04-24

### hermes-agency fixes (P0-008)
1. `src/index.ts` — adicionado `import './telegram/bot.js'` (estava faltando — bot nunca iniciava)
2. `src/qdrant/client.ts` — corrigido `createCollectionIfNotExists` (verificava `result.exists` que não existe na API Qdrant)
3. `src/litellm/router.ts` — renomeado `MINIMAX_API_BASE` → `HERMES_MINIMAX_BASE` (evita conflito com LiteLLM)
4. `Dockerfile` criado — build context = `/srv/monorepo`, copia `tsconfig.base.json` para `/tsconfig.base.json`
5. `docker-compose.yml` criado — usa redes `aurelia_default` + `aurelia-net`, polling mode, healthcheck Node.js

### canonical .env
- `MINIMAX_API_BASE` corrigido (removia `/anthropic/v1` errado para LiteLLM)
- `HERMES_AGENCY_WEBHOOK_URL` adicionado (drift fix)
- `HERMES_ADMIN_USER_IDS=7220607041`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USERS`, `OLLAMA_BASE_URL`, `LITELLM_VIRTUAL_KEY`, `MEM0_API_KEY`, browser/terminal vars, app config vars

---

## 8. Próximos Passos (P0 Backlog)

| ID | Tarefa | Prioridade |
|----|--------|-----------|
| P0-CONFLICT | Resolver dual-polling @CEO_REFRIMIX_bot (Python vs TS) | CRÍTICO |
| P0-AURELIA | Remover aurelia-smart-router e aurelia-api (legado) | ALTA |
| P0-SYSTEMD | Desabilitar hermes-gateway.service user-level duplicata | ALTA |
| P0-SECOND-BRAIN | Criar systemd unit para hermes-second-brain (:6334) | MÉDIA |
| P0-LITELLM | Verificar se zappro-litellm está rodando (:4000 down) | ALTA |
| P0-004 | homelab-control: modo operador vs modo marketing | MÉDIA |
| P0-005 | Typed adapters: codex, claude, opencode, gitea, coolify | MÉDIA |
| P0-PLAN-MODE | plan-mode.sh: remover [0.0]*768, usar embedding real | BAIXA |
| P0-RUNNER | Task runner: pipeline.json → execute → log result | BAIXA |

---

## 9. Para o Hermes OpenSource Standard

O TypeScript hermes-agency deve seguir o padrão do projeto Hermes OpenSource:
- Referência: `/home/will/.hermes/hermes-agent/` (clone local)
- Manter compatibilidade com o formato de skills e tools do Hermes Python
- Skills do TypeScript devem poder ser invocadas pelo Python gateway via HTTP (:3001)
- Logging em `tasks/runs/` conforme padrão Hermes

---

## 10. Referências

- Hermes Gateway config: `/home/will/.hermes/config.yaml`
- Hermes Agent clone: `/home/will/.hermes/hermes-agent/`
- Hermes Second Brain: `/srv/hermes-second-brain/`
- TypeScript Agency: `/srv/monorepo/apps/hermes-agency/`
- Canonical ENV: `/srv/monorepo/.env`
- PORTS.md: `/srv/ops/ai-governance/PORTS.md`
- SERVICE_MAP: `/srv/ops/ai-governance/SERVICE_MAP.md`
