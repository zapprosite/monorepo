# SPEC-014: Cursor AI CI/CD Pattern — Autonomous Coding & GitOps for Monorepo

**Status:** DRAFT
**Created:** 2026-04-08
**Updated:** 2026-04-08
**Author:** will
**Related:** SPEC-028, SPEC-010 (OpenClaw Agents Kit), SPEC-011 (Agency Suite)

---

## Objective

Synthesize state-of-the-art CI/CD loop patterns from Cursor AI, Lovable, Bolt, and TaskMaster into actionable patterns for the monorepo. Define how AI agents integrate with GitOps pipelines, handle continuous review, and operate autonomously within the existing Gitea + Coolify + Infisical infrastructure.

---

## Research Synthesis

### Sources Consulted

| Source | Key Focus | Relevance |
|--------|-----------|-----------|
| Cursor Docs (context7) | CLI headless, GitHub Actions autonomy, Cloud Agents API | High |
| Cursor Agent ACP (NPM) | Session management, protocol adapter for Zed/CI | High |
| TaskMaster (GitHub) | TDD workflow, RED→GREEN→COMMIT cycle, autopilot | High |
| Lovable Dev (context7) | GitHub integration, pinning, branching strategy | Medium |
| Bolt.new (context7) | AI full-stack, Expo deploy, one-click deployment | Medium |
| SPEC-028 | Gitea + Coolify GitOps pattern (production) | High |

---

## 1. CI/CD Loop Patterns for Autonomous Coding

### 1.1 The Core Loop: Plan → Act → Review → Commit

Every AI-assisted CI/CD system follows a variant of this loop:

```
Human/Trigger → Agent Planning → Code Generation → Test Validation → Commit → CI Check → Human Gate
```

**TaskMaster TDD Cycle** (most structured):
```
RED Phase    → AI writes failing test (generate_test)
GREEN Phase  → AI implements minimal code to pass test (implement_code)
COMMIT Phase → AI commits with auto-generated message (commit_changes)
```

**Cursor CLI Loop** (most flexible):
```
agent -p "task description" → write/edit files → git commit → PR comment
```

### 1.2 Cursor AI — Three Autonomy Modes

Cursor's `agent` command supports graduated autonomy:

| Mode | Git Write | API Calls | PR Actions | Use Case |
|------|-----------|-----------|------------|----------|
| **Ask** | No | No | No | Single-file fixes, questions |
| **Plan** | No | Read-only | No | Architecture review, code analysis |
| **Agent** | Yes | Yes | Yes | Full autonomous coding |

**Full Autonomy GitHub Actions Example** (from Cursor docs):
```yaml
- name: Update docs (full autonomy)
  run: |
    agent -p "You have full access to git, GitHub CLI, and PR operations.
    Handle the entire docs update workflow including commits, pushes, and PR comments."
```

### 1.3 Cursor Cloud Agents API

For enterprise use, Cursor provides a `POST /v0/agents` endpoint:

```yaml
POST /v0/agents
{
  "prompt": { "text": "Add README.md with installation instructions" },
  "source": { "repository": "https://github.com/org/repo", "ref": "main" },
  "target": { "branch": "feat-readme", "pr": true },
  "webhook": { "url": "https://example.com/webhook", "secret": "..." }
}
```

**Response:**
```json
{ "id": "bc_abc123", "status": "CREATING" }
```

This creates a cloud agent that works on the repo, posts results via webhook — ideal for async enterprise workflows.

### 1.4 Cursor CLI Headless Mode for CI

```bash
# Non-interactive (scriptable)
agent -p "fix all broken tests" --model "claude-4-sonnet" --output-format json

# Code review in CI
agent -p "Review recent changes for security issues" --force --output-format text

# Review changes with git diff included
agent -p "review these changes for security issues" --output-format text
```

**NDJSON streaming** for real-time monitoring in CI:
```json
{"type":"system","subtype":"init","model":"Claude 4 Sonnet","session_id":"..."}
{"type":"tool_call","subtype":"started","call_id":"...","tool_call":{"readToolCall":{"args":{"path":"file.txt"}}}}
{"type":"tool_call","subtype":"completed","call_id":"...","tool_call":{"result":{"success":{...}}}}
{"type":"result","subtype":"success","is_error":false}
```

---

## 2. Continuous Integration with AI Code Review

### 2.1 Continuous Review vs Batch Review

| Aspect | Continuous Review | Batch Review |
|--------|-------------------|--------------|
| **Trigger** | Every commit/PR | Scheduled (daily/weekly) |
| **Latency** | Minutes | Hours/Days |
| **Scope** | Incremental changes | Full codebase audit |
| **Tooling** | `agent -p` per PR | Scheduled task scan |
| **Human load** | Low, per-change | High, full context |
| **Coverage** | Path-focused | Architecture-level |

**Recommendation for monorepo:** Hybrid — continuous for PRs, batch for weekly architecture audit.

### 2.2 AI Code Review Patterns

**Automated PR Review (Cursor CLI):**
```bash
#!/bin/bash
# simple-code-review.sh — Basic code review script
agent -p --force --output-format text \
  "Review the recent code changes and provide feedback on:
  - Code quality and readability
  - Potential bugs or issues
  - Security considerations
  - Best practices compliance
  Provide specific suggestions for improvement and write to review.txt"
```

**Lovable Codebase Audit Prompt (comprehensive, read-only):**
```
Perform a comprehensive **audit of the entire codebase** to check if the architecture is clean, modular, and optimized:
- Identify any files, components, or logic that are in the wrong place or could be better organized
- Evaluate if we have a clear separation of concerns
- Highlight any areas of the code that are overly complex or not following best practices
- Provide a report with specific recommendations to improve structure and maintainability, **without making any code changes yet**
*(This is a read-only analysis)*
```

**Critical Code Warning Prompt (Lovable):**
```
The next change is in a **critical part of the app**, so proceed with **utmost caution**:
- Carefully examine all related code and dependencies *before* making changes
- **Avoid any modifications** to unrelated components or files
- If there's any uncertainty, pause and explain your thought process before continuing
```

### 2.3 Review Gates in CI Pipeline

```
┌─────────────────────────────────────────────────────────┐
│  PR Opened / Commit Pushed                               │
└─────────────────┬───────────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────────┐
│  Lint + Format Check (pre-commit hook)                  │
│  Secrets Audit (pre-commit hook)                        │
└─────────────────┬───────────────────────────────────────┘
                  ▼
┌─────────────────────────────────────────────────────────┐
│  AI Code Review (Cursor agent -p "review changes")      │
│  - Security, correctness, readability, performance       │
│  - Writes review.txt                                    │
└─────────────────┬───────────────────────────────────────┘
                  ▼
         ┌────────────────┐
         │ Review Score   │
         │ > threshold?    │
         └───────┬────────┘
                 │ Fail     │ Pass
                 ▼         ▼
        Human Review   Auto-merge / CI proceeds
```

---

## 3. Enterprise Monorepo Patterns for AI-Assisted Development

### 3.1 Leader + Sub-Agents Pattern (SPEC-010 Architecture)

For multi-agent AI systems in monorepos:

```
Leader Agent (default: true)
├── Sub-agents with scoped permissions
├── Workspace isolation per agent
├── Binding to specific channels/paths
└── Identity patching without context loss
```

**Config template from SPEC-010:**
```json5
{
  agents: {
    list: [
      {
        id: "leader",
        default: true,
        workspace: "~/.openclaw/workspace-leader",
        subagents: { allowAgents: ["*"] },
        tools: { profile: "coding" }
      },
      {
        id: "ops",
        workspace: "~/.openclaw/workspace-ops",
        subagents: { allowAgents: [] },
        tools: { deny: ["browser", "canvas"] }
      }
    ]
  }
}
```

### 3.2 Session Startup Pattern (Preserves Context)

Every AI agent session in the monorepo should follow this startup sequence:

```
1. SOUL.md    → identity, role, constraints
2. USER.md    → user context, preferences
3. MEMORY.md  → session history (for multi-turn)
4. TaskBoard  → current work items
```

This pattern appears across OpenClaw agents (SPEC-011), TaskMaster, and Cursor sessions.

### 3.3 Monorepo CI/CD Structure

```
/srv/monorepo/
├── .gitea/workflows/           # Gitea Actions CI/CD
│   ├── ci.yml                  # Lint, test, build
│   ├── ai-review.yml           # AI code review gate
│   └── deploy.yml              # Coolify deployment
├── .claude/                    # AI agent config
│   ├── skills/                 # Skill definitions
│   ├── commands/               # Slash command aliases
│   ├── hooks/                 # Pre-commit hooks
│   └── scheduled_tasks.json    # Cron jobs
├── apps/                      # Application code
├── docs/                      # Documentation
└── docs/SPECS/             # SPEC-driven development
    ├── SPEC-001-workflow-performatico.md
    ├── SPEC-002-homelab-network-refactor.md
    └── SPEC-014-CURSOR-AI-CICD-PATTERN.md  # This document
```

### 3.4 TaskMaster Workflow — Monorepo Adaptations

**Daily Development Loop** (TaskMaster CLI):
```bash
task-master next                            # Find next task
task-master show <id>                       # Review task details
# ... implement ...
task-master update-subtask --id=<id> --prompt="progress notes"
task-master set-status --id=<id> --status=done
```

**Autopilot TDD for Monorepo:**
```bash
tm autopilot start <taskId>                # Creates branch task-<id>
# RED: generate tests
tm autopilot next                           # Returns { nextAction: "generate_test" }
# GREEN: implement
tm autopilot commit                         # Auto-commit, advance subtask
```

---

## 4. GitOps + AI: Lovable, Bolt, and Similar Tools

### 4.1 Lovable — GitHub-First CI/CD

Lovable's GitOps approach:
- Every edit is a commit (no intermediate saves)
- **Pinning** marks stable versions (critical for AI-generated code)
- GitHub branching is supported but risky — don't delete branch before switching back to main
- Export code to GitHub for full CI/CD control

**Lovable branching warning:**
> Use **GitHub branching** at your own risk. Avoid deleting branches before switching back to `main` in Lovable to prevent project sync issues.

### 4.2 Bolt.new — One-Click Deploy + Git Integration

Bolt's GitOps model:
- AI generates code with live preview
- Git integration for version control
- One-click deployment (Expo, Vercel, Netlify)
- Supports `eas deploy --prod` for Expo hosting

**Deployment flow:**
```bash
npx expo export --platform web
eas deploy --prod
# or for mobile
eas build --platform ios --auto-submit
eas build --platform android
```

### 4.3 Comparative GitOps Matrix

| Feature | Cursor | Lovable | Bolt.new | TaskMaster |
|---------|--------|---------|----------|------------|
| Git-native | Yes (CLI) | Yes (export) | Yes | Yes |
| Branch per task | Yes (manual) | Risky | Yes | Yes (autopilot) |
| Auto-commit | Yes (full autonomy) | Every edit | Yes | Yes (autopilot) |
| CI/CD trigger | GitHub Actions | GitHub export | Expo/E2E | MCP tools |
| Human gate | PR review | Pinning | Deploy button | COMMIT phase |
| Secrets | Via env vars | External | External | Infisical |

---

## 5. State-of-the-Art AI-Driven CI/CD (2026)

### 5.1 Architecture Patterns

**Pattern 1: Agentic CI/CD Loop**
```
Human Issue → AI Agent Planning → Code Generation → Test → Commit → CI → Deploy → Monitor
                ↑________________________________________|
                          (feedback loop from failures)
```

**Pattern 2: Cloud Agent + Webhook (Enterprise)**
```
GitHub PR → Cursor Cloud Agent (POST /v0/agents)
          → Agent works on branch
          → Webhook fires on completion
          → CI validates + merges
```

**Pattern 3: TDD Autopilot (TaskMaster)**
```
tm autopilot start → RED phase (write failing test)
                   → GREEN phase (implement)
                   → COMMIT phase (auto-message)
                   → repeat for each subtask
                   → Finalize + PR
```

### 5.2 Key Technologies in 2026

| Layer | Technology | Notes |
|-------|------------|-------|
| AI Code Generation | Claude 4, GPT-4o, MiniMax M2.7 | Multimodal, long context |
| CI/CD Engine | Gitea Actions, GitHub Actions | GitOps-native |
| Secret Management | Infisical | Vault with SDK |
| Service Orchestration | Coolify | Docker compose + API |
| Task Management | TaskMaster, Linear | AI-native task ops |
| Agent Protocol | ACP (Agent Client Protocol) | Multi-agent communication |
| Vector Memory | Qdrant | Semantic search for agent context |

### 5.3 Gitea Actions Workflow for AI Agents

**Existing pattern from SPEC-028:**
```yaml
name: Deploy Perplexity Agent
on:
  push:
    branches: [main]
    paths: ['apps/perplexity-agent/**']

env:
  COOLIFY_URL: ${{ secrets.COOLIFY_URL }}

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Get APP UUID
        run: |
          APPS_JSON=$(curl -s "$COOLIFY_URL/api/v1/applications" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}")
          APP_UUID=$(echo "$APPS_JSON" | python3 -c "
            import sys, json
            data = json.load(sys.stdin)
            for a in data.get('data', []):
              if 'perplexity' in a.get('name', '').lower():
                print(a['uuid'])
          ")
          echo "APP_UUID=$APP_UUID" >> $GITHUB_ENV

      - name: Trigger Deploy
        run: |
          curl -X POST "$COOLIFY_URL/api/v1/applications/$APP_UUID/deploy" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}"
```

### 5.4 AI Review Gate — Monorepo Implementation

```yaml
# .gitea/workflows/ai-review.yml
name: AI Code Review

on:
  pull_request:

jobs:
  ai-review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Run AI Review
        env:
          CURSOR_API_KEY: ${{ secrets.CURSOR_API_KEY }}
        run: |
          agent -p "Review the changes in this PR:
          - Code quality and correctness
          - Security vulnerabilities
          - Performance issues
          - Best practices compliance
          Write findings to review.txt" \
          --output-format text --force

      - name: Post Review Comment
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const review = fs.readFileSync('review.txt', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.payload.pull_request.number,
              body: '## AI Code Review\n\n' + review
            });
```

---

## 6. Recommendations for Monorepo

### 6.1 Immediate Actions (This Week)

1. **Add Cursor CLI to CI pipeline** — enable `agent -p` in Gitea Actions for PR review
2. **Implement AI review gate** — block merges on critical security findings
3. **Migrate SPEC-028 pattern** — extend to other apps in monorepo

### 6.2 Short-term (2-4 Weeks)

1. **TaskMaster integration** — adopt TDD autopilot for complex features
2. **Continuous review for PRs** — every PR gets AI review, batch review weekly
3. **Human gates defined** — specify which AI actions require human approval

### 6.3 Medium-term (1-2 Months)

1. **Leader + sub-agents pattern** — implement for multi-service monorepo
2. **Cloud Agents API** — use `POST /v0/agents` for async enterprise workflows
3. **Memory layer** — Qdrant-backed context for AI agents (SPEC-011 architecture)

### 6.4 CI/CD Loop Recommendation

```
┌──────────────────────────────────────────────────────────────────────┐
│                     MONOREPO AI CI/CD LOOP                            │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  [Dev] ──push──► [Gitea Actions]                                   │
│                      │                                               │
│          ┌───────────┼───────────┐                                   │
│          ▼           ▼           ▼                                   │
│     [Lint/Test]  [AI Review]  [Build]                               │
│          │           │           │                                   │
│          └───────────┴───────────┘                                   │
│                      │                                               │
│                      ▼                                               │
│              [Human Gate?]--No--> [Deploy to Coolify]               │
│                      │                                               │
│                    Yes                                               │
│                      ▼                                               │
│              [Human Review]                                          │
│                      │                                               │
│                   Merge                                              │
│                      │                                               │
│                      ▼                                               │
│            [Deploy to Coolify]                                       │
│                      │                                               │
│                      ▼                                               │
│            [Smoke Test + Health Check]                               │
│                      │                                               │
│                      ▼                                               │
│            [Monitor via Grafana/n8n]                                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 6.5 Human Gates Matrix

| Action | AI Can Do | Human Must Approve |
|--------|-----------|-------------------|
| Write tests | Yes (TDD) | No |
| Commit to feature branch | Yes | No |
| Create PR | Yes | No |
| Merge to `main` | No | **Yes** |
| Deploy to production | No | **Yes** |
| Delete branch | No | **Yes** |
| Modify secrets | No | **Yes** |
| Change CI/CD workflow | No | **Yes** |

### 6.6 Tooling Selection

| Use Case | Tool | Rationale |
|----------|------|-----------|
| Code generation | Cursor CLI / Claude Code | Best context window, Git integration |
| Task management | TaskMaster | TDD workflow, MCP integration |
| CI/CD trigger | Gitea Actions | Already in infrastructure |
| Deploy | Coolify | Already deployed, API-first |
| Secrets | Infisical | Vault + SDK, multi-environment |
| Review | Cursor agent -p | Native GitHub Actions support |
| Monitoring | n8n + Grafana | Already in stack |

---

## 7. Non-Goals

- This spec does NOT cover multi-region deployment
- Does NOT cover database migrations in CI/CD
- Does NOT cover AI model fine-tuning or training
- Does NOT cover compliance/audit pipelines (SOC2, etc.)

---

## 8. Open Questions

| # | Question | Impact | Priority |
|---|----------|--------|----------|
| OQ-1 | Should we use Cursor Cloud Agents API or local CLI? | Cost vs control | High |
| OQ-2 | What's the maximum branch lifetime for AI-generated branches? | Git hygiene | Medium |
| OQ-3 | How to handle AI review of AI-generated code (circular)? | Quality assurance | High |
| OQ-4 | Should AI agents have write access to `main` in emergencies? | Security vs agility | High |

---

## 9. Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-08 | Use Cursor CLI over Cloud Agents for cost control | Local API key, no per-agent billing |
| 2026-04-08 | Gitea Actions as CI/CD engine | Already in infrastructure |
| 2026-04-08 | AI review gate on PR, not on push | Reduces noise, focuses on changes |
| 2026-04-08 | Human gate for `main` merges only | Balances autonomy and safety |

---

## 10. Acceptance Criteria

| # | Criterion | Test |
|---|-----------|------|
| AC-1 | AI can review a PR and post comments within 5 minutes | Open test PR, verify comment |
| AC-2 | AI can create a feature branch and commit changes | Run `agent -p` on issue |
| AC-3 | AI cannot merge to `main` without human approval | Attempt merge, verify block |
| AC-4 | Cursor CLI runs in Gitea Actions headless mode | Check Action logs |
| AC-5 | Secrets never appear in CI/CD logs | Audit Gitea Action logs |

---

## 11. Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| Cursor API key | Pending | Need `CURSOR_API_KEY` in Gitea Secrets |
| Gitea Actions | ✅ OK | Workflow syntax compatible |
| Coolify API | ✅ OK | For deployment jobs |
| Infisical | ✅ OK | For secrets management |

---

## 12. Checklist

- [ ] SPEC written and reviewed
- [ ] AI review gate implemented in `.gitea/workflows/ai-review.yml`
- [ ] Cursor CLI authenticated in Gitea Secrets
- [ ] Human gates documented and enforced
- [ ] TaskMaster evaluated for TDD autopilot
- [ ] Lovable/Bolt patterns reviewed for potential adoption
- [ ] Security review of AI agent permissions

---

**Last updated:** 2026-04-08
**Sources:** Cursor docs (Context7), TaskMaster GitHub, Lovable Dev Guide, Bolt.new docs, SPEC-028