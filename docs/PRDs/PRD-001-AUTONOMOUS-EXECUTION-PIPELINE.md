# PRD — Autonomous Execution Pipeline v2

## Contexto

Sistema atual é uma saladinha de ideias: SPECs espalhadas, pipelines.json em 7 lugares, nexus.sh tinha 824 linhas e foi refatorado pra 5 workers. Gitea CI tem human gates mas são blocking (não há loop autônomo). O vibe-kit atual não reseta context window entre tasks.

**Problema:** O sistema não consegue dormir e acordar com trabalho feito. Precisa de loop autônomo completo.

---

## O Sistema Que Queremos

### Fluxo Core (sem humano no meio)

```
Human Approved PRD
        ↓
Lead Agent → SPEC → Queue → Branch → PR
        ↓
   Gitea CI (pass/fail)
        ↓
  Smoke/Curl Test ← AGENT RETRY LOOP
        ↓
   All Passed → Human Notify
```

### Regras de Ouro

1. **Zero intervenção humana durante execução** — só no início (PRD) e fim (review final)
2. **Contexto resetado por task** — cada task começa com LLM fresh, sem history carryover
3. **Gitea loop até PASS** — agent empurra código, CI falha, agent retry, CI faila, agent retry... até PASS
4. **Human notification only on completion** — resumo por email quando todas as tasks passam
5. **Smoke/curl antes de humano** — se smoke test passa, nunca chamar humano pra validar
6. **Never invent, always ask for more context** — agente nunca inventa, sempre diz "não tenho contexto suficiente, preciso estudar"
7. **Model knows when it's context-limited** — se a task precisa de contexto que o modelo não tem, ele pede, não assumption

---

## Arquitetura Proposta

### Camadas

```
PRD.md (input)
  ↓
SPEC.md + execution_block (single source of truth)
  ↓
pipeline.json (generated from SPEC)
  ↓
queue.json (atomic, per-task isolated)
  ↓
run-vibe.sh (executor, reads SPEC + queue)
  ↓
Workers (max 5, respect 500 rpm MiniMax)
  ↓
Branch → PR → Gitea CI
  ↓
Smoke/Curl test (pass → next, fail → retry)
  ↓
context reset → next task
```

### Componentes Principais

#### 1. PRD Template (`/docs/PRDs/PRD-template.md`)
- brainstorm → ideas → decision tree
- Template estruturado com seções: problema, solução, critérios, stack, human gates, execution plan

#### 2. SPEC.md com Execution Block Inline
```yaml
---
name: EXAMPLE-001
status: active
owner: will@zappro.site
created: 2026-07-01
---

# EXAMPLE-001

## Problema

## Solução

## Funcionalidade

## Acceptance Criteria

## Stack

## Human Gates
- T01 (PRD approval): REQUIRES_HUMAN
- Final: REQUIRES_HUMAN
- All others: AUTO

## Execution Block
```yaml
execution:
  max_workers: 5
  rate_limit_rpm: 500
  context_window_reset: true
  ci_retry_loop: true
  smoke_threshold: PASS
  notify_on: [COMPLETE, FAIL]
  phases: [plan, do, verify]
  snapshot_interval: 3
```
```

#### 3. Pipeline.json (generated, not manual)
- Generated from SPEC execution block
- Single location: `SPEC.md.execution` block generates → `pipeline.json`
- No more 7 pipeline.json files scattered

#### 4. Queue Manager (improve existing)
- Already exists: `queue-manager.py` with fcntl.flock
- Add: `reset-context`, `get-next-task`, `mark-retrying`
- Per-task isolation: each task has its own context file

#### 5. Context Reset Strategy
```
Task N starts:
  1. queue-manager.py claims task N
  2. Read task description from queue.json (NOT from LLM history)
  3. Load task-specific context from context/N/ directory (if exists)
  4. LLM prompt: "TASK_ID=N, DO_THIS=[from queue.json], CONTEXT=[from file]"
  5. LLM does work, pushes code, creates/updates PR
  6. CI runs smoke/curl tests
  7. On PASS: queue-manager.py complete task N
  8. On FAIL: queue-manager.py mark task N as retry, LLM reads error, retries
  9. Context dump: clear conversation history, next task N+1 loads fresh
```

#### 6. Gitea CI Loop (new workflow)
```yaml
# .gitea/workflows/agent-loop.yml
name: Agent Loop

on:
  push:
    branches: [feature/agent-*]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Run tests
        run: |
          npm run test -- --passWithNoTests
          npm run lint
          bun run typecheck

      - name: Smoke test
        run: |
          cd build
          ./smoke.sh || curl -s http://localhost:3000/health | grep OK

  notify-pass:
    if: success()
    steps:
      - name: Update queue
        run: python3 queue-manager.py complete $TASK_ID

  notify-fail:
    if: failure()
    steps:
      - name: Update queue as retry
        run: python3 queue-manager.py retry $TASK_ID

      - name: Notify agent to retry
        run: echo "TASK $TASK_ID FAILED - AGENT RETRY REQUIRED"
```

#### 7. Human Notification
```bash
# On loop complete (all tasks pass)
python3 state-manager.py event LOOP_COMPLETE "spec=SPEC-NAME,tasks=N,passed=N,failed=0"
send-email.sh --to zappro.ia@gmail.com --subject "[DONE] SPEC-NAME" --body "Loop completo. N tasks passaram. Clique para review: $PR_URL"
```

---

## Gap Analysis

| Componente | Existe | Estado | Ação |
|---|---|---|---|
| PRD template | ❌ | Não existe | Criar `/docs/PRDs/PRD-template.md` |
| SPEC com execution block | ❌ | SPEC.md antigo, sem execution | Refatorar SPEC-004 como pilot |
| Pipeline.json centralizado | ❌ | 7 arquivos espalhados | Unificar → generated from SPEC |
| Queue manager melhorado | ⚠️ | `queue-manager.py` existe, falta reset-context | Adicionar commands de reset |
| Context reset per task | ❌ | Não existe | Criar `context-reset.sh` |
| Gitea agent-loop workflow | ❌ | CI existe mas com human gates | Criar `.gitea/workflows/agent-loop.yml` |
| Smoke test runner | ⚠️ | Muitos em `/smoke-tests/`, sem标准化 | Criar `scripts/smoke-runner.sh` |
| Human notification | ❌ | Não existe | Criar `scripts/notify-complete.sh` |
| Subdomain creation | ✅ | `/srv/ops/scripts/create-subdomain.sh` | Manter, usar no deploy |
| Auto-deploy Coolify | ⚠️ | Scripts existem mas não orquestrados | Criar `scripts/auto-deploy.sh` |

---

## Implementação Prioritária

### Fase 1 — Foundation (Core loops working)
1. Criar `PRD-template.md` em `/docs/PRDs/`
2. Criar `.gitea/workflows/agent-loop.yml` (smoke-based, no human gate)
3. Refatorar `run-vibe.sh` para: claim task → load context → execute → smoke test → retry loop
4. Adicionar `context-reset` command em `queue-manager.py`

### Fase 2 — Context Window
5. Criar `scripts/context-reset.sh` — isolates each task's LLM context
6. Criar `context/N/` structure — each task has its own prompt/response cache
7. Update SPEC-004 to use new execution block format

### Fase 3 — Full Automation
8. Criar `scripts/notify-complete.sh` — email on loop completion
9. Criar `scripts/auto-deploy.sh` — subdomain + coolify deploy
10. Unificar all 7 pipeline.json → single generation system

### Fase 4 — Polish
11. Audit all smoke tests, standardize exit codes
12. Add retry counter to queue.json
13. Add "never ask human" flag for tasks below complexity threshold

---

## Decision Tree — When to Call Human

```
TASKComplexity = LOW  → never call human (smoke pass = done)
TASKComplexity = MED  → if 3 retries failed → call human
TASKComplexity = HIGH → human approval at start (PRD) and end (final review)
```

**LOW complexity:** lint fix, typo fix, comment update, variable rename
**MED complexity:** new function, refactor small module, test write
**HIGH complexity:** new API endpoint, security change, multi-file restructure

---

## Tech Stack para o Sistema

- **Executor:** `run-vibe.sh` (bash, existing)
- **Queue:** `queue-manager.py` (Python, fcntl.flock, existing)
- **State:** `state-manager.py` (Python, existing)
- **CI:** Gitea Actions (existing `.gitea/workflows/`)
- **Smoke tests:** Shell + curl (existing in `/smoke-tests/`)
- **Notifications:** `send-email.sh` (existing or new)
- **Deploy:** `create-subdomain.sh` + Coolify API

---

## Métricas de Sucesso

- Lead agent can run overnight (8+ hours) without human intervention
- Context window never exceeds 240k tokens (MiniMax limit)
- Smoke test passes before human is notified
- Gitea CI loop completes task within 3 retries max
- All tasks traceable: who did what, when, pass/fail status

---

## Status

**Created:** 2026-07-01
**Owner:** will@zappro.site
**Status:** draft — awaiting research agent insights and human approval