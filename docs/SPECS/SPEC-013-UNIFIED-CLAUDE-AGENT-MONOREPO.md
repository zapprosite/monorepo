---
name: SPEC-013-UNIFIED-CLAUDE-AGENT-MONOREPO
description: Unified Claude Code + Antigravity Kit + Gitea Actions architecture for enterprise CI/CD loop
type: specification
---

# SPEC-013-UNIFIED: Unified Claude Agent + Monorepo CI/CD Architecture

**Status:** DRAFT
**Created:** 2026-04-08
**Updated:** 2026-04-08
**Author:** will
**Related:** SPEC-013 (Claude Code CLI), SPEC-014 (Cursor AI CI/CD Pattern), SPEC-015 (Gitea Actions Enterprise)

---

## Objective

Unify all AI tooling in the monorepo into a single coherent system: `.claude/` (project-level commands, skills, rules), `.agent/` (Antigravity Kit workflows), `scripts/` (shell utilities), and Gitea Actions (CI/CD). Target: Enterprise CI/CD loop where AI writes code, commits to feature branches, gets continuous review, and requires human gate for production merges — similar to Cursor AI's autonomous coding pattern.

---

## Tech Stack

| Component | Technology | Notes |
|-----------|------------|-------|
| AI Agent | Claude Code CLI (claude.ai/code) | Primary coding agent |
| Skills Framework | addyosmani/agent-skills | 36 skills via Antigravity Kit |
| CI/CD Engine | Gitea Actions | Self-hosted at git.zappro.site |
| Deploy Target | Coolify | Docker compose + API |
| Secrets | Infisical + Gitea Secrets | Layered approach |
| Git Server | Gitea 1.21+ | git.zappro.site |
| Workflows | `.agent/workflows/` + `.claude/commands/` | Wrapped via project commands |
| Monorepo Runner | act_runner | Ephemeral, Kubernetes |

---

## Architecture

### System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         UNIFIED AI TOOLING ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Claude Code CLI (claude -p "task")                                        │
│  ├── Project-Level (.claude/)                                             │
│  │   ├── commands/     → 16 slash commands (feature, ship, pg, rr, etc.) │
│  │   ├── skills/       → 32 skills (symlinks + local)                    │
│  │   ├── rules/        → 4 rules (backend, search, REVIEW-SKILLS)        │
│  │   ├── agents/       → 14 specialist agents                             │
│  │   ├── hooks/        → PreToolUse validators (Bash, Edit)             │
│  │   └── scheduled_tasks.json → Cron jobs (30min memory sync, 3am pipeline)│
│  │                                                                          │
│  │   └── WRAPPER COMMANDS in .claude/commands/ invoke .agent/workflows/   │
│  │                                                                          │
│  └── User-Level (~/.claude/)                                              │
│      ├── commands/     → 6 user commands                                  │
│      ├── skills/      → 21 skills (including coolify-*, universal-*)      │
│      ├── agent-skills/skills → 22 packaged skills (symlinked to .claude/) │
│      └── projects/-srv-monorepo/ → 147MB session data (ARCHIVE)           │
│                                                                             │
│  .agent/ (Antigravity Kit) — separate toolkit, NOT part of Claude Code    │
│  ├── workflows/  → 11 workflows (git-feature, git-ship, code-review...)   │
│  ├── skills/     → 9 skills (api-patterns, architecture...)              │
│  ├── agents/     → 16 specialist agents (mirrors .claude/agents/)         │
│  └── scripts/    → Master validation scripts                              │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              CI/CD LOOP                                     │
│                                                                             │
│  push → Gitea Actions → AI Review (Claude Code) → Human Gate → Merge     │
│    │                        │                                              │
│    │                        ├── Lint + Test (automated)                   │
│    │                        ├── Security Scan (Trivy)                     │
│    │                        └── AI Code Review (per-PR)                   │
│    │                                                                      │
│    ▼                                                                      │
│  feature branch created by AI (via /feature or /scaffold)                │
│    │                                                                      │
│    ▼                                                                      │
│  [CI Pipeline]                                                             │
│  ├── Checkout + Setup                                                      │
│  ├── Type check + Lint + Build                                            │
│  ├── Test suite                                                            │
│  └── AI Review gate (Claude Code reviews PR)                               │
│    │                                                                      │
│    ▼                                                                      │
│  [Human Gate] ──FAIL─────► [Human Review Required]                        │
│    │                                                                      │
│   PASS                                                                      │
│    │                                                                      │
│    ▼                                                                      │
│  Merge to main → Deploy to Coolify → Smoke Test → Monitor                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure (After Unification)

```
/srv/monorepo/
├── .gitea/
│   └── workflows/
│       ├── ci.yml                    # Type check, lint, build, test
│       ├── ai-review.yml             # AI code review per PR
│       ├── deploy.yml                # Coolify deploy + rollback
│       └── rollback.yml              # Manual rollback workflow
│
├── .claude/                          # Project-level (THIS REPO)
│   ├── CLAUDE.md                     # Project instructions (read at session start)
│   ├── commands/                     # Slash commands (16 files)
│   │   ├── feature.md                # Wraps .agent/workflows/git-feature.md
│   │   ├── ship.md                   # Wraps .agent/workflows/git-ship.md
│   │   ├── pg.md                     # Pipeline gen from SPECs
│   │   ├── rr.md                     # Code review → REVIEW-*.md
│   │   ├── sec.md                    # Secrets audit (pre-push hook)
│   │   ├── ss.md                     # ZFS snapshot (pre-destructive)
│   │   ├── hg.md                     # Human gates blocker detection
│   │   ├── plan.md                   # spec-driven planning
│   │   ├── spec.md                   # spec-driven development
│   │   ├── scaffold.md               # Wraps .agent/workflows/scaffold.md
│   │   ├── turbo.md                  # Wraps .agent/workflows/git-turbo.md
│   │   ├── code-review.md            # Review latest N commits
│   │   ├── commit.md                 # Semantic commit from staged changes
│   │   ├── dv.md                     # Pre-deploy validation
│   │   ├── rs.md                     # Repo scan for tasks
│   │   ├── update-docs.md            # Update project docs
│   │   └── img.md                    # Image analysis (LLaVA/Ollama)
│   │
│   ├── skills/                       # Project-level skills
│   │   ├── api-design/               # Local: API design patterns
│   │   ├── bug-investigation/        # Local: systematic bug investigation
│   │   ├── code-review/              # Local: 5-axis code review
│   │   ├── commit-message/           # Local: conventional commits
│   │   ├── context-prune/            # Local: session cleanup
│   │   ├── cost-reducer/             # Local: cloud cost optimization
│   │   ├── create-skill/             # Local: skill creation guide
│   │   ├── customer-support/         # Local: customer support patterns
│   │   ├── deploy-validate/         # Local: pre-deploy validation
│   │   ├── documentation/            # Local: doc generation
│   │   ├── feature-breakdown/        # Local: feature → tasks
│   │   ├── frontend-design/          # Local: UI/UX patterns
│   │   ├── human-gates/             # Local: blocker detection
│   │   ├── know-me/                  # Local: user context
│   │   ├── mcp-health/              # Local: MCP diagnostics
│   │   ├── pipeline-gen/            # Local: SPEC → pipeline.json
│   │   ├── pr-review/               # Local: PR review
│   │   ├── refactoring/              # Local: safe refactoring
│   │   ├── repo-scan/               # Local: task detection
│   │   ├── researcher/               # Local: research patterns
│   │   ├── scalability/              # Local: scalability patterns
│   │   ├── secrets-audit/           # Local: secret scanning
│   │   ├── security/                 # Local: security patterns
│   │   ├── security-audit/           # Local: security review checklist
│   │   ├── self-healing/             # Local: autonomous healing
│   │   ├── smoke-test-gen/          # Local: smoke test generation
│   │   ├── snapshot-safe/          # Local: ZFS snapshot guide
│   │   ├── test-generation/         # Local: test generation
│   │   ├── testsprite/              # Local: test sprite patterns
│   │   ├── trigger-dev/             # Local: trigger development
│   │   ├── browser-dev/             # Local: browser dev tools
│   │   └── spec-driven-development/ → SYMLINK to ~/.claude/agent-skills/skills/spec-driven-development
│   │                                # (only symlink — avoids circular .agent/ → agent-skills/ → .claude/ loop)
│   │
│   ├── rules/                        # Project governance
│   │   ├── backend.md               # Backend rules
│   │   ├── search.md                # Research priority rules
│   │   ├── openclaw-audio-governance.md  # Audio pipeline rules
│   │   └── REVIEW-SKILLS.md        # Review skill hierarchy
│   │
│   ├── hooks/                        # Event-driven automation
│   │   ├── PreToolUse-Bash-validate.bash   # Validate dangerous Bash
│   │   └── PreToolUse-Edit-validate.bash  # Validate dangerous Edit
│   │
│   ├── agents/                       # Specialist agents
│   │   ├── architect-specialist.md
│   │   ├── backend-specialist.md
│   │   ├── bug-fixer.md
│   │   ├── code-reviewer.md
│   │   ├── debugger.md
│   │   ├── devops-specialist.md
│   │   ├── documentation-writer.md
│   │   ├── feature-developer.md
│   │   ├── frontend-specialist.md
│   │   ├── mobile-specialist.md
│   │   ├── orchestrator.md
│   │   ├── performance-optimizer.md
│   │   ├── refactoring-specialist.md
│   │   ├── security-auditor.md
│   │   ├── test-writer.md
│   │   └── database-specialist.md
│   │
│   ├── workflows/                   # Local workflows (minimal)
│   │   └── examples/
│   │
│   ├── tools/                        # Custom tool definitions
│   ├── scheduled_tasks.json          # Cron scheduling
│   └── scheduled_tasks.lock
│
├── .agent/                           # Antigravity Kit (EXTERNAL, do not modify)
├── scripts/                          # Shell utilities (moved from hooks/helpers)
│   ├── sync-env.js                   # Environment synchronization
│   ├── validate-secrets.sh           # Pre-push secret validation
│   └── health-check.sh              # Health check utilities
│
├── apps/                            # Application code
├── packages/                         # Workspace packages
├── docs/                            # Documentation
│   └── specflow/                    # SPEC-driven development
│       ├── SPEC-013-UNIFIED-CLAUDE-AGENT-MONOREPO.md  # THIS FILE
│       └── SPEC-TEMPLATE.md
│
└── README.md
```

---

## Commands

### Unified Slash Commands (Project-Level)

All commands live in `.claude/commands/` and are auto-discovered by Claude Code.

| Command | File | Wraps | Purpose |
|---------|------|-------|---------|
| `/feature` | `feature.md` | `.agent/workflows/git-feature.md` | Create feature branch, implement, commit, PR |
| `/ship` | `ship.md` | `.agent/workflows/git-ship.md` | Commit + PR creation |
| `/turbo` | `turbo.md` | `.agent/workflows/git-turbo.md` | Commit + merge + tag + new branch |
| `/scaffold` | `scaffold.md` | `.agent/workflows/scaffold.md` | New project scaffolding |
| `/spec` | `spec.md` | skill `spec-driven-development` | Start spec-driven development |
| `/plan` | `plan.md` | skill `spec-driven-development` | Break work into tasks |
| `/pg` | `pg.md` | skill `pipeline-gen` | Generate `pipeline.json` from SPECs |
| `/rr` | `rr.md` | `universal-code-review` skill | Generate `REVIEW-*.md` from commits |
| `/code-review` | `code-review.md` | skill `code-review` | Review latest N commits |
| `/sec` | `sec.md` | skill `secrets-audit` | Scan for exposed secrets |
| `/ss` | `ss.md` | skill `snapshot-safe` | ZFS snapshot before destructive ops |
| `/hg` | `hg.md` | skill `human-gates` | Identify human approval blockers |
| `/dv` | `dv.md` | skill `deploy-validate` | Pre-deploy validation |
| `/rs` | `rs.md` | skill `repo-scan` | Detect tasks in repo |
| `/commit` | `commit.md` | skill `commit-message` | Semantic commit from staged changes |
| `/update-docs` | `update-docs.md` | skill `documentation` | Update project documentation |
| `/img` | `img.md` | skill `img` | Analyze image with LLaVA |
| `/test` | (built-in) | — | TDD workflow |
| `/review` | (built-in) | — | 5-axis code review |
| `/build` | (built-in) | — | Build verification |
| `/ship` | (built-in) | — | Pre-launch checklist |

### Workflow Wrappers

Commands in `.claude/commands/` are thin wrappers that invoke `.agent/workflows/`:

```markdown
# .claude/commands/feature.md
---
description: Create feature branch and implement
argument-hint: [feature-name]
---

Use the workflow in `.agent/workflows/git-feature.md`:
1. Create feature branch from main
2. Implement feature following spec
3. Run tests and lint
4. Create PR
```

---

## CI/CD Loop

### Gitea Actions Workflow: `.gitea/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    name: Type Check · Lint · Build · Test
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 0

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

      # ─── AI Review Gate ───────────────────────────────────────────────
      - name: Run AI Code Review
        if: github.event_name == 'pull_request'
        env:
          CLAUDE_API_KEY: ${{ secrets.CLAUDE_API_KEY }}
        run: |
          claude -p --print "Review the PR changes for:
          - Code quality and correctness
          - Security vulnerabilities
          - Performance issues
          - Best practices compliance
          Focus on: ${{ github.event.pull_request.title }}" \
          --output-format text --force

      - name: Post AI Review Comment
        if: github.event_name == 'pull_request'
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

### Gitea Actions Workflow: `.gitea/workflows/deploy.yml`

```yaml
name: Deploy to Coolify

on:
  push:
    branches: [main]
    paths:
      - 'apps/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Deployment environment'
        required: true
        default: 'production'

env:
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
            python3 -c "import sys,json; data=json.load(sys.stdin); [print(a['uuid']) for a in data.get('data',[]) if 'perplexity' in a.get('name','').lower()]")
          echo "App UUID: $APP_UUID"
          echo "app_uuid=$APP_UUID" >> $GITHUB_ENV

      - name: Trigger Deploy
        run: |
          curl -s -w "\n%{http_code}" -X POST \
            "${{ secrets.COOLIFY_URL }}/api/v1/applications/${{ env.app_uuid }}/deploy" \
            -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}" \
            -H "Content-Type: application/json"

      - name: Wait for Deploy
        run: |
          ELAPSED=0
          while [[ $ELAPSED -lt $HEALTH_TIMEOUT ]]; do
            STATUS=$(curl -s "${{ secrets.COOLIFY_URL }}/api/v1/applications/${{ env.app_uuid }}" \
              -H "Authorization: Bearer ${{ secrets.COOLIFY_API_KEY }}" | \
              python3 -c "import sys,json; print(json.load(sys.stdin).get('status',''))" 2>/dev/null || echo "unknown")
            echo "[$ELAPSED s] Status: $STATUS"
            [[ "$STATUS" == "running" ]] && exit 0
            sleep $HEALTH_INTERVAL
            ELAPSED=$((ELAPSED + HEALTH_INTERVAL))
          done
          exit 1

      - name: Smoke Test
        run: |
          curl -s -o /dev/null -w "%{http_code}" --max-time 15 \
            "http://localhost:4004/_stcore/health" | grep -q "200" && exit 0 || exit 1
```

### Human Gate Configuration

In Gitea repository settings → Environments, configure:

| Environment | Required reviewers | Approval gates |
|-------------|-------------------|----------------|
| `code-review` | 1+ (AI or human) | AI review must pass |
| `production` | 2+ | Manual approval required |

---

## Fixes Required

### 1. Remove Circular Symlink Chain

**Problem:** `.agent/` symlinks to `~/.claude/agent-skills/.claude/` which creates circular reference.

**Fix:**
```bash
# Check current symlink
ls -la /srv/monorepo/.agent/skills/

# Remove the circular chain — .agent/ should NOT reference .claude/ at all
# .agent/ is a standalone toolkit (Antigravity Kit)
# Only .claude/skills/ may symlink TO .agent/, never the reverse

# Verify no .agent/ → .claude/ symlinks exist
find /srv/monorepo/.agent -type l -exec ls -la {} \; 2>/dev/null
```

**Rule:** `.agent/` is external/standalone. `.claude/` may reference `.agent/` but not vice versa.

### 2. Deduplicate Skills

**Problem:** Skills exist in both `.claude/skills/` (project) and `~/.claude/skills/` (user).

**Current State:**
- `.claude/skills/` has 34 skills (many symlinks)
- `~/.claude/skills/` has 21 user-level skills

**Fix Strategy:**
| Skill Type | Location | Rationale |
|------------|----------|-----------|
| Project-specific skills | `.claude/skills/` | Bind to this repo |
| Reusable/generic skills | `~/.claude/skills/` | User's personal toolkit |
| Shared skills (agent-skills package) | symlinked from `~/.claude/agent-skills/skills/` | One canonical location |

**Action:**
```bash
# Audit skills in both locations
comm -12 <(ls .claude/skills/ | sort) <(ls ~/.claude/skills/ | sort)

# Keep project-specific in .claude/skills/
# Keep reusable in ~/.claude/skills/
# Remove duplicates from .claude/skills/ if already in user-level
```

### 3. Archive Session Data

**Problem:** `~/.claude/projects/-srv-monorepo/` is 147MB — too large for performance.

**Fix:**
```bash
# Archive old session data (keep recent, archive ancient)
cd ~/.claude/projects/-srv-monorepo/

# Check session sizes
du -sh memory/ sessions/ 2>/dev/null

# Archive sessions older than 30 days
find sessions/ -type f -mtime +30 -exec gzip {} \;

# Or prune via context-prune skill
claude -p "Run context-prune to clean old sessions"
```

### 4. Remove Deprecated Workflows

**Problem:** `.github/workflows/` exists as GitHub mirror — maintenance burden.

**Decision:** Keep only `.gitea/workflows/` (Gitea is primary). Document that `.github/` is deprecated.

---

## Boundaries

### AI Can Do (Autonomous)

| Action | Constraint |
|--------|------------|
| Create feature branch | From `main` only |
| Write code | Within feature branch |
| Write tests | TDD pattern encouraged |
| Commit to feature branch | With semantic message |
| Create PR | With description |
| Run AI review on PR | Per `ai-review.yml` |
| Trigger CI pipeline | Via Gitea Actions API |
| Update docs | Within same PR |

### Human Must Approve

| Action | Gate |
|--------|------|
| Merge to `main` | Environment protection |
| Deploy to production | 2+ approvals |
| Delete branch | Manual only |
| Modify CI/CD workflow | Explicit approval |
| Change secrets | Via Infisical (audit logged) |
| ZFS operations | Snapshot first |
| Network/port changes | Network governance |

### AI Never Does

| Forbidden Action | Reason |
|-----------------|--------|
| Push directly to `main` | Bypass human gate |
| Merge without approval | Violates CI/CD policy |
| Delete branches | Data loss risk |
| Modify `secrets/` | Credential exposure |
| Wipe data | Destructive operation |
| Expose ports publicly | Network governance violation |

---

## Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| SC-1 | AI can create feature branch and commit code | Run `/feature` command, verify branch + commit |
| SC-2 | AI can create PR with description | Check GitHub/Gitea PR created |
| SC-3 | AI review runs on every PR | Gitea Actions logs show `ai-review` job |
| SC-4 | Human gate blocks direct `main` merges | Attempt merge without approval, verify block |
| SC-5 | CI pipeline passes on feature branch | Gitea Actions green checkmark |
| SC-6 | Deploy triggers on `main` push | Coolify receives deploy API call |
| SC-7 | Smoke test passes after deploy | Health endpoint returns 200 |
| SC-8 | No circular symlinks remain | `find .agent/ -type l` returns empty |
| SC-9 | Session data < 50MB | `du -sh ~/.claude/projects/-srv-monorepo/` |
| SC-10 | All skills are accessible | Claude Code `/help` shows all commands |

---

## Open Questions

| # | Question | Impact | Priority |
|---|----------|--------|----------|
| OQ-1 | Should `.agent/` be symlinked or copied into repo? | Currently external — harder to version control | High |
| OQ-2 | Cursor CLI vs Claude Code for CI agent? | Cursor has `POST /v0/agents` cloud API | High |
| OQ-3 | Max branch lifetime for AI-generated branches? | Git hygiene vs AI flexibility | Medium |
| OQ-4 | Weekly batch review vs continuous per-PR? | Currently per-PR, maybe add weekly | Low |

---

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-08 | Use `.claude/commands/` wrappers to invoke `.agent/workflows/` | Thin wrappers maintain separation of concerns |
| 2026-04-08 | AI review gate on PR, not on push | Reduces noise, focuses on changes |
| 2026-04-08 | Human gate for `main` merges only | Balances autonomy and safety |
| 2026-04-08 | Keep only `.gitea/workflows/` (Gitea primary) | Remove `.github/` maintenance burden |
| 2026-04-08 | Archive sessions > 30 days old | Reduce 147MB to < 50MB |
| 2026-04-08 | Remove circular `.agent/` → `agent-skills/.claude/` symlink | `.agent/` is standalone, no reverse references |

---

## Non-Goals

- This spec does NOT cover multi-region deployment
- Does NOT cover database migrations in CI/CD
- Does NOT cover AI model fine-tuning or training
- Does NOT cover compliance/audit pipelines (SOC2, etc.)
- Does NOT modify `.agent/` contents (it's external Antigravity Kit)

---

## Checklist

- [ ] SPEC written and reviewed
- [ ] Circular symlink removed from `.agent/`
- [ ] Skills deduplicated between `.claude/` and `~/.claude/`
- [ ] Session data archived (target < 50MB)
- [ ] `.github/workflows/` deprecated (document)
- [ ] Human gates configured in Gitea environments
- [ ] AI review workflow tested with test PR
- [ ] Commands tested end-to-end (`/feature`, `/ship`, `/turbo`)
- [ ] Tasks generated via `/pg`

---

**Last updated:** 2026-04-08
**Sources:** SPEC-013, SPEC-014, SPEC-015, Agent #4 audit findings