# OpenClaw Universal Config Template

**Data:** 2026-04-09

## Template Base

```json5
{
  // ============================================
  // IDENTITY — Customize these fields
  // ============================================
  identity: {
    name: "{{BOT_NAME}}",
    theme: "{{BOT_THEME}}",
    emoji: "{{BOT_EMOJI}}"
  },

  // ============================================
  // AGENTS — Leader + Sub-agents
  // ============================================
  agents: {
    defaults: {
      model: {
        primary: "{{PRIMARY_MODEL}}"
      },
      imageModel: {
        primary: "{{VISION_MODEL}}",
        providers: {
          "{{VISION_MODEL}}": { provider: "liteLLM" }
        }
      }
    },
    list: [
      {
        // LEADER AGENT — Primary agent
        id: "{{LEADER_AGENT_ID}}",
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
          allowAgents: ["*"]  // or specific IDs
        },
        tools: {
          profile: "coding"
        }
      },
      {
        // SUB-AGENT — Optional
        id: "{{SUB_AGENT_ID}}",
        workspace: "{{SUB_WORKSPACE_PATH}}",
        model: {
          primary: "{{SUB_MODEL}}"
        },
        subagents: {
          allowAgents: []  // no sub-agents for sub-agent
        },
        tools: {
          deny: ["browser", "canvas"]
        }
      }
    ]
  },

  // ============================================
  // BINDINGS — Channel routing
  // ============================================
  bindings: [
    { agentId: "{{LEADER_AGENT_ID}}", match: { channel: "telegram" } },
    { agentId: "{{SUB_AGENT_ID}}", match: { channel: "whatsapp" } }
  ],

  // ============================================
  // MESSAGES — TTS + response settings
  // ============================================
  messages: {
    responsePrefix: "{{RESPONSE_PREFIX}}",
    tts: {
      auto: "inbound",
      openai: {
        apiKey: "{{TTS_API_KEY}}",
        baseUrl: "{{TTS_BRIDGE_URL}}",
        model: "tts-1",
        voice: "{{DEFAULT_VOICE}}"
      }
    }
  },

  // ============================================
  // CHANNELS — Telegram config
  // ============================================
  channels: {
    telegram: {
      enabled: true,
      botToken: "{{TELEGRAM_BOT_TOKEN}}",
      dmPolicy: "pairing",
      groupPolicy: "allowlist"
    }
  },

  // ============================================
  // TOOLS — Media + Agent-to-Agent
  // ============================================
  tools: {
    media: {
      audio: {
        enabled: true,
        models: []
      }
    },
    agentToAgent: {
      enabled: true,
      allow: ["{{LEADER_AGENT_ID}}", "{{SUB_AGENT_ID}}"]
    }
  }
}
```

## Placeholder Reference

| Placeholder | Description | Example |
|------------|-------------|---------|
| `{{BOT_NAME}}` | Display name | Zappro |
| `{{BOT_THEME}}` | Behavior description | assistente de voz PT-BR |
| `{{BOT_EMOJI}}` | Visual marker | 🎙️ |
| `{{LEADER_AGENT_ID}}` | Leader agent ID | main |
| `{{LEADER_NAME}}` | Leader name | CEO-MIX |
| `{{LEADER_THEME}}` | Leader theme | líder de agentes |
| `{{LEADER_EMOJI}}` | Leader emoji | 👑 |
| `{{PRIMARY_MODEL}}` | Primary LLM | minimax/MiniMax-M2.7 |
| `{{VISION_MODEL}}` | Vision model | litellm/llava |
| `{{TTS_BRIDGE_URL}}` | TTS Bridge endpoint | http://10.0.19.5:8013/v1 |
| `{{DEFAULT_VOICE}}` | Default TTS voice | pm_santa |
| `{{RESPONSE_PREFIX}}` | Prefix for responses | @nome siga! |

## Complete Example

```json5
{
  identity: {
    name: "Zappro",
    theme: "assistente de voz PT-BR, eficiente e profissional",
    emoji: "🎙️"
  },
  agents: {
    defaults: {
      model: { primary: "minimax/MiniMax-M2.7" },
      imageModel: {
        primary: "litellm/llava",
        providers: { "litellm/llava": { provider: "liteLLM" } }
      }
    },
    list: [
      {
        id: "main",
        default: true,
        workspace: "/data/workspace",
        identity: { name: "Zappro", theme: "assistente de voz", emoji: "🎙️" },
        model: { primary: "minimax/MiniMax-M2.7" },
        subagents: { allowAgents: ["*"] }
      }
    ]
  },
  bindings: [
    { agentId: "main", match: { channel: "telegram" } }
  ],
  messages: {
    responsePrefix: "@willrefimix siga!",
    tts: {
      auto: "inbound",
      openai: {
        baseUrl: "http://10.0.19.5:8013/v1",
        model: "tts-1",
        voice: "pm_santa"
      }
    }
  },
  channels: {
    telegram: {
      enabled: true,
      botToken: "8759194670:AAGHntxPUsfvbSrYNwOhBGuNUpmeCUw1-qY",
      dmPolicy: "pairing"
    }
  }
}
```

---

**Data:** 2026-04-09
**Source:** Context7 /openclaw/openclaw v2026.4.5