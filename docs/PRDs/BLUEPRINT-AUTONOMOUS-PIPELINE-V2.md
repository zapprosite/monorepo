# BLUEPRINT — Autonomous Execution Pipeline v2
### Surgical Precision. Zero Fluff. Sleep-Ready.

**Date:** 2026-07-01
**Owner:** will@zappro.site
**Status:** draft → approved → executing

---

## Diagnóstico (O que temos vs o que faltava)

| Componente | Estado | Ação |
|---|---|---|
| `state-manager.py` | ✅ Sólido | Manter |
| `queue-manager.py` | ⚠️ Bom, falta reset-context | Adicionar command `reset-context` |
| `run-vibe.sh` | ⚠️ Buggy, refatorado | Refazer para context-reset loop |
| Gitea CI | ⚠️ Human gates blocking | Criar `agent-loop.yml` sem gates |
| Smoke tests | ⚠️ 17 scripts, sem padronização | Padronizar exit codes + runner |
| SPEC.md | ❌ Desconectado do execution | Embed execution block |
| Pipeline.json | ❌ 7 espalhados | Gerar de SPEC, não manual |
| PRD template | ❌ Não existia | Criar (feito) |
| Human notification | ❌ Não existia | Criar `notify-complete.sh` |
| Context reset | ❌ Não existia | Criar `context-reset.sh` |
| Subdomain deploy | ✅ Script existe | Orquestrar com auto-deploy |
| Auto-deploy Coolify | ⚠️ Scripts existem | Criar `auto-deploy.sh` |

---

## Research Insights Applied (April 2026)

### GCC Pattern (Git-Context-Controller) — arXiv:2508.00031
```
.GCC/
├── main.md                    # Global roadmap (shared, never reset)
├── branches/<name>/
│   ├── commit.md              # Milestone summaries (COMMIT creates)
│   ├── log.md                # Fine-grained OTA traces
│   └── metadata.yaml         # File structure, dependency graph
```
**Why:** Agents with structured checkpoint achieved **48% on SWE-Bench-Lite** vs 11.7% without.

### Context Compaction (arXiv:2604.03515)
- **Two-phase surgical:** Prune verbose old tool outputs (>40K tokens) → then LLM summarization via compaction agent
- **Prevention (Structural Bounds):** Scope messages per graph node, reset at retry boundaries
- **Verification Probe:** Validate compaction didn't lose critical info (additional LLM call)

### Generate-Test-Repair Loop
- AGENT does work → CI runs tests → on FAIL: feed error back to agent → retry
- 13 agent systems studied compose: ReAct + Generate-Test-Repair + Plan-Execute
- No single control structure — compose primitives

### PR-Based Workflow (arXiv:2508.08322)
```
Intent → Plan → Code → Test → Review → CI gate → merge
```
Human sign-off only for version control (git commit), not for every task.

---

## Arquitetura Final

```
PRD.md (human approval)
  ↓
SPEC.md + execution_block (SINGLE SOURCE OF TRUTH)
  ↓
pipeline.json (generated from SPEC, not manual)
  ↓
queue.json (atomic, per-task isolated)
  ↓
run-vibe.sh ←→ queue-manager.py ←→ context-reset.sh
  ↓
Workers (max 5, 500 rpm MiniMax)
  ↓
Branch → PR → Gitea agent-loop.yml
  ↓
Smoke test (PASS → next, FAIL → agent retry loop)
  ↓
All tasks complete → notify-complete.sh (email zappro.ia@gmail.com)
```

---

## Core Primitives (4 only)

| Primitive | Command | Purpose |
|-----------|---------|---------|
| `COMMIT` | `queue-manager.py commit <task_id> <summary>` | Checkpoint progress |
| `BRANCH` | `git checkout -b feature/agent-<task_id>` | Fresh context per task |
| `CONTEXT` | `scripts/context-reset.sh <task_id>` | Reset LLM context |
| `RETRY` | `queue-manager.py retry <task_id>` | Retry failed task |

---

## Execution Block Schema (嵌入 SPEC.md)

```yaml
execution:
  # Rate + Workers
  max_workers: 5
  rate_limit_rpm: 500
  context_window: 240000

  # Context Management (GCC-inspired)
  context_reset_per_task: true
  compaction_threshold: 40000     # tokens before compaction
  verification_probe: true         # validate compaction

  # Loop Behavior
  ci_retry_loop: true
  max_retries: 3
  smoke_threshold: PASS
  snapshot_interval: 3

  # Phases (reduced from PREVC 5 → 3)
  phases: [plan, do, verify]

  # Human Gates (only at T00 and Final)
  human_gates:
    - T00: REQUIRES_HUMAN   # PRD approval
    - Final: REQUIRES_HUMAN  # Final review

  # Notifications
  notify_on: [COMPLETE, FAIL]
  notify_email: zappro.ia@gmail.com

  # Deploy (optional)
  deploy_subdomain: false
  # deploy_subdomain: "my-app"
  # deploy_url: "http://localhost:3001"
```

---

## Gap Implementation (5 arquivos novos + 4 refatorados)

### Novos

| Arquivo | Purpose | Location |
|---------|---------|----------|
| `context-reset.sh` | Reset LLM context per task (GCC-inspired) | `/srv/monorepo/scripts/context-reset.sh` |
| `smoke-runner.sh` | Standardized smoke test runner | `/srv/monorepo/scripts/smoke-runner.sh` |
| `auto-deploy.sh` | Subdomain + Coolify deploy | `/srv/monorepo/scripts/auto-deploy.sh` |
| `notify-complete.sh` | Email notification on loop complete | `/srv/monorepo/scripts/notify-complete.sh` |
| `agent-loop.yml` | Gitea CI without human gates | `/srv/monorepo/.gitea/workflows/agent-loop.yml` |

### Refatorados

| Arquivo | Mudança | Status |
|---------|---------|--------|
| `queue-manager.py` | Add `reset-context`, `commit`, `branch` commands | Pending |
| `run-vibe.sh` | Rewrite: context reset per task, smoke-based retry | Pending |
| `vibe-kit/SPEC.md` | Embed execution block (pilot) | Pending |
| `pipeline.json` | Generate from SPEC execution block (delete other 6) | Pending |

---

## Context Reset Flow

```
Task N starts:
  1. queue-manager.py claim N → returns task description
  2. context-reset.sh N → clears LLM conversation history
  3. Load task-specific context from context/N/ (if exists)
  4. LLM prompt: "TASK_ID=N, DO=[from queue.json], CONTEXT=[from file]"
  5. LLM does work → push → PR
  6. Gitea CI runs smoke test
  7. On PASS → queue-manager.py complete N → context dump
  8. On FAIL → queue-manager.py retry N → LLM reads error → retry
  9. Next task N+1: fresh context, no history carryover
```

### Context File Structure
```
.claude/vibe-kit/context/
├── N001/
│   ├── prompt.md      # Task prompt (generated from queue.json)
│   ├── commit.md     # Milestone summary (created on COMMIT)
│   └── log.md        # Full OTA trace (Observation-Thought-Action)
└── N002/
    └── ...
```

---

## Smokes Tests Padronizados

All smoke tests MUST follow this contract:

```bash
# Exit code 0 = PASS, non-zero = FAIL
# No output on PASS (silence is gold)
# On FAIL: print reason to stderr

./smoke_test.sh
echo $?  # 0 = pass, 1+ = fail
```

| Smoke Test | Command | Exit Code |
|------------|---------|-----------|
| Health | `curl -sf http://$HOST/health | grep OK` | 0=pass |
| Lint | `bun run lint 2>&1 | tail -1` | 0=pass |
| Typecheck | `bunx tsc --noEmit 2>&1 | tail -1` | 0=pass |
| Test | `bun test 2>&1 | tail -1` | 0=pass |
| Build | `bun run build 2>&1 | tail -1` | 0=pass |

---

## Gitea agent-loop.yml (sem human gates)

```yaml
name: Agent Loop

on:
  push:
    branches: ['feature/agent-*', 'refactor/agent-*']
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Lint
        run: bun run lint

  test:
    runs-on: ubuntu-latest
    needs: [lint]
    steps:
      - uses: actions/checkout@v4
      - name: Test
        run: bun test

  smoke:
    runs-on: ubuntu-latest
    needs: [test]
    steps:
      - uses: actions/checkout@v4
      - name: Smoke
        run: bash scripts/smoke-runner.sh

  # NO human gate — smoke pass = auto merge
  # Agent retry loop via queue-manager.py retry command
```

---

## Deploy: Subdomain + Coolify

```bash
# 1. Create subdomain
/srv/ops/scripts/create-subdomain.sh <app-name> <url>

# 2. Deploy to Coolify
# Coolify watches branch main → auto-deploy on push

# 3. Smoke test post-deploy
curl -sf https://<app-name>.zappro.site/health | grep OK
```

---

## Implementação Prioritária

### Fase 1 — Foundation (Day 1)
- [ ] Criar `scripts/context-reset.sh`
- [ ] Criar `scripts/smoke-runner.sh`
- [ ] Refatorar `queue-manager.py` (add reset-context, commit)
- [ ] Criar `scripts/notify-complete.sh`

### Fase 2 — Loop (Day 2)
- [ ] Refatorar `run-vibe.sh` (context reset + smoke retry loop)
- [ ] Criar `scripts/auto-deploy.sh`
- [ ] Testar loop completo com task simples

### Fase 3 — CI Integration (Day 3)
- [ ] Deploy `agent-loop.yml` to Gitea
- [ ] Test PR → CI → smoke → merge flow
- [ ] Verify agent retry on failure

### Fase 4 — SPEC Consolidation (Day 4)
- [ ] Refatorar `vibe-kit/SPEC.md` (embed execution block)
- [ ] Gerar `pipeline.json` from SPEC
- [ ] Deletar outros 6 pipeline.json obsoletos
- [ ] Validar sistema completo

---

## Decision Tree — Quando Chamar Humano

```
LOW complexity (lint fix, typo, comment):
  → Never call human. Smoke pass = done.

MED complexity (new function, small refactor, test write):
  → If 3 retries failed → call human

HIGH complexity (API endpoint, security, multi-file):
  → Human gate at T00 (PRD) and Final
```

---

## Anti-Patterns (proibido)

- ❌ Levar contexto de task N para task N+1
- ❌ Fazer "assumção" — se não sabe, perguntar
- ❌ Chamar humano no meio do loop (só T00 e Final)
- ❌ Agregar contexto no LLM — resetar sempre
- ❌ Fazer mais de 3 retries sem escalar
- ❌ Inventar — sempre dizer "preciso estudar mais"

---

## Métricas de Sucesso

| Métrica | Target |
|---------|--------|
| Loop Duration | 8+ horas sem intervenção |
| Context Window | Nunca > 240k tokens |
| Retry Rate | < 3 retries por task |
| Smoke Pass Rate | 100% antes de notificar humano |
| Task Isolation | Zero cross-contamination entre tasks |

---

## Arquivos deste Blueprint

```
/srv/monorepo/docs/PRDs/
├── PRD-001-AUTONOMOUS-EXECUTION-PIPELINE.md  ← (criado)
└── PRD-template.md                            ← (criado)

/srv/monorepo/.gitea/workflows/
└── agent-loop.yml                            ← (criado)

/srv/monorepo/scripts/
├── context-reset.sh                          ← (pendente)
├── smoke-runner.sh                           ← (pendente)
├── auto-deploy.sh                           ← (pendente)
└── notify-complete.sh                        ← (pendente)

/srv/monorepo/.claude/vibe-kit/
├── SPEC.md                                   ← (refatorar)
└── pipeline.json                             ← (gerar de SPEC)
```

---

**Proceed?** Aprova o blueprint que executo Fase 1 agora.