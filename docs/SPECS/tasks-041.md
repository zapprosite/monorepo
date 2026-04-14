# SPEC-041 Tasks — Monorepo Estado da Arte Polish

**Date:** 2026-04-14
**SPEC:** SPEC-041
**Status:** PENDING

---

## HIGH Priority

| ID | Task | File | Change |
|----|------|------|--------|
| T-001 | Fix hardcoded project ID | `apps/perplexity-agent/config.py` | `os.environ.get("INFISICAL_PROJECT_ID")` |
| T-002 | Fix hardcoded project ID | `apps/perplexity-agent/agent/browser_agent.py` | env var reference |
| T-003 | Fix hardcoded project ID | `smoke-tests/smoke-chat-zappro-site-e2e.sh` | env var reference |
| T-004 | Fix hardcoded project ID | `scripts/cursor-loop-research-minimax.sh` | env var reference |
| T-005 | Enable ESLint flat config | Root `eslint.config.js` | New file |
| T-006 | Add Husky + lint-staged | `.husky/pre-commit` + config | New files |
| T-007 | Add Prettier shared config | `prettier.config.js` | New file |

## MEDIUM Priority

| ID | Task | File | Change |
|----|------|------|--------|
| T-008 | Enhance turbo.json | `turbo.json` | Add deploy, db:generate, clean tasks |
| T-009 | Add GitHub Actions cache | `.github/workflows/ci.yml` | Add turbo cache step |
| T-010 | Add `tsconfig.base.json` | Root | Base tsconfig with strict mode |
| T-011 | Update tsconfig in apps | `apps/*/tsconfig.json` | Extend base |
| T-012 | Add Docker multi-stage | `apps/api/Dockerfile` | Optimize layer caching |

## LOW Priority

| ID | Task | File | Change |
|----|------|------|--------|
| T-013 | Verify tRPC v11 patterns | `apps/api/src/routers/` | Ensure `.strict()` on inputs |
| T-014 | Add `clean` turbo task | `turbo.json` | Remove build artifacts |
| T-015 | Add `db:generate` task | `turbo.json` | Prisma generate |
| T-016 | Add deploy task | `turbo.json` | Docker build + push |

---

## Verification Commands

```bash
pnpm turbo build --filter=api
pnpm turbo lint --filter=... --parallel
git log --oneline -3
```

---

## Pipeline

**Phase 1:** T-001 a T-004 (hardcoded secrets fix)
**Phase 2:** T-005 a T-007 (ESLint + Husky + Prettier)
**Phase 3:** T-008 a T-012 (Turbo + GitHub Actions + tsconfig + Docker)
**Phase 4:** T-013 a T-016 (verification + final tasks)
