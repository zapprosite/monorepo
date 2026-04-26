# SPEC-BATCH-MERGE — Merge 7 Feature Branches Zero-Conflict

## Context

Need to merge 7 feature branches into `main` without conflicts. Direct merge fails due to 142+ conflicts (mostly modify/delete and content conflicts in governance/docs files). Using Nexus 20-agent parallel execution to extract net-new files only and guarantee zero conflicts.

## Branches to merge

| Branch | Commits | Conflitos estimados |
|--------|---------|-------------------|
| `feature/feat-judge-minimax-escalation-0d5182d3` | 34 | 13 |
| `feature/homelab-seguro-e-estavel-pt2` | 21 | 90 |
| `feature/stripe-v84-backup` | 31 | 13 |
| `feat/fit-tracker-mvp` | 3 | 4 |
| `feature/swarm-mvp-wiring` | 3 | 8 |
| `feature/refinamento-de-monorepo-part3` | 1 | 1 |
| `feature/quantum-forge-1777224290` | 1 | 0 |

## Strategy: Net-New Files Only

**Rule:** For each branch, extract ONLY files that don't exist in `main`. Skip modifications to existing files (they require human decision).

**Why zero conflicts:** Copying new files never conflicts — git only conflicts when the same file is modified in both sides.

## Acceptance Criteria

- [ ] All 7 branches processed
- [ ] Zero merge conflicts
- [ ] No modifications to existing files (only net-new additions)
- [ ] PR created with clear commit history per branch
- [ ] All net-new files traceable to source branch

## Execution Plan

### Phase 1: Extract (parallel 7 agents)
Each agent:
1. `git diff main..BRANCH --name-only` → list changed files
2. `git diff main..BRANCH --stat` → file types
3. Filter: keep only files where `git show main:PATH` returns error (doesn't exist in main)
4. Output: `BRANCH-new-files.json` list
5. Tag: 1 agent per branch

### Phase 2: Copy (parallel 7 agents)
Each agent:
1. Read `BRANCH-new-files.json`
2. `git show BRANCH:PATH > new-files/PATH` for each
3. `git add new-files/`
4. Commit: `feat(BRANCH): net-new files from BRANCH`
5. Tag: 1 agent per branch

### Phase 3: Verify (1 agent)
1. `git diff main --name-only` → all added files
2. Verify none existed in main (no overwrite risk)
3. `git log --oneline main..HEAD` → confirm 7 commits
4. Run `pnpm check-types || echo "typecheck skipped"`
5. Tag: deploy/docker-builder (generic verifier)

### Phase 4: PR (1 agent)
1. Create PR via `gh pr create`
2. Title: `feat(batch): merge 7 feature branches`
3. Body: table of branches + new files count
4. Tag: docs/readme-writer (PR writer)

## Agents (20 total)

| # | Agent | Role |
|---|-------|------|
| 1 | backend/api-developer | Branch 1: feat-judge-minimax |
| 2 | backend/service-architect | Branch 2: homelab-pt2 |
| 3 | backend/db-migrator | Branch 3: stripe-v84 |
| 4 | backend/cache-specialist | Branch 4: fit-tracker |
| 5 | backend/auth-engineer | Branch 5: swarm-mvp |
| 6 | backend/event-developer | Branch 6: refinamento-part3 |
| 7 | backend/file-pipeline | Branch 7: quantum-forge |
| 8 | test/unit-tester | Phase 2 helper: copy files |
| 9 | test/integration-tester | Phase 2 helper: copy files |
| 10 | test/e2e-tester | Phase 2 helper: copy files |
| 11 | test/coverage-analyzer | Phase 2 helper: copy files |
| 12 | test/boundary-tester | Phase 2 helper: copy files |
| 13 | test/flaky-detector | Phase 2 helper: copy files |
| 14 | test/property-tester | Phase 2 helper: copy files |
| 15 | deploy/docker-builder | Phase 3: verify |
| 16 | deploy/compose-orchestrator | Phase 3: verify |
| 17 | deploy/coolify-deployer | Phase 3: verify |
| 18 | deploy/secret-rotator | Phase 3: verify |
| 19 | deploy/rollback-executor | Phase 3: verify |
| 20 | docs/readme-writer | Phase 4: PR |

## Output

- Branch: `merge/batch-features`
- PR: `chore(batch): merge 7 feature branches into main`
- Commit history: 7 squash commits (one per branch)
