# LiteLLM Proxy — Complete Guide

**Purpose:** Teach any LLM how to use, configure, and debug the LiteLLM proxy in this homelab.
**Host:** will-zappro | **LiteLLM Port:** 4000 | **Config:** `/home/will/zappro-lite/config.yaml`
**Last Updated:** 2026-04-11

---

## Table of Contents

1. [Overview](#1-overview)
2. [API Usage](#2-api-usage)
3. [Model Routing](#3-model-routing)
4. [Config Management](#4-config-management)
5. [Debugging](#5-debugging)
6. [Health Checks](#6-health-checks)
7. [Common Patterns](#7-common-patterns)

---

## 1. Overview

### What is LiteLLM?

LiteLLM is a unified proxy gateway that exposes multiple LLM providers via a single OpenAI-compatible API. All calls use the same interface regardless of the backend provider.

### LiteLLM in this Homelab

| Attribute | Value |
|-----------|-------|
| **Endpoint** | `http://localhost:4000` (host) / `http://10.0.1.1:4000` (container) |
| **Container** | `zappro-litellm` |
| **Network** | `zappro-lite_default` |
| **Config File** | `/home/will/zappro-lite/config.yaml` (bind mount, RO) |
| **Database** | `postgresql://litellm:litellm_pass_2026@zappro-litellm-db:5432/litellm` (persistence) |
| **Rate-Limited Proxy** | `nginx` on `:4004` → `:4000` (5 req/min limit) |

### What DOES and DOES NOT go through LiteLLM

**ROUTES THROUGH LITELLM:**
- `qwen2.5-vl` — Vision model (via Ollama GPU)
- `embedding-nomic` — Embeddings (via Ollama)
- `tom-cat-8b` — PT-BR LLM (via Ollama)
- `gemma3-27b` — LLM (via Ollama fallback)
- `tts-1` — Kokoro TTS synthesis
- `whisper-1` — wav2vec2 STT transcription

**DOES NOT route through LiteLLM (called DIRECT):**
- `minimax/MiniMax-M2.7` — Primary OpenClaw LLM (direct to `api.minimax.io`)
- MiniMax called directly, not via LiteLLM

---

## 2. API Usage

### Base URL

```bash
LITELLM_URL="http://localhost:4000"
LITELLM_KEY="sk-zappro-lm-2026-s8k3m9x2p7r6t5w1v4c8n0d5j7f9g3h6i2k4l6m8n0p1"
```

All endpoints use OpenAI-compatible format: `${LITELLM_URL}/v1/{endpoint}

### List Available Models

```bash
curl -s -H "Authorization: Bearer $LITELLM_KEY" "$LITELLM_URL/v1/models" | python3 -c "
import sys, json
d = json.load(sys.stdin)
for m in d.get('data', []):
    print(m['id'])
"
```

**Example output:**
```
tts-1
whisper-1
qwen2.5-vl
tom-cat-8b
embedding-nomic
gemma3-27b
```

### Chat Completions

```bash
curl -s -X POST "$LITELLM_URL/v1/chat/completions" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwen2.5-vl",
    "messages": [{"role": "user", "content": [{"type": "text", "text": "Say only: OK"}]}],
    "max_tokens": 10
  }'
```

### Chat with Vision (Image)

```bash
# Encode image as base64
IMG_DATA=$(base64 -w0 /tmp/image.jpg)

curl -s -X POST "$LITELLM_URL/v1/chat/completions" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d "{
    \"model\": \"qwen2.5-vl\",
    \"messages\": [{
      \"role\": \"user\",
      \"content\": [
        {\"type\": \"text\", \"text\": \"Describe this image in one word.\"},
        {\"type\": \"image_url\", \"image_url\": {\"url\": \"data:image/jpeg;base64,$IMG_DATA\"}}
      ]
    }],
    \"max_tokens\": 20
  }"

unset IMG_DATA  # Clear from memory
```

### Text-to-Speech (TTS)

```bash
curl -s -X POST "$LITELLM_URL/v1/audio/speech" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "tts-1", "input": "Olá, como vai você?", "voice": "pm_santa"}' \
  -o /tmp/test_tts.mp3

ls -lh /tmp/test_tts.mp3
```

**Allowed voices:** `pm_santa` (male PT-BR, default), `pf_dora` (female PT-BR)
**All other voices return 400.**

### Speech-to-Text (Transcription)

```bash
curl -s -X POST "$LITELLM_URL/v1/audio/transcriptions" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -F "file=@/tmp/test_audio.wav" \
  -F "model=whisper-1" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('text','FAIL'))"
```

### Embeddings

```bash
curl -s -X POST "$LITELLM_URL/v1/embeddings" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "embedding-nomic", "input": "Hello world"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'vector dims: {len(d[\"data\"][0][\"embedding\"])}')"
```

---

## 3. Model Routing

### How LiteLLM Routes Requests

LiteLLM reads `config.yaml` to determine where to send each model request. The config defines:

1. **model definitions** — which backend to call
2. **litellm settings** — API keys, timeouts, fallbacks

### config.yaml Structure

```yaml
model_list:
  - model_name: qwen2.5-vl
    litellm_params:
      model: ollama/qwen2.5-vl
      api_base: http://10.0.1.1:11434
      stream: false

  - model_name: embedding-nomic
    litellm_params:
      model: ollama/ nommic-embed-text
      api_base: http://10.0.1.1:11434

  - model_name: tts-1
    litellm_params:
      model: kokoro/local
      api_base: http://10.0.2.4:8880

  - model_name: whisper-1
    litellm_params:
      model: whisper-api/whisper-1
      api_base: http://wav2vec2:8201

  - model_name: tom-cat-8b
    litellm_params:
      model: ollama/llama3-portuguese-tomcat-8b-instruct-q8
      api_base: http://10.0.1.1:11434

  - model_name: gemma3-27b
    litellm_params:
      model: openrouter/nemotron-3-super
      api_key: ${OPENROUTER_API_KEY}
```

### Backend Connectivity Map

| Model (LiteLLM name) | Backend | Internal Host | Port | Network |
|---------------------|---------|---------------|------|---------|
| `qwen2.5-vl` | Ollama (Vision) | `10.0.1.1` | 11434 | `zappro-lite_default` |
| `embedding-nomic` | Ollama (Embed) | `10.0.1.1` | 11434 | `zappro-lite_default` |
| `tom-cat-8b` | Ollama (LLM PT-BR) | `10.0.1.1` | 11434 | `zappro-lite_default` |
| `gemma3-27b` | OpenRouter (fallback) | — | — | Internet |
| `tts-1` | Kokoro TTS | `10.0.2.4` | 8880 | `zappro-lite_default` |
| `whisper-1` | wav2vec2 STT | `wav2vec2` | 8201 | `zappro-lite_default` |

### Common Routing Failures

| Error | Cause | Solution |
|-------|-------|----------|
| `Connection refused: 10.0.1.1:11434` | Ollama down | `docker restart zappro-litellm` + check Ollama health |
| `404 model not found` | Model not in config.yaml | Add model to `model_list` + restart LiteLLM |
| `500 server error` | Backend timeout | Check upstream service health |
| `No API provider registered for api: undefined` | OpenClaw using LiteLLM for primary LLM | **DO NOT route primary LLM through LiteLLM** |

---

## 4. Config Management

### Config File Location

```
/home/will/zappro-lite/config.yaml
```

This file is bind-mounted read-only into the `zappro-litellm` container.

### Restarting LiteLLM After Config Changes

```bash
docker restart zappro-litellm
sleep 5
curl -sf http://localhost:4000/health
```

### Adding a New Model

1. Edit `/home/will/zappro-lite/config.yaml`
2. Add entry to `model_list`:

```yaml
  - model_name: my-new-model
    litellm_params:
      model: ollama/my-model
      api_base: http://10.0.1.1:11434
```

3. Restart LiteLLM: `docker restart zappro-litellm`
4. Verify: `curl -s -H "Authorization: Bearer $LITELLM_KEY" "$LITELLM_URL/v1/models"`

### Testing Config Syntax

```bash
# Validate YAML syntax
python3 -c "import yaml; yaml.safe_load(open('/home/will/zappro-lite/config.yaml'))" && echo "YAML valid"
```

### Environment Variables in Config

LiteLLM supports `${ENV_VAR}` syntax in config.yaml:

```yaml
litellm_params:
  api_key: ${OPENROUTER_API_KEY}
  api_base: ${OLLAMA_API_BASE}
```

---

## 5. Debugging

### Debug Flowchart

```
Model routing issue?
    │
    ├── Check LiteLLM is up
    │   └── curl http://localhost:4000/health
    │
    ├── Check model is registered
    │   └── curl -H "Authorization: Bearer $LITELLM_KEY" http://localhost:4000/v1/models
    │
    ├── Check backend is reachable FROM LiteLLM container
    │   └── docker exec zappro-litellm curl -sf http://10.0.1.1:11434/api/tags
    │
    └── Check LiteLLM logs
        └── docker logs zappro-litellm --tail 50
```

### Check Model Registration

```bash
curl -s -H "Authorization: Bearer $LITELLM_KEY" "$LITELLM_URL/v1/models" | python3 -c "
import sys, json
d = json.load(sys.stdin)
models = [m['id'] for m in d.get('data', [])]
print(f'Registered models ({len(models)}):')
for m in sorted(models):
    print(f'  - {m}')
"
```

### Check Backend Connectivity

```bash
# From LiteLLM container to Ollama
docker exec zappro-litellm curl -sf http://10.0.1.1:11434/api/tags | python3 -c "
import sys, json
d = json.load(sys.stdin)
models = [m['name'] for m in d.get('models', [])]
print(f'Ollama models: {len(models)}')
"

# From LiteLLM container to wav2vec2
docker exec zappro-litellm curl -sf http://wav2vec2:8201/health

# From LiteLLM container to Kokoro
docker exec zappro-litellm curl -sf http://10.0.2.4:8880/health
```

### Check LiteLLM Logs

```bash
docker logs zappro-litellm --tail 100 | grep -E "ERROR|error|warning|model"
```

### Test Individual Backend Directly

```bash
# Test Ollama directly
curl -s http://10.0.1.1:11434/api/tags | python3 -c "import sys,json; print(json.load(sys.stdin))"

# Test wav2vec2 directly
curl -s -X POST http://localhost:8201/v1/audio/transcriptions \
  -F "file=@/tmp/test.wav" | python3 -c "import sys,json; print(json.load(sys.stdin))"

# Test Kokoro directly
curl -s -X POST http://localhost:8012/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input":"test","voice":"pm_santa"}' -o /tmp/test.mp3
```

---

## 6. Health Checks

### Quick Health Check

```bash
curl -sf -m 5 http://localhost:4000/health 2>&1
```

**Expected:** `{"status":"ok","models":[...]}`

### Full Health Check Script

```bash
#!/bin/bash
echo "=== LiteLLM Health Check ==="
echo ""

# 1. Process
if ps aux | grep -v grep | grep litellm > /dev/null; then
    echo "✅ Process: running"
else
    echo "🔴 Process: not found"
fi

# 2. Port
if ss -tlnp | grep 4000 > /dev/null; then
    echo "✅ Port 4000: listening"
else
    echo "🔴 Port 4000: not listening"
fi

# 3. Health endpoint
health=$(curl -sf -m 5 http://localhost:4000/health 2>&1)
if echo "$health" | grep -q "status"; then
    echo "✅ Health: OK"
    count=$(echo "$health" | python3 -c "import sys,json; print(len(json.load(sys.stdin).get('models',[])))" 2>/dev/null)
    echo "   Models registered: $count"
else
    echo "⚠️ Health: $health"
fi

# 4. Test completion
result=$(curl -s -m 10 -X POST http://localhost:4000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk-test" \
  -d '{"model":"gemma3-27b","messages":[{"role":"user","content":"hi"}],"max_tokens":5}' 2>&1)
if echo "$result" | grep -q "choices"; then
    echo "✅ Completion: working"
else
    echo "⚠️ Completion: $result" | head -c 100
fi

echo ""
echo "=== End Health Check ==="
```

---

## 7. Common Patterns

### Pattern: Vision via LiteLLM

OpenClaw uses LiteLLM for vision. Do NOT route vision through other proxies.

```bash
# CORRECT — vision through LiteLLM
curl -X POST "http://localhost:4000/v1/chat/completions" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{"model": "qwen2.5-vl", "messages": [...]}'

# WRONG — calling Ollama directly for vision (bypasses LiteLLM routing)
curl -X POST "http://10.0.1.1:11434/api/chat" ...
```

### Pattern: TTS Through Kokoro via LiteLLM

```bash
# CORRECT — TTS through LiteLLM
curl -X POST "http://localhost:4000/v1/audio/speech" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{"model": "tts-1", "input": "texto", "voice": "pm_santa"}'
```

### Pattern: Embeddings via LiteLLM

```bash
# CORRECT
curl -X POST "http://localhost:4000/v1/embeddings" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{"model": "embedding-nomic", "input": "text to embed"}'
```

### Pattern: Primary LLM — DO NOT use LiteLLM

OpenClaw's primary LLM (MiniMax-M2.7) calls DIRECT, not through LiteLLM:

```
OpenClaw → https://api.minimax.io/anthropic (direct)
           NOT: OpenClaw → LiteLLM → minimax
```

**Why:** LiteLLM does not have the `api` field compatible with OpenClaw, causing crash with error: `No API provider registered for api: undefined`

### Pattern: Rate-Limited Access (for external callers)

External services should use the nginx rate-limited proxy on port 4004:

```bash
# Rate-limited endpoint (5 requests per minute)
curl -X POST "http://localhost:4004/v1/chat/completions" \
  -H "Authorization: Bearer $LITELLM_KEY" \
  -d '{"model": "gemma3-27b", "messages": [...]}'
```

---

## Quick Reference Card

| Task | Command |
|------|---------|
| List models | `curl -H "Authorization: Bearer $LITELLM_KEY" http://localhost:4000/v1/models` |
| Health check | `curl -sf http://localhost:4000/health` |
| Chat completion | `curl -X POST http://localhost:4000/v1/chat/completions -H "Authorization: Bearer $LITELLM_KEY" -d '{"model":"qwen2.5-vl","messages":[...]}'` |
| TTS | `curl -X POST http://localhost:4000/v1/audio/speech -H "Authorization: Bearer $LITELLM_KEY" -d '{"model":"tts-1","input":"hi","voice":"pm_santa"}'` |
| STT | `curl -X POST http://localhost:4000/v1/audio/transcriptions -H "Authorization: Bearer $LITELLM_KEY" -F "file=@audio.wav" -F "model=whisper-1"` |
| Restart | `docker restart zappro-litellm` |
| Logs | `docker logs zappro-litellm --tail 50` |
| Test Ollama from LiteLLM | `docker exec zappro-litellm curl -sf http://10.0.1.1:11434/api/tags` |

---

## Related Documentation

- [litellm-health-check.md](litellm-health-check.md) — Detailed health check procedures
- [litellm-usage.md](litellm-usage.md) — Usage examples (TTS, STT, Vision, LLM)
- [openclaw-audio-governance.md](../../.claude/rules/openclaw-audio-governance.md) — Which models use LiteLLM (rules)
- [SPEC-009-openclaw-persona-audio-stack.md](../../SPECS/SPEC-009-openclaw-persona-audio-stack.md) — Audio stack architecture
- [PINNED-SERVICES.md](../../GOVERNANCE/PINNED-SERVICES.md) — LiteLLM is a pinned service
- [PORTS.md](../../INFRASTRUCTURE/PORTS.md) — Port 4000 allocation

---

**Author:** Claude Code
**Last Updated:** 2026-04-11
