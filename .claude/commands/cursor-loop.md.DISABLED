---
description: Autonomous Cursor AI-like loop: Infisical check → Gitea CI → Research → Refactor → Ship → Mirror
argument-hint: [--dry-run|--resume]
---

# Cursor AI-like Autonomous Loop

## Workflow

This command implements the full autonomous loop as defined in SPEC-CURSOR-LOOP.md:

### 1. LEADER: Infisical Check
- Verify all required secrets in Infisical
- Validate env vars vs required secrets
- If gaps found → emit Bootstrap Effect JSON and STOP

### 2. GITEA CI: Run Tests
- Push feature branch to Gitea
- Trigger CI pipeline: `yarn check-types && yarn build && yarn test`
- If FAIL → enter Research + Refactor loop
- If PASS → continue to Ship

### 3. RESEARCH + REFACTOR (5 agents parallel)
When CI fails, trigger:
1. **cursor-loop-research** (MCP Tavily + Context7): Analyze failure
2. **cursor-loop-refactor** (MCP Tavily + Context7): Apply fixes
3. **cursor-loop-spec** (SPEC updater): Update SPEC.md
4. **cursor-loop-debug** (/debug): Generate fix recommendations
5. **cursor-loop-leader**: Coordinate and decide

Then loop back to [2] Gitea CI

### 4. SHIP + SYNC (on CI PASS)
- **cursor-loop-ship**: `git add -A` → semantic commit → push → PR
- **cursor-loop-review**: AI review via MCP GitHub
- **cursor-loop-sync**: Trigger ai-context-sync
- **cursor-loop-mirror**: Merge main → new random feature branch

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

## Random Branch Name Format

When mirroring, create new branch with format:
`[adjective]-[noun]-[hex]`

Examples:
- `quantum-dispatch-a7k2p`
- `iron-codex-m9x3n`
- `stellar-pivot-q2r8t`

## Usage

```bash
//cursor-loop              # Full autonomous loop
//cursor-loop --dry-run   # Simulate without executing
//cursor-loop --resume    # Resume from last checkpoint
```
