# CLI Shortcuts Reference

> **Purpose:** All `/` slash commands available in Claude Code, plus shell aliases for the monorepo.
> **Location:** `/srv/monorepo/docs/CLI-SHORTCUTS.md`

---

## Claude Code Slash Commands

These are the built-in slash commands available in Claude Code CLI. They invoke skills and workflows.

### Core Workflow Commands

| Command | What It Does | When to Use |
|---------|--------------|-------------|
| `/spec` | Start spec-driven development — write a structured SPEC-*.md before writing code | Beginning a new feature, project, or significant change with no specification yet |
| `/plan` | Break work into small verifiable tasks with acceptance criteria and dependency ordering | After you have a spec and need to plan implementation steps |
| `/pg` | Generate pipeline.json from SPECs in `docs/SPECS/SPEC-*.md` | After writing 3+ specs, extract all tasks into a unified pipeline |
| `/rr` | Generate a code review report (REVIEW-*.md) | Before committing significant changes, to catch issues |
| `/se` | Scan code for exposed secrets before git push (ghp_, gho_, ghu_, ghs_, etc.) | Before any `git push` — mandatory safety gate |
| `/hg` | Identify tasks blocked by human-approval gates | When you hit a blocker and need to know what requires human sign-off |
| `/img` | Analyze an image using LLaVA local via Ollama (or qwen2.5vl as fallback) | Inspecting screenshots, diagrams, or visual content in the codebase |

### Development Workflow Commands

| Command | What It Does | When to Use |
|---------|--------------|-------------|
| `/build` | Implement the next task incrementally — build, test, verify, commit | Executing a planned task from the pipeline |
| `/ship` | Run the pre-launch checklist and prepare for production deployment | When a feature is complete and ready to deploy |
| `/test` | Run TDD workflow — write failing tests, implement, verify | When working on bugs or adding new features test-first |
| `/review` | Conduct a 5-axis code review: correctness, readability, architecture, security, performance | Before merging or shipping any significant code |
| `/dv` | Full pre-deploy validation: health checks, ZFS snapshot, smoke tests, dependencies | Before any deploy to production or staging |
| `/commit` | View staged changes (`git diff --staged`) and create a semantic commit message | Ready to commit — generates a proper conventional commit |
| `/turbo` | Commit, merge to main, tag, and create new feature branch in one safe flow | When you need to move fast but safely through the full cycle |

### Agent & Skill Commands

| Command | What It Does | When to Use |
|---------|--------------|-------------|
| `/bug-investigation` | Systematic bug investigation and root cause analysis | When you encounter a bug and need structured debugging |
| `/test-generation` | Generate comprehensive test cases for code | After implementing a feature that lacks tests |
| `/refactoring` | Safe code refactoring with step-by-step approach | Improving existing code without changing behavior |
| `/documentation` | Generate and update technical documentation | Creating or updating docs for a feature |
| `/feature-breakdown` | Break down features into implementable tasks | Starting a large feature that needs decomposition |
| `/pr-review` | Review pull requests against team standards | Reviewing PRs from others or self-review before merge |
| `/code-review` | Ask for number of commits to check, then review each | Doing a historical code review across recent commits |
| `/sec` | Scan code for exposed secrets (secrets-audit skill) | Same as `/se` — mandatory before push |
| `/ss` | Create ZFS snapshot before destructive operations | Before deploy, rollback, or schema changes |
| `/rs` | Detect tasks in multiple formats (TASKMASTER JSON, PRD Markdown, ADR) | Scanning the repo for existing task definitions |
| `/scaffold` | Read and execute the scaffold workflow | Starting a new project or package within the monorepo |
| `/feature` | Read and execute the git-feature workflow | Creating a new feature branch with proper structure |
| `/loop` | Run a prompt on a recurring interval | Setting up a recurring task or status poll |

### Context & Memory Commands

| Command | What It Does | When to Use |
|---------|--------------|-------------|
| `/md` | Sleep mode: scan SPECs and generate pipeline automatically | Scheduled task (runs at 3am) to process pending specs |
| `/next-task` | Execute tasks from the first phase in TODO.md one by one | Working through a prioritized TODO list |
| `/update-docs` | Update instructions, architecture info, and coding guidelines | Keeping project documentation current |
| `/context-prune` | Clean old sessions from memory-keeper | Clearing stale memory to save space |

---

## Git Aliases (Shell)

Add these to `~/.bashrc` or `~/.zshrc` for fast git operations.

```bash
# Push current branch to both Gitea and GitHub remotes
alias gpush='git push --force-with-lease gitea HEAD && git push --force-with-lease origin HEAD'

# Check SSH + remote status
alias gstatus='git remote -v && ssh -o BatchMode=yes -o ConnectTimeout=3 git@127.0.0.1 -p 2222 echo "Gitea SSH: OK" 2>/dev/null || echo "Gitea SSH: FAIL"'

# Quick commit with auto-detected scope
alias gcommit='git add -A && git diff --cached --stat && git commit'

# Common dev shortcuts
alias gs='git status'
alias ga='git add'
alias gc='git commit'
alias gp='git push'
alias gl='git log --oneline -10'
alias gd='git diff'
alias gco='git checkout'
alias gb='git branch'
```

---

## Mirror Push (Gitea + GitHub)

Since the monorepo has two remotes (Gitea at `ssh://git@127.0.0.1:2222` and GitHub at `git@github.com`), use this flow:

```bash
# 1. Verify remotes
git remote -v

# 2. Verify SSH to Gitea
ssh -o BatchMode=yes -o ConnectTimeout=5 git@127.0.0.1 -p 2222 echo "OK"

# 3. Push to both
git push --force-with-lease gitea HEAD && git push --force-with-lease origin HEAD

# 4. Optional: create PR on GitHub
gh pr create --title "feat: your feature" --base main --body "## Summary"
```

Or use the script:
```bash
bash /srv/monorepo/scripts/mirror-push.sh
```

---

## Claude Code Context Switcher

| Context | What It Sets Up |
|---------|-----------------|
| `/srv/monorepo` | Standard monorepo dev context (AGENTS.md rules) |
| `docs/GOVERNANCE/` | Host governance context — required before infra changes |
| `~/.claude/rules/` | User-specific rules and skills |

---

## Quick Command Reference

```
/spec          → Start new feature with SPEC
/plan          → Break work into tasks
/pg            → Generate pipeline from SPECs
/rr            → Generate code review
/se            → Secrets audit (before push!)
/hg            → Find human-approval blockers
/img          → Analyze image with LLaVA
/build         → Implement next task
/ship          → Pre-launch checklist
/test          → TDD workflow
/review        → 5-axis code review
/dv            → Pre-deploy validation
/commit        → Semantic commit message
/turbo         → Commit + merge + tag + new branch
```

---

**Last updated:** 2026-04-08
**Maintainer:** will
