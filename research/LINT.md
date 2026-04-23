# LINT Report

**Date:** 2026-04-23
**Command:** `pnpm lint`

## Summary

Lint found **16 infos** (all FIXABLE) across 2 packages:
- `@repo/ai-gateway`: 16 issues
- `@repo/ui-mui`: multiple formatting issues

All issues are auto-fixable via `biome check --write`.

---

## @repo/ai-gateway (apps/ai-gateway)

### File: `src/index.ts`

| Line | Rule | Description |
|------|------|-------------|
| 14:35 | `lint/complexity/useLiteralKeys` | Computed expression can be simplified - use `process.env.AI_GATEWAY_PORT` instead of `process.env['AI_GATEWAY_PORT']` |
| 15:26 | `lint/complexity/useLiteralKeys` | Computed expression can be simplified - use `process.env.AI_GATEWAY_HOST` instead of `process.env['AI_GATEWAY_HOST']` |
| 19:34 | `lint/complexity/useLiteralKeys` | Computed expression can be simplified - use `process.env.LOG_LEVEL` instead of `process.env['LOG_LEVEL']` |

### File: `src/middleware/auth.ts`

| Line | Rule | Description |
|------|------|-------------|
| 9:32 | `lint/complexity/useLiteralKeys` | Use `process.env.AUTH_SECRET` instead of `process.env['AUTH_SECRET']` |
| 12:40 | `lint/complexity/useLiteralKeys` | Use `process.env.JWT_SECRET` instead of `process.env['JWT_SECRET']` |

### File: `src/routes/proxy.ts`

| Line | Rule | Description |
|------|------|-------------|
| 48:47 | `lint/complexity/useLiteralKeys` | Use `process.env.NODE_ENV` instead of `process.env['NODE_ENV']` |
| 60:70 | `lint/complexity/useLiteralKeys` | Use `process.env.NODE_ENV` instead of `process.env['NODE_ENV']` |

---

## @repo/ui-mui (packages/ui)

All issues are **formatting** issues (quote style: double quotes should be single quotes).

### Files affected:

- `src/components/ContentCard.tsx` - quote style issues
- `src/components/ErrorAlert.tsx` - quote style issues
- `src/components/LoadingSpinner.tsx` - quote style issues
- And likely other files with similar formatting

---

## Fix Command

```bash
cd /srv/monorepo
pnpm biome check --write
```

Or for specific packages:

```bash
cd /srv/monorepo/apps/ai-gateway && pnpm biome check --write src/
cd /srv/monorepo/packages/ui && pnpm biome check --write src/
```
