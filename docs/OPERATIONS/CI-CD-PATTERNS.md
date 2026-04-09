# CI/CD Patterns

## Overview

This repository uses dual CI/CD systems:
- **GitHub Actions** (primary for open-source/PR workflows)
- **Gitea Actions** (primary for production deploys on self-hosted)

Both systems run equivalent workflows to ensure portability.

---

## Workflow Inventory

### GitHub Actions (`.github/workflows/`)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push to `main`, PRs to `main` | Type check, lint, build, test |
| `deploy-perplexity-agent.yml` | Push to `main` + path filter on `apps/perplexity-agent/**` | Deploys perplexity-agent to Coolify |

### Gitea Actions (`.gitea/workflows/`)

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `ci.yml` | Push to `main`, PRs to `main` | Type check, lint, build, test |
| `deploy-perplexity-agent.yml` | Push to `main` + path filter on `apps/perplexity-agent/**` | Deploys perplexity-agent to Coolify |

---

## Trigger Logic

### When Both Systems Run

Both GitHub Actions and Gitea Actions trigger on:
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

### Path Filtering (Deploy Workflows)

The deploy workflow only runs when relevant code changes:
```yaml
on:
  push:
    branches: [main]
    paths:
      - 'apps/perplexity-agent/**'
```

### Manual Trigger

All workflows support `workflow_dispatch` for manual runs via the web UI.

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
| `.github/workflows/deploy-*.yml` | GitHub deploy pipelines |
| `.gitea/workflows/deploy-*.yml` | Gitea deploy pipelines |
