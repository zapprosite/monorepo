---
name: Repo Scan
description: Deteta tasks em múltiplos formatos
trigger: /rs
---

# Repo Scan Skill

Deteta tasks em múltiplos formatos: TASKMASTER, PRD, ADR, SLICE, TODO, TURBO.

## Scan Formats

| Format | Path Pattern | Parser |
|--------|-------------|--------|
| TASKMASTER | `**/TASKMASTER*.json` | JSON |
| PRD | `**/prd.md` | Markdown |
| ADR | `**/docs/ADR/*.md` | Markdown |
| SLICE | `**/*.slice.md` | Markdown + Git |
| TODO | `**/TODO.md` | Markdown |
| TURBO | `**/turbo.json` | JSON |
| SPEC | `docs/SPECS/SPEC-*.md` | Markdown |

## Output

```markdown
## Repo Scan Report

**Repo:** /srv/monorepo
**Scan Date:** YYYY-MM-DD HH:mm

### Tasks Found

| ID | Format | Title | Priority |
|----|--------|-------|----------|
| TASK-001 | SPEC-001 | Feature login | Alta |
| TASK-002 | ADR-005 | Migrate to PostgreSQL | Média |

### Human Gates
| Task | Gate | Blocker |
|------|------|---------|
| TASK-003 | security | @security-team |
| TASK-004 | PM-review | @pm |

### Priority Queue
1. Alta (3 tasks)
2. Média (5 tasks)
3. Baixa (2 tasks)
```

## Regras

1. Scaneia recursivamente
2. Ignora node_modules, .git
3. Human gates são sempre marcados
