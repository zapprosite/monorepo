# SPEC-CURSOR-LOOP: Autonomous Cursor AI-like Loop with Gitea Sandbox

**Status:** PROPOSED
**Date:** 2026-04-09
**Author:** will
**Type:** SPEC

---

## Objective

Implementar um loop autônomo "Cursor AI-like" onde:
1. Agente líder revisa variáveis de ambiente + Infisical secrets
2. Gitea Actions executa testes
3. Se falhar → research MCP + 5 agents refactoring
4. SPEC atualizada + /debug command
5. Git ship para PR
6. Testes passaram → MCP ai-context sync → git-mirror → merge main → nova feature branch

**Target:** Autonomous coding agent loop (Cursor AI, Bolt.ai style)
**User:** will (único operador)

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| CI/CD Sandbox | Gitea Actions (git.zappro.site) |
| Secrets | Infisical SDK (144 secrets) |
| Env vars | Gitea Secrets + Variables |
| Research | MCP Tavily + Context7 |
| Code review | MCP GitHub/Gitea |
| Sync | MCP ai-context |
| Git mirror | `.agent/workflows/git-mirror-gitea-github.md` |

---

## Loop Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CURSOR AI-like AUTONOMOUS LOOP                        │
├───────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  [1] LEADER AGENT                                                       │
│      ├── Check Infisical secrets (sdk)                                │
│      ├── Validate env vars vs required secrets                         │
│      └── Detecta gaps → Bootstrap Effect JSON                         │
│                                                                        │
│  [2] GITEAAI AGENT                                                     │
│      └── push → Gitea Actions (test pipeline)                          │
│                                                                        │
│  [3] TEST GATE                                                          │
│      ├── PASS ──────────────────────────────────────→ [4]           │
│      └── FAIL ───→ [5] RESEARCH + REFACTORING LOOP                     │
│                      │                                                 │
│                      ├── 5 AGENTS PARALELOS:                          │
│                      │   1. MCP Tavily research                        │
│                      │   2. MCP Context7 docs                          │
│                      │   3. Refactor code                              │
│                      │   4. Update SPEC                                │
│                      │   5. /debug command                            │
│                      │                                                 │
│                      └── Loop back to [2]                             │
│                                                                        │
│  [4] SHIP + SYNC                                                        │
│      ├── git ship → PR                                                 │
│      ├── AI review (MCP GitHub)                                        │
│      ├── MCP ai-context sync                                          │
│      └── git-mirror → merge main → new feature branch (random)         │
│                                                                        │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Commands

### Core Loop Commands

```bash
//cursor-loop              # Start autonomous loop
//cursor-loop --dry-run    # Simulate without executing
//cursor-loop --resume     # Resume from last checkpoint
```

### Sub-commands

```bash
//refactor                # Refactor failing code based on research
//research                # MCP Tavily + Context7 research
//debug                   # Run debug command
//ship                    # Git ship to PR
//mirror                  # Git mirror: merge main + new branch
```

---

## Project Structure

```
/srv/monorepo/
├── .claude/
│   ├── commands/
│   │   ├── cursor-loop.md    # NOVO: Autonomous loop command
│   │   ├── refactor.md       # NOVO: Refactor command
│   │   ├── research.md       # NOVO: Research command
│   │   ├── debug.md         # NOVO: Debug command
│   │   ├── ship.md          # → .agent/workflows/git-ship.md
│   │   └── mirror.md        # NOVO: Git mirror command
│   └── agents/
│       ├── cursor-loop-leader.md      # NOVO: Leader agent
│       ├── cursor-loop-giteaai.md    # NOVO: Gitea Actions agent
│       ├── cursor-loop-research.md   # NOVO: Research agent
│       ├── cursor-loop-refactor.md   # NOVO: Refactor agent
│       ├── cursor-loop-spec.md       # NOVO: SPEC updater
│       ├── cursor-loop-debug.md      # NOVO: Debug agent
│       ├── cursor-loop-ship.md      # NOVO: Git ship agent
│       ├── cursor-loop-review.md     # NOVO: AI review agent
│       ├── cursor-loop-sync.md      # NOVO: Context sync agent
│       └── cursor-loop-mirror.md     # NOVO: Git mirror agent
├── .agent/workflows/
│   ├── git-mirror-gitea-github.md   # Merge + new branch
│   ├── git-ship.md                 # Ship to PR
│   └── code-review-workflow.md      # AI review
└── docs/specflow/
    └── SPEC-CURSOR-LOOP.md          # ESTE DOCUMENTO
```

---

## Bootstrap Effect JSON Schema (Infisical Check)

```json
{
  "bootstrap_effect": {
    "task_id": "CURSOR-LEADER-01",
    "gate_type": "SECRET_MISSING | ENV_MISMATCH",
    "smoke_test": {
      "description": "Verify Infisical connectivity",
      "command": "curl -s http://127.0.0.1:8200/health",
      "expected_output": "healthy",
      "current_output": "connection refused"
    },
    "pending_configs": [
      {
        "key": "COOLIFY_URL",
        "source": "Infisical vault: coolify/url",
        "current_value": "⚠️ NOT SET",
        "required_for": "Coolify API in Gitea Actions"
      },
      {
        "key": "COOLIFY_API_KEY",
        "source": "Infisical vault: coolify/api_key",
        "current_value": "⚠️ NOT SET",
        "required_for": "Coolify API auth"
      }
    ],
    "human_action_required": "gh secret set COOLIFY_URL --body 'https://coolify.zappro.site'",
    "verify_command": "gh secret list | grep COOLIFY"
  }
}
```

---

## 10 Agents Design

### Agent 1: cursor-loop-leader
**Role:** Leader orchestrator
**Inputs:** tasks/pipeline.json, Infisical SDK
**Responsibilities:**
- Check all required secrets in Infisical
- Validate env vars consistency
- Emit Bootstrap Effect if gaps found
- Coordinate all other agents
- Decision: continue loop or stop

### Agent 2: cursor-loop-giteaai
**Role:** Gitea Actions trigger
**Inputs:** `.gitea/workflows/ci.yml`
**Responsibilities:**
- Push feature branch to Gitea
- Trigger CI pipeline
- Monitor status
- Report PASS/FAIL

### Agent 3: cursor-loop-research
**Role:** Research on failure
**Inputs:** Test failure logs
**Tools:** MCP Tavily + Context7
**Responsibilities:**
- Analyze failure root cause
- Search for solutions
- Update knowledge base

### Agent 4: cursor-loop-refactor
**Role:** Code refactoring
**Inputs:** Research findings
**Tools:** MCP Tavily + Context7
**Responsibilities:**
- Apply fixes based on research
- Maintain test coverage
- Update code

### Agent 5: cursor-loop-spec
**Role:** SPEC updater
**Inputs:** Refactored code, research
**Responsibilities:**
- Update SPEC.md with new patterns
- Document decisions
- Ensure spec is aligned with implementation

### Agent 6: cursor-loop-debug
**Role:** Debug command execution
**Inputs:** Refactored code
**Responsibilities:**
- Run /debug on failing components
- Generate fix recommendations
- Log debug output

### Agent 7: cursor-loop-ship
**Role:** Git ship to PR
**Inputs:** Refactored + SPEC updated code
**Responsibilities:**
- Git add -A
- Semantic commit
- Push
- Create PR

### Agent 8: cursor-loop-review
**Role:** AI code review
**Inputs:** PR changes
**Tools:** MCP GitHub/Gitea
**Responsibilities:**
- Post review comments
- Block if critical issues
- Approve or request changes

### Agent 9: cursor-loop-sync
**Role:** Context sync
**Inputs:** PR merge event
**Tools:** MCP ai-context
**Responsibilities:**
- Trigger ai-context-sync
- Update memory index
- Log sync status

### Agent 10: cursor-loop-mirror
**Role:** Git mirror + new branch
**Inputs:** Merge event
**Responsibilities:**
- Merge PR to main
- Create new feature branch with random name
- Push to both remotes (Gitea + GitHub)

---

## Test Loop (Gitea Actions CI)

```yaml
# .gitea/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, feat/**]
  pull_request:

jobs:
  test:
    name: Test Suite
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          cache: 'yarn'
      - run: yarn install --frozen-lockfile
      - run: yarn audit --level high
      - run: yarn check-types
      - run: yarn build
      - run: yarn test

  # If test fails → loop back to research + refactor
  # If test passes → ship + mirror
```

---

## Implementation (2026-04-10)

### Scripts Created

| Script | Purpose | Status |
|--------|---------|--------|
| `scripts/approve.sh` | Human gate polling + approval | ✅ DONE |
| `scripts/query-gate.sh` | Query pipeline state | ✅ DONE |
| `scripts/pipeline-state.sh` | CRUD for pipeline-state.json | ✅ DONE |
| `scripts/bootstrap-check.sh` | Secrets verification + Bootstrap Effect JSON | ✅ DONE |
| `scripts/bootstrap-effect.sh` | Format Bootstrap Effect for display | ✅ DONE |
| `scripts/cursor-loop-runner.sh` | Main orchestrator | ✅ DONE |
| `scripts/cursor-loop-research.sh` | Context7/Tavily research | ✅ DONE |
| `scripts/cursor-loop-refactor.sh` | Auto-fix based on research | ✅ DONE |

### Usage

```bash
# Check pipeline state
bash scripts/query-gate.sh

# Approve blocked pipeline
bash scripts/approve.sh --approve

# Abort blocked pipeline
bash scripts/approve.sh --abort

# Check secrets and emit Bootstrap Effect
bash scripts/bootstrap-check.sh

# Format Bootstrap Effect for display
bash scripts/bootstrap-check.sh --json | bash scripts/bootstrap-effect.sh

# Run full loop (dry-run)
bash scripts/cursor-loop-runner.sh --dry-run

# Run full loop (real)
bash scripts/cursor-loop-runner.sh

# Research an error
bash scripts/cursor-loop-research.sh "pnpm version mismatch"

# Apply fixes from research
bash scripts/cursor-loop-refactor.sh .cursor-loop/logs/research-latest.md
```

### State Management

Pipeline state is stored in `tasks/pipeline-state.json`:

```bash
# CRUD operations
bash scripts/pipeline-state.sh create <task_id>
bash scripts/pipeline-state.sh status
bash scripts/pipeline-state.sh set-state RUNNING
bash scripts/pipeline-state.sh approve
bash scripts/pipeline-state.sh abort
bash scripts/pipeline-state.sh reset
```

### Human Gate Flow

```
1. Pipeline blocks → humanGateRequired=true
2. approve.sh polls every 30s (configurable)
3. Dev runs: bash scripts/approve.sh --approve
4. State resets → humanGateRequired=false
5. Pipeline resumes
```

---

## Success Criteria

| # | Criterion | Verification |
|---|-----------|--------------|
| SC-1 | Leader agent checks Infisical before anything | Bootstrap effect if secrets missing |
| SC-2 | Gitea Actions CI runs on push | https://git.zappro.site/actions |
| SC-3 | Test FAIL → 5 agents research + refactor loop | Iterative improvement |
| SC-4 | Test PASS → git ship → PR | PR created |
| SC-5 | PR merged → ai-context sync → git-mirror | New branch created |
| SC-6 | Random branch name generated | e.g. `quantum-dispatch-ax7k2` |
| SC-7 | Full loop completes in < 30 min | Time measurement |

---

## Boundaries

### Always do
- Check Infisical secrets before CI run (bootstrap-check.sh)
- Emit Bootstrap Effect on secret gap
- Use `--force-with-lease` for git push
- Include Co-Authored-By in commits
- Random branch names (adjective-noun-hex format)
- Set `COREPACK_ENABLE_STRICT=0` for pnpm version mismatches

### Ask first
- Modify Bootstrap Effect schema
- Change test runner (Jest → Vitest)
- Disable any script in the loop

### Never do
- `--force` git push (use `--force-with-lease`)
- Commit secrets
- Skip tests before ship
- Ignore Bootstrap Effect
- Merge without AI review approval
- Hardcode API keys (use env vars + Infisical)

### MCP Status (2026-04-10)

| MCP | Status | Notes |
|-----|--------|-------|
| Context7 | ✅ Configurado | Usar para documentation lookup |
| Tavily | ⚠️ Configurado (API key missing) | Adicionar TAVILY_API_KEY ao Infisical |
| taskmaster-ai | ❌ Não instalado | Não usar como dependência |
| GitHub | ⚠️ Via `gh` CLI | Usar tea CLI para Gitea |
| Infisical | ⚠️ Python SDK | Não é MCP, usar diretamente |
