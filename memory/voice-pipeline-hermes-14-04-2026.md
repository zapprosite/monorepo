# Voice Pipeline & Hermes Agent — Current State

**Updated:** 2026-04-16
**Status:** STT FIXED | Vision: qwen2.5vl:7b | LLM: Gemma4-12b-it

---

## Current State (15/04/2026)

### STT — FIXED ✅

- **Bug:** faster-whisper `:8204` accepted only raw WAV bytes (Content-Length), but ai-gateway sends multipart/form-data → 502 errors
- **Fix applied:** Updated whisper-server-v2.py to accept multipart/form-data (OpenAI API format)
- **Hermes STT config:** Changed to use `:8204` directly (no auth) instead of via ai-gateway
- **Endpoint:** `http://localhost:8204/v1/audio/transcriptions` — multipart/form-data OK

### Vision — qwen2.5vl:7b ✅

- **qwen2.5vl:7b:** Current vision model (8B params)

### TTS — Kokoro :8013 ✅

- Kokoro via TTS Bridge `:8013` — voices `pm_santa`/`pf_dora`
- Canonical TTS (SPEC-009) — working

### LLM — Ollama local ✅

- Primary: `qwen2.5vl:7b` (text + vision)
- Fallback: `Gemma4-12b-it`

---

## Smoke Test

**Script:** `smoke-tests/smoke-hermes-local-voice.sh` — created and validated

Results (15/04):

```
STT: faster-whisper :8204     ✅ OK (multipart fixed)
TTS: Kokoro :8013             ✅ OK
AI-Gateway :4002 STT+TTS      ✅ OK
Hermes :8642                  ✅ OK
Ollama :11434                 ✅ OK
qwen2.5vl:7b       ✅ OK
Gemma4-12b-it               ✅ OK
```

---

## Architecture (100% Local)

```
Telegram Voice Message
  │
  ▼
Hermes Gateway :8642
  │
  ├─ LLM: Ollama Gemma4-12b-it (local, GPU)
  │    └─ Fallback: Gemma4-12b-it (same model, stateless)
  │
  ├─ Vision: Ollama qwen2.5vl:7b (local, GPU)
  │
  ├─ STT: faster-whisper-medium-pt :8204 (local, multipart fixed)
  │
  └─ TTS: Kokoro :8013 via TTS Bridge (local)
```

---

## References

- SPEC-053: Hermes 100% Local Voice+Vision
- SPEC-009: Audio stack imutavel (STT/TTS canonical)
- SPEC-027: Voice pipeline humanizado PT-BR
- smoke-tests/smoke-hermes-local-voice.sh
