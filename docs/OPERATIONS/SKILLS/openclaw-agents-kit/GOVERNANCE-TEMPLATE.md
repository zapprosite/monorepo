# OpenClaw Bot Governance — UNIVERSAL TEMPLATE

**Data:** 2026-04-09
**Applicable to:** Any OpenClaw bot instance

---

## Purpose

This template defines governance rules for any OpenClaw bot. It ensures:
1. Identity is configurable without losing context
2. Audio stack is protected (STT, TTS, TTS Bridge, voices)
3. Leader/sub-agent pattern is properly configured
4. Other LLMs cannot "optimize" stable configurations

---

## Identity (PATCH-ABLE)

| Field | Placeholder | Notes |
|-------|-------------|-------|
| name | `{{BOT_NAME}}` | Display name |
| theme | `{{BOT_THEME}}` | Behavior description |
| emoji | `{{BOT_EMOJI}}` | Visual marker |

**Pattern:**
```json5
identity: {
  name: "{{BOT_NAME}}",
  theme: "{{BOT_THEME}}",
  emoji: "{{BOT_EMOJI}}"
}
```

---

## Audio Stack (PROTEGIDO — NÃO ALTERAR)

### STT — Speech-to-Text

| Attribute | Value | Proibido |
|-----------|-------|----------|
| Service | wav2vec2 | Deepgram, Whisper, Silero |
| Port | 8201 | Any other port |
| Language | PT-BR Native | Other languages |

### TTS — Text-to-Speech

| Attribute | Value | Proibido |
|-----------|-------|----------|
| Endpoint | TTS Bridge :8013 | Kokoro direto |
| Voices | pm_santa, pf_dora ONLY | All other voices |

### TTS Bridge

```
OpenClaw → TTS Bridge (:8013) → Kokoro (:8880)
              └─► pm_santa ✓ → 200
              └─► pf_dora ✓ → 200
              └─► [OTHER] ✗ → 400 Bad Request
```

### LLM Primary

| Attribute | Value | Proibido |
|-----------|-------|----------|
| Model | minimax/MiniMax-M2.7 | LiteLLM como primario |
| Provider | minimax | - |
| API | anthropic-messages | - |
| Route | DIRETO (não via LiteLLM) | LiteLLM causa crash api:undefined |

### Vision

| Attribute | Value | Proibido |
|-----------|-------|----------|
| Model | litellm/qwen2.5-vl | GPT-4V, Claude Vision |
| Provider | liteLLM | - |

---

## Leader Pattern

**Leader Agent** is the primary agent, designated by `default: true`.

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
    allowAgents: ["*"]  // or specific IDs
  }
}
```

### Leader Responsibilities
- Primary LLM (chat principal)
- TTS audio output
- Sub-agent coordination
- Session memory (SOUL.md → USER.md → MEMORY.md)

---

## Sub-Agent Pattern

**Sub-Agents** are specialized workers.

```json5
{
  id: "{{SUB_AGENT_ID}}",
  workspace: "{{SUB_WORKSPACE_PATH}}",
  model: {
    primary: "{{SUB_MODEL}}"  // Can differ from leader
  },
  subagents: {
    allowAgents: []  // No sub-sub-agents
  },
  tools: {
    deny: ["browser", "canvas"]  // Restrict dangerous tools
  },
  heartbeat: {
    every: "1h",
    target: "telegram",
    to: "{{CHAT_ID}}"
  }
}
```

### Sub-Agent Use Cases
- Operations (monitoring, maintenance)
- Creative (content generation)
- Analysis (data processing)

---

## Bindings — Channel Routing

```json5
bindings: [
  { agentId: "{{LEADER_ID}}", match: { channel: "telegram" } },
  { agentId: "{{SUB_AGENT_ID}}", match: { channel: "whatsapp" } }
]
```

| Binding | Agent | Channel |
|---------|-------|----------|
| Leader | {{LEADER_ID}} | telegram |
| Worker | {{SUB_AGENT_ID}} | whatsapp |

---

## Governance Rules

### NUNCA Alterar (PROIBIDO)

- STT: wav2vec2 :8201 (only PT-BR native)
- TTS Bridge: :8013 (only access to Kokoro)
- TTS Voices: pm_santa, pf_dora ONLY
- LLM Primary: Direct to provider (not via LiteLLM)
- Leader: `default: true` designation
- TTS baseUrl pointing to Bridge (not Kokoro direct)

### Requer Aprovação

- Adicionar novo sub-agent
- Mudar binding de canal
- Alterar workspace path
- Mudar primary model
- Adicionar nova voz TTS

### Sempre Manter

- Session startup: SOUL.md → USER.md → MEMORY.md
- Identity emoji marker
- TTS Bridge como único ponto TTS
- Response prefix configured

---

## Configuration Access

### Via Docker Exec

```bash
# Read config
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f cat /data/.openclaw/openclaw.json

# Backup
docker exec openclaw-container cp /data/.openclaw/openclaw.json \
  /data/.openclaw/openclaw.json.bak-$(date +%Y%m%d)
```

### Via Coolify API

```bash
# List services
curl -s -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "http://localhost:8000/api/v1/services"

# Update service
curl -X PATCH "http://localhost:8000/api/v1/services/{uuid}" \
  -H "Authorization: Bearer $COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"docker_compose_raw": "..."}'
```

### Via Infisical SDK

```python
from infisical_sdk import InfisicalSDKClient
client = InfisicalSDKClient(host="http://127.0.0.1:8200", token=token)
secrets = client.secrets.list_secrets(project_id="...", environment_slug="dev")
```

---

## Anti-Fragility Markers

| Marker | Meaning |
|--------|---------|
| 📌 PINNED | Imutável sem aprovação |
| ⚠️ KIT PROTECTED | Parte de kit operacional |
| 🔒 LOCKED | Não pode ser alterado |
| ✅ STABLE | Verificado funcionando |

---

## Verification Checklist

```
ANTES DE PROPOR QUALQUER MUDANCA:
□ Audio stack: TTS Bridge :8013, não Kokoro direto
□ TTS Voice: pm_santa ou pf_dora
□ STT: wav2vec2 :8201, não Deepgram/Whisper
□ LLM: Primary DIRETO, não via LiteLLM
□ Identity: name + emoji configurados
□ Leader: default: true na main
```

---

**Data:** 2026-04-09
**Research:** 4 parallel agents (Context7 + Tavily)
**Template:** Universal — serve para qualquer OpenClaw bot