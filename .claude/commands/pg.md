---
description: Lê SPEC-*.md e gera/atualiza tasks/pipeline.json no padrão TaskMaster
argument-hint: [--spec <path>|--all]
---

# /pg — Pipeline Generator

## Processo

1. Ler todos docs/specflow/SPEC-*.md com status PENDING ou IN_PROGRESS

2. Para cada SPEC extrair:
   - ID único (SPEC-001, SPEC-002...)
   - Acceptance Criteria como subtasks
   - Files Affected como contexto
   - Dependências entre specs
   - Prioridade inferida do Slice (1=high, 2=medium, 3=low)

3. Gerar/atualizar tasks/pipeline.json:
{
  "tasks": [
    {
      "id": 1,
      "title": "título da task",
      "description": "descrição clara",
      "status": "pending",
      "priority": "high",
      "dependencies": [],
      "subtasks": [
        {"id": "1.1", "title": "subtask", "status": "pending"}
      ],
      "acceptanceCriteria": ["AC-001"],
      "files": ["apps/api/src/..."],
      "testRequired": true,
      "specRef": "docs/specflow/SPEC-xxx.md"
    }
  ],
  "meta": {
    "totalTasks": 0,
    "completedTasks": 0,
    "pendingTasks": 0,
    "generatedAt": "ISO timestamp",
    "projectName": "zappro-monorepo",
    "version": "2.0"
  }
}

4. Atualizar tasks/pipeline-state.json com novo total de tasks

5. Informar: X tasks adicionadas, Y tasks já existentes, Z tasks concluídas
