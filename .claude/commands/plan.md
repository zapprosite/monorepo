# /plan — Planning

## Description

Break work into small verifiable tasks with acceptance criteria.

## Actions

1. Read SPEC-\*.md if exists for current feature
2. List pending tasks from `docs/SPECS/tasks.md`
3. Break into incremental steps (< 30 min each)
4. Add acceptance criteria per task
5. Update `tasks/pipeline.json` if needed

## Task Format

```
- [ ] Task description
  - Acceptance: verifiable outcome
  - Estimated: X minutes
```

## When

- Start of new feature
- After `/spec` creates SPEC
- Before implementation

## Refs

- `AGENTS.md` spec-driven flow
- `SPEC-TEMPLATE.md`
