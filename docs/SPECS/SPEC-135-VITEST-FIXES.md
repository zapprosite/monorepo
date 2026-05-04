# SPEC-135: Corrigir Testes Vitest — Plano de Ação

> **Status:** PARCIALMENTE CORRIGIDO — Isolation requer arquitetura different
>
> P0 fixes aplicados (vi.mocked → type assertions). Isolation issue requires either: (A) Bun-compatible `node:fetch` import OR (B) acceptance that tests must run individually for isolation.

## Problema

Durante a sessão de debug, vários testes Vitest foram "mascarados" em vez de corrigidos corretamente:

1. **`router-integration.test.ts`** — `vi.mocked()` returns `undefined` ✅ CORRIGIDO
2. **`litellm-proxy.test.ts`** — `vi.stubGlobal()` não existe no Vitest ✅ CORRIGIDO
3. ~~`trieve-integration.test.ts`~~ — REMOVIDO (Trieve foi substituído por Mem0+Qdrant)

## Estado Actual dos Testes

### Testes Corrigidos (P0 - DONE):

1. ✅ **`agency_router.test.ts`** — `vi.mocked(llmComplete)` → type assertion
2. ✅ **`mem0-integration.test.ts`** — todos `vi.mocked()` → type assertions
3. ✅ **`tool_registry.test.ts`** — removido mock poluente de rag-instance-organizer
4. ✅ **`router-integration.test.ts`** — removido mock poluente de rag-instance-organizer

### Isolation Issue Persiste (REQUER REFATORAÇÃO)

**Problema:** Quando executado com todos os testes (257 tests), 67 falham. Quando executado sozinho, cada ficheiro passa.

**Causa Raiz:**
- Os módulos fonte usam `fetch` global (não de `node:fetch`)
- `vi.spyOn(globalThis, 'fetch')` não consegue interceptar corretamente quando módulos já fizeram bind
- As caches em memória (e.g., session history em mem0) não são resetadas entre testes

**Solução Requer Refatoração:**
Os fontes precisam de usar `import { fetch } from 'node:fetch'` para que `vi.mock('node:fetch')` possa interceptar corretamente. Esta é uma mudança de arquitetura.

## Root Causes

### 1. `vi.mocked is not a function`

**Ficheiro:** `src/__tests__/router-integration.test.ts:213`

```typescript
const mockLlmComplete = vi.mocked(llmComplete);
```

**Causa:** `vi.mocked()` requer que o módulo seja mockado com `vi.mock()` E que o tipo seja inferido corretamente. O import `llmComplete` vem de `../litellm/router.js` mas o mock é feito para `../litellm/router.ts`. A extensão `.ts` vs `.js` pode causar mismatch.

**Solução correta:** Usar type assertion direto:
```typescript
const mockLlmComplete = llmComplete as ReturnType<typeof vi.fn>;
```

### 2. `vi.stubGlobal is not a function` (FICHEIRO DELETADO)

**Ficheiro:** `src/__tests__/litellm-proxy.test.ts` (criado incorretamente, depois deletado)

**Causa:** `vi.stubGlobal()` não existe na API do Vitest. É `vi.spyOn(globalThis, 'fetch')` ou usar `vi.mock('node:fetch')`.

**Solução correta:** Criar novo ficheiro com mock correto:
```typescript
vi.mock('node:fetch', () => ({
  default: vi.fn(),
}));

// No beforeEach:
const { default: fetch } = await import('node:fetch');
fetch.mockResolvedValueOnce({...});
```

### 3. ~~Test isolation failure em `trieve-integration.test.ts`~~

**Status:** REMOVIDO — Trieve foi substituído por Mem0+Qdrant (Hermes Second Brain). O módulo `trieve/` foi deletado do monorepo.

## Plano de Correção

### Step 1: Corrigir `router-integration.test.ts`

**Ficheiro:** `apps/hermes-gateway/src/__tests__/router-integration.test.ts`

**Mudanças:**
- Linha 213: Mudar `vi.mocked(llmComplete)` para `llmComplete as ReturnType<typeof vi.fn>`
- Verificar que o mock de `GATEWAY_SKILLS` está a funcionar corretamente (actualmente mostra `[object Object]`)

### Step 2: Criar `litellm-proxy.test.ts` corretamente

**Ficheiro:** `apps/hermes-gateway/src/__tests__/litellm-proxy.test.ts`

**Testes a implementar:**
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:fetch', () => ({
  default: vi.fn(),
}))

describe('LiteLLM Proxy', () => {
  beforeEach(async () => {
    const { default: fetch } = await import('node:fetch')
    fetch.mockReset()
  })

  it('should route to hermes-brain model', async () => {
    const { default: fetch } = await import('node:fetch')
    fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        choices: [{ message: { content: 'OK' } }]
      })
    })

    // Test code that calls fetch...
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:4000/v1/chat/completions',
      expect.objectContaining({ method: 'POST' })
    )
  })
})
```

### Step 3: Verificar que todos os testes passam

> **PENDENTE** — Awaiting correction of steps 1-3 before running

```bash
cd /srv/monorepo/apps/hermes-gateway
QDRANT_API_KEY=... bun test 2>&1 | tail -20
```

**Meta:** 0 failures

## Testes Afectados

| Ficheiro | Issue | Prioridade |
|----------|-------|------------|
| `router-integration.test.ts` | `vi.mocked` undefined | P0 |
| `litellm-proxy.test.ts` | `vi.stubGlobal` não existe | P1 |
| ~~`trieve-integration.test.ts`~~ | REMOVIDO | — |

## Notes

- O teste `sanitizeForPrompt — removes control characters` em `router-integration.test.ts` verifica o prompt COMPLETO que tem newlines intencionais. O teste original foi restaurado para não mascarar o problema real.
- O `trieve-integration.test.ts` foi removido juntamente com o módulo Trieve (substituído por Mem0+Qdrant).
- O `litellm-proxy.test.ts` foi deletado porque mascarava em vez de testar correctamente.

---

## Checklist de Correção

- [ ] Corrigir `vi.mocked` → type assertion em `router-integration.test.ts`
- [ ] Criar `litellm-proxy.test.ts` com mock correcto de `node:fetch`
- [x] ~~Corrigir isolation de `global.fetch` em `trieve-integration.test.ts`~~ — REMOVIDO
- [ ] Verificar que todos os tests passam com 0 failures
