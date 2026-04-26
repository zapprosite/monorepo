# Dependency Audit Report — 2026-04-26

**Agent:** dependency-auditor
**Scope:** /srv/monorepo/apps/, /srv/monorepo/packages/, /srv/monorepo/scripts/, /srv/monorepo/.claude/vibe-kit/
**Package Manager:** pnpm@9.0.6

---

## Findings

### Outdated Packages (8 packages)

| Package | Current | Latest | Severity |
|---------|---------|--------|----------|
| @biomejs/biome | 2.4.11 | 2.4.13 | MEDIUM |
| @typescript-eslint/eslint-plugin | 8.58.2 | 8.59.0 | MEDIUM |
| @typescript-eslint/parser | 8.58.2 | 8.59.0 | MEDIUM |
| @eslint/js | 9.39.4 | 10.0.1 | HIGH |
| eslint | 9.39.4 | 10.2.1 | HIGH |
| globals | 15.15.0 | 17.5.0 | MEDIUM |
| lint-staged | 15.5.2 | 16.4.0 | MEDIUM |
| typescript | 5.9.3 | 6.0.3 | HIGH |

### Vulnerabilities
- **pnpm audit:** No known vulnerabilities found

---

## Critical Issues

- **[CRITICAL] Deprecated `tsc` package in root devDependencies:**
  Root `package.json` declares `tsc: "^2.0.4"` as a devDependency. This is a **deprecated package** (published by basarat/orta, last updated years ago) and is NOT the TypeScript compiler. The actual TypeScript compiler is `typescript: 5.9.3` which correctly provides the `tsc` binary. The deprecated `tsc` package may conflict or behave unexpectedly.

- **[CRITICAL] Lockfile conflict:**
  Both `bun.lock` and `pnpm-lock.yaml` exist in the repository root. The `package.json` specifies `packageManager: pnpm@9.0.6`, indicating pnpm is the intended package manager. The `bun.lock` should be removed to prevent confusion and accidental use of bun instead of pnpm.

- **[CRITICAL] Application dependencies hoisted to root instead of declared in consuming packages:**
  Root `package.json` contains production dependencies (`@trpc/server`, `ulid`, `zod`) that are not used by the root workspace itself — they are consumed exclusively by `apps/api`:
  - `apps/api/src/trpc.ts` imports from `@trpc/server`
  - `apps/api/src/db/base_table.ts` imports `ulid`
  - Multiple `apps/api/src/**/*.trpc.ts` files import `zod`
  
  These should be moved to `apps/api/package.json` dependencies. Root-level production dependencies create maintenance issues and hide actual dependency relationships.

---

## High Priority Issues

- **[HIGH] Multiple ESLint/TypeScript tooling outdated to major versions:**
  ESLint 10.x and TypeScript 6.0 are available. ESLint 10 introduces breaking changes from v9. TypeScript 6.0 is a new major version. These should be tested in a feature branch before upgrading.

---

## Recommendations

1. **Remove deprecated `tsc` package:**
   ```bash
   pnpm remove tsc
   ```
   The `typescript` package already provides the `tsc` binary used in all build scripts.

2. **Remove `bun.lock` and commit to pnpm:**
   ```bash
   rm bun.lock
   git add pnpm-lock.yaml
   git commit -m "chore: remove bun.lock, use pnpm as package manager"
   ```

3. **Move application dependencies from root to `apps/api`:**
   ```bash
   cd apps/api
   pnpm add @trpc/server ulid zod
   ```
   Then remove from root `package.json`:
   ```bash
   pnpm remove @trpc/server ulid zod
   ```

4. **Update ESLint tooling (test in feature branch first):**
   ```bash
   pnpm up @eslint/js eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser
   ```
   ESLint 10 requires flat config format — verify `eslint.config.js` is compatible.

5. **Update TypeScript (test thoroughly before merging):**
   ```bash
   pnpm up typescript
   ```
   TypeScript 6.0 may have breaking changes. Run full typecheck and tests.

6. **Update remaining packages:**
   ```bash
   pnpm up @biomejs/biome globals lint-staged
   ```

7. **Standardize dependency declarations:**
   Ensure each workspace package explicitly declares its dependencies rather than relying on hoisting from root. Add `publishConfig` constraints or use `pnpm.exclusiveDependencies` if needed.

---

## Files Reviewed

- `/srv/monorepo/package.json` (root)
- `/srv/monorepo/apps/ai-gateway/package.json`
- `/srv/monorepo/apps/api/package.json`
- `/srv/monorepo/packages/config/package.json`
- `/srv/monorepo/packages/ui/package.json`
- `/srv/monorepo/packages/zod-schemas/package.json`
- `/srv/monorepo/pnpm-workspace.yaml`
- `/srv/monorepo/pnpm-lock.yaml`
- `/srv/monorepo/bun.lock`

---

## Handoff

```
to: review-agent (quality-scorer)
summary: Dependency audit complete
message: Outdated: 8 (2 HIGH, 6 MEDIUM). Vulnerabilities: 0. Critical issues: 3 (deprecated tsc package, bun.lock/pnpm-lock conflict, hoisted app deps)
```
