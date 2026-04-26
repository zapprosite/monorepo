# SPEC-009: OpenClaw Persona + Audio Stack — PT-BR

## Status: PROTEGIDO — NÃO ALTERAR

## Data: 2026-04-08
## Autor: will + Claude Code

---

## Visão Geral

Este documento define a configuracao canonical do OpenClaw Bot para voz PT-BR. Qualquer LLM ou agente que proponha mudancas deve consultar este documento primeiro.

---

## Arquitetura — Voice Pipeline

```
[USER] → Telegram Voice Message
              │
              ▼
┌─────────────────────────────────┐
│         OPENCLAW BOT            │
│  identity: Zappro (PT-BR)       │
│  primary: minimax/MiniMax-M2.7  │
└─────────────────────────────────┘
              │
    ┌─────────┼─────────┐
    │         │         │
    ▼         ▼         ▼
[OLHOS]  [OUVIDOS]  [BOCA]
litellm/   wav2vec2  TTS Bridge
qwen2.5-vl:8201      :8013
 (vision) (STT PT-BR) │
                      │ SOMENTE pm_santa, pf_dora
                      │ [OUTRAS] → 400 Bad Request
                      ▼
               ┌──────────────┐
               │ Kokoro :8880 │
               │ (67 vozes)   │
               └──────────────┘
```

---

## STT — Speech-to-Text

**Servico:** wav2vec2 (jonatasgrosman/wav2vec2-large-xlsr-53-portuguese)
**Porta:** `8201`
**Rede:** `zappro-lite_default`
**Linguagem:** PT-BR Native (5.8M+ downloads)
**VRAM:** ~2GB

### Configuracao OpenClaw

O OpenClaw usa STT via `OLLAMA_BASE_URL`:
```
OLLAMA_BASE_URL=http://wav2vec2:8201
```

### PROIBIDO — STT

| Provider | Razão |
|----------|-------|
| Deepgram (cloud) | REMOVIDO em 2026-04-07 — NAO usar |
| Whisper (local) | Nao e wav2vec2 — rejeitar sugestao |
| Silero STT | Nao e PT-BR native |

**REGRA:** Apenas wav2vec2 na porta 8201 para STT.

---

## TTS — Text-to-Speech

**Servico:** Kokoro TTS via TTS Bridge (proxy)
**Porta Bridge:** `8013` (bind local: 127.0.0.1:8013)
**Rede:** `qgtzrmi6771lt8l7x8rqx72f` + `zappro-lite_default`
**Bridge IP:** `10.0.19.5` (qgtzrmi) / `10.0.2.6` (zappro-lite)

### Vozes Permitidas — APENAS PT-BR Naturais

| Voice ID | Tipo | Uso | Status |
|----------|------|-----|--------|
| `pm_santa` | Masculino PT-BR | **PADRÃO** | ✅ |
| `pf_dora` | Feminino PT-BR | Fallback | ✅ |

### Vozes Bloqueadas — HTTP 400

Todas as outras 65 vozes Kokoro retornam `400 Bad Request`:
- `af_*` (American Female) — 18 vozes
- `am_*` (American Male) — 12 vozes
- `bf_*`, `bm_*` (British) — 11 vozes
- `jf_*`, `zf_*`, `zm_*` (Japanese/Chinese) — 12 vozes
- etc.

### PROIBIDO — TTS

| Provider/Config | Razão |
|-----------------|-------|
| Kokoro direto `:8880` | Sem filtro de vozes — usar TTS Bridge |
| Qualquer outra voz Kokoro | Only pm_santa + pf_dora permitidas |
| ElevenLabs | Nao e PT-BR native |
| OpenAI TTS | Nao e Kokoro |

### Configuracao OpenClaw (openclaw.json)

```json
{
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

**IMPORTANTE:** `baseUrl` deve ser o TTS Bridge, NAO Kokoro direto.

---

## LLM — Language Model

**Primario:** MiniMax M2.7 (direto, sem LiteLLM)
**Endpoint:** `https://api.minimax.io/anthropic`
**Provider:** `minimax`
**API:** `anthropic-messages`

### PROIBIDO — LLM Primario

| Config | Razão |
|--------|-------|
| LiteLLM como primario | Nao tem campo `api` — causa crash `api: undefined` |
| Qualquer outro LLM como primario | MiniMax M2.7 e o padrao |

---

## Vision — Image Understanding

**Model:** litellm/qwen2.5-vl (via LiteLLM)
**Endpoint:** `http://10.0.1.1:4000/v1/chat/completions`
**Provider:** `liteLLM`
**GPU:** Ollama local

### Configuracao OpenClaw (openclaw.json)

```json
{
  "agents": {
    "defaults": {
      "imageModel": {
        "primary": "litellm/qwen2.5-vl",
        "providers": {
          "litellm/qwen2.5-vl": { "provider": "liteLLM" }
        }
      }
    }
  }
}
```

### PROIBIDO — Vision

| Model | Razão |
|-------|-------|
| GPT-4V | Nao e local |
| Claude Vision | Nao e o modelo configurado |
| qwen2.5-vl como primario | qwen2.5-vl e o modelo configured (llava FOI SUBSTITUIDO) |

---

## Identity — Persona do Bot

```json
{
  "identity": {
    "name": "Zappro",
    "theme": "assistente de voz PT-BR, eficiente, profissional",
    "emoji": "🎙️"
  }
}
```

**Nome:** Zappro
**Comportamento:** asistente de voz PT-BR, eficiente, profissional
**Emoji:** 🎙️

---

## Anti-Padrao — O Que NUNCA Sugerir

| Situacao | Resposta Correta |
|----------|-----------------|
| LLM sugere "vamos usar Deepgram" | REJEITAR — wav2vec2 e o STT padrao |
| LLM sugere "mudar voz para af_sarah" | REJEITAR — apenas pm_santa/pf_dora |
| LLM propõe "TTS direto ao Kokoro" | REJEITAR — usar TTS Bridge |
| LLM sugere "colocar MiniMax no LiteLLM" | REJEITAR — primarios chamam direto |
| LLM propõe "usar Whisper" | REJEITAR — wav2vec2 e PT-BR native |

---

## Referencia rapida — Checklist

```
ANTES DE PROPOR QUALQUER MUDANCA:
□ STT: e wav2vec2 :8201? (NAO Deepgram, NAO Whisper)
□ TTS: esta usando TTS Bridge :8013? (NAO Kokoro direto)
□ TTS Voice: e pm_santa ou pf_dora? (NAO outra)
□ LLM Primo: e minimax/MiniMax-M2.7? (NAO via LiteLLM)
□ Vision: e litellm/qwen2.5-vl? (NAO GPT-4V, llava foi substituido)
□ Identity: Zappro, emoji 🎙️, tema PT-BR?
```

---

## Ficheiros Relacionados

| Ficheiro | Purpose |
|----------|---------|
| `docs/GOVERNANCE/OPENCLAW_DEBUG.md` | Debug guide + arquitetura |
| `docs/OPERATIONS/SKILLS/tts-bridge.md` | TTS Bridge docs |
| `docs/OPERATIONS/SKILLS/wav2vec2-health-check.md` | STT health check |
| `docs/GOVERNANCE/PINNED-SERVICES.md` | Servicos immutaveis |
| `docs/GOVERNANCE/GUARDRAILS.md` | Proibidos e requer aprovacao |
| `docs/GOVERNANCE/ANTI-FRAGILITY.md` | Stability markers |
| `.claude/rules/openclaw-audio-governance.md` | Rules para LLM |

---

**PROTEGIDO**: Alteracoes neste documento requerem aprovacao de will-zappro.
**Valido desde:** 2026-04-08
**Proxima revisão:** 2026-05-08