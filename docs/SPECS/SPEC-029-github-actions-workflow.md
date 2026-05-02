---
**Last reviewed:** 2026-05-02
**Owner:** SRE/homelab
spec: SPEC-207
title: Hermes → GitHub Actions → Qwen2.5-Coder Pipeline (Refactored)
status: draft
date: 2026-05-02
author: Nexus SRE
---

# SPEC-029 — Github Actions Workflow
— Hermes Orchestrated PREVC with GitHub Actions + Qwen2.5-Coder Loop

## 1. Context

Gitea Actions foi abandonado (containers efémeros com bug de networking). Migration para GitHub Actions已完成.

**Nova arquitectura:**
- GitHub Actions = CI/CD executor (funciona)
- Gitea = mirror de leitura (git push para ambos)
- Hermes = Orquestrador supreme
- Qwen2.5-coder:14b = code generation (14B, precisa de harness sólido)

---

## 2. Fluxo Completo (PREVC + Hermes + GitHub Actions)

```
USER/Hermes task received
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  HERMES (Orquestrador)                                      │
│  1. Fatia task baseado em limite de tokens               │
│  2. Pull contexto via RAG (Qdrant)                        │
│  3. Cria queue.json para GitHub Actions                    │
│  4. Trigger GitHub Actions workflow                         │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PREVC → P (Plan)                                         │
│  architect-specialist: design                              │
│  documentation-writer: SPEC.md                             │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PREVC → R (Review)                                       │
│  code-reviewer: review SPEC                              │
│  security-auditor: audit                                   │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PREVC → E (Execute) — GITHUB ACTIONS LOOP               │
│                                                             │
│  Step 1: Create ephemeral worktree                        │
│    git worktree add /tmp/nexus-TASKID HEAD                 │
│                                                             │
│  Step 2: Qwen2.5-coder:14b writes code                   │
│    hermes → ollama API → qwen2.5-coder:14b               │
│                                                             │
│  Step 3: GitHub Runner executes tests                       │
│    pnpm test, pnpm lint, typecheck                        │
│                                                             │
│  Step 4: Feedback loop (if FAIL)                          │
│    Runner devolve erro para Hermes                          │
│    Hermes re-envia para Qwen iterar                         │
│    Volta ao Step 2 (loop)                                  │
│                                                             │
│  Step 5: FLUSH (if PASS)                                  │
│    git merge → main                                        │
│    Hermes extrai aprendizados → Qdrant                      │
│    Worktree destruída: git worktree remove                 │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│  PREVC → V (Verify)                                      │
│  smoke tests, CI verde                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Ficheiros

| Ficheiro | Propósito |
|---|---|
| `docs/SPECS/SPEC-207.md` | Esta spec |
| `.github/workflows/prevc-loop.yml` | GitHub Actions workflow |
| `.claude/vibe-kit/pipeline.json` | Task queue |
| `pipeline-executor.py` | Hermes task executor |
| `_archive/legacy_harness/` | Agentes legacy archived |

---

## 4. GitHub Actions Workflow (.github/workflows/prevc-loop.yml)

```yaml
name: PREVC Execution Loop

on:
  workflow_dispatch:
    inputs:
      task_id:
        description: 'Task ID from queue'
        required: true
      task_command:
        description: 'Command to execute'
        required: true
      context_path:
        description: 'Path to context files'
        required: false

jobs:
  execute-task:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 1

      - name: Create ephemeral worktree
        run: |
          TASK_ID=${{ github.event.inputs.task_id }}
          WORKTREE_DIR="/tmp/nexus-$TASK_ID"
          git worktree add "$WORKTREE_DIR" HEAD
          echo "WORKTREE_DIR=$WORKTREE_DIR" >> $GITHUB_ENV

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Setup pnpm
        run: corepack enable && corepack prepare pnpm@9 --activate

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Execute task command
        run: |
          cd ${{ env.WORKTREE_DIR }}
          ${{ github.event.inputs.task_command }}
        continue-on-error: true

      - name: Run tests
        run: |
          cd ${{ env.WORKTREE_DIR }}
          pnpm test --run
        continue-on-error: true

      - name: Run lint
        run: |
          cd ${{ env.WORKTREE_DIR }}
          pnpm lint
        continue-on-error: true

      - name: Report results
        run: |
          echo "TASK_ID=${{ github.event.inputs.task_id }}"
          echo "STATUS=${{ job.status }}"

      - name: Cleanup worktree
        if: always()
        run: |
          git worktree remove "${{ env.WORKTREE_DIR }}" || true
```

---

## 5. Task Queue (pipeline.json)

```json
{
  "name": "nexus-prevc-pipeline",
  "version": "1.0.0",
  "description": "PREVC task queue for Hermes orchestration",
  "created": "2026-05-02",
  "tasks": [],
  "stages": [
    {
      "id": 1,
      "name": "Qdrant Health",
      "command": "curl -s -H 'api-key: ${QDRANT_API_KEY}' http://localhost:6333/collections | python3 -c \"import sys,json; d=json.load(sys.stdin); print('Collections:', [c['name'] for c in d['result']['collections']])\"",
      "expect": "Collections list",
      "critical": true
    },
    {
      "id": 2,
      "name": "GitHub Actions Runner",
      "command": "curl -s -o /dev/null -w '%{http_code}' https://api.github.com/repos/willzappro/monorepo/actions/runners",
      "expect": "200",
      "critical": true
    },
    {
      "id": 3,
      "name": "Ollama Qwen2.5-Coder",
      "command": "curl -s localhost:11434/api/tags | python3 -c \"import sys,json; d=json.load(sys.stdin); models=[m['name'] for m in d['models']]; print('OK' if any('qwen2.5-coder' in m for m in models) else 'MISSING')\"",
      "expect": "OK",
      "critical": true
    }
  ]
}
```

---

## 6. Implementation Phases

| Phase | Task | Status |
|-------|------|--------|
| 1 | Create SPEC-207 in monorepo | 🔄 IN PROGRESS |
| 2 | Create .github/workflows/prevc-loop.yml | ⬜ |
| 3 | Create pipeline.json queue | ⬜ |
| 4 | Test GitHub Actions workflow | ⬜ |
| 5 | Integrate with PREVC | ⬜ |
| 6 | End-to-end test | ⬜ |

---

**Owner:** Nexus SRE
**Next:** Create workflow file
