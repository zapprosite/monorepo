# NAMESPACE MIGRATION PLAN

## Status

| Field | Value |
|-------|-------|
| Document ID | NAMESPACE-MIGRATION-PLAN |
| Date | 2026-04-26 |
| Status | DRAFT |
| Phase | PHASE 5 — No Code Changes |

---

## Current State

### Package Names with Old Namespace

| Package | Current Name | Type |
|---------|--------------|------|
| Root | `connected-repo` | package name |
| API | `@connected-repo/backend` | package name |
| Frontend | `@connected-repo/frontend` | package name |
| Zod Schemas | `@connected-repo/zod-schemas` | package name |
| Config | `@connected-repo/config` | package name |
| UI | `@connected-repo/ui` | package name |

### Repository References

| File | Current | Target |
|------|---------|--------|
| package.json (root) | `zapprosite/homelab-monorepo` | `zapprosite/monorepo` |
| apps/api/package.json | `teziapp/connected-repo-starter` | `zapprosite/monorepo` |
| apps/web/package.json | `teziapp/connected-repo-starter` | `zapprosite/monorepo` |
| packages/*/package.json | `teziapp/connected-repo-starter` | `zapprosite/monorepo` |

### Authors to Update

| Current | Target |
|---------|--------|
| `will <will@zapprosite.com>` | `Leonardo Gomide <will@zapprosite.com>` |
| `Balkrishna Agarwal <krishna@teziapp.com>` | `Leonardo Gomide <will@zapprosite.com>` |

---

## Target Namespace Options

### Option A: `@zappro/*` (Recommended)

| Package | New Name |
|---------|----------|
| Root | `homelab-monorepo` |
| API | `@zappro/api` |
| Frontend | `@zappro/web` |
| Zod Schemas | `@zappro/zod-schemas` |
| Config | `@zappro/config` |
| UI | `@zappro/ui` |

**Pros:**
- Clear brand identity
- Consistent with domain (zappro.site)
- Easy to understand ownership

**Cons:**
- Requires updating all workspace references
- Breaking change for any external consumers

### Option B: `@repo/*`

| Package | New Name |
|---------|----------|
| Root | `monorepo` |
| API | `@repo/api` |
| Frontend | `@repo/web` |
| Zod Schemas | `@repo/zod-schemas` |

**Pros:**
- Generic, not tied to brand
- Easy to re-brand later

**Cons:**
- Less descriptive
- Could conflict with other repos

### Option C: Keep `@connected-repo/*` but fix teziapp references

Minimal change — only fix repository URLs and authors, don't rename packages.

**Pros:**
- No workspace reference changes
- Minimal blast radius

**Cons:**
- Doesn't solve the "connected-repo" branding issue
- teziapp references are the main problem, not the package names

---

## Recommended Approach

**Option A: `@zappro/*`**

Rationale:
1. Package names (`@connected-repo/*`) are internal workspace references, not published to npm
2. The main issues are `teziapp/connected-repo-starter` repo URLs and old author names
3. After fixing identity fields (author, license, repository) in PHASE 1, the remaining issue is namespace
4. `@zappro/*` provides clear brand identity

---

## Migration Order (Safe, Incremental)

### Phase A: Update Internal References (Low Risk)

1. Update `@connected-repo/zod-schemas` → `@zappro/zod-schemas`
2. Update all workspace references from `@connected-repo/*` → `@zappro/*`
3. Update turbo.json filters if used

**Files to change:**
- `packages/zod-schemas/package.json` (name field)
- `apps/*/package.json` (workspace dependencies)
- `packages/*/package.json` (workspace dependencies)

**Rollback:** `git revert HEAD` of this phase

### Phase B: Update Package Names (Medium Risk)

1. Rename `@connected-repo/backend` → `@zappro/api`
2. Rename `@connected-repo/frontend` → `@zappro/web`
3. Rename `@connected-repo/config` → `@zappro/config`
4. Rename `@connected-repo/ui` → `@zappro/ui`

**Files to change:**
- `apps/api/package.json` (name field)
- `apps/web/package.json` (name field)
- `packages/config/package.json` (name field)
- `packages/ui/package.json` (name field)

**Rollback:** `git revert HEAD` of this phase

### Phase C: Update Dockerfile and CI References

1. Update `turbo prune @connected-repo/backend` → `@zappro/api`
2. Update any `@connected-repo/*` references in workflows

**Files to change:**
- `apps/api/Dockerfile`
- `.github/workflows/*.yml`
- `.gitea/workflows/*.yml`

**Rollback:** `git revert HEAD` of this phase

### Phase D: Verify and Test

1. Run `pnpm install --frozen-lockfile`
2. Run `pnpm build`
3. Run `pnpm test`
4. Verify Docker build works

---

## NOT Renaming in This Plan

The following should NOT be renamed (separate decisions):

| Item | Reason |
|------|--------|
| `painel-organism` | Has its own release cycle and namespace |
| `mcps/*` | MCP packages have their own versioning |
| `apps/ai-gateway` | AI gateway is external-facing with different versioning |

---

## Rollback Plan

Each phase can be rolled back with `git revert HEAD`.

For full rollback of all phases:
```bash
# Find the commits to revert
git log --oneline --all | grep -E "namespace|@zappro|@connected-repo"

# Revert in reverse order (newest first)
git revert <commit_hash>
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Breaking internal workspace references | Update all `workspace:*` references before pushing |
| Docker build failures | Test Dockerfile after each rename |
| CI/CD pipeline failures | Update workflow filters to match new package names |
| Version conflicts | Use `--frozen-lockfile` to lock versions |

---

**Generated:** 2026-04-26
**Next Action:** Review and approve this plan before executing Phase A
