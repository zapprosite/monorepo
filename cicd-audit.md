# CI/CD Audit Report

**Date:** 2026-04-11
**Scope:** GitHub Actions + Gitea Actions + Coolify deploy pipeline
**Repository:** `/srv/monorepo`

---

## 1. Workflow Inventory

### 1.1 GitHub Actions (`.github/workflows/`)

| Workflow | Trigger | Purpose | Package Manager |
|----------|---------|---------|-----------------|
| `ci.yml` | push + PR to main | Build + lint + test | pnpm |
| `deploy-on-green.yml` | workflow_run (CI success) | Trigger Coolify webhook | N/A |
| `deploy-main.yml` | push to main + workflow_dispatch | Full pipeline: build → human gate → deploy → smoke test → rollback | yarn |
| `rollback.yml` | workflow_dispatch | Manual rollback to previous deployment | yarn |
| `code-review.yml` | PR opened/sync/reopen | 5-gate review: automated checks → Trivy → AI review → human approval → merge signal | yarn |
| `daily-report.yml` | cron (9am weekdays) | Stats report (docs, specs, tasks) | N/A |
| `deploy-perplexity-agent.yml` | push to main (perplexity-agent/**) | Deploy perplexity-agent to Coolify + smoke test | N/A |

### 1.2 Gitea Actions (`.gitea/workflows/`)

| Workflow | Trigger | Purpose | Package Manager |
|----------|---------|---------|-----------------|
| `ci.yml` | push + PR | Build + lint + test (simpler) | pnpm |
| `ci-feature.yml` | push (non-main) + workflow_dispatch | Feature branch CI: security audit + type check + lint + build + test | pnpm |
| `deploy-on-green.yml` | workflow_run (CI completed) | Trigger Coolify webhook (same as GitHub) | N/A |
| `deploy-main.yml` | push to main + workflow_dispatch | Full pipeline identical to GitHub version | pnpm |
| `rollback.yml` | workflow_dispatch | Manual rollback identical to GitHub version | yarn |
| `code-review.yml` | PR opened/sync/reopen + PR review submitted | 5-gate review (same as GitHub) | yarn |
| `daily-report.yml` | cron (9am weekdays) | Stats report | N/A |
| `failure-report.yml` | workflow_run (CI failed) | Generate failure summary + Telegram alert | N/A |
| `deploy-perplexity-agent.yml` | push to main (perplexity-agent/**) | Deploy perplexity-agent to Coolify | N/A |
| `voice-proxy-deploy.yml` | push to main (voice proxy files) | Build + push Docker image + deploy to Coolify | N/A |

---

## 2. Unified Pipeline Analysis

### 2.1 Two Parallel Systems

**Reality:** This is NOT a unified pipeline. It is two parallel systems with near-identical configurations:

- **GitHub Actions** (`github.com`): PR reviews, daily reports, perplexity-agent deploy
- **Gitea Actions** (`git.zappro.site`): Primary CI/CD for the monorepo

Both systems deploy to the **same Coolify instance** (`http://localhost:8000`). This creates a **dual-trigger risk**: when a PR merges to main, both GitHub `deploy-on-green.yml` AND Gitea `deploy-on-green.yml` fire simultaneously, both triggering Coolify webhook. Potential double-deploy race condition.

### 2.2 Critical Inconsistency: Package Manager Divergence

| Workflow | Manager | Cache |
|----------|---------|-------|
| GitHub `ci.yml` | pnpm | No turbo cache |
| GitHub `deploy-main.yml` | yarn | Turbo cache |
| GitHub `code-review.yml` | yarn | Turbo cache |
| Gitea `ci.yml` | pnpm | No turbo cache |
| Gitea `ci-feature.yml` | pnpm | pnpm cache |
| Gitea `deploy-main.yml` | pnpm | pnpm cache |
| Gitea `code-review.yml` | yarn | Turbo cache |

**Gap:** The monorepo root uses `pnpm` (per `package.json` scripts), but GitHub `deploy-main.yml` and `code-review.yml` use `yarn`. This causes inconsistent builds.

### 2.3 Gitea act_runner Configuration

```yaml
# docker-compose.gitea-runner.yml
image: docker.io/gitea/act_runner:nightly-dind
container_name: gitea-runner
privileged: true  # Required for Docker-in-Docker
environment:
  CONFIG_FILE: /config.yaml
  GITEA_INSTANCE_URL: http://10.0.1.1:3300
  GITEA_RUNNER_REGISTRATION_TOKEN: ${GITEA_RUNNER_REGISTRATION_TOKEN}
  GITEA_RUNNER_NAME: prod-runner-1
  GITEA_RUNNER_LABELS: ubuntu-latest
  GITEA_RUNNER_EPHEMERAL: "1"
```

- **Runner:** `act_runner` nightly (Docker-in-Docker mode)
- **Token source:** `${GITEA_RUNNER_REGISTRATION_TOKEN}` (from env, stored in Infisical)
- **Labels:** `ubuntu-latest` (matches GitHub runner label for portable workflows)
- **Ephemeral:** Yes (stateless, spun up per job)
- **Health check:** `wget -q http://localhost:3000/healthz` every 30s

---

## 3. Deploy Flow

### 3.1 Standard PR to Main Deploy Flow

```
PR opened
    │
    ├─► Gitea Actions: code-review.yml (5-gate pipeline)
    │       Gate 1: automated-checks (type check, lint, build, test)
    │       Gate 2: security-scan (Trivy vuln + config audit)
    │       Gate 3: ai-review (Claude Code CLI → PR comment)
    │       Gate 4: human-approval (Gitea environment protection)
    │       Gate 5: merge signal
    │
    └─► GitHub Actions: code-review.yml (mirrored)
            (Same 5 gates, GitHub-hosted runners)

PR merged to main
    │
    ├─► Gitea Actions: ci.yml (build + lint + test)
    │       └─► deploy-on-green.yml OR deploy-main.yml
    │
    ├─► GitHub Actions: ci.yml (build + lint + test)
    │       └─► deploy-on-green.yml (webhook trigger)
    │
    └─► GitHub Actions: deploy-perplexity-agent.yml (if perplexity-agent/** changed)
            └─► POST /api/v1/applications/{uuid}/deploy → Coolify
            └─► Poll status until running/idle
            └─► Smoke test: curl localhost:4004/_stcore/health
            └─► Rollback on failure
```

### 3.2 Coolify Deploy Target

All deploys target **Coolify on `localhost:8000`** via API (`COOLIFY_API_KEY` secret). Coolify then deploys containers to the host.

**Primary deployed app:** `perplexity-agent` (port 4004)

**Secondary deploy targets** (via `deploy-main.yml`): `monorepo-web` — but this app is **ORPHANED** (never deployed, `apps/web` archived).

### 3.3 Health Check Configuration

| Workflow | HEALTH_URL | Status |
|----------|-----------|--------|
| `deploy-main.yml` (both GitHub + Gitea) | `http://localhost:4004/_stcore/health` | CORRECT |
| `rollback.yml` (both) | `http://localhost:4004/_stcore/health` | CORRECT |
| `deploy-perplexity-agent.yml` (both) | `http://localhost:4004/_stcore/health` | CORRECT |
| `deploy-on-green.yml` (both) | Webhook only (no health check) | OK |
| `voice-proxy-deploy.yml` (Gitea only) | `http://localhost:4004/_stcore/health` | CORRECT |

**Note:** HEALTH_URL uses `localhost:4004` because act_runner runs with host network access (`network_mode: host` in docker-compose.gitea-runner.yml). This is correct — Gitea Actions runners reach the Coolify host directly.

---

## 4. SPEC-024 Impact on CI/CD

### 4.1 What is SPEC-024?

SPEC-024 ("Web Post-Discontinuity") addresses the retirement of `web.zappro.site` (the old `apps/web` React app that was **never deployed**). Key changes:

- `web.zappro.site` DNS now points to `localhost:4004` (perplexity-agent)
- `apps/web` is orphaned and scheduled for archival
- 24 files reference `web.zappro.site` and need cleanup

### 4.2 CI/CD Impact

**Current state (as of audit):**

```
grep -r "web.zappro.site" .github/workflows/ .gitea/workflows/
  0 results  (workflow HEALTH_URLs already corrected to localhost:4004)
```

The workflows have already been updated from `https://web.zappro.site/_stcore/health` → `http://localhost:4004/_stcore/health`.

**SPEC-024 remaining work (P3-P9 in tasks/todo-spec024.md):**
- P3: CI/CD HEALTH_URL cleanup — COMPLETE
- P4: CI/CD deploy target remapping — COMPLETE
- P5-P8: Documentation and SPECs cleanup — PENDING
- P7: Archive `apps/web` — PENDING

### 4.3 Health Check Target Verification

```bash
# From Gitea runner (host network):
curl -s -o /dev/null -w "%{http_code}" http://localhost:4004/_stcore/health
# Expected: 200
```

This correctly points to `perplexity-agent` which exposes Streamlit's `/_stcore/health` endpoint on port 4004.

---

## 5. Secrets Management

| Secret | Where Stored | Used By |
|--------|-------------|---------|
| `COOLIFY_API_KEY` | Infisical + Gitea Secrets + GitHub Secrets | All deploy + rollback workflows |
| `COOLIFY_URL` | Gitea Secrets + GitHub Secrets | All deploy + rollback workflows |
| `COOLIFY_WEBHOOK_URL` | Gitea Secrets + GitHub Secrets | `deploy-on-green.yml` (webhook trigger) |
| `COOLIFY_REGISTRY_USER` | GitHub Secrets | `voice-proxy-deploy.yml` (Docker login) |
| `COOLIFY_SERVICE_TOKEN` | GitHub Secrets + Gitea Secrets | `voice-proxy-deploy.yml` + `failure-report.yml` |
| `GITEA_TOKEN` | GitHub Secrets | `code-review.yml` (post PR comment) |
| `CLAUDE_API_KEY` | GitHub Secrets | `code-review.yml` (AI review) |
| `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHAT_ID` | GitHub Secrets | `failure-report.yml` |
| `GITEA_RUNNER_REGISTRATION_TOKEN` | Infisical (env var in docker-compose) | act_runner registration |

**Gap:** `GITEA_RUNNER_REGISTRATION_TOKEN` is stored in Infisical but also referenced in `docker-compose.gitea-runner.yml` via `${GITEA_RUNNER_REGISTRATION_TOKEN}`. The docker-compose reads from the host environment, which must have the variable set.

---

## 6. Deploy Flow Diagram

```
                                    ┌─────────────────────────┐
                                    │   Coolify (:8000)       │
                                    │   Primary deploy target │
                                    └────────────┬────────────┘
                                                 │
          ┌──────────────────────────────────────┼──────────────────────┐
          │                                      │                      │
   GitHub Actions                         Gitea Actions            Manual
   ───────────────                         ───────────              ──────
   ci.yml (PR)                             ci.yml (PR)              approve.sh
   code-review.yml (PR)                    code-review.yml (PR)     query-gate.sh
   deploy-on-green.yml (main)              deploy-on-green.yml (main)
   deploy-perplexity-agent.yml             voice-proxy-deploy.yml  coolify-
   daily-report.yml                                                 access skill
   (Gitea primary,
    GitHub backup)
                                                 │
                                    ┌────────────▼────────────┐
                                    │  act_runner (prod-runner-1)│
                                    │  Ephemeral Docker DIND    │
                                    │  Labels: ubuntu-latest     │
                                    └───────────────────────────┘
```

---

## 7. Gaps in CI/CD Coverage

### Gap 1: Dual `deploy-on-green.yml` — Double-Deploy Risk

Both GitHub and Gitea fire `deploy-on-green.yml` on `main` push after CI passes. Both trigger Coolify via webhook. **Race condition:** two simultaneous deploys can collide.

**Recommendation:** Disable one of the two `deploy-on-green.yml` workflows. Keep Gitea as primary (more reliable for self-hosted), remove GitHub version or make it conditional on a label.

### Gap 2: Package Manager Inconsistency

GitHub `deploy-main.yml` uses `yarn` while the project standard is `pnpm`. This causes different build outputs between CI and deploy stages.

**Recommendation:** Standardize all workflows on `pnpm` to match the monorepo's `package.json` scripts.

### Gap 3: `apps/web` Is Orphaned But Still Referenced

`deploy-main.yml` tries to find "monorepo-web" or "web" in Coolify applications. The `apps/web` React app was never deployed and is now archived (`apps/web.archive`). The deploy target is dead.

**Recommendation:** Either remove `deploy-main.yml` or repurpose it to deploy `perplexity-agent` or another active service.

### Gap 4: `voice-proxy-deploy.yml` Uses Non-Standard Coolify API Endpoint

```yaml
# .gitea/workflows/voice-proxy-deploy.yml line 81
"http://localhost:8000/api/v1/deployments"  # Different from other workflows
```

All other workflows use `/api/v1/applications/{uuid}/deploy`. This endpoint may not exist.

**Recommendation:** Verify `http://localhost:8000/api/v1/deployments` is a valid Coolify API endpoint. If not, update to match the standard pattern.

### Gap 5: No ZFS Snapshot in Deploy Pipeline

`scripts/deploy.sh` supports `--snapshot` flag but no workflow actually calls it. SPEC-024 monitoring recommends ZFS snapshots before heal/restart operations, but the CI/CD pipeline does not create snapshots before deploy.

**Recommendation:** Add ZFS snapshot step to `deploy-main.yml` before triggering Coolify deploy, at least for production environment.

### Gap 6: Gitea `failure-report.yml` References GitHub Context

```yaml
# .gitea/workflows/failure-report.yml
if: github.event.workflow_run.conclusion == 'failure'
```

Uses `github.*` context in a Gitea Actions workflow. Gitea uses `gitea.*` context. This conditional will never fire correctly in Gitea Actions.

**Recommendation:** Update to `gitea.event.workflow_run.conclusion`.

### Gap 7: No CI/CD Coverage for `apps/orchestrator`

The `apps/orchestrator` package has no deploy workflow and is not tested in any CI pipeline. Its `package.json` has no `test` script.

---

## 8. Recommendations for Unified Pipeline

### 8.1 Consolidate to Single CI/CD System

**Option A:** Keep GitHub Actions as primary, use Gitea Actions only for local dev/testing with `act_runner exec`.

**Option B (recommended):** Keep Gitea Actions as primary (data sovereignty, self-hosted), remove redundant GitHub `deploy-on-green.yml` workflows. Use GitHub Actions only for cross-repo triggers (e.g., external PRs).

### 8.2 Standardize on pnpm

Replace all `yarn` references in workflows with `pnpm`:
- `.github/workflows/deploy-main.yml`
- `.github/workflows/code-review.yml`
- `.gitea/workflows/code-review.yml`
- `.gitea/workflows/rollback.yml`

### 8.3 Recommended Unified Deploy Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    Unified Deploy Pipeline                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  PR → ci-feature.yml (Gitea) → code-review.yml (5 gates)        │
│                            ↓                                     │
│  Merge → ci.yml (Gitea)                                         │
│            ↓                                                     │
│     human-gate (Gitea environment protection)  ← approve.sh     │
│            ↓                                                     │
│     deploy-main.yml (Gitea)                                      │
│       1. Build + test (pnpm turbo)                              │
│       2. Trigger Coolify API deploy                             │
│       3. Poll status until healthy                              │
│       4. Smoke test (localhost:4004/_stcore/health)              │
│       5. Rollback on failure (auto)                              │
│                                                                  │
│  perplexity-agent/** → deploy-perplexity-agent.yml (Gitea)       │
│  voice-proxy/** → voice-proxy-deploy.yml (Gitea)                 │
│                                                                  │
│  daily: daily-report.yml (GitHub + Gitea)                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 8.4 Health Checks Are Wired Correctly

The health checks ARE wired correctly:
- `localhost:4004/_stcore/health` is the perplexity-agent Streamlit health endpoint
- act_runner's `network_mode: host` means `localhost` resolves to the host machine
- After SPEC-024 cleanup, no workflows reference `web.zappro.site`

---

## 9. Key Files Referenced

| File | Purpose |
|------|---------|
| `.github/workflows/*.yml` | GitHub Actions workflow definitions |
| `.gitea/workflows/*.yml` | Gitea Actions workflow definitions |
| `docker-compose.gitea-runner.yml` | act_runner container config |
| `apps/perplexity-agent/docker-compose.yml` | perplexity-agent container config |
| `scripts/deploy.sh` | Pre-deploy validation + optional ZFS snapshot |
| `scripts/approve.sh` | Human gate polling + approval |
| `scripts/query-gate.sh` | Human gate status query |
| `scripts/health-check.sh` | Monorepo health check |
| `tasks/todo-spec024.md` | SPEC-024 cleanup task tracker |
| `tasks/plan-spec024.md` | SPEC-024 cleanup plan |
| `docs/SPECS/SPEC-024-*.md` | SPEC-024 monitoring + web discontinuity |
| `docs/SPECS/SPEC-015-GITEA-ACTIONS-ENTERPRISE.md` | Gitea Actions enterprise spec |
| `SPEC.md` | Project root spec (subdomains) |

---

## 10. Summary

| Question | Answer |
|----------|--------|
| **Unified pipeline or two systems?** | Two parallel systems (GitHub + Gitea). Gitea is primary, GitHub is backup/mirror. |
| **SPEC-024 change to CI/CD targets?** | `web.zappro.site` HEALTH_URLs already corrected to `localhost:4004`. Remaining work is docs/SPECs cleanup. |
| **Health checks wired correctly?** | YES — `localhost:4004/_stcore/health` is correct for perplexity-agent. act_runner host networking allows localhost access. |
| **Deploy flow: PR → Gitea CI → Coolify?** | YES — `deploy-main.yml` in Gitea Actions triggers Coolify API deploy. GitHub also has redundant `deploy-on-green.yml`. |
| **Key gaps** | Dual `deploy-on-green` (race condition), package manager inconsistency (yarn vs pnpm), orphaned `apps/web` deploy target, `voice-proxy-deploy.yml` uses non-standard API endpoint, `failure-report.yml` uses wrong context (`github.*` in Gitea), no deploy coverage for `apps/orchestrator`. |
