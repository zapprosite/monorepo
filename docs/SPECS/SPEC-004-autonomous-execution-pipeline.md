---
spec_id: SPEC-004
title: Autonomous Execution Pipeline
status: active
date: 2026-04-24
owner: Platform Engineering
supersedes:
  - SPEC-090
  - SPEC-091
  - docs/SPECs/SPEC-PLAN-MODE
---

# SPEC-004: Autonomous Execution Pipeline

## Objective

The pipeline must turn intent into work without spawning noisy, fake-parallel LLMs.
LLMs are workers only when they add value. Typecheck, lint, tests, secrets scan,
git status, and smoke checks are commands.

The active queue is `tasks/pipeline.json`.

## Pipeline Model

```
INTENT
  -> SPEC
  -> TASK BREAKDOWN
  -> QUEUE
  -> EXECUTE
  -> VERIFY
  -> SHIP OR ISSUE
```

## Phases

| Phase | Name | Purpose | Gate |
|---:|---|---|---|
| 0 | Intake | Normalize user intent into spec/task queue | Spec exists |
| 1 | Audit | Find drift, secrets, obsolete docs, runtime facts | Findings recorded |
| 2 | Implement | Apply bounded code/docs changes | Diff exists |
| 3 | Verify | Run static checks, tests, smoke where safe | Required checks pass or issue opened |
| 4 | Ship | PR/commit/issue depending on result | State written |

## Worker Policy

Use parallel workers only for independent work:

- Spec audit.
- Runtime audit.
- Disjoint file edits.
- Verification while local implementation continues.

Do not spawn agents for:

- `pnpm test`, `pnpm lint`, `git diff`, `rg`, `jq`.
- Reading the same file set twice.
- Work that blocks the next local step.

## State Files

| File | Purpose |
|---|---|
| `tasks/pipeline.json` | Active executable queue |
| `tasks/pipeline-state.json` | Current state summary |
| `tasks/agent-states/*.json` | Historical agent state snapshots |
| `tasks/smoke-tests/results/*.json` | Smoke output |
| `tasks/hermes-control-plane-tasks.md` | Human-readable backlog |

## Required Queue Schema

```json
{
  "pipeline": "HCP-YYYYMMDD",
  "status": "queued|running|blocked|completed",
  "objective": "string",
  "specs": ["SPEC-001"],
  "phases": [],
  "queue": []
}
```

Each task must include:

- `id`
- `priority`
- `phase`
- `title`
- `status`
- `owner`
- `paths`
- `depends_on`
- `acceptance`

## Acceptance Criteria

- `tasks/pipeline.json` is valid JSON and references `SPEC-001..004`.
- Each task has dependencies and acceptance criteria.
- P0 tasks address secrets, spec drift, runtime control, and embedding consistency.
- Old pipeline state is not treated as active work unless re-queued.
- Pipeline can be executed by Hermes/mclaude workers or manually by Codex.

