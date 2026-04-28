# Skill: wav2vec2 STT Health Check

**Purpose:** Verificar saúde do wav2vec2 STT (speech-to-text)
**Complexity:** Low
**Risk:** Read-only
**When to Use:** Check regular, antes de transcrição, após problemas de GPU

## wav2vec2 Info

- **Model:** jonatasgrosman/wav2vec2-large-xlsr-53-portuguese
- **Container:** zappro-wav2vec2 (Docker, nvidia/cuda:12.4.1-runtime-ubuntu22.04)
- **Host Port:** 8202 (mapeado container:8201 → host:8202)
- **Docker Network:** zappro-lite_default (mesma do LiteLLM)
- **VRAM:** ~2GB (GPU)
- **Language:** PT-BR Native
- **Managed by:** docker-compose /home/will/zappro-lite/docker-compose.yml

## Procedure

### 1. Container Status

```bash
docker ps --filter name=zappro-wav2vec2 --format '{{.Status}}'
```

**Expected:** Up (healthy) | **FAIL:** container not running

### 2. Container Health

```bash
curl -s http://localhost:8202/health 2>&1
# ou de dentro do LiteLLM:
docker exec zappro-litellm curl -s http://wav2vec2:8201/health
```

**Expected:** `{"status":"ok"}` | **FAIL:** connection refused, error

### 3. GPU Memory

```bash
nvidia-smi --query-compute-apps=pid,name,used_memory --format=csv,noheader,nounits | grep -i python
```

**Expected:** python3 com ~1900 MiB | **FAIL:** container não está na GPU

### 4. Test Transcription

```bash
curl -s -X POST http://localhost:8202/v1/audio/transcriptions \
  -F "file=@/tmp/test_tts.wav" | python3 -c "import sys,json; print(json.load(sys.stdin).get('text','FAIL'))"
```

**Expected:** texto transcrito | **FAIL:** error response

### 5. Via LiteLLM (rota completa)

```bash
curl -s -X POST "http://localhost:4000/v1/audio/transcriptions" \
  -H "Authorization: Bearer ${LITELLM_KEY}" \
  -F "file=@/tmp/test_tts.wav" \
  -F "model=whisper-1"
```

**Expected:** `{"text":"...","language":"pt",...}` | **FAIL:** timeout ou error

## Output Format

```
wav2vec2 STT HEALTH CHECK — $(date -u '+%Y-%m-%d %H:%M UTC')
=============================================================
CONTAINER:  ✅ zappro-wav2vec2 running (port 8202)
HEALTH:     ✅ {"status":"ok"}
GPU:        ✅ wav2vec2 ~2GB VRAM
TRANSCRIBE: ✅ "texto transcrito"
RESULTADO:  ✅ SAUDÁVEL
```

## Common Failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Container not running | docker-compose down | `cd /home/will/zappro-lite && sudo docker compose up -d wav2vec2` |
| Port 8202 refused | Container sem porta exposta | Verificar ports: 8202:8201 no compose |
| GPU memory 0 | NVIDIA runtime não disponível | Verificar `nvidia-container-toolkit` |
| Transcription timeout | LiteLLM não alcança wav2vec2 | Testar: `docker exec zappro-litellm curl http://wav2vec2:8201/health` |
| Port in use | Processo nativo na 8201 | `kill $(lsof -t -i:8201)` antes de subir container |

## See Also

- `kokoro-health-check.md` — Kokoro TTS (port 8012 via LiteLLM)
- `/home/will/zappro-lite/docker-compose.yml` — deploy config
