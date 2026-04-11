# OpenClaw Audio Stack Guide

**Purpose:** Teach any LLM how to understand, verify, and work with the OpenClaw voice pipeline
**Canonical Reference:** `.claude/rules/openclaw-audio-governance.md`
**Applies to:** All LLMs operating in this monorepo
**Host:** will-zappro homelab
**Last Updated:** 2026-04-11

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [The Three Pillars](#2-the-three-pillars)
3. [STT: wav2vec2 :8201](#3-stt-wav2vec2-8201)
4. [TTS: TTS Bridge :8013](#4-tts-tts-bridge-8013)
5. [LLM: MiniMax M2.7 Direct](#5-llm-minimax-m27-direct)
6. [Vision: qwen2.5-vl](#6-vision-qwen25-vl)
7. [Identity Rules](#7-identity-rules)
8. [Component Testing with curl](#8-component-testing-with-curl)
9. [Quick Reference Checklist](#9-quick-reference-checklist)
10. [Anti-Patterns: What NEVER to Suggest](#10-anti-patterns-what-never-to-suggest)
11. [Exceptions: What Requires Approval](#11-exceptions-what-requires-approval)

---

## 1. Architecture Overview

The OpenClaw voice pipeline is a three-stage chain:

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
qwen2.5-vl :8201      :8013
 (vision) (STT PT-BR) │
                      │ SOMENTE pm_santa, pf_dora
                      │ [OUTRAS] → 400 Bad Request
                      ▼
               ┌──────────────┐
               │ Kokoro :8880 │
               │ (67 vozes)   │
               └──────────────┘
```

### Pipeline Summary

| Stage | Component | Port | Network |
|-------|-----------|------|---------|
| STT | wav2vec2 (via wav2vec2-proxy) | :8201 | zappro-lite_default |
| STT Proxy | wav2vec2-deepgram-proxy | :8203 | qgtzrmi network |
| LLM | MiniMax M2.7 | Direct API | Internet |
| Vision | litellm/qwen2.5-vl | :4000 | zappro-lite_default |
| TTS Bridge | TTS Bridge | :8013 | qgtzrmi + zappro-lite |
| TTS | Kokoro | :8880 | zappro-lite_default |

---

## 2. The Three Pillars

### Pillar 1: STT (Speech-to-Text)
- **Service:** wav2vec2 (jonatasgrosman/wav2vec2-large-xlsr-53-portuguese)
- **Port:** `:8201` (internal), `:8203` (Deepgram proxy)
- **Language:** PT-BR Native
- **VRAM:** ~2GB GPU

### Pillar 2: LLM (Language Model)
- **Primary:** MiniMax M2.7
- **Endpoint:** `https://api.minimax.io/anthropic`
- **Key:** Bearer token (NOT via LiteLLM)

### Pillar 3: TTS (Text-to-Speech)
- **Bridge:** TTS Bridge `:8013`
- **Backend:** Kokoro `:8880`
- **Voices:** Only `pm_santa` and `pf_dora`

---

## 3. STT: wav2vec2 :8201

### What It Is

wav2vec2 is a local speech-to-text model optimized for Portuguese (PT-BR). It runs on GPU and is exposed via `whisper-api` at port `:8201`.

### How Audio Reaches It

```
Telegram Voice Message (audio/ogg)
         │
         ▼
OpenClaw transcribes via wav2vec2-deepgram-proxy (:8203)
         │
         ▼
ffmpeg converts to WAV 16kHz mono
         │
         ▼
whisper-api (wav2vec2) at :8201
         │
         ▼
Optional: Ollama PT-BR enhancement (llama3-portuguese-tomcat-8b-instruct-q8)
         │
         ▼
Transcript returned in Deepgram format
```

### IMPORTANT Rules

- **ONLY use wav2vec2 at :8201 for STT**
- **NEVER use:** Deepgram cloud directly, Whisper (any variant), Silero STT
- The Deepgram format is provided by the `wav2vec2-deepgram-proxy` which wraps wav2vec2

### Why This Architecture?

OpenClaw was designed to use Deepgram cloud for STT. Instead of rewriting OpenClaw, the `wav2vec2-deepgram-proxy` translates Deepgram API calls to local wav2vec2. This is transparent to OpenClaw.

### Components

| Component | Container | Port | Purpose |
|-----------|-----------|------|---------|
| whisper-api | zappro-wav2vec2 | 8201 | wav2vec2 inference |
| wav2vec2-deepgram-proxy | zappro-wav2vec2-proxy | 8203 | Deepgram API wrapper |

---

## 4. TTS: TTS Bridge :8013

### What It Is

The TTS Bridge is a Python stdlib HTTP proxy that filters access to Kokoro TTS. It enforces voice restrictions: only `pm_santa` (male PT-BR) and `pf_dora` (female PT-BR) are allowed. All other 65+ Kokoro voices return HTTP 400.

### Why It Exists

Kokoro has 67 voices, many of which are English or other languages. The TTS Bridge ensures OpenClaw only uses the two approved PT-BR voices.

### Voice Selection

| Voice ID | Gender | Use Case | Status |
|----------|--------|----------|--------|
| `pm_santa` | Male PT-BR | **DEFAULT** — standard voice | Allowed |
| `pf_dora` | Female PT-BR | Fallback / alternative | Allowed |
| Any other (`af_*`, `am_*`, etc.) | Various | PROHIBITED | 400 Bad Request |

### How It Works

```
OpenClaw
    │
    └─► POST /v1/audio/speech
            │
            ├─ voice = "pm_santa" ✓ → Kokoro :8880 → audio/mp3
            ├─ voice = "pf_dora" ✓ → Kokoro :8880 → audio/mp3
            └─ voice = "af_sarah" ✗ → 400 Bad Request
```

### IMPORTANT Rules

- **ONLY use TTS Bridge at :8013**
- **NEVER call Kokoro directly at :8880**
- **NEVER use any voice except `pm_santa` or `pf_dora`**
- The TTS Bridge binds to `127.0.0.1:8013` (localhost only)

### Container Details

```yaml
container_name: zappro-tts-bridge
image: python:3.11-slim
ports:
  - "127.0.0.1:8013:8013"
networks:
  - qgtzrmi6771lt8l7x8rqx72f
  - zappro-lite_default
```

---

## 5. LLM: MiniMax M2.7 Direct

### What It Is

MiniMax M2.7 is the primary language model for OpenClaw. It is called **directly** via the MiniMax API, NOT through LiteLLM.

### IMPORTANT Rules

- **ONLY call MiniMax M2.7 DIRECT** — `https://api.minimax.io/anthropic`
- **NEVER route through LiteLLM as primary**
- **NEVER use `liteLLM/minimax-m2.7` as primary**

### Why Not LiteLLM?

LiteLLM does not have the `api` field that OpenClaw's MiniMax integration requires. Routing through LiteLLM causes a crash: `No API provider registered for api: undefined`.

### LiteLLM Is Still Used For

LiteLLM is used for GPU-local services that are NOT the primary LLM:

| Service | Model | Purpose |
|---------|-------|---------|
| Vision | `qwen2.5-vl` | Image understanding |
| Embeddings | `nomic-embed` | Text embeddings |
| Local models | Various Ollama | Non-primary tasks |

### API Details

```
Endpoint: https://api.minimax.io/anthropic/v1/messages
Provider: minimax
API Type: anthropic-messages
Model: MiniMax-M2.7
Auth: Bearer token
```

---

## 6. Vision: qwen2.5-vl

### What It Is

`qwen2.5-vl` is a vision-language model running via Ollama on local GPU. It is accessed through LiteLLM proxy at port `:4000`.

### Configuration

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

### IMPORTANT Rules

- **ONLY use `litellm/qwen2.5-vl` for vision**
- **NEVER use:** `llava` (was replaced 2026-04-09), GPT-4V, Claude Vision

---

## 7. Identity Rules

OpenClaw's identity is **immutable** and part of the stable configuration:

| Attribute | Value | Notes |
|-----------|-------|-------|
| Name | `Zappro` | NEVER change |
| Emoji | `🎙️` | NEVER change |
| Theme | `assistente de voz PT-BR, eficiente, profissional` | NEVER change |

### Why Identity Matters

The identity defines how OpenClaw responds. Changing it would break the persona contract.

---

## 8. Component Testing with curl

### 8.1 Health Check — wav2vec2-Deepgram-Proxy

```bash
# Test proxy health (Deepgram-compatible format)
curl -s http://10.0.19.9:8203/health
# Expected: {"status": "ok", "service": "wav2vec2-deepgram-proxy"}
```

### 8.2 Health Check — TTS Bridge

```bash
# Test TTS Bridge health
curl -sf http://localhost:8013/health
# Expected: {"status": "ok", "service": "tts-bridge", "allowed_voices": ["pm_santa", "pf_dora"]}
```

### 8.3 Health Check — Kokoro (direct)

```bash
# Test Kokoro health (direct, not via bridge)
curl -s http://localhost:8012/health
# Expected: {"status": "healthy"}
```

### 8.4 Health Check — wav2vec2 STT (internal)

```bash
# Test whisper-api (wav2vec2) directly
curl -s http://localhost:8202/health
# Expected: {"status": "ok"}
```

### 8.5 List Available Voices (via TTS Bridge)

```bash
# Shows only the two allowed PT-BR voices
curl -sf http://localhost:8013/v1/audio/voices
# Expected: {"voices": ["pm_santa", "pf_dora"], "note": "Only PT-BR natural voices are available"}
```

### 8.6 STT Transcription Test

```bash
# Transcribe audio via Deepgram proxy (wav2vec2 backend)
curl -X POST "http://10.0.19.9:8203/v1/listen?model=nova-3&language=pt-BR" \
  -H "Authorization: Token ANYTHING" \
  -H "Content-Type: audio/wav" \
  --data-binary "@/tmp/test_audio.wav"
# Expected: {"results": {"channels": [{"alternatives": [{"transcript": "..."}]}]}}
```

### 8.7 TTS Test — pm_santa (allowed, should work)

```bash
# Generate speech with allowed voice
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste de voz","voice":"pm_santa"}' \
  -o /tmp/test_pm_santa.mp3 -w "HTTP %{http_code}\n"
# Expected: HTTP 200
```

### 8.8 TTS Test — pf_dora (allowed, should work)

```bash
# Generate speech with allowed female voice
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste de voz","voice":"pf_dora"}' \
  -o /tmp/test_pf_dora.mp3 -w "HTTP %{http_code}\n"
# Expected: HTTP 200
```

### 8.9 TTS Test — af_sarah (blocked, should return 400)

```bash
# Try to use a blocked voice
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste","voice":"af_sarah"}'
# Expected: HTTP 400 with error message
```

### 8.10 TTS Test — pm_alex (blocked, should return 400)

```bash
# pm_alex was the old default, now blocked
curl -sf -X POST http://localhost:8013/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste","voice":"pm_alex"}'
# Expected: HTTP 400 with error message
```

### 8.11 Kokoro Direct — pm_santa (should work when called directly)

```bash
# Call Kokoro directly (bypassing TTS Bridge)
curl -sf -X POST http://localhost:8012/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste direto","voice":"pm_santa"}' \
  -o /tmp/kokoro_direct.mp3 -w "HTTP %{http_code}\n"
# Expected: HTTP 200
```

### 8.12 Kokoro Direct — any voice (should work when called directly)

```bash
# Call Kokoro directly with any voice (no filtering)
curl -sf -X POST http://localhost:8012/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"model":"kokoro","input":"Teste","voice":"af_bella"}' \
  -o /tmp/kokoro_af_bella.mp3 -w "HTTP %{http_code}\n"
# Expected: HTTP 200 (Kokoro has no voice restrictions)
```

---

## 9. Quick Reference Checklist

Before proposing ANY change to OpenClaw audio stack:

```
□ STT: Is it wav2vec2 :8201 (via proxy :8203)?
        NO → Don't propose. wav2vec2 is the standard.
        YES → Continue.

□ TTS: Is it going through TTS Bridge :8013?
        NO → Don't propose. Use TTS Bridge.
        YES → Continue.

□ TTS Voice: Is it pm_santa or pf_dora?
        NO → Don't propose. Only these two are allowed.
        YES → Continue.

□ LLM Primary: Is it minimax/MiniMax-M2.7 direct?
        NO → Don't propose. Primary LLM calls direct.
        YES → Continue.

□ Vision: Is it litellm/qwen2.5-vl?
        NO → Don't propose. qwen2.5-vl is the standard.
        YES → Continue.

□ Identity: Is it Zappro with 🎙️ and PT-BR theme?
        NO → Don't propose. Identity is immutable.
        YES → All checks passed.
```

---

## 10. Anti-Patterns: What NEVER to Suggest

| If someone asks for... | CORRECT Response |
|------------------------|------------------|
| "Use Deepgram for STT" | REJECT — wav2vec2 is the STT standard |
| "Use Whisper for STT" | REJECT — wav2vec2 is PT-BR native |
| "Call Kokoro directly" | REJECT — Use TTS Bridge :8013 |
| "Use voice af_sarah" | REJECT — Only pm_santa/pf_dora allowed |
| "Use voice pm_alex" | REJECT — pm_alex is blocked (was old default) |
| "Route MiniMax via LiteLLM" | REJECT — Primary LLM calls direct |
| "Use llava for vision" | REJECT — qwen2.5-vl replaced llava (2026-04-09) |
| "Change bot name to X" | REJECT — Identity is immutable |
| "Try GPT-4V for images" | REJECT — Use litellm/qwen2.5-vl |

---

## 11. Exceptions: What Requires Approval

The following changes REQUIRE explicit approval from will:

| Change | Why Approval Needed |
|--------|---------------------|
| Add new PT-BR voice to TTS Bridge | Changes the voice contract |
| Replace wav2vec2 STT | Core infrastructure change |
| Replace Kokoro TTS | TTS backend swap |
| Change primary LLM | Changes AI provider |
| Alter identity | Breaks persona contract |

---

## Related Files

| File | Purpose |
|------|---------|
| `.claude/rules/openclaw-audio-governance.md` | Canonical rules for LLMs |
| `docs/SPECS/SPEC-009-openclaw-persona-audio-stack.md` | Full audio stack specification |
| `docs/OPERATIONS/SKILLS/tts-bridge.md` | TTS Bridge operations reference |
| `docs/OPERATIONS/SKILLS/wav2vec2-proxy.md` | wav2vec2-Deepgram-Proxy operations |
| `docs/OPERATIONS/SKILLS/tts-bridge.py` | TTS Bridge source code |
| `docs/OPERATIONS/SKILLS/wav2vec2-deepgram-proxy.py` | Deepgram proxy source code |
| `docs/SPECS/SPEC-014-openclaw-tts-route-fix.md` | TTS route fix incident |
| `docs/INCIDENTS/INCIDENT-2026-04-09-openclaw-tts-route-fix.md` | TTS route incident report |
| `docs/SPECS/SPEC-013-openclaw-ceo-mix-voice-stack.md` | Voice stack source analysis |

---

**Authority:** will-zappro
**Last update:** 2026-04-11
