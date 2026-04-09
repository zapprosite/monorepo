# OpenClaw Sub-Agent Pattern — Leader + Workers

**Data:** 2026-04-09

## Concept

**Leader Agent:** Primary agent designated by `default: true`. Coordinates sub-agents. Owns the main workspace.

**Sub-Agent:** Specialized agent for specific tasks. Can have different model, workspace, tools. Communicates via `agentToAgent` tool.

```
┌─────────────────────────────────────────┐
│              LEADER                      │
│  default: true                          │
│  workspace: ~/.openclaw/workspace-main │
│  subagents.allowAgents: ["*"]          │
└────────────────────┬────────────────────┘
                     │ agentToAgent
         ┌──────────┴──────────┐
         ▼                      ▼
┌─────────────────┐  ┌─────────────────┐
│    SUB-AGENT     │  │    SUB-AGENT    │
│  id: ops        │  │  id: creative   │
│  workspace:     │  │  workspace:     │
│  ~/.workspace-ops│  │  ~/.workspace-creative
│  deny: browser  │  │  allow: canvas   │
└─────────────────┘  └─────────────────┘
```

## Leader Agent Config

```json5
{
  id: "{{LEADER_ID}}",
  default: true,
  workspace: "{{WORKSPACE_PATH}}",
  identity: {
    name: "{{LEADER_NAME}}",
    theme: "{{LEADER_THEME}}",
    emoji: "{{LEADER_EMOJI}}"
  },
  model: {
    primary: "{{PRIMARY_MODEL}}"
  },
  subagents: {
    allowAgents: ["*"]  // Allow all sub-agents
  },
  tools: {
    profile: "coding"
  }
}
```

## Sub-Agent Config

```json5
{
  id: "{{SUB_AGENT_ID}}",
  workspace: "{{SUB_WORKSPACE_PATH}}",
  model: {
    primary: "{{SUB_MODEL}}"
  },
  subagents: {
    allowAgents: []  // No sub-agents allowed
  },
  tools: {
    deny: ["browser", "canvas"]
  },
  heartbeat: {
    every: "1h",
    target: "telegram",
    to: "{{CHAT_ID}}"
  }
}
```

## Channel Bindings

```json5
bindings: [
  // Leader handles Telegram
  { agentId: "{{LEADER_ID}}", match: { channel: "telegram" } },
  // Sub-agent handles WhatsApp
  { agentId: "ops", match: { channel: "whatsapp" } },
  // Another sub-agent for Discord
  { agentId: "creative", match: { channel: "discord" } }
]
```

## Session Startup Pattern

Every agent reads on startup:

```
SOUL.md     → Identity and purpose
USER.md     → User context
memory/
  YYYY-MM-DD.md → Today's context
MEMORY.md   → Main session memory (leader only)
```

## Agent-to-Agent Communication

```json5
tools: {
  agentToAgent: {
    enabled: true,
    allow: ["leader", "ops", "creative"]
  }
}
```

Send message between agents:

```bash
curl -X POST http://127.0.0.1:18789/hooks/agent \
  -H 'x-openclaw-token: SECRET' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Task description",
    "name": "AgentName",
    "model": "provider/model"
  }'
```

## Universal Template (Leader = CEO pattern)

```json5
{
  agents: {
    defaults: {
      heartbeat: { every: "30m", target: "last" }
    },
    list: [
      {
        id: "leader",
        default: true,
        workspace: "~/.openclaw/workspace-leader",
        identity: { name: "CEO-MIX", theme: "líder de agentes", emoji: "👑" },
        model: { primary: "minimax/MiniMax-M2.7" },
        subagents: { allowAgents: ["*"] }
      },
      {
        id: "ops",
        workspace: "~/.openclaw/workspace-ops",
        model: { primary: "minimax/MiniMax-M2.1" },
        subagents: { allowAgents: [] },
        tools: { deny: ["browser"] }
      }
    ]
  },
  bindings: [
    { agentId: "leader", match: { channel: "telegram" } },
    { agentId: "ops", match: { channel: "whatsapp" } }
  ]
}
```

## Best Practices

1. **Only one leader** — `default: true` on exactly one agent
2. **Sub-agent isolation** — each sub-agent has own workspace
3. **Minimal prompt for sub-agents** — use `promptMode: "minimal"` to reduce context
4. **Tool restrictions** — deny dangerous tools on sub-agents
5. **Heartbeat monitoring** — configure heartbeat for critical sub-agents

## Prompt Mode Reference

| Mode | Used For | Includes |
|------|----------|----------|
| `full` | Leader | All sections |
| `minimal` | Sub-agents | Tooling, Safety, Workspace, Runtime only |
| `none` | Minimal | Identity line only |

---

**Data:** 2026-04-09
**Source:** Context7 /openclaw/openclaw v2026.4.5