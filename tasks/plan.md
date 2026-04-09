# Plan: Pipeline Runner + Bootstrap Effect System

**Date:** 2026-04-09
**Author:** will
**Status:** PROPOSED

---

## Context

73 tasks em pipeline.json organizadas em 5 fases. O caminho crítico começa em P001-T01 (migrar secrets OpenClaw → Infisical). O usuário quer:

1. **Pipeline runner** — disparar as 73 tasks via `//pipeline`
2. **Bootstrap effect JSON** — quando um sub-agent líder precisa de intervenção humana, entrega um smoke test/curl que simula o estado atual + lista de configurações pendentes para o humano
3. **Human-in-the-loop inteligente** — não para "preciso de ajuda", mas entrega evidência + formulário de configuração

---

## Architecture

```
//pipeline [task-id|phase|critical]
├── Leader Agent (orchestrator)
│   ├── Reads tasks/pipeline.json
│   ├── Detects human-gate conditions
│   └── Emits Bootstrap Effect JSON
├── TaskExecutors (sub-agents)
│   ├── Execute individual tasks
│   ├── Report success/failure
│   └── Emit checkpoint events
└── BootstrapEffectEmitter (on human-gate)
    ├── smoke_test: curl/health that proves current state
    ├── pending_configs: list of values human must provide
    └── instructions: what to do after configuring
```

---

## Bootstrap Effect JSON Schema

```json
{
  "bootstrap_effect": {
    "task_id": "P001-T01",
    "gate_type": "HUMAN_CONFIG | APPROVAL | SECRET_MISSING | MANUAL_ACTION",
    "smoke_test": {
      "description": "Smoke test que prova o estado atual",
      "command": "curl -s http://localhost:8200/health",
      "expected_output": "healthy",
      "current_output": "connection refused"
    },
    "pending_configs": [
      {
        "key": "OPENCLAW_GATEWAY_TOKEN",
        "source": "Infisical vault openclaw/gateway_token",
        "current_value": "⚠️ NOT SET",
        "required_for": "OpenClaw CDP authentication"
      }
    ],
    "human_action_required": "Configurar COOLIFY_URL + COOLIFY_API_KEY via gh secret set",
    "verify_command": "gh secret list | grep COOLIFY"
  }
}
```

---

## Human Gate Types

| Gate Type | Trigger | Bootstrap Output |
|-----------|---------|-------------------|
| `SECRET_MISSING` | gh secret list vazio | `curl` para testar API + keys faltantes |
| `HUMAN_APPROVAL` | PR sem approval | `gh pr view` + merge checklist |
| `MANUAL_ACTION` | ZFS pool offline | `zpool status` + comandos de recovery |
| `HUMAN_CONFIG` | Variável não configurada | Form com fields + values atuais |
| `BLOCKER_DETECTED` | Bug/erro ambiguous | Log excerpt + diagnóstico |

---

## Dependency Graph (Critical Path)

```
Phase 1: P001-T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10 → T11
                │
                ├── (P001-T01 done) ──────────────────────────────────────────────────────────┐
                                                                                                  │
Phase 2: P006-T01 → T02 → T03 → T04 → T05 → T06 → T07                                          │
         P007-T01 → T02 → T03 → T04 → T05 → T06 ◄───────────────────────────────────────────────┘
                         │
                         ├── (P007-T01 done) ───────────────────────────────────────────────────────────────────┐
                                                                                                            │
Phase 3: P010-T01 → T02 → T03 → T04 → T05 → T06 → T07 ──────────────────────────────────────────────┐      │
         P012-T01 → T02 → T03                                                                        │      │
         P013-T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 ◄────────────────────────────────────────┘      │
                                                       │                                                          │
Phase 4: P014-T01 → T02 → T03 → T04 → T05 → T06 ─────────────────────┐                                   │
         P015-T01 → T02 → T03 → T04 → T05 → T06                      │                                   │
                                                       │           │                                   │
Phase 5: P011-T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10 ◄───────────────────────────────┘
         P013CEO-T01 → T02 → T03 ◄────────────────────────────────────────────────────────────────────────┘
```

---

## Tasks

### Task 1: Bootstrap Effect Schema + Emitter Agent

**Files to create:**
- `tasks/bootstrap-effect-schema.json` — JSON Schema for validation
- `.claude/agents/bootstrap-effect-emitter.md` — Agent que gera Bootstrap Effect JSON

**Emitter logic:**
```python
def detect_gate_and_emit(task_id, current_state):
    gate_type = classify_gate(task_id, current_state)
    smoke = run_smoke_test(task_id)
    configs = get_pending_configs(task_id)
    return {
        "bootstrap_effect": {
            "task_id": task_id,
            "gate_type": gate_type,
            "smoke_test": smoke,
            "pending_configs": configs,
            "human_action_required": format_action(configs),
            "verify_command": get_verify_cmd(gate_type)
        }
    }
```

**Acceptance:** Agent retorna JSON válido conforme schema

---

### Task 2: Pipeline Command

**File:** `.claude/commands/pipeline.md`

```markdown
---
description: Execute pipeline tasks with bootstrap effect on human gates
argument-hint: [task-id|phase|critical|status|resume|dry-run]
---

Pipeline runner que executa tasks de tasks/pipeline.json.
Cada checkpoint entre fases gera Bootstrap Effect se necessário.
```

**Interface:**
```
//pipeline              → dashboard
//pipeline P001-T01     → task específica
//pipeline phase 1     → Phase 1 completa
//pipeline critical    → só caminho crítico
//pipeline all         → todas (com checkpoints)
//pipeline status      → estado atual
//pipeline resume      → retoma do checkpoint
//pipeline dry-run     → simula sem executar
```

**Acceptance:** `/pipeline` responde em Claude Code

---

### Task 3: Pipeline State Machine

**File:** `tasks/pipeline-state.json`

```json
{
  "version": "1.0",
  "last_checkpoint": "P001-T03",
  "completed": ["P001-T01", "P001-T02"],
  "failed": [],
  "in_progress": ["P001-T03"],
  "blocked_by": {
    "P007-T01": {
      "gate": "MANUAL_ACTION",
      "bootstrap_effect": {...}
    }
  }
}
```

**Acceptance:** State persiste entre sessões, `//pipeline resume` funciona

---

### Task 4: Orchestrator Enhancement

**File:** `.claude/agents/orchestrator.md`

Adds to existing orchestrator:
- `detectHumanGate(task_id)` — inspect state before asking for help
- `emitBootstrapEffect(task_id)` — invoke emitter on gate detection
- `updatePipelineState(task_id, status)` — persist progress

**Acceptance:** Orchestrator calls emitter BEFORE asking for generic help

---

### Task 5: Phase 1 Execution (Critical Path First)

**Execute:** P001-T01 through P001-T11 in order

For each task:
1. Read acceptance_criteria
2. Execute with sub-agent if needed
3. Verify against acceptance_criteria
4. Update pipeline-state.json
5. If human-gate detected → emit bootstrap effect AND STOP (don't loop asking)

**Acceptance:** Phase 1 completa com pipeline-state.json atualizado

---

### Task 6: Phase 2-5 Parallel Execution

**Strategy:** Max 5 sub-agents simultaneously, phase-ordered

Each phase has a "leader" sub-agent that:
- Owns all tasks in that phase
- Reports bootstrap effect if blocked
- Updates pipeline-state on completion

**Acceptance:** All 73 tasks executed or documented with bootstrap effect

---

## Verification

| Check | Command | Expected |
|-------|---------|----------|
| Schema valid | `jq . tasks/bootstrap-effect-schema.json` | sem erro |
| Command exists | `ls .claude/commands/pipeline.md` | arquivo existe |
| Orchestrator emits | `//pipeline P001-T01` | bootstrap effect JSON |
| State persists | `cat tasks/pipeline-state.json` | estado válido |
| Phase 1 done | `//pipeline phase 1` | 11/11 COMPLETE |
| Resume works | `//pipeline resume` | continua do checkpoint |

---

## Checkpoints Entre Fases

| Checkpoint | Gate | Condição |
|------------|------|----------|
| Post-Phase 1 | HUMAN_CONFIG | Secrets migrados? Health checks OK? |
| Post-Phase 2 | HUMAN_APPROVAL | OAuth profiles? Playwright passa? |
| Post-Phase 3 | MANUAL_ACTION | Skills instaladas? Symlink corrigido? |
| Post-Phase 4 | HUMAN_APPROVAL | CI/CD enterprise? Human gates? |
| Post-Phase 5 | FINAL_VERIFY | CEO MIX responde? Voice 15/15? |

---

## Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| Gates muito frequentes | Pipeline para demais | Threshold: skip se N gates < 3 |
| Bootstrap effect impreciso | Humano configura errado | Dry-run antes de cada gate |
| 73 tasks = sessão longa | Timeout | Executar em background com cron |
| Tavily MCP falha | Research agentes falham | Context7 fallback (já implementado) |

---

## Next Step After This Plan

Comitar este plano → kemudian execute Task 1 (Bootstrap Effect Schema + Agent) → Task 2 (Pipeline command) → Task 3 (State) → Task 4 (Orchestrator) → Task 5 (Phase 1) → Task 6 (Phase 2-5)
