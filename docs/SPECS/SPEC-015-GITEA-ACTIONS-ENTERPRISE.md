---
name: SPEC-015: Gitea Actions Enterprise
description: Enterprise-grade CI/CD architecture with Gitea Actions — runner setup, workflow patterns, AI agent integration, and comparison with GitHub Actions
type: specification
---

# SPEC-015: Gitea Actions — Enterprise CI/CD Architecture

**Status:** DRAFT
**Created:** 2026-04-08
**Updated:** 2026-04-08
**Author:** will
**Related:** SPEC-PERPLEXITY-GITOPS, SPEC-001, SPEC-002

---

## Objective

Define enterprise-grade CI/CD patterns for Gitea Actions, covering runner infrastructure (ephemeral, autoscaling), workflow design (CI, deploy, code-review, rollback), AI agent webhook integration, and strategic comparison with GitHub Actions. This SPEC codifies best practices for self-hosted enterprise deployment on the monorepo at `git.zappro.site`.

---

## Overview

Gitea Actions (GA) is Gitea's native CI/CD engine, compatible with GitHub Actions syntax but self-hosted. It uses `act_runner` as the workflow execution agent. For teams needing full data sovereignty, air-gapped deployments, or cost control at scale, GA is the leading open-source choice in 2026.

Key characteristics:
- **GitHub-compatible syntax**: Workflows written for GitHub Actions run on GA with minimal changes
- **act_runner**: Stateless, ephemeral runner that can run in Docker, Kubernetes, or bare metal
- **API-first**: All operations (trigger, cancel, list, secrets, variables) exposed via REST API
- **Organization-level support**: Variables and cross-repo access from v0.22.0+
- **Self-hosted runners**: No vendor lock-in, no usage-based pricing

---

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| Git Server | Gitea 1.21+ | `git.zappro.site` |
| CI/CD Engine | Gitea Actions | Native, built-in |
| Runner Agent | act_runner | Go binary, stateless |
| Container Runtime | Docker + Kubernetes | Ephemeral job execution |
| Secrets Management | Gitea Secrets + Infisical | Layered approach |
| Infrastructure | Coolify | Self-hosted PaaS |
| Artifact Storage | Gitea Actions cache + S3 | MinIO or cloud S3 |
| Monitoring | Coolify dashboard + health checks | Existing SPEC-PERPLEXITY pattern |

---

## Enterprise CI/CD Architecture

### High-Level Topology

```
Developer Push/PR
        │
        ▼
┌──────────────────────────────────────────────────────────┐
│                    Gitea (git.zappro.site)               │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐  │
│  │   Webhook   │  │  Actions API │  │  Secrets/Var    │  │
│  │  (push/PR)  │  │  (dispatch)  │  │  (org-level)    │  │
│  └─────────────┘  └──────────────┘  └─────────────────┘  │
└──────────────────────────────────────────────────────────┘
        │                    │
        ▼                    ▼
┌─────────────────┐  ┌────────────────────────────────────┐
│   AI Agent      │  │         act_runner Pool              │
│   Webhook       │  │  ┌──────┐  ┌──────┐  ┌──────┐     │
│   Trigger       │  │  │ Eph. │  │ Eph. │  │ Eph. │     │
│   (curl/POST)   │  │  │Runner│  │Runner│  │Runner│     │
└─────────────────┘  │  └──────┘  └──────┘  └──────┘     │
                     │       ▲          ▲                 │
                     │       └──────────┘                  │
                     │         Docker / K8s                  │
                     └────────────────────────────────────┘
                              │
                              ▼
                     ┌─────────────────┐
                     │  Artifact Store │
                     │  (cache/S3/MinIO)│
                     └─────────────────┘
```

### Runner Setup: Ephemeral, Privileged, Healthcheck

#### Ephemeral Runner Pattern

Ephemeral runners (recommended for enterprise) spin up a fresh container per job, then destroy it. This provides:
- **Isolation**: No cross-job contamination
- **Security**: Credentials evaporate after job
- **Reproducibility**: Clean slate every run
- **Autoscaling**: Pool can grow/shrink dynamically

```yaml
# .gitea/workflows/ci.yml — ephemeral runner with Docker executor
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    name: Type Check · Lint · Build · Test
    runs-on: ubuntu-latest  # ephemeral by default in Gitea Actions
    # For privileged (Docker-in-Docker), use: runs-on: privileged
    # For K8s: use label matching your k8s runner group

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

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "yarn"

      - name: Cache Turbo
        uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-${{ github.sha }}
          restore-keys: |
            turbo-${{ runner.os }}-

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Type check
        run: yarn check-types

      - name: Lint
        run: npx biome check .

      - name: Build
        run: yarn build
        env:
          TURBO_CACHE_DIR: .turbo

      - name: Test
        run: yarn test
        env:
          TURBO_CACHE_DIR: .turbo
```

#### Runner Registration and Labels

Register runners with specific labels for job affinity:

```bash
# Register an ephemeral runner with Docker executor
./act_runner register \
  --url https://git.zappro.site \
  --token <runner-token> \
  --name "ephemeral-docker-runner" \
  --labels "ubuntu-latest,docker,self-hosted,ephemeral"

# Register a Kubernetes-based runner
./act_runner register \
  --url https://git.zappro.site \
  --token <runner-token> \
  --name "k8s-runner" \
  --labels "kubernetes,self-hosted,ephemeral"
```

#### Healthcheck Configuration

act_runner supports a healthcheck endpoint for load balancer integration:

```yaml
# act_runner config.yaml
health:
  # Enable health check server
  enabled: true
  # Port for health check server
  port: 8092
  # Path for health check endpoint
  path: /healthz
```

```bash
# Verify runner health
curl https://runner-host:8092/healthz

# Kubernetes deployment with readiness/liveness probes
livenessProbe:
  httpGet:
    path: /healthz
    port: 8092
  initialDelaySeconds: 10
  periodSeconds: 30
readinessProbe:
  httpGet:
    path: /healthz
    port: 8092
  initialDelaySeconds: 5
  periodSeconds: 10
```

#### Privileged Runners (Docker-in-Docker)

For jobs requiring Docker (e.g., build/push containers), use privileged mode:

```yaml
jobs:
  build-container:
    runs-on: privileged  # requires runner with privileged label
    steps:
      - uses: actions/checkout@v4

      - name: Build Docker image
        run: |
          docker build -t ${{ vars.REGISTRY }}/${{ github.event.repository.name }}:${{ github.sha }} .
          docker push ${{ vars.REGISTRY }}/${{ github.event.repository.name }}:${{ github.sha }}
```

```bash
# Register runner with privileged capacity
./act_runner register \
  --url https://git.zappro.site \
  --token <runner-token> \
  --name "privileged-runner" \
  --labels "privileged,self-hosted" \
  --capacity 2  # limit concurrent jobs
```

#### Kubernetes Autoscaling Architecture

For enterprise-scale ephemeral runner pools, deploy act_runner as a Kubernetes Deployment:

```yaml
# k8s/act-runner-deploy.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: act-runner-pool
  namespace: gitea-actions
spec:
  replicas: 3
  selector:
    matchLabels:
      app: act-runner
  template:
    metadata:
      labels:
        app: act-runner
    spec:
      containers:
        - name: act-runner
          image: gitea/act_runner:latest
          env:
            - name: GITEA_INSTANCE_URL
              value: "https://git.zappro.site"
            - name: GITEA_RUNNER_TOKEN
              valueFrom:
                secretKeyRef:
                  name: act-runner-secrets
                  key: runner-token
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "2Gi"
              cpu: "2000m"
          livenessProbe:
            httpGet:
              path: /healthz
              port: 8092
            initialDelaySeconds: 10
            periodSeconds: 30
          readinessProbe:
            httpGet:
              path: /healthz
              port: 8092
            initialDelaySeconds: 5
            periodSeconds: 10
---
# HorizontalPodAutoscaler for elastic scaling
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: act-runner-pool-hpa
  namespace: gitea-actions
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: act-runner-pool
  minReplicas: 2
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

---

## Workflow Patterns

### 1. CI Workflow (Continuous Integration)

```yaml
# .gitea/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true  # cancel outdated runs on new push

jobs:
  ci:
    name: Type Check · Lint · Build · Test
    runs-on: ubuntu-latest
    timeout-minutes: 30

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

    env:
      DB_HOST: localhost
      DB_PORT: "5432"
      DB_USER: postgres
      DB_PASSWORD: postgres
      DB_NAME: connected_repo_test
      NODE_ENV: test

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # for semantic versioning

      - name: Setup Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "yarn"

      - name: Cache Turbo
        uses: actions/cache@v4
        with:
          path: .turbo
          key: turbo-${{ runner.os }}-${{ hashFiles('**/yarn.lock') }}
          restore-keys: |
            turbo-${{ runner.os }}-

      - name: Install dependencies
        run: yarn install --frozen-lockfile

      - name: Prepare .env for CI
        run: |
          cp .env.example .env
          # Inject fake secrets for CI
          sed -i 's|SESSION_SECRET=.*|SESSION_SECRET=ci-session-secret-minimum-32-characters-ok!!|' .env
          # ... other sed commands
          cp apps/backend/.env.example apps/backend/.env
          cp apps/frontend/.env.example apps/frontend/.env

      - name: Sync env (workspace .env files)
        run: node scripts/sync-env.js

      - name: Type check
        run: yarn check-types

      - name: Lint (Biome)
        run: npx biome check .

      - name: Build
        run: yarn build
        env:
          TURBO_CACHE_DIR: .turbo

      - name: Test
        run: yarn test
        env:
          TURBO_CACHE_DIR: .turbo
```

### 2. Deploy Workflow (GitOps with Coolify)

```yaml
# .gitea/workflows/deploy.yml
name: Deploy to Coolify

on:
  push:
    branches: [main]
    paths:
      - 'apps/perplexity-agent/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'production'
        type: choice
        options:
          - production
          - staging

env:
  APP_NAME: perplexity-agent
  HEALTH_URL: http://localhost:4004/_stcore/health
  HEALTH_TIMEOUT: 90
  HEALTH_INTERVAL: 10

jobs:
  deploy:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment || 'production' }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Get APP UUID
        run: |
          APP_UUID=$(curl -s "${{ secrets.COOLIFY_URL }}/api/v1/applications" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}" | \
            python3 -c "import sys,json; data=json.load(sys.stdin); apps=data.get('data',[]); [print(a['uuid']) for a in apps if 'perplexity' in a.get('name','').lower()]")

          [[ -z "$APP_UUID" ]] && { echo "Could not find $APP_NAME UUID"; exit 1; }
          echo "App UUID: $APP_UUID"
          echo "app_uuid=$APP_UUID" >> $GITHUB_ENV

      - name: Trigger Deploy
        run: |
          RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
            "${{ secrets.COOLIFY_URL }}/api/v1/applications/${{ env.app_uuid }}/deploy" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"pull_request_id": "main"}')

          HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
          BODY=$(echo "$RESPONSE" | head -n-1)
          [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" ]] && { echo "Deploy failed (HTTP $HTTP_CODE)"; exit 1; }
          echo "Deploy triggered"

      - name: Wait for Deploy
        run: |
          ELAPSED=0
          while [[ $ELAPSED -lt $HEALTH_TIMEOUT ]]; do
            STATUS=$(curl -s "${{ secrets.COOLIFY_URL }}/api/v1/applications/${{ env.app_uuid }}" \
              -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}" | \
              python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "unknown")

            echo "[$ELAPSED s] Status: $STATUS"
            case "$STATUS" in
              running|idle) echo "Deploy successful!"; exit 0 ;;
              degraded|down|stopped) echo "App is $STATUS"; sleep 10 ;;
            esac
            sleep $HEALTH_INTERVAL
            ELAPSED=$((ELAPSED + HEALTH_INTERVAL))
          done
          echo "Deploy timeout"
          exit 1

      - name: Smoke Test
        run: |
          ELAPSED=0
          while [[ $ELAPSED -lt $HEALTH_TIMEOUT ]]; do
            HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 15 "$HEALTH_URL" 2>/dev/null || echo "000")
            [[ "$HTTP_CODE" == "200" ]] && { echo "Smoke Test PASSED"; exit 0; }
            sleep $HEALTH_INTERVAL
            ELAPSED=$((ELAPSED + $HEALTH_INTERVAL))
          done
          exit 1

      - name: Rollback on Failure
        if: failure()
        run: |
          echo "=== ROLLBACK: Deploy failed ==="
          DEPLOYMENTS=$(curl -s "${{ secrets.COOLIFY_URL }}/api/v1/applications/${{ env.app_uuid }}/deployments" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}")

          PREV_COMMIT=$(echo "$DEPLOYMENTS" | python3 -c "import sys,json; data=json.load(sys.stdin); deploys=data.get('data',[]); print(deploys[1].get('commit','') if len(deploys) > 1 else '')" 2>/dev/null || echo "")

          if [[ -n "$PREV_COMMIT" ]]; then
            curl -s -X POST "${{ secrets.COOLIFY_URL }}/api/v1/applications/${{ env.app_uuid }}/deploy" \
              -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}" \
              -H "Content-Type: application/json" \
              -d "{\"commit\": \"$PREV_COMMIT\"}"
          fi
```

### 3. Code Review Workflow (PR Checks + Approval Gates)

```yaml
# .gitea/workflows/code-review.yml
name: Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request_review:
    types: [submitted]

concurrency:
  group: review-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  # Gate 1: Automated checks (must pass before human review)
  automated-checks:
    name: Automated Checks
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run automated checks
        run: |
          yarn check-types
          npx biome check .
          yarn build

  # Gate 2: Security scan
  security-scan:
    name: Security Scan
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run Trivy vulnerability scanner
        run: |
          docker run --rm -v $(pwd):/workspace \
            aquasec/trivy:latest fs --security-checks vuln,config /workspace

  # Gate 3: AI review (Claude Code agent)
  ai-review:
    name: AI Code Review
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    outputs:
      review_status: ${{ steps.ai-review.outputs.status }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          ref: ${{ github.event.pull_request.head.sha }}

      - name: Run AI review
        id: ai-review
        run: |
          # Use Claude Code for AI-powered review
          claude -p --print "Review the changes in this PR for code quality, \
          potential bugs, security issues, and adherence to best practices. \
          Focus on: ${{ github.event.pull_request.title }}"

  # Gate 4: Human approval required
  human-approval:
    name: Human Review & Approval
    runs-on: ubuntu-latest
    needs: [automated-checks, security-scan]
    environment: code-review  # requires manual approval in Gitea
    if: github.event_name == 'pull_request'

    steps:
      - name: Check approval status
        run: |
          echo "Awaiting human code review..."
          echo "PR: ${{ github.event.pull_request.title }}"
          echo "Author: ${{ github.event.pull_request.user.login }}"

  # Final merge gate
  merge:
    name: Ready to Merge
    runs-on: ubuntu-latest
    needs: [automated-checks, security-scan, human-approval]
    if: github.event_name == 'pull_request'

    steps:
      - name: Merge PR
        if: github.event_name == 'pull_request' && github.event.action == 'submitted' && github.event.review.state == 'approved'
        run: |
          curl -X POST \
            "https://git.zappro.site/api/v1/repos/${{ github.repository }}/pulls/${{ github.event.pull_request.number }}/merge" \
            -H "Authorization: token ${{ secrets.GITEA_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"do": "merge", "merge_message_field": "Merge PR #${{ github.event.pull_request.number }}"}'
```

### 4. Rollback Workflow (Manual + Automated)

```yaml
# .gitea/workflows/rollback.yml
name: Rollback

on:
  workflow_dispatch:
    inputs:
      app_name:
        description: 'Application name'
        required: true
        type: choice
        options:
          - perplexity-agent
          - backend
          - frontend
      deployment_id:
        description: 'Specific deployment ID (optional)'
        required: false
        type: string
      reason:
        description: 'Rollback reason'
        required: true
        type: string

env:
  COOLIFY_URL: ${{ secrets.COOLIFY_URL }}
  COOLIFY_API_KEY: ${{ secrets.COOLIFY_API_KEY }}

jobs:
  rollback:
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Get deployment history
        run: |
          DEPLOYMENTS=$(curl -s \
            "$COOLIFY_URL/api/v1/applications/${{ env.APP_NAME }}/deployments" \
            -H "Authorization: Bearer $COOLIFY_API_KEY")

          echo "Recent deployments:"
          echo "$DEPLOYMENTS" | python3 -c "import sys,json; data=json.load(sys.stdin); [print(f\"  {i}: {d.get('commit','')[:8]} - {d.get('status','')}\") for i,d in enumerate(data.get('data',[])[:5])]"

      - name: Determine rollback target
        run: |
          if [[ -n "${{ inputs.deployment_id }}" ]]; then
            TARGET=${{ inputs.deployment_id }}
          else
            # Default: roll back to previous deployment
            DEPLOYMENTS=$(curl -s \
              "$COOLIFY_URL/api/v1/applications/${{ env.APP_NAME }}/deployments" \
              -H "Authorization: Bearer $COOLIFY_API_KEY")
            TARGET=$(echo "$DEPLOYMENTS" | python3 -c "import sys,json; data=json.load(sys.stdin); print(data.get('data',[])[1].get('id','') if len(data.get('data',[])) > 1 else '')")
          fi
          echo "Rolling back to deployment: $TARGET"

      - name: Execute rollback
        run: |
          RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
            "$COOLIFY_URL/api/v1/applications/${{ env.APP_NAME }}/rollback" \
            -H "Authorization: Bearer $COOLIFY_API_KEY" \
            -H "Content-Type: application/json" \
            -d "{\"deployment_id\": \"$TARGET\", \"reason\": \"${{ inputs.reason }}\"}")

          HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
          [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" ]] && { echo "Rollback failed"; exit 1; }
          echo "Rollback initiated"

      - name: Verify rollback
        run: |
          ELAPSED=0
          while [[ $ELAPSED -lt 60 ]]; do
            STATUS=$(curl -s "$COOLIFY_URL/api/v1/applications/${{ env.APP_NAME }}" \
              -H "Authorization: Bearer $COOLIFY_API_KEY" | \
              python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "unknown")

            [[ "$STATUS" == "running" ]] && { echo "Rollback verified"; exit 0; }
            sleep 10
            ELAPSED=$((ELAPSED + 10))
          done
          echo "Rollback verification timeout"
          exit 1

      - name: Notify failure
        if: failure()
        run: |
          echo "Rollback failed for ${{ env.APP_NAME }}"
          # Could integrate with Slack/Discord webhook here
```

### 5. Chained Workflows (Trigger Workflow from Workflow)

Gitea Actions supports `workflow_dispatch` and `workflow_call` triggers. For cross-workflow triggering, use the Gitea Actions API.

#### Method A: repository_dispatch (Event-based chaining)

```yaml
# Workflow 1: CI triggers Deploy on success
# .gitea/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: yarn build
      - run: yarn test

  # Trigger downstream workflow via repository_dispatch
  trigger-deploy:
    needs: ci
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Trigger deploy workflow
        run: |
          curl -X POST \
            "https://git.zappro.site/api/v1/repos/${{ github.repository }}/actions/workflows/deploy.yml/dispatches" \
            -H "Authorization: token ${{ secrets.GITEA_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d '{"ref": "main", "inputs": {"environment": "production"}}'
```

```yaml
# Workflow 2: Deploy triggered by CI
# .gitea/workflows/deploy.yml
name: Deploy

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment'
        required: true
        type: string

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy
        run: |
          echo "Deploying to ${{ inputs.environment }}"
          # Coolify API call here
```

#### Method B: workflow_call (Reusable workflows) — Limited in Gitea

Gitea Actions has partial support for `workflow_call` (reusable workflows). For full reuse, consider:

```yaml
# .gitea/workflows/_reusable.yml
# NOTE: workflow_call support in Gitea is limited to organization-level
# reusable workflows in v1.21+. Check your version.
name: Reusable Build

on:
  workflow_call:
    inputs:
      node_version:
        type: string
        default: "22"

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ inputs.node_version }}
      - run: yarn build
```

---

## AI Agent Integration via API

AI agents can trigger Gitea Actions workflows via the REST API. This enables LLM-driven CI/CD orchestration.

### Trigger Workflow via API

```bash
# AI agent triggers a workflow
curl -X POST \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches" \
  -H "Authorization: token {AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ref": "main",
    "inputs": {
      "environment": "production",
      "triggered_by": "claude-agent",
      "reason": "Scheduled weekly deploy"
    }
  }'
```

### List Workflow Runs

```bash
# Get recent workflow runs
curl -X GET \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/runs" \
  -H "Authorization: token {AGENT_TOKEN}"
```

### Cancel a Running Workflow

```bash
# Cancel a specific run
curl -X POST \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/runs/{run_id}/cancel" \
  -H "Authorization: token {AGENT_TOKEN}"
```

### Get Workflow Run Status

```bash
# Get specific run details
curl -X GET \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/runs/{run_id}" \
  -H "Authorization: token {AGENT_TOKEN}"
```

### Create Webhook for AI Agent Notifications

```bash
# Create a webhook to notify AI agent on workflow completion
curl -X POST \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/hooks" \
  -H "Authorization: token {AGENT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "gitea",
    "config": {
      "url": "https://ai-agent.zappro.site/webhooks/gitea",
      "content_type": "json",
      "secret": "webhook-secret-for-ai-agent"
    },
    "events": [
      "push",
      "pull_request",
      "repository"
    ],
    "active": true
  }'
```

### AI Agent Workflow Example (Claude Code CLI)

```yaml
# .gitea/workflows/ai-agent-review.yml
name: AI Agent Review

on:
  workflow_dispatch:
    inputs:
      pr_number:
        description: 'PR number to review'
        required: true
        type: string
      agent_command:
        description: 'Agent command'
        required: true
        type: string
        default: 'Review this PR for code quality, bugs, and security issues'

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run AI agent
        env:
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
        run: |
          # Use Claude Code to review PR
          claude -p --print "${{ inputs.agent_command }}

          PR: #${{ inputs.pr_number }}
          Repository: ${{ github.repository }}
          Branch: ${{ github.ref }}"

      - name: Post review comment
        run: |
          # Post AI review as PR comment
          REVIEW_OUTPUT=$(cat /tmp/ai-review-output.txt)

          curl -X POST \
            "https://git.zappro.site/api/v1/repos/${{ github.repository }}/issues/${{ inputs.pr_number }}/comments" \
            -H "Authorization: token ${{ secrets.GITEA_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d "{\"body\": \"## AI Code Review\\n\\n$REVIEW_OUTPUT\\n\\n---\\n*Generated by Claude Code via Gitea Actions*\"}"
```

### AI Agent Token Permissions

For AI agents, use fine-grained tokens with minimal scope:

```bash
# Create token via API with limited permissions
curl -X POST \
  "https://git.zappro.site/api/v1/users/{username}/tokens" \
  -H "Authorization: token {ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ai-agent-token",
    "scopes": [
      "repo",
      "workflow"  # allows triggering workflows
    ]
  }'
```

Organization-level tokens (v0.22.0+):

```bash
# Create org token with workflow access
curl -X POST \
  "https://git.zappro.site/api/v1/orgs/{org}/tokens" \
  -H "Authorization: token {ADMIN_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "ai-agent-org-token",
    "scopes": ["repo", "workflow", "org"]
  }'
```

---

## Gitea Actions vs GitHub Actions — Enterprise Comparison

| Dimension | Gitea Actions | GitHub Actions | Notes |
|-----------|---------------|----------------|-------|
| **Hosting** | Self-hosted | SaaS or self-hosted (GHES) | Gitea: full data control; GitHub: managed option |
| **Cost** | Infrastructure only | Per-minute pricing (GHES: license + infra) | Gitea wins at scale |
| **Runner** | act_runner (Go, stateless) | GitHub-hosted + self-hosted runners | GH provides unlimited free tier for public repos |
| **Ephemeral Runners** | Native via act_runner | Native for GitHub-hosted; self-hosted requires configuration | Both support |
| **Autoscaling** | Kubernetes-native (DIY) | Native for GitHub-hosted; enterprise-scale for self-hosted | GH enterprise has built-in autoscaling |
| **Syntax Compatibility** | ~95% GitHub Actions compatible | N/A (reference) | Most workflows work with minimal changes |
| **Marketplace** | No | Yes (10,000+ actions) | GH major advantage for enterprise |
| **OIDC/OAuth** | Basic | Advanced (OIDC, SAML, SCIM) | GH enterprise superior identity |
| **Enterprise Features** | Basic org/team mgmt | Advanced (audit logs, compliance, SSO) | GH Enterprise Cloud/Server ahead |
| **API Coverage** | GitHub-compatible subset | Full GitHub API v3 | GH API more mature |
| **Organization Variables** | v0.22.0+ (recent) | GA mature | Gitea closing gap |
| **Cross-repo Access** | AllowedCrossRepoIDs (configurable) | `workflow_run` + `secrets` | Both supported with config |
| **Fork PR Security** | Restricted by default | Restricted by default | GA has explicit fork PR restrictions |
| **Artifact Storage** | Local + S3/MinIO | Cloud storage (configurable) | GH managed; Gitea DIY |
| **Audit Logs** | Basic | Advanced (enterprise) | GH enterprise ahead |
| **Container Registry** | Integrated Gitea Packages | GHCR + external | GHCR more mature |
| **Support** | Community | Enterprise support (paid) | GH advantage |

### Recommendations by Use Case

| Use Case | Recommendation | Rationale |
|----------|---------------|-----------|
| **Startup / Small team** | Gitea Actions | Free, self-hosted, no per-minute cost |
| **Mid-size / Growth** | Gitea Actions + act_runner pool | Scale with Kubernetes; cost-effective |
| **Enterprise (data-sovereign)** | Gitea Actions | Mandatory data residency, audit requirements |
| **Enterprise (non-sovereign)** | GitHub Actions or GHES | Mature enterprise features, marketplace |
| **Open source project** | GitHub Actions (free tier) | Unlimited minutes for public repos |
| **Air-gapped environment** | Gitea Actions | No internet required |
| **Cost-sensitive at scale** | Gitea Actions | No per-minute billing |

---

## Comparison with GitHub Actions

### Syntax Differences (Gitea vs GitHub)

Gitea Actions aims for GitHub Actions compatibility but has differences:

| Feature | GitHub | Gitea | Workaround |
|---------|--------|-------|------------|
| `workflow_dispatch` with `inputs` | Full support | Partial | Use `workflow_dispatch` without `inputs`; pass via env |
| `concurrency` | Full | Gitea 1.21+ | Use cancel-in-progress |
| `workflow_call` | Full | Limited (org-level only) | Use API-based chaining instead |
| `jobs.<id>.needs` | Full | Full | Identical |
| `runner` labels | Full | Full | Identical |
| `services` (Docker) | Full | Full | Identical |
| `cache` action | Official | `actions/cache@v4` | Use third-party or build your own |
| `secrets` | Full | Full | Identical |
| Organization secrets | Full | v0.22.0+ | Use per-repo secrets |
| OIDC tokens | Full | No | Use long-lived tokens |
| `workflow_run` trigger | Full | No | Use API polling |

### Running GitHub Actions Locally with act_runner

```bash
# Test GitHub Actions workflows locally using act_runner
act_runner exec \
  -W ./.github/workflows/ci.yml \
  --event=pull_request \
  --default-actions-url="https://github.com" \
  -i catthehacker/ubuntu:runner-latest

# Run single job
act_runner exec \
  -W ./.github/workflows/ci.yml \
  --event=pull_request \
  --default-actions-url="https://github.com" \
  -i catthehacker/ubuntu:runner-latest \
  -j <job_name>

# List available jobs
act_runner exec \
  -W ./.github/workflows/ci.yml \
  --event=pull_request \
  --default-actions-url="https://github.com" \
  -i catthehacker/ubuntu:runner-latest \
  -l
```

---

## Implementation Recommendations for the Monorepo

### Current State (SPEC-PERPLEXITY-GITOPS)

The monorepo already has:
- `.gitea/workflows/ci.yml` — CI workflow (type check, lint, build, test)
- `.gitea/workflows/deploy-perplexity-agent.yml` — deploy workflow with rollback
- `.github/workflows/` — mirror of Gitea workflows (dual sync)
- Integration with Coolify via API

### Recommended Actions

#### 1. Migrate to act_runner (Ephemeral)

Deploy act_runner as a Kubernetes Deployment with HPA for ephemeral runner scaling:

- Register runners with labels: `ubuntu-latest`, `docker`, `self-hosted`, `ephemeral`
- Set `capacity: 2` per runner instance (prevent overload)
- Enable health check endpoint on port 8092
- Use Kubernetes HPA to scale replicas 2-20 based on CPU/memory

#### 2. Consolidate Dual Workflows

The monorepo has workflows in both `.gitea/workflows/` and `.github/workflows/`. Recommend:

- Keep only `.gitea/workflows/` for Gitea Actions
- Document that `.github/workflows/` is deprecated (GitHub mirror)
- Or use a sync script to keep them in sync

#### 3. Add PR Code Review Workflow

Implement `code-review.yml` with:
- Automated checks gate (CI must pass)
- Security scan gate (Trivy)
- Optional AI review gate (Claude Code via `workflow_dispatch`)
- Human approval gate via Gitea environment protection
- Auto-merge on approval

#### 4. Implement Chained Workflows

For multi-stage pipelines:

```
push main → CI → (on success) → Trigger Deploy
                            → (on failure) → Notify Slack
```

Use `workflow_dispatch` + API call pattern for cross-workflow triggering.

#### 5. AI Agent Webhook Integration

Create a dedicated webhook endpoint for AI agent notifications:

```bash
# AI agent webhook handler (external service)
# Receives: push, pull_request, workflow completion events
# Triggers: Claude Code CLI for review/automation
```

Required:
- Webhook secret validation
- Rate limiting (prevent spam)
- Async processing (queue-based)

#### 6. Secrets Management

Current: Gitea Secrets + Infisical
Recommendation: Layer as follows:

| Secret Type | Storage | Rationale |
|-------------|---------|-----------|
| CI secrets (DB passwords) | Gitea Secrets | Ephemeral, repo-scoped |
| Deploy secrets (Coolify API key) | Gitea Secrets | Stable, needed for all deploys |
| Long-lived tokens (AI agents) | Infisical | Source of truth, rotation capability |
| Cloud credentials | Gitea Secrets or Infisical | Depends on rotation frequency |

#### 7. Artifact and Cache Strategy

```yaml
# Use cache action for build artifacts
- uses: actions/cache@v4
  with:
    path: |
      .turbo
      node_modules/.cache
    key: turbo-${{ runner.os }}-${{ hashFiles('**/yarn.lock') }}
    restore-keys: |
      turbo-${{ runner.os }}-
```

For large artifacts, consider S3/MinIO:

```yaml
- name: Upload artifact to S3
  run: |
    aws s3 cp ./dist s3://${{ vars.S3_BUCKET }}/${{ github.sha }}/ --recursive

- name: Download artifact from S3
  run: |
    aws s3 cp s3://${{ vars.S3_BUCKET }}/${{ github.sha }}/ ./dist --recursive
```

---

## Commands Reference

```bash
# Register act_runner
./act_runner register \
  --url https://git.zappro.site \
  --token <runner-token> \
  --name "ephemeral-docker-runner" \
  --labels "ubuntu-latest,docker,self-hosted,ephemeral" \
  --capacity 2

# Check runner health
curl https://runner-host:8092/healthz

# Trigger workflow via API
curl -X POST \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches" \
  -H "Authorization: token {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ref": "main", "inputs": {"key": "value"}}'

# List workflow runs
curl -X GET \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/runs" \
  -H "Authorization: token {TOKEN}"

# Cancel workflow run
curl -X POST \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/runs/{run_id}/cancel" \
  -H "Authorization: token {TOKEN}"

# Create org-level action variable (v0.22.0+)
curl -X POST \
  "https://git.zappro.site/api/v1/orgs/{org}/actions/variables" \
  -H "Authorization: token {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "MY_VAR", "value": "my_value", "description": "My variable"}'

# Test act_runner locally
act_runner exec \
  -W ./.gitea/workflows/ci.yml \
  --event=pull_request \
  --default-actions-url="https://git.zappro.site" \
  -i catthehacker/ubuntu:runner-latest \
  -j ci
```

---

## Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| SC-1 | act_runner deployed as ephemeral K8s Deployment with HPA | `kubectl get deploy act-runner-pool -n gitea-actions` |
| SC-2 | Health check endpoint responds 200 on port 8092 | `curl runner:8092/healthz` |
| SC-3 | CI workflow runs on ephemeral runner | Verify runner label in Gitea Actions logs |
| SC-4 | AI agent can trigger workflow via API | POST to `/actions/workflows/*/dispatches` returns 204 |
| SC-5 | Webhook sends events to AI agent endpoint | Verify webhook delivery in Gitea webhook log |
| SC-6 | Chained workflows trigger on CI success | CI → trigger → Deploy runs |
| SC-7 | Rollback workflow recovers previous deployment | Trigger rollback, verify previous commit deployed |
| SC-8 | PR code-review workflow blocks merge without approval | Create PR, attempt merge without approval |

---

## Open Questions

| # | Question | Impact | Priority |
|---|----------|--------|----------|
| OQ-1 | act_runner Kubernetes operator vs manual Deployment? | Standardizes lifecycle management | High |
| OQ-2 | Single token per AI agent vs rotating tokens? | Security vs operational complexity | Medium |
| OQ-3 | S3 artifact storage vs local Gitea storage? | Scales with artifact size | Medium |
| OQ-4 | Dual workflow sync (.gitea + .github) or Gitea-only? | Reduces maintenance, removes GitHub dependency | Low |
| OQ-5 | `workflow_call` reusable workflows vs API-based composition? | Simpler authoring vs more powerful orchestration | Low |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-08 | Ephemeral runners for all CI/CD jobs | Security isolation, reproducibility, autoscaling |
| 2026-04-08 | API-based workflow chaining over `workflow_call` | Broader compatibility across Gitea versions |
| 2026-04-08 | Gitea Secrets + Infisical layered approach | Gitea for runtime, Infisical for persistent rotation |
| 2026-04-08 | K8s HPA for runner autoscaling | Stateless runners enable elastic scale |
| 2026-04-08 | Keep dual workflows (.gitea + .github) temporarily | GitHub Actions acts as backup/failover |

---

## Related Documents

- [Gitea Actions Documentation](https://docs.gitea.com/usage/actions/overview)
- [act_runner Configuration](https://gitea.com/act_runner/act_runner)
- [SPEC-PERPLEXITY-GITOPS](./SPEC-PERPLEXITY-GITOPS.md) — Existing deploy pattern
- [Gitea API v1](https://git.zappro.site/api/v1/swagger) — Swagger docs at your instance

---

## Sources

- [Gitea Official Documentation — Actions Overview](https://context7.com/go-gitea/gitea/llms.txt)
- [Gitea Actions API — Workflow Dispatch](https://context7.com/go-gitea/gitea/llms.txt)
- [Gitea Webhook Configuration API](https://context7.com/go-gitea/gitea/llms.txt)
- [Gitea CI Workflow Example](https://context7.com/go-gitea/gitea/llms.txt)
- [Gitea SDK — Organization Actions Variables](https://context7.com/websites/pkg_go_dev_code_gitea_io_sdk_gitea)
- [Gitea Token Permission Design](https://github.com/go-gitea/gitea/blob/main/services/actions/token_permission_design.md)
- [act_runner Local Execution](https://github.com/go-gitea/gitea/blob/main/tests/integration/README.md)

---

## Checklist

- [x] SPEC written and reviewed
- [x] Enterprise architecture documented
- [x] Runner setup (ephemeral, privileged, healthcheck) detailed
- [x] Workflow patterns catalogued (CI, deploy, code-review, rollback)
- [x] AI agent API integration documented
- [x] Gitea Actions vs GitHub Actions comparison completed
- [ ] Implementation tasks generated via `/pg`
