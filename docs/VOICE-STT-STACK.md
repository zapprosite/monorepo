# Voice/STT Stack — Enterprise Specification

**Classification:** INTERNAL | **Owner:** Platform Engineering
**Version:** 1.0.0 | **Updated:** 2026-04-26

---

## Overview

Voice pipeline bidirecional: entrada de áudio (STT) → processamento LLM → saída de áudio (TTS).

```
Microfone (Telegram Voice)
    │
    ▼
Groq Whisper Turbo (STT cloud) ── fallback ──▶ faster-whisper (:8204)
    │
    ▼
MiniMax-M2.7 (LLM primário, :4000)
    │
    ▼
Edge TTS (pt-BR-AntonioNeural) ──▶ Telegram Voice
```

---

## STT — Speech-to-Text

### Primary: Groq Whisper Turbo

**API:** `https://api.groq.com/openai/v1/audio/transcriptions`
**Modelo:** `whisper-large-v3-turbo`
**Limite:** 150 minutos/dia (free tier)
**Vantagens:** Rápido, precisão excelente em PT-BR, baixa latência

```bash
# Transcrição via Groq (usar env var canônica)
curl -X POST https://api.groq.com/openai/v1/audio/transcriptions \
  -H "Authorization: Bearer $GROQ_API_KEY" \
  -F "file=@audio.ogg" \
  -F "model=whisper-large-v3-turbo"
```

### Fallback: faster-whisper-server (local)

**Porta:** `:8204` (OpenAI-compatible `/v1/audio/transcriptions`)
**Modelo:** `faster-whisper-medium-pt`
**Script:** `~/.hermes/scripts/stt-fallback.sh`

```bash
# Health check
curl -sf http://localhost:8204/health

# Transcrição fallback
curl -sf http://localhost:8204/v1/audio/transcriptions \
  -F "file=@audio.wav" \
  -F "model=whisper-1" \
  -F "language=pt"
```

**Formatos aceitos:** WAV (16kHz mono), OGG (Telegram), MP3

### Routing Logic

```
if (Groq available && minutes_used < 150):
    use Groq Whisper
else:
    use faster-whisper (:8204)
```

---

## TTS — Text-to-Speech

### Provider: Edge TTS (Microsoft)

**Voz canonical:** `pt-BR-AntonioNeural`
**Script:** `~/.hermes/scripts/tts-edge.py`

```bash
# Uso direto
python3 ~/.hermes/scripts/tts-edge.py "Texto para falar" [chat_id]
```

### Pre-processamento de Texto

O `tts-edge.py` possui TextScanner single-pass:
- Converte bullet points em narração ordinal (primeiro, segundo...)
- Resume blocos de código (não lê linha a linha)
- Converte símbolos matemáticos e operadores
- Limpa markdown e emojis

### Voices Canonical (apenas estas permitted)

| Voice ID | Tipo | Uso | Status |
|----------|------|-----|--------|
| `pm_santa` | Masculino PT-BR | **PADRÃO** — produção | ✅ |
| `pf_dora` | Feminino PT-BR | Fallback | ✅ |
| Todas outras | — | BLOQUEADAS (TTS Bridge retorna HTTP 400) | ❌ |

---

## Environment Variables (Canonical)

```bash
# STT Primary (Groq cloud)
source /srv/monorepo/.env
GROQ_API_KEY=${GROQ_API_KEY}

# STT Fallback (faster-whisper local)
STT_DIRECT_URL=http://localhost:8204

# TTS (Edge/Microsoft)
TTS_BRIDGE_URL=http://localhost:8012

# Voice Config
HERMES_VOICE=pm_santa
HERMES_MAX_TTS_SIZE_BYTES=52428800  # 50MB max
```

### Secrets — NEVER HARDCODE

```bash
# Retrieve from .env (canonical source)
source /srv/monorepo/.env
echo $GROQ_API_KEY  # Never echo in logs

# Never do this:
# GROQ_API_KEY=sk-xxx 
# Bearer sk-xxx hardcoded
```

---

## Ports & Services

| Service | Port | Type | Health |
|---------|------|------|--------|
| Hermes Gateway | 8642 | Agent brain | ✅ |
| LiteLLM | 4000 | LLM proxy | ✅ |
| Edge TTS Bridge | 8012 | TTS gateway | ✅ |
| faster-whisper | 8204 | STT fallback | ✅ |
| Ollama | 11434 | Local LLM | ✅ |
| Qdrant | 6333 | Vector DB | ✅ |

---

## Monitoring

### Health Check

```bash
# STT providers
curl -sf http://localhost:8204/health  # faster-whisper

# TTS
curl -sf http://localhost:8012/health  # Edge TTS Bridge

# Groq (external)
curl -sf https://api.groq.com/openai/v1/models 2>/dev/null && echo "Groq OK"
```

### Metrics (every 8 hours via cron)

```bash
# nexus-hermes-stats.sh logs to /srv/logs/hermes-metrics.log
# Check STT latency and availability
```

---

## Incident Response

### Groq Rate Limited (>150 min/day)

1. Automatic fallback to faster-whisper (:8204)
2. Monitor: `curl -sf http://localhost:8204/health`
3. Alert if fallback also fails

### Edge TTS Down

1. Check container: `docker ps | grep edge-tts`
2. Check logs: `docker logs zappro-edge-tts --tail 50`
3. Restart if needed: `docker restart zappro-edge-tts`

### STT Fallback Down

1. Check process: `ps aux | grep faster-whisper`
2. Restart service manually
3. Verify: `curl -sf http://localhost:8204/health`

---

## Flow Diagram

```
┌─────────────┐
│   Telegram  │
│  Voice Msg  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐
│ Hermes Gateway  │
│    :8642        │
└──────┬──────────┘
       │
       ▼
┌─────────────────┐     ┌──────────────────┐
│  Groq Whisper    │     │ faster-whisper   │
│  (cloud)          │────▶│   :8204          │
│  whisper-large    │     │   (fallback)    │
│  -v3-turbo        │     └──────────────────┘
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
│  Neural         │
└──────┬──────────┘
       │ audio.opus
       ▼
┌─────────────┐
│   Telegram  │
│   sendVoice │
└─────────────┘
```

---

## Provider Cost Reference

| Provider | Model | Input Cost | Output Cost |
|----------|-------|------------|-------------|
| Groq | whisper-large-v3-turbo | $0.00 (150min/day free) | — |
| MiniMax | minimax-m2.7 | $0.10/1M | $0.10/1M |
| Ollama | qwen2.5:3b | $0 | $0 |
| Edge TTS | pt-BR-AntonioNeural | $0 | $0 |

---

## Audit Log

```bash
echo "$(date '+%Y-%m-%d %H:%M:%S') - Voice/STT stack verified" >> /srv/logs/audit.log
```

---

**Nexus Framework:** /srv/monorepo/docs/NEXUS-SRE-GUIDE.md
**Related:** VOICE-PIPELINE.md, LLM_PROVIDER_ARCHITECTURE.md
