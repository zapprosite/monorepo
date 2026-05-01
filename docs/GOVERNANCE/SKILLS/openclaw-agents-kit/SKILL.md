# OpenClaw Agents Kit — Universal Skill

**Data:** 2026-04-09
**Autor:** will + Claude Code

---

## Objetivo

Gerenciar bots OpenClaw de forma universal: configurar identity, sub-agents, accesso a Coolify/Infisical, e governance template sem perder contexto existente.

## Quando Usar

- `/openclaw-agents-kit` — quando precisar configurar ou auditar um bot OpenClaw
- `Preciso configurar o identity do bot` — usar identity-patch.md
- `Quero adicionar sub-agents` — usar subagent-pattern.md
- `Preciso acessar Coolify` — usar coolify-access.md
- `Preciso de secrets do vault` — usar infisical-sdk.md
- `Preciso de governance template` — usar GOVERNANCE-TEMPLATE.md

## Como Executar

### 1. Identificar o Bot
```bash
# Encontrar container OpenClaw
docker ps --filter "name=openclaw" --format "{{.Names}}"

# Local do config
OPENCLAW_CONFIG="${OPENCLAW_CONFIG:-/data/.openclaw/openclaw.json}"
```

### 2. Carregar Governance Template
```bash
cat docs/OPERATIONS/SKILLS/openclaw-agents-kit/GOVERNANCE-TEMPLATE.md
```

### 3. Patch Identity (sem perder contexto)
```python
from docs.OPERATIONS.SKILLS.openclaw-agents-kit.identity_patch import patch_identity
patch_identity("/data/.openclaw/openclaw.json", {
    "name": "Zappro",
    "theme": "assistente de voz PT-BR, eficiente",
    "emoji": "🎙️"
})
```

### 4. Verificar Audio Stack
```bash
# TTS Bridge
curl -sf http://localhost:8013/health

# Voices
curl -sf http://localhost:8013/v1/audio/voices

# STT
curl -sf http://localhost:8201/health
```

### 5. Accessar Coolify
```bash
# Via MCP ou API direto
COOLIFY_TOKEN="${COOLIFY_ACCESS_TOKEN}"
curl -s -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "http://localhost:8000/api/v1/applications"
```

### 6. Fetch Secrets via Infisical
```python
# O pacote instalado é 'infisical_sdk', não um módulo local
from infisical_sdk import InfisicalSDKClient, InfisicalError

client = InfisicalSDKClient(
    host="http://127.0.0.1:8200",
    token=os.environ.get("INFISICAL_TOKEN", ""),
    cache_ttl=60
)
secret = client.secrets.get_secret_by_name(
    secret_name="LITELLM_MASTER_KEY",
    project_id="e42657ef-98b2-4b9c-9a04-46c093bd6d37",
    environment_slug="dev",
    secret_path="/",
    expand_secret_references=True,
    view_secret_value=True
)
LITELLM_KEY = secret.secret_value
```

## Ficheiros no Kit

| Ficheiro | Purpose |
|----------|---------|
| `SKILL.md` | Este ficheiro — overview |
| `openclaw-config-template.md` | Template universal JSON5 |
| `subagent-pattern.md` | Leader + sub-agents pattern |
| `coolify-access.md` | Coolify API + MCP patterns |
| `infisical-sdk.md` | Infisical SDK patterns |
| `identity-patch.md` | Patch identity sem perder contexto |
| `GOVERNANCE-TEMPLATE.md` | Universal governance template |

## Audio Stack (PROTEGIDO)

O bot DEVE usar apenas:

| Componente | Valor | Proibido |
|-----------|-------|----------|
| STT | wav2vec2 :8201 | Deepgram, Whisper |
| TTS Bridge | :8013 | Kokoro direto |
| TTS Voices | pm_santa, pf_dora | Todas outras |
| LLM Primary | minimax/MiniMax-M2.7 | LiteLLM como primario |
| Vision | litellm/qwen2.5-vl | Outros VL |

## Leader Pattern

O leader agent e o agente principal, designado por `default: true`.
Sub-agents podem ser adicionados com `subagents.allowAgents`.

## Governance

Ver GOVERNANCE-TEMPLATE.md para template universal.

---

**Autor:** will + Claude Code
**Research:** 4 parallel agents (Context7 + Tavily)
**Data:** 2026-04-09