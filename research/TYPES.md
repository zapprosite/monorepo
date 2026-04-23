# TypeScript Check Results

Executed via: `node node_modules/typescript/bin/tsc --noEmit --project <pkg>`

Date: 2026-04-23

## Summary

TypeScript check **FAILED** across 3 packages. The root cause is a conflicting `tsc` npm package (v2.0.4) that shadows the real TypeScript compiler. The monorepo has TypeScript 5.9.3 correctly installed but the `tsc` binary in `node_modules/.bin/` points to the wrong package.

### Root Cause

```
node_modules/.bin/tsc -> ../tsc/bin/tsc  (package "tsc" v2.0.4 - WRONG)
node_modules/typescript/bin/tsc         (TypeScript 5.9.3 - CORRECT)
```

The `tsc` npm package (v2.0.4 by basarat) is a deprecated TypeScript compiler wrapper that outputs "This is not the tsc command you are looking for" instead of running the actual compiler.

---

## Package: @hermes-agency/core

**Path:** `apps/hermes-agency/`

### Errors (39)

| File | Error Code | Message |
|------|------------|---------|
| `src/__tests__/agency_router.test.ts` | TS2307 | Cannot find module 'vitest' or its corresponding type declarations |
| `src/__tests__/agency_router.test.ts` | TS5097 | An import path can only end with a '.ts' extension when 'allowImportingTsExtensions' is enabled |
| `src/__tests__/agency_router.test.ts` | TS2580 | Cannot find name 'process'. Do you need to install type definitions for node? |
| `src/__tests__/circuit_breaker.test.ts` | TS2307 | Cannot find module 'vitest' |
| `src/__tests__/circuit_breaker.test.ts` | TS5097 | Import path extension error |
| `src/__tests__/skills.test.ts` | TS2307 | Cannot find module 'vitest' |
| `src/__tests__/skills.test.ts` | TS5097 | Import path extension error |
| `src/index.ts` | TS2307 | Cannot find module 'node:http' or its corresponding type declarations |
| `src/index.ts` | TS5097 | Import path extension error |
| `src/index.ts` | TS2580 | Cannot find name 'process', 'console', 'fetch', 'AbortSignal' |
| `src/langgraph/content_pipeline.ts` | TS2307 | Cannot find module '@langchain/langgraph' |
| `src/langgraph/content_pipeline.ts` | TS5097 | Import path extension error |
| `src/langgraph/content_pipeline.ts` | TS2584 | Cannot find name 'console' |

### Likely Fixes

1. **vitest types missing:** Add `vitest` to `devDependencies` or ensure `types: ["vitest"]` in tsconfig
2. **@types/node missing:** The package has `@types/node@^22.0.0` in devDependencies but types are not resolving - likely due to `tsc` wrapper issue
3. **Import path extensions:** Enable `allowImportingTsExtensions` in tsconfig.json or remove `.ts` extensions
4. **node:http module:** Add `"types": ["node"]` to compilerOptions or ensure `@types/node` is properly installed

---

## Package: @repo/zod-schemas

**Path:** `packages/zod-schemas/`

### Errors (1)

| File | Error Code | Message |
|------|------------|---------|
| `src/__tests__/journal_entry.zod.test.ts` | TS2307 | Cannot find module 'vitest' or its corresponding type declarations |

### Likely Fix

1. **vitest types missing:** Add vitest to devDependencies or configure types in tsconfig

---

## Package: @repo/ui-mui (also called @repo/ui)

**Path:** `packages/ui/`

### Errors (44+)

#### Global Configuration Issue
- `TS2468`: Cannot find global value 'Promise' - indicates missing `lib` in tsconfig

#### node_modules type errors (likely `skipLibCheck: true` would suppress)
- `TS1259`: esModuleInterop flag needed for @types/prop-types
- `TS2583`: Map, Set not found (missing lib es2015)
- `TS2304`: Iterable not found
- `TS2456`: ReactNode type alias circularly references itself
- `TS2707`: Generic type DatePickerProps/DateTimePickerProps/TimePickerProps wrong arg count

#### Source file errors
- `TS17004`: Cannot use JSX unless '--jsx' flag is provided
- `TS6142`: Module '../layout/Box' was resolved but '--jsx' is not set
- `TS2550`: Property 'entries' does not exist on type 'ObjectConstructor'

### Likely Fixes

1. **JSX not configured:** The `react-library.json` extended config likely missing `jsx` field - verify the config at `packages/config/react-library.json`
2. **Missing lib:** Add `"lib": ["ES2020", "DOM", "DOM.Iterable"]` to compilerOptions
3. **Object.entries:** Replace `Object.entries()` with `Object.entries<...>()` or ensure lib es2017+

---

## Recommended Fix Order

1. **URGENT:** Remove or rename the `tsc` npm package to avoid binary collision:
   ```bash
   pnpm remove tsc
   ```
   Or add ` resolutions: { "tsc": "typescript" }` to package.json

2. **For @hermes-agency/core:**
   - Add `"types": ["node"]` to tsconfig.compilerOptions
   - Add `"vitest/globals"` or `types: ["vitest"]` to tsconfig

3. **For @repo/ui-mui:**
   - Verify `packages/config/react-library.json` has `jsx` and `lib` properly set
   - May need to add `"esModuleInterop": true` to the extended config

4. **For all packages:**
   - After fixing tsc collision, re-run typecheck to get accurate error list

---

## Verification Command

```bash
# After fixing tsc collision:
cd /srv/monorepo
node node_modules/typescript/bin/tsc --noEmit --project apps/hermes-agency
node node_modules/typescript/bin/tsc --noEmit --project packages/zod-schemas
node node_modules/typescript/bin/tsc --noEmit --project packages/ui
```
