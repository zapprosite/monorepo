# Vibe-Kit Context Strategy

Status: `ACTIVE`

## Policy

Each task gets isolated context. Workers should read only the SPEC, the task-relevant files, and the minimum surrounding code needed to make a safe change.

## Limits

| Item | Target |
|------|--------|
| Worker prompt | Under 2,000 tokens |
| Task scope | One bounded change |
| Task runtime | 5 to 30 minutes normally |
| Context files | One task namespace per task |

Oversized tasks should be split or routed to manual/local verification. Do not let a single worker run indefinitely.

## Context Files

Runtime context lives under:

```text
.claude/vibe-kit/context/<task_id>/
```

Stress tests must use temporary context directories. They must not delete or mutate real task context unless explicitly marked destructive.

## Compression Rule

When a task requires broad context:

1. Read the SPEC.
2. Search with `rg`.
3. Read only direct dependencies.
4. Write a short task note in the task context.
5. Avoid carrying unrelated state into the next task.

## Placeholder

Automatic semantic compression is `PLACEHOLDER`. Current enforcement is operational: small tasks, isolated context, and bounded verification.
