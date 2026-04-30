# Contributing Guide

**Project:** Nexus + Vibe-Kit Autonomous Execution Framework
**Last Updated:** 2026-04-30

---

## 1. Overview

### What is Nexus?

Nexus is a 7×7 agent harness — 7 modes, 7 agents per mode, 49 agents total. It orchestrates autonomous work using a structured workflow (PREVC) and parallel worker execution (vibe-kit).

```
Nexus = vibe-kit (loop runner) + PREVC (workflow) + 49 agents (execution)
```

### What is Vibe-Kit?

Vibe-Kit is the autonomous execution layer. It runs multiple Claude Code workers in parallel via `mclaude`, pulling tasks from a queue and iterating until all tasks pass smoke tests.

```
PRD → SPEC.md → queue.json → run-vibe.sh → 15× mclaude workers → PR
```

**Core primitives:**
- `COMMIT` — checkpoint progress
- `BRANCH` — fresh context per task
- `CONTEXT` — reset LLM context between tasks
- `RETRY` — retry failed task (max 3)

### Project Structure

```
/srv/monorepo/
├── .claude/vibe-kit/           # Vibe-Kit core
│   ├── nexus.sh                # Entry point (7 modes)
│   ├── run-vibe.sh             # Worker loop executor
│   ├── queue-manager.py        # Atomic queue with flock
│   ├── state-manager.py        # Phase state tracker
│   ├── context/                # Per-task context isolation
│   ├── agents/                 # 49 agent system-prompts
│   └── logs/                   # Worker execution logs
├── docs/SPECS/                 # Active specifications
├── scripts/vibe/               # vibe-kit supporting scripts
└── .gitea/workflows/           # Gitea CI (agent-loop.yml)
```

---

## 2. Quick Start — 5 Steps

### Step 1: Understand the System

```bash
# List all modes
nexus.sh --mode list

# View a specific mode's agents
nexus.sh --mode test
nexus.sh --mode debug

# See what a specific agent does
nexus.sh --mode backend --agent api-developer
```

### Step 2: Create a Specification

Every task starts with a SPEC. Create `docs/SPECS/SPEC-XXX.md`:

```bash
# Start with the template
cp docs/PRDs/PRD-template.md docs/SPECS/SPEC-XXX.md
```

The SPEC must include an **execution block** at the bottom:

```yaml
execution:
  max_workers: 5
  rate_limit_rpm: 500
  context_window_reset: true
  ci_retry_loop: true
  max_retries: 3
  smoke_threshold: PASS
  snapshot_interval: 3
  phases: [plan, do, verify]
```

### Step 3: Initialize the Workflow

```bash
# Plan phase — creates queue.json from SPEC
nexus.sh --spec SPEC-XXX --phase plan

# Review phase — risk assessment
nexus.sh --spec SPEC-XXX --phase review

# Execute phase — launch workers
nexus.sh --spec SPEC-XXX --phase execute --parallel 15

# Verify phase — run test suite
nexus.sh --spec SPEC-XXX --phase verify

# Complete phase — deploy + PR
nexus.sh --spec SPEC-XXX --phase complete
```

### Step 4: Monitor Progress

```bash
# Watch queue state
cat .claude/vibe-kit/queue.json | jq '{done: .done, failed: .failed, pending: .pending}'

# Tail worker logs
tail -f .claude/vibe-kit/logs/worker-01.log

# Check running workers
pgrep -fa "mclaude.*MiniMax"
```

### Step 5: Verify and Ship

```bash
# Run smoke tests
bash scripts/smoke-runner.sh

# Run full test suite
bun test

# Run typecheck
bunx tsc --noEmit

# Commit and push
git add -A && git commit -m "feat: description"
git push origin HEAD
```

---

## 3. Architecture Overview

```
                    ┌─────────────────────────────────────┐
                    │            Human (Approval)         │
                    └──────────────────┬──────────────────┘
                                       │ PRD approved
                                       ▼
                    ┌─────────────────────────────────────┐
                    │         SPEC.md + Execution Block   │
                    │         (single source of truth)    │
                    └──────────────────┬──────────────────┘
                                       │ plan phase
                                       ▼
                    ┌─────────────────────────────────────┐
                    │            queue.json               │
                    │         (atomic task queue)          │
                    └──────────────────┬──────────────────┘
                                       │ execute phase
                                       ▼
        ┌────────────────────────────────────────────────┐
        │         run-vibe.sh (worker loop)              │
        │                                                │
        │   ┌──────────┐  ┌──────────┐  ┌──────────┐   │
        │   │ Worker 1 │  │ Worker 2 │  │Worker N  │   │
        │   │ (mclaude)│  │ (mclaude)│  │(mclaude) │   │
        │   └────┬─────┘  └────┬─────┘  └────┬─────┘   │
        │        │             │             │           │
        │        └─────────────┼─────────────┘           │
        │                      ▼                         │
        │              context-reset.sh                  │
        │              (per-task isolation)              │
        └────────────────────┬───────────────────────────┘
                             │
                             ▼
                    ┌─────────────────────────────────────┐
                    │         Gitea CI (agent-loop.yml)    │
                    │         smoke test → pass/fail       │
                    └──────────────────┬──────────────────┘
                             │          │
                    ┌────────┘          └────────┐
                    ▼                             ▼
              PASS: complete              FAIL: retry (max 3)
                    │                             │
                    └─────────────┬───────────────┘
                                  ▼
                    ┌─────────────────────────────────────┐
                    │     notify-complete.sh (email)     │
                    └─────────────────────────────────────┘
```

### Key Files

| File | Purpose |
|------|---------|
| `nexus.sh` | Entry point — mode/agent selection, PREVC orchestration |
| `run-vibe.sh` | Worker loop — claims tasks, spawns mclaude, retries |
| `queue-manager.py` | Atomic queue with `fcntl.flock` (claim/complete/retry) |
| `state-manager.py` | Phase state tracker (plan/review/execute/verify/complete) |
| `context-reset.sh` | Resets LLM context per task (GCC-inspired) |
| `agent-loop.yml` | Gitea CI workflow — smoke tests + retry loop |
| `smoke-runner.sh` | Standardized smoke test runner (exit 0=PASS) |

---

## 4. Making Changes

### Before Any Structural Change

1. Read `/srv/ops/ai-governance/CONTRACT.md`
2. Check `/srv/ops/ai-governance/GUARDRAILS.md` for approval requirements
3. Create ZFS snapshot:

```bash
sudo zfs snapshot -r tank@pre-$(date +%Y%m%d-%H%M%S)-reason
```

### Workflow for New Features

```bash
# 1. Create feature branch
git checkout -b feat/my-feature

# 2. Make changes following code standards (see Section 5)

# 3. Run validation
bunx tsc --noEmit
bun test

# 4. Commit using conventional commits
git commit -m "feat: add my feature"

# 5. Push and create PR
git push -u origin feat/my-feature
gh pr create --title "feat: add my feature" --body "## Summary\n- Added new feature\n\n## Test plan\n- [ ] Unit tests\n- [ ] Smoke tests"
```

### Using Nexus for Development

```bash
# Debug mode — when something breaks
nexus.sh --mode debug --agent log-diagnostic

# Test mode — write tests first
nexus.sh --mode test --agent unit-tester

# Review mode — before PR
nexus.sh --mode review --agent quality-scorer

# Deploy mode — Docker/Coolify
nexus.sh --mode deploy --agent coolify-deployer
```

### Context Reset (Per-Task Isolation)

When modifying vibe-kit or nexus scripts, remember:

- **Each task gets fresh context** — no history carryover between tasks
- **Context is stored in** `.claude/vibe-kit/context/<task_id>/`
- **To reset manually:**
  ```bash
  bash scripts/context-reset.sh <task_id>
  ```

---

## 5. Code Standards

### Language Convention

| Type | Language | Example |
|------|----------|---------|
| Source code (`.ts`, `.py`, `.go`) | English | `getUserById()` |
| Functions and methods | English | `fetchContext()` |
| Variables | English | `userId`, `isAuthenticated` |
| Types and interfaces | English (PascalCase) | `UserProfile`, `AuthConfig` |
| Files | English (kebab-case) | `auth-service.ts` |
| Documentation (`.md` in `docs/`) | English | This guide |
| Commit messages | English (conventional) | `feat: add user authentication` |

### TypeScript

- **Strict mode enabled** globally
- **No `any`** — use `unknown` and narrow appropriately
- **Use Zod** for runtime validation (shared via `packages/zod-schemas`)

```typescript
// ❌ BAD
const data: any = response.json();

// ✅ GOOD
const data = response.json() as unknown as UserProfile;
// Or use Zod schema validation
```

### Formatting and Linting

```bash
# Format all files
bun run format

# Lint all files
bun run lint

# Typecheck
bunx tsc --noEmit
```

### Testing Standards

All smoke tests follow this contract:

```bash
# Exit code 0 = PASS, non-zero = FAIL
# No output on PASS (silence is gold)
# On FAIL: print reason to stderr

./smoke_test.sh
echo $?  # 0 = pass, 1+ = fail
```

| Smoke Test | Command | Exit Code |
|------------|---------|-----------|
| Health | `curl -sf http://$HOST/health \| grep OK` | 0=pass |
| Lint | `bun run lint 2>&1 \| tail -1` | 0=pass |
| Typecheck | `bunx tsc --noEmit 2>&1 \| tail -1` | 0=pass |
| Test | `bun test 2>&1 \| tail -1` | 0=pass |

### Commit Message Format

Use Conventional Commits:

```
<type>: <description>

[optional body]
```

**Types:**
| Type | Description |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `docs` | Documentation only changes |
| `chore` | Changes to build process or auxiliary tools |

**Examples:**
```
feat: add user authentication via JWT
fix: resolve race condition in connection pool
docs: update API documentation for /users endpoint
refactor: extract validation logic into separate module
```

---

## 6. Pull Request Process

### 1. Branch Creation

```bash
# Create feature branch from main
git checkout main
git pull origin main
git checkout -b feat/my-feature

# Or use turbo workflow (commit → push → merge → tag → new branch)
bash scripts/turbo.sh
```

### 2. Development

1. Make changes following coding standards (Section 5)
2. Run validation before committing:
   ```bash
   bunx tsc --noEmit
   bun test
   bun run lint
   bash scripts/smoke-runner.sh
   ```
3. Update documentation if needed
4. Commit using conventional commit format

### 3. Pull Request

```bash
# Push branch
git push -u origin feat/my-feature

# Create PR using gh cli
gh pr create \
  --title "feat: add my feature" \
  --body "## Summary
- Added new feature

## Test plan
- [ ] Unit tests
- [ ] Integration tests
- [ ] Smoke tests

## Related
- SPEC: SPEC-XXX
- ADR: ADR-XXX (if applicable)"
```

### 4. CI Gates

The Gitea `agent-loop.yml` workflow runs:

```yaml
jobs:
  lint:    # pnpm lint / bun run lint
  test:    # pnpm test / bun test
  smoke:   # bash scripts/smoke-runner.sh
```

All three must pass before merge.

### 5. Review

- Link related SPECs/ADRs in the PR description
- Ensure all CI checks pass
- Update based on code review feedback
- Use `nexus.sh --mode review` for automated review agents

### 6. Merge Strategy

```
LOW complexity (lint fix, typo):  → Never call human. Smoke pass = done.
MED complexity (new function):     → If 3 retries failed → call human.
HIGH complexity (API endpoint):    → Human gate at T00 (PRD) and Final.
```

---

## Related Documentation

- [NEXUS_GUIDE.md](/srv/monorepo/docs/NEXUS_GUIDE.md) — Full Nexus reference (7 modes, 49 agents)
- [BLUEPRINT-AUTONOMOUS-PIPELINE-V2.md](/srv/monorepo/docs/PRDs/BLUEPRINT-AUTONOMOUS-PIPELINE-V2.md) — Vibe-Kit execution architecture
- [ARCHITECTURE.md](/srv/monorepo/docs/ARCHITECTURE.md) — System architecture
- [RUNBOOK.md](/srv/monorepo/docs/RUNBOOK.md) — Recovery procedures
- [SECRETS-PATTERNS.md](/srv/monorepo/docs/OPERATIONS/SECRETS-PATTERNS.md) — Secret management