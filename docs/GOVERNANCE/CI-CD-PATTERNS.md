# CI/CD Patterns

## Overview

This repository uses dual CI/CD systems:
- **GitHub Actions** (primary for open-source/PR workflows)
- **Gitea Actions** (primary for production deploys on self-hosted `git.zappro.site`)

Both systems run equivalent workflows to ensure portability.

---

## CI/CD Loop Diagram

```
Developer
    │
    │ push / PR
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GITEA ACTIONS (git.zappro.site)              │
│                                                                  │
│  ┌─────────────┐    ┌────────────────────────────────────────┐  │
│  │   Webhook   │───▶│  Workflow Dispatcher                   │  │
│  │ (push/PR)   │    │  Routes to: ci / ci-feature /          │  │
│  └─────────────┘    │  code-review / deploy / rollback       │  │
│                     └────────────────────────────────────────┘  │
│                                    │                             │
│           ┌────────────────────────┼────────────────────────┐   │
│           ▼                        ▼                        ▼   │
│  ┌──────────────────┐  ┌───────────────────┐  ┌────────────────┐  │
│  │ ci-feature.yml   │  │ code-review.yml   │  │ deploy-main.yml │  │
│  │ (feature branch) │  │ (PR open/update)  │  │ (merge to main) │  │
│  │                  │  │                   │  │                 │  │
│  │ 1. Type check    │  │ 1. Auto-checks   │  │ 1. Build+Test   │  │
│  │ 2. Lint          │  │ 2. Security scan │  │ 2. Human gate   │  │
│  │ 3. Build         │  │ 3. AI review    │  │ 3. Deploy      │  │
│  │ 4. Test          │  │ 4. Human approval│  │ 4. Smoke test  │  │
│  │                  │  │                  │  │ 5. Rollback on│  │
│  │ No gate needed   │  │ 2 human gates    │  │    failure     │  │
│  └──────────────────┘  └───────────────────┘  └────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              rollback.yml (workflow_dispatch)             │   │
│  │  Manual trigger — selects previous deployment, redeploys   │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐       ┌─────────────────────┐
│   Coolify        │       │  Gitea / PR Comment │
│  (deploy target) │       │  (AI review output) │
└──────────────────┘       └─────────────────────┘
```

---

## Workflow Inventory

### Gitea Actions (`.gitea/workflows/`)

| Workflow | Trigger | Purpose | Human Gates |
|----------|---------|---------|-------------|
| `ci.yml` | Push to `main`, PRs to `main` | Type check, lint, build, test | None |
| `ci-feature.yml` | Push to any non-main branch | Lightweight lint + build + test on feature branches | None |
| `code-review.yml` | PR open/update/reopen | Lint, security scan, AI review, human approval | 1 (human approval via `environment`) |
| `deploy-main.yml` | Push to `main` | Full build + test + human gate + deploy + smoke test | 1 (environment approval) |
| `deploy-perplexity-agent.yml` | Push to `main` + path filter | Direct deploy of perplexity-agent to Coolify | None |
| `rollback.yml` | `workflow_dispatch` | Manual rollback to a previous deployment | 1 (`environment` protection) |

### GitHub Actions (`.github/workflows/`)

Mirror of Gitea workflows for portability. See Gitea column above for descriptions.

---

## Human Gates Matrix

A **human gate** is a workflow stage that requires manual approval before the pipeline can proceed.

| Gate | Workflow | Environment Name | Who Approves | Auto-timeout |
|------|----------|-----------------|--------------|--------------|
| Code Review | `code-review.yml` | `code-review` | Repository reviewer | Gitea default |
| Deploy Approval | `deploy-main.yml` | `${{ inputs.environment }}` (production/staging) | Deploy admin | Gitea default |
| Rollback Approval | `rollback.yml` | `${{ inputs.environment }}` | Operator | Gitea default |

### How Human Gates Work in Gitea Actions

1. The pipeline reaches the gated job and pauses with status **Pending** or **Waiting**
2. An authorized user visits the Gitea Actions UI: `https://git.zappro.site/{owner}/{repo}/actions/environments`
3. The user clicks **Approve** (or **Reject**) on the pending environment
4. If approved, the pipeline resumes automatically
5. If rejected, the pipeline fails

> **Note:** Gitea environment protection must be configured in the repository settings before the human gate will work. Go to **Repository → Settings → Environments**, create the environment (e.g., `production`, `code-review`), and add required reviewers or set the protection rule.

### Configuring Environment Protection

```bash
# Via Gitea API — create/update an environment
curl -X POST "https://git.zappro.site/api/v1/repos/{owner}/{repo}/environments" \
  -H "Authorization: token ${{ secrets.GITEA_TOKEN }}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "production",
    "protection_rule": {
      "required_count": 1,
      "users": ["admin-user"]
    }
  }'
```

---

## AI Review Integration

The `code-review.yml` workflow includes an **AI review step** that uses Claude Code CLI to analyze PR changes and post a structured review comment directly on the PR.

### How It Works

```
PR opened/updated
    │
    ▼
┌─────────────────────────────────────┐
│  ai-review job (code-review.yml)   │
│                                     │
│  1. Checkout at PR head SHA        │
│  2. Build review prompt            │
│     (PR title, author, branches)   │
│  3. Run: claude -p --print <prompt>│
│  4. Capture output to file         │
│  5. POST to Gitea Issues API       │
│     /repos/{owner}/{repo}/         │
│     issues/{number}/comments       │
│     with review markdown            │
│                                     │
│  6. Set job status output           │
└─────────────────────────────────────┘
    │
    ▼
PR comment posted:
  "## AI Code Review
   [Claude's structured review]
   ---
   *Review generated by Claude Code via Gitea Actions*"
```

### Required Secrets

| Secret | Where Stored | Purpose |
|--------|-------------|---------|
| `CLAUDE_API_KEY` | Gitea Secrets | API key for Claude Code CLI (`claude -p`) |
| `GITEA_TOKEN` | Gitea Secrets | Access token for posting PR comments via Gitea API |
| `COOLIFY_URL` | Gitea Secrets | Coolify instance URL for deploy workflows |
| `COOLIFY_API_KEY` | Gitea Secrets | Coolify API key for deploy/rollback workflows |

### Review Focus Areas

The AI review analyzes PRs across five axes:

1. **Correctness** — logic bugs, edge cases, error handling
2. **Security** — injection risks, credential leaks, validation gaps
3. **Performance** — N+1 queries, missing indexes, inefficient algorithms
4. **Readability** — clear naming, self-documenting code, appropriate comments
5. **Best Practices** — language/framework idioms, design patterns, testing

### Manual AI Review (workflow_dispatch)

To trigger an AI review on demand (e.g., for a specific PR):

```bash
curl -X POST \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/workflows/code-review.yml/dispatches" \
  -H "Authorization: token $GITEA_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ref": "main", "inputs": {"pr_number": "123"}}'
```

---

## Gitea Actions Syntax Reference

Gitea Actions is GitHub Actions-compatible with minor differences:

| GitHub Syntax | Gitea Equivalent | Notes |
|--------------|-----------------|-------|
| `${{ github.event_name }}` | `${{ gitea.event }}` | Event type (push, pull_request, etc.) |
| `${{ github.head_ref }}` | `${{ gitea.head_branch }}` | Source branch of PR |
| `${{ github.ref }}` | `${{ gitea.ref }}` | Git ref (refs/heads/main) |
| `${{ github.sha }}` | `${{ gitea.sha }}` | Commit SHA |
| `${{ github.repository }}` | `${{ gitea.repository }}` | owner/repo name |
| `${{ github.actor }}` | `${{ gitea.actor }}` | Triggering user |
| `${{ github.event.pull_request.number }}` | `${{ gitea.event.pull_request.number }}` | PR number |
| `${{ github.run_id }}` | `${{ gitea.run_id }}` | Workflow run ID |
| `${{ github.event_name == 'pull_request' }}` | `gitea.event == 'pull_request'` | Event type check |
| `jobs.<id>.outputs` | Supported | Job outputs |
| `concurrency.cancel-in-progress` | Supported in Gitea 1.21+ | Cancel outdated runs |

---

## Workflow Detail: ci-feature.yml

Triggered on every push to a non-main branch (feature, fix, chore, etc.).

```
Feature branch push
    │
    ▼
Type check (yarn check-types)
    │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ │
    │                        │
  Pass                    Fail → workflow fails
    │
    ▼
Lint (Biome) (npx biome check)
    │
    ▼
Build (yarn build)
    │
    ▼
Test (yarn test)
    │
    ▼
✓ All green → workflow passes
  No human gate needed
```

---

## Workflow Detail: deploy-main.yml

```
Merge to main (or workflow_dispatch)
    │
    ▼
┌──────────────────────────┐
│ Stage 1: Build & Test    │  ← No human gate
│  - Type check           │
│  - Lint (Biome)         │
│  - Build                 │
│  - Test                  │
└──────────┬───────────────┘
           │ Pass
           ▼
┌──────────────────────────┐
│ Stage 2: Human Gate      │  ← Gitea environment approval
│  Awaiting approval...    │
└──────────┬───────────────┘
           │ Approved
           ▼
┌──────────────────────────┐
│ Stage 3: Deploy          │
│  1. Get APP UUID        │
│  2. POST /deploy        │
│  3. Poll status         │
│  4. Smoke test          │
│  5. Rollback on failure │
└──────────────────────────┘
```

---

## Workflow Detail: rollback.yml

```
workflow_dispatch
    │
    ▼
app_name + deployment_id + reason
    │
    ▼
Get application UUID from Coolify
    │
    ▼
Fetch deployment history
    │
    ▼
Determine rollback target
  (specified ID, or previous deployment)
    │
    ▼
POST /deploy with rollback_deployment_id
    │
    ▼
Poll for healthy status
    │
    ▼
Smoke test
    │
    ▼
Audit log → job summary with run URL
```

---

## Trigger Logic

### ci-feature.yml

```yaml
on:
  push:
    branches-ignore:
      - main      # all other branches trigger this
  workflow_dispatch:  # manual trigger
```

### code-review.yml

```yaml
on:
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request_review:
    types: [submitted]

concurrency:
  group: review-${{ gitea.event.pull_request.number }}
  cancel-in-progress: true  # Gitea 1.21+
```

### deploy-main.yml

```yaml
on:
  push:
    branches: [main]   # only on main
  workflow_dispatch:   # manual trigger with environment input
    inputs:
      environment:
        type: choice
        options: [production, staging, preview]
```

### rollback.yml

```yaml
on:
  workflow_dispatch:
    inputs:
      app_name:       # choice: monorepo-web, perplexity-agent, etc.
      deployment_id:  # optional — defaults to previous
      reason:         # required — audit trail
      environment:    # production/staging/preview
```

---

## Adding New Workflows

### 1. Create Both Versions

When adding a new workflow, create both:
- `.github/workflows/<name>.yml`
- `.gitea/workflows/<name>.yml`

### 2. Keep Syntax Compatible

Gitea Actions supports most GitHub Actions syntax. Use:
- `actions/checkout@v4` (standard, works in both)
- `actions/setup-node@v4` (standard, works in both)
- `actions/cache@v4` (standard, works in both)

### 3. Trigger Format

Use the unified format for both:
```yaml
on:
  push:
    branches: [main]
```

### 4. Environment Variables

Both systems support `env:` blocks and `${{ secrets.* }}` syntax.

### 5. Service Containers

Both systems support the `services:` keyword for databases etc.

---

## Testing Locally

### Gitea Runner

The Gitea runner runs via Docker:
```bash
docker-compose -f docker-compose.gitea-runner.yml up -d
```

### Simulate Gitea Actions Locally

Use `act` to run Gitea workflows locally:
```bash
# Install act
brew install act  # macOS
# or: https://github.com/nektos/act#installation

# Run the CI workflow
act -W .gitea/workflows/ci.yml

# Run with specific event
act push -W .gitea/workflows/ci.yml
```

### GitHub Actions Local Testing

Use `act` for GitHub workflows too:
```bash
act -W .github/workflows/ci.yml
```

---

## Secrets Management

### GitHub Actions

Manage secrets in: **Settings → Secrets and variables → Actions**

Required secrets:
- `COOLIFY_URL` - Coolify instance URL
- `COOLIFY_API_KEY` - Coolify API key

### Gitea Actions

Manage secrets in: **Site Admin → Actions → Secrets**

Same secrets required as GitHub Actions.

### In Workflows

Reference secrets using:
```yaml
${{ secrets.SECRET_NAME }}
```

### Never Log Secrets

Never echo or log secrets in workflow steps:
```yaml
# BAD
run: echo "API Key: ${{ secrets.API_KEY }}"

# GOOD
run: curl -H "Authorization: Bearer ${{ secrets.API_KEY }}" ...
```

---

## Adding a New Service/Deployment

### 1. Create the Workflow

Create `.github/workflows/deploy-<service>.yml` and `.gitea/workflows/deploy-<service>.yml`

### 2. Use the Deploy Pattern

```yaml
name: Deploy Service

on:
  push:
    branches: [main]
    paths:
      - 'apps/<service>/**'
  workflow_dispatch:

env:
  APP_NAME: <service>
  HEALTH_URL: https://your-health-check-url
  HEALTH_TIMEOUT: 60
  HEALTH_INTERVAL: 5

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Get APP UUID
        run: |
          APP_UUID=$(curl -s "${{ secrets.COOLIFY_URL }}/api/v1/applications" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}" | \
            python3 -c "import sys,json; data=json.load(sys.stdin); apps=data.get('data',[]); [print(a['uuid']) for a in apps if '<service>' in a.get('name','').lower()]")

          [[ -z "$APP_UUID" ]] && { echo "Could not find $APP_NAME UUID"; exit 1; }
          echo "app_uuid=$APP_UUID" >> $GITHUB_ENV

      - name: Trigger Deploy
        run: |
          RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
            "${{ secrets.COOLIFY_URL }}/api/v1/applications/${{ env.app_uuid }}/deploy" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"pull_request_id": "main"}')

          HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
          [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" ]] && exit 1

      - name: Wait for Deploy
        run: |
          # Poll for healthy status
          ELAPSED=0
          while [[ $ELAPSED -lt $HEALTH_TIMEOUT ]]; do
            STATUS=$(curl -s "${{ secrets.COOLIFY_URL }}/api/v1/applications/${{ env.app_uuid }}" \
              -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}" | \
              python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null)

            [[ "$STATUS" == "running" || "$STATUS" == "idle" ]] && exit 0
            sleep $HEALTH_INTERVAL
            ELAPSED=$((ELAPSED + HEALTH_INTERVAL))
          done
          exit 1

      - name: Smoke Test
        run: |
          # Your smoke test logic
```

### 3. Add Path Filter

Update the `paths` filter to match your service directory.

---

## Rollback Pattern

The deploy workflow includes automatic rollback on failure:

```yaml
- name: Rollback on Failure
  if: failure()
  run: |
    DEPLOYMENTS=$(curl -s "${{ secrets.COOLIFY_URL }}/api/v1/applications/${{ env.app_uuid }}/deployments" \
      -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}")

    PREV_COMMIT=$(echo "$DEPLOYMENTS" | python3 -c "import sys,json; data=json.load(sys.stdin); deploys=data.get('data',[]); print(deploys[1].get('commit','') if len(deploys) > 1 else '')" 2>/dev/null)

    if [[ -n "$PREV_COMMIT" ]]; then
      curl -s -X POST "${{ secrets.COOLIFY_URL }}/api/v1/applications/${{ env.app_uuid }}/deploy" \
        -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}" \
        -H "Content-Type: application/json" \
        -d "{\"commit\": \"$PREV_COMMIT\"}"
    fi
```

---

## Environment Reference

### CI Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `NODE_ENV` | `test` | Test environment |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | DB user |
| `DB_PASSWORD` | `postgres` | DB password (CI only) |
| `DB_NAME` | `connected_repo_test` | Test database |

### Deploy Environment Variables

| Variable | Value | Purpose |
|----------|-------|---------|
| `HEALTH_URL` | Per workflow | Health check endpoint |
| `HEALTH_TIMEOUT` | `60-90` | Seconds to wait for health |
| `HEALTH_INTERVAL` | `5-10` | Seconds between checks |

---

## Troubleshooting

### Gitea Runner Not Triggering

1. Check runner is registered: Gitea → Site Admin → Actions → Runners
2. Check runner is online: `docker logs gitea-runner`
3. Verify `docker-compose.gitea-runner.yml` has correct `GITEA_INSTANCE_URL`

### GitHub Actions Not Running

1. Check repository → Actions tab for error messages
2. Verify branch protection rules aren't blocking
3. Check required status checks if PRs are blocked

### Workflow Passes Locally But Fails on CI

1. Check Node.js version matches (`22` in setup-node)
2. Verify cache is being used correctly
3. Check for timing-dependent tests
4. Ensure `.env.example` has all required variables

---

## Files Reference

| File | Purpose |
|------|---------|
| `docker-compose.gitea-runner.yml` | Gitea Actions runner container |
| `.github/workflows/ci.yml` | GitHub CI pipeline |
| `.gitea/workflows/ci.yml` | Gitea CI pipeline |
| `.gitea/workflows/ci-feature.yml` | Feature branch CI pipeline |
| `.gitea/workflows/code-review.yml` | PR code review + AI review pipeline |
| `.gitea/workflows/deploy-main.yml` | Main branch deploy pipeline with human gate |
| `.gitea/workflows/rollback.yml` | Manual rollback pipeline |
| `.github/workflows/deploy-*.yml` | GitHub deploy pipelines |
| `.gitea/workflows/deploy-*.yml` | Gitea deploy pipelines |
