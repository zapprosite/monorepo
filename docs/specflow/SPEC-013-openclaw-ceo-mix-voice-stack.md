# SPEC-013: CEO MIX — Voice Stack Definitiva

**Status:** DRAFT
**Created:** 2026-04-09
**Author:** will + Claude Code
**Source:** Estudo do source code OpenClaw (`/home/will/Downloads/openclaw-main/openclaw-main`)

---

## Resumo

Este documento define a configuração **definitiva e corrigida** para o CEO MIX (OpenClaw Bot voice-first). Foi derivada do estudo do source code do OpenClaw para entender como os fluxos de áudio realmente funcionam.

**Stack Corretada:**
- **STT:** wav2vec2 `:8201` (não Whisper, não LiteLLM)
- **TTS:** TTS Bridge `:8013` → Kokoro `:8880` (vozes filtradas: pm_santa, pf_dora)
- **VL:** litellm/llava via LiteLLM (input: ["text", "image"])

---

## Arquitetura (do Source Code)

```
CEO MIX (Telegram)
       │
       ├─► INBOUND VOICE
       │         │
       │         └─► Telegram envia audio/ogg
       │                    │
       │                    ▼
       │         transcribeFirstAudio()
       │                    │
       │                    ├─► normalizeMediaAttachments()
       │                    │
       │                    └─► runAudioTranscription()
       │                               │
       │                    ┌──────────┴──────────┐
       │                    ▼                     ▼
       │         buildMediaUnderstanding   ┌─────────────────┐
       │              Registry              │ STT Provider    │
       │                    │               │ (wav2vec2)     │
       │                    │               │                 │
       │                    │               │ POST           │
       │                    │               │ /audio/transc  │
       │                    │               │ multipart/      │
       │                    │               │ form-data       │
       │                    │               └─────────────────┘
       │                    ▼
       │         providers.openai.transcribeAudio()
       │                    │
       │                    ▼
       │         transcribeOpenAiCompatibleAudio()
       │         POST ${baseUrl}/audio/transcriptions
       │         Content-Type: multipart/form-data
       │         Body: file (audio) + model + language
       │
       ├─► VL (Image Understanding)
       │         │
       │         └─► describeImagesWithModel()
       │                    │
       │                    ▼
       │         litellm/llava via LiteLLM proxy
       │         input: ["text", "image"]
       │         Context: { messages: [{ role: "user", content: [
       │           { type: "image", data: "<base64>", mimeType: "image/jpeg" },
       │           { type: "text", text: "<prompt>" }
       │         ]}]}
       │
       └─► OUTBOUND VOICE (TTS)
                 │
                 └─► maybeApplyTtsToPayload()
                          │
                          ▼
                 ┌─────────────────┐
                 │ TTS Provider    │
                 │ (openai)       │
                 │                 │
                 │ POST            │
                 │ /audio/speech   │
                 │ Content-Type:   │
                 │ application/json│
                 └─────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ TTS Bridge      │
                 │ (:8013)         │
                 │                 │
                 │ Filtra voz:     │
                 │ pm_santa ✓      │
                 │ pf_dora  ✓      │
                 │ af_sarah ✗ 400  │
                 └─────────────────┘
                          │
                          ▼
                 ┌─────────────────┐
                 │ Kokoro TTS      │
                 │ (:8880)         │
                 └─────────────────┘
```

---

## Configuração Correta (openclaw.json)

### O que NÃO usar (Errado)

```json
// ❌ ERRADO - Não usar LiteLLM para TTS Bridge
{
  "messages": {
    "tts": {
      "provider": "openai",
      "providers": {
        "openai": {
          "baseUrl": "http://10.0.1.1:4000/v1"  // LiteLLM - NÃO é o TTS Bridge!
        }
      }
    }
  }
}

// ❌ ERRADO - Não usar Whisper via LiteLLM
{
  "tools": {
    "media": {
      "audio": {
        "transcription": {
          "provider": "liteLLM",
          "model": "whisper-1"
        }
      }
    }
  }
}
```

### O que USAR (Correto)

```json
// ✅ CORRETO - CEO MIX Config
{
  "agents": {
    "defaults": {
      "model": "minimax/MiniMax-M2.7",
      "workspace": "/data/workspace"
    }
  },
  "messages": {
    "tts": {
      "provider": "openai",
      "auto": "inbound",
      "providers": {
        "openai": {
          "baseUrl": "http://10.0.19.5:8013/v1",
          "voice": "pm_santa",
          "apiKey": "not-needed"
        }
      }
    }
  },
  "models": {
    "providers": {
      "litellm": {
        "apiKey": "sk-zappro-lm-2026-xxx",
        "baseUrl": "http://10.0.1.1:4000",
        "models": [
          {
            "id": "llava",
            "input": ["text", "image"]
          },
          {
            "id": "nomic-embed"
          }
        ]
      },
      "minimax": {
        "apiKey": "Bearer tok_b9k2mxQp4rf7qSv8f3w4n6t1c5d8e0g3h6i9j2k4l7m0p1"
      }
    }
  },
  "tools": {
    "media": {
      "audio": {
        "enabled": true
      }
    }
  }
}
```

---

## STT: wav2vec2 :8201

### Como funciona (do source)

O OpenClaw usa `transcribeOpenAiCompatibleAudio()` para transcrição:

```typescript
// Extracted from openai-compatible-audio.ts
POST ${baseUrl}/audio/transcriptions
Content-Type: multipart/form-data

------ form boundary
Content-Disposition: form-data; name="file"; filename="audio.ogg"
Content-Type: audio/ogg

<binary audio data>
------ form boundary
Content-Disposition: form-data; name="model"
Content-Type: text/plain

<model-name>
------ form boundary
Content-Disposition: form-data; name="language"
Content-Type: text/plain

pt-BR
------ form boundary--
```

### Configuração

O wav2vec2 deve estar registrado como provider ou configurado via `tools.media.audio`:

```json
{
  "tools": {
    "media": {
      "audio": {
        "enabled": true,
        "providers": {
          "openai": {
            "baseUrl": "http://10.0.19.6:8201/v1",
            "model": "wav2vec2"
          }
        }
      }
    }
  }
}
```

### Como o Telegram envia audio

1. User envia voice note no Telegram
2. Telegram baixa o arquivo OGG (ou OPUS)
3. OpenClaw faz `transcribeFirstAudio()` → `runAudioTranscription()`
4. Envia para `${baseUrl}/audio/transcriptions` com `multipart/form-data`
5. Recebe JSON: `{ "text": "transcrição em texto" }`

---

## TTS: Bridge :8013 → Kokoro :8880

### Como funciona (do source)

O OpenClaw usa `openaiTTS()` para síntese:

```typescript
// Extracted from extensions/openai/tts.ts
POST ${baseUrl}/audio/speech
Authorization: Bearer <apiKey>
Content-Type: application/json

{
  "model": "kokoro",
  "input": "Texto para falar",
  "voice": "pm_santa",
  "response_format": "mp3",
  "speed": 1.0
}
```

### O TTS Bridge filtra vozes

O TTS Bridge em `:8013` é um proxy que:
1. Recebe a requisição do OpenClaw
2. Valida a voz (`pm_santa` ou `pf_dora`)
3. Se válida → repassa para Kokoro `:8880`
4. Se inválida → retorna `400 Bad Request`

```python
# TTS Bridge logic (simplificado)
ALLOWED_VOICES = ["pm_santa", "pf_dora"]

def do_POST(self):
    body = json.loads(self.rfile.read(content_length))
    voice = body.get("voice")
    
    if voice not in ALLOWED_VOICES:
        self.send_error(400, "Voice not allowed")
        return
    
    # Repassa para Kokoro
    kokoro_response = requests.post(
        "http://10.0.19.7:8880/v1/audio/speech",
        json=body
    )
    # Retorna response...
```

### Vozes PT-BR Naturais

| Voice ID | Tipo | Uso |
|----------|------|-----|
| `pm_santa` | Masculino PT-BR | **PADRÃO** — voz do CEO MIX |
| `pf_dora` | Feminino PT-BR | Alternativa/Fallback |

**NUNCA usar outras vozes** — o TTS Bridge bloqueia com 400.

---

## VL: litellm/llava para Imagens

### Como funciona (do source)

```typescript
// Extracted from image-runtime.ts
const context = {
  systemPrompt: prompt,
  messages: [{
    role: "user",
    content: [
      { type: "image", data: "<base64>", mimeType: "image/jpeg" },
      { type: "text", text: "Descreva esta imagem" }
    ],
    timestamp: Date.now()
  }]
};

await complete(model, context, { apiKey, maxTokens });
```

### Configuração

```json
{
  "models": {
    "providers": {
      "litellm": {
        "apiKey": "sk-zappro-lm-2026-xxx",
        "baseUrl": "http://10.0.1.1:4000",
        "models": [
          {
            "id": "llava",
            "input": ["text", "image"]
          }
        ]
      }
    }
  }
}
```

O modelo `llava` é automaticamente reconhecido como capaz de imagens porque tem `input: ["text", "image"]`.

---

## Governance: Regras de Audio (de `openclaw-audio-governance.md`)

### STT
- **ÚNICO:** wav2vec2 `:8201`
- **PROIBIDO:** Deepgram, Whisper, Silero STT

### TTS
- **ÚNICO:** TTS Bridge `:8013` → Kokoro `:8880`
- **VOZES:** pm_santa (masculino), pf_dora (feminino)
- **PROIBIDO:** Kokoro direto, outras vozes

### LLM Primário
- **ÚNICO:** minimax/MiniMax-M2.7 direto (não via LiteLLM)
- **PROIBIDO:** liteLLM como primario

### LiteLLM (apenas para)
- Vision: `llava`
- Embeddings: `nomic-embed`
- Modelos locais não-primários

---

## Files Modificados

| File | Mudança |
|------|---------|
| `/data/workspace/IDENTITY.md` | Audio stack correto |
| `/data/workspace/SOUL.md` | Audio stack correto + kit reference |
| `/data/workspace/MEMORY.md` | Audio stack documentado |
| `SPEC-009-openclaw-persona-audio-stack.md` | Atualizar com especificações do source |
| `SPEC-012-openclaw-update-discoverer.md` | Dual-track discovery (criado) |

---

## Testes de Verificação

### STT (wav2vec2 :8201)
```bash
curl -X POST http://10.0.19.6:8201/v1/audio/transcriptions \
  -F "file=@/tmp/test_audio.ogg" \
  -F "model=wav2vec2" \
  -F "language=pt-BR"
# Esperado: { "text": "..." }
```

### TTS Bridge :8013
```bash
# Voice permitida
curl -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste","voice":"pm_santa"}' \
  -o /tmp/test.mp3 -w "%{http_code}"
# Esperado: 200

# Voice bloqueada
curl -X POST http://localhost:8013/v1/audio/speech \
  -d '{"model":"kokoro","input":"Teste","voice":"af_sarah"}'
# Esperado: 400
```

### VL (llava)
```bash
curl -X POST http://10.0.1.1:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llava",
    "messages": [{
      "role": "user",
      "content": [
        {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}},
        {"type": "text", "text": "Descreva esta imagem"}
      ]
    }]
  }'
```

---

## Acceptance Criteria

| # | Critério | Teste |
|---|----------|-------|
| AC-1 | CEO MIX responde com voz (pm_santa) | Enviar msg → receber audio |
| AC-2 | CEO MIX entende audio PT-BR | Enviar voice note → transcrição correta |
| AC-3 | CEO MIX entende imagens via VL | Enviar imagem → descrição correta |
| AC-4 | TTS Bridge bloqueia vozes não-autorizadas | Tentar af_sarah → 400 |
| AC-5 | Smoke test 15/15 passa | `pipeline-openclaw-voice.sh` |

---

## Referências

- Source: `/home/will/Downloads/openclaw-main/openclaw-main/extensions/openai/tts.ts`
- Source: `/home/will/Downloads/openclaw-main/openclaw-main/extensions/openai/speech-provider.ts`
- Source: `/home/will/Downloads/openclaw-main/openclaw-main/src/media-understanding/openai-compatible-audio.ts`
- Source: `/home/will/Downloads/openclaw-main/openclaw-main/src/media-understanding/audio-preflight.ts`
- Source: `/home/will/Downloads/openclaw-main/openclaw-main/src/media-understanding/image-runtime.ts`
- Governance: `docs/GOVERNANCE/OPENCLAW_AUDIO_GOVERNANCE.md`
- TTS Bridge: `docs/OPERATIONS/SKILLS/tts-bridge.py`
