# TESTER Results

## Task

Executar smoke test ao STT e TTS:

- STT: `curl -s http://localhost:8204/health`
- TTS: `curl -s http://localhost:8013/health`

## Results

### STT (localhost:8204)

```json
{ "status": "ok", "model": "Systran/faster-whisper-medium" }
```

- Status: **ok**
- Model: Systran/faster-whisper-medium

### TTS (localhost:8013)

```json
{ "status": "healthy" }
```

- Status: **healthy**

## Status

**PASS** — Ambos os serviços estão a responder corretamente.

- STT: `{"status":"ok"}` ✅
- TTS: `{"status":"healthy"}` ✅
