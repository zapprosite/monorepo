description: Autonomous Cursor AI-like loop: Infisical check → Gitea CI → Research → Refactor → Ship → Mirror
argument-hint: [--dry-run|--resume]
---

# Cursor AI-like Autonomous Loop

## Workflow

This command implements the full autonomous loop as defined in SPEC-CURSOR-LOOP.md:

1. Check Infisical secrets
2. Run Gitea Actions CI pipeline
3. Research (MCP Tavily + Context7)
4. Refactor code
5. Ship (commit + PR)
6. Mirror to both remotes (origin + gitea)

## Usage

```bash
/computer-loop                    # Start from current phase
/computer-loop --resume           # Resume from last checkpoint
/computer-loop --dry-run          # Simulate without making changes
```

## Phases

| Phase | Name | Description |
|-------|------|-------------|
| 1 | Initialization | Bootstrap environment, detect project type |
| 2 | Development | SPEC, plan, build, test |
| 3 | Review | Code review, quality checks |
| 4 | Deploy | Deploy validation, smoke tests |

## Prerequisites

- `~/.claude/pipeline.json` exists (run bootstrap if not)
- `/srv/monorepo` is the active project
- Git working directory is clean or checkpoint exists

## Commands

- `/computer-loop --status` — Show current phase and progress
- `/approve` — Acknowledge current gate and continue
- `/abort` — Stop the loop