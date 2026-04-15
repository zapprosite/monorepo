# wav2vec2-Deepgram-Proxy Operations Reference

**Purpose:** STT bridge that makes local wav2vec2 look like Deepgram API
**Container:** `zappro-wav2vec2-proxy`
**Host Port:** 8203
**Network:** `qgtzrmi6771lt8l7x8rqx72f`
**IP:** 10.0.19.9

---

## 1. Overview

The `wav2vec2-deepgram-proxy` is a bridge service that makes local wav2vec2 (running on port 8201) appear as a Deepgram-compatible API. OpenClaw and other services send Deepgram-format requests to this proxy, which:

1. Accepts Deepgram-compatible POST requests at `/v1/listen`
2. Converts audio to WAV 16kHz mono via ffmpeg
3. Forwards to local wav2vec2 (`whisper-api` at port 8201)
4. Optionally enhances the transcript with an Ollama PT-BR model
5. Returns responses in Deepgram format

**Why it exists:** OpenClaw expects a Deepgram API interface. The proxy translates this interface to the local wav2vec2 stack without requiring Deepgram cloud access.

---

## 2. Architecture

```
OpenClaw (client)
      │
      ▼
┌─────────────────────────────────┐
│  wav2vec2-deepgram-proxy :8203  │
│  (Deepgram-compatible API)       │
└───────────────┬─────────────────┘
                │
       ┌────────┴────────┐
       ▼                 ▼
┌─────────────┐   ┌──────────────────┐
│ whisper-api │   │    Ollama        │
│  (wav2vec2) │   │  llama3-portuguese│
│  :8201      │   │  :11434          │
└─────────────┘   └──────────────────┘
       │                 │
       ▼                 (enhancement only)
┌─────────────┐
│ wav2vec2    │
│ PT-BR model │
│ (GPU)       │
└─────────────┘
```

**Flow:**
```
Audio WAV/MP3/OGG ──► [proxy :8203] ──► ffmpeg (16k mono) ──► whisper-api :8201 ──► wav2vec2 GPU
                                                                       │
                                                                       ▼
                                                                Ollama PT-BR
                                                             (optional enhance)
```

---

## 3. Endpoints

### GET /health

Health check for the proxy service.

```bash
curl http://10.0.19.9:8203/health
```

**Response:**
```json
{"status": "ok", "service": "wav2vec2-deepgram-proxy"}
```

---

### POST /v1/listen

Deepgram-compatible transcription endpoint.

**Query Parameters:**
| Parameter | Default | Description |
|-----------|---------|-------------|
| `model` | `nova-3` | Model name (Deepgram compat, ignored) |
| `language` | `pt-BR` | Language code |

**Headers:**
- `Authorization: Token ANYTHING`
- `Content-Type: audio/wav`, `audio/mp3`, `audio/ogg`, etc.

**Request Body:** Binary audio data (max 20MB)

```bash
# Example transcription request
curl -X POST "http://10.0.19.9:8203/v1/listen?model=nova-3&language=pt-BR" \
  -H "Authorization: Token ANYTHING" \
  -H "Content-Type: audio/wav" \
  --data-binary "@audio.wav"
```

**Response (Deepgram format):**
```json
{
  "results": {
    "channels": [{
      "alternatives": [{
        "transcript": "transcribed text",
        "confidence": 0.99,
        "words": []
      }]
    }]
  },
  "metadata": {
    "request_id": "proxy-<PID>",
    "duration": <seconds>,
    "models": ["nova-3"]
  }
}
```

---

## 4. Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8203` | Host port the proxy listens on |
| `WHISPER_API` | `http://10.0.19.8:8201` | wav2vec2 (whisper-api) endpoint |
| `OLLAMA_HOST` | `http://10.0.19.1:11434` | Ollama API for transcript enhancement |
| `OLLAMA_MODEL` | `llama3-portuguese-tomcat-8b-instruct-q8:latest` | PT-BR model used for enhancement |

---

## 5. How to Test

### Health Check

```bash
curl -s http://10.0.19.9:8203/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'] == 'ok' and d['service'] == 'wav2vec2-deepgram-proxy' and 'OK' or 'FAIL')"
```

### Transcription Test

Requires a test audio file. If you have a TTS output file:

```bash
curl -X POST "http://10.0.19.9:8203/v1/listen?model=nova-3&language=pt-BR" \
  -H "Authorization: Token ANYTHING" \
  -H "Content-Type: audio/wav" \
  --data-binary "@/tmp/test_tts.wav" \
  2>/dev/null | python3 -c "import sys,json; r=json.load(sys.stdin); print(r['results']['channels'][0]['alternatives'][0]['transcript'])"
```

Expected output: transcribed text from the audio file.

### Via LiteLLM (end-to-end)

```bash
curl -s -X POST "http://localhost:4000/v1/audio/transcriptions" \
  -H "Authorization: Bearer <key>" \
  -F "file=@/tmp/test_tts.wav" \
  -F "model=whisper-1"
```

---

## 6. Container Info

| Property | Value |
|----------|-------|
| **Container Name** | `zappro-wav2vec2-proxy` |
| **Docker Network** | `qgtzrmi6771lt8l7x8rqx72f` |
| **IP Address** | `10.0.19.9` |
| **Host Port** | `8203` |
| **Dockerfile** | `docs/OPERATIONS/SKILLS/wav2vec2-deepgram-proxy.dockerfile` |
| **Compose** | `docs/OPERATIONS/SKILLS/wav2vec2-proxy.compose.yml` |

### Manage the Container

```bash
# View logs
docker logs zappro-wav2vec2-proxy

# Restart
docker restart zappro-wav2vec2-proxy

# Rebuild (after code changes)
cd /srv/monorepo
docker compose -f docs/OPERATIONS/SKILLS/wav2vec2-proxy.compose.yml build --no-cache
docker compose -f docs/OPERATIONS/SKILLS/wav2vec2-proxy.compose.yml up -d

# Stop
docker compose -f docs/OPERATIONS/SKILLS/wav2vec2-proxy.compose.yml down
```

---

## 7. Dependencies

```
wav2vec2-deepgram-proxy
      │
      ├── whisper-api (:8201) — wav2vec2 STT engine
      │         └── wav2vec2 PT-BR model (GPU)
      │
      └── Ollama (:11434) — transcript enhancement
                └── llama3-portuguese-tomcat-8b-instruct-q8
```

Both upstream services must be healthy for full functionality.

---

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `curl: (7) Failed to connect` | Container down | `docker start zappro-wav2vec2-proxy` |
| Empty transcript | whisper-api unreachable | Check `WHISPER_API` env and whisper-api container |
| Enhancement returns nothing | Ollama unreachable | Check `OLLAMA_HOST` env and Ollama container |
| `413 File too large` | Audio > 20MB | Split audio or reduce quality |
| Wrong content-type | ffmpeg conversion failed | Check ffmpeg is available in container |
| Port 8203 in use | Conflicting service | Verify with `ss -tlnp \| grep 8203` |
