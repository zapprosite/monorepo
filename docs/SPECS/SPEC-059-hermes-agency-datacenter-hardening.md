---
name: SPEC-059-hermes-agency-datacenter-hardening
description: Hardening Hermes Agency Suite for long-running AI agentic datacenter production — Redis locks/rate-limits, file size/MIME validation, memory leak prevention, admin-only /health
status: COMPLETED
priority: critical
author: Principal Engineer
date: 2026-04-17
specRef: SPEC-058
---

# SPEC-059: Hermes Agency — Datacenter Hardening

> ⚠️ **Serviços Envolvidos:** `apps/hermes-agency/src/telegram/bot.ts` — Não alterar lógica de negócio do CEO MIX, apenas hardening de produção.

> ⚠️ **Redis:** Se Redis não estiver disponível, o bot deve continuar a funcionar com fallback em memória (graceful degradation). Implementar AFTER Redis.

---

## Objective

Endurecer o Hermes Agency Suite para produção datacenter long-running AI agentic. O código atual tem 6 riscos críticos para ambientes de 24/7: **(1)** Maps em memória para locks e rate limits que não sobrevivem multi-instance nem OOM recovery, **(2)** sem validação de tamanho de ficheiro (ataque de disco/memória via upload grande), **(3)** sem validação de MIME type (executável disfarçado de imagem), **(4)** Maps que crescem indefinidamente (memory leak), **(5)** `/health` que expõe topologia interna da rede, **(6)** sem concurrency limit (flood attack).

**Problema resolvido:** O Hermes Agency atual funciona bem para dev/staging mas não é seguro para produção datacenter onde o bot deve correr 24/7 com múltiplas instâncias, dezenas de milhares de utilizadores, e exposição a atacantes.

---

## Tech Stack

| Component         | Technology                 | Notes                                         |
| ----------------- | -------------------------- | --------------------------------------------- |
| Rate Limiting     | Redis (ioredis)            | SLIDING_WINDOW via Redis, fallback em memória |
| Distributed Locks | Redis (SETNX + TTL)        | Atomic locks across all bot instances         |
| File Validation   | `file-type` + magic bytes  | Validar MIME real após download               |
| Memory Management | WeakRef + Interval cleanup | Limpar Maps expirados periodicamente          |
| Health Endpoint   | Admin whitelist (user IDs) | só admins veem portas internas                |
| Concurrency       | Per-user semaphore         | Limitar uploads concurrentes por utilizador   |
| Package[REMOVIDO-CJK]       | `ioredis` + `file-type`    | Nova dependência em `apps/hermes-agency/`     |

---

## Architecture Overview

### Estado Atual (Problemas)

```
Telegram → bot.ts
             ├── chatLocks: Map<chatId, boolean>     ← memory leak + não funciona em multi-instance
             ├── userMessageRates: Map<userId, Entry> ← memory leak + não funciona em multi-instance
             ├── downloadTelegramFile()              ← sem file size limit
             ├── bot.on('photo')                     ← sem MIME validation
             ├── bot.on('voice')                     ← sem concurrency limit
             └── bot.command('health')               ← expõe portas internas a todos
```

### Estado Desejado (After)

```
Telegram → bot.ts
             ├── redisLocks: "chat:{chatId}:lock" SETNX EX 30   ← atomic, multi-instance
             ├── redisRateLimit: "user:{userId}:rate" INCR EX 10 ← sliding window, multi-instance
             ├── downloadTelegramFile()
             │      ├── MAX_FILE_SIZE = 20MB check
             │      └── file-type MIME validation
             ├── bot.on('photo')
             │      └── userSemaphore: Map<userId, number> ≤ 3 concurrent
             ├── bot.on('voice')
             │      └── userSemaphore: Map<userId, number> ≤ 3 concurrent
             └── bot.command('health')
                    └── ADMIN_USER_IDS whitelist check
```

---

## Decisions Log

| Date       | Decision                                           | Rationale                                                              |
| ---------- | -------------------------------------------------- | ---------------------------------------------------------------------- |
| 2026-04-17 | Redis como fonte de verdade para locks/rate-limits | Maps em memória não sobrevivem multi-instance nem OOM recovery         |
| 2026-04-17 | Fallback graceful para memória quando Redis down   | Datacenter deve sobreviver a falhas parciais de Redis                  |
| 2026-04-17 | `file-type` para MIME validation (não extensão)    | Utilizadores podem renomear `.exe` para `.jpg`                         |
| 2026-04-17 | 20MB como MAX_FILE_SIZE                            | Telegram permite 50MB, mas 20MB é suficiente para voice/photo e seguro |
| 2026-04-17 | Semaphore máximo 3 uploads concurrentes por user   | Previne flood attacks sem bloquear uso legítimo                        |
| 2026-04-17 | ADMIN_USER_IDS como env var (não em código)        | Whitelist de admins configurável sem recompilar                        |

---

## Code Style

### Padrão Anti-Hardcoded (AGENTS.md / CLAUDE.md)

```typescript
// ✅ CORRETO — index signature + fallback
const REDIS_URL = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
const ADMIN_USER_IDS = (process.env['HERMES_ADMIN_USER_IDS'] ?? '').split(',').filter(Boolean);
const MAX_FILE_SIZE = parseInt(process.env['HERMES_MAX_FILE_SIZE'] ?? '20971520', 10); // 20MB
const MAX_CONCURRENT_PER_USER = parseInt(process.env['HERMES_MAX_CONCURRENT'] ?? '3', 10);
const RATE_LIMIT_WINDOW_MS = parseInt(process.env['HERMES_RATE_WINDOW_MS'] ?? '10000', 10);
const RATE_LIMIT_MAX_MESSAGES = parseInt(process.env['HERMES_RATE_MAX_MSGS'] ?? '5', 10);
const LOCK_TTL_SECONDS = parseInt(process.env['HERMES_LOCK_TTL_SEC'] ?? '30', 10);

// ❌ ERRADO — hardcoded
const MAX_FILE_SIZE = 20 * 1024 * 1024; // PROIBIDO
```

---

## Project Structure

```
apps/hermes-agency/src/
├── telegram/
│   ├── bot.ts                    # Main bot — MODIFICADO (hardening)
│   ├── redis.ts                   # NEW: Redis client + helpers
│   ├── file_validator.ts          # NEW: MIME + size validation
│   ├── rate_limiter.ts            # NEW: Redis-backed rate limiter
│   └── distributed_lock.ts        # NEW: Redis SETNX distributed lock
└── ...
```

---

## Non-Goals

- **Não** alterar a lógica de negócio do CEO MIX ou routing
- **Não** adicionar métricas Prometheus/observability (SPEC-023 já cobre)
- **Não** alterar o schema do Qdrant ou LangGraph workflows
- **Não** implementar authentication — Telegram já autentica via `ctx.from.id`
- **Não** adicionar rate limiting por IP — Telegram já tem rate limits internos

---

## Goals

### Must Have (MVP)

- [ ] **Redis-backed rate limiter**: 5 msg/10s por userId, funciona em multi-instance
- [ ] **Redis-backed distributed lock**: atomic lock por chatId com TTL 30s
- [ ] **Graceful fallback**: se Redis unavailable, usar em memória com warning
- [ ] **File size validation**: 20MB max para voice/photo uploads
- [ ] **MIME type validation**: file-type magic bytes após download
- [ ] **Memory cleanup**: periodic interval para limpar Maps expirados
- [ ] **Concurrency limit**: máximo 3 uploads concurrentes por userId
- [ ] **Admin-only /health**: whitelist de user IDs que podem ver portas internas
- [ ] **Zero breaking changes**: bot deve funcionar sem Redis (fallback memória)

### Should Have

- [ ] Smoke test para validar hardening (enviar ficheiro grande, verificar reject)
- [ ] Documentar variáveis de ambiente novas em `docs/SPECS/SPEC-058-hermes-agency-suite.md`
- [ ] ESLint/TsC compilam sem erros após mudanças

### Could Have

- [ ] Métricas de hardening (cache hit rate, lock contention) exportadas para Prometheus
- [ ] Health endpoint em `/:8642/health` com detalhes para load balancer

---

## Acceptance Criteria

| #     | Criterion                                                                      | Test                                                                          |
| ----- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| AC-1  | Rate limiter funciona em multi-instance (2 bots, mesma key Redis)              | Enviar 6 msgs rápidas de 2 bots diferentes — 5º msg de cada é bloqueado       |
| AC-2  | Distributed lock previne concurrent processing no mesmo chat                   | 2 bots recebem msg do mesmo chat em <100ms — só 1 processa                    |
| AC-3  | Ficheiro >20MB é rejeitado com mensagem clara                                  | Enviar ficheiro de 25MB → `❌ Ficheiro demasiado grande (max 20MB)`           |
| AC-4  | Ficheiro com MIME inválido (exe renomeado a jpg) é rejeitado                   | Enviar `malware.jpg` → `❌ Tipo de ficheiro não suportado`                    |
| AC-5  | Map de rate limiter não cresce infinitamente após 1h de operação               | Enviar 1000 msgs de users diferentes, verificar `userMessageRates.size < 100` |
| AC-6  | Utilizador não pode fazer mais de 3 uploads concurrentes                       | Upload 4 fotos simultâneas → 4ª fica pendente até 1ª terminar                 |
| AC-7  | /health só mostra portas internas a admins (HERMES_ADMIN_USER_IDS)             | User normal → health sem URLs internas; Admin → health completo               |
| AC-8  | Bot continua a funcionar se Redis estiver down (graceful degradation)          | Parar Redis → bot funciona com rate limiter em memória + warning log          |
| AC-9  | Zero console.log de variáveis sensíveis (URLs internas, user IDs em plaintext) | `grep -r "console.log" bot.ts` não mostra URLs nem tokens                     |
| AC-10 | ESLint passa com 0 errors                                                      | `pnpm eslint bot.ts --max-warnings=999` → 0 errors                            |

---

## Dependencies

| Dependency                        | Status    | Notes                                                 |
| --------------------------------- | --------- | ----------------------------------------------------- |
| SPEC-058                          | APPROVED  | Hermes Agency Suite existente                         |
| Redis (ioredis)                   | AVAILABLE | Já em use pelo monorepo (SPEC-023)                    |
| `file-type`                       | NEW       | Validar MIME real por magic bytes                     |
| Hermes env vars                   | NEW       | `HERMES_ADMIN_USER_IDS`, `HERMES_MAX_FILE_SIZE`, etc. |
| `apps/hermes-agency/package.json` | MODIFY    | Adicionar `ioredis`, `file-type` como dependencies    |

---

## Open Questions

| #    | Question                                                                                                | Impact | Priority |
| ---- | ------------------------------------------------------------------------------------------------------- | ------ | -------- |
| OQ-1 | Qual o `REDIS_URL`? Devemos usar o mesmo Redis do SPEC-023 (monitoring) ou um novo?                     | Medium | Medium   |
| OQ-2 | O `HERMES_ADMIN_USER_IDS` deve ser um env var com CSV de user IDs, ou usar Qdrant collection de admins? | Low    | Low      |
| OQ-3 | Devemos guardar o estado de rate limit em Redis com TTL (mais correto) ou em memória com sync?          | High   | Medium   |

---

## Files to Modify

| File                                                  | Change                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------ |
| `apps/hermes-agency/package.json`                     | Adicionar `ioredis`, `file-type`                                   |
| `apps/hermes-agency/src/telegram/bot.ts`              | Hardening: rate limiter, locks, validation, health admin           |
| `apps/hermes-agency/src/telegram/redis.ts`            | **NEW** — Redis client singleton + helpers                         |
| `apps/hermes-agency/src/telegram/file_validator.ts`   | **NEW** — MIME + size validation                                   |
| `apps/hermes-agency/src/telegram/rate_limiter.ts`     | **NEW** — Redis-backed rate limiter                                |
| `apps/hermes-agency/src/telegram/distributed_lock.ts` | **NEW** — Redis SETNX lock                                         |
| `.env`                                                | Adicionar novas variáveis (REDIS_URL, HERMES_ADMIN_USER_IDS, etc.) |
| `.env.example`                                        | Adicionar placeholders para novas variáveis                        |
| `docs/SPECS/SPEC-058-hermes-agency-suite.md`          | Atualizar com novas env vars na tabela                             |

## Files NOT to Modify

| File                                             | Reason                                |
| ------------------------------------------------ | ------------------------------------- |
| `apps/hermes-agency/src/router/agency_router.ts` | Lógica de routing CEO MIX — não tocar |
| `apps/hermes-agency/src/langgraph/*.ts`          | LangGraph workflows — não tocar       |
| `apps/hermes-agency/src/qdrant/client.ts`        | Qdrant multi-tenant — não tocar       |
| `apps/hermes-agency/src/skills/index.ts`         | Registry de skills — não tocar        |
| `apps/hermes-agency/src/litellm/router.ts`       | LLM routing — não tocar               |
