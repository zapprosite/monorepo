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
      provider: "openai",
      openai: {
        // AVISO: baseUrl dentro de tts.openai é IGNORADO pelo schema do OpenClaw
        // O OpenClaw valida o schema e stripped campos não-reconhecidos.
        // Para configurar baseUrl, usar env var OPENAI_TTS_BASE_URL (via Coolify UI)
        // O valor abaixo é documentativo — a config real vem da env var.
        // baseUrl: "http://10.0.19.5:8013/v1"  // ← via env var, não aqui
        model: "kokoro",           // ← Kokoro TTS (não "tts-1")
        voice: "{{DEFAULT_VOICE}}"  // pm_santa ou pf_dora
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
| `{{VISION_MODEL}}` | Vision model | litellm/qwen2.5-vl |
| `{{DEFAULT_VOICE}}` | Default TTS voice | pm_santa (ou pf_dora) |
| `{{RESPONSE_PREFIX}}` | Prefix for responses | @nome siga! |

**Nota sobre TTS baseUrl:** `OPENAI_TTS_BASE_URL=http://10.0.19.5:8013/v1` (via env var, não no config JSON)

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
        primary: "litellm/qwen2.5-vl",
        providers: { "litellm/qwen2.5-vl": { provider: "liteLLM" } }
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
      provider: "openai",
      openai: {
        // baseUrl: via env var OPENAI_TTS_BASE_URL (não neste ficheiro)
        model: "kokoro",
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