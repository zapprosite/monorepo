# Voice/STT Pipeline — Documentacao Tecnica

**Data:** 2026-05-01
**Stack:** MiniMax-M2.7 (primary) + Groq Whisper (STT free) + Edge TTS (TTS free)

---

## Visao Geral

Pipeline de voz bidirecional: entrada de audio (STT) → processamento LLM → saida de audio (TTS).

```
Microfone (Telegram Voice)
    │
    ▼
Groq Whisper Turbo (STT cloud, 150min/dia gratis) ── fallback ──▶ faster-whisper (:8204)
    │
    ▼
MiniMax-M2.7 (LLM primário, via LiteLLM :4000)
    │
    ▼
Edge TTS (pt-BR-AntonioNeural) ──→ Telegram Voice
```

---

## STT — Speech-to-Text

### Provider Principal: Groq Whisper Turbo (GRÁTIS — 150min/dia)

**API:** `https://api.groq.com/openai/v1/audio/transcriptions`
**Modelo:** `whisper-large-v3-turbo`
**Limite:** 150 minutos/dia gratis

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

### Provider Canonical: Edge TTS (Microsoft — GRÁTIS)

**Voz:** `pt-BR-AntonioNeural`
**Script:** `~/.hermes/scripts/tts-edge.py`

```bash
# Uso direto
python3 ~/.hermes/scripts/tts-edge.py "Texto para falar" [chat_id]
```

### Pre-processamento de Texto

O `tts-edge.py` possui TextScanner single-pass:
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

### Fallback: qwen2.5-coder via Ollama

**VRAM:** ~8GB
**Uso:** Codigo local via Ollama `:11434`

---

## Fluxo Completo

```
1. Usuario grava audio no Telegram
2. Hermes Gateway recebe voz (:8642)
3. STT: Groq Whisper Turbo transcreve → texto
   (fallback: faster-whisper :8204 se Groq indisponivel)
4. LLM: MiniMax-M2.7 processa entrada (:4000)
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
│  whisper-large    │     │   (fallback)     │
│  -v3-turbo       │     └──────────────────┘
│  (150min FREE)   │
└──────┬──────────┘
       │ texto
       ▼
┌─────────────────┐
│    LiteLLM       │
│    :4000        │
│  MiniMax-M2.7   │
└──────┬──────────┘
       │ texto
       ▼
┌─────────────────┐
│   Edge TTS       │
│ pt-BR-Antonio   │
│  Neural (FREE)  │
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
# STT Primary (Groq cloud — FREE 150min/dia)
GROQ_API_KEY=${GROQ_API_KEY}

# STT Fallback (faster-whisper local)
STT_DIRECT_URL=http://localhost:8204

# LLM
MINIMAX_API_KEY=${MINIMAX_API_KEY}
MINIMAX_GROUP_ID=${MINIMAX_GROUP_ID}
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
| faster-whisper (fallback STT) | 8204 | STT local |
| Edge TTS Bridge | 8012 | TTS cloud |
| Ollama | 11434 | Local LLM |
| Qdrant | 6333 | Vector DB |

---

## Custos

| Provider | Model | Custo |
|----------|-------|-------|
| Groq | whisper-large-v3-turbo | **$0** (150min/dia free) |
| Edge TTS | pt-BR-AntonioNeural | **$0** |
| MiniMax | minimax-m2.7 | $0.10/1M |
| Ollama | qwen2.5:3b | $0 |

---

## Referencias

- Voice/STT Stack: `VOICE-STT-STACK.md`
- TTS script: `~/.hermes/scripts/tts-edge.py`
- Smoke test: `smoke-tests/smoke-hermes-local-voice.sh`
- PORTS.md: `/srv/ops/ai-governance/PORTS.md`
