# ARCHITECTURE-MASTER — Unified Monorepo Architecture

**Date:** 2026-04-08
**Status:** APPROVED
**Author:** Architect Specialist Agent

---

## 1. Current State Analysis

### 1.1 What Exists Where

```
/srv/monorepo/
├── .github/workflows/          # GitHub Actions CI/CD
│   ├── ci.yml                 # Type check · lint · build · test
│   └── deploy-perplexity-agent.yml
│
├── .gitea/workflows/          # Gitea Actions (mirror/DR)
│   └── deploy-perplexity-agent.yml  # Near-identical to GitHub version
│
├── .agent/                    # Antigravity Kit — committed agent defs
│   ├── agents/                # 18 agent descriptors (architect, backend, etc.)
│   ├── skills/                # Domain skills (api-patterns, database-design, etc.)
│   │   └── [skill-name]/SKILL.md
│   └── workflows/             # Agent-executable workflows
│       ├── SKILL.md (10 skills)  # Phase-tagged stubs: phases: [E, C] etc.
│       ├── git-ship.md        # Full workflow (not a SKILL.md)
│       ├── git-turbo.md
│       ├── git-feature.md
│       ├── git-mirror-gitea-github.md
│       ├── scaffold.md
│       ├── sincronizar-tudo.md
│       ├── debug.md
│       └── ui-ux-pro-max.md
│
├── .claude/                   # User-level config — gitignored
│   ├── agents/                # Personal agents (21 files)
│   ├── commands/              # 16 slash-command shortcuts
│   │   ├── ship.md            # → invokes .agent/workflows/git-ship.md
│   │   ├── turbo.md           # → invokes .agent/workflows/git-turbo.md
│   │   ├── feature.md         # → invokes .agent/workflows/git-feature.md
│   │   ├── pg.md              # pipeline-gen skill
│   │   ├── sec.md             # secrets-audit skill
│   │   ├── dv.md              # deploy-validate skill
│   │   ├── rs.md              # repo-scan skill
│   │   ├── ss.md              # snapshot-safe skill
│   │   ├── hg.md              # human-gates skill
│   │   ├── img.md             # vision-local skill
│   │   └── ...
│   ├── skills/                # 25+ full skills with references/
│   │   ├── secrets-audit/
│   │   ├── mcp-health/
│   │   ├── pipeline-gen/
│   │   ├── spec-driven-development/
│   │   └── ... (all full markdown, not stubs)
│   ├── scheduled_tasks.json   # 9 cron jobs
│   ├── hooks/pre-commit       # Secrets audit on commit
│   ├── workflows/examples/
│   └── rules/                 # backend.md, search.md, openclaw-audio-governance.md
│
├── docs/
│   ├── specflow/              # SPEC-driven development
│   │   ├── SPEC-README.md
│   │   ├── SPEC-TEMPLATE.md
│   │   ├── SPEC-001-template-fusionado.md   [COMPLETED]
│   │   ├── SPEC-001-workflow-performatico.md [DRAFT]
│   │   ├── SPEC-002-homelab-network-refactor.md [DRAFT]
│   │   ├── SPEC-004-kokoro-tts-kit.md
│   │   ├── SPEC-005-wav2vec2-stt-kit.md
│   │   ├── SPEC-006-playwright-e2e.md
│   │   ├── SPEC-009-openclaw-persona-audio-stack.md [PROTECTED]
│   │   ├── discovery.md
│   │   ├── tasks.md
│   │   └── reviews/
│   │       ├── REVIEW-GUIDE.md
│   │       ├── REVIEW-001-openclaw-voice-pipeline.md
│   │       └── REVIEW-smoke-tests-20260407.md
│   │
│   ├── ADRs/                  # Architecture Decision Records — CONSOLIDATED
│   │   ├── README.md
│   │   ├── TEMPLATE.md
│   │   ├── 0000-0010/         # Legacy (preserved for git history)
│   │   ├── 2024-series/       # Legacy (preserved)
│   │   ├── 2026-series/       # Active: 20260317, 20260404
│   │   └── 001-series/       # Active: 001, 002
│   │
│   ├── GOVERNANCE/            # Security, contracts, change policy
│   ├── INFRASTRUCTURE/         # Network, ports, subdomains, partitions
│   ├── OPERATIONS/SKILLS/     # Host-level operational skills (ZFS, Docker, etc.)
│   ├── MCPs/                  # MCP server documentation
│   └── guides/                # gitea-coolify, openclaw, security, etc.
│
└── apps/                      # Application code (backend, frontend, etc.)
```

### 1.2 Problems Identified

| Problem | Severity | Evidence |
|---------|----------|----------|
| **Duplicate CI deploy workflows** | HIGH | `.gitea/` and `.github/` have near-identical deploy-perplexity-agent.yml |
| **Skills duality** | MEDIUM | `.agent/workflows/*.md` are full workflows; `.agent/workflows/*/SKILL.md` are stubs with only frontmatter (`phases: [E, C]`) |
| **ADR fragmentation** | MEDIUM | ADRs exist in `docs/adr/`, `docs/ADR/`, `docs/ADRs/` — three locations |
| **Commands → Workflows opaque mapping** | MEDIUM | `.claude/commands/ship.md` invokes `.agent/workflows/git-ship.md` but no formal registry |
| **SPEC numbering collision** | LOW | Two `SPEC-001-*` files exist |
| **OPERATIONS/SKILLS vs .claude/skills** | LOW | Host-level skills in `docs/` vs user-level skills in `.claude/` — unclear boundary |
| **Protected SPECs not machine-enforced** | MEDIUM | `SPEC-009-openclaw-persona-audio-stack.md` marked PROTECTED but no hook prevents editing |

### 1.3 Interlocking Diagram — CI/CD + Agent Workflows

```
┌─────────────────────────────────────────────────────────────────────┐
│                         DEVELOPER / CLAUDE CODE                      │
└─────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
         [.claude/commands/]               [.agent/workflows/]
         /ship → git-ship.md               git-ship.md (full)
         /turbo → git-turbo.md             git-turbo.md (full)
         /feature → git-feature.md         git-feature.md (full)
         /mirror → git-mirror-...md        git-mirror-...md (full)
                    │                               │
                    └───────────────┬───────────────┘
                                    ▼
                        git commit --semantic
                                    │
                                    ▼
                    ┌────────────────────────────────┐
                    │  .github/workflows/ci.yml       │  ← ALWAYS (on push/PR)
                    │  Type Check · Lint · Build ·    │
                    │  Test                          │
                    └────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    ▼                               ▼
         [main branch]                     [feature branch]
                    │                               │
                    ▼                               ▼
         ┌──────────────────┐          ┌──────────────────────────┐
         │ .github/workflows/│          │ gh pr create             │
         │ deploy-perplexity │          │ .github/ or .gitea/      │
         │ -agent.yml        │          │ deploy-perplexity-agent  │
         └──────────────────┘          └──────────────────────────┘
                    │                               │
                    ▼                               ▼
         Coolify API deploy            Coolify API deploy (Gitea runner)
                    │                               │
                    └──────────────┬─────────────────┘
                                   ▼
                        Health check + Smoke test
                                   │
                                   ▼
                        Telegram alert (OpenClaw)
```

---

## 2. Proposed Unified Structure

### 2.1 Canonical Locations (Single Source of Truth)

| Concern | Canonical Location | Notes |
|---------|-------------------|-------|
| **CI/CD** | `.github/workflows/` | GitHub Actions is primary. Gitea workflows become mirror/DR. |
| **Agent Workflows (full)** | `.agent/workflows/` | These ARE the executable workflows |
| **Slash Commands** | `.claude/commands/` | Thin wrappers that invoke `.agent/workflows/` |
| **Skills** | `.claude/skills/` | Full skills with references/. User-level, gitignored |
| **Domain Skills** | `.agent/skills/` | Proven skills that can be shared across users |
| **SPECs** | `docs/SPECS/SPEC-*.md` | One dir, sequential numbering |
| **ADRs** | `docs/ADRs/` | One dir, date-based 2026-series + 001-series |
| **Operational Skills** | `docs/OPERATIONS/SKILLS/` | Host-level runbooks, health checks |
| **Governance** | `docs/GOVERNANCE/` | Contracts, guardrails, change policy |

### 2.2 Skill Registry

`.claude/commands/` commands MUST declare their target explicitly:

```yaml
# .claude/commands/ship.md (example header)
---
name: ship
description: Intelligent delivery workflow
invokes: .agent/workflows/git-ship.md
---

# /ship — Entrega Inteligente
[full workflow content...]
```

**Registry of all slash commands:**

| Command | Invokes | Type |
|---------|---------|------|
| `/ship` | `.agent/workflows/git-ship.md` | workflow |
| `/turbo` | `.agent/workflows/git-turbo.md` | workflow |
| `/feature` | `.agent/workflows/git-feature.md` | workflow |
| `/mirror` | `.agent/workflows/git-mirror-gitea-github.md` | workflow |
| `/scaffold` | `.agent/workflows/scaffold.md` | workflow |
| `/debug` | `.agent/workflows/debug.md` | workflow |
| `/sincronizar` | `.agent/workflows/sincronizar-tudo.md` | workflow |
| `/pg` | `.claude/skills/pipeline-gen/SKILL.md` | skill |
| `/sec` | `.claude/skills/secrets-audit/SKILL.md` | skill |
| `/dv` | `.claude/skills/deploy-validate/SKILL.md` | skill |
| `/rs` | `.claude/skills/repo-scan/SKILL.md` | skill |
| `/ss` | `.claude/skills/snapshot-safe/SKILL.md` | skill |
| `/hg` | `.claude/skills/human-gates/SKILL.md` | skill |
| `/plan` | `.claude/skills/spec-driven-development/SKILL.md` | skill |
| `/spec` | `.claude/skills/spec-driven-development/SKILL.md` | skill |
| `/img` | `.claude/skills/vision-local.md` | skill |
| `/code-review` | `.agent/workflows/code-review/SKILL.md` | skill |
| `/test` | `.agent/workflows/test-generation/SKILL.md` | skill |
| `/pr-review` | `.agent/workflows/pr-review/SKILL.md` | skill |
| `/sec-audit` | `.agent/workflows/security-audit/SKILL.md` | skill |
| `/bug` | `.agent/workflows/bug-investigation/SKILL.md` | skill |
| `/refactor` | `.agent/workflows/refactoring/SKILL.md` | skill |
| `/docs` | `.agent/workflows/documentation/SKILL.md` | skill |

### 2.3 Unified Directory Tree (After Consolidation)

```
.claude/                        # User-level (gitignored)
├── commands/                   # Slash command registry
│   ├── ship.md               # invokes: .agent/workflows/git-ship.md
│   ├── turbo.md              # invokes: .agent/workflows/git-turbo.md
│   └── ...
├── skills/                    # Full user skills (gitignored)
│   ├── spec-driven-development/SKILL.md
│   ├── secrets-audit/SKILL.md
│   ├── pipeline-gen/SKILL.md
│   └── ...
└── scheduled_tasks.json

.agent/                        # Committed agent definitions
├── agents/                    # 18 agent descriptors
├── skills/                    # Domain skills (api-patterns, database-design, etc.)
│   └── [domain]/SKILL.md
└── workflows/                 # Agent-executable workflows
    ├── git-ship.md           # Full workflow (canonical)
    ├── git-turbo.md
    ├── git-feature.md
    ├── git-mirror-gitea-github.md
    ├── scaffold.md
    ├── debug.md
    ├── ui-ux-pro-max.md
    ├── sincronizar-tudo.md
    └── [phase-skills]/       # Phase-based skills (E, C, R, V, P)
        └── SKILL.md

.github/workflows/            # Canonical CI/CD
├── ci.yml                     # Type check · lint · build · test
└── deploy-perplexity-agent.yml
```

**Deprecated (remove after migration):**
- `.gitea/workflows/deploy-perplexity-agent.yml` — replaced by GitHub version

---

## 3. Shortcuts (/) Commands for Claude Code CLI

Slash commands are registered in `.claude/commands/`. All commands follow the pattern: invoke a workflow (`.agent/workflows/*.md`) or a skill (`.claude/skills/*/SKILL.md`).

### 3.1 Git Workflow Commands

| Command | Workflow | What it does |
|---------|----------|--------------|
| `/feature` | `git-feature.md` | Creates `feature/[adjetivo-substantivo]` branch |
| `/ship` | `git-ship.md` | Semantic commit + push + PR creation |
| `/turbo` | `git-turbo.md` | Commit + merge main + tag + new feature branch |
| `/mirror` | `git-mirror-gitea-github.md` | Push current branch to Gitea AND GitHub |
| `/sincronizar` | `sincronizar-tudo.md` | Quick commit + push with semantic message |

### 3.2 Spec-Driven Development Commands

| Command | Skill/Workflow | What it does |
|---------|----------------|--------------|
| `/spec` | `spec-driven-development/SKILL.md` | Start SPEC-driven workflow: SPECIFY → PLAN → TASKS → IMPLEMENT → REVIEW → SHIP |
| `/plan` | `spec-driven-development/SKILL.md` | Create SPEC from requirements |
| `/pg` | `pipeline-gen/SKILL.md` | Generate `pipeline.json` from SPECs in `docs/SPECS/` |
| `/rs` | `repo-scan/SKILL.md` | Detect tasks in TASKMASTER/PRD/ADR formats |

### 3.3 Quality Assurance Commands

| Command | Skill | What it does |
|---------|-------|--------------|
| `/code-review` | `code-review/SKILL.md` | 5-axis code review (correctness, readability, architecture, security, performance) |
| `/pr-review` | `pr-review/SKILL.md` | Review PR against team standards |
| `/test` | `test-generation/SKILL.md` | Generate comprehensive test cases |
| `/bug` | `bug-investigation/SKILL.md` | Systematic 4-phase debugging |
| `/refactor` | `refactoring/SKILL.md` | Step-by-step safe refactoring |
| `/sec` | `secrets-audit/SKILL.md` | Scan for exposed secrets before push |

### 3.4 Infrastructure / Operations Commands

| Command | Skill | What it does |
|---------|-------|--------------|
| `/ss` | `snapshot-safe/SKILL.md` | ZFS snapshot before destructive operations |
| `/dv` | `deploy-validate/SKILL.md` | Pre-deploy health validation |
| `/hg` | `human-gates/SKILL.md` | Identify blockers requiring human approval |
| `/img` | `vision-local.md` | Analyze image with LLaVA local (ollama) |

### 3.5 Developer Experience Commands

| Command | Skill | What it does |
|---------|-------|--------------|
| `/scaffold` | `scaffold.md` | Generate full-stack module (Zod + Orchid ORM + tRPC + React) |
| `/debug` | `debug.md` | Systematic problem investigation |
| `/sec-audit` | `security-audit/SKILL.md` | Security review checklist |

---

## 4. Git Workflow Patterns

### 4.1 `/ship` — Intelligent Delivery

```
feature/[name] → commit (semantic) → push → PR → CI → deploy
```

**When to use:** Feature is complete and ready for review.
**Blocking condition:** CI must pass before merge.

**Flow:**
1. Diagnose: `git status`, `git diff --stat HEAD`
2. Stage: `git add -A` (protected by `.gitignore`)
3. Commit: `[type(scope)]: [specific description]` + Co-Authored-By
4. Push: `git push --force-with-lease origin HEAD`
5. PR: `gh pr create` (if not exists)
6. Report: PR URL + commit hash

### 4.2 `/turbo` — Fast Forward

```
feature/[name] → commit → merge main → tag → new feature branch
```

**When to use:** Rapid iteration when you need to checkpoint and keep moving.
**Warning:** Merges directly to main. Use only on low-risk changes.

**Flow:**
1. `git add -A`
2. Creative commit: `chore([scope]): [verb] [noun]`
3. Push current branch
4. `git checkout main && git pull && git merge --no-ff [branch]`
5. Tag: `v0.[n].[n]-[codename]`
6. New feature branch: `feature/[adjetivo-substantivo]`

### 4.3 `/feature` — Branch Creation

```
main → feature/[adjetivo-substantivo]
```

**Naming convention:** `[adjetivo-substantivo]` — senior-technical tone.
**Examples:** `quantum-dispatch`, `iron-codex`, `stellar-pivot`, `neon-sentinel`

**Flow:**
1. Check uncommitted changes (warn if any)
2. Generate name from approved vocabulary
3. `git checkout -b feature/[name]`
4. `git push -u origin feature/[name]`
5. Report next steps

### 4.4 `/mirror` — Dual Remote Sync

```
feature/[name] → Gitea + GitHub simultaneously
```

**Remotes:**
- `gitea`: `ssh://git@127.0.0.1:2222/will-zappro/monorepo.git`
- `origin`: `git@github.com:zapprosite/monorepo.git`

**Never mirror:** `main` or `master` directly.
**Always use:** `--force-with-lease` (not `--force`).

---

## 5. How .gitea + .github + .agent Workflows Interlock

### 5.1 CI Gate (Always Runs)

```
Any push to any branch → .github/workflows/ci.yml
                        → type check + lint + build + test
```

The CI workflow is the gatekeeper for all code quality. It runs on:
- Every push to `main`
- Every pull request to `main`

### 5.2 Deploy Flow (on main push + path filter)

```
push to main (apps/perplexity-agent/**)
    │
    ├─→ .github/workflows/deploy-perplexity-agent.yml  [GitHub runner]
    │       │
    │       └─→ Coolify API → health check → smoke test → Telegram alert
    │
    └─→ .gitea/workflows/deploy-perplexity-agent.yml   [Gitea runner — DR]
            │
            └─→ Coolify API → health check → smoke test
```

**Canonical:** `.github/workflows/deploy-perplexity-agent.yml` is primary.
**Gitea version:** Kept as disaster recovery if GitHub is unavailable.

### 5.3 Agent Workflow Execution (Local)

```
Developer invokes /ship
    │
    ├─→ .claude/commands/ship.md
    │       │
    │       └─→ .agent/workflows/git-ship.md
    │               │
    │               ├─→ git commit (semantic)
    │               ├─→ git push --force-with-lease
    │               └─→ gh pr create
    │
    └─→ .github/workflows/ci.yml (automatic, webhook-triggered)
            │
            └─→ If CI passes and PR merged → deploy-perplexity-agent.yml
```

### 5.4 Cron Jobs (Automated Checks)

`.claude/scheduled_tasks.json` defines 9 cron jobs:

| ID | Schedule | Function |
|----|----------|----------|
| `614f0574` | `*/30 * * * *` | Memory sync + git status |
| `checkpoint-90min` | `*/90 * * * *` | checkpoint.sh |
| `context-meter` | `*/60 * * * *` | context-meter.sh |
| `modo-dormir-daily` | `0 3 * * *` | `/rs` repo-scan + pipeline gen |
| `code-review-daily` | `0 4 * * *` | git log review |
| `test-coverage-daily` | `0 5 * * *` | `bun test --coverage` |
| `secrets-audit-daily` | `0 6 * * *` | grep secrets pattern |
| `mcp-health-daily` | `0 8 * * *` | MCP servers status |

---

## 6. SPEC/ADR Consolidation Strategy

### 6.1 SPECs — Single Location

**Canonical:** `docs/SPECS/SPEC-*.md`

All SPECs live in `docs/SPECS/`. The naming convention is `SPEC-NNN-title-slug.md` where NNN is a 3-digit sequential number. When a SPEC reaches COMPLETED status, it remains as historical record.

**SPEC Status Lifecycle:**
```
DRAFT → REVIEW → APPROVED → IMPLEMENTING → DONE / COMPLETED
```

**SPEC README** (`docs/SPECS/SPEC-README.md`) is the index and entry point.

**SPEC PROTECTED status** (like `SPEC-009-openclaw-persona-audio-stack.md`) is a flag meaning: "Changes require explicit human approval before merge." This is enforced by:
1. Human gates in `/hg` command
2. PR review requirement
3. Manual convention (no technical enforcement needed — team discipline)

### 6.2 ADRs — Single Location

**Canonical:** `docs/ADRs/`

Consolidated from three historical locations:
- `docs/adr/` — 18 legacy ADRs (0000-series, 2024-series)
- `docs/ADR/` — 4 ADRs (001-series)
- `docs/ADRs/` — **this is now the canonical location**

**ADR Numbering Convention:**

| Series | Format | Example | Status |
|--------|--------|---------|--------|
| Legacy | `0000-NNN` | `0001-crm-leads-clientes` | Historical only |
| 2024 | `YYYYMMDD` | `20240401-governanca-homelab` | Historical only |
| 2026 | `YYYYMMDD` | `20260404-voice-dev-pipeline` | Active |
| New | `NNN` | `001-governance-centralizada` | Active |

**For new ADRs:** Use `NNN` format (001, 002, 003...) or date-based `YYYYMMDD` for time-sensitive decisions.

### 6.3 SPEC vs ADR — When to Use Which

| Document | Purpose | Examples |
|----------|---------|----------|
| **SPEC** | Feature specification: what to build, user flows, API design, acceptance criteria | Voice pipeline, homelab network refactor, OpenClaw persona |
| **ADR** | Architectural decision: why chose X over Y, trade-offs, consequences | ORM selection, auth strategy, monorepo structure |

A feature implementation MAY have both: an ADR for architectural decisions made during implementation, and a SPEC for the feature itself.

---

## 7. Proposed Commit Descriptions

After each significant change, generate commit messages following:

```
feat(claude): added unified ARCHITECTURE-MASTER.md consolidating workflows
fix(ci): deduplicated deploy-perplexity-agent.yml between GitHub and Gitea
docs(specflow): created ARCHITECTURE-MASTER.md with interlock diagrams
chore(specflow): sequential SPEC numbering scheme adopted
refactor(agent): clarified skill vs workflow distinction in .agent/workflows/
```

---

## 8. Immediate Actions

| Priority | Action | Owner |
|----------|--------|-------|
| HIGH | Deprecate `.gitea/workflows/deploy-perplexity-agent.yml` (keep for DR) | Architect |
| HIGH | Add `invokes:` header to all `.claude/commands/*.md` files | Architect |
| HIGH | Add frontmatter `invokes:` to `.claude/commands/*.md` for all 16 commands | Architect |
| MEDIUM | Resolve SPEC-001 numbering collision (two SPEC-001 files) | Planner |
| MEDIUM | Add "PROTECTED" enforcement: `SPEC-*.md` with PROTECTED status require `/hg` approval | DevOps |
| LOW | Migrate SPEC-TEMPLATE.md to `SPEC-000-template.md` to free `SPEC-001` | Planner |
| LOW | Add `docs/SPECS/discovery.md` → update SPEC-README.md index | Documentation |

---

**Next review:** 2026-05-08 or when next SPEC lands, whichever comes first.
