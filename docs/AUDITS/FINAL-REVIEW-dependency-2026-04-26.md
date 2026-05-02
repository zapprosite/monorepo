# Dependency Review — 2026-04-26

## Findings

### [CRITICAL] Zod Version Mismatch — `apps/ai-gateway`

**Files:**
- `apps/ai-gateway/package.json:20` — `zod@^3.24.1` (direct dep)
- `apps/ai-gateway/test/auth.test.ts:18,27,33,44,50` — imports from `@repo/zod-schemas`
- `packages/zod-schemas/package.json:22` — `peerDependencies: { "zod": "^4.1.12" }`

**Problem:** `ai-gateway` has `zod@^3.24.1` as direct dependency BUT imports `@repo/zod-schemas` which requires `zod@^4.1.12` as peer dependency. Zod v3 and v4 have breaking changes (incompatible API). When tests run, they get zod v3 but `@repo/zod-schemas` expects v4.

**Recommendation:** Remove `zod` from `apps/ai-gateway/package.json` direct dependencies — let it inherit `zod@^4.x` from the workspace root.

---

### [HIGH] `@fastify/cors` Version Mismatch Across Apps

**Files:**
- `apps/api/package.json:23` — `"@fastify/cors": "^11.1.0"`
- `apps/ai-gateway/package.json:18` — `"@fastify/cors": "^10.0.1"`

**Problem:** `@fastify/cors@10.x` and `@fastify/cors@11.x` have different peer dependency requirements. Both apps use Fastify 5, but `@fastify/cors@10` was designed for Fastify 4. This can cause runtime issues.

**Recommendation:** Align both apps to `@fastify/cors@^11.1.0` and verify Fastify 5 compatibility.

---

### [HIGH] Root `package.json` Contains Production Dependencies

**File:** `package.json:24` — `@trpc/server@^11.7.0` is in root `dependencies`

**Problem:** Root `package.json` lists `@trpc/server`, `ulid`, and `zod` as production dependencies, but the root workspace doesn't consume them directly. These are consumed exclusively by `apps/api`. This violates monorepo best practices and causes confusion about where dependencies should be declared.

**Recommendation:** Move `@trpc/server`, `ulid`, `zod` from root `package.json` to `apps/api/package.json`.

---

### [MEDIUM] Duplicate Zod in Lockfile

**Files:**
- `pnpm-lock.yaml:4284` — `zod@3.25.76`
- `pnpm-lock.yaml:4287` — `zod@4.3.6`

**Problem:** Both zod v3 and v4 are in the lockfile, increasing install size and potential bundle bloat.

**Recommendation:** After fixing the zod version mismatch, run `pnpm dedupe` to ensure only one zod version remains.

---

### [MEDIUM] Missing TypeScript Version Pinning Consistency

**Files:**
- `package.json:43` — `typescript@5.9.3`
- `apps/api/devDependencies` — uses `@repo/typescript-config` workspace
- `packages/config/package.json` — has no `typescript` dependency

**Problem:** `@repo/typescript-config` package has no actual TypeScript dependency, relying on workspace hoisting. This can cause version drift if different apps expect different TS versions.

**Recommendation:** Add `typescript` as a dev dependency in `@repo/typescript-config` or ensure all apps pin the same TypeScript version.

---

### [LOW] Path Alias `@backend/*` vs Package Name

**File:** `apps/api/tsconfig.json:8` — `"@backend/*": ["src/*"]`

**Problem:** The package is named `@connected-repo/backend` but the path alias is `@backend/*`. This creates confusion about import semantics.

**Recommendation:** Either rename the alias to `@connected-repo/backend/*` or rename the package to `@backend`. Keep consistent.

---

### [LOW] Export Map in `packages/zod-schemas` Uses Non-Existent Dist

**File:** `packages/zod-schemas/package.json:26-30`

```json
"exports": {
  "./*": {
    "types": "./src/*.ts",
    "import": "./dist/*.js",
    "default": "./dist/*.js"
  }
}
```

**Problem:** Exports field points to `./dist/*.js` but the package has no build script that outputs to `dist/`. The actual source is in `./src/*.ts`. This causes `MODULE_NOT_FOUND` errors when importing.

**Recommendation:** Fix exports to point to `./src/*.ts` for both types and import, or ensure the package is built before use.

---

## Recommendations Summary

1. **[CRITICAL]** Remove `zod` from `apps/ai-gateway/package.json` — inherit workspace zod v4
2. **[HIGH]** Align `@fastify/cors` to `^11.1.0` in both apps
3. **[HIGH]** Move `@trpc/server`, `ulid`, `zod` from root `package.json` to `apps/api/package.json`
4. **[MEDIUM]** Run `pnpm dedupe` after fixing zod version
5. **[MEDIUM]** Pin TypeScript version in `@repo/typescript-config`
6. **[LOW]** Unify path alias naming (`@backend/*` → `@connected-repo/backend/*`)
7. **[LOW]** Fix `packages/zod-schemas` exports map

---

## Priority Actions

```bash
# 1. Fix zod in ai-gateway
cd apps/ai-gateway && pnpm remove zod

# 2. Align fastify/cors versions
cd apps/ai-gateway && pnpm add @fastify/cors@^11.1.0
cd apps/api && pnpm add @fastify/cors@^11.1.0

# 3. Move root dependencies to api
cd apps/api && pnpm add @trpc/server@^11.7.0 ulid@^3.0.1 zod@^4.1.12
cd (root) && pnpm remove @trpc/server ulid zod

# 4. Dedupe lockfile
pnpm dedupe
```
