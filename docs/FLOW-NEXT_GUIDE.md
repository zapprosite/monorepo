# Flow-Next Integration Guide

Flow-Next is integrated into the monorepo at `.claude/flow-next/` as a plugin for Claude Code.

## Quick Start

### 1. Verify Setup
```bash
cd /srv/monorepo
./.flow/bin/flowctl list
```

### 2. Create a New Epic
```bash
./.flow/bin/flowctl epic create --title "My Feature"
```

### 3. Start Working
```bash
./.flow/bin/flowctl start <task-id>
```

### 4. Complete a Task
```bash
./.flow/bin/flowctl done <task-id> --summary-file summary.md --evidence-json evidence.json
```

## Available Commands

| Command | Description |
|---------|-------------|
| `.flow/bin/flowctl list` | Show all epics and tasks |
| `.flow/bin/flowctl show <epic>` | Show epic details |
| `.flow/bin/flowctl ready` | List tasks ready to work on |
| `.flow/bin/flowctl start <task>` | Claim a task |
| `.flow/bin/flowctl done <task>` | Complete a task |
| `.flow/bin/flowctl validate` | Validate .flow/ structure |

## Flow-Next Skills

Flow-Next provides these Claude Code skills:

- `/flow-next:plan` - Create epic + tasks from SPEC
- `/flow-next:prospect` - Prospect a feature idea
- `/flow-next:work` - Start working on an epic
- `/flow-next:setup` - Setup flow-next in a new project
- `/flow-next:monorepo-audit` - Audit monorepo state
- `/flow-next:spec-from-chat` - Generate SPEC from conversation
- `/flow-next:deploy-check` - Validate deployment readiness
- `/flow-next:nexus` - Nexus command mapping

## Documentation

- [Nexus to Flow-Next Mapping](../docs/NEXUS_FLOWNEXT_MAPPING.md)
- [Flow-Next Usage](../.flow/usage.md)

## Nexus Compatibility

Nexus and Flow-Next can run alongside each other. See [Nexus to Flow-Next Mapping](../docs/NEXUS_FLOWNEXT_MAPPING.md) for details.
