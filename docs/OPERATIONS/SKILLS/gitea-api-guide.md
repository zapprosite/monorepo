# Gitea API v1 Guide

**Data:** 2026-04-11
**Host:** will-zappro homelab
**Instance:** https://git.zappro.site
**API Version:** v1 (Gitea 1.21+)
**Runner:** act_runner (ephemeral, Docker executor)

---

## Quick Reference

### Base URL
```
https://git.zappro.site/api/v1
```

### Swagger Docs
```
https://git.zappro.site/api/v1/swagger
```

### Authentication (all requests)
```bash
-H "Authorization: token {TOKEN}"
# or
-H "Authorization: Bearer {TOKEN}"
```

---

## 1. Authentication Patterns

### 1.1 Personal Access Token (PAT) — Recommended for LLMs

**Create via UI:**
1. Open https://git.zappro.site/user/settings/applications
2. "Create New Token"
3. Name: `llm-agent-token` (or similar)
4. Scopes: `repo`, `workflow`, `read:user`
5. Save token immediately — shown only once

**Store in Infisical:**
```bash
infisical secrets set gitea-access-token --value="your-token-here"
```

**Project ID:** `e42657ef-98b2-4b9c-9a04-46c093bd6d37`
**Environment:** `dev`
**Secret path:** `/`

**Usage:**
```bash
curl -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  https://git.zappro.site/api/v1/user
```

### 1.2 OAuth Authentication

For OAuth apps, the flow is:
1. Redirect user to `https://git.zappro.site/login/oauth/authorize?client_id=CLIENT_ID`
2. User approves
3. Gitea redirects to your callback URL with `code`
4. Exchange code for access token:
```bash
curl -X POST https://git.zappro.site/login/oauth/access_token \
  -d "client_id=CLIENT_ID&client_secret=CLIENT_SECRET&code=CODE&redirect_uri=REDIRECT_URI"
```

### 1.3 Runner Registration Token (for CI/CD runners only)

**NOT for API calls** — only for registering act_runner agents.

**Obtain from:** Gitea Admin Panel → Actions → Runners → "New Runner"
**Stored in Infisical:** `GITEA_RUNNER_REGISTRATION_TOKEN`

```bash
# Get from Infisical
infisical secrets get GITEA_RUNNER_REGISTRATION_TOKEN --env=dev --plain
```

### 1.4 Token Scopes Reference

| Scope | Access |
|-------|--------|
| `repo` | Full repository access (read/write) |
| `repo:status` | Read-only repository status |
| `workflow` | Trigger and manage Actions workflows |
| `read:user` | Read user profile |
| `write:user` | Update user profile |
| `admin:org` | Organization administration |

---

## 2. Repository Management via API

### 2.1 Base Request Helper (curl)

```bash
# Save as a function for convenience
gitea_api() {
  local method="$1"
  local endpoint="$2"
  local data="$3"
  curl -s -X "$method" \
    "https://git.zappro.site/api/v1${endpoint}" \
    -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
    -H "Content-Type: application/json" \
    ${data:+"--data" "$data"}
}

# Usage examples:
# gitea_api GET "/user/repos"
# gitea_api POST "/user/repos" '{"name":"my-repo","private":true}'
```

### 2.2 Python Request Helper

```python
import requests

GITEA_BASE = "https://git.zappro.site/api/v1"
TOKEN = os.environ.get("GITEA_ACCESS_TOKEN", "")

def gitea_get(endpoint: str) -> dict:
    resp = requests.get(f"{GITEA_BASE}{endpoint}",
                       headers={"Authorization": f"token {TOKEN}"})
    resp.raise_for_status()
    return resp.json()

def gitea_post(endpoint: str, json: dict) -> dict:
    resp = requests.post(f"{GITEA_BASE}{endpoint}",
                        headers={"Authorization": f"token {TOKEN}"},
                        json=json)
    resp.raise_for_status()
    return resp.json()

def gitea_delete(endpoint: str) -> None:
    resp = requests.delete(f"{GITEA_BASE}{endpoint}",
                          headers={"Authorization": f"token {TOKEN}"})
    resp.raise_for_status()
```

### 2.3 List User Repositories

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/user/repos" | python3 -m json.tool
```

```python
repos = gitea_get("/user/repos")
for repo in repos:
    print(f"{repo['name']} ({repo['visibility']})")
```

### 2.4 List Organization Repositories

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/orgs/{org}/repos"
```

### 2.5 Get Repository Details

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}"
```

### 2.6 Create Repository

```bash
curl -s -X POST -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-new-repo",
    "description": "Repository created via API",
    "private": true,
    "auto_init": true,
    "default_branch": "main",
    "gitignores": "Node",
    "license": "MIT",
    "readme": "Default"
  }' \
  "https://git.zappro.site/api/v1/user/repos"
```

```python
new_repo = gitea_post("/user/repos", {
    "name": "my-new-repo",
    "description": "Repository created via API",
    "private": True,
    "auto_init": True,
    "default_branch": "main",
})
print(f"Created: {new_repo['html_url']}")
```

### 2.7 Update Repository Settings

```bash
curl -s -X PATCH -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description", "has_issues": true}' \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}"
```

### 2.8 Delete Repository

```bash
curl -s -X DELETE -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}"
```

---

## 3. CI/CD Runners (act_runner)

### 3.1 Runner Architecture

```
Gitea Server (git.zappro.site:3000)
        │
        ├── act_runner registers with runner token
        ├── Runner polls for jobs via REST
        └── Jobs execute in ephemeral Docker containers
```

### 3.2 Get Runner Registration Token

```bash
# From Infisical
infisical secrets get GITEA_RUNNER_REGISTRATION_TOKEN --env=dev --plain

# From Gitea UI: Admin Panel → Actions → Runners → New Runner
```

### 3.3 Register a Runner (act_runner)

```bash
# Download act_runner (if not already installed)
# Use the Gitea-matched version from https://dl.gitea.com/act_runner/

./act_runner register \
  --url https://git.zappro.site \
  --token "${GITEA_RUNNER_REGISTRATION_TOKEN}" \
  --name "prod-runner-1" \
  --labels "ubuntu-latest,docker,self-hosted,ephemeral" \
  --capacity 2
```

**Runner config.yaml example:**
```yaml
runner:
  capacity: 2
  timeout: 3h
  ephemeral: true
  labels:
    - "ubuntu-latest:docker://docker.gitea.com/runner-images:ubuntu-latest"
    - "ubuntu-22.04:docker://docker.gitea.com/runner-images:ubuntu-22.04"

cache:
  enabled: true
  dir: /data/actcache

container:
  network: "gitea"
  privileged: true
  force_pull: true

health:
  enabled: true
  port: 8092
  path: /healthz
```

### 3.4 Docker Compose Runner (ephemeral)

```yaml
# docker-compose.gitea-runner.yml
version: "3"

services:
  gitea-runner:
    image: docker.io/gitea/act_runner:nightly-dind
    container_name: gitea-runner
    restart: unless-stopped
    privileged: true
    environment:
      CONFIG_FILE: /config.yaml
      GITEA_INSTANCE_URL: http://10.0.1.1:3300
      GITEA_RUNNER_REGISTRATION_TOKEN: ${GITEA_RUNNER_REGISTRATION_TOKEN}
      GITEA_RUNNER_NAME: prod-runner-1
      GITEA_RUNNER_LABELS: ubuntu-latest
      GITEA_RUNNER_EPHEMERAL: "1"
    volumes:
      - ./runner/config.yaml:/config.yaml
      - ./runner/data:/data
      - /var/run/docker.sock:/var/run/docker.sock
    network_mode: host
    healthcheck:
      test: ["CMD", "wget", "--spider", "-q", "http://localhost:3000/healthz"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s
```

### 3.5 List Runners via API

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/runners"
```

### 3.6 Runner Health Check

```bash
# On runner host
curl http://localhost:8092/healthz

# Kubernetes liveness/readiness probe
livenessProbe:
  httpGet:
    path: /healthz
    port: 8092
  initialDelaySeconds: 10
  periodSeconds: 30
```

### 3.7 Unregister Runner

```bash
curl -s -X DELETE -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/runners/{runner_id}"
```

---

## 4. Gitea Actions (Workflows)

### 4.1 Workflow File Location

```
{repo}/.gitea/workflows/{workflow-name}.yml
```

Example: `.gitea/workflows/ci.yml`

### 4.2 List Workflows

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/workflows"
```

### 4.3 Get Workflow Details

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/workflows/{workflow_id}"
```

### 4.4 Trigger Workflow (dispatch)

```bash
# Basic trigger
curl -s -X POST -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"ref": "main", "inputs": {}}' \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches"

# With inputs
curl -s -X POST -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ref": "main",
    "inputs": {
      "environment": "production",
      "triggered_by": "claude-agent"
    }
  }' \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/workflows/deploy.yml/dispatches"
```

```python
def trigger_workflow(owner: str, repo: str, workflow_id: str,
                     ref: str = "main", inputs: dict = None) -> dict:
    return gitea_post(
        f"/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
        {"ref": ref, "inputs": inputs or {}}
    )

# Usage
trigger_workflow("will-zappro", "monorepo", "ci.yml", ref="main")
```

### 4.5 List Workflow Runs

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/runs"
```

```python
runs = gitea_get(f"/repos/{owner}/{repo}/actions/runs")
for run in runs.get("workflow_runs", []):
    print(f"Run #{run['run_number']}: {run['status']} - {run['conclusion']}")
```

### 4.6 Get Run Status

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/runs/{run_id}"
```

### 4.7 Cancel Run

```bash
curl -s -X POST -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/runs/{run_id}/cancel"
```

### 4.8 Get Run Logs

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/runs/{run_id}/logs"
```

### 4.9 Workflow Syntax — Critical Differences from GitHub Actions

| Feature | GitHub | Gitea | Workaround |
|---------|--------|-------|------------|
| Set env var | `echo "VAR=value" >> $GITHUB_ENV` | N/A | Use `echo "::set-env name=VAR::value"` |
| Add PATH | N/A | N/A | Use `echo "::add-path::/my/path"` |
| Debug echo | `::debug::message` | `::debug message` | Note: no double colon |
| Workflow dispatch | Full support | Partial | Pass inputs via env vars |
| `workflow_call` | Full | Limited (org-level only) | Use API-based chaining |
| `workflow_run` trigger | Full | No | Use API polling |
| OIDC tokens | Full | No | Use long-lived PAT |

#### Correct Gitea Syntax for Environment Variables

```yaml
# ✅ CORRECT (Gitea Actions)
- name: Set environment variable
  run: echo "::set-env name=APP_UUID::abc123"

# ❌ WRONG (GitHub Actions syntax that breaks in Gitea)
- name: Set environment variable
  run: echo "APP_UUID=abc123" >> $GITHUB_ENV
```

#### Debug Output

```yaml
# ✅ CORRECT
- name: Debug output
  run: echo "::debug message=Starting deploy step::"

# ❌ WRONG
- name: Debug output
  run: echo "::debug::Starting deploy step"
```

### 4.10 Workflow Example: CI with Gitea Syntax

```yaml
# .gitea/workflows/ci.yml
name: CI

on:
  push:
    branches: ['**']
  pull_request:
    branches: [main]

jobs:
  pipeline:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - run: pnpm install --frozen-lockfile

      - name: Set CI environment variable
        run: echo "::set-env name=CI_BUILD::true"

      - run: pnpm turbo build
      - run: pnpm turbo lint
      - run: pnpm turbo test

      - name: Update pipeline state
        if: success()
        run: echo "::set-env name=CI_PASSED::true"
```

### 4.11 Workflow Example: Deploy with Human Gate

```yaml
# .gitea/workflows/deploy-main.yml (from monorepo)
name: Deploy Main

on:
  push:
    branches: [main]
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

env:
  HEALTH_TIMEOUT: 90
  HEALTH_INTERVAL: 10

jobs:
  build-and-test:
    name: Build · Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm check-types
      - run: pnpm biome check .
      - run: pnpm build
        env:
          TURBO_CACHE_DIR: .turbo
      - run: pnpm test
        env:
          TURBO_CACHE_DIR: .turbo

  # Human gate — Gitea environment protection
  human-gate:
    name: Human Approval Gate
    runs-on: ubuntu-latest
    needs: [build-and-test]
    environment:
      name: ${{ inputs.environment || 'production' }}
      url: https://git.zappro.site
    steps:
      - name: Gate — awaiting human approval
        run: |
          echo "=== Human Approval Gate ==="
          echo "Environment: ${{ inputs.environment || 'production' }}"
          echo "Approve at: https://git.zappro.site/${{ gitea.repository }}/actions/environments"

  deploy:
    name: Deploy to Coolify
    runs-on: ubuntu-latest
    needs: [human-gate]
    environment: ${{ inputs.environment || 'production' }}
    steps:
      # ... deploy steps using Coolify API
```

---

## 5. Secrets and Variables via API

### 5.1 Create/Update Repository Secret

```bash
curl -s -X PUT -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"data": "my-secret-value"}' \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/secrets/MY_SECRET"
```

### 5.2 List Repository Secrets

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/secrets"
```

### 5.3 Create/Update Repository Variable

```bash
curl -s -X POST -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"value": "my-variable-value", "description": "My variable"}' \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/variables/MY_VAR"
```

### 5.4 List Repository Variables

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/actions/variables"
```

### 5.5 Organization-Level Variables (Gitea v0.22.0+)

```bash
# Create org-level action variable
curl -s -X POST -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name": "MY_VAR", "value": "my_value", "description": "My org variable"}' \
  "https://git.zappro.site/api/v1/orgs/{org}/actions/variables"

# List org-level variables
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/orgs/{org}/actions/variables"
```

### 5.6 Python: Manage Secrets

```python
def create_secret(owner: str, repo: str, name: str, value: str) -> None:
    """Create or update a repository secret."""
    # Gitea encrypts secrets server-side; client only sends encrypted value
    # For actual encryption, Gitea uses gpg or our token must have admin scope
    gitea_put(f"/repos/{owner}/{repo}/actions/secrets/{name}", {"data": value})

def create_variable(owner: str, repo: str, name: str, value: str,
                    description: str = "") -> None:
    """Create or update a repository variable."""
    gitea_post(f"/repos/{owner}/{repo}/actions/variables/{name}", {
        "value": value,
        "description": description
    })
```

---

## 6. Pull Requests via API

### 6.1 List Pull Requests

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/pulls"
```

### 6.2 Get Pull Request

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/pulls/{index}"
```

### 6.3 Create Pull Request

```bash
curl -s -X POST -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "feat: new feature",
    "head": "feature-branch",
    "base": "main",
    "body": "## Summary\n- New feature added\n\n## Test plan\n- [ ] Unit tests\n- [ ] Integration tests"
  }' \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/pulls"
```

### 6.4 Merge Pull Request

```bash
curl -s -X POST -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"do": "merge", "merge_message_field": "Merged via API"}' \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/pulls/{index}/merge"
```

### 6.5 Post PR Comment

```bash
curl -s -X POST -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"body": "## AI Code Review\n\nLGTM! Ready to merge."}' \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/issues/{index}/comments"
```

---

## 7. Webhooks via API

### 7.1 Create Webhook

```bash
curl -s -X POST -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "gitea",
    "config": {
      "url": "https://your-agent.zappro.site/webhooks/gitea",
      "content_type": "json",
      "secret": "webhook-secret"
    },
    "events": ["push", "pull_request", "repository"],
    "active": true
  }' \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/hooks"
```

### 7.2 List Webhooks

```bash
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/hooks"
```

### 7.3 Delete Webhook

```bash
curl -s -X DELETE -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  "https://git.zappro.site/api/v1/repos/{owner}/{repo}/hooks/{hook_id}"
```

---

## 8. Complete Python Example: Full CI/CD Pipeline

```python
#!/usr/bin/env python3
"""
Gitea Actions CI/CD Pipeline Helper

Usage:
    python3 gitea_cicd.py list-runs --owner will-zappro --repo monorepo
    python3 gitea_cicd.py trigger --owner will-zappro --repo monorepo --workflow ci.yml --ref main
    python3 gitea_cicd.py wait-run --owner will-zappro --repo monorepo --run-id 123
"""

import os
import sys
import time
import requests
from pathlib import Path

GITEA_BASE = "https://git.zappro.site/api/v1"
TOKEN = os.environ.get("GITEA_ACCESS_TOKEN", "")
HEADERS = {"Authorization": f"token {TOKEN}", "Content-Type": "application/json"}


def gitea_get(endpoint: str) -> dict:
    resp = requests.get(f"{GITEA_BASE}{endpoint}", headers=HEADERS)
    resp.raise_for_status()
    return resp.json()


def gitea_post(endpoint: str, json: dict = None) -> dict:
    resp = requests.post(f"{GITEA_BASE}{endpoint}", headers=HEADERS, json=json)
    resp.raise_for_status()
    return resp.json()


def list_workflow_runs(owner: str, repo: str) -> list:
    """List all workflow runs for a repository."""
    data = gitea_get(f"/repos/{owner}/{repo}/actions/runs")
    return data.get("workflow_runs", [])


def trigger_workflow(owner: str, repo: str, workflow_id: str,
                     ref: str = "main", inputs: dict = None) -> dict:
    """Trigger a workflow dispatch."""
    return gitea_post(
        f"/repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches",
        {"ref": ref, "inputs": inputs or {}}
    )


def get_run_status(owner: str, repo: str, run_id: int) -> dict:
    """Get status of a specific run."""
    return gitea_get(f"/repos/{owner}/{repo}/actions/runs/{run_id}")


def cancel_run(owner: str, repo: str, run_id: int) -> None:
    """Cancel a running workflow."""
    gitea_post(f"/repos/{owner}/{repo}/actions/runs/{run_id}/cancel")


def wait_for_run_completion(owner: str, repo: str, run_id: int,
                            timeout: int = 600, poll_interval: int = 10) -> dict:
    """Poll until run completes or times out."""
    start = time.time()
    while time.time() - start < timeout:
        run = get_run_status(owner, repo, run_id)
        status = run.get("status", "")
        conclusion = run.get("conclusion", "")

        print(f"Run #{run_id}: status={status}, conclusion={conclusion}")

        if status == "completed":
            return run

        time.sleep(poll_interval)

    raise TimeoutError(f"Run #{run_id} did not complete within {timeout}s")


def list_repos() -> list:
    """List all repositories for the authenticated user."""
    return gitea_get("/user/repos")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Gitea Actions CI/CD Helper")
    subparsers = parser.add_subparsers(dest="command")

    # list-runs
    p = subparsers.add_parser("list-runs")
    p.add_argument("--owner", required=True)
    p.add_argument("--repo", required=True)

    # trigger
    p = subparsers.add_parser("trigger")
    p.add_argument("--owner", required=True)
    p.add_argument("--repo", required=True)
    p.add_argument("--workflow", required=True)
    p.add_argument("--ref", default="main")
    p.add_argument("--wait", action="store_true")

    # wait-run
    p = subparsers.add_parser("wait-run")
    p.add_argument("--owner", required=True)
    p.add_argument("--repo", required=True)
    p.add_argument("--run-id", type=int, required=True)

    args = parser.parse_args()

    if args.command == "list-runs":
        runs = list_workflow_runs(args.owner, args.repo)
        for run in runs:
            print(f"  #{run['run_number']} | {run['name']} | {run['status']} | {run['conclusion']}")

    elif args.command == "trigger":
        print(f"Triggering workflow: {args.workflow} (ref={args.ref})")
        trigger_workflow(args.owner, args.repo, args.workflow, ref=args.ref)
        print("Workflow triggered successfully.")

        if args.wait:
            # Find the latest run for this workflow
            runs = list_workflow_runs(args.owner, args.repo)
            latest = next((r for r in runs if r["name"] == args.workflow), None)
            if latest:
                print(f"Waiting for run #{latest['id']}...")
                result = wait_for_run_completion(args.owner, args.repo, latest["id"])
                print(f"Run completed: {result['conclusion']}")

    elif args.command == "wait-run":
        result = wait_for_run_completion(args.owner, args.repo, args.run_id)
        print(f"Run #{args.run_id} finished: {result['conclusion']}")

    else:
        parser.print_help()
```

---

## 9. Troubleshooting

### 401 Unauthorized

**Cause:** Token is invalid, expired, or missing.

**Fix:**
```bash
# Verify token works
curl -s -H "Authorization: token ${GITEA_ACCESS_TOKEN}" \
  https://git.zappro.site/api/v1/user | python3 -m json.tool

# Create new token at: https://git.zappro.site/user/settings/applications
```

### 403 Forbidden

**Cause:** Token lacks required scope.

**Fix:** Ensure token has `repo` and `workflow` scopes for Actions operations.

### 404 Not Found

**Cause:** Wrong endpoint path or repository doesn't exist.

**Fix:** Verify owner/repo names and check swagger docs at `/api/v1/swagger`.

### Workflow Not Triggering

**Check list:**
1. Actions enabled in repository settings
2. Workflow file exists at `.gitea/workflows/{name}.yml`
3. Runner is online (check `/admin/actions/runners`)
4. Runner has matching label for `runs-on` in workflow
5. Token has `workflow` scope

### Runner Offline

**Check list:**
1. Runner container is running: `docker ps | grep gitea-runner`
2. Runner registered correctly: check logs `docker logs gitea-runner`
3. Registration token not expired — generate new one at `/admin/actions/runners`
4. Network connectivity: runner host can reach `git.zappro.site`

### $GITHUB_ENV Not Working

**Cause:** GitHub Actions syntax not supported in Gitea Actions.

**Fix:** Replace with Gitea syntax:
```yaml
# Before (GitHub):
echo "VAR=value" >> $GITHUB_ENV

# After (Gitea):
echo "::set-env name=VAR::value"
```

### Docker-in-Docker (DinD) Issues

**Symptom:** Workflows with `docker` commands fail.

**Fix:** Use `privileged: true` and `GITEA_RUNNER_EPHEMERAL: "1"` in runner config. Runner must have access to Docker socket.

---

## 10. Reference

### Key Endpoints Summary

| Operation | Method | Endpoint |
|-----------|--------|----------|
| Test auth | GET | `/user` |
| List repos | GET | `/user/repos` |
| Create repo | POST | `/user/repos` |
| Get repo | GET | `/repos/{owner}/{repo}` |
| List workflows | GET | `/repos/{owner}/{repo}/actions/workflows` |
| Trigger workflow | POST | `/repos/{owner}/{repo}/actions/workflows/{id}/dispatches` |
| List runs | GET | `/repos/{owner}/{repo}/actions/runs` |
| Get run | GET | `/repos/{owner}/{repo}/actions/runs/{id}` |
| Cancel run | POST | `/repos/{owner}/{repo}/actions/runs/{id}/cancel` |
| Create secret | PUT | `/repos/{owner}/{repo}/actions/secrets/{name}` |
| Create variable | POST | `/repos/{owner}/{repo}/actions/variables/{name}` |
| List runners | GET | `/repos/{owner}/{repo}/actions/runners` |
| Register runner | POST | `/repos/{owner}/{repo}/actions/runners` (from Gitea admin) |
| List PRs | GET | `/repos/{owner}/{repo}/pulls` |
| Create PR | POST | `/repos/{owner}/{repo}/pulls` |
| Merge PR | POST | `/repos/{owner}/{repo}/pulls/{index}/merge` |
| Create webhook | POST | `/repos/{owner}/{repo}/hooks` |

### Infisical Secrets Reference

| Secret | Path | Usage |
|--------|------|-------|
| `gitea-access-token` | `/` | API authentication (PAT) |
| `GITEA_RUNNER_REGISTRATION_TOKEN` | `/` | Runner registration |

### Related Documents

- [SPEC-015: Gitea Actions Enterprise](https://srv/monorepo/docs/SPECS/SPEC-015-GITEA-ACTIONS-ENTERPRISE.md) — Full enterprise architecture
- [gitea-access skill](../.claude/skills/gitea-access/SKILL.md) — Claude Code MCP integration
- [INCIDENT-2026-04-08-gitea-actions-runner.md](../../INCIDENTS/INCIDENT-2026-04-08-gitea-actions-runner.md) — Runner troubleshooting history

### External References

- [Gitea API Docs](https://docs.gitea.com/1.25/development/api-usage)
- [Gitea Actions Overview](https://docs.gitea.com/1.25/usage/actions/overview)
- [act_runner](https://gitea.com/act_runner/act_runner)
- [Swagger UI](https://git.zappro.site/api/v1/swagger)

---

**Last updated:** 2026-04-11
**Maintainer:** will-zappro homelab