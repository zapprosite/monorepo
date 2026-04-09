# OpenClaw Agents Kit — Universal Skill — AUDIT 2026-04-09

**Data:** 2026-04-09
**Auditor:** Claude Code
**Resultado:** ⚠️ 3 ISSUES CRÍTICAS ENCONTRADAS

---

## Resumo

| Ficheiro | Status | Issues |
|----------|--------|--------|
| `SKILL.md` | ⚠️ Minor | Import path wrong |
| `openclaw-config-template.md` | ❌ CRITICAL | model `tts-1` → `kokoro`; estrutura INVALIDA |
| `subagent-pattern.md` | ✅ OK | - |
| `coolify-access.md` | ✅ OK | - |
| `identity-patch.py` | ⚠️ Bug | Bash syntax em Python |
| `infisical-sdk.md` | ✅ OK | - |
| `GOVERNANCE-TEMPLATE.md` | ✅ OK | - |

---

## Issue 1 — CRITICAL: openclaw-config-template.md

### Problema A: model errado
```json5
// ❌ ERRADO — model: "tts-1"
tts: {
  openai: {
    model: "tts-1",  // ← OpenAI model, não Kokoro
    voice: "{{DEFAULT_VOICE}}"
  }
}

// ✅ CORRETO — model: "kokoro"
tts: {
  openai: {
    model: "kokoro",  // ← Kokoro TTS model
    voice: "pm_santa"
  }
}
```

**Por que:** O Kokoro usa model `kokoro`, não `tts-1`. `tts-1` é modelo OpenAI que não existe no Kokoro.

### Problema B: estrutura `providers.openai` invalidada pelo schema

```json5
// ❌ INVALIDO — o schema do OpenClaw não aceita providers dentro de tts
tts: {
  providers: {
    openai: {
      baseUrl: "http://10.0.19.5:8013/v1",
      model: "kokoro"
    }
  }
}

// ✅ CORRETO — estrutura FLAT que o schema aceita
tts: {
  auto: "inbound",
  provider: "openai",
  openai: {
    baseUrl: "http://10.0.19.5:8013/v1",
    model: "kokoro",
    voice: "pm_santa"
  }
}
```

**Nota:** `baseUrl` dentro de `tts.openai` é stripped pelo OpenClaw na inicialização (schema validation). A única forma de configurar é via env var `OPENAI_TTS_BASE_URL`.

### Problema C: placeholder `{{TTS_BRIDGE_URL}}` sem説明

O template usa `{{TTS_BRIDGE_URL}}` mas não documenta que este valor DEVE ser `http://10.0.19.5:8013/v1` (TTS Bridge) e NÃO pode ser Kokoro direto (`:8880`).

---

## Issue 2 — SKILL.md: import path errado

```python
# ❌ ERRADO
from docs.OPERATIONS.SKILLS.openclaw-agents-kit.infisical_sdk import fetch_secret

# ✅ CORRETO
from infisical_sdk import InfisicalSDKClient
```

**Explicação:** O pacote Python instalado é `infisical_sdk`, não um módulo no caminho docs.

---

## Issue 3 — identity-patch.py: bash syntax em Python

```python
# ❌ ERRADO — `$(...)` é bash, não Python
shutil.copy(config_path, f"{config_path}.bak-$(date +%Y%m%d)")

# ✅ CORRETO
import datetime
shutil.copy(config_path, f"{config_path}.bak-{datetime.now().strftime('%Y%m%d')}")
```

---

## Fixes Recomendados

### Fix 1: openclaw-config-template.md

```json5
// CORREÇÕES:
// 1. model: "tts-1" → model: "kokoro"
// 2. Adicionar baseUrl com nota sobre env var
// 3. Documentar TTS_BRIDGE_URL = http://10.0.19.5:8013/v1

messages: {
  responsePrefix: "{{RESPONSE_PREFIX}}",
  tts: {
    auto: "inbound",
    provider: "openai",
    openai: {
      // Nota: baseUrl só funciona via env var OPENAI_TTS_BASE_URL
      // O valor em config é ignorado pelo schema do OpenClaw
      baseUrl: "http://10.0.19.5:8013/v1",  // via env var
      model: "kokoro",
      voice: "pm_santa"
    }
  }
}
```

### Fix 2: SKILL.md

```python
# Linha 69: corrigir import
# De:
from docs.OPERATIONS.SKILLS.openclaw-agents-kit.infisical_sdk import fetch_secret
# Para:
from infisical_sdk import InfisicalSDKClient, InfisicalError
```

### Fix 3: identity-patch.py

```python
# Linha 54: usar datetime em vez de bash syntax
import datetime
if backup:
    shutil.copy(config_path, f"{config_path}.bak-{datetime.now().strftime('%Y%m%d')}")
```

---

## Items OK (Sem Issues)

### coolify-access.md
- `CoolifyClient` class implementada corretamente
- Todos os endpoints documentados
- MCP alternative correto

### subagent-pattern.md
- Leader + sub-agent pattern correto
- Channel bindings corretos
- Session startup pattern documentado

### GOVERNANCE-TEMPLATE.md
- Audio stack rules corretas (STT: wav2vec2, TTS Bridge, pm_santa/pf_dora)
- LLM primary: `minimax/MiniMax-M2.7` direto (correcto — não via LiteLLM)
- API type `anthropic-messages` correto

### infisical-sdk.md
- Client initialization correto
- Secret fetching patterns corretos
- Shell integration correto

---

## Verificação

```bash
# Verificar se modelo está correto no container
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f openclaw config get 'messages.tts.openai.model'

# Esperado: kokoro

# Verificar se voice está correto
docker exec openclaw-qgtzrmi6771lt8l7x8rqx72f openclaw config get 'messages.tts.openai.voice'

# Esperado: pm_santa
```

---

**Auditor:** Claude Code
**Data:** 2026-04-09
**Próxima auditoria:** 2026-04-16