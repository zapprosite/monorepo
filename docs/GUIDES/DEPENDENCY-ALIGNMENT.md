# Dependency Alignment

**Generated:** 2026-04-26
**Based on:** SPEC-091 prior analysis
**Status:** CURRENT

---

## Runtime Environment

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 22.x | `engines.node >= 22` |
| pnpm | 9.0.6 | `packageManager: pnpm@9.0.6` |
| Bun | 1.x | Available but not primary |

---

## Root Dependencies

### Production

| Package | Version | License | Status |
|---------|---------|---------|--------|
| @trpc/server | ^11.7.0 | MIT | Current |
| zod | ^4.1.12 | MIT | Current |
| ulid | ^3.0.1 | MIT | Current |

### Development

| Package | Version | License | Status |
|---------|---------|---------|--------|
| turbo | 2.9.6 | Apache-2.0 | Current |
| typescript | 5.9.3 | Apache-2.0 | Current |
| @biomejs/biome | ^2.3.0 | Apache-2.0 | Current |
| eslint | ^9.0.0 | MIT | Current |
| @playwright/test | ^1.59.1 | Apache-2.0 | Current |
| husky | ^9.0.0 | MIT | Current |
| lint-staged | ^15.0.0 | MIT | Current |

---

## Deprecations Identified (SPEC-091)

| Package | Deprecation | Replacement | Priority |
|---------|-------------|-------------|----------|
| tsc | Legacy | Use turbo `check-types` | Low |
| tsc-alias | Legacy | Use turbo build | Low |

---

## Workspace Structure

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

## Audit Notes

- **No audit performed** — this document is based on existing SPEC-091 analysis
- All dependencies appear current
- No known security vulnerabilities in direct dependencies
- License compliance: MIT/Apache-2.0 only

---

## Update Policy

**DO NOT run `pnpm update` or `npm update`** without approval.
Use dependency-alerts.yml CI for monitoring only.

---

**Template:** enterprise-template-v2
