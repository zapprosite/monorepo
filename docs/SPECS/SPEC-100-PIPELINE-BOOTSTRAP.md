# SPEC-100: Unified Claude/Agent Pipeline — Enterprise CI/CD Loop

**Status:** PROPOSED
**Date:** 2026-04-09
**Author:** will
**Type:** SPEC

---

## Objective

Unificar `.claude/commands/` (wrapper commands) com `.agent/workflows/` (Antigravity workflows) num sistema único onde:

- Claude Code CLI descobre workflows de `.agent/workflows/` via wrappers em `.claude/commands/`
- Antigravity Kit descobre skills de `.claude/skills/` via symlinks
- Pipeline runner executa 73 tasks do `pipeline.json` com Bootstrap Effect JSON

**Target:** Enterprise CI/CD loop como Cursor AI — AI escreve código → commit → PR → AI review → human gate → merge → deploy

**User:** will (único operador do monorepo homelab)

---

## ASSUMPTIONS I'M MAKING

1. `.claude/workflows/` é um diretóriovazio/não-existente — commands apontam para láerrado
2. `.agent/workflows/` tem os workflows reais (git-feature.md, git-ship.md, etc.)
3. Wrapper commands em `.claude/commands/`deveminvocar`.agent/workflows/`diretamente
4. Skills em `.claude/skills/`fazemsymlink para`~/.claude/agent-skills/skills/`
5. Pipeline state é file-based JSON (sem banco de dados)
6. Max 5 sub-agents simultâneos para não sobrecarregar
   → Correct me now or I'll proceed with these.

---

## Tech Stack

| Component         | Technology                                   | Location                       |
| ----------------- | -------------------------------------------- | ------------------------------ |
| Slash commands    | `.claude/commands/*.md`                      | Auto-discovered by Claude Code |
| Workflows         | `.agent/workflows/*.md`                      | Source of truth                |
| Pipeline state    | `tasks/pipeline-state.json`                  | File-based                     |
| Bootstrap emitter | `.claude/agents/bootstrap-effect-emitter.md` | Agent                          |
| Pipeline runner   | `.claude/commands/pipeline.md`               | Slash command                  |
| Orchestrator      | `.claude/agents/orchestrator.md`             | Leader agent                   |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                    UNIFIED WORKFLOW DISCOVERY                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Claude Code CLI                                                      │
│  ├── .claude/commands/feature.md ──────────────┐                    │
│  │       "Leia e execute .claude/workflows/"  │  ← BROKEN (não existe)
│  ├── .claude/commands/ship.md ─────────────────┼──→ .agent/workflows/git-ship.md
│  │       "Leia e execute .claude/workflows/"  │  ← BROKEN (não existe)
│  └── .claude/commands/pipeline.md ───────────┘                    │
│         "Execute tasks/pipeline.json"                                │
│                                                                      │
│  Antigravity Kit (.agent/)                                            │
│  ├── workflows/ (git-feature, git-ship, etc.)                       │
│  ├── skills/   (api-patterns, architecture, etc.)                   │
│  └── agents/   (16 specialist agents)                                 │
│                                                                      │
│  Bridge: .claude/commands/*.md wrappers → .agent/workflows/*.md    │
│  Bridge: .claude/skills/* ────────────────→ ~/.claude/agent-skills/ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                     ENTERPRISE CI/CD LOOP                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  push → Gitea Actions → AI Review (Claude Code) → Human Gate → Merge │
│    │                        │                                       │
│    │                        ├── Lint + Test (automated)            │
│    │                        ├── Security Scan (Trivy)              │
│    │                        └── AI Code Review (per-PR)            │
│    │                                                                     │
│    ▼                                                                     │
│  feature branch created by AI (via /feature or /scaffold)            │
│    │                                                                     │
│    ▼                                                                     │
│  [CI Pipeline — Gitea Actions]                                        │
│  ├── Checkout + Setup                                                  │
│  ├── Type check + Lint + Build                                        │
│  ├── Test suite                                                       │
│  └── AI Review gate (Claude Code reviews PR)                          │
│    │                                                                     │
│    ▼                                                                     │
│  [Human Gate] ───FAIL───→ [Bootstrap Effect JSON + Config Form]     │
│    │                                                                     │
│   PASS                                                                   │
│    │                                                                     │
│    ▼                                                                     │
│  Merge to main → Deploy to Coolify → Smoke Test → Monitor             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Problem: Broken Wrappers

**Hoje (broken):**

```
.claude/commands/feature.md  → "Leia e execute .claude/workflows/git-feature.md"
.claude/commands/ship.md    → "Leia e execute .claude/workflows/git-ship.md"
.claude/commands/turbo.md   → "Leia e execute .claude/workflows/git-turbo.md"

→ .claude/workflows/ NÃO EXISTE → comandos quebrados
```

**Depois (fixed):**

```
.claude/commands/feature.md  → "Leia e execute .agent/workflows/git-feature.md"
.claude/commands/ship.md    → "Leia e execute .agent/workflows/git-ship.md"
.claude/commands/turbo.md   → "Leia e execute .agent/workflows/git-turbo.md"

→ .agent/workflows/ TEM os workflows reais → comandos funcionam
```

---

## Commands

### Wrappers (corrigidos)

```bash
//feature [nome]         # Wraps .agent/workflows/git-feature.md
//ship                   # Wraps .agent/workflows/git-ship.md
//turbo                  # Wraps .agent/workflows/git-turbo.md
//scaffold [template]    # Wraps .agent/workflows/scaffold.md
//pg                     # Gera pipeline.json a partir de SPECs
//rr                      # Code review → REVIEW-*.md
//sec                     # Secrets audit
//pipeline               # Dashboard + executor de tasks
```

### Pipeline Runner

```bash
//pipeline              # Dashboard: 73 tasks pendentes por fase
//pipeline P001-T01     # Executa task específica
//pipeline phase 1     # Executa Phase 1 (11 tasks)
//pipeline critical    # Executa caminho crítico (12 tasks)
//pipeline all         # Executa todas (73 tasks, checkpoints)
//pipeline status      # Mostra estado atual
//pipeline resume      # Retoma do checkpoint
//pipeline dry-run     # Simula sem executar
```

---

## Project Structure

```
/srv/monorepo/
├── .claude/
│   ├── commands/              # 16 slash commands (wrappers → .agent/workflows/)
│   │   ├── feature.md         # → .agent/workflows/git-feature.md
│   │   ├── ship.md            # → .agent/workflows/git-ship.md
│   │   ├── turbo.md           # → .agent/workflows/git-turbo.md
│   │   ├── scaffold.md        # → .agent/workflows/scaffold.md
│   │   ├── pipeline.md        # NOVO: Pipeline runner
│   │   └── ...
│   ├── skills/                # Skills locais + symlinks para ~/.claude/agent-skills/
│   │   └── spec-driven-development/ → SYMLINK
│   ├── agents/
│   │   ├── orchestrator.md   # Líder: deteta gates, emite bootstrap
│   │   └── bootstrap-effect-emitter.md  # NOVO
│   ├── hooks/
│   │   ├── PreToolUse-Bash-validate.bash
│   │   └── PreToolUse-Edit-validate.bash
│   └── rules/
│       ├── backend.md
│       ├── search.md
│       ├── Hermes Agent-audio-governance.md
│       └── REVIEW-SKILLS.md
│
├── .agent/                     # Antigravity Kit (EXTERNAL, do not modify)
│   ├── workflows/              # 10 workflows REAIS
│   │   ├── git-feature.md
│   │   ├── git-ship.md
│   │   ├── git-turbo.md
│   │   ├── git-mirror-gitea-github.md
│   │   ├── scaffold.md
│   │   ├── code-review-workflow.md
│   │   └── ...
│   ├── skills/                 # 9 skills
│   ├── agents/                 # 16 specialist agents
│   └── scripts/
│
├── tasks/
│   ├── pipeline.json           # 73 tasks em 5 fases
│   ├── pipeline-state.json    # Estado persistente
│   └── bootstrap-effect-schema.json  # NOVO: JSON Schema
│
└── docs/SPECS/
    ├── SPEC-100-PIPELINE-BOOTSTRAP.md  # ESTE DOCUMENTO
    └── SPEC-015-GITEA-ACTIONS-ENTERPRISE.md  # CI/CD enterprise spec
```

---

## Code Style

### Wrapper Command (.claude/commands/feature.md)

```markdown
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

### Bootstrap Effect JSON

```json
{
  "bootstrap_effect": {
    "task_id": "P001-T01",
    "gate_type": "SECRET_MISSING",
    "smoke_test": {
      "description": "Test Coolify API connectivity",
      "command": "curl -s https://coolify.zappro.site/api/v1/health",
      "expected_output": "healthy",
      "current_output": "Unauthenticated"
    },
    "pending_configs": [
      {
        "key": "COOLIFY_URL",
        "source": "gh secret or Infisical",
        "current_value": "⚠️ NOT SET",
        "required_for": "Coolify API"
      }
    ],
    "human_action_required": "gh secret set COOLIFY_URL --body \"https://coolify.zappro.site\"",
    "verify_command": "gh secret list | grep COOLIFY"
  }
}
```

---

## Testing Strategy

| Level       | What                                         | How                                            |
| ----------- | -------------------------------------------- | ---------------------------------------------- |
| Unit        | Wrapper points to existing workflow          | `grep "agent/workflows" .claude/commands/*.md` |
| Unit        | Bootstrap schema valid                       | `jq . tasks/bootstrap-effect-schema.json`      |
| Integration | `//ship` creates PR                          | Invoke command                                 |
| Integration | `//pipeline status` shows dashboard          | Invoke command                                 |
| E2E         | Full CI/CD loop: PR → AI review → human gate | Gitea Actions run                              |

### CI/CD PR Loop Test (SPEC-015 verification)

```bash
# 1. Create test PR
git checkout -b test/pr-loop && \
echo "test" >> TEST.md && \
git add -A && git commit -m "test: PR loop verification" && \
git push -u gitea test/pr-loop && \
gh pr create --title "test: PR loop verification" --body "## Test plan - [ ] CI passing"

# 2. Verify Gitea Actions triggered
# → https://git.zappro.site/owner/monorepo/actions

# 3. Verify AI review comment posted
# → gh pr view --comments

# 4. Verify human gate works
# → PR should be blocked without approval
```

---

## Boundaries

### Always do

- Wrapper commands leem de `.agent/workflows/` (não de `.claude/workflows/` que não existe)
- Pipeline state persiste após cada task
- Bootstrap effect emitido ANTES de pedir ajuda genérica
- Max 5 sub-agents simultâneos
- Commits incluem `Co-Authored-By`

### Ask first

- Adicionar nova fase ao pipeline.json
- Modificar Bootstrap Effect JSON Schema
- Desabilitar checkpoints entre fases
- Remover workflow de `.agent/workflows/`

### Never do

- Commitar secrets em `pipeline-state.json`
- Modificar `.agent/` (é external, readonly)
- Loop infinito pedindo ajuda (sempre bootstrap effect)
- `--force` (usar `--force-with-lease`)
- Ignorar gate sem bootstrap effect

---

## Success Criteria

| #    | Criterion                                                          | Verification                              |
| ---- | ------------------------------------------------------------------ | ----------------------------------------- |
| SC-1 | `/ship` funciona (wrapper encontra `.agent/workflows/git-ship.md`) | Invoke command                            |
| SC-2 | `/feature` funciona                                                | Invoke command                            |
| SC-3 | `/turbo` funciona                                                  | Invoke command                            |
| SC-4 | `/pipeline` command carrega                                        | `ls .claude/commands/pipeline.md`         |
| SC-5 | Bootstrap Effect JSON válido                                       | `jq . tasks/bootstrap-effect-schema.json` |
| SC-6 | Phase 1 completa 11/11                                             | `//pipeline phase 1`                      |
| SC-7 | CI/CD PR loop: PR → AI review → human gate                         | Gitea Actions run                         |
| SC-8 | Orchestrator detecta gate ANTES de pedir ajuda                     | Leader emite JSON                         |

---

## Open Questions

| #    | Question                                        | Blocks          |
| ---- | ----------------------------------------------- | --------------- |
| OQ-1 | Max agents simultâneos = 5 ou 100?              | Task 6          |
| OQ-2 | Executar pipeline em background via cron?       | Task 6          |
| OQ-3 | Qdrant/n8n legacy parados em localhost → prune? | health-check.sh |
| OQ-4 | Como testar bootstrap effect sem gate real?     | Task 1          |
