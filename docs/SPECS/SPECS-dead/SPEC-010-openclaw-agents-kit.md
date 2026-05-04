# SPEC-010: — Universal Sub-Agent Governance

**Status:** DRAFT
**Data:** 2026-04-09
**Autor:** will + Claude Code (multi-agent research)

---

## Objetivo

Criar um kit de skills para Claude Code que permite gerenciar bots , com:
1. Configuração de identidade e persona (sem perder contexto existente)
2. Sub-agents hierárquicos com leader pattern
3. Acesso programático via Coolify API + 
4. Governance template universal que serve para qualquer 

---

## Research — Cross-Source Synthesis

### (Context7)

**Leader Agent Pattern:**
```json5
agents: {
  list: [
    { id: "main", default: true, workspace: "~/./workspace" }
  ]
}
```
- Leader designado por `default: true` — apenas 1 por config
- Sub-agents: `subagents.allowAgents: ["*"]` ou lista específica

**Channel Routing (Bindings):**
```json5
bindings: [
  { agentId: "main", match: { channel: "telegram" } },
  { agentId: "ops", match: { channel: "whatsapp" } }
]
```

**Session Startup (SOUL.md → USER.md → MEMORY.md):**
```
1. Read SOUL.md → identity
2. Read USER.md → user context
3. Read memory/YYYY-MM-DD.md → today's context
4. If MAIN SESSION → read MEMORY.md
```

**Prompt Modes:**
- `full` (default): todos os módulos
- `minimal`: sub-agents — omite Skills, Memory Recall, Self-Update
- `none`: apenas identity line

---

### Coolify API (MCP Server)

**Auth:** Bearer token em header `Authorization: Bearer <token>`
**Scopes:** read-only, read:sensitive, view:sensitive, *
**Base URL:** `http://<server>:8000/api/v1`

**38 tools via MCP** para gestão de serviços, docker compose, aplicações.

---

### (Python)

**Client with caching:**
```python
client = (host="http://127.0.0.1:8200", cache_ttl=60)
```

**Error handling:**
```python
from _sdk import , 
try:
    secret = client.secrets.get_secret_by_name(...)
except :
    raise
```

---

## Arquitetura do Kit

```
docs/OPERATIONS/SKILLS//
├── SKILL.md                    # Main skill — quando usar e como
├── .md  # Template universal JSON5
├── subagent-pattern.md          # Leader + sub-agents pattern
├── coolify-access.md            # Coolify API + MCP tools
├── .md            # 
├── identity-patch.md            # Patch identity sem perder contexto
└── GOVERNANCE-TEMPLATE.md     # Universal governance template
```

---

## Ficheiros a Criar

### 1. `docs/OPERATIONS/SKILLS//SKILL.md`

**Skill principal** — carregado quando user pede para configurar/gerenciar .

### 2. `docs/OPERATIONS/SKILLS//.md`

**Template universal** para config :

```json5
{
  identity: {
    name: "{{BOT_NAME}}",
    theme: "{{BOT_THEME}}",
    emoji: "{{BOT_EMOJI}}"
  },
  agents: {
    defaults: {
      model: { primary: "{{PRIMARY_MODEL}}" },
      imageModel: {
        primary: "{{VISION_MODEL}}",
        providers: { "{{VISION_MODEL}}": { provider: "liteLLM" } }
      }
    },
    list: [
      {
        id: "{{LEADER_AGENT_ID}}",
        default: true,
        workspace: "{{WORKSPACE_PATH}}",
        identity: {
          name: "{{LEADER_NAME}}",
          theme: "{{LEADER_THEME}}",
          emoji: "{{LEADER_EMOJI}}"
        },
        model: { primary: "{{PRIMARY_MODEL}}" },
        subagents: { allowAgents: ["*"] }
      }
    ]
  },
  bindings: [
    { agentId: "{{LEADER_AGENT_ID}}", match: { channel: "telegram" } }
  ],
  messages: {
    tts: {
      auto: "inbound",
      openai: {
        baseUrl: "{{TTS_BRIDGE_URL}}",
        model: "tts-1",
        voice: "{{DEFAULT_VOICE}}"
      }
    }
  }
}
```

### 3. `docs/OPERATIONS/SKILLS//subagent-pattern.md`

**Leader + Sub-agents pattern:**

```json5
{
  agents: {
    list: [
      {
        id: "leader",
        default: true,
        workspace: "~/./workspace-leader",
        identity: { name: "{{LEADER_NAME}}", theme: "{{LEADER_THEME}}", emoji: "{{LEADER_EMOJI}}" },
        model: { primary: "{{PRIMARY_LLM}}" },
        subagents: { allowAgents: ["*"] },
        tools: { profile: "coding" }
      },
      {
        id: "ops",
        workspace: "~/./workspace-ops",
        model: { primary: "{{OPS_LLM}}" },
        subagents: { allowAgents: [] },
        tools: { deny: ["browser", "canvas"] }
      }
    ]
  },
  bindings: [
    { agentId: "leader", match: { channel: "telegram" } },
    { agentId: "ops", match: { channel: "whatsapp" } }
  ]
}
```

### 4. `docs/OPERATIONS/SKILLS//coolify-access.md`

**Coolify API patterns:**

```python
# Init Coolify client
COOLIFY_TOKEN = os.environ.get("COOLIFY_ACCESS_TOKEN")
COOLIFY_BASE = os.environ.get("COOLIFY_BASE_URL", "http://127.0.0.1:8000")

# Headers
HEADERS = {
    "Authorization": f"Bearer {COOLIFY_TOKEN}",
    "Content-Type": "application/json"
}

# List applications
def list_applications():
    resp = requests.get(f"{COOLIFY_BASE}/api/v1/applications", headers=HEADERS)
    return resp.json()

# Update service
def update_service(uuid, docker_compose_raw):
    resp = requests.patch(
        f"{COOLIFY_BASE}/api/v1/services/{uuid}",
        headers=HEADERS,
        json={"docker_compose_raw": docker_compose_raw}
    )
    return resp.json()
```

### 5. `docs/OPERATIONS/SKILLS//.md`

**:**

```python
from _sdk import , 

def fetch_secret(secret_name, project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37"):
    token = os.environ.get("INFISICAL_TOKEN", "")
    if not token and os.path.exists("/srv/ops/secrets/.service-token"):
        token = open("/srv/ops/secrets/.service-token").read().strip()

    client = (host="http://127.0.0.1:8200", token=token)
    try:
        secret = client.secrets.get_secret_by_name(
            secret_name=secret_name,
            project_id=project_id,
            environment_slug="dev",
            secret_path="/"
        )
        return secret.secret_value
    except :
        return None

def fetch_all_secrets(project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37"):
    token = os.environ.get("INFISICAL_TOKEN", "")
    if not token and os.path.exists("/srv/ops/secrets/.service-token"):
        token = open("/srv/ops/secrets/.service-token").read().strip()

    client = (host="http://127.0.0.1:8200", token=token)
    secrets = client.secrets.list_secrets(
        project_id=project_id,
        environment_slug="dev",
        secret_path="/"
    )
    return {s.secret_key: s.secret_value for s in secrets.secrets}
```

### 6. `docs/OPERATIONS/SKILLS//identity-patch.md`

**Patch identity sem perder contexto:**

```python
import json

def patch_identity(_json_path, identity_updates):
    """
    Patch identity in .json WITHOUT losing existing context.
    Reads existing config, merges identity, writes back.
    """
    with open(_json_path, 'r') as f:
        config = json.load(f)

    # Ensure identity block exists
    if 'identity' not in config:
        config['identity'] = {}

    # Merge identity updates (preserve existing keys)
    config['identity'].update(identity_updates)

    with open(_json_path, 'w') as f:
        json.dump(config, f, indent=2)

    return config['identity']

# Usage
patch_identity("/data/./.json", {
    "name": "Zappro",
    "theme": "assistente de voz PT-BR",
    "emoji": "🎙️"
})
```

### 7. `docs/OPERATIONS/SKILLS//GOVERNANCE-TEMPLATE.md`

**Universal governance template:**

```markdown
# — UNIVERSAL TEMPLATE

## Applicable To
Any .

## Identity (PATCH-ABLE — não perder contexto)

| Field | Value | Notes |
|-------|-------|-------|
| name | {{BOT_NAME}} | Identifying name |
| theme | {{BOT_THEME}} | Behavior description |
| emoji | {{BOT_EMOJI}} | Visual marker |

## Audio Stack (PROTEGIDO)

| Component | Config | Proibido |
|-----------|--------|----------|
| STT | wav2vec2 :8201 | Deepgram, Whisper |
| TTS Bridge | :8013 | |
| TTS Voices | pm_santa, pf_dora | Outras vozes |
| LLM Primary | openrouter/hermes-brain | LiteLLM como primario |
| Vision | litellm/llava | Outros VL |

## Leader Pattern

```json5
{
  id: "{{LEADER_ID}}",
  default: true,
  workspace: "{{WORKSPACE_PATH}}",
  identity: { name: "{{LEADER_NAME}}", theme: "{{LEADER_THEME}}", emoji: "{{LEADER_EMOJI}}" },
  model: { primary: "{{PRIMARY_MODEL}}" },
  subagents: { allowAgents: ["*"] }
}
```

## Sub-Agent Pattern

```json5
{
  id: "{{SUB_AGENT_ID}}",
  workspace: "{{SUB_WORKSPACE_PATH}}",
  model: { primary: "{{SUB_MODEL}}" },
  subagents: { allowAgents: [] },
  tools: { deny: ["browser", "canvas"] }
}
```

## Governance Rules

### NUNCA Alterar
- Audio stack (STT, TTS, TTS Bridge)
- Primary LLM model designation
- Leader agent default: true
- TTS voice filter (pm_santa, pf_dora only)

### Requer Aprovação
- Adicionar novo sub-agent
- Mudar binding de canal
- Alterar workspace path

### Sempre Manter
- Session startup: SOUL.md → USER.md → MEMORY.md
- Identity emoji marker
- TTS Bridge como único ponto TTS
```

---

## Success Criteria

1. Kit criado em `docs/OPERATIONS/SKILLS//`
2. SPEC-010 documenta o kit
3. Skill carregável via /
4. Template universal serve para qualquer 
5. identity-patch mantém contexto existente
6. Coolify access via MCP ou API direto
7. 

---

## Dependencies

- Coolify API access (MCP server or direct API)
- 
- 

---

**Last updated:** 2026-04-09
**Sources:** Context7 //, Coolify MCP docs, 
**Research:** 4 parallel agents synthesized