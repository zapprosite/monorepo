---
name: Pipeline Gen
description: Gera pipeline.json a partir de SPECs
trigger: /pg
---

# Pipeline Gen Skill

Gera `tasks/pipeline.json` a partir de SPEC-*.md ficheiros.

## Input

Lê todos os ficheiros em `docs/SPECS/SPEC-*.md` exceto TEMPLATE e README.

## Output

```json
{
  "name": "project-name",
  "description": "...",
  "version": "1.0.0",
  "phases": [
    {
      "phase": 1,
      "name": "Phase Name",
      "tasks": [
        {
          "id": "TASK-001",
          "name": "Task name",
          "status": "pending",
          "spec_ref": "SPEC-001",
          "acceptance_criteria": ["AC-1", "AC-2"]
        }
      ]
    }
  ],
  "gates": [
    {
      "name": "Security Review",
      "phase": 2,
      "requires": "security-audit"
    }
  ]
}
```

## Phase Mapping

| SPEC Priority | Phase |
|--------------|-------|
| Must Have | Phase 1 |
| Should Have | Phase 2 |
| Could Have | Phase 3 |

## Como Usar

```bash
/pg              # Gera pipeline.json
/pg --dry        # Só mostra, não escreve
/pg --spec SPEC-001  # Só uma SPEC
```

## Regras

1. Tasks mapeadas para SPEC acceptance criteria
2. Gates para security, PM review
3. Dependencies resolved automatically
4. Output vai para `tasks/pipeline.json`
