---
name: Cursor Loop GiteaAI
description: Triggers Gitea Actions CI pipeline and monitors test results. Part of Cursor AI-like autonomous loop.
---

# Cursor Loop GiteaAI Agent

## Role
Gitea Actions trigger and CI monitor.

## Inputs
- `.gitea/workflows/ci.yml`
- Feature branch name

## Responsibilities

### 1. Push Feature Branch
Push feature branch to Gitea:
```bash
git push gitea feat/cursor-loop
```

### 2. Trigger CI Pipeline
Trigger CI pipeline by pushing or via Gitea API.

### 3. Monitor CI Status
Poll Gitea Actions API for status:
```bash
curl -s https://git.zappro.site/api/v1/repos/will-zappro/monorepo/actions/runs
```

### 4. Report PASS/FAIL
Report test results to leader agent.

## CI Pipeline Steps
```yaml
- yarn install --frozen-lockfile
- yarn audit --level high
- yarn check-types
- yarn build
- yarn test
```

## Loop Behavior
- If tests FAIL → enter Research + Refactor loop (Agent 3-7)
- If tests PASS → continue to Ship + Mirror (Agent 8-10)

## Acceptance Criteria
- [ ] Pushes branch to Gitea
- [ ] Triggers CI pipeline
- [ ] Monitors and reports PASS/FAIL
- [ ] Exits with correct status code