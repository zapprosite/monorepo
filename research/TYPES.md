# TYPES.md — SPEC-065 TypeScript Baseline

**Date:** 2026-04-17
**Author:** TYPES Agent

---

## Resumo Executivo

| App/Package | Status | Erros | Issues Principais |
|-------------|--------|-------|------------------|
| `ai-gateway` | ❌ FAIL | ~25 | TS4111 (index signature access), `json` método ausente |
| `hermes-agency` | ❌ FAIL | ~30 | LangGraph types (TS2345/TS2769/TS2739), imports `.ts` inválidos |
| `api` | ❌ FAIL | ~55 | Módulos `@connected-repo/zod-schemas/*` não resolvidos, many `any` types |
| `packages/ui` | N/A | — | sem `tsconfig.json` dedicado |
| `packages/zod-schemas` | ✅ PASS | 0 | sem `tsconfig.json` dedicado |
| `packages/config` | ✅ PASS | 0 | — |

---

## `apps/ai-gateway` — 25 erros

### Padrão TS4111 (Index Signature Access)
**Causa:** `tsconfig.json` com `noPropertyAccessFromIndexSignature: true`

**Erros:**
```ts
// ❌ current (erro TS4111)
process.env.AI_GATEWAY_PORT

// ✅ correcto
process.env['AI_GATEWAY_PORT']
```

**Files afetados:**
- `src/index.ts` — AI_GATEWAY_PORT, AI_GATEWAY_HOST, LOG_LEVEL
- `src/middleware/auth.ts` — AI_GATEWAY_FACADE_KEY
- `src/middleware/ptbr-filter.ts` — OLLAMA_URL, PTBR_FILTER_MODEL
- `src/routes/audio-speech.ts` — TTS_BRIDGE_URL
- `src/routes/audio-transcriptions.ts` — STT_DIRECT_URL
- `src/routes/chat.ts` — LITELLM_LOCAL_URL, LITELLM_MASTER_KEY, OLLAMA_VISION_MODEL, choices, model, NODE_ENV

### Erro TS2339 — Método `json` em FastifyReply
```ts
// src/routes/audio-speech.ts:36
// Erro: Property 'json' does not exist on type 'FastifyReply'
```
**Fix:** Verificar se o método correto é `reply.send()` ou `reply.code(200).send()`

### Vitest
- ❌ **sem `vitest.config.ts`**

---

## `apps/hermes-agency` — ~30 erros

### TS5097 — Import paths com extensão `.ts`
**Causa:** `allowImportingTsExtensions` não está habilitado

**Files:**
- `src/langgraph/content_pipeline.ts` (import `@langchain/core/runnables`)
- `src/langgraph/lead_qualification.ts`
- `src/langgraph/onboarding_flow.ts`
- `src/langgraph/social_calendar.ts`

### TS2345/TS2769/TS2739 — LangGraph Type Mismatches
**Causa:** LangGraph API change — `StateGraph` states são agora genéricos stricter

**Files:** `src/langgraph/content_pipeline.ts`

**Problema central:**
```ts
// Erro: Type 'Promise<Partial<ContentPipelineState>>' não é assignable
(state: ContentPipelineState) => Promise<Partial<ContentPipelineState>>
```

**Fix possível:** Atualizar para a API LangGraph 0.2.x com `Annotation` e `StateGraph.create()` — BREAKING CHANGE

### TS4111 — NODE_ENV, SESSION_SECRET
**Files:**
- `src/__tests__/health.test.ts`
- `src/app.ts`

### Vitest
- ❌ **sem `vitest.config.ts`**

---

## `apps/api` — ~55 erros

### TS2307 — Módulos `@connected-repo/zod-schemas/*` não encontrados
**Erro:**
```
Cannot find module '@connected-repo/zod-schemas/node_env'
Cannot find module '@connected-repo/zod-schemas/zod_utils'
Cannot find module '@connected-repo/zod-schemas/enums.zod'
```

**Causa:** Package `@connected-repo/zod-schemas` não está instalado ou não exporta esses módulos.

**Files:**
- `src/configs/env.config.ts`
- `src/configs/logger.config.ts`
- `src/db/base_table.ts`

### TS4111 — DB config env vars
**Files:**
- `src/db/config.ts` — DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME

### TS7006/TS2349 — Orchid ORM / RakeDb types
**Causa:** Orchid ORM (rake-db) com types muito permissivos, muitos `implicit any`

**Files:**
- `src/db/db_script.ts`
- `src/db/migrations/0001_initialise_tables.ts`
- `src/db/migrations/0002_crm_leads_clients.ts`

### Vitest
- ❌ **sem `vitest.config.ts`**

---

## Packages — Status

### `packages/ui`
- ❌ sem `vitest.config.ts`
- ❌ sem `tsconfig.json` dedicado (usa root)

### `packages/zod-schemas`
- ✅ Nenhum erro de TypeScript

### `packages/config`
- ✅ Nenhum erro de TypeScript

---

## Gitea Workflows — Status

Workflows atuais em `.gitea/workflows/`:
- ✅ `orchestrator.yml`
- ✅ `pr-check.yml`
- ❌ **ausente:** `ci.yml` (lint + typecheck + test)
- ❌ **ausente:** `test.yml` (unitários + integração)
- ❌ **ausente:** `e2e.yml` (smoke tests)

---

## RECOMENDAÇÕES PRIORITÁRIAS

### P0 — Bloqueantes para CI

1. **`apps/api` — Resolver módulos ausentes `@connected-repo/zod-schemas/*`**
   - Instalar package ou corrigir import paths para `@podcasting/zod-schemas`

2. **`apps/ai-gateway` — Corrigir TS4111 em todos os routes**
   - Substituir `process.env.VAR` por `process.env['VAR']` em ~25 locais

### P1 — LangGraph Breaking Change

3. **`apps/hermes-agency` — Atualizar LangGraph types**
   - API 0.2.x com `Annotation` + `StateGraph.create()` — requer refactor

### P2 — Testing Setup

4. **Adicionar `vitest.config.ts`** a:
   - `apps/ai-gateway/`
   - `apps/hermes-agency/`
   - `apps/api/`
   - `packages/ui/`

5. **Criar `ci.yml` Gitea workflow** para substituir o apagado

### P3 — Debt Técnico

6. **`apps/hermes-agency` — Remover `.ts` extension dos imports** em 4+ ficheiros langgraph
7. **`apps/api` — Resolver implicit `any` types** em migrations (45+ locais)
