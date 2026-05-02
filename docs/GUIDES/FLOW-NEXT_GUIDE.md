## Flow-Next Guide

### What is Flow-Next?
Plan-first AI workflow plugin for Claude Code with 16 agent-native skills.

### Installation
```
/plugin marketplace add https://github.com/gmickel/flow-next
/plugin install flow-next
/flow-next:setup
```

### Commands

| Command | Purpose |
|---------|---------|
| /flow-next:prospect | Ranked candidate ideas |
| /flow-next:capture | Synthesize conversation into epic |
| /flow-next:interview | Deep spec refinement |
| /flow-next:plan | Epic + dependency-ordered tasks |
| /flow-next:work | Execute with re-anchoring |
| /flow-next:impl-review | Cross-model review |
| /flow-next:audit | Memory decay review |
| /flow-next:ralph-init | Autonomous overnight loop |

### How It Differs from Nexus
- Flow-Next: plugin, plan-first, re-anchoring, zero deps
- Nexus: bash script, execute-first, parallel workers, ZFS snapshots

### Best Used For
- Complex features needing planning
- Cross-model review (Claude + GPT)
- Overnight autonomous improvement

### Nexus Compatibility
Nexus still works. Use Flow-Next for planning, Nexus for parallel execution.
