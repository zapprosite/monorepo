# SPEC-ENTERPRISE-BASELINE-FIXES-2026-04

## Metadata

| Field | Value |
|-------|-------|
| Spec ID | SPEC-ENTERPRISE-BASELINE-FIXES-2026-04 |
| Date | 2026-04-26 |
| Status | EXECUTING |
| Priority | CRITICAL |
| Owner | Platform Engineering |

---

## PHASE 0 — PR/Merge Health

| Task | Status |
|------|--------|
| T01: PR #9 Blocker | ⚠️ OPEN (content merged) — needs manual close |

**PR #9:** https://github.com/zapprosite/monorepo/pull/9

---

## PHASE 1 — Identity & License Fix

| Task | Status |
|------|--------|
| T02: author/license/repository | ✅ DONE — `fix/identity-license-baseline` |

---

## PHASE 2 — Workspace & Lockfile Baseline

| Task | Status |
|------|--------|
| T03: mcps inclusion + lockfile | ✅ DONE — `fix/workspace-baseline` |

---

## PHASE 3 — Docker/API Deploy Sanity

| Task | Status |
|------|--------|
| T04: Health endpoint | ✅ VERIFIED |
| T05: Dockerfile fix | ✅ DONE — `fix/docker-deploy-sanity` (human gate) |

---

## PHASE 4 — CI Honesty

| Task | Status |
|------|--------|
| T06: CI checks + Trivy doc | ✅ DONE — `fix/ci-honesty-baseline` (human gate) |

---

## PHASE 5 — Namespace Plan

| Task | Status |
|------|--------|
| T07: NAMESPACE-MIGRATION-PLAN.md | ✅ DONE — `docs/namespace-migration-plan` |

---

## Remaining Tasks (T08-T12)

### T08: Verify Docker Build (human gate)
- File: `apps/api/Dockerfile`
- Verify `docker build` succeeds after T05 changes
- **Blocked by:** T05

### T09: Run Full CI on PRs
- Run `pnpm install --frozen-lockfile && pnpm check-types && pnpm test`
- Verify all checks pass
- **Blocked by:** T06

### T10: Close PR #9 (manual)
- Close https://github.com/zapprosite/monorepo/pull/9
- Reason: "Content already merged via squash merge 0d63174"
- **Human action required**

### T11: Merge Enterprise Baseline PRs
- Merge `merge/enterprise-baseline-fixes` → main
- Or merge individual: T02 → T03 → T05 → T06 → T07
- **Human gate**

### T12: Cleanup Stale Branches
- Delete `polimento-final` (merged)
- Delete `feature/enterprise-template` (superseded)
- Delete `feature/enterprise-template-v2` (superseded)
- Delete `feature/enterprise-security-polimento-final` (merged)

---

## Completed Branches

| Branch | Status |
|--------|--------|
| `fix/identity-license-baseline` | ✅ Merged in `merge/enterprise-baseline-fixes` |
| `fix/workspace-baseline` | ✅ Merged |
| `fix/docker-deploy-sanity` | ✅ Done, needs review |
| `fix/ci-honesty-baseline` | ✅ Done, needs review |
| `docs/namespace-migration-plan` | ✅ Done, PR created |

---

## Next Action

Execute T08-T09 in parallel after T05/T06 human gates are cleared.

**Generated:** 2026-04-26
