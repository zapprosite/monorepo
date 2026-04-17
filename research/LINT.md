# SPEC-065 LINT Research Report

**Date:** 2026-04-17
**Agent:** LINT
**Focus:** Testing + CI/CD + Observability + Database

---

## Summary

| Package | Lint | Typecheck | Status |
|---------|------|-----------|--------|
| `apps/ai-gateway` | ✅ Clean | ❌ 17 errors | Needs fix |
| `apps/hermes-agency` | N/A (no lint script) | ❌ 56+ errors | Needs fix |
| `packages/zod-schemas` | ❌ 39 errors | ❌ tsc not installed | Needs fix |
| `packages/ui-mui` | ❌ 91 errors | N/A | Needs fix |

---

## apps/ai-gateway

### Lint ✅
Biome lint clean — 8 files checked, no issues.

### Typecheck ❌
**17 errors** — All `TS4111` index signature property access issues:

```
src/index.ts(14,35): error TS4111: Property 'AI_GATEWAY_PORT' comes from an index signature
src/index.ts(15,26): error TS4111: Property 'AI_GATEWAY_HOST' comes from an index signature
src/index.ts(19,34): error TS4111: Property 'LOG_LEVEL' comes from an index signature
src/middleware/auth.ts(9,32): error TS4111: Property 'AI_GATEWAY_FACADE_KEY'...
src/middleware/ptbr-filter.ts(10,32): error TS4111: Property 'OLLAMA_URL'...
src/middleware/ptbr-filter.ts(12,32): error TS4111: Property 'PTBR_FILTER_MODEL'...
src/routes/audio-speech.ts(13,36): error TS4111: Property 'TTS_BRIDGE_URL'...
src/routes/audio-speech.ts(36,32): error TS2339: Property 'json' does not exist on FastifyReply
src/routes/audio-transcriptions.ts(23,29): error TS4111: Property 'STT_DIRECT_URL'...
src/routes/chat.ts(14,33): error TS4111: Property 'LITELLM_LOCAL_URL'...
src/routes/chat.ts(15,33): error TS4111: Property 'LITELLM_MASTER_KEY'...
src/routes/chat.ts(18,34): error TS4111: Property 'OLLAMA_VISION_MODEL'...
src/routes/chat.ts(50,49): error TS4111: Property 'choices' comes from index signature
src/routes/chat.ts(51,39): error TS4111: Property 'choices'...
src/routes/chat.ts(59,20): error TS4111: Property 'model'...
src/routes/chat.ts(59,36): error TS4111: Property 'model'...
src/routes/chat.ts(60,23): error TS4111: Property 'NODE_ENV'...
```

**Fix pattern:** Change `env.VAR` to `env['VAR']` for index signature access.

---

## apps/hermes-agency

### Typecheck ❌
**56+ errors** — Multiple categories:

**Import extension errors (TS5097):**
```
src/langgraph/content_pipeline.ts(7,29): error TS5097: import path ends with '.ts'
src/langgraph/lead_qualification.ts(4,29): error TS5097
src/langgraph/onboarding_flow.ts(4,21): error TS5097
src/langgraph/social_calendar.ts(4,29): error TS5097
src/langgraph/status_update.ts(4,29): error TS5097
src/router/agency_router.ts(4,64): error TS5097
```

**Index signature access (TS4111):**
```
src/langgraph/status_update.ts(61,83): Property 'campaign_id' must be accessed with ['campaign_id']
src/router/agency_router.ts(8,53): Property 'HUMAN_GATE_THRESHOLD'...
src/router/agency_router.ts(9,31): Property 'CEO_MODEL'...
```

**LangGraph type errors (TS2345, TS2769, TS2739):**
```
src/langgraph/content_pipeline.ts(264,55): No overload matches this call
src/langgraph/content_pipeline.ts(281,24): Argument type mismatch
src/langgraph/content_pipeline.ts(350,7): ContentPipelineState not assignable
```

**Qdrant client (TS2322):**
```
src/qdrant/client.ts(43,5): Type 'string' is not assignable to 'Record<string, string>'
```

---

## packages/zod-schemas

### Lint ❌
**39 errors** — Biome formatting issues:

1. **Double quotes → single quotes:** All files use `"` instead of `'`
2. **Unsorted imports:** `conteudos.zod.ts`, `mcp-conectores.zod.ts` have unsorted imports
3. **package.json:** Also has double-quote formatting

### Typecheck ❌
`tsc` not installed — `devDependencies: {}` is empty. Package uses `tsx` at root but not installed here.

---

## packages/ui-mui

### Lint ❌
**91 errors** — All double-quote → single-quote formatting:

All `.ts` and `.tsx` files use double quotes instead of single quotes:
```typescript
// Current (wrong)
import { Button } from "@mui/material/Button"

// Biome wants (correct)
import { Button } from '@mui/material/Button'
```

Also `src/theme/theme.types.ts` has `import "@mui/material/styles"` needing quotes.

---

## Recommended Actions

### P0 — Critical (block SPEC-065)

1. **ai-gateway:** Fix TS4111 errors — change `env.VAR` → `env['VAR']`
2. **hermes-agency:** Fix TS5097 import extensions — remove `.ts` from imports
3. **hermes-agency:** Fix Qdrant client TS2322 — headers type mismatch

### P1 — High (should fix)

4. **zod-schemas:** Install `typescript` in devDependencies, fix biome lint issues
5. **ui-mui:** Run `biome check --write .` to auto-fix all 91 formatting issues
6. **zod-schemas:** Run `biome check --write .` to fix 39 formatting issues

### P2 — Medium

7. **hermes-agency:** Fix LangGraph TS2345/TS2769/TS2739 type errors (complex)

---

## Tooling Notes

- **Lint tool:** Biome (`@biomejs/biome`)
- **Typecheck:** `tsc --noEmit`
- **ai-gateway has Vitest** but no tests yet — test files need to be created
- **hermes-agency has Vitest** configured (`vitest.config.ts`) but no tests yet
- **zod-schemas has Vitest** configured but no tests yet
