# SPEC-041: Monorepo Estado da Arte — Polish 2026

**Date:** 2026-04-14
**Author:** Claude Code
**Status:** SPECIFIED
**Type:** Enhancement / Tech Debt Resolution

---

## 1. Objective

Polish the homelab-monorepo to state-of-the-art by resolving accumulated tech debt, optimizing build performance, and upgrading patterns to match April 2026 best practices. The monorepo currently runs Turbo 2.9.6 + pnpm 9.0.6 with tRPC v11 and Zod v4 — foundation is solid, but gaps in caching, type safety, and CI optimization prevent "estado da arte" designation.

---

## 2. Tech Stack Inventory

### Current Versions

| Package | Current | Target | Gap |
|---------|---------|--------|-----|
| Turbo | 2.9.6 | 2.9.6 (LOCKED) | SPEC-025 |
| pnpm | 9.0.6 | 9.0.6 (LOCKED) | SPEC-025 |
| tRPC | 11.7.0 | 11.x latest | Low |
| Zod | 4.1.12 | 4.x latest | Low |
| TypeScript | ~5.x | 5.5+ | Medium |
| ESLint | Flat config? | 9.x flat config | High |
| Fastify | 5.x? | Verify current | Medium |
| React | 19? | 19.x | Medium |
| MUI | 6? | 6.x latest | Low |

### Apps (8)
```
api, list-web, obsidian-web, orchestrator, perplexity-agent, todo-web, web, workers
```

### Packages (7)
```
config, db, email, env, trpc, ui, zod-schemas
```

---

## 3. Research Findings (from agents + direct analysis)

### TypeScript Strict Mode (agent: a532e07b)

**Current state:** Not confirmed if strict mode is enabled globally. Each app has its own tsconfig.

**Patterns to apply:**
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true
  }
}
```

**Build performance:** Use `tsc --build` (incremental) with `composite: true` + project references.

### Fastify + tRPC v11 Patterns (agent: a2677e3e)

**Key patterns:**
- tRPC v11 uses `initTRPC` (not `createServer`)
- Batching is automatic (HTTP/2 multiplex)
- `.strict()` on all Zod inputs to catch unknown keys
- Context: `{ req: FastifyRequest, res: FastifyReply, user?: { id: string } }`

### Turbo Pipeline Optimization (from turbo.json analysis)

**Current turbo.json gaps:**
```json
// MISSING from current config:
- "//": "Global env vars"
- "env": { "NODE_ENV": "production" }
- "cacheDir": "./.turbo"
- No remote cache configuration
- No `deploy` task
- No `db:generate` (Prisma)
- No `clean` task
```

### ESLint Flat Config (agent: a4f7efaa)

**Target setup:**
- `eslint.config.js` at root (ESLint 9 flat config)
- `eslint --cache` + `ESLINT_CACHE_LOCATION`
- Per-workspace overrides
- `lint-staged.config.js` with `concurrently` for parallel formatting

### Code Quality Architecture

| Layer | Tool | Config Location |
|-------|------|-----------------|
| Lint | ESLint flat config | `eslint.config.js` at root |
| Format | Prettier | `prettier.config.js` at root |
| Pre-commit | Husky v9+ | `.husky/pre-commit` |
| Staged files | lint-staged | `lint-staged.config.js` at root |

### GitHub Actions Caching (not resolved — agent failed 529)

**Target patterns:**
```yaml
- uses: actions/cache@v4
  with:
    path: |
      node_modules
      .turbo
      .next
    key: turbo-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
    restore-keys: turbo-${{ runner.os }}-
```

### Docker Multi-stage (agent: a1043c)

**Target pattern:**
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

---

## 4. Tasks — Implementation

### HIGH Priority

| ID | Task | File | Change |
|----|------|------|--------|
| T-001 | Fix hardcoded project ID | `apps/perplexity-agent/config.py` | `os.environ.get("INFISICAL_PROJECT_ID")` |
| T-002 | Fix hardcoded project ID | `apps/perplexity-agent/agent/browser_agent.py` | env var reference |
| T-003 | Fix hardcoded project ID | `smoke-tests/smoke-chat-zappro-site-e2e.sh` | env var reference |
| T-004 | Fix hardcoded project ID | `scripts/cursor-loop-research-minimax.sh` | env var reference |
| T-005 | Enable ESLint flat config | Root `eslint.config.js` | New file |
| T-006 | Add Husky + lint-staged | `.husky/pre-commit` + config | New files |
| T-007 | Add Prettier shared config | `prettier.config.js` | New file |

### MEDIUM Priority

| ID | Task | File | Change |
|----|------|------|--------|
| T-008 | Enhance turbo.json | `turbo.json` | Add deploy, db:generate, clean tasks |
| T-009 | Add GitHub Actions cache | `.github/workflows/ci.yml` | Add turbo cache step |
| T-010 | Add `tsconfig.base.json` | Root | Base tsconfig with strict mode |
| T-011 | Update tsconfig in apps | `apps/*/tsconfig.json` | Extend base |
| T-012 | Add Docker multi-stage | `apps/api/Dockerfile` | Optimize layer caching |

### LOW Priority (Nice to have)

| ID | Task | File | Change |
|----|------|------|--------|
| T-013 | Verify tRPC v11 patterns | `apps/api/src/routers/` | Ensure `.strict()` on inputs |
| T-014 | Add `clean` turbo task | `turbo.json` | Remove build artifacts |
| T-015 | Add `db:generate` task | `turbo.json` | Prisma generate |
| T-016 | Add deploy task | `turbo.json` | Docker build + push |

---

## 5. Success Criteria

1. **Zero hardcoded project IDs** in executable code (all use env vars)
2. **ESLint flat config** working across all apps with `--cache`
3. **Husky pre-commit** running lint-staged on staged files
4. **Turbo remote cache** configured for GitHub Actions
5. **TypeScript strict mode** enabled globally
6. **Docker multi-stage** in `apps/api/Dockerfile`
7. **Build time** reduced by 30% via caching
8. **All 8 apps** passing `turbo build` without errors

---

## 6. Open Questions

1. **Infisical not running on port 8200** — `cursor-loop-research-minimax.sh` fails. Should we run Infisical locally or use cloud API?
2. **MINIMAX_API_KEY duplicate** — line 38 has OpenAI format key, line 81 has real MiniMax. Which is correct?
3. **Hermes gateway** listening on 8092, not 8642. Should we update HERMES_GATEWAY_URL in .env?
4. **bot.zappro.site 502** — Cloudflare tunnel ingress wrong. Need valid API token to fix. Resolution path?

---

## 7. Dependencies

- SPEC-025 (Version Lock) — Turbo 2.9.6 + pnpm 9.0.x locked
- SPEC-026 (Git Mirror) — Branch naming + push hooks
- SPEC-040 (Alerting) — Related to monitoring stack

---

## 8. Verification

Run after changes:
```bash
pnpm turbo build --filter=api
pnpm turbo lint --filter=... --parallel
git log --oneline -3
```

Success: all apps build, no lint errors, pre-commit hooks pass.