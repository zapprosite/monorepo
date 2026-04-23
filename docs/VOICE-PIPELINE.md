# Voice/STT Pipeline — Documentacao Tecnica

**Data:** 2026-04-22
**Blueprint:** CLAUDE_CODE_BLUEPRINT.md
**Stack:** MiniMax-M2.7 (primary) + GPT-4o-mini (fallback) + Gemma4:26b-q4 (local)

---

## Visao Geral

Pipeline de voz bidirecional: entrada de audio (STT) → processamento LLM → saida de audio (TTS).

```
Microfone (Telegram Voice)
    │
    ▼
Groq Whisper Turbo (STT cloud, 150min/dia gratis)
    │
    ▼
MiniMax-M2.7 (LLM primário, via LiteLLM :4000)
    │
    ▼
Edge TTS (pt-BR-AntonioNeural) ──→ Telegram Voice
```

---

## STT — Speech-to-Text

### Provider Principal: Groq Whisper Turbo

**API:** `https://api.groq.com/openai/v1/audio/transcriptions`
**Modelo:** `whisper-large-v3-turbo`
**Limite:** 150 minutos/dia gratis
**Vantagens:** Rapido, precisao excelente em PT-BR, baixa latencia

```bash
# Transcricao direta com Groq
curl -X POST https://api.groq.com/openai/v1/audio/transcriptions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F "file=@audio.ogg" \
  -F "model=whisper-large-v3-turbo"
```

### Fallback: faster-whisper-server (porta 8204)

Quando Groq esta indisponivel ou limite atingido, o fallback local entra em acao.

**Porta:** `:8204` (OpenAI-compatible `/v1/audio/transcriptions`)
**Modelo:** faster-whisper-medium-pt

```bash
# Health check
curl -sf http://localhost:8204/health

# Transcricao fallback
curl -sf http://localhost:8204/v1/audio/transcriptions \
  -F "file=@audio.wav" \
  -F "model=whisper-1" \
  -F "language=pt"
```

**Formatos aceitos:** WAV (16kHz mono), OGG (Telegram), MP3

---

## TTS — Text-to-Speech

### Provider Canonical: Edge TTS

**Voz:** `pt-BR-AntonioNeural`
**Script:** `~/.hermes/scripts/tts-edge.sh` ou `~/.hermes/scripts/tts-edge.py`

```bash
# Uso direto
bash ~/.hermes/scripts/tts-edge.sh "Texto para falar" [chat_id]

# Exemplo com Python
python3 ~/.hermes/scripts/tts-edge.py "Olá, como posso ajudar?" 7220607041
```

### Pre-processamento de Texto

O `tts-edge.py` possui um TextScanner single-pass que:
- Converte bullet points em narracao ordinal (primeiro, segundo...)
- Resume blocos de codigo (nao le linha a linha)
- Converte simbolos matematicos e operadores
- Fala titulos com enfase
- Limpa markdown e emojis

---

## LLM — Processamento

### Primario: MiniMax-M2.7

**Endpoint:** LiteLLM em `localhost:4000`
**Routing:** Automatico via LiteLLM

### Fallback: GPT-4o-mini

**Estratégia:** LiteLLM faz failover automatico entre MiniMax e GPT quando necessario.

### Local: Gemma4:26b-q4

**VRAM:** ~22GB (carregado sob demanda)
**Uso:** Codigo local via Ollama `:11434`

---

## Fluxo Completo

```
1. Usuario grava audio no Telegram
2. Hermes Gateway recebe voz
3. STT: Groq Whisper Turbo transcreve → texto
4. LLM: MiniMax-M2.7 processa entrada
5. TTS: Edge TTS (pt-BR-AntonioNeural) gera audio
6. Hermes Gateway envia audio de volta ao Telegram
```

### Diagrama de Fluxo

```
┌─────────────┐
│   Telegram  │
│  Voice Msg  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Hermes Gateway   │
│    :8642        │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐     ┌──────────────────┐
│  Groq Whisper    │     │ faster-whisper   │
│  (cloud)         │────▶│   :8204          │
│  whisper-large   │     │   (fallback)     │
│  -v3-turbo       │     └──────────────────┘
└──────┬──────────┘
       │ texto
       ▼
┌─────────────────┐     ┌──────────────────┐
│    LiteLLM      │     │  GPT-4o-mini     │
│    :4000        │────▶│  (fallback)     │
│  MiniMax-M2.7   │     └──────────────────┘
└──────┬──────────┘
       │ texto
       ▼
┌─────────────────┐
│   Edge TTS       │
│ pt-BR-Antonio   │
│  Neural         │
└──────┬──────────┘
       │ audio.opus
       ▼
┌─────────────────┐
│   Telegram      │
│   sendVoice     │
└─────────────────┘
```

---

## Environment Variables

```bash
# STT
GROQ_API_KEY=***                    # Groq cloud (STT primary)

# TTS
STT_DIRECT_URL=http://localhost:8204   # fallback faster-whisper

# LLM
MINIMAX_API_KEY=***                    # MiniMax M2.7 primary
MINIMAX_GROUP_ID=2034696179689731017
OLLAMA_URL=http://localhost:11434
LITELLM_URL=http://localhost:4000
```

---

## Ports e Services

| Servico | Porta | Tipo |
|---------|-------|------|
| Hermes Gateway | 8642 | Agent brain |
| LiteLLM | 4000 | LLM proxy |
| ai-gateway | 4002 | OpenAI facade |
| faster-whisper (fallback) | 8204 | STT local |
| Ollama | 11434 | Local LLM |
| Edge TTS | — | Cloud TTS |

---

## Referencias

- Blueprint: `/home/will/Desktop/CLAUDE_CODE_BLUEPRINT.md`
- Voice skill: `.claude/skills/voice-ouvidos-visao/SKILL.md`
- TTS script: `~/.hermes/scripts/tts-edge.py`
- Smoke test: `smoke-tests/smoke-hermes-local-voice.sh`
- PORTS.md: `/srv/ops/ai-governance/PORTS.md`
