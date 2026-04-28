# Nexus → Flow-Next Mapping

This document maps Nexus harness commands to Flow-Next skills.

## Command Mapping

### Phase Workflow

| Nexus Phase | Flow-Next Equivalent | Notes |
|---|---|---|
| `nexus.sh --spec SPEC --phase plan` | `/flow-next:plan` or `/flow-next:prospect` | Creates epic + tasks from SPEC |
| `nexus.sh --spec SPEC --phase review` | `/flow-next:impl-review` (per task) | Task-level review |
| `nexus.sh --spec SPEC --phase execute` | `/flow-next:work` | Launch workers to implement tasks |
| `nexus.sh --spec SPEC --phase verify` | Quality gates | Manual verification + tests |
| `nexus.sh --spec SPEC --phase complete` | `flowctl done <task>` | Mark tasks done |

### Other Commands

| Nexus Command | Flow-Next Equivalent | Notes |
|---|---|---|
| `nexus.sh --resume` | Not directly mapped | Nexus state not shared with Flow-Next |
| `nexus.sh --snapshot` | ZFS snapshots | Flow-Next does not manage snapshots |
| `nexus.sh --status` | `flowctl list` | Shows all epics + tasks |
| `nexus.sh --mode <mode>` | Not directly mapped | Flow-Next uses skill-based selection |

### Nexus Modes → Flow-Next Agents

Nexus 7 modes × 7 agents = 49 specialized agents:

| Nexus Mode | Flow-Next Equivalent |
|---|---|
| debug | `flow-next-work` with diagnostic skills |
| test | Test writing skills, `/flow-next:impl-review` |
| backend | Backend development skills |
| frontend | Frontend development skills |
| review | `flow-next-impl-review`, `flow-next-epic-review` |
| docs | Documentation writing skills |
| deploy | Deployment scripts + Coolify integration |

## Key Differences

1. **Re-anchoring**: Flow-Next re-reads specs before each task; Nexus does not
2. **Plan-first**: Flow-Next is plan-first by design; Nexus requires explicit phase
3. **Review**: Flow-Next has built-in review with Codex/RepoPrompt; Nexus uses agents
4. **State**: Flow-Next state lives in `.flow/`; Nexus uses `nexus-state.json`

## Running Alongside Nexus

Nexus and Flow-Next can coexist:

- Nexus manages its own `queue.json`, `state.json`
- Flow-Next manages `.flow/` directory
- No conflict between the two systems

## Migration Guide

To migrate from Nexus to Flow-Next:

1. Run `/flow-next:plan` to create Flow-Next epic from existing SPEC
2. Tasks created will be independent of Nexus queue
3. Both tools can run in parallel during transition
4. When all Flow-Next tasks done, Nexus workflow can be closed
