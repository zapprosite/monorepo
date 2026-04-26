# VERSION-AUDIT-2026-04 — Dependencies & Tooling

**Date:** 2026-04-26
**Status:** CRITICAL — CI FAILING
**Scope:** GitHub Actions, Node.js runtime, pnpm

---

## CI Failure Root Cause

```
pnpm version mismatch:
- GitHub Action: version 9 (hardcoded)
- package.json: pnpm@9.0.6 (packageManager field)

Node.js 20 deprecated:
- actions/checkout@v4 uses Node.js 20
- actions/setup-node@v4 uses Node.js 20
- pnpm/action-setup@v4 uses Node.js 20
```

---

## Research via Context7/WebFetch (04/2026)

### GitHub Actions — Latest Versions

| Action | Latest | Node.js | Status |
|--------|--------|---------|--------|
| `actions/checkout` | **v6.0.2** | Node.js 24 | CURRENT |
| `actions/setup-node` | **v6.4.0** (2026-04-20) | Node.js 24 | CURRENT |
| `pnpm/action-setup` | **v5.0.0** (2026-03-17) | N/A (uses setup-node) | CURRENT |

### pnpm/action-setup Version Mismatch Fix

> If `package.json` has `packageManager` field, **omit `version` input** entirely.
> The action will auto-read from `packageManager`.

**Current (BROKEN):**
```yaml
- uses: pnpm/action-setup@v4
  with:
    version: 9  # ← CONFLICT with packageManager: pnpm@9.0.6
```

**Fixed:**
```yaml
- uses: pnpm/action-setup@v5
  with:
    version: 9.0.6  # ← Match exact version OR omit to auto-detect
```

Or simply omit `version`:
```yaml
- uses: pnpm/action-setup@v5
  # no version needed — reads from packageManager
```

---

## Dependency Audit (package.json)

### Outdated / Deprecated

| Package | Current | Latest | Action |
|---------|---------|--------|--------|
| `turbo` | 2.9.6 | 2.9.8+ | Minor update available |
| `typescript` | 5.9.3 | 5.9.3 | OK (latest stable) |
| `zod` | 4.1.12 | 4.1.12 | OK |
| `@trpc/server` | 11.7.0 | 11.7.0 | OK |
| `eslint` | 9.0.0 | 9.x | OK |
| `@biomejs/biome` | 2.3.0 | 2.3.0 | OK |

### Engines

```json
"engines": {
  "node": ">=22"  // ✅ OK — ahead of Node 20 deprecation
}
```

---

## Actions Workflow Fix Required

**File:** `.github/workflows/pr-check.yml`

| Current | Fixed |
|---------|-------|
| `actions/checkout@v4` | `actions/checkout@v6` |
| `actions/setup-node@v4` | `actions/setup-node@v6` |
| `pnpm/action-setup@v4` | `pnpm/action-setup@v5` |
| `version: 9` (hardcoded) | `version: 9.0.6` OR remove (auto-detect) |

---

## Risk Assessment

| Change | Risk | Impact |
|--------|------|--------|
| Update checkout@v4→v6 | LOW | Breaking only if runner < v2.327.1 |
| Update setup-node@v4→v6 | LOW | Breaking only for very old configs |
| Update pnpm/action@v4→v5 | LOW | Resolves Node.js 20 compatibility |
| Remove hardcoded `version: 9` | **MEDIUM** | Must ensure packageManager is accurate |

---

## Recommendation

1. **URGENT** — Fix CI: update all 3 actions to latest versions
2. **OPTIONAL** — Update turbo to 2.9.8
3. **VERIFY** — Ensure `packageManager` field stays in sync with pnpm version

---

## Files to Change

```
.github/workflows/pr-check.yml  — UPDATE ACTIONS
package.json                    — VERIFY (optional: bump turbo)
```

---

## References

- https://github.com/actions/checkout (v6.0.2, Node.js 24)
- https://github.com/actions/setup-node (v6.4.0, 2026-04-20)
- https://github.com/pnpm/action-setup (v5.0.0, 2026-03-17)
