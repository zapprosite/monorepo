# Models

Lista dos modelos de IA disponíveis no sistema multi-claude.

---

## Modelos Disponíveis

| Modelo | Provider | Tipo | Custo |
|--------|----------|------|-------|
| **MiniMax M2.7** | MiniMax API | Chat | Token plan |
| **GPT-4o-mini** | OpenAI API | Chat | $0.15/1M tokens |
| **Gemma4:26b-q4** | Ollama (local) | Chat | Grátis |
| **Whisper-large-v3-turbo** | Groq | STT | Gratuito (150min/dia) |
| **Edge TTS** | Microsoft (local) | TTS | Grátis |

---

## MiniMax M2.7 (Primário)

- **Modelo:** `MiniMax-M2.7`
- **Provider:** MiniMax API via LiteLLM
- **Endpoint:** `localhost:4000`
- **Uso:** Chat principal

---

## GPT-4o-mini (Fallback)

- **Modelo:** `gpt-4o-mini`
- **Provider:** OpenAI API via LiteLLM
- **Custo:** $0.15/1M tokens
- **Uso:** Fallback automático quando MiniMax falha

---

## Gemma4:26b-q4 (Local)

- **Modelo:** `gemma4:26b-q4`
- **Provider:** Ollama local
- **VRAM:** ~22GB sob demanda
- **Custo:** Grátis
- **Uso:** Código local, tarefas leves

---

## Whisper-large-v3-turbo (STT)

- **Modelo:** `whisper-large-v3-turbo`
- **Provider:** Groq Cloud
- **Custo:** Gratuito (150min/dia)
- **Latência:** ~216x tempo real
- **Uso:** Transcrição de áudio

---

## Edge TTS

- **Modelo:** `tts-1`
- **Provider:** Microsoft Edge TTS
- **Endpoint:** `http://10.0.2.4:8015/v1`
- **Vozes:** pt-BR-AntonioNeural, pt-BR-BrendaNeural
- **Custo:** Grátis
- **Uso:** Síntese de voz PT-BR

---

## Vision-Language (VL)

| Modelo | Provider | VRAM | Custo |
|--------|----------|------|-------|
| **Qwen2.5-VL-3B** | Ollama (local) | ~4GB | Grátis |
| **Qwen3.5-Flash** | OpenRouter | - | $0.325/1M tokens |

---

## LiteLLM Mapping

| LiteLLM Model | Provider | API |
|--------------|----------|-----|
| `minimax-m2.7` | MiniMax | Minimax API |
| `gpt-4o-mini` | OpenAI | OpenAI API |
| `gemma4:26b-q4` | Ollama | localhost:11434 |
| `whisper-1` | Groq | api.groq.com |
| `tts-1` | Edge TTS | 10.0.2.4:8015 |
| `qwen2.5vl-3b` | Ollama | qwen2-vl7b:11434 |
| `qwen3.5-vl` | OpenRouter | openrouter.ai |

---

Ver também: [/srv/ops/ai-governance/MODEL-ROUTING.md](./OPS/MODEL-ROUTING.md)
