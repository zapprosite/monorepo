# Plan: OpenClaw Persona + Audio Stack Configuration

## Context

O OpenClaw Bot tem configuracoes espalhadas e a persona nao esta documentada. O bot esta mencionando servicos antigos (Deepgram) que ja nao sao usados. E preciso:

1. Documentar a stack de audio (VL + TTS + STT)
2. Criar persona alinhada (nome, comportamento,remembered)
3. Bloquear vozes nao-PT-BR (TTS Bridge ja feito)
4. Criar docs de governance para prevnir LLM "esquecer" configuracoes

## Dependency Graph

```
OpenClaw Bot (Telegram)
    │
    ├── Identity/Persona (name, theme, comportamento)
    │       └── docs/GOVERNANCE/OPENCLAW_DEBUG.md (atualizado)
    │
    ├── Speech Pipeline
    │   ├── STT: wav2vec2 :8201 (PT-BR native) — JA CONFIGURADO
    │   ├── LLM: MiniMax M2.7 (primario) + LiteLLM/llava (vision)
    │   └── TTS: TTS Bridge :8013 (SO pm_santa + pf_dora) — JA CONFIGURADO
    │
    ├── Audio Files Reference
    │   └── /data/.openclaw/openclaw.json (persona + config)
    │
    └── Governance
        ├── GUARDRAILS.md (proteger config)
        └── ANTI-FRAGILITY.md (markers de estabilidade)
```

## Tasks

### Task 1: Documentar Stack de Audio PT-BR (SPEC-OpenClaw-Persona)

**Ficheiro:** `docs/specflow/SPEC-009-openclaw-persona-audio-stack.md`

**Conteudo:**
- Arquitetura completa (STT → LLM → TTS)
- Vozes: pm_santa (masculino padrao), pf_dora (feminino fallback)
- STT: wav2vec2 :8201 — APENAS PT-BR, NAO USAR Deepgram/Whisper
- TTS Bridge: :8013 — APENAS pm_santa/pf_dora, todas outras retornam 400
- LLM primário: minimax/MiniMax-M2.7 (direto, NAO via LiteLLM)
- Vision: litellm/llava via LiteLLM
- **PROIBIDO:** Deepgram, Whisper (local ou cloud), Kokoro direto (sem bridge)

**Criterio de aceite:** SPEC criado com diagrama de arquitetura e checklist de voces/STT proibidos

---

### Task 2: Criar/Atualizar openclaw.json com Persona

**Ficheiro:** `/data/.openclaw/openclaw.json` (dentro do container)

**Alteracoes:**
```json
{
  "identity": {
    "name": "Zappro",
    "theme": "assistente de voz PT-BR, eficiente, profissional",
    "emoji": "🎙️"
  },
  "agents": {
    "defaults": {
      "model": { "primary": "minimax/MiniMax-M2.7" },
      "imageModel": {
        "primary": "litellm/llava",
        "providers": { "litellm/llava": { "provider": "liteLLM" } }
      }
    }
  },
  "messages": {
    "tts": {
      "auto": "inbound",
      "openai": {
        "baseUrl": "http://10.0.19.5:8013/v1",
        "model": "tts-1",
        "voice": "pm_santa"
      }
    }
  }
}
```

**Proibido no openclaw.json:**
- Deepgram como STT
- Qualquer outra voz Kokoro alem de pm_santa/pf_dora
- baseUrl de TTS apontando para Kokoro direto

**Criterio de aceite:** openclaw.json atualizado, smoke test passa 15/15

---

### Task 3: Criar Rules para LLM naoAlterar Audio Stack

**Ficheiro:** `.claude/rules/openclaw-audio-governance.md`

**Conteudo:**
- REGRA: Nunca propor Mudanca de TTS para outro provider
- REGRA: Nunca mencionar Deepgram como alternativa
- REGRA: Never suggest changing voice to non-PT-BR
- REGRA: TTS Bridge e o unico ponto de acesso ao Kokoro
- Stack atual: pm_santa + pf_dora (apenas), wav2vec2 (apenas), MiniMax M2.7 (apenas)

**Criterio de aceite:** Ficheiro criado e referenciado em CLAUDE.md

---

### Task 4: Atualizar GUARDRAILS.md com Audio Stack

**Ficheiro:** `docs/GOVERNANCE/GUARDRAILS.md`

**Adicionar secao:**
```
### Voice/Audio Pipeline — PROTEGIDO

| Config | Valor | Proibido |
|--------|-------|----------|
| STT | wav2vec2 :8201 | Deepgram, Whisper |
| TTS Voice | pm_santa, pf_dora | Qualquer outra |
| TTS Endpoint | TTS Bridge :8013 | Kokoro direto |
| LLM Primario | minimax/MiniMax-M2.7 | LiteLLM para primario |
| Vision | litellm/llava | Outros VL models |
```

**Criterio de aceite:** GUARDRAILS.md atualizado com tabela de audio

---

### Task 5: Verificar TTS Bridge Bloqueia Todas Outras Vozes

**Testar:**
```bash
# deve retornar 400
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"test","voice":"af_sarah"}' -w "%{http_code}\n"

# deve retornar 200
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"test","voice":"pm_santa"}' -w "%{http_code}\n"
```

**Criterio de aceite:** af_sarah → 400, pm_santa → 200

---

### Task 6: Prune de ficheiros de audio nao-PT-BR

**Verificar:**
```bash
# Procurar ficheiros de audio temporarios no host
find /tmp -name "*.wav" -o -name "*.mp3" -o -name "*.ogg" 2>/dev/null | head -20

# Limpar se existirem vozes de teste nao-PT-BR
# (NAO apagar configs, apenas audio files)
```

**Criterio de aceite:** /tmp limpo de audio files nao-PT-BR

---

## Checkpoints

1. **ANTES:** Snapshot ZFS antes de modificar openclaw.json
2. **DEPOIS:** SPEC-009 criado com arquitetura
3. **DEPOIS:** openclaw.json atualizado com identity
4. **DEPOIS:** smoke test passa 15/15
5. **DEPOIS:** GUARDRAILS.md atualizado
6. **DEPOIS:** Rule criada para LLM

## Verification

```bash
# Full smoke test
LITELLM_KEY="${LITELLM_KEY}" \
MINIMAX_API_KEY="sk-cp-uA1oy3YNYtSeBSs4-o3kFktK" \
bash tasks/smoke-tests/pipeline-openclaw-voice.sh

# Voice filter verification
curl -sf http://localhost:8013/v1/audio/voices
# Expected: {"voices":["pm_santa","pf_dora"]}
```