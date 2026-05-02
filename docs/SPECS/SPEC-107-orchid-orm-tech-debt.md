# SPEC-107: Orchid ORM TypeScript Technical Debt

**Date:** 2026-05-02
**Status:** Proposed
**Priority:** Medium
**Affected:** `/srv/monorepo/apps/api`

---

## Context

The API (`@connected-repo/backend`) has **339 TypeScript errors** that prevent successful compilation. These errors are pre-existing and block CI from passing.

### Error Breakdown

| Error Code | Count | Root Cause |
|------------|-------|------------|
| `TS2742` | ~180 | Inferred type requires `pqb/internal` reference — not portable |
| `TS4114` | ~80 | Members need `override` modifier — conflicts with `strictPropertyInitialization` |
| `TS4111` | ~40 | Index signature access required — conflicts with `noPropertyAccessFromIndexSignature` |
| `TS2345` | ~20 | Type mismatches in seed/trpc files |
| `TS6133` | ~15 | Unused variables/declarations |
| `TS2554` | ~9 | Wrong argument count to ORM methods |

### Root Cause

The `tsconfig.base.json` strict settings conflict with orchid-orm's `BaseTable` pattern:

```typescript
// tsconfig.base.json (strict mode)
"strictPropertyInitialization": true,  // ← conflicts
"noImplicitOverride": true,             // ← conflicts
"noPropertyAccessFromIndexSignature": true  // ← causes TS4111
```

```typescript
// base_table.ts pattern that conflicts
export class BaseTable {
  columns = this.setColumns((t) => ({ ... }));
  //                ↑ TS2742: inferred type not portable
}
```

### Why These Errors Happen

1. **TS2742**: orchid-orm infers complex types that reference internal `pqb` module paths. TypeScript can't serialize these types across files without a direct reference to the module.

2. **TS4114/TS4111**: The `BaseTable` base class uses `columns` property that gets inherited. Strict TS mode requires explicit `override` on inherited members, but the inheritance pattern is implicit in orchid-orm.

3. **TS4111** (partially fixed): `process.env.KEY` requires bracket notation `process.env['KEY']` when `noPropertyAccessFromIndexSignature` is enabled.

---

## Options

### Option 1: Relax tsconfig (Hotfix) — 5 min

**Changes:**
```json
// tsconfig.base.json
{
  "compilerOptions": {
    "strictPropertyInitialization": false,
    "noImplicitOverride": false,
    "noPropertyAccessFromIndexSignature": false  // Already partially applied
  }
}
```

**Pros:** Quick fix, unblocks CI immediately
**Cons:** Reduces type safety for all packages in monorepo

---

### Option 2: Fix BaseTable Type Exports (Proper Fix) — 1-2 days

Create explicit type annotations in `base_table.ts` to make types portable:

```typescript
export type BaseTableType = {
  readonly table: string;
  columns: ColumnDefinitions;
};

export const BaseTable = createBaseTable({ ... });
```

Then add explicit return types to all table classes.

**Pros:** Maintains type safety, proper solution
**Cons:** Requires type surgery across all table files

---

### Option 3: Migrate to Drizzle ORM — 1 week

The `@repo/db` package already uses drizzle-orm. Migration path exists but is effort-heavy.

**Pros:** Modern, well-typed ORM with better TS support
**Cons:** Massive refactoring effort across all modules

---

### Option 4: Suppress with @ts-expect-error — 4 hours

Add suppression comments to each error location.

**Pros:** Fixes without changing tsconfig
**Cons:** 339 suppressions = 339 code smells

---

## Recommendation

**Immediate:** Apply Option 1 to unblock CI

**Future (Q2 2026):** Investigate Option 2 or track as part of CRM legacy migration

---

## Files Affected

- `apps/api/tsconfig.json` — extends `tsconfig.base.json`
- `apps/api/src/db/base_table.ts` — BaseTable definition
- All `*.table.ts` files in `apps/api/src/modules/**/tables/`
- All `*.trpc.ts` files using db queries
- `apps/api/src/db/seed/*.ts` — seed files

---

## Verification

After fix:
```bash
cd /srv/monorepo && pnpm build
# Should complete without errors
```

CI check:
```bash
git push origin main
# GitHub Actions should pass
```

---

## Notes

- The CRM-REFRIMIX legacy system (`/srv/crm-mvp`) uses Nx monorepo and may have similar issues
- orchid-orm v1.65.1 is current version in use
- Upgrading to v1.66.0+ did NOT resolve the errors