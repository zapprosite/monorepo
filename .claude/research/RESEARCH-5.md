# RESEARCH-5: Gitea Actions Best Practices for Claude Code CLI

**Date:** 2026-04-17
**Agent:** RESEARCH-5 (Enterprise Refactor)
**Focus:** Gitea Actions workflow dispatch, secrets management, artifact passing, parallel jobs, self-hosted runners

---

## 1. Key Findings

### 1.1 Gitea Actions is GitHub Actions Compatible

Gitea Actions (v1.25+) uses **GitHub Actions syntax compatibility** — same `uses:`, `run:`, `env:`, `secrets.`, `jobs.*.needs`, `matrix` patterns. This means:

- `actions/checkout@v4` works natively
- `actions/setup-node@v4` works
- `${{ secrets.VAR }}` syntax is identical
- `${{ gitea.event.pull_request.number }}` replaces `github.event.pull_request.number`
- `$GITHUB_STEP_SUMMARY` is aliased to `$GITEA_STEP_SUMMARY`

### 1.2 Secrets Management

**Pattern observed in monorepo:**

```yaml
env:
  NODE_ENV: test # non-secret env var
jobs:
  deploy:
    steps:
      - name: Trigger Coolify
        run: |
          curl -sf -X POST \
            -H "Authorization: Bearer ${COOLIFY_TOKEN}" \
            "${COOLIFY_WEBHOOK_URL}"
        env:
          COOLIFY_TOKEN: ${{ secrets.COOLIFY_TOKEN }}
          COOLIFY_WEBHOOK_URL: ${{ secrets.COOLIFY_WEBHOOK_URL }}
```

**Key points:**

- Secrets stored in Gitea repo settings → accessed via `secrets.VAR_NAME`
- Secrets NOT available in trigger条件 (only at job runtime)
- `workflow_dispatch` with `inputs` allows manual trigger with parameters
- GITEA_TOKEN stored as `secrets.GITEA_TOKEN` for API calls

### 1.3 Workflow Dispatch

**Manual trigger pattern (`workflow_dispatch`):**

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'production'
        type: choice
        options:
          - production
          - staging
          - preview
```

**Schedule pattern (`cron`):**

```yaml
on:
  schedule:
    - cron: '0 9 * * 1-5' # Weekdays at 9am UTC
```

**Chained workflow (`workflow_run`):**

```yaml
on:
  workflow_run:
    workflows: ['CI']
    types: [completed]
    branches: [main]

jobs:
  deploy:
    if: ${{ github.event.workflow_run.conclusion == 'success' }}
```

### 1.4 Parallel Jobs & Concurrency

**Dependency-based parallelism:**

```yaml
jobs:
  lint:
    runs-on: ubuntu-latest
    steps: [...]
  build:
    runs-on: ubuntu-latest
    needs: [] # parallel with lint
    steps: [...]
  test:
    runs-on: ubuntu-latest
    needs: [build, lint] # runs after both complete
    steps: [...]
```

**Concurrency group (PR cancellation):**

```yaml
concurrency:
  group: review-${{ gitea.event.pull_request.number }}
  cancel-in-progress: true
```

### 1.5 Service Containers

```yaml
services:
  postgres:
    image: postgres:15-alpine
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: connected_repo_test
    ports:
      - 5432:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

### 1.6 Self-Hosted Runners

**Registration token approach:**

```yaml
# In workflow (using runner registration token)
jobs:
  build:
    runs-on: self-hosted
    steps:
      - uses: actions/checkout@v4
```

**Runner labels:**

- `ubuntu-latest` — GitHub-hosted (not available in Gitea)
- `self-hosted` — custom label
- Can use multiple labels: `runs-on: [self-hosted, linux, my-label]`

### 1.7 Human Gates via Environment Protection

```yaml
human-gate:
  name: Human Approval Gate
  runs-on: ubuntu-latest
  needs: [build-and-test]
  environment:
    name: production
    url: https://web.zappro.site

deploy:
  name: Deploy to Coolify
  runs-on: ubuntu-latest
  needs: [human-gate]
  environment: production # Must be approved in Gitea UI
```

Gitea requires environment protection rules configured in the repo settings.

### 1.8 Artifact Passing

Gitea Actions supports `actions/upload-artifact@v4` and `actions/download-artifact@v4` but with **limited persistence** (expires at workflow end). Pattern:

```yaml
jobs:
  build:
    steps:
      - uses: actions/upload-artifact@v4
        with:
          name: build-artifact
          path: dist/

  deploy:
    needs: build
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: build-artifact
```

### 1.9 Job Outputs (`GITEA_OUTPUT`)

```yaml
- name: Set AI review status output
  id: ai-review-status
  run: |
    if grep -q "ERROR\|FAIL" /tmp/ai-review-output.txt 2>/dev/null; then
      echo "status=failed" >> $GITEA_OUTPUT
    else
      echo "status=completed" >> $GITEA_OUTPUT
    fi
```

Then referenced as `${{ needs.ai-review-status.outputs.status }}`.

---

## 2. Specific Recommendations for CLAUDE.md / AGENTS.md

### 2.1 Add Gitea Actions Credential Pattern

**Add to CLAUDE.md or AGENTS.md:**

```
### Gitea Actions Credentials (.env canonical)

| Variable          | Source  | Usage                          |
|-------------------|---------|--------------------------------|
| `GITEA_TOKEN`     | .env    | Gitea API calls from workflows  |
| `COOLIFY_API_KEY` | .env    | Coolify deploy via API          |
| `CLAUDE_API_KEY`  | .env    | Claude Code CLI in workflows   |
| `TELEGRAM_BOT_TOKEN` | .env | Failure notifications          |

Reference: `${{ secrets.VAR_NAME }}` in workflow YAML.
```

### 2.2 Document `workflow_dispatch` for Claude Code CLI

**Add to orchestrator skill or AGENTS.md:**

```bash
# Trigger workflow manually via Gitea API
curl -X POST \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches" \
  -H "Authorization: token $GITEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ref": "main", "inputs": {"environment": "production"}}'
```

### 2.3 Document Self-Healing Pattern with `workflow_run`

Current `failure-report.yml` demonstrates chaining:

```yaml
on:
  workflow_run:
    workflows: ['CI']
    types: [completed]
```

This can be extended for auto-retry, rollback, or notification patterns.

### 2.4 Concurrency Control for PRs

Add this pattern to prevent redundant runs:

```yaml
concurrency:
  group: ${{ gitea.repository }}-${{ gitea.event.pull_request.number }}
  cancel-in-progress: true
```

### 2.5 Environment Protection as Human Gate

Document that `environment:` in Gitea Actions requires:

1. Environment created in Gitea repo settings
2. Protection rules (required reviewers, waiting time)
3. Environment URL for deployment tracking

---

## 3. Code Examples for Enterprise Refactor

### 3.1 Claude Code CLI in Gitea Actions

```yaml
ai-review:
  name: AI Code Review
  runs-on: ubuntu-latest
  if: gitea.event == 'pull_request'
  steps:
    - name: Checkout
      uses: actions/checkout@v4
      with:
        ref: ${{ gitea.event.pull_request.head.sha }}
        fetch-depth: 0

    - name: Run AI review via Claude Code CLI
      env:
        CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
      run: |
        claude -p --print "Review this PR for correctness, security, and performance" 2>&1 | \
        tee /tmp/ai-review-output.txt
```

### 3.2 Multi-Stage Pipeline with Parallel Jobs

```yaml
jobs:
  # Stage 1: Parallel verification
  lint:
    runs-on: ubuntu-latest
    steps: [uses: actions/checkout@v4, run: pnpm biome check .]

  type-check:
    runs-on: ubuntu-latest
    steps: [uses: actions/checkout@v4, run: pnpm tsc --noEmit]

  secrets-scan:
    runs-on: ubuntu-latest
    steps: [uses: actions/checkout@v4, run: /sec]

  # Stage 2: Build (after lint + type-check)
  build:
    runs-on: ubuntu-latest
    needs: [lint, type-check]
    steps: [uses: actions/checkout@v4, run: pnpm build]

  # Stage 3: Test (after build)
  test:
    runs-on: ubuntu-latest
    needs: [build]
    services:
      postgres:
        image: postgres:15-alpine
        ports: [5432:5432]
    steps: [uses: actions/checkout@v4, run: pnpm test]
```

### 3.3 Scheduled Cron with Notification

```yaml
on:
  schedule:
    - cron: '0 9 * * 1-5' # Weekdays 9am
  workflow_dispatch: # Manual trigger

jobs:
  daily-report:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Generate report
        run: |
          echo "## Daily Report $(date +%Y-%m-%d)" >> $GITHUB_STEP_SUMMARY
          echo "PRs: $(gh pr list --state open --json number | jq length)" >> $GITHUB_STEP_SUMMARY

      - name: Notify on Telegram
        if: always()
        env:
          TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          TELEGRAM_CHAT_ID: ${{ secrets.TELEGRAM_CHAT_ID }}
        run: |
          curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}&text=Daily report generated"
```

---

## 4. Recommendations: Add / Update / Delete

### ADD to CLAUDE.md or AGENTS.md

| Item                                | Location                        | Reason                                  |
| ----------------------------------- | ------------------------------- | --------------------------------------- |
| Gitea Actions credentials table     | CLAUDE.md                       | Document `.env` → `secrets.VAR` pattern |
| `workflow_dispatch` trigger pattern | AGENTS.md or orchestrator SKILL | Enable manual workflow triggers         |
| Concurrency control for PRs         | AGENTS.md CI/CD section         | Prevent redundant CI runs               |
| `GITEA_OUTPUT` job outputs pattern  | AGENTS.md                       | Document inter-job communication        |
| Self-hosted runner label convention | AGENTS.md                       | Clarify `runs-on: self-hosted` usage    |

### UPDATE in existing files

| File                                   | Change                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| `.claude/skills/gitea-access/SKILL.md` | Add `workflow_dispatch` inputs example, add artifact passing section                    |
| `AGENTS.md` Gitea Actions table        | Add `ci.yml`, `daily-report.yml`, `failure-report.yml`, `deploy-on-green.yml` workflows |
| `.claude/skills/orchestrator/SKILL.md` | Document how Gitea Actions can trigger the 14-agent pipeline via `workflow_dispatch`    |

### DELETE — No deletions recommended

Gitea Actions patterns are well-established. No redundant or harmful patterns identified.

---

## 5. Gitea Actions Variable Reference

| Variable                                 | GitHub Compatible | Notes                                |
| ---------------------------------------- | ----------------- | ------------------------------------ |
| `${{ secrets.VAR }}`                     | ✅ Yes            | Gitea repo secrets                   |
| `${{ gitea.event.pull_request.number }}` | ❌ Gitea-specific | Use `gitea.event` not `github.event` |
| `${{ gitea.repository }}`                | ❌ Gitea-specific | repo full name (owner/repo)          |
| `${{ gitea.sha }}`                       | ❌ Gitea-specific | commit SHA                           |
| `${{ gitea.run_id }}`                    | ❌ Gitea-specific | workflow run ID                      |
| `${{ gitea.head_branch }}`               | ❌ Gitea-specific | head branch name                     |
| `$GITHUB_STEP_SUMMARY`                   | ✅ Alias          | aliased to `$GITEA_STEP_SUMMARY`     |
| `$GITHUB_OUTPUT`                         | ✅ Alias          | aliased to `$GITEA_OUTPUT`           |
| `concurrency:`                           | ✅ Yes            | same syntax                          |
| `matrix:`                                | ✅ Yes            | same syntax                          |
| `needs: []`                              | ✅ Yes            | same syntax                          |
| `services:`                              | ✅ Yes            | same syntax                          |
| `environment:`                           | ✅ Yes            | with Gitea environment protection    |

---

## 6. Integration Points for `/execute` Orchestrator

The 14-agent `/execute` workflow can be enhanced with Gitea Actions:

1. **Trigger**: `workflow_dispatch` on `ci-feature.yml` → triggers 14-agent pipeline
2. **Secrets**: Use `${{ secrets.GITEA_TOKEN }}` to post PR comments from agents
3. **Parallel jobs**: Each agent as a separate job with `needs` dependency graph
4. **Artifacts**: Pass agent output via `actions/upload-artifact` between jobs
5. **Self-hosted runners**: Use `runs-on: self-hosted` for GPU-intensive agents (CODER with Ollama)

**Example integration:**

```yaml
# In ci-feature.yml or new orchestrator workflow
on:
  workflow_dispatch:
    inputs:
      spec_id:
        description: 'SPEC ID to implement'
        required: true
        type: string

jobs:
  spec-analyzer:
    runs-on: ubuntu-latest
    outputs:
      spec_result: ${{ steps.analyze.outputs.result }}
    steps:
      - uses: actions/checkout@v4
      - id: analyze
        run: |
          claude --agent spec-analyzer "docs/SPECS/${{ inputs.spec_id }}.md"
          echo "result=done" >> $GITEA_OUTPUT

  architect:
    runs-on: ubuntu-latest
    needs: [spec-analyzer]
    steps:
      - uses: actions/checkout@v4
      - run: claude --agent architect "${{ inputs.spec_id }}"

  # ... CODER-1, CODER-2, TESTER, etc. (all in parallel after architect)

  shipper:
    runs-on: ubuntu-latest
    needs: [coder-1, coder-2, tester, security, docs, types, lint, secrets, reviewer]
    if: always() # Always run even if some jobs failed
    steps:
      - uses: actions/checkout@v4
      - name: Create PR
        env:
          GITEA_TOKEN: ${{ secrets.GITEA_TOKEN }}
        run: |
          # Create PR via Gitea API
          curl -X POST "https://git.zappro.site/api/v1/repos/${{ gitea.repository }}/pulls" \
            -H "Authorization: token $GITEA_TOKEN" \
            -H "Content-Type: application/json" \
            -d '{"title": "feat: implement ${{ inputs.spec_id }}", "head": "feature/${{ inputs.spec_id }}", "base": "main"}'
```

---

## 7. Security Considerations

1. **Secrets in logs**: Never `echo ${{ secrets.TOKEN }}` — secret values are redacted by Gitea but avoid logging
2. **Shell injection**: Use `printf '%s' "$VAR" > file` pattern (shown in `code-review.yml`) for PR title/body
3. **Concurrency**: Always set `concurrency:` on PR workflows to prevent race conditions
4. **Environment protection**: Require human approval for production deployments
5. **Self-hosted runners**: Ensure runner machines are secure and isolated

---

## 8. Summary

Gitea Actions provides GitHub Actions-compatible syntax with Gitea-specific event variables. Key best practices for the enterprise refactor:

1. **Use `secrets.VAR_NAME`** for all credentials, sourced from `.env` canonical
2. **Add `concurrency:`** to PR workflows for cancel-in-progress
3. **Human gates via `environment:`** for production deployments
4. **Service containers** for postgres, etc. with health checks
5. **`workflow_dispatch`** for manual triggers with inputs
6. **`workflow_run`** for chaining CI → deploy pipelines
7. **`GITEA_OUTPUT`** for job-to-job communication
8. **Self-hosted runners** with labels for GPU/specialized workloads

**Recommended next steps:**

- Update `.claude/skills/gitea-access/SKILL.md` with `workflow_dispatch` inputs
- Add Gitea Actions credentials table to CLAUDE.md
- Document `concurrency:` pattern in AGENTS.md CI/CD section
- Consider adding `ci-feature.yml` → 14-agent integration as future enhancement
