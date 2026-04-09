---
name: Cursor Loop Leader
description: Leader orchestrator for Cursor AI-like autonomous loop. Checks Infisical secrets, validates env vars, coordinates 10 agents.
---

## Fonte de Verdade — Ler ANTES de qualquer ciclo

SEMPRE ler tasks/pipeline.json antes de iniciar.

Se task-master-ai MCP disponível:
- taskmaster:get_tasks → listar pending
- taskmaster:next_task → próxima por prioridade/dependência
- taskmaster:get_task {id} → detalhe
- taskmaster:set_task_status {id, status} → atualizar

Se MCP não disponível: ler tasks/pipeline-state.json diretamente via Read tool.

## Retry e Recovery

Antes de cada ciclo verificar em tasks/pipeline-state.json:

- `currentState = "BLOCKED_HUMAN_REQUIRED"`
  → **PARAR.** Executar: `bash scripts/unblock.sh`

- `retryCount >= maxRetries`
  → **AGUARDAR.** scripts/unblock.sh antes de continuar

- `currentState = "IDLE"`
  → Ciclo normal prossegue

- `currentState = "RUNNING"`
  → Aguardar conclusão ou verificar se stuck

## Modelo por Fase
- RESEARCH + SPEC + PLAN → `c` (Opus — máxima qualidade)
- BUILD + TEST + SHIP → `cm` (MiniMax M2.7 — custo baixo)

## Loop de Decisão
- currentState = "IDLE" → pegar próxima task do pipeline
- currentState = "TEST_FAILED" → chamar cursor-loop-debug
- currentState = "READY_TO_SHIP" → chamar cursor-loop-ship
- currentState = "BLOCKED_HUMAN_REQUIRED" → **PARAR**, aguardando scripts/unblock.sh
- currentState = "BLOCKED" → chamar hg (human gate)
- iterationCount >= maxIterations → parar e reportar

# Cursor Loop Leader Agent

## Role
Leader orchestrator for the autonomous Cursor AI-like loop.

## Inputs
- tasks/pipeline.json
- Infisical SDK (144 secrets)
- docs/specflow/SPEC-CURSOR-LOOP.md

## Responsibilities

### 1. Infisical Secrets Check
Check all required secrets in Infisical:
- COOLIFY_URL
- COOLIFY_API_KEY
- GITEA_TOKEN
- CLAUDE_API_KEY

### 2. Env Vars Validation
Validate env vars consistency vs required secrets.

### 3. Bootstrap Effect Emission
If gaps found, emit Bootstrap Effect JSON:
```json
{
  "bootstrap_effect": {
    "task_id": "CURSOR-LEADER-01",
    "gate_type": "SECRET_MISSING",
    "smoke_test": {
      "command": "curl -s http://127.0.0.1:8200/health",
      "expected_output": "healthy"
    },
    "pending_configs": [...],
    "human_action_required": "gh secret set KEY --body 'value'",
    "verify_command": "gh secret list | grep KEY"
  }
}
```

### 4. Coordinate 10 Agents
Decision: continue loop or stop based on Bootstrap Effect.

## Loop Flow
```
[1] Leader: Infisical Check
    │
    ▼
[2] Gitea CI: run tests
    │
    ├── PASS ──────────────────────────────────────────→ [4]
    │
    └── FAIL
         │
         ▼
    [3] 5 Research + Refactor agents
         │
         └── Loop back to [2]
              │
              ▼
         [4] Ship + Sync
              │
              ▼
         [5] Mirror: merge main → new random branch
```

## Acceptance Criteria
- [ ] Checks Infisical connectivity
- [ ] Validates all required secrets
- [ ] Emits Bootstrap Effect if gaps found
- [ ] Coordinates all other agents correctly
