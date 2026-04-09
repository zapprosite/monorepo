# Tasks — Pipeline Runner + Bootstrap Effect System

**Source:** tasks/plan.md (2026-04-09)
**Status:** PENDING — awaiting human review

---

## Task 1: Bootstrap Effect Schema + Emitter Agent

**SPEC Reference:** plan.md §Task 1

- [ ] **[T-BE-1]** Criar `tasks/bootstrap-effect-schema.json` (JSON Schema)
- [ ] **[T-BE-2]** Criar `.claude/agents/bootstrap-effect-emitter.md`
- [ ] **[T-BE-3]** Implementar `detect_gate_and_emit()` no emitter
- [ ] **[T-BE-4]** Testar com P001-T01 (secret migration gate)

**Verification:** `jq . tasks/bootstrap-effect-schema.json` → válido

---

## Task 2: Pipeline Command

**SPEC Reference:** plan.md §Task 2

- [ ] **[T-PL-1]** Criar `.claude/commands/pipeline.md`
- [ ] **[T-PL-2]** Implementar subcommands: status, resume, dry-run
- [ ] **[T-PL-3]** Criar dashboard view (tasks pendentes por fase)
- [ ] **[T-PL-4]** Testar com `//pipeline status`

**Verification:** `/pipeline` responde em Claude Code

---

## Task 3: Pipeline State Machine

**SPEC Reference:** plan.md §Task 3

- [ ] **[T-ST-1]** Criar `tasks/pipeline-state.json` (schema)
- [ ] **[T-ST-2]** Implementar reader/writer functions
- [ ] **[T-ST-3]** Hook para `//pipeline resume`
- [ ] **[T-ST-4]** Testar persistência entre sessões

**Verification:** `//pipeline resume` recupera último checkpoint

---

## Task 4: Orchestrator Enhancement

**SPEC Reference:** plan.md §Task 4

- [ ] **[T-OR-1]** Adicionar `detectHumanGate()` ao orchestrator
- [ ] **[T-OR-2]** Integrar `bootstrap-effect-emitter` no orchestrator
- [ ] **[T-OR-3]** Hook `updatePipelineState()` após cada task
- [ ] **[T-OR-4]** Testar: orchestrator PARA antes de pedir ajuda genérica

**Verification:** Orchestrator emite bootstrap effect (não "preciso de ajuda")

---

## Task 5: Phase 1 Execution (Critical Path)

**SPEC Reference:** plan.md §Task 5
**Tasks:** P001-T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10 → T11

- [ ] **[T-PH1-1]** Executar P001-T01 (migrate secrets → Infisical)
- [ ] **[T-PH1-2]** Executar P001-T02 (criar audit-workflow skill)
- [ ] **[T-PH1-3]** Executar P001-T03 (healthchecks em scheduled_tasks)
- [ ] **[T-PH1-4]** Executar P001-T04 (BROWSER_EVALUATE_ENABLED=false)
- [ ] **[T-PH1-5]** Executar P001-T05 (SPEC-001 commit)
- [ ] **[T-PH1-6]** Executar P001-T06 (pipeline.json workflow as code)
- [ ] **[T-PH1-7]** Executar P001-T07 (/audit-workflow functional)
- [ ] **[T-PH1-8]** Executar P001-T08 (health check script OK)
- [ ] **[T-PH1-9]** Executar P001-T09 (cron auto-detect secrets plaintext)
- [ ] **[T-PH1-10]** Executar P001-T10 (Telegram alert >1h)
- [ ] **[T-PH1-11]** Executar P001-T11 (verification checklist)

**Verification:** `//pipeline phase 1` → 11/11 COMPLETE

---

## Task 6: Phase 2-5 Execution (Parallel)

**SPEC Reference:** plan.md §Task 6

- [ ] **[T-PH2-1]** Executar P006-T01 → T07 (Playwright E2E)
- [ ] **[T-PH2-2]** Executar P007-T01 → T06 (OAuth profiles)
- [ ] **[T-PH3-1]** Executar P010-T01 → T07 (OpenClaw agents kit)
- [ ] **[T-PH3-2]** Executar P012-T01 → T03 (update discoverer)
- [ ] **[T-PH3-3]** Executar P013-T01 → T08 (unified agent monorepo)
- [ ] **[T-PH4-1]** Executar P014-T01 → T06 (Cursor AI CI/CD)
- [ ] **[T-PH4-2]** Executar P015-T01 → T06 (Gitea Actions enterprise)
- [ ] **[T-PH5-1]** Executar P011-T01 → T10 (CEO MIX + agency)
- [ ] **[T-PH5-2]** Executar P013CEO-T01 → T03 (voice stack)

**Verification:** `//pipeline all` → 73/73 EXECUTED ou HUMAN_GATE (com bootstrap effect)

---

## Stats

| Task | Files | Priority |
|------|-------|----------|
| T1 (Bootstrap Emitter) | 2 | CRITICAL |
| T2 (Pipeline Cmd) | 1 | CRITICAL |
| T3 (State) | 1 | HIGH |
| T4 (Orchestrator) | 1 | CRITICAL |
| T5 (Phase 1) | 11 | CRITICAL |
| T6 (Phase 2-5) | 73 | HIGH |

---

## Pipeline

```
plan.md → todo.md → Task 1-4 → Task 5 (Phase 1) → Task 6 (Phase 2-5)
```

---

## Dependencies

```
Task 1 (Bootstrap Emitter)
    └── Task 2 (Pipeline Command)
            └── Task 3 (State)
                    └── Task 4 (Orchestrator)
                            └── Task 5 (Phase 1)
                                    └── Task 6 (Phase 2-5)
```

---

## Gate Types (para Bootstrap Effect)

| Gate | Trigger | Smoke Test |
|------|---------|------------|
| SECRET_MISSING | gh secret list vazio | `curl https://coolify.zappro.site/api/v1/health` |
| HUMAN_CONFIG | Variável não setada | `gh variable list` |
| HUMAN_APPROVAL | PR sem approval | `gh pr view --comments` |
| MANUAL_ACTION | ZFS offline | `zpool status` |
| BLOCKER_DETECTED | Bug ambiguous | Log excerpt |
